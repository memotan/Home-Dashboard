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
