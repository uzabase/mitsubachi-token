# tools

Figma からデザイントークンを取得し、`lib/` 配下の各フォーマットを生成するスクリプト群。

セットアップ・開発コマンド・環境変数は [`docs/contributing.md`](../docs/contributing.md) を参照。
後方互換性チェック（`npm run check:compat`）の使い方は [`docs/versioning.md`](../docs/versioning.md) を参照。

| ファイル | 役割 |
| --- | --- |
| `figma.ts` | Figma Variables API からトークンを取得して `tokens/color/base.json` を書き出す |
| `config.js` | style-dictionary の設定。出力フォーマットとファイルヘッダを定義 |
| `check-compat.ts` | 生成物を `origin/main` と比較し、後方互換性と必要なバージョン上げを判定する |
| `tokens/` | style-dictionary の入力 JSON |
