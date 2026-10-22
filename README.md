# Home Dashboard

NeoNoting / Food Inv. Manager / Budget Manager / Medical Calendar の状況を1画面で眺める、閲覧専用のホーム。
既存の4アプリは変更しない。単一の `index.html`（バニラ JS、ビルドなし）で、GitHub Pages で配信する。

## 表示するもの

| カード | 取得元 | 方法 |
|---|---|---|
| 食品の期限 | Food Inv. Manager の GAS | ブラウザから `list` を直接呼ぶ（判定はこちらで計算し直す） |
| タスク | NeoNoting の GAS | ブラウザから `list` を直接呼ぶ |
| 今月の家計 | `gas/Code.gs`（Home 用 GAS） | `budget` を呼ぶ。家計簿のシートを `openById` で読んで集計だけ返す |
| 服薬 | （未対応） | Medical Calendar が localStorage のみのため。サーバ同期を足したあとに対応 |

Budget Manager の GAS は「自分のみ」公開でブラウザから読めない。公開設定は緩めず、
Home 用 GAS が同じアカウントで読む（Food Inv. Manager の取込タブと同じ方式）。

## セットアップ

1. `gas/Code.gs` を新しい GAS プロジェクトに貼る
2. スクリプト プロパティ `BM_SPREADSHEET_ID` に家計簿のスプレッドシート ID を入れる
3. エディタで `checkBudget` を1回実行して権限を承認する
4. デプロイ > ウェブアプリ（実行: 自分 / アクセス: 全員）。URL は他人に見せない（今月の集計が読めるため）
5. このアプリの設定画面に、Food / NeoNoting / Home 用 GAS の URL を入れる

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
- アプリアイコンは未作成（Android 既定）。作るときは Food Inv. Manager の `icons/gen-icon.mjs` が参考になる
- 署名鍵は PC ごとに別。別の PC でビルドした APK は上書きできないので、一度アンインストールする
