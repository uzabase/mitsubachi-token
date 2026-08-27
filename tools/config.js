const FILE_HEADER = [
  "Do not edit directly",
  "Generated from the Mitsubachi design tokens (see tools/README.md)",
];

// Storybook の storybook-design-token アドオン用のカテゴリ定義。
//
// アドオンは CSS 中の `@tokens <カテゴリ名>` コメントから次の `@tokens` / `@tokens-end`
// までを 1 カテゴリとして読み、カテゴリ名がそのままカタログの見出しになる。
//
// semantic のグループ。Figma の変数名 `<グループ>/<...>` の先頭セグメントに対応する。
// 並びは Figma のコレクション上の順序に合わせてある（デザイナー側の並びを尊重する）。
//
// ここに無いグループが Figma に増えると、そのトークンは "Other" カテゴリに落ちる。
// storybook/stories/ColorSemantic.mdx の末尾に Other の表があるので、
// 気付かないうちにカタログから消えることはない。
const SEMANTIC_GROUPS = [
  "surface",
  "overlay",
  "zabuton",
  "border",
  "text",
  "object",
  "palette",
  "background",
  "focus-ring",
  "elevation",
];

/**
 * トークン名から semantic のグループを求める。
 * `semantic-focus-ring-regular` → `focus-ring`
 *
 * 長いグループ名から先に照合する。`focus-ring` が `focus` に 食われないようにするため
 * （現状 `focus` は無いが、将来増えたときに壊れないようにしておく）。
 */
const SEMANTIC_GROUPS_BY_LENGTH = [...SEMANTIC_GROUPS].sort(
  (a, b) => b.length - a.length
);

function semanticGroupOf(key) {
  if (!key.startsWith("semantic-")) return undefined;
  const rest = key.slice("semantic-".length);
  return SEMANTIC_GROUPS_BY_LENGTH.find(
    (group) => rest === group || rest.startsWith(group + "-")
  );
}

// semantic はグループごとにカテゴリを分ける。102 件を 1 つの表に出すと目的のトークンに
// たどり着けないため。primitive は色相で分けず 1 つにまとめる（原則直接使わないので
// 一覧性より検索性を優先する）。
const STORYBOOK_CATEGORIES = [
  ...SEMANTIC_GROUPS.map((group) => ({
    name: `Semantic / ${group}`,
    presenter: "Color",
    match: (prop) =>
      prop.path[0] === "color" && semanticGroupOf(tokenKey(prop)) === group,
  })),
  {
    name: "Color / Primitive",
    presenter: "Color",
    match: (prop) => prop.path[0] === "color" && tokenKey(prop).startsWith("primitive-"),
  },
  {
    name: "Font / Family",
    presenter: "FontFamily",
    match: (prop) => prop.path[0] === "font" && prop.path[1] === "family",
  },
];

// 非推奨トークンは元の tier ではなく専用カテゴリに隔離する。GitLab などが取っている
// 「消さずに別セクションで見せる」方式。判定は docs/versioning.md と check-compat.ts に
// 合わせて comment 中の Deprecated の語で行う。
const DEPRECATED_CATEGORY = "Deprecated";

// どのカテゴリにも当てはまらないトークンの逃げ場。黙って消えるのを防ぐため。
const FALLBACK_CATEGORY = "Other";

function tokenKey(prop) {
  return prop.path[1] ?? "";
}

function isDeprecated(prop) {
  return /deprecated/i.test(prop.comment ?? "");
}

/** `{color.primitive-blue-120.value}` のような参照を `--color-primitive-blue-120` に変換する。 */
function referenceTarget(originalValue) {
  if (typeof originalValue !== "string") return undefined;
  const matched = /^\{([^}]+)\}$/.exec(originalValue.trim());
  if (!matched) return undefined;
  return "--" + matched[1].replace(/\.value$/, "").split(".").join("-");
}

function categoryNameOf(prop) {
  if (isDeprecated(prop)) return DEPRECATED_CATEGORY;
  const matched = STORYBOOK_CATEGORIES.find((category) => category.match(prop));
  return matched ? matched.name : FALLBACK_CATEGORY;
}

function presenterOf(name) {
  const matched = STORYBOOK_CATEGORIES.find((category) => category.name === name);
  // Deprecated / Other は色もフォントも混ざりうるのでカテゴリ単位の presenter を付けない。
  // 代わりにトークンごとに tokenPresenterOf() で指定する。
  return matched ? matched.presenter : undefined;
}

/** そのトークン単体の presenter。tier ではなく値の種類で決まる。 */
function tokenPresenterOf(prop) {
  const matched = STORYBOOK_CATEGORIES.find((category) => category.match(prop));
  return matched ? matched.presenter : undefined;
}

