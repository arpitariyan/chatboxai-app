/**
 * scripts/bump-version.js
 *
 * Deterministic version and versionCode synchronizer for ChatBox AI Mobile APK.
 * Usage:
 *   node scripts/bump-version.js [newVersion]
 * Examples:
 *   node scripts/bump-version.js        # auto-increments patch (1.0.0 -> 1.0.1) & versionCode (1 -> 2)
 *   node scripts/bump-version.js 1.1.0  # sets version to 1.1.0 & increments versionCode
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '../app.json');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const releaseJsonPath = path.resolve(__dirname, '../releases/latest.json');
const serverReleaseJsonPath = path.resolve(__dirname, '../src/server/config/releases.json');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = appJson.expo.version || '1.0.0';
const currentVersionCode = appJson.expo.android?.versionCode || 1;

let targetVersion = process.argv[2];

if (!targetVersion) {
  // Auto-increment patch
  const parts = currentVersion.split('.').map((n) => parseInt(n, 10));
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1;
    targetVersion = parts.join('.');
  } else {
    targetVersion = `${currentVersion}-next`;
  }
}

const targetVersionCode = currentVersionCode + 1;

console.log(`Bumping Version: ${currentVersion} -> ${targetVersion}`);
console.log(`Bumping VersionCode: ${currentVersionCode} -> ${targetVersionCode}`);

// 1. Update app.json
appJson.expo.version = targetVersion;
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = targetVersionCode;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');

// 2. Update package.json
packageJson.version = targetVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

// 3. Update releases/latest.json if present
if (fs.existsSync(releaseJsonPath)) {
  const rel = JSON.parse(fs.readFileSync(releaseJsonPath, 'utf8'));
  rel.latestVersion = targetVersion;
  rel.latestVersionCode = targetVersionCode;
  rel.apkUrl = `https://github.com/arpitariyan/chatboxai-app/releases/download/v${targetVersion}/chatboxai-v${targetVersion}.apk`;
  rel.publishedAt = new Date().toISOString();
  fs.writeFileSync(releaseJsonPath, JSON.stringify(rel, null, 2) + '\n', 'utf8');
}

// 4. Update src/server/config/releases.json if present
if (fs.existsSync(serverReleaseJsonPath)) {
  const serverRel = JSON.parse(fs.readFileSync(serverReleaseJsonPath, 'utf8'));
  serverRel.latestVersion = targetVersion;
  serverRel.latestVersionCode = targetVersionCode;
  serverRel.apkUrl = `https://github.com/arpitariyan/chatboxai-app/releases/download/v${targetVersion}/chatboxai-v${targetVersion}.apk`;
  serverRel.publishedAt = new Date().toISOString();
  fs.writeFileSync(serverReleaseJsonPath, JSON.stringify(serverRel, null, 2) + '\n', 'utf8');
}

console.log(`Successfully synchronized version v${targetVersion} (code: ${targetVersionCode}) across app configs.`);
