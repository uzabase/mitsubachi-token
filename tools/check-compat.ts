/**
 * デザイントークンの後方互換性チェック。
 *
 * 基準(git ref)と現在の作業ツリーを比較し、トークンの削除・追加・値変更・表現の変更を
 * 分類して、必要なバージョン上げを提示する。
 *
 * 2 つのファイルを見る。
 *
 * - lib/mitsubachi-tokens.ts  … 解決済みの値。トークンの削除・追加・値変更を判定する
 * - lib/mitsubachi-tokens.css … 実際に配布される宣言。表現の変更を判定する
 *
 * TS 出力は参照を解決した値しか持たないため、`#ffffff` が
 * `var(--color-primitive-white)` に変わっても TS では差分が出ない。CSS も見ないと
 * 配布物が 100 行変わっても「変化なし」と報告してしまう。
 *
 *   npm run check:compat                      # origin/main と比較
 *   npm run check:compat -- --baseline HEAD   # 比較対象を変える
 *   npm run check:compat -- --strict          # 破壊的変更があれば exit 1
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const TOKENS_FILE = "lib/mitsubachi-tokens.ts";
const CSS_FILE = "lib/mitsubachi-tokens.css";
const REPO_ROOT = path.resolve(__dirname, "..");

interface Token {
  value: string;
  comment?: string;
}

type TokenMap = Map<string, Token>;

interface Options {
  baseline: string;
  strict: boolean;
  githubOutput: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    baseline: "origin/main",
    strict: false,
    githubOutput: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--baseline") {
      const value = argv[++i];
      if (!value) throw new Error("--baseline には git ref を指定してください");
      options.baseline = value;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--github-output") {
      options.githubOutput = true;
    } else {
      throw new Error(`不明なオプション: ${arg}`);
    }
  }

  return options;
}

/** 生成された TypeScript から `tokens` の定義を読み取る。 */
function parseTokens(source: string, label: string): TokenMap {
  const declaration = source.indexOf("export const tokens");
  if (declaration === -1) {
    throw new Error(`${label}: tokens の定義が見つかりません`);
  }

  const tokens: TokenMap = new Map();
  const body = source.slice(source.indexOf("{", declaration) + 1);

  for (const line of body.split("\n")) {
    const matched = /^\s*([A-Za-z0-9_]+):\s*"(.*)",\s*(?:\/\/\s*(.*))?$/.exec(
      line
    );
    if (!matched) continue;
    const [, name, value, comment] = matched;
    tokens.set(name, comment ? { value, comment } : { value });
  }

  if (tokens.size === 0) {
    throw new Error(`${label}: トークンを1件も読み取れませんでした`);
  }

  return tokens;
}

/** CSS の custom property 宣言を読み取る。値は書かれたままの文字列で持つ。 */
function parseCssDeclarations(source: string, label: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const line of source.split("\n")) {
    const matched = /^\s*(--[A-Za-z0-9_-]+):\s*(.+);\s*$/.exec(line);
    if (!matched) continue;
    const [, name, value] = matched;
    declarations.set(name, value.trim());
  }

  if (declarations.size === 0) {
    throw new Error(`${label}: CSS の宣言を1件も読み取れませんでした`);
  }

  return declarations;
}

function readFileAtRef(ref: string, file: string): string {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      `基準 ${ref}:${file} を読めませんでした。` +
        `git fetch origin を実行するか --baseline で別の ref を指定してください。`
    );
  }
}

function readFileInWorkTree(file: string): string {
  const absolute = path.join(REPO_ROOT, file);
  if (!fs.existsSync(absolute)) {
    throw new Error(
      `${file} がありません。先に npm run build:css を実行してください。`
    );
  }
  return fs.readFileSync(absolute, "utf8");
}

function readBaseline(ref: string): TokenMap {
  return parseTokens(readFileAtRef(ref, TOKENS_FILE), ref);
}

function readCurrent(): TokenMap {
  return parseTokens(readFileInWorkTree(TOKENS_FILE), "作業ツリー");
}

function readBaselineCss(ref: string): Map<string, string> {
  return parseCssDeclarations(readFileAtRef(ref, CSS_FILE), ref);
}

function readCurrentCss(): Map<string, string> {
  return parseCssDeclarations(readFileInWorkTree(CSS_FILE), "作業ツリー");
}

