#!/usr/bin/env bash
# Ubuntu VPS: prepare an isolated release; audit and back up before additive DDL.
set -Eeuo pipefail
umask 077
stage='Baslangic kontrolleri'
report_error() {
  printf 'YAYIN DURDU: %s (hata kodu: %s).\n' "$stage" "$1" >&2
}
trap 'report_error "$?"' ERR
fail() { printf 'YAYIN DURDU: %s\n' "$1" >&2; exit 1; }
check_only=0
if test "$#" -gt 0; then
  if test "$#" = 1 && test "$1" = --check; then
    check_only=1
  else
    fail 'Kullanim: bash deploy-platform.sh [--check]'
  fi
fi
repo=/opt/borsabi
env_file=/etc/borsabi.env
override_dir=/etc/systemd/system/borsabi.service.d
override_file=$override_dir/30-currency-release.conf
echo 'Yayin baslangic kontrolleri yapiliyor...'
test "$(id -u)" = 0 || fail 'Bu komut root kullanicisi ile calistirilmali.'
test -f "$env_file" || fail '/etc/borsabi.env bulunamadi.'
systemctl is-active --quiet borsabi || fail 'borsabi servisi aktif degil. Once servis durumu incelenmeli.'
stage='Depodaki yerel degisikliklerin kontrolu'
repo_status=$(runuser -u borsabi -- git -C "$repo" status --short --untracked-files=no)
if test -n "$repo_status"; then
  printf '%s\n' "$repo_status" >&2
  fail 'Yukaridaki dosyalarda yerel degisiklik var. Dosyalar korunuyor; yayin oncesinde incelenmeli.'
fi
sha=$(runuser -u borsabi -- git -C "$repo" rev-parse --short HEAD)
if test "$check_only" = 1; then
  printf 'BASLANGIC KONTROLLERI TAMAM: %s. Yayin ve veritabani islemi yapilmadi.\n' "$sha"
  exit 0
fi
stage='Yayin kilidinin alinmasi'
exec 9>/run/lock/borsabi-ai-deploy.lock
flock -n 9 || fail 'Baska bir yayin islemi calisiyor.'
stage='Yeni surum klasorunun hazirlanmasi'
release=$(mktemp -d "/opt/borsabi-release-${sha}.XXXXXX")
chmod 755 "$release"
runuser -u borsabi -- git -C "$repo" archive HEAD | tar -x -C "$release"
app=$release/nextjs_space
chown -R borsabi:borsabi "$release"
install -o borsabi -g borsabi -m 600 "$env_file" "$app/.env"
cd "$app"
echo 'Yeni surum ayri klasorde hazirlaniyor; mevcut site acik.'
stage='Paket kurulumu'
runuser -u borsabi -- npm ci --include=dev
stage='Kripto gecmisinin ilk kontrolu'
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/currency-migration.ts --check
stage='Bildirim anahtar dosyasinin hazirlanmasi'
node scripts/prepare-push.cjs
stage='Uygulamanin derlenmesi'
runuser -u borsabi -- env NEXT_DIST_DIR=.next NODE_OPTIONS=--max-old-space-size=2048 NEXT_TELEMETRY_DISABLED=1 npm run build
test -s .next/BUILD_ID

stage='Yedek klasorunun hazirlanmasi'
backup=$(mktemp -d /root/borsabi-currency-backup.XXXXXX)
worker_unit=/etc/systemd/system/borsabi-automation.service
worker_was_active=0
systemctl is-active --quiet borsabi-automation && worker_was_active=1
had_worker=0
if test -f "$worker_unit"; then cp -a "$worker_unit" "$backup/worker.service"; had_worker=1; fi
had_override=0
if test -f "$override_file"; then
  cp -a "$override_file" "$backup/previous.conf"
  had_override=1
fi
rollback() {
  local failure_code=$?
  trap - ERR INT TERM
  report_error "$failure_code"
  echo 'Yayin tamamlanamadi; onceki uygulama surumune donuluyor.'
  if test "$had_override" = 1; then cp -a "$backup/previous.conf" "$override_file"; else rm -f "$override_file"; fi
  systemctl stop borsabi-automation || true
  if test "$had_worker" = 1; then cp -a "$backup/worker.service" "$worker_unit"; else systemctl disable borsabi-automation || true; rm -f "$worker_unit"; fi
  systemctl daemon-reload
  systemctl restart borsabi
  if test "$worker_was_active" = 1; then systemctl start borsabi-automation; fi
  # Added nullable columns are backward compatible. Never restore a DB over newer trades.
  exit 1
}
trap rollback ERR INT TERM
stage='Servisin gecis icin durdurulmasi'
systemctl stop borsabi-automation 2>/dev/null || true
systemctl stop borsabi
# Audit again with the old writer stopped; refuse to invent historical exchange rates.
stage='Kripto gecmisinin son kontrolu'
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/currency-migration.ts --check
stage='Veritabani yedeginin alinmasi'
runuser -u postgres -- pg_dump --format=custom --dbname=borsabi > "$backup/database.dump"
test -s "$backup/database.dump"
pg_restore --list "$backup/database.dump" > "$backup/database-list.txt"
stage='Para birimi semasinin uygulanmasi'
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/currency-migration.ts --apply
stage='Platform semasinin uygulanmasi'
runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/platform-migration.ts
stage='Yeni surumun baslatilmasi'
install -d -m 755 "$override_dir"
printf '%s\n' '[Service]' 'EnvironmentFile=/etc/borsabi-push.env' "WorkingDirectory=$app" 'ExecStart=' \
  "ExecStart=/usr/bin/env NEXT_DIST_DIR=.next /usr/bin/node $app/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000" > "$override_file"
install -d -o borsabi -g borsabi -m 700 /var/lib/borsabi
printf '%s\n' '[Unit]' 'Description=BorsaBi simulation automation' 'After=network.target postgresql.service' '[Service]' 'User=borsabi' 'Group=borsabi' "WorkingDirectory=$app" 'EnvironmentFile=/etc/borsabi.env' 'EnvironmentFile=/etc/borsabi-push.env' "ExecStart=/usr/bin/flock --nonblock /var/lib/borsabi/automation.lock /usr/bin/node $app/node_modules/tsx/dist/cli.mjs $app/scripts/automation-worker.ts" 'Restart=on-failure' 'RestartSec=10' 'TimeoutStopSec=45' '[Install]' 'WantedBy=multi-user.target' > "$worker_unit"
systemctl daemon-reload
systemctl restart borsabi
worker_start=$(date +%s)
systemctl enable --now borsabi-automation
stage='Yeni surumun HTTP kontrolu'
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ -o /dev/null 2>/dev/null; then ready=1; break; fi
  sleep 2
done
test "$ready" = 1
test "$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/fx)" = 401
systemctl is-active --quiet borsabi
systemctl is-active --quiet borsabi-automation
stage='Otomasyonun ilk dongusunun kontrolu'
worker_ready=0
for attempt in $(seq 1 20); do
  if runuser -u borsabi -- node --require dotenv/config node_modules/tsx/dist/cli.mjs scripts/check-automation.ts "$worker_start"; then worker_ready=1; break; fi
  sleep 2
done
test "$worker_ready" = 1
trap - ERR INT TERM
printf 'SURUM YAYINDA: %s. Veritabani yedegi: %s\n' "$sha" "$backup"
