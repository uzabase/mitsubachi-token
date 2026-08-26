const FILE_HEADER = [
  "Do not edit directly",
  "Generated from the Mitsubachi design tokens (see tools/README.md)",
];

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
  },
};
