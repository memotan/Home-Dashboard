# CLAUDE.md

## プロジェクト概要

**Home Dashboard** — 4つの管理アプリ（NeoNoting / Food Inv. Manager / Budget Manager / MedCal）の状況を
1画面で眺める、**閲覧専用**のホーム。GitHub Pages で配信するモバイルファーストの PWA で、
Capacitor で Android アプリにも包んである。**ホームから書き込みはしない**（編集は各アプリで行う）。

- フロントは**単一の `index.html`**（インライン CSS + バニラ JS、ビルド工程なし）
- 依存は CDN の Tabler Icons と Google Fonts（Doto / JetBrains Mono）のみ
- バックエンドは持たない。各アプリの GAS を直接呼ぶ。このリポジトリの GAS（`gas/Code.gs`）は家計簿を読むためだけのもの
- テスト・lint・ビルドの仕組みはない。ブラウザで動作確認する

## ファイル構成

| パス | 役割 |
|---|---|
| `index.html` | 本体。全カードとカレンダー、設定画面、並び替え |
| `gas/Code.gs`, `gas/appsscript.json` | Home 用 GAS。Budget Manager の Transactions を読んで集計を返す。**編集したら GAS エディタに貼り直し、再デプロイが必要** |
| `manifest.json`, `icons/` | PWA マニフェストとアイコン。`icons/gen-icon.mjs` が SVG を生成する |
| `capacitor-app/` | Android アプリ化（Capacitor 8）。`www/` は `npm run sync` が生成するので git 管理しない |
| `docs/decisions.md` | 設計の記録。**選択肢を提示してユーザーが選んだときは、選んだものと選ばなかったものの両方をここに記録する** |
| `README.md` | セットアップ手順 |

## アーキテクチャ

```
ブラウザ / アプリ (index.html)
   ├─ POST ▶ Food Inv. Manager の GAS   action:list            → 食品の期限・買い足す・カレンダー
   ├─ POST ▶ NeoNoting の GAS           action:list            → TODAY・カレンダー
   ├─ POST ▶ Home 用 GAS (gas/Code.gs)  action:budget / daily  → 今月の家計・カレンダーの支出
   └─ POST ▶ MedCal の GAS              action:day + token     → 昨日の日記
```

- `gasCall(url, body, token)` 経由で `POST`（JSON）。レスポンスは `{ ok, data, error }` で、`ok=false` なら `error` を投げる
- **`fetch` に `Content-Type` ヘッダを付けないこと。** 付けると CORS のプリフライトが飛び、GAS が応答できずに失敗する（全アプリ共通）
- 各 GAS の URL・MedCal の合言葉は設定画面でユーザーが入力し、`localStorage`（`hd_*`）に保存する。**端末ごと・オリジンごとに別保管**（ブラウザ版とアプリでは再入力が要る）。認証情報は repo に置かない

### 各取得元との契約（相手側を変えるときは、ここも見直す）

- **Food**: `list` が `{ name, place, expiryDate, quantity, consumed, ... }` の配列を返す。「買い足す」は `!consumed && quantity === 0`。期限の判定（`daysUntil` / `foodStatus`）は**サーバの `status` / `daysLeft` を使わず、フロントで計算し直す**（しきい値はユーザーが変えられるため）
- **NeoNoting**: `list` が `{ name, done, tags:[{name,color}], order, reminderAt }` の配列を返す。TODAY カードは**タグ名が `TODAY`（大文字小文字不問）の未完了タスク**だけ。カレンダーはタグを問わず `reminderAt` のある未完了タスク
- **Budget Manager**: Home 用 GAS が `BM_SPREADSHEET_ID`（スクリプト プロパティ）のスプレッドシートを `openById` で読む。BM の GAS は「自分のみ」公開で、ブラウザからは読めない。**列は見出し名で引く**（`date` `type` `category` `amount`）。BM 側は変更しない
- **MedCal**: `day`（日付を省略すると昨日）が `{ date, note, meds }` を返す。MedCal の GAS は `MEDCAL_TOKEN` が未設定だと `ping` 以外を拒否する

## 実装上の約束事・落とし穴

