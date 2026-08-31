import assert from "node:assert/strict";
import test from "node:test";

import { parseProxyProviderName } from "../src/proxy-provider-name.ts";

test("prefers and decodes Content-Disposition filename*", () => {
	assert.equal(
		parseProxyProviderName(
			`attachment; filename="fallback.yaml"; filename*=UTF-8''YKK%20Cloud%E4%B8%AD%E6%96%87.yaml`,
		),
		"YKK Cloud中文.yaml",
	);
});

test("falls back to Content-Disposition filename", () => {
	assert.equal(parseProxyProviderName('attachment; filename="YKKCLOUD"'), "YKKCLOUD");
	assert.equal(parseProxyProviderName("attachment"), null);
	assert.equal(parseProxyProviderName(null), null);
});
