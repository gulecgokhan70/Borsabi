import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { packagingConfig } from './config.mjs';

const require = createRequire(import.meta.url);
const { TwaGenerator, TwaManifest, ConsoleLog, fetchUtils } = require('@bubblewrap/core');
// Loopback HTTP assets do not need persistent HTTP/2 connections.
fetchUtils.setFetchEngine('node-fetch');
const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = path.resolve(root, '../nextjs_space/public');
const config = packagingConfig(process.argv.slice(2));
const output = path.join(root, 'generated', `${config.packageId}-${config.versionCode}`);
try {
  await access(output);
  throw new Error(`Output already exists: ${output}. Preserve it and choose the next version code, or move it before regenerating.`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

// Only checked-in public build assets are served, on loopback, for this generator.
// Generation never needs access to the production site, database or signing keys.
const assets = new Map(await Promise.all(['icon-512x512.png', 'icon-maskable-512x512.png', 'manifest.json'].map(async name => [
  `/${name}`, await readFile(path.join(publicDir, name)),
])));
const server = createServer((req, res) => {
  const body = assets.get(req.url);
  if (req.method !== 'GET' || !body) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', req.url.endsWith('.json') ? 'application/json' : 'image/png');
  res.end(body);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const localOrigin = `http://127.0.0.1:${server.address().port}`;
const manifestData = {
  packageId: config.packageId,
  host: 'borsabi.com',
  name: config.preview ? 'BorsaBi Preview' : 'BorsaBi Trader',
  launcherName: config.preview ? 'BorsaBi Preview' : 'BorsaBi',
  startUrl: '/dashboard',
  display: 'standalone',
  orientation: 'default',
  themeColor: '#0B1120', themeColorDark: '#0B1120',
  navigationColor: '#0B1120', navigationColorDark: '#0B1120',
  backgroundColor: '#0B1120',
  iconUrl: `${localOrigin}/icon-512x512.png`,
  maskableIconUrl: `${localOrigin}/icon-maskable-512x512.png`,
  webManifestUrl: `${localOrigin}/manifest.json`,
  enableNotifications: true,
  enableSiteSettingsShortcut: true,
  splashScreenFadeOutDuration: 200,
  fallbackType: 'customtabs',
  minSdkVersion: 23,
  appVersion: config.versionName,
  appVersionCode: config.versionCode,
  // No secret or keystore is created. Signing is a separate owner-controlled step.
  signingKey: { path: '', alias: '' },
  additionalTrustedOrigins: [],
  shortcuts: [],
  features: {},
};

try {
  await mkdir(output, { recursive: true });
  await new TwaGenerator().createTwaProject(output, new TwaManifest(manifestData), new ConsoleLog('BorsaBi packaging'));
  const gradlePath = path.join(output, 'app/build.gradle');
  let gradle = await readFile(gradlePath, 'utf8');
  if (!/compileSdkVersion 36\b/.test(gradle) || !/targetSdkVersion 36\b/.test(gradle)) {
    throw new Error('The pinned generator must target API 36; review toolchain before building.');
  }
  gradle = gradle.replaceAll(localOrigin, 'https://borsabi.com');
  await writeFile(gradlePath, gradle);
  const topGradlePath = path.join(output, 'build.gradle');
  const topGradle = (await readFile(topGradlePath, 'utf8'))
    .replaceAll('jcenter()', 'mavenCentral()')
    .replace('com.android.tools.build:gradle:8.9.1', 'com.android.tools.build:gradle:8.10.1');
  if (!topGradle.includes('com.android.tools.build:gradle:8.10.1')) throw new Error('Unexpected Android build plugin template.');
  await writeFile(topGradlePath, topGradle);
  const androidManifestPath = path.join(output, 'app/src/main/AndroidManifest.xml');
  const androidManifest = (await readFile(androidManifestPath, 'utf8'))
    .replace('android:allowBackup="true"', 'android:allowBackup="false"\n        android:usesCleartextTraffic="false"');
  await writeFile(androidManifestPath, androidManifest);
  const savedManifest = { ...manifestData,
    iconUrl: 'https://borsabi.com/icon-512x512.png',
    maskableIconUrl: 'https://borsabi.com/icon-maskable-512x512.png',
    webManifestUrl: 'https://borsabi.com/manifest.json',
  };
  await writeFile(path.join(output, 'twa-manifest.json'), JSON.stringify(savedManifest, null, 2) + '\n');
  await writeFile(path.join(output, 'PREPARATION.json'), JSON.stringify({
    ...config, targetSdk: 36, compileSdk: 36, minSdk: 23,
    generator: '@bubblewrap/core@1.25.0', androidGradlePlugin: '8.10.1', gradle: '8.11.1', signed: false,
    playReady: false,
    note: config.preview ? 'Build verification only. Never upload this identity to Play.' : 'Identity, version history, signing and device validation still required.',
  }, null, 2) + '\n');
  console.log(`Android source generated: ${output}`);
  console.log('Unsigned build: bash gradlew --no-daemon :app:bundleRelease :app:lintRelease');
  console.log('No app was signed, uploaded or published.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
