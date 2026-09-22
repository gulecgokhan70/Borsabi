// Only the root deployment process writes this local, mode-600 server secret file.
const fs = require('node:fs');
const webpush = require('web-push');
const file = '/etc/borsabi-push.env';
if (!fs.existsSync(file)) {
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(file, `WEB_PUSH_SUBJECT=https://borsabi.com\nWEB_PUSH_PUBLIC_KEY=${keys.publicKey}\nWEB_PUSH_PRIVATE_KEY=${keys.privateKey}\n`, { mode: 0o600, flag: 'wx' });
}
console.log('Bildirim anahtar dosyası hazır.');
