# storybook

デザイントークンのカタログ。**配布物ではない**（npm パッケージには含まれない）。

**公開先: https://uzabase.github.io/mitsubachi-token/**

`main` の `storybook/` 配下に変更が入ると `.github/workflows/storybook-release.yaml` が
GitHub Pages にデプロイする。カタログが読むのはコミット済みの `storybook/tokens/` なので、
デプロイに Figma の認証情報は要らない。

Pages はリポジトリ名のサブパス配下で配信されるため、CI では `REPOSITORY_NAME` を渡して
vite の `base` を合わせている。ローカルでは未設定なので相対パスのまま。

色見本を手で書くのではなく、`tools/` の style-dictionary が生成した注釈付き CSS を
[storybook-design-token](https://github.com/UX-and-I/storybook-design-token) が読んで表示する。
Figma とカタログがズレることはない。

## 起動

```bash
cd storybook
npm install
npm run dev     # http://localhost:6006
npm run build   # storybook-static/ に静的出力
```

Node 20.19+ が必要（Storybook 10 の要件）。`.node-version` で 20.19.6 を指定してある。

## 仕組み

```
Figma
  └─ tools/figma.ts            → tools/tokens/**/*.json
       └─ tools/config.js      → storybook/tokens/mitsubachi-tokens.annotated.css
            └─ アドオンが解析  → カタログ
```

`storybook/tokens/` は **`cd tools && npm run build:css` が生成する。手で編集しない。**
`lib/` 向けの CSS とは別ファイルにしてある。配布する CSS に Storybook 専用のコメントを
混ぜないため。

### public/ を毎回消している理由

アドオンは解析結果を `public/design-tokens.source.json` に書き出し、プレビューから
fetch する。この書き出しは Vite の transform 時（＝プレビューが読み込まれたとき）に
起きるため、**前回のファイルが残っていると古いカタログがそのまま表示される。**
実際にトークンを消した後も消したはずのトークンが表示され続けた。

そのため `dev` / `build` は `clean` で `public/` を消してから起動する。副作用として、
起動直後のごく短い間はカタログが空に見えることがある。**表が空のままなら再読み込みする。**
古い値を正しいものとして見せるより、一瞬空になるほうが安全という判断。

## カテゴリの追加・変更

アドオンは CSS 中の `@tokens <カテゴリ名>` コメントから次の `@tokens` / `@tokens-end`
までを 1 カテゴリとして読む。カテゴリ名がそのままカタログの単位になる。

定義は `tools/config.js` の `STORYBOOK_CATEGORIES` にある。

- **semantic はグループごとに分ける** — `Semantic / surface`、`Semantic / text` など。
  グループの一覧と並び順は同ファイルの `SEMANTIC_GROUPS`。102 件を 1 つの表に出すと
  目的のトークンにたどり着けないため
- **primitive は 1 つにまとめる** — 原則直接使わないので、一覧性より検索性を優先する
- `Font / Family`、`Deprecated` はそれぞれ 1 つ

グループを増やす場合は `tools/config.js` の `SEMANTIC_GROUPS` と
`stories/ColorSemantic.mdx` の**両方**を直す。**`.mdx` の `categoryName` は `@tokens` の
名前と完全一致していないと、エラーにならず表が黙って空になる。**

どのカテゴリにも当てはまらないトークンは `Other` に入る。`ColorSemantic.mdx` の末尾に
`Other` の表を置いてあるので、気付かないうちにカタログから消えることはない。
**`Other` に何か出たら `SEMANTIC_GROUPS` に無いグループが Figma に増えたということ。**

## 非推奨トークン

`comment` に `Deprecated` を含むトークンは、元の tier ではなく `Deprecated` カテゴリに
隔離される。判定は `docs/versioning.md` と `tools/check-compat.ts` と同じ規則。
運用は `docs/versioning.md` の「削除・リネームの手順」を正とする。
