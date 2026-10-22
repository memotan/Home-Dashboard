// アプリアイコンを生成する。`node icons/gen-icon.mjs` で icons/*.svg を書き出す。
//
// 図柄は「ドットで描いた家」。Nothing OS 風に、背景にも消灯したドットの格子を敷き、
// 家のぶんだけ点灯させる。地はアプリのアクセントの緑（ヘッダの「HOME.」の末尾のドットと同じ色）、
// 家は白、ドアだけ濃い緑。
//
// 出力は3つ。Android のアダプティブアイコンが前景と背景を別レイヤーで要求するため。
//   icon.svg            … 地＋図柄（PWA・favicon 用）
//   icon-foreground.svg … 図柄のみ・地は透明（Android の前景レイヤー）
//   icon-background.svg … 地＋消灯ドット（Android の背景レイヤー）
//
// 背景の消灯ドットは、家と同じ格子・同じ大きさで 192 の図面いっぱいに敷く。
// 家の下に隠れるぶんは前景で覆われるので、重ねても二重に見えない。
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Android のアダプティブアイコンは外周が削られる。192 の図面で 32〜160 の内側に収める
const SAFE_MIN = 32, SAFE_MAX = 160;

export const CONFIG = {
  cols: 13, rows: 13,   // 家の格子
  fill: 0.80,           // マスに対する粒の大きさ
  margin: 0.04,         // 安全領域の内側に取る余白
  bg: '#43a047',        // アプリのアクセントの緑。暗い地だと小さいサイズで沈むため明るくしてある
  off: '#4cae51',       // 消灯ドット（地よりわずかに明るい）
  roof: '#ffffff',
  body: '#d7efd8',
  door: '#1b5e20',
  roofRows: 7,          // 屋根の段数（頂点 1 粒 → 軒 13 粒）
  bodyInset: 1,         // 軒の端から壁までの引っ込み
  doorW: 3, doorH: 4,
  chimney: { col: 10, from: 1, to: 3 },
};

/** 家の点灯マス [{c, r, color}] */
function houseCells(cfg) {
  const mid = (cfg.cols - 1) / 2;
  const cells = [];
  for (let r = 0; r < cfg.roofRows; r++) {
    for (let c = mid - r; c <= mid + r; c++) cells.push({ c, r, color: cfg.roof });
  }
  const { col, from, to } = cfg.chimney;
  for (let r = from; r <= to; r++) cells.push({ c: col, r, color: cfg.roof });
  const doorC0 = mid - (cfg.doorW - 1) / 2;
  const doorR0 = cfg.rows - cfg.doorH;
  for (let r = cfg.roofRows; r < cfg.rows; r++) {
    for (let c = cfg.bodyInset; c <= cfg.cols - 1 - cfg.bodyInset; c++) {
      const isDoor = c >= doorC0 && c < doorC0 + cfg.doorW && r >= doorR0;
      cells.push({ c, r, color: isDoor ? cfg.door : cfg.body });
    }
  }
  return cells;
}

export function generate(cfg = CONFIG) {
  const avail = (SAFE_MAX - SAFE_MIN) * (1 - cfg.margin);
  const cell = avail / Math.max(cfg.cols, cfg.rows);
  const x0 = 96 - (cfg.cols * cell) / 2;
  const y0 = 96 - (cfg.rows * cell) / 2;
  const rad = (cell * cfg.fill) / 2;
  const at = (c, r) => [x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell];
  const dot = (c, r, color) => {
    const [x, y] = at(c, r);
    return `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${color}"/>`;
  };

  const lit = houseCells(cfg);
  const body = lit.map(p => dot(p.c, p.r, p.color)).join('\n');

  // 192 の図面全体に消灯ドットを敷く
  const cMin = -Math.ceil(x0 / cell), cMax = Math.ceil((192 - x0) / cell);
  const rMin = -Math.ceil(y0 / cell), rMax = Math.ceil((192 - y0) / cell);
  const grid = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const [x, y] = at(c, r);
      if (x < -rad || x > 192 + rad || y < -rad || y > 192 + rad) continue;
      grid.push(dot(c, r, cfg.off));
    }
  }

  const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" '
             + 'width="192" height="192">';
  const ground = `  <rect width="192" height="192" fill="${cfg.bg}"/>\n${grid.join('\n')}`;

  const xs = lit.map(p => at(p.c, p.r)[0]), ys = lit.map(p => at(p.c, p.r)[1]);
  return {
    icon: `${head}\n${ground}\n${body}\n</svg>\n`,
    foreground: `${head}\n${body}\n</svg>\n`,
    background: `${head}\n${ground}\n</svg>\n`,
    bounds: {
      lo: Math.min(...xs, ...ys) - rad,
      hi: Math.max(...xs, ...ys) + rad,
    },
    count: lit.length,
  };
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = generate();
  if (out.bounds.lo < SAFE_MIN || out.bounds.hi > SAFE_MAX) {
    console.error(`  安全領域からはみ出しています: `
      + `${out.bounds.lo.toFixed(1)}〜${out.bounds.hi.toFixed(1)} `
      + `(許容 ${SAFE_MIN}〜${SAFE_MAX})`);
    process.exit(1);
  }
  for (const [name, svg] of Object.entries({
    'icon.svg': out.icon,
    'icon-foreground.svg': out.foreground,
    'icon-background.svg': out.background,
  })) {
    writeFileSync(join(here, name), svg);
    console.log(`  ${name}`);
  }
  console.log(`  点灯 ${out.count} 粒 / 範囲 ${out.bounds.lo.toFixed(1)}〜${out.bounds.hi.toFixed(1)}`);
}
