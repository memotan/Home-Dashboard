// index.html の APP_PACKAGES（姉妹アプリのパッケージ名）を、AndroidManifest.xml の <queries> へ反映する。
//
// Android 11 以降は、<queries> に書いていないアプリを、パッケージ名で起動できない
// （AppLauncher の openUrl が「開けなかった」になる）。android/ は `cap add android` が生成する
// ものなので git では管理しておらず、cap sync も <queries> を足さない。そのため、
// npm run sync のたびに、ここで書き込む（何度実行しても同じ結果になる）。
//
// パッケージ名の正本は index.html の APP_PACKAGES。ここで二重に持たない。
// ネイティブの設定なので、反映には Android Studio でのビルドが必要。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(manifestPath)) {
  console.log('  android/ がまだ無いので、<queries> の反映は省略します');
  process.exit(0);
}

const html = readFileSync(join(root, '..', 'index.html'), 'utf8');
const block = html.match(/APP_PACKAGES:begin([\s\S]*?)APP_PACKAGES:end/);
if (!block) {
  console.error('  index.html に APP_PACKAGES:begin / end の範囲が見つかりません');
  process.exit(1);
}
const packages = [...block[1].matchAll(/:\s*'([A-Za-z][\w]*(?:\.[\w]+)+)'/g)].map(m => m[1]);
if (!packages.length) {
  console.error('  APP_PACKAGES からパッケージ名を読み取れませんでした');
  process.exit(1);
}

const BEGIN = '<!-- home-dashboard:queries:begin -->';
const END = '<!-- home-dashboard:queries:end -->';
const body = [BEGIN, '    <queries>', ...packages.map(p => `        <package android:name="${p}" />`), '    </queries>', '    ' + END].join('\n');

let xml = readFileSync(manifestPath, 'utf8');
const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}`);
if (re.test(xml)) {
  xml = xml.replace(re, () => body);
} else {
  // <application> の直前に置く（<queries> は <manifest> 直下の要素）
  if (!/<application[\s>]/.test(xml)) {
    console.error('  AndroidManifest.xml に <application> が見つかりません');
    process.exit(1);
  }
  xml = xml.replace(/\n?[ \t]*<application[\s>]/, m => `\n    ${body}\n\n${m.replace(/^\n/, '')}`);
}

const before = readFileSync(manifestPath, 'utf8');
if (before === xml) {
  console.log('  <queries> は最新です');
  process.exit(0);
}
writeFileSync(manifestPath, xml);
console.log('  AndroidManifest.xml の <queries> を更新しました');
packages.forEach(p => console.log('    ' + p));
console.log('  ※ ネイティブの設定なので、反映には Android Studio でのビルドが要ります');
