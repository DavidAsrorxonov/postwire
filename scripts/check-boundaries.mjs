import { checkSourceBoundaries } from "./check-source-boundaries.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

const rules = [
  {
    directory: "packages/core",
    name: "@postwire/core",
    workspaceDependencies: [],
    allowedRuntimeDependencies: [],
  },
  {
    directory: "packages/db-models",
    name: "@postwire/db-models",
    workspaceDependencies: [],
    allowedRuntimeDependencies: ["mongoose"],
  },
  {
    directory: "apps/web",
    name: "@postwire/web",
    workspaceDependencies: ["@postwire/db-models"],
    allowedRuntimeDependencies: null,
  },
  {
    directory: "apps/worker",
    name: "@postwire/worker",
    workspaceDependencies: ["@postwire/core", "@postwire/db-models"],
    allowedRuntimeDependencies: null,
  },
];

const dependencyFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "devDependencies",
];

const errors = [];

for (const rule of rules) {
  const manifestPath = resolve(rootDir, rule.directory, "package.json");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const label = `${rule.directory}/package.json`;

  if (manifest.name !== rule.name) {
    errors.push(`${label}: expected package name "${rule.name}".`);
  }

  for (const field of dependencyFields) {
    const dependencies = manifest[field] ?? {};

    for (const dependency of Object.keys(dependencies)) {
      const isWorkspace = dependency.startsWith("@postwire/");

      if (isWorkspace && !rule.workspaceDependencies.includes(dependency)) {
        errors.push(`${label}: ${field} cannot include "${dependency}".`);
      }

      const isRuntime = field !== "devDependencies";
      const allowed = rule.allowedRuntimeDependencies;

      if (isRuntime && allowed !== null && !allowed.includes(dependency)) {
        errors.push(
          `${label}: "${dependency}" is not an allowed runtime dependency.`,
        );
      }
    }
  }

  for (const dependency of rule.workspaceDependencies) {
    if (!manifest.dependencies?.[dependency]) {
      errors.push(`${label}: dependencies must include "${dependency}".`);
    }
  }
}

errors.push(...checkSourceBoundaries(rootDir, rules));

if (errors.length > 0) {
  console.error("Boundary violations found.");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
} else {
  console.log("Package and source boundaries passed.");
}
