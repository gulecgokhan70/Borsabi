import test from 'node:test';
import assert from 'node:assert/strict';
import { packagingConfig } from '../scripts/config.mjs';

test('preserves the confirmed Play identity and requires explicit version history inputs', () => {
  assert.throws(() => packagingConfig([]), /version-code/);
  assert.throws(() => packagingConfig(['--package-id', 'com.borsabi.twa']), /version-code/);
  const args = ['--version-code', '7', '--version-name', '1.2.0'];
  const expected = { preview: false, packageId: 'com.borsabi.twa', versionCode: 7, versionName: '1.2.0' };
  assert.deepEqual(packagingConfig(args), expected);
  assert.deepEqual(packagingConfig(['--package-id', 'com.borsabi.twa', ...args]), expected);
  assert.throws(() => packagingConfig(['--package-id', 'com.borsabi.trader', ...args]), /must remain com.borsabi.twa/);
});
test('keeps the preview identity separate and rejects code injection and malformed versions', () => {
  assert.equal(packagingConfig(['--preview']).packageId, 'com.borsabi.packagingpreview');
  assert.throws(() => packagingConfig(['--preview', '--package-id', 'com.borsabi.trader']));
  for (const id of ['com.example.app', 'com.borsabi.packagingpreview', "com.borsabi.app';bad", '../secret']) {
    assert.throws(() => packagingConfig(['--package-id', id, '--version-code', '1', '--version-name', '1.0.0']));
  }
  for (const code of ['0', '-1', '1.5', '2100000001', 'NaN']) {
    assert.throws(() => packagingConfig(['--version-code', code, '--version-name', '1.0.0']), /version-code/);
  }
});
