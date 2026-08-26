# @uzabase/mitsubachi-token

Mitsubachi デザインシステムのデザイントークン。Figma で管理されているトークンを CSS カスタムプロパティ / SCSS 変数 / TypeScript として配布します。

## インストール

```bash
npm install @uzabase/mitsubachi-token
```

## 使い方

### CSS カスタムプロパティ

アプリのエントリポイントで一度読み込むと、`:root` に全トークンが定義されます。

```js
import "@uzabase/mitsubachi-token/lib/mitsubachi-tokens.css";
```

```css
.button {
  color: var(--color-semantic-text-static-white);
  background-color: var(--color-semantic-surface-checked-default);
  border: 1px solid var(--color-semantic-border-regular);
}
```

Shadow DOM の中で使う場合は、`:host` に定義される版を読み込みます。

```js
import "@uzabase/mitsubachi-token/lib/mitsubachi-tokens-host.css";
```

### SCSS 変数

```scss
@use "@uzabase/mitsubachi-token/lib/mitsubachi-tokens" as tokens;

.button {
  color: tokens.$color-semantic-text-static-white;
}
```

## トークンの種類

全 194 件。

| プレフィックス | 件数 | 内容 |
| --- | --- | --- |
| `--color-primitive-*` | 90 | 色そのもの（`--color-primitive-blue-120` など）。原則として直接使わず semantic を使う |
| `--color-semantic-*` | 102 | 用途に紐づいた色（`--color-semantic-text-regular` など）。通常はこちらを使う |
| `--font-family-*` | 2 | 日本語 (`ja`) と中国語 (`zh`) の font-family |

利用可能なトークンの一覧は `lib/mitsubachi-tokens.css` を直接参照してください。

廃止されたトークンには、生成ファイル内に移行先を書いたコメントが付きます。次の形式なので、見つけたら差し替えてください。

```css
--color-semantic-<旧トークン名>: var(--color-semantic-<新トークン名>); /* Deprecated in 1.1.0, removed in 2.0.0. Use color-semantic-<新トークン名>. */
```

## 制限事項

**JavaScript / TypeScript からの import は現在利用できません。** `lib/mitsubachi-tokens.ts` にトークン名の union 型と値のマップが含まれていますが、パッケージのエントリポイント設定が未整備で、Node から解決できません。css / scss 経由での利用は正常に動作します。

## バージョニング

セマンティックバージョニングに従います。

| 変更 | バージョン |
| --- | --- |
| トークンの削除・リネーム | major |
| トークンの追加 | minor |
| トークンの値の変更 | patch |

トークンを削除・リネームする場合、旧名は次の major リリースまでエイリアスとして残します。`0.x` のあいだは互換性の保証がありません。

## 開発

このリポジトリで作業する場合は `docs/` を参照してください。

- [docs/contributing.md](./docs/contributing.md) — 生成フロー・セットアップ・開発コマンド
- [docs/versioning.md](./docs/versioning.md) — バージョニングと後方互換性の運用

## License

MIT