/**
 * CSS の custom property 名を TS 出力のトークン名に合わせる。
 * `--color-semantic-text-regular` → `color_semantic_text_regular`
 * 変換規則は tools/config.js の typeScript/myFormat と揃える。
 */
function cssVarToTokenName(cssVar: string): string {
  // tools/tsconfig.json が target: es5 のため replaceAll は使わない。
  return cssVar
    .replace(/^--/, "")
    .split("-")
    .join("_")
    .split("__")
    .join("_");
}

function isDeprecated(token: Token) {
  return /deprecated/i.test(token.comment ?? "");
}

interface Diff {
  removed: { name: string; token: Token; renamedTo?: string }[];
  added: string[];
  changed: { name: string; before: string; after: string }[];
  deprecated: { name: string; comment: string }[];
  /**
   * 解決後の色は同じまま、CSS の書き方だけが変わったもの。
   * 例: `#ffffff` → `var(--color-primitive-white)`
   *
   * 計算結果は変わらないので利用者の見た目は変わらないが、配布する CSS の中身は
   * 変わる。TS 出力では差分が出ないため、ここで別枠にして必ずレビュワーに見せる。
   */
  representation: { name: string; before: string; after: string }[];
}

function diffTokens(
  baseline: TokenMap,
  current: TokenMap,
  cssBaseline: Map<string, string>,
  cssCurrent: Map<string, string>
): Diff {
  const removedNames = [...baseline.keys()].filter(
    (name) => !current.has(name)
  );
  const added = [...current.keys()].filter((name) => !baseline.has(name));

  const changed = [...baseline.entries()]
    .filter(([name, token]) => {
      const now = current.get(name);
      return now !== undefined && now.value !== token.value;
    })
    .map(([name, token]) => ({
      name,
      before: token.value,
      after: current.get(name)!.value,
    }));

  // 同じ値で追加されたトークンがあればリネームの可能性が高い。エイリアスを書く際の手掛かりにする。
  const removed = removedNames.map((name) => {
    const token = baseline.get(name)!;
    const renamedTo = added.find((candidate) => {
      const now = current.get(candidate)!;
      return now.value === token.value && !baseline.has(candidate);
    });
    return renamedTo ? { name, token, renamedTo } : { name, token };
  });

  const deprecated = [...current.entries()]
    .filter(([, token]) => isDeprecated(token))
    .map(([name, token]) => ({ name, comment: token.comment! }));

  // 解決後の値が動いたものは「値変更」として既に報告するので、表現の変更からは除く。
  // 削除・追加されたものも対象外（そもそも比較する相手がいない）。
  const alreadyReported = new Set<string>([
    ...changed.map(({ name }) => name),
    ...removed.map(({ name }) => name),
    ...added,
  ]);

  const representation = [...cssBaseline.entries()]
    .filter(([cssVar, before]) => {
      const after = cssCurrent.get(cssVar);
      if (after === undefined || after === before) return false;
      return !alreadyReported.has(cssVarToTokenName(cssVar));
    })
    .map(([cssVar, before]) => ({
      name: cssVar,
      before,
      after: cssCurrent.get(cssVar)!,
    }));

  return { removed, added, changed, deprecated, representation };
}

type Bump = "major" | "minor" | "patch" | "none";

function suggestBump(diff: Diff): Bump {
  if (diff.removed.length > 0) return "major";
  if (diff.added.length > 0) return "minor";
  if (diff.changed.length > 0) return "patch";
  // 表現の変更は計算結果を変えないが、配布する CSS は変わるので patch 扱いにする。
  if (diff.representation.length > 0) return "patch";
  return "none";
}

function nextVersion(currentVersion: string, bump: Bump): string | undefined {
  if (bump === "none") return undefined;
  const parsed = /^(\d+)\.(\d+)\.(\d+)/.exec(currentVersion);
  if (!parsed) return undefined;
  const [major, minor, patch] = parsed.slice(1).map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function currentVersion(): string {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
  );
  return pkg.version;
}