- **日付はすべて `yyyy-MM-dd` の文字列。** 日付計算は `addDays()`（UTC で計算）を使い、`Date` をローカル時刻で持ち回らない（1日ずれる）
- **GAS で日付セルを読むときは `getDisplayValues()` を使う。** 家計簿の日付列は、古い行が文字列、新しい行が日付時刻の値と混在している。`getValues()` の型に頼ると、新しい行が集計から漏れた（`dateStr_` で表示文字列を正規化している）。月と今日は、スプレッドシートのタイムゾーンで決める
- **シート・外部由来の値は必ず `escHtml()` を通してから `innerHTML` に入れる。** 色の値も `#hex` の形かを確かめてから使う
- **カードが 1 枚失敗しても他は表示する**（`refresh()` は `Promise.allSettled`）。失敗したカードは見出しとエラー文を出す
- **食品・タスクの取得は更新 1 回につき 1 回だけ**（`fetchFoods` / `fetchTasks` / `spendCache`）。複数のカードで共有し、`refresh()` の先頭でキャッシュを捨てる。カードを足すときも、同じ取得元なら共有すること
- **色の約束**: 赤 `--danger`・橙 `--warn`・緑 `--accent` は**食品の期限**（Food Inv. Manager と同じ）。青 `--info` はタスクのリマインド。ほかの用途に流用しない
- **カードを足すとき**: `<div class="card" id="...">` を足し、`CARDS`（並び替えの定義）、`refresh()` の `jobs`、読み込み中の表示の対象に加える。保存済みの並び順は、足りないカードが**末尾に自動で足される**
- カードの並び順は設定画面の ↑ ↓ ボタン（`hd_card_order`）。ドラッグにしなかったのは、スマホのスクロールと干渉するため
- `font-size` は `clamp()` で指定する（タイトルは `white-space:nowrap`。固定だと狭い端末でアイコンを押し出す）
- UI 文言・コメント・コミットメッセージは日本語。ダークテーマ（`--bg:#111`）

## バージョン

| 定数 | 場所 | いつ上げるか |
|---|---|---|
| `APP_VERSION` | `index.html` | 変更を入れるたびに 1 つ上げる（連番 `vN`。日付形式にしない） |
| `GAS_VERSION` | `gas/Code.gs` | `Code.gs` を直したとき |
| `REQUIRED_GAS_VERSION` | `index.html` | 家計カードが動くのに必要な最低版。**Code.gs の仕様を変えて、家計カードに影響するときだけ**上げる |

カレンダーの支出は `daily`（GAS 1.2.0 以上）が必要だが、`REQUIRED_GAS_VERSION` は上げず、
カレンダー側で「GAS を更新してください」と出す（家計カードだけ使う人に、不要な警告を出さないため）。

## Capacitor（Android アプリ）

- `capacitor.config.json` の `server.url` が **GitHub Pages の本番を指す**ため、アプリは本番を直接読む。`index.html` の変更は **push だけで反映され、APK の再ビルドは不要**。**この前提を崩さない**
- **`appId`（`com.homedashboard.app`）は変えない**（別のアプリとして入ってしまう）。`server.url` は APK に焼き込まれるので、リポジトリ名を変えたら直して APK を作り直す
- ネイティブ側（プラグイン・設定・名前・アイコン）を変えたときだけ再ビルドが必要: `cd capacitor-app` → `npm run sync` → Android Studio でビルド
- **リポジトリはパスに日本語を含まない場所に置く**（Gradle が失敗する）。署名鍵は PC ごとに別なので、別の PC でビルドした APK は上書きできず、一度アンインストールが要る
- Android 連携は `setupCapacitor()`（戻るボタン、前面復帰時の再読込）に閉じ込めてある。`window.Capacitor` が無ければ何もしないので、同じファイルがブラウザでも動く。ビルド工程がないため `import` は使えない

## アイコン

ドットで描いた家（黒地・白ドット・赤のワンポイント）。`node icons/gen-icon.mjs` が SVG を生成する。
図柄や色を変えるときは **SVG を手で直さず、`CONFIG` を変えて作り直す**。192 の図面の 32〜160 をはみ出すと異常終了する。
PNG（`icon-192/512.png`、`apple-touch-icon.png`、`icons/android/**`）は SVG をブラウザで描画して書き出したもので、コミット済み。
**SVG を変えたら PNG も作り直す**（サイズは README の表を参照）。Android への反映は Android Studio でのビルドが必要。

## 動作確認

- `file://` や `data:` URL では `localStorage` が使えない場合がある。確認用コピーに `localStorage` のスタブを足すか、HTTP サーバ経由で開く
- 各 GAS はモックで差し替えて確認する（Playwright の `page.route` で、`{ ok, data }` を返す）。実機・実際の GAS での確認はユーザーが行う
- 確認用ファイルはコミットしない

## デプロイ

- **フロント**: `main` ブランチへの push で GitHub Pages が更新される（Source は `main` の `/ (root)`）。配信されるのはリポジトリのルート
- **GAS**: `gas/Code.gs` の変更は自動では反映されない。`GAS_VERSION` を上げ、GAS エディタに貼り直したうえで「デプロイを管理 → 編集 → 新バージョン → デプロイ」まで行う
