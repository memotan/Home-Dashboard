# Home Dashboard

NeoNoting / Food Inv. Manager / Budget Manager / Medical Calendar の状況を1画面で眺める、閲覧専用のホーム。
既存の4アプリは変更しない。単一の `index.html`（バニラ JS、ビルドなし）で、GitHub Pages で配信する。

## 表示するもの

| カード | 取得元 | 方法 |
|---|---|---|
| 食品の期限 | Food Inv. Manager の GAS | ブラウザから `list` を直接呼ぶ（判定はこちらで計算し直す） |
| タスク | NeoNoting の GAS | ブラウザから `list` を直接呼ぶ |
| 今月の家計 | `gas/Code.gs`（Home 用 GAS） | `budget` を呼ぶ。家計簿のシートを `openById` で読んで集計だけ返す |
| 服薬 | MedCal の GAS（`memotan/Medical-Calendar` の `gas/Code.gs`） | `today` を呼ぶ。MedCal 側で GAS 同期を有効にする必要がある（日記と写真は送られない） |

Budget Manager の GAS は「自分のみ」公開でブラウザから読めない。公開設定は緩めず、
Home 用 GAS が同じアカウントで読む（Food Inv. Manager の取込タブと同じ方式）。

## セットアップ

1. `gas/Code.gs` を新しい GAS プロジェクトに貼る
2. スクリプト プロパティ `BM_SPREADSHEET_ID` に家計簿のスプレッドシート ID を入れる
3. エディタで `checkBudget` を1回実行して権限を承認する
4. デプロイ > ウェブアプリ（実行: 自分 / アクセス: 全員）。URL は他人に見せない（今月の集計が読めるため）
5. このアプリの設定画面に、Food / NeoNoting / Home 用 / MedCal の GAS の URL を入れる（MedCal に合言葉を設定したら、それも入れる）

## 約束事

- `fetch` に `Content-Type` を付けない（CORS プリフライトで GAS が失敗する）
- シート由来の値は必ず `escHtml()` を通す
- 一部のカードが失敗しても他は表示する（`Promise.allSettled`）
- `APP_VERSION` は連番 `vN`、`GAS_VERSION` は Code.gs を直したときに上げる

## Android アプリにする（Capacitor）

`capacitor-app/` が `index.html` を包む。Food Inv. Manager と同じ方式で、アプリは
**GitHub Pages をそのまま読む**（`capacitor.config.json` の `server.url`）。
`index.html` の変更は push だけで反映され、APK の作り直しは要らない。

- 必要なもの: Node.js 22+、JDK 17+、Android Studio（Food Inv. Manager の README と同じ）
- **リポジトリは、パスに日本語が入らない場所に置く**（Gradle が失敗する）
- 初回: `cd capacitor-app` → `setup.bat`（依存導入 → `cap add android` → sync）→ `npm run open` で Android Studio から実機へ Run
- `npm run sync` が要るのは、`capacitor.config.json` やプラグインを変えたときだけ
- `server.url` は APK に焼き込まれる。リポジトリ名を変えたら直して APK を作り直す。`appId`（`com.homedashboard.app`）は変えない
- GAS の URL は WebView の localStorage に入る。アプリ内で一度入力すれば残る（ブラウザ版とは別保管）
- 現状の連携: 戻るボタン（設定画面 → 終了）、前面復帰時の再読込
- 署名鍵は PC ごとに別。別の PC でビルドした APK は上書きできないので、一度アンインストールする

## アプリアイコン

ドットで描いた家（Nothing OS 風。背景に消灯ドットの格子を敷く。黒地に白ドット、赤はドアの1か所だけ）。
`node icons/gen-icon.mjs` が SVG を生成する。図柄を変えるときは SVG を手で直さず、`CONFIG` を変える。
192 の図面の 32〜160（Android の安全領域）をはみ出すと異常終了する。

| ファイル | 用途 |
|---|---|
| `icons/icon.svg` | 地＋図柄。PWA と favicon |
| `icons/icon-foreground.svg` | 図柄のみ。Android の前景レイヤー |
| `icons/icon-background.svg` | 地＋消灯ドット。Android の背景レイヤー |

PNG（`icon-192/512.png`、`apple-touch-icon.png`、`icons/android/**`）は SVG から書き出してコミット済み。
SVG を変えたら作り直す（ブラウザで SVG を各サイズに描画して保存。サイズは Food Inv. Manager の README の表と同じ）。
Android へは `npm run sync` の最後の `apply-native-icon.mjs` が反映する。**反映には Android Studio でのビルドが必要**（push では変わらない）。
