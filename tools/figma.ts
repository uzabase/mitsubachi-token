import * as fs from "fs";
import * as path from "path";

const TOKEN = process.env.FIGMA_TOKEN;
const PRIMITIVE_FIGMA_FILE_KEY = process.env.PRIMITIVE_FIGMA_DESIGN_FILE_KEY;
const SEMANTIC_FIGMA_FILE_KEY = process.env.SEMANTIC_FIGMA_DESIGN_FILE_KEY;

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface VariableAlias {
  type: "VARIABLE_ALIAS";
  id: string;
}

function isVariableAlias(value: Color | VariableAlias): value is VariableAlias {
  return "type" in value && value.type === "VARIABLE_ALIAS";
}

type Variable = {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  remote: boolean;
  description: string;
  hiddenFromPublishing: boolean;
  scopes: unknown;
  codeSyntax: unknown;
  deletedButReferenced?: boolean;
} & (
  | {
      resolvedType: "COLOR";
      valuesByMode: {
        [modeId: string]: Color | VariableAlias;
      };
    }
  | {
      resolvedType: string;
      valuesByMode: unknown;
    }
);

interface Variables {
  [variableId: string]: Variable;
}

interface VariableCollection {
  id: string;
  name: string;
  key: string;
  modes: [
    {
      modeId: string;
      name: string;
    }
  ];
  defaultModeId: string;
  remote: boolean;
  hiddenFromPublishing: boolean;
  variableIds: string[];
}

interface VariableCollections {
  [variableCollectionId: string]: VariableCollection;
}

interface LocalVariablesData {
  variables: Variables;
  variableCollections: VariableCollections;
}

interface LocalVariablesApiResponse {
  status: number;
  error: boolean;
  meta: LocalVariablesData;
}

interface ColorToken {
  color: string;
  /**
   * style-dictionary に渡す値。
   *
   * primitive は解決済みの hex。semantic は Figma でエイリアスになっていれば
   * `{color.primitive-white.value}` のような参照。参照にできないものは hex。
   */
  value: string;
}

