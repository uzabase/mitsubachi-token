import type { Preview } from "@storybook/html-vite";

const preview: Preview = {
  parameters: {
    // アドオンは対象 CSS の全宣言を :root として自前で注入するため、
    // lib/ の CSS を読み込まなくても var() 参照が解決する。
    designToken: {
      showSearch: true,
    },
    options: {
      storySort: {
        order: ["はじめに", "Color", "Font", "Deprecated"],
      },
    },
  },
};

export default preview;
