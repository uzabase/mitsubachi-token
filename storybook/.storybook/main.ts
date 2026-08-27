import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
  framework: "@storybook/html-vite",

  // コンポーネントは持たない。カタログは .mdx のドキュメントページだけで構成する。
  stories: ["../stories/**/*.mdx"],

  addons: [
    "@storybook/addon-docs",
    {
      name: "storybook-design-token",
      options: {
        // tokens/ は tools の style-dictionary が生成する注釈付き CSS。
        // 既定の glob は node_modules 以外の全 CSS を拾うので、明示的に絞る。
        designTokenGlob: "tokens/**/*.css",
      },
    },
  ],

  core: {
    disableTelemetry: true,
  },

  viteFinal: async (viteConfig) => {
    // アドオンは publicDir に design-tokens.source.json を書き出し、プレビューから
    // 相対パスで fetch する。Storybook の vite builder は publicDir を無効化することが
    // あるため、ここで必ず有効にしておく。false のままだとカタログが空になる。
    viteConfig.publicDir = viteConfig.publicDir || "public";

    // GitHub Pages はリポジトリ名のサブパス配下で配信するため、base を合わせる。
    // ローカルでは REPOSITORY_NAME が無いので既定のままにする。
    const repository = process.env.REPOSITORY_NAME;
    if (repository) {
      viteConfig.base = `/${repository}/`;
    }

    return viteConfig;
  },
};

export default config;
