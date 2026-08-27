# 開発ガイド

## このリポジトリの役割

Uzabase のデザインシステム「Mitsubachi」のデザイントークンを Figma から取得し、css / scss / TypeScript に変換して npm パッケージ `@uzabase/mitsubachi-token` として配布する。

## 生成フロー

```
Figma (primitive / semantic の2ファイル)
  ↓  tools/figma.ts        （Figma Variables API から取得）
tools/tokens/color/base.json          ← 自動生成・.gitignore 済み
tools/tokens/font/base.json           ← 手動管理
tools/tokens/deprecated/base.json     ← 手動管理（後方互換用エイリアス）
  ↓  style-dictionary (tools/config.js)
lib/mitsubachi-tokens.css       (:root)
lib/mitsubachi-tokens-host.css  (:host — Shadow DOM 用)
lib/mitsubachi-tokens.scss
lib/mitsubachi-tokens.ts        (トークン名の union 型 + 値のマップ)
```

## ディレクトリ構造

| パス | 内容 |
| --- | --- |
| `lib/` | **生成物。**手で編集しない |
| `tools/figma.ts` | Figma Variables API からトークンを取得して JSON を書き出す |
| `tools/config.js` | style-dictionary の設定。出力フォーマットとファイルヘッダを定義 |
| `tools/check-compat.ts` | 後方互換性チェック。詳細は [versioning.md](./versioning.md) |
| `tools/tokens/` | style-dictionary の入力 JSON |
| `docs/` | 開発者向けドキュメント |
| `storybook/` | トークンのカタログ。**配布物ではない。**[storybook/README.md](../storybook/README.md) 参照 |

## 絶対に守ること

- **`lib/` 配下は生成物。手で編集しない。** 直したい場合は Figma か `tools/` 側を直して再生成する。
- **色トークンの真実は Figma。** `tools/tokens/color/base.json` を直接編集しても次の生成で消える。唯一の例外は `tools/tokens/deprecated/base.json`（[versioning.md](./versioning.md) 参照）。
- **生成物は決定的でなければならない。** タイムスタンプなど毎回変わる情報を出力に含めない。含めると CI の差分検知と後方互換性チェックが機能しなくなる。

## セットアップ

初回のみ。

### 1. 依存をインストール

```bash
cd tools
npm install
```

### 2. Figma ファイルを自分のアカウントに複製

primitive / semantic の2ファイルを Duplicate to your draft する。ファイルの場所はチームメンバーに確認する（下記「Figma ファイルと認証情報」参照）。

### 3. 認証情報を用意

`tools/figma.ts` は Figma のトークンとファイルキーをコードに持たず、環境変数として外から受け取る。ローカルではそれを `tools/.env` に書いておく。

```bash
cd tools
cp .env.example .env
# エディタで開いて3つの値を入れる
```

`.env` は `.gitignore` 済みでコミットされない。**値をコミットしたり、Slack や Issue に貼ったりしない。** 取得先は下記「Figma ファイルと認証情報」を参照。

### 4. 動作確認

```bash
npm run build:json:local
npm run build:css
npm run check:compat
```

トークンに変化がなければ `削除 0 / 追加 0 / 値変更 0` と出る。ここまで通れば環境は正しい。

## Figma ファイルと認証情報

トークンの定義元は Figma の2ファイル（primitive / semantic）。`tools/figma.ts` が各ファイルから読むコレクションは次の通り。

| 環境変数 | 読み取るコレクション |
| --- | --- |
| `PRIMITIVE_FIGMA_DESIGN_FILE_KEY` | `ui-primitive-color` |
| `SEMANTIC_FIGMA_DESIGN_FILE_KEY` | `ui-semantic-color` |
| `FIGMA_TOKEN` | （認証用。ファイルではない） |

**ファイルキーと token はこのリポジトリに記載しない。** public リポジトリなので、`docs/` も含めて全ファイルが公開される。安全側に倒す方針。

値の入手先。

- **CI** — リポジトリの GitHub Secrets に3つとも登録済み。ワークフローはそこから読む
- **ローカル** — チームメンバーに確認して `tools/.env` に書く。雛形は `tools/.env.example`
- **`FIGMA_TOKEN`** — 各自の Personal access token（Figma の Settings > Personal access tokens）。共有しない
- ファイルキーは Figma ファイルの URL `https://www.figma.com/file/<この部分>/` の文字列

## 開発コマンド

すべて `tools/` で実行する。

