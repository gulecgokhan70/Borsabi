#!/usr/bin/env bash
# Ubuntu VPS: build into a new directory, switch only after a successful build.
set -Eeuo pipefail
umask 077
app=/opt/borsabi/nextjs_space
env_file=/etc/borsabi.env
override_dir=/etc/systemd/system/borsabi.service.d
override_file=$override_dir/20-ai-build.conf
test "$(id -u)" = 0
cd "$app"
test -f "$env_file"
test -d node_modules
systemctl is-active --quiet borsabi
grep -qx 'AI_PROVIDER=groq' "$env_file"
grep -q '^GROQ_API_KEY=gsk_' "$env_file"
exec 9>/run/lock/borsabi-ai-deploy.lock
flock -n 9 || { echo 'Baska bir yayin islemi calisiyor.'; exit 1; }
build_dir=".next-ai-$(date +%s)"
backup_dir=$(mktemp -d /root/borsabi-ai-deploy.XXXXXX)
# Next updates tracked type configuration when a custom build directory is used.
# Restore those files so a subsequent git pull does not conflict with build output.
cp tsconfig.json next-env.d.ts "$backup_dir/"
restore_types() {
  install -o borsabi -g borsabi -m 644 "$backup_dir/tsconfig.json" "$app/tsconfig.json"
  install -o borsabi -g borsabi -m 644 "$backup_dir/next-env.d.ts" "$app/next-env.d.ts"
}
trap restore_types EXIT
echo 'Yeni surum hazirlaniyor; mevcut site calismaya devam ediyor.'
runuser -u borsabi -- env NEXT_DIST_DIR="$build_dir" \
  NODE_OPTIONS=--max-old-space-size=2048 NEXT_TELEMETRY_DISABLED=1 npm run build
test -s "$build_dir/BUILD_ID"
had_override=0
if test -f "$override_file"; then
  cp -a "$override_file" "$backup_dir/previous.conf"
  had_override=1
fi
rollback() {
  trap - ERR
  echo 'Yeni surum acilamadi; onceki derlemeye donuluyor.'
  if test "$had_override" = 1; then
    cp -a "$backup_dir/previous.conf" "$override_file"
  else
    rm -f "$override_file"
  fi
  systemctl daemon-reload
  systemctl restart borsabi
  exit 1
}
trap rollback ERR
install -d -m 755 "$override_dir"
# Clear ExecStart so NEXT_DIST_DIR explicitly overrides any existing env file value.
printf '%s\n' '[Service]' 'ExecStart=' \
  "ExecStart=/usr/bin/env NEXT_DIST_DIR=$build_dir /usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000" \
  > "$override_file"
systemctl daemon-reload
systemctl restart borsabi
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ -o /dev/null; then
    ready=1
    break
  fi
  sleep 2
done
test "$ready" = 1
systemctl is-active --quiet borsabi
trap - ERR
echo 'GROQ DESTEKLI SURUM YAYINDA. AI Asistan sayfasindan deneyin.'
