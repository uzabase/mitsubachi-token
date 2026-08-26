# バージョニングと後方互換性

セマンティックバージョニングを厳守する。判定基準は「トークンの利用者にとって何が壊れるか」。

| 変更 | バージョン |
| --- | --- |
| トークンの削除・リネーム | major |
| トークンの追加 | minor |
| トークンの値の変更 | patch |

**判定は目視の差分ではなく `npm run check:compat` の出力に従う。** 194 トークンあるため `git diff` を追うのは現実的でない。

## 現在のバージョン方針

公開済みは `0.0.2` のみ。`0.x` のあいだは semver の互換性保証が効かないため、**次のリリースで `1.0.0` に上げてから**この運用に入る。

## check:compat

`tools/` で実行する。`origin/main` の `lib/mitsubachi-tokens.ts` と作業ツリーを比較し、トークン名 → 値の対応を集合比較する。

```bash
npm run check:compat                      # origin/main と比較（既定）
npm run check:compat -- --baseline HEAD    # 比較の基準を変える
npm run check:compat -- --strict           # 破壊的変更があれば exit 1
npm run check:compat -- --github-output    # CI 専用。suggested_bump / has_breaking を出力
```

### 実行のタイミング

**必ず `npm run build:css` の直後、コミットする前。** 作業ツリーの生成物を読むため、再生成していないと古い状態を見る。事前に `git fetch origin` もしておく。

1. Figma からトークンを取り込んだ直後 — 意図せずトークンが消えていないかの確認（主用途）
2. `tokens/deprecated/base.json` にエイリアスを足した後 — 「削除」が 0 件に落ちたかの確認
3. リリース前 — 上げるべきバージョンの決定

### 出力の読み方

| 出力 | 意味と対応 |
| --- | --- |
| **削除** | 利用者の `var(--...)` が壊れる。エイリアスを足すか、合意の上で major |
| 削除に「リネームの可能性があります」 | 同じ値の新トークンが見つかった。ほぼリネームなので、その新トークンへのエイリアスを書く |
| **値変更** | 色が変わる。意図的なデザイン変更か、Figma の作業途中を拾ったかを人が確認する |
| **追加** | 安全。minor |
| **現在 deprecated なトークン** | 過去に付けたエイリアスの一覧。次の major で消す対象 |

出力はそのまま PR 本文に貼れる markdown。

`check:compat` は値の変更を検知するが、**それが妥当かは判断できない**。事故もデザイン変更も同じ「値変更」として出るので、ここは人が見る。

## 削除・リネームの手順（廃止期間を置く）

Figma でトークンが消えた／名前が変わっても、`lib/` から即座に消してはいけない。利用者のスタイルがその場で壊れる。

1. `tools/tokens/deprecated/base.json` に**旧名**のエイリアスを追加する。値は新しいトークンへの参照にする
2. `comment` に廃止バージョンと移行先を書く
3. 再生成して `npm run check:compat` を実行し、「削除」が 0 件になったことを確認する。この時点で変更は major ではなくなる
4. **次の major リリース**でエイリアスを削除する。そのリリースが major 扱いになる

### エイリアスの書き方

```json
{
  "color": {
    "semantic-text-weak": {
      "value": "{color.semantic-text-subtle.value}",
      "comment": "Deprecated in 1.1.0, removed in 2.0.0. Use color-semantic-text-subtle."
    }
  }
}
```

`tools/config.js` の `source` が `tokens/**/*.json` なので、設定を追加しなくても style-dictionary が拾って `color` キーを深くマージする。

生成される出力。

```css
--color-semantic-text-weak: var(--color-semantic-text-subtle); /* Deprecated in 1.1.0, ... */
```
```scss
$color-semantic-text-weak: $color-semantic-text-subtle; // Deprecated in 1.1.0, ...
```

守るべき点が2つ。

- **値を直接書かず `{color.<トークン名>.value}` の参照にする。** `outputReferences: true` が効いているので css / scss では参照として出力され、新トークンの色が変わっても旧名が自動で追従する。値の二重管理を避けられる
- **`comment` に `Deprecated` の語を含める。** css / scss / ts すべての生成物にコメントとして伝播し、利用者が移行先を知れる。また `check:compat` がこの語を見て「現在 deprecated なトークン」として一覧に出す

### 注意

エイリアス先の値が旧トークンと違う場合、名前は保てても**見た目は変わる**。`check:compat` はそれを「値変更」として報告するので、そこは人が判断する。

エントリが無いときは `base.json` は `{}` のままにする。空でもビルドは通る。
