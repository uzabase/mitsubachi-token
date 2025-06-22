module.exports = {
  source: ["tokens/**/*.json"],
  format: {
    "typeScript/myFormat": ({ dictionary }) => {
      return (
        "\n// Do not edit directly\n// Generated on " +
        new Date().toUTCString() +
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
