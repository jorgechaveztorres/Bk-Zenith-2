const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error(`AndroidManifest.xml not found at: ${manifestPath}`);
  process.exit(1);
}

let content = fs.readFileSync(manifestPath, 'utf8');
const required = [
  { key: 'android.permission.ACCESS_COARSE_LOCATION', xml: '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />' },
  { key: 'android.permission.ACCESS_FINE_LOCATION', xml: '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' },
  { key: 'android.permission.CAMERA', xml: '    <uses-permission android:name="android.permission.CAMERA" />' },
  { key: 'android.hardware.location.gps', xml: '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />' }
];

const missing = required.filter(item => !content.includes(item.key));
if (missing.length === 0) {
  console.log('Required ZÉNITH Android permissions/features already exist; no changes needed.');
  process.exit(0);
}

const manifestClose = content.lastIndexOf('</manifest>');
if (manifestClose < 0) {
  console.error('Invalid AndroidManifest.xml: closing </manifest> tag not found.');
  process.exit(1);
}

const block = '\n    <!-- Permissions required by ZÉNITH GPS, camera and optional GPS hardware -->\n' +
  missing.map(item => item.xml).join('\n') + '\n';
content = content.slice(0, manifestClose) + block + content.slice(manifestClose);
fs.writeFileSync(manifestPath, content, 'utf8');
console.log(`Injected ${missing.length} missing Android permission/feature declaration(s).`);
