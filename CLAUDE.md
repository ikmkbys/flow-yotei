@AGENTS.md

## 開発メモ
- TypeScriptチェック: `npx tsc --noEmit`
- gitコマンドのパス: `/c/Users/PC_User/ClaudeWork/yotei`（`C:\`形式は不可）
- `[id]` ディレクトリはgit addで `\[id\]` とエスケープ必要
- プレビューサーバーはFirebase未接続のためイベントページ（`/[id]`）は「見つかりません」になる → tscパスで代用
- 日程データ形式: `{ date: string; time: string }[]`（作成・編集・回答フォームで共通）
