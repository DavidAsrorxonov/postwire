import { readFileSync } from "node:fs";
import { parse } from "@babel/parser";

export function readImports(filename) {
  const code = readFileSync(filename, "utf-8");
  const plugins = [];

  const isTypescript = /\.(ts|tsx|mts|cts)$/.test(filename);

  if (isTypescript) {
    plugins.push([
      "typescript",
      {
        dts: /\.d.(ts|mts|cts)$/.test(filename),
      },
    ]);
  }

  if (!isTypescript || filename.endsWith(".tsx")) {
    plugins.push("jsx");
  }

  const ast = parse(code, {
    sourceType: "unambiguous",
    sourceFilename: filename,
    createImportExpression: true,
    plugins,
  });

  const imports = [];

  function record(source, node) {
    let specifier;

    if (source?.type === "StringLiteral") {
      specifier = source.value;
    } else if (
      source?.type === "TemplateLiteral" &&
      source.expressions.length === 0
    ) {
      specifier = source.quasis[0].value.cooked;
    }

    const line = node.loc?.start.line ?? 1;

    if (typeof specifier !== "string") {
      throw new Error(
        `${filename}:${line}: module paths must be static strings.`,
      );
    }

    imports.push({ specifier, line });
  }

  function visit(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    switch (node.type) {
      case "ImportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration":
        if (node.source) {
          record(node.source, node);
        }
        break;
      case "ImportExpression":
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          record(node.arguments[0], node);
        }
        break;
      case "TSImportType":
        record(node.argument, node);
        break;

      case "TSExternalModuleReference":
        record(node.expression, node);
        break;
    }

    Object.values(node).forEach(visit);
  }

  visit(ast);

  return imports;
}
