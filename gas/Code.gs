/**
 * Home Dashboard 用 GAS（読み取り専用）
 *
 * Budget Manager の GAS は「自分のみ」公開で、ブラウザから直接は読めない。
 * そのため、このスクリプトが同じアカウントで SpreadsheetApp.openById を使って
 * Transactions シートを読み、集計だけを返す（全履歴は返さない）。
 *
 * セットアップ:
 *  1. script.google.com で新しいプロジェクトを作り、このファイルを貼る
 *  2. プロジェクトの設定 > スクリプト プロパティに BM_SPREADSHEET_ID（家計簿のスプレッドシートID）を追加
 *  3. エディタで checkBudget を 1 回手動実行し、権限を承認する
 *  4. デプロイ > ウェブアプリ（実行: 自分 / アクセス: 全員）。発行された URL をホームの設定に入れる
 *     ※URL を知っている人は今月の集計を読める。URL は他人に見せないこと
 */
const GAS_VERSION = '1.0.0';
const TX_SHEET_ = 'Transactions';

function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'ping':   result = { ok: true, data: { version: GAS_VERSION } }; break;
      case 'budget': result = { ok: true, data: budgetSummary_(body.month) }; break;
      default:       result = { ok: false, error: 'unknown action: ' + body.action };
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ version: GAS_VERSION, actions: ['ping', 'budget'] }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 権限承認用。エディタから手動で 1 回実行する
function checkBudget() { Logger.log(JSON.stringify(budgetSummary_())); }

function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

/** month は 'yyyy-MM'。省略時は今月 */
function budgetSummary_(month) {
  var id = String(PropertiesService.getScriptProperties().getProperty('BM_SPREADSHEET_ID') || '').trim();
  if (!id) throw new Error('スクリプト プロパティ BM_SPREADSHEET_ID が未設定です');
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  month = /^\d{4}-\d{2}$/.test(month || '') ? month : today.slice(0, 7);

  var sh = SpreadsheetApp.openById(id).getSheetByName(TX_SHEET_);
  if (!sh) throw new Error('「' + TX_SHEET_ + '」シートがありません');
  var out = { month: month, today: today, expense: 0, income: 0, todayExpense: 0, count: 0, categories: [] };
  if (sh.getLastRow() < 2) return out;

  var values = sh.getDataRange().getValues();
  var col = {};
  values[0].forEach(function (h, i) { col[String(h).trim()] = i; });
  ['date', 'type', 'category', 'amount'].forEach(function (h) {
    if (col[h] === undefined) throw new Error('「' + h + '」列がありません');
  });

  var byCat = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var d = dateStr_(r[col.date]);
    if (d.slice(0, 7) !== month) continue;
    var amount = Number(r[col.amount]) || 0;
    var type = String(r[col.type]).trim();
    out.count++;
    if (type === 'income') {
      out.income += amount;
    } else if (type === 'expense') {
      out.expense += amount;
      if (d === today) out.todayExpense += amount;
      var c = String(r[col.category]).trim() || '未分類';
      byCat[c] = (byCat[c] || 0) + amount;
    }
  }
  out.categories = Object.keys(byCat)
    .map(function (k) { return { name: k, amount: byCat[k] }; })
    .sort(function (a, b) { return b.amount - a.amount; })
    .slice(0, 5);
  return out;
}