```bash
# Figma から色トークンの JSON を生成（tools/.env から認証情報を読む）
npm run build:json:local

# 環境変数を直接渡す場合（CI はこちらを使う）
FIGMA_TOKEN=*** PRIMITIVE_FIGMA_DESIGN_FILE_KEY=*** SEMANTIC_FIGMA_DESIGN_FILE_KEY=*** npm run build:json

# JSON から lib/ の各フォーマットと storybook/tokens/ のカタログ用 CSS を生成
npm run build:css

# 後方互換性チェック（versioning.md 参照）
npm run check:compat

# tools/ 配下のフォーマット
npm run format
```

ルートの `npm run build` は `tsc` で `lib/mitsubachi-tokens.js` を出す npm 公開用のビルドで、トークン生成とは別物。

### カタログ（Storybook）

`storybook/` で実行する。トークンの一覧を色見本つきで確認できる。

```bash
cd storybook
npm install
npm run dev     # http://localhost:6006
```

表示するデータは `npm run build:css` が生成した `storybook/tokens/` を読んでいるので、
**トークンを更新したら先に `build:css` を実行する。** 詳細は [storybook/README.md](../storybook/README.md)。

Storybook 10 は Node 20.19+ を要求する。`storybook/.node-version` で指定してあるので、
nodenv などを使っていれば自動で切り替わる。

## トークンの命名

`tools/figma.ts` が Figma の変数名から生成する。

- **primitive** — Figma の `<collection>/<...>` の先頭階層を落として `primitive-` を付ける → `color-primitive-blue-120`
- **semantic** — 階層を `-` で連結して `semantic-` を付ける → `color-semantic-text-regular`
- **semantic は primitive への参照として出力される。** Figma 上で semantic 変数は primitive 変数へのエイリアスになっているので、その構造を保って `{color.primitive-white.value}` の形で書き出す。css / scss では `var(--color-primitive-white)` / `$color-primitive-white` になる（`outputReferences: true`）。参照先が出力対象に無い場合と、Figma 側でエイリアスでない場合は解決済みの値を書き出す。件数は `build:json` のログに出る
- 名前に `*` を含む Figma 変数は未確定扱いで**除外される**。除外された一覧は `build:json` の実行時にログに出るので必ず確認する
- TypeScript 出力ではハイフンがアンダースコアになる → `color_semantic_text_regular`

## CI

`.github/workflows/build.yml`（`workflow_dispatch` で手動実行）が、Figma からの取得 → 生成 → 後方互換性チェック → **PR 作成**まで行う。main への直接 push はしない。

- 生成物に変化がなければ何もしない
- 破壊的変更を含む場合は PR に `breaking-change` ラベルが付く
- PR 本文には `check:compat` の互換性レポートが入る。レビュワーはこれを見てバージョン上げを判断する

前提となる設定が2つある。

- リポジトリ設定の「Allow GitHub Actions to create and approve pull requests」が有効であること
- GITHUB_TOKEN で作った PR は**他のワークフローを起動しない**（GitHub の仕様）。今後 `on: pull_request` の CI を足す場合は PAT か GitHub App のトークンに切り替える必要がある

### FIGMA_TOKEN の運用

CI が使う `FIGMA_TOKEN` は**チームメンバー個人の Personal access token**。Figma に CI 専用アカウントは作らない方針。

- Figma のトークンには有効期限があり、切れると `Build JSON from Figma` が 403 で失敗する
- Secrets は保存後に値を読み出せないため、**期限切れかどうかは実行して確かめるしかない**
- **Secrets には「誰が登録したか」が残らない。** 更新したら下の履歴に追記する
- 更新方法 — Settings → Secrets and variables → Actions → `FIGMA_TOKEN` → Update
  （または `gh secret set FIGMA_TOKEN --repo uzabase/mitsubachi-token`）
- ファイルキーの2つは有効期限がないので更新不要

| 更新日 | 更新者 | 備考 |
| --- | --- | --- |
| 2025-07-09 | 記録なし（状況から neoki07 と推測） | |
| 2026-08-26 | hazuki-okuda | 前のトークンが期限切れだったため差し替え |

## 既知の未整理事項

- **npm パッケージの JS エントリが機能していない。** `package.json` の `main: "lib"` は `lib/index.js` を指すが存在しない。`lib/mitsubachi-tokens.js` を直接 import しても、ESM として出力されているのに `"type": "module"` が無いため Node からは CJS 扱いされて失敗する。`.d.ts` も出していないため型も提供できていない。css / scss 経由の利用は正常に動作する。
  **パッケージとして install して使う経路を確認する手段が現在ない。** かつて `example/` がその役割を持っていたが、前身の sp-design-token から引き継いだまま移行が途中で止まり動かなくなっていたため削除した（`git log -- example/` で辿れる）。`storybook/` はリポジトリ内の生成物を直接読むので、この経路は検証できない。
- `pubspec.yaml` が `name: sp_design_token` / `version: 6.0.1` で `package.json` と不整合。旧リポジトリの残骸と思われる。
