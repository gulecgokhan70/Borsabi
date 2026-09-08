#!/usr/bin/env bash
# Ubuntu VPS: prepare an isolated release; audit and back up before additive DDL.
set -Eeuo pipefail
umask 077
repo=/opt/borsabi
env_file=/etc/borsabi.env
override_dir=/etc/systemd/system/borsabi.service.d
override_file=$override_dir/30-currency-release.conf
test "$(id -u)" = 0
test -f "$env_file"
systemctl is-active --quiet borsabi
exec 9>/run/lock/borsabi-ai-deploy.lock
flock -n 9 || { echo 'Baska bir yayin islemi calisiyor.'; exit 1; }
runuser -u borsabi -- git -C "$repo" diff --quiet
runuser -u borsabi -- git -C "$repo" diff --cached --quiet
sha=$(runuser -u borsabi -- git -C "$repo" rev-parse --short HEAD)
release=$(mktemp -d "/opt/borsabi-release-${sha}.XXXXXX")
chmod 755 "$release"
runuser -u borsabi -- git -C "$repo" archive HEAD | tar -x -C "$release"
app=$release/nextjs_space
chown -R borsabi:borsabi "$release"
install -o borsabi -g borsabi -m 600 "$env_file" "$app/.env"
cd "$app"
echo 'Yeni surum ayri klasorde hazirlaniyor; mevcut site acik.'
runuser -u borsabi -- npm ci --include=dev
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/currency-migration.ts --check
runuser -u borsabi -- env NEXT_DIST_DIR=.next NODE_OPTIONS=--max-old-space-size=2048 NEXT_TELEMETRY_DISABLED=1 npm run build
test -s .next/BUILD_ID

backup=$(mktemp -d /root/borsabi-currency-backup.XXXXXX)
had_override=0
if test -f "$override_file"; then
  cp -a "$override_file" "$backup/previous.conf"
  had_override=1
fi
rollback() {
  trap - ERR INT TERM
  echo 'Yayin tamamlanamadi; onceki uygulama surumune donuluyor.'
  if test "$had_override" = 1; then cp -a "$backup/previous.conf" "$override_file"; else rm -f "$override_file"; fi
  systemctl daemon-reload
  systemctl restart borsabi
  # Added nullable columns are backward compatible. Never restore a DB over newer trades.
  exit 1
}
trap rollback ERR INT TERM
systemctl stop borsabi
# Audit again with the old writer stopped; refuse to invent historical exchange rates.
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/currency-migration.ts --check
runuser -u postgres -- pg_dump --format=custom --dbname=borsabi > "$backup/database.dump"
test -s "$backup/database.dump"
pg_restore --list "$backup/database.dump" > "$backup/database-list.txt"
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/currency-migration.ts --apply
install -d -m 755 "$override_dir"
printf '%s\n' '[Service]' "WorkingDirectory=$app" 'ExecStart=' \
  "ExecStart=/usr/bin/env NEXT_DIST_DIR=.next /usr/bin/node $app/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000" > "$override_file"
systemctl daemon-reload
systemctl restart borsabi
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ -o /dev/null 2>/dev/null; then ready=1; break; fi
  sleep 2
done
test "$ready" = 1
test "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/fx)" = 401
systemctl is-active --quiet borsabi
trap - ERR INT TERM
printf 'SURUM YAYINDA: %s. Veritabani yedegi: %s\n' "$sha" "$backup"
