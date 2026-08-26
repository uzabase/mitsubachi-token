---
name: update-tokens
description: Figma からデザイントークンを取得して lib/ を再生成し、後方互換性を確認して PR を出すまでの手順。トークンの更新・リリース、後方互換性の判定、バージョンの決定、deprecated エイリアスの追加を扱う。「トークンを更新して」「Figma から取り込んで」「バージョンを上げて公開して」と言われたときに使う。
---

# デザイントークンの更新

`lib/` は生成物。手で編集せず、必ずこの手順で再生成する。前提は [`docs/contributing.md`](../../../docs/contributing.md) にある。

## 1. ブランチを切る

`main` を `origin/main` に同期した状態から切る。互換性チェックが `origin/main` の生成物を基準にするため、ここがずれていると判定を誤る。

```bash
git fetch origin
git switch -c update/design-tokens main
```

## 2. Figma から取得して再生成

`tools/` で実行する。認証情報は `tools/.env` から読む。

```bash
cd tools
npm install
npm run build:json:local
npm run build:css
```

`tools/.env` が無い場合は、`tools/.env.example` をコピーして値を入れてもらう。**値を会話に貼らせない。** 認証情報はリポジトリにも会話ログにも残さない方針（[`docs/contributing.md`](../../../docs/contributing.md) の「Figma ファイルと認証情報」参照）。ユーザーが値を持っていない場合、こちらでは用意できないので、CI（`workflow_dispatch` の Build ワークフロー）を使うよう案内する。

`build:json` は `*` を含む Figma 変数を未確定扱いで除外し、その一覧をログに出す。**このログはユーザーに必ず伝える。** 意図せず除外されたトークンがあれば Figma 側の修正が必要になる。

## 3. 後方互換性を確認する

```bash
npm run check:compat
```

出力の「必要なバージョン上げ」に従う。目視で差分を判断しない。

- **削除が 0 件** → そのまま 4 へ。
- **削除がある** → 破壊的変更。次の判断をユーザーに確認する。
  - リネームなら（レポートに「リネームの可能性があります」と出る）、`tools/tokens/deprecated/base.json` に旧名のエイリアスを追加して互換を保つ。追加後に再生成し、削除が 0 件になったことを確認する。書き方は [`docs/versioning.md`](../../../docs/versioning.md) の「削除・リネームの手順」に従う。
  - 本当に廃止するなら major リリースにする。既存の利用者を壊すので、ユーザーの明示的な合意を取る。

値の変更もユーザーに見せる。色が変わることは意図的なデザイン変更のこともあれば、Figma の作業途中を拾ってしまっただけのこともある。

## 4. コミットして PR を出す

生成物とトークン JSON をまとめてコミットする。

```bash
cd ..
git add -A lib tools/tokens
git commit -m "デザイントークンファイルを更新"
```

PR 本文には `check:compat` の出力をそのまま貼る（そのための markdown 形式になっている）。レビュワーはこれを見て、トークンの変更内容と必要なバージョン上げを判断する。破壊的変更を含む場合は `breaking-change` ラベルを付ける。

**この時点ではバージョンを上げない。** レビュワーが変更内容を確認する前に `package.json` を書き換えると、判断の前提が固定されてしまう。

push と PR 作成はユーザーに確認してから行う。

## 5. レビュー後にバージョンを上げる

レビュワーがトークンの変更内容に合意してから、バージョン上げを別コミットとして積む。

`check:compat` が提示したバージョンを `package.json` に反映する。`pubspec.yaml` は別系統のバージョンなので、指示がない限り触らない。

公開済みが `0.x` のあいだは semver の保証が効かない。`1.0.0` への引き上げをまだ済ませていなければ、このタイミングで提案する。

## 手作業なしで回す場合

Actions の Build ワークフロー（`workflow_dispatch`）が 2〜3 と PR 作成までを自動で行う。Figma の認証情報を持っていないときはこちらを案内する。バージョン上げは自動化されていないので、作られた PR に対して 5 を人が行う。
