#!/usr/bin/env python3
"""Validate a privately entered Groq key before updating VPS environment files."""
import getpass
import json
import os
from pathlib import Path
import pwd
import re
import sys
import tempfile
import urllib.error
import urllib.request

ENV_FILE = Path('/etc/borsabi.env')
APP_ENV = Path('/opt/borsabi/nextjs_space/.env')
MODEL = 'openai/gpt-oss-120b'


def updated_environment(contents, updates):
    lines = [line for line in contents.splitlines()
             if line.split('=', 1)[0].strip() not in updates]
    return '\n'.join(lines + [f'{key}={value}' for key, value in updates.items()]) + '\n'


def atomic_write(path, contents, uid, gid):
    fd, temporary = tempfile.mkstemp(prefix='.borsabi-', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        os.fchown(fd, uid, gid)
        with os.fdopen(fd, 'w') as stream:
            stream.write(contents)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    if os.geteuid() != 0 or not sys.stdin.isatty():
        raise RuntimeError('Root terminalinde calistirin.')
    if not ENV_FILE.is_file() or not APP_ENV.is_file():
        raise RuntimeError('Mevcut uygulama ayar dosyalari bulunamadi.')
    account = pwd.getpwnam('borsabi')
    current = ENV_FILE.read_text()
    if not all(re.search(rf'^{name}=.+$', current, re.M)
               for name in ('DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET')):
        raise RuntimeError('Mevcut uygulama ayarlari eksik; degisiklik yapilmadi.')
    key = getpass.getpass('Groq anahtarini yapistirin (gorunmez), sonra Enter: ').strip()
    if not re.fullmatch(r'gsk_[A-Za-z0-9_-]{20,200}', key):
        raise RuntimeError('Anahtarin bicimi gecersiz; degisiklik yapilmadi.')
    payload = {
        'model': MODEL,
        'messages': [{'role': 'user', 'content': 'Return a JSON object with ok set to true. Only JSON.'}],
        'response_format': {'type': 'json_object'},
        'max_completion_tokens': 512,
        'reasoning_effort': 'low', 'include_reasoning': False,
    }
    request = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions',
        data=json.dumps(payload).encode(), method='POST', headers={
            'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
            'User-Agent': 'Borsabi-setup',
        })
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
        content = result['choices'][0]['message']['content']
        if json.loads(content).get('ok') is not True:
            raise ValueError()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Groq HTTP {error.code}. Anahtar/model/kota kontrol edilmeli. Degisiklik yapilmadi.') from None
    except Exception:
        raise RuntimeError('Groq baglanti veya JSON testi basarisiz. Degisiklik yapilmadi.') from None
    updated = updated_environment(current, {
        'AI_PROVIDER': 'groq', 'GROQ_API_KEY': key, 'GROQ_MODEL': MODEL,
    })
    # Preserve the original settings privately, including DB and login secrets.
    backup = ENV_FILE.with_name('borsabi.env.before-groq')
    if not backup.exists():
        atomic_write(backup, current, 0, 0)
    atomic_write(APP_ENV, updated, account.pw_uid, account.pw_gid)
    atomic_write(ENV_FILE, updated, 0, 0)
    print('GROQ BAGLANTI TESTI BASARILI. Anahtar gizli kaydedildi.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError) as error:
        # RuntimeError messages are intentionally sanitized; OS errors omit details.
        print(str(error) if isinstance(error, RuntimeError) else 'Dosya/izin hatasi; kurulum durdu.', file=sys.stderr)
        sys.exit(1)
