import { afterEach, describe, expect, it, vi } from 'vitest';
import { androidAssetLinks } from '@/lib/android-asset-links';
import { GET } from '@/app/.well-known/assetlinks.json/route';

const certificate = Array(32).fill('AB').join(':');
afterEach(() => vi.unstubAllEnvs());
describe('Android website association', () => {
  it('serves no association when identity or certificate is missing or malformed', async () => {
    for (const fingerprint of [undefined, '', 'AB:CD', certificate + ',', 'not-a-certificate']) {
      expect(androidAssetLinks('com.borsabi.trader', fingerprint)).toBeNull();
    }
    expect(androidAssetLinks('../unknown', certificate)).toBeNull();
    vi.stubEnv('ANDROID_APPLICATION_ID', '');
    vi.stubEnv('ANDROID_SHA256_CERT_FINGERPRINTS', '');
    const response = await GET();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual([]);
  });
  it('publishes only configured public identity and normalized signing certificates', async () => {
    vi.stubEnv('ANDROID_APPLICATION_ID', 'com.borsabi.trader');
    vi.stubEnv('ANDROID_SHA256_CERT_FINGERPRINTS', `${certificate.toLowerCase()}, ${certificate}`);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'com.borsabi.trader', sha256_cert_fingerprints: [certificate] },
    }]);
  });
});
