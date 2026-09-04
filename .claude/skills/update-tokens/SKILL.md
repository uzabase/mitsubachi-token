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

`build:css` は `lib/` の css / scss / ts に加えて、カタログ用の `storybook/tokens/` も生成する。**どちらも生成物なので手で編集しない。**

`build:json` のログには2つ出る。**どちらもユーザーに必ず伝える。**

- **`*` を含むため除外された Figma 変数の一覧。** 意図せず除外されたトークンがあれば Figma 側の修正が必要になる
- **semantic のうち primitive への参照にできた件数と、生値になった件数。** semantic は Figma 上で primitive のエイリアスとして定義されているので、原則ほぼ全件が参照になる。生値の件数が急に増えたときは、Figma 側でエイリアスが外れたか、参照先が `*` で除外された可能性がある

```
semantic 102件: primitive への参照 100件 / 生値 2件
生値で出力した semantic: [ 'semantic-elevation-regular-inverse', ... ]
```

## 3. 後方互換性を確認する

```bash
npm run check:compat
```

出力の「必要なバージョン上げ」に従う。目視で差分を判断しない。

レポートは4種類に分類される。**「削除が 0 件だから進んでよい」と判断しない。** 削除以外にも人の確認が要るものがある。

| 分類 | 意味 | 対応 |
| --- | --- | --- |
| **削除** | 利用者の `var(--...)` が壊れる | 下記の分岐。破壊的変更 |
| **値変更** | 色が変わる | **ユーザーに見せて確認する** |
| **表現の変更** | 色は同じで CSS の書き方だけ変わる | **ユーザーに見せて確認する** |
| **追加** | 安全 | そのまま 4 へ |

### 削除がある場合

破壊的変更。次の判断をユーザーに確認する。

- リネームなら（レポートに「リネームの可能性があります」と出る）、`tools/tokens/deprecated/base.json` に旧名のエイリアスを追加して互換を保つ。追加後に再生成し、削除が 0 件になったことを確認する。書き方は [`docs/versioning.md`](../../../docs/versioning.md) の「削除・リネームの手順」に従う。
- 本当に廃止するなら major リリースにする。既存の利用者を壊すので、ユーザーの明示的な合意を取る。

### 値変更がある場合

色が変わることは意図的なデザイン変更のこともあれば、Figma の作業途中を拾ってしまっただけのこともある。`check:compat` はどちらか判断できないので、**一覧をユーザーに見せる。**

### 表現の変更がある場合

`#ffffff` → `var(--color-primitive-white)` のように、解決後の色は同じで書き方だけが変わったもの。ファイル全体を import している利用者の見た目は変わらないが、**配布する CSS の中身は変わる。**

通常のトークン更新でここに件数が出ることはない。出たら `tools/` 側の出力の作りが変わったということなので、**意図した変更か必ずユーザーに確認する。** 影響が出るのは次の2ケース。

- 特定の custom property だけを抜き出して使っている利用者
- 参照先の primitive を上書きしている利用者

判断基準は [`docs/versioning.md`](../../../docs/versioning.md) の「出力の読み方」を正とする。

### 目で見て確かめたいとき

`check:compat` はテキストの差分しか出さない。色そのものを見たいときはカタログを使う。

```bash
cd storybook
npm install
npm run dev     # http://localhost:6006
```

値変更が意図どおりか（似た色に置き換わっただけか、まったく違う色になっていないか）を確認するのに向く。Node 20.19+ が必要。詳細は [`storybook/README.md`](../../../storybook/README.md)。

## 4. コミットして PR を出す

生成物とトークン JSON をまとめてコミットする。**カタログ用の `storybook/tokens/` も生成物なので一緒に入れる。** 入れ忘れるとカタログだけ古いトークンを表示し続ける。

```bash
cd ..
git add -A lib tools/tokens storybook/tokens
git commit -m "デザイントークンファイルを更新"
```

`tools/tokens/color/` は `.gitignore` されているのでコミットされない（色の真実は Figma 側にある）。実際に入るのは `lib/`、`storybook/tokens/`、`tools/tokens/font/`、`tools/tokens/deprecated/`。

PR 本文には `check:compat` の出力をそのまま貼る（そのための markdown 形式になっている）。レビュワーはこれを見て、トークンの変更内容と必要なバージョン上げを判断する。破壊的変更を含む場合は `breaking-change` ラベルを付ける。

**この時点ではバージョンを上げない。** レビュワーが変更内容を確認する前に `package.json` を書き換えると、判断の前提が固定されてしまう。

push と PR 作成はユーザーに確認してから行う。

## 5. レビュー後にバージョンを上げる

レビュワーがトークンの変更内容に合意してから、バージョン上げを別コミットとして積む。

`check:compat` が提示したバージョンを `package.json` に反映する。`pubspec.yaml` は別系統のバージョンなので、指示がない限り触らない。

公開済みが `0.x` のあいだは semver の保証が効かない。`1.0.0` への引き上げをまだ済ませていなければ、このタイミングで提案する。

## 手作業なしで回す場合

Actions の Build ワークフロー（`workflow_dispatch`）が 2〜3 と PR 作成までを自動で行う。Figma の認証情報を持っていないときはこちらを案内する。バージョン上げは自動化されていないので、作られた PR に対して 5 を人が行う。
