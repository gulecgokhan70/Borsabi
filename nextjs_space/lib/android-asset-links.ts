export function androidAssetLinks(packageId?: string, fingerprints?: string) {
  const id = packageId?.trim();
  const certificates = fingerprints?.split(',').map(value => value.trim().toUpperCase());
  if (!id || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(id)
    || !certificates?.length || certificates.length > 5
    || certificates.some(value => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value))) return null;
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: id,
      sha256_cert_fingerprints: [...new Set(certificates)],
    },
  }];
}
