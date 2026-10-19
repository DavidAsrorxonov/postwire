import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isBuiltin } from "node:module";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { createPathsMatcher, getTsconfig } from "get-tsconfig";
import { readImports } from "./read-imports.mjs";

const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  ".next",
  ".git",
  "coverage",
]);

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function readJson(filename) {
  return JSON.parse(readFileSync(filename, "utf8"));
}

function* sourceFiles(directory) {
  for (const entry of readdirSync(directory, {
    withFileTypes: true,
  })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const filename = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      yield* sourceFiles(filename);
    } else if (
      entry.isFile() &&
      entry.name !== "next-env.d.ts" &&
      sourceExtensions.has(extname(entry.name))
    ) {
      yield filename;
    }
  }
}

function isInside(directory, filename) {
  const path = relative(directory, filename);

  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
}

function findLocalFile(path) {
  const extension = extname(path);

  // NodeNext source files can import "./file.js"
  // while the source on disk is "./file.ts".
  const replacements = {
    ".js": [".ts", ".tsx", ".js"],
    ".jsx": [".tsx", ".jsx"],
    ".mjs": [".mts", ".mjs"],
    ".cjs": [".cts", ".cjs"],
  };

  const candidates = replacements[extension]
    ? replacements[extension].map(
        (suffix) => path.slice(0, -extension.length) + suffix,
      )
    : [
        path,
        ...[...sourceExtensions].map((suffix) => path + suffix),
        ...[...sourceExtensions].map((suffix) =>
          resolve(path, `index${suffix}`),
        ),
      ];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) {
        return realpathSync(candidate);
      }
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
        throw error;
      }
    }
  }

  return undefined;
}

function packageName(specifier) {
  const parts = specifier.split("/");

  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isDevelopmentFile(filename, directory) {
  const path = relative(directory, filename).split(sep).join("/");

  return (
    /(^|\/)__tests__\//.test(path) ||
    /^(test-support|scripts)\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    (!path.includes("/") && /\.config\.[cm]?[jt]s$/.test(path))
  );
}

export function checkSourceBoundaries(rootDir, rules) {
  const errors = [];
  const configCache = new Map();

  const rootManifest = readJson(resolve(rootDir, "package.json"));

  const workspaces = rules.map((rule) => ({
    ...rule,
    absoluteDirectory: realpathSync(resolve(rootDir, rule.directory)),
    manifest: readJson(resolve(rootDir, rule.directory, "package.json")),
  }));

  const byName = new Map(
    workspaces.map((workspace) => [workspace.name, workspace]),
  );

  for (const workspace of workspaces) {
    for (const filename of sourceFiles(workspace.absoluteDirectory)) {
      try {
        const config = getTsconfig(filename, "tsconfig.json", configCache);

        if (!config) {
          throw new Error("No tsconfig.json found.");
        }

        const matchPaths = createPathsMatcher(config);

        const development = isDevelopmentFile(
          filename,
          workspace.absoluteDirectory,
        );

        const declared = {
          ...workspace.manifest.dependencies,
          ...workspace.manifest.optionalDependencies,
          ...workspace.manifest.peerDependencies,
          ...(development
            ? {
                ...rootManifest.devDependencies,
                ...workspace.manifest.devDependencies,
              }
            : {}),
        };

        for (const { specifier, line } of readImports(filename)) {
          const fail = (message) => {
            throw new Error(`line ${line}: ${message}`);
          };

          let localTarget;

          const isLocal =
            specifier.startsWith(".") ||
            isAbsolute(specifier) ||
            specifier.startsWith("file:");

          if (isLocal) {
            const path = specifier.startsWith("file:")
              ? fileURLToPath(specifier)
              : resolve(dirname(filename), specifier);

            localTarget = findLocalFile(path);

            if (!localTarget) {
              fail(`Cannot resolve local import "${specifier}".`);
            }
          } else {
            localTarget = (matchPaths?.(specifier) ?? [])
              .map(findLocalFile)
              .find(Boolean);
          }

          if (localTarget) {
            if (
              !isInside(workspace.absoluteDirectory, localTarget) ||
              localTarget.split(sep).includes("node_modules")
            ) {
              fail(
                `"${specifier}" crosses a boundary through a path. ` +
                  "Use a permitted package's public export.",
              );
            }

            if (
              !development &&
              isDevelopmentFile(localTarget, workspace.absoluteDirectory)
            ) {
              fail("Production code cannot import a development-only file.");
            }

            continue;
          }

          if (isBuiltin(specifier)) {
            continue;
          }

          const dependency = packageName(specifier);
          const target = byName.get(dependency);
          const isSelfImport = target === workspace;

          if (!isSelfImport && !Object.hasOwn(declared, dependency)) {
            fail(`"${dependency}" is not a declared dependency.`);
          }

          if (target) {
            if (
              !isSelfImport &&
              !workspace.workspaceDependencies.includes(dependency)
            ) {
              fail(`${workspace.name} cannot import ${dependency}.`);
            }

            const exportKey =
              specifier === dependency
                ? "."
                : `.${specifier.slice(dependency.length)}`;

            const exports = target.manifest.exports;

            if (
              !exports ||
              typeof exports !== "object" ||
              !Object.hasOwn(exports, exportKey) ||
              exports[exportKey] === null
            ) {
              fail(`"${specifier}" is not an explicit public export.`);
            }

            continue;
          }

          const allowed = workspace.allowedRuntimeDependencies;

          if (
            !development &&
            allowed !== null &&
            !allowed.includes(dependency)
          ) {
            fail(`"${dependency}" is not an allowed production dependency.`);
          }
        }
      } catch (error) {
        errors.push(`${relative(rootDir, filename)}: ${error.message}`);
      }
    }
  }

  return errors;
}
