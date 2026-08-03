import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const runtimeDependencies = Object.keys(packageJson.dependencies ?? {});
const errors = [];

if (runtimeDependencies.length !== 1 || runtimeDependencies[0] !== "@elqora/dgp-spec") {
  errors.push("Core must have exactly one runtime dependency: @elqora/dgp-spec.");
}

const canonicalTypeNames = new Set([
  "ProductDefinition",
  "ProductFilter",
  "ProductField",
  "FieldOption",
  "HandlerService",
  "ServiceCapability",
]);
const forbiddenTerms = /\b(flags|estimates|constraints_origin|constraints_overrides|component)\b/;
const sourceDirectory = path.join(root, "src");
const sourceFiles = (await readdir(sourceDirectory, { recursive: true }))
  .filter((entry) => entry.endsWith(".ts"))
  .map((entry) => path.join("src", entry));

for (const relativePath of sourceFiles) {
  const absolutePath = path.join(root, relativePath);
  const text = await readFile(absolutePath, "utf8");
  const source = ts.createSourceFile(absolutePath, text, ts.ScriptTarget.Latest, true);

  for (const match of text.matchAll(new RegExp(forbiddenTerms, "g"))) {
    const position = source.getLineAndCharacterOfPosition(match.index ?? 0);
    errors.push(`${relativePath}:${position.line + 1} contains forbidden legacy field ${match[0]}.`);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const moduleName = node.moduleSpecifier.getText(source).replaceAll(/["']/g, "");
      if (!moduleName.startsWith(".") && moduleName !== "@elqora/dgp-spec") {
        errors.push(`${relativePath}:${source.getLineAndCharacterOfPosition(node.pos).line + 1} imports forbidden runtime dependency ${moduleName}.`);
      }
    }

    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && canonicalTypeNames.has(node.name.text)) {
      errors.push(`${relativePath}:${source.getLineAndCharacterOfPosition(node.pos).line + 1} independently authors canonical type ${node.name.text}.`);
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

if (errors.length > 0) {
  throw new Error(`Core boundary violations:\n${errors.join("\n")}`);
}

console.log("Core dependency and source boundaries are valid.");