async function fetchLocalVariables(fileKey: string) {
  const url = `https://api.figma.com/v1/files/${fileKey}/variables/local`;
  const headers = { "X-FIGMA-TOKEN": TOKEN };
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Figma API の呼び出しに失敗しました (${response.status}): ${body}\n` +
        `FIGMA_TOKEN の有効期限とスコープ（Variables の read）を確認してください。`
    );
  }

  const json: LocalVariablesApiResponse = await response.json();
  return json.meta;
}

function rgbaToHex(r: number, g: number, b: number, a: number) {
  const hr = Math.round(r).toString(16).padStart(2, "0");
  const hg = Math.round(g).toString(16).padStart(2, "0");
  const hb = Math.round(b).toString(16).padStart(2, "0");
  const ha =
    typeof a === "undefined" || a === 1
      ? ""
      : Math.round(a * 255)
          .toString(16)
          .padStart(2, "0");

  return "#" + hr + hg + hb + ha;
}

function toHexValue(color: Color) {
  const { r, g, b, a } = color;
  const hex = rgbaToHex(r * 255, g * 255, b * 255, a);
  return hex;
}

function findLocalVariableCollectionByName(
  name: string,
  variableCollections: VariableCollections
) {
  return Object.values(variableCollections)
    .filter((collection) => !collection.remote)
    .find((collection) => collection.name === name);
}

function findVariableById(id: string, variables: Variables) {
  return Object.values(variables).find((variable) => variable.id === id);
}

/** primitive の Figma 変数名 → トークン名。コレクション階層を1段落とす。 */
function primitiveTokenName(variable: Variable) {
  return `primitive-${variable.name.split("/").slice(1).join("-").trim()}`;
}

/** semantic の Figma 変数名 → トークン名。階層はすべて連結する。 */
function semanticTokenName(variable: Variable) {
  return `semantic-${variable.name.split("/").join("-").trim()}`;
}

/**
 * semantic 変数が直接参照している primitive のトークン名を返す。
 *
 * Figma では semantic 変数は primitive 変数への VARIABLE_ALIAS になっている。
 * その対応を style-dictionary の参照として書き出すために、末端まで潰す前の
 * 参照先を 1 ホップだけ見る。
 *
 * 参照になっていない、参照先が出力対象に無い、自分自身を指しているなど、
 * 有効な参照を作れない場合は undefined を返す。呼び出し側は解決済みの hex に
 * フォールバックする。壊れた var() を出さないことを優先する。
 */
function aliasedTokenName(
  variable: Variable,
  allVariables: Variables,
  emittedTokenNames: Set<string>,
  ownTokenName: string
): string | undefined {
  const value = Object.values(variable.valuesByMode)[0] as
    | Color
    | VariableAlias
    | undefined;
  if (!value || !isVariableAlias(value)) return undefined;

  const target = findVariableById(value.id, allVariables);
  if (!target) return undefined;

  // semantic ファイル側には primitive が別 ID の remote 変数として入っている。
  // ID では突合できないので名前で照合する。
  for (const candidate of [
    primitiveTokenName(target),
    semanticTokenName(target),
  ]) {
    if (candidate === ownTokenName) continue;
    if (emittedTokenNames.has(candidate)) return candidate;
  }

  return undefined;
}

function resolveColorVariable(
  variable: Variable,
  referencedVariables: Variables
): Variable {
  if (variable.resolvedType !== "COLOR") {
    throw new Error("変数の型がCOLORではありません");
  }

  const value = Object.values(variable.valuesByMode)[0];

  if (!isVariableAlias(value)) {
    return variable;
  }

  const referencedVariable = findVariableById(value.id, referencedVariables);
  if (!referencedVariable) {
    throw new Error("参照先の変数が見つかりません");
  }

  return resolveColorVariable(referencedVariable, referencedVariables);
}

function toColorTree(colorTokens: ColorToken[]) {
  const sortedColorTokens = [...colorTokens];
  sortedColorTokens.sort((a, b) => a.color.localeCompare(b.color, "en"));

  return Object.fromEntries(
    sortedColorTokens.map(({ color, value }) => [color, { value }])
  );
}

const main = async () => {
  const primitiveLocalVariables = await fetchLocalVariables(
    PRIMITIVE_FIGMA_FILE_KEY
  );

  const semanticLocalVariables = await fetchLocalVariables(
    SEMANTIC_FIGMA_FILE_KEY
  );

  const uiPrimitiveColorCollection = findLocalVariableCollectionByName(
    "ui-primitive-color",
    primitiveLocalVariables.variableCollections
  );

  const semanticColorCollection = findLocalVariableCollectionByName(
    "ui-semantic-color",
    semanticLocalVariables.variableCollections
  );

  const primitiveColorTokens = uiPrimitiveColorCollection.variableIds
    .map((variableId) =>
      findVariableById(variableId, primitiveLocalVariables.variables)
    )
    .filter((variable) => !variable.deletedButReferenced)
    .filter((variable) => !variable.remote)
    .map((variable) => {
      const resolvedVariable = resolveColorVariable(
        variable,
        primitiveLocalVariables.variables
      );

      const color = primitiveTokenName(variable);
      const value = Object.values(resolvedVariable.valuesByMode)[0];

      return {
        color,
        value: toHexValue(value),
      };
    });

  const allVariables = {
    ...primitiveLocalVariables.variables,
    ...semanticLocalVariables.variables,
  };

  const semanticActiveVariables = semanticColorCollection.variableIds
    .map((variableId) =>
      findVariableById(variableId, semanticLocalVariables.variables)
    )
    .filter((variable) => !variable.deletedButReferenced)
    .filter((variable) => !variable.remote);

  const skippedVariables = semanticActiveVariables.filter((variable) =>
    variable.name.includes("*")
  );

  if (skippedVariables.length > 0) {
    console.log(
      `*が入っているため除外された変数 (${skippedVariables.length}件):`,
      skippedVariables.map((v) => v.name)
    );
  }

  const includedSemanticVariables = semanticActiveVariables.filter(
    (variable) => !variable.name.includes("*")
  );

  // 参照を書き出せる相手の一覧。ここに無い名前を参照すると var() が壊れるので、
  // 照合してから参照にする。
  const emittedTokenNames = new Set<string>([
    ...primitiveColorTokens.map((token) => token.color),
    ...includedSemanticVariables.map(semanticTokenName),
  ]);

  // 参照にできなかったものを後でログに出す。Figma 側の設計と食い違っていないかの手掛かり。
  const literalSemanticTokens: string[] = [];

  const semanticColorTokens = includedSemanticVariables.map((variable) => {
    const color = semanticTokenName(variable);

    const alias = aliasedTokenName(
      variable,
      allVariables,
      emittedTokenNames,
      color
    );

    if (alias) {
      return { color, value: `{color.${alias}.value}` };
    }

    // エイリアスでない、または参照先が出力対象に無い。解決済みの hex にする。
    literalSemanticTokens.push(color);
    const resolvedVariable = resolveColorVariable(variable, allVariables);
    const value = Object.values(resolvedVariable.valuesByMode)[0];

    return { color, value: toHexValue(value) };
  });

  const aliasedCount = semanticColorTokens.length - literalSemanticTokens.length;
  console.log(
    `semantic ${semanticColorTokens.length}件: ` +
      `primitive への参照 ${aliasedCount}件 / 生値 ${literalSemanticTokens.length}件`
  );
  if (literalSemanticTokens.length > 0) {
    console.log("生値で出力した semantic:", literalSemanticTokens);
  }

  const colorContent = JSON.stringify(
    {
      color: toColorTree(primitiveColorTokens.concat(semanticColorTokens)),
    },
    undefined,
    2
  );

  const outputDir = path.resolve(__dirname, "tokens/color");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(path.join(outputDir, "base.json"), colorContent);

  console.log("DONE");
};

main();