/** コメントを 1 行に畳む。アドオンは宣言と同じ行にあるコメントだけを説明として拾う。 */
function inlineComment(text) {
  return text.replace(/\s+/g, " ").replace(/\*\//g, "* /").trim();
}

module.exports = {
  source: ["tokens/**/*.json"],
  fileHeader: {
    // タイムスタンプを含めない。トークンに変化がなければ生成物も変化しないようにして、
    // CI の差分検知と後方互換性チェックが意味を持つようにするため。
    mitsubachi: () => FILE_HEADER,
  },
  format: {
    "typeScript/myFormat": ({ dictionary }) => {
      return (
        "\n" +
        FILE_HEADER.map((line) => "// " + line).join("\n") +
        "\n\n" +
        "export const mitsubachiTokenTypes = [\n" +
        dictionary.allProperties
          .map(
            (prop) =>
              '"' +
              prop.path.join("_").replaceAll("-", "_").replaceAll("__", "_") +
              '",'
          )
          .join("\n") +
        "\n] as const;\n" +
        "export type MitsubachiTokenTypes = (typeof mitsubachiTokenTypes)[number];\n\n" +
        "export const tokens: {[key in MitsubachiTokenTypes]:string} = {\n" +
        dictionary.allProperties
          .map(function (prop) {
            let to_ret_prop =
              prop.path.join("_").replaceAll("-", "_").replaceAll("__", "_") +
              ': "' +
              prop.value +
              '",';
            if (prop.comment)
              to_ret_prop = to_ret_prop.concat(" // " + prop.comment);
            return to_ret_prop;
          })
          .join("\n") +
        "\n}"
      );
    },

    // storybook-design-token が読む注釈付き CSS。lib/ の CSS には Storybook 専用の
    // コメントを混ぜたくないので別ファイルとして出す。
    "css/storybookAnnotated": ({ dictionary }) => {
      const grouped = new Map();
      for (const prop of dictionary.allProperties) {
        const name = categoryNameOf(prop);
        if (!grouped.has(name)) grouped.set(name, []);
        grouped.get(name).push(prop);
      }

      // 固定カテゴリを定義順に出し、Deprecated と Other は末尾に置く。
      const order = [
        ...STORYBOOK_CATEGORIES.map((category) => category.name),
        DEPRECATED_CATEGORY,
        FALLBACK_CATEGORY,
      ];

      const blocks = [];
      for (const name of order) {
        const props = grouped.get(name);
        if (!props || props.length === 0) continue;

        const presenter = presenterOf(name);
        const header = ["  /**", "   * @tokens " + name];
        if (presenter) header.push("   * @presenter " + presenter);
        header.push("   */");

        const declarations = props
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((prop) => {
            const target = referenceTarget(prop.original.value);
            const value = target ? "var(" + target + ")" : prop.value;

            const notes = [];
            if (target) notes.push("エイリアス → " + target);
            if (prop.comment) notes.push(inlineComment(prop.comment));

            // カテゴリに presenter が無い場合だけ、トークン個別の presenter を書く。
            // アドオンは行末コメントの `@presenter X` を拾い、その部分だけを説明文から
            // 取り除く。正規表現が行末まで貪欲に取るため必ず最後に置き、区切り文字を
            // 手前に入れない（残ってしまうため）。
            let annotation = "";
            if (!presenter) {
              const tokenPresenter = tokenPresenterOf(prop);
              if (tokenPresenter) annotation = " @presenter " + tokenPresenter;
            }

            const description =
              notes.length || annotation
                ? " /* " + notes.join(" — ") + annotation + " */"
                : "";

            return "  --" + prop.name + ": " + value + ";" + description;
          });

        blocks.push(header.concat(declarations).join("\n"));
      }

      return (
        "/**\n" +
        FILE_HEADER.map((line) => " * " + line).join("\n") +
        "\n */\n\n" +
        ":root {\n" +
        blocks.join("\n\n") +
        "\n\n  /* @tokens-end */\n}\n"
      );
    },
  },
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: "../lib/",
      files: [
        {
          destination: "mitsubachi-tokens.css",
          format: "css/variables",
          options: {
            outputReferences: true,
            fileHeader: "mitsubachi",
          },
        },
      ],
    },
    cssHost: {
      transformGroup: "css",
      buildPath: "../lib/",
      files: [
        {
          destination: "mitsubachi-tokens-host.css",
          format: "css/variables",
          options: {
            selector: ":host",
            outputReferences: true,
            fileHeader: "mitsubachi",
          },
        },
      ],
    },
    scss: {
      transformGroup: "scss",
      buildPath: "../lib/",
      files: [
        {
          destination: "mitsubachi-tokens.scss",
          format: "scss/variables",
          options: {
            outputReferences: true,
            fileHeader: "mitsubachi",
          },
        },
      ],
    },
    typeScript: {
      buildPath: "../lib/",
      files: [
        {
          destination: "mitsubachi-tokens.ts",
          format: "typeScript/myFormat",
        },
      ],
    },
    // Storybook のカタログ用。lib/ には出さない（配布物ではない）。
    storybook: {
      transformGroup: "css",
      buildPath: "../storybook/tokens/",
      files: [
        {
          destination: "mitsubachi-tokens.annotated.css",
          format: "css/storybookAnnotated",
        },
      ],
    },
  },
};
