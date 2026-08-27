import type { Config } from "prettier";

export default {
	useTabs: true,
	tabWidth: 4,
	printWidth: 120,

	semi: true,
	singleQuote: false,
	trailingComma: "all",
	bracketSameLine: true,
	endOfLine: "lf",
	experimentalOperatorPosition: "start",
	proseWrap: "preserve",
} satisfies Config;
