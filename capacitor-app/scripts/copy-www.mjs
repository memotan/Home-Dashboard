// リポジトリのルートにある index.html / manifest.json を www/ にコピーする。
//
// www/ は生成物なので git では管理しない（二重管理で片方だけ直す事故を防ぐ）。
// `npm run sync` から自動で呼ばれる。
import { mkdirSync, copyFileSync, existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const wwwDir = join(here, '..', 'www');

mkdirSync(wwwDir, { recursive: true });

for (const name of ['index.html', 'manifest.json']) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) {
    console.error(`エラー: ${src} が見つかりません`);
    process.exit(1);
  }
  copyFileSync(src, join(wwwDir, name));
  console.log(`  copied  ${name}`);
}
// manifest.json と index.html がアイコンを icons/ 配下から参照している。
// android/ 以下の PNG と生成器は web からは使わないので持っていかない
const iconsSrc = join(repoRoot, 'icons');
cpSync(iconsSrc, join(wwwDir, 'icons'), {
  recursive: true,
  filter: (from) => !/(^|[\\/])(android([\\/]|$)|.*\.mjs$)/.test(from.slice(iconsSrc.length)),
});
console.log('  copied  icons/');
console.log('www/ を更新しました');
