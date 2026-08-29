import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "eslint/config";
import type { Linter } from "eslint";
import importX from "eslint-plugin-import-x";
import type { Options as NoExtraneousDependenciesOptions } from "eslint-plugin-import-x/rules/no-extraneous-dependencies";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
	{
		ignores: ["coverage/**", "dist/**", "node_modules/**", "proxy_providers/**", "*.generated.yaml"],
	},
	{
		files: ["scripts/**/*.ts", "src/**/*.ts", "test/**/*.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
		},
		plugins: {
			"import-x": importX,
			"unused-imports": unusedImports,
		},
		settings: {
			"import-x/resolver": {
				typescript: {
					alwaysTryTypes: true,
					project: path.join(repositoryRoot, "tsconfig.json"),
				},
			},
		},
		rules: {
			"import-x/no-relative-packages": "error",
			"unused-imports/no-unused-imports": "error",
		},
	},
	{
		files: ["scripts/**/*.ts", "src/**/*.ts"],
		rules: {
			"import-x/no-extraneous-dependencies": [
				"error",
				{
					bundledDependencies: false,
					devDependencies: true,
					includeTypes: true,
					optionalDependencies: false,
					packageDir: repositoryRoot,
					peerDependencies: false,
				},
			] satisfies Linter.RuleEntry<[NoExtraneousDependenciesOptions]>,
		},
	},
]);
