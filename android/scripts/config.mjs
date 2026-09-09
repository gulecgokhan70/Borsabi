export function packagingConfig(args) {
  const allowed = new Set(['--preview', '--package-id', '--version-code', '--version-name']);
  const values = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!allowed.has(key) || Object.hasOwn(values, key)) throw new Error(`Unknown or repeated option: ${key}`);
    if (key === '--preview') values[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      values[key] = value;
    }
  }
  const preview = values['--preview'] === true;
  if (preview && Object.keys(values).length !== 1) throw new Error('Preview does not accept release identity options.');
  const packageId = preview ? 'com.borsabi.packagingpreview' : values['--package-id'];
  const versionCode = preview ? 1 : Number(values['--version-code']);
  const versionName = preview ? '0.0.0-preview' : values['--version-name'];
  if (!packageId || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(packageId)) {
    throw new Error('Provide the existing Play application ID using --package-id. No release ID is assumed.');
  }
  if (!preview && /(?:^|\.)(?:example|test|packagingpreview)(?:\.|$)/.test(packageId)) {
    throw new Error('A sample or preview package ID cannot be used for release preparation.');
  }
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('--version-code must be a positive integer, higher than every previous Play upload.');
  }
  if (!versionName || !/^[0-9][a-zA-Z0-9.+-]{0,49}$/.test(versionName)) throw new Error('Invalid --version-name.');
  return { preview, packageId, versionCode, versionName };
}