function report(diff: Diff, options: Options): string {
  const bump = suggestBump(diff);
  const version = currentVersion();
  const next = nextVersion(version, bump);
  const lines: string[] = [];

  lines.push(`## デザイントークンの互換性チェック`);
  lines.push("");
  lines.push(`- 基準: \`${options.baseline}\``);
  lines.push(
    `- 削除 ${diff.removed.length} / 追加 ${diff.added.length} / 値変更 ${diff.changed.length}` +
      ` / 表現の変更 ${diff.representation.length}`
  );

  const label =
    bump === "major"
      ? "**major（破壊的変更）**"
      : bump === "none"
      ? "なし（トークンに変化はありません）"
      : bump;
  lines.push(`- 必要なバージョン上げ: ${label}`);
  if (next) lines.push(`- 現在 \`${version}\` → \`${next}\``);
  if (bump !== "none" && version.startsWith("0.")) {
    lines.push(
      `- 補足: \`0.x\` のあいだは semver の互換性保証が効きません。\`1.0.0\` への引き上げを検討してください。`
    );
  }
  lines.push("");

  if (diff.removed.length > 0) {
    lines.push(`### 削除されたトークン（破壊的変更）`);
    lines.push("");
    for (const { name, token, renamedTo } of diff.removed) {
      const hint = renamedTo
        ? ` — 同じ値 \`${token.value}\` の \`${renamedTo}\` が追加されています。リネームの可能性があります`
        : "";
      lines.push(`- \`${name}\` (\`${token.value}\`)${hint}`);
    }
    lines.push("");
    lines.push(
      `利用者を壊さないために、\`tools/tokens/deprecated/base.json\` に旧名のエイリアスを追加してください。`
    );
    lines.push("");
  }

  if (diff.changed.length > 0) {
    lines.push(`### 値が変わったトークン`);
    lines.push("");
    for (const { name, before, after } of diff.changed) {
      lines.push(`- \`${name}\`: \`${before}\` → \`${after}\``);
    }
    lines.push("");
  }

  if (diff.representation.length > 0) {
    lines.push(`### 書き方が変わったトークン（色は変わりません）`);
    lines.push("");
    lines.push(
      `解決後の色は同じで、\`${CSS_FILE}\` の書き方だけが変わっています。` +
        `ファイル全体を import している利用者の見た目は変わりません。`
    );
    lines.push("");
    lines.push(
      `**ただし配布する CSS の中身は変わります。** ` +
        `特定の custom property だけを抜き出して使っている場合や、` +
        `参照先を上書きしている場合は影響が出ます。意図した変更かレビュワーが確認してください。`
    );
    lines.push("");

    const shown = diff.representation.slice(0, 20);
    for (const { name, before, after } of shown) {
      lines.push(`- \`${name}\`: \`${before}\` → \`${after}\``);
    }
    if (diff.representation.length > shown.length) {
      lines.push(
        `- … 他 ${diff.representation.length - shown.length} 件（全件は git diff で確認してください）`
      );
    }
    lines.push("");
  }

  if (diff.added.length > 0) {
    lines.push(`### 追加されたトークン`);
    lines.push("");
    for (const name of diff.added) {
      lines.push(`- \`${name}\``);
    }
    lines.push("");
  }

  if (diff.deprecated.length > 0) {
    lines.push(`### 現在 deprecated なトークン`);
    lines.push("");
    for (const { name, comment } of diff.deprecated) {
      lines.push(`- \`${name}\` — ${comment}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function writeGithubOutput(diff: Diff) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    throw new Error("--github-output を使うには GITHUB_OUTPUT が必要です");
  }
  const bump = suggestBump(diff);
  fs.appendFileSync(
    file,
    [
      `suggested_bump=${bump}`,
      `has_breaking=${diff.removed.length > 0}`,
      `removed_count=${diff.removed.length}`,
      `added_count=${diff.added.length}`,
      `changed_count=${diff.changed.length}`,
      `representation_count=${diff.representation.length}`,
      "",
    ].join("\n")
  );
}

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const diff = diffTokens(
    readBaseline(options.baseline),
    readCurrent(),
    readBaselineCss(options.baseline),
    readCurrentCss()
  );

  console.log(report(diff, options));

  if (options.githubOutput) writeGithubOutput(diff);

  if (options.strict && diff.removed.length > 0) {
    console.error(
      "\n破壊的変更が含まれています（--strict のため失敗扱いにします）。"
    );
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
