import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "yaml";

import { createMihomoYaml } from "../src/config-yaml.ts";
import { MihomoProxyNodeGroup, MihomoProxyPolicyGroup } from "../src/config-types.ts";
import { MihomoBuiltInPolicy, type MihomoConfig } from "../src/mihomo-types.ts";

const syntheticSettings = {
	proxyProviders: {
		"Synthetic Airport": { url: "https://example.com/subscribe?token=replace-me" },
		"Synthetic Backup": { url: "https://backup.example.com/subscribe?token=replace-me" },
	},
	residentials: {
		"Synthetic-IP": {
			server: "residential.example.com",
			port: 12345,
			username: "replace-me",
			password: "replace-me",
		},
	},
};

test("serializes validated browser settings as a Mihomo profile", () => {
	const config = parse(createMihomoYaml(syntheticSettings)) as MihomoConfig;

	assert.deepEqual(Object.keys(config["proxy-providers"]), ["Synthetic Airport", "Synthetic Backup"]);
	assert.equal(
		config["proxy-providers"]["Synthetic Airport"]?.url,
		syntheticSettings.proxyProviders["Synthetic Airport"].url,
	);
	assert.deepEqual(config["proxy-providers"]["Synthetic Airport"]?.path, "./proxy_providers/provider-1.yaml");
	assert.deepEqual(config["proxy-groups"].find(({ name }) => name === MihomoProxyNodeGroup.ProxyNodes)?.use, [
		"Synthetic Airport",
		"Synthetic Backup",
	]);
	assert.deepEqual(
		config.proxies.map((proxy) => proxy.name),
		["Synthetic-IP"],
	);
	assert.equal(config.proxies[0]?.["dialer-proxy"], MihomoProxyNodeGroup.ProxyNodes);
	assert.equal(config.rules.at(-1), `MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`);
});

test("allows no residential proxies", () => {
	const config = parse(createMihomoYaml({ ...syntheticSettings, residentials: {} })) as MihomoConfig;
	assert.deepEqual(config.proxies, []);
	assert.deepEqual(
		config["proxy-groups"].find(({ name }) => name === MihomoProxyNodeGroup.ResidentialNodes),
		{
			name: MihomoProxyNodeGroup.ResidentialNodes,
			type: "select",
			proxies: [],
		},
	);
});

test("allows both proxy providers and residential proxies to be empty", () => {
	const config = parse(createMihomoYaml({ proxyProviders: {}, residentials: {} })) as MihomoConfig;
	assert.deepEqual(config["proxy-providers"], {});
	assert.deepEqual(config.proxies, []);
});

test("rejects residential names that conflict with groups and built-in policies", () => {
	for (const reservedName of [
		...Object.values(MihomoProxyNodeGroup),
		...Object.values(MihomoProxyPolicyGroup),
		...Object.values(MihomoBuiltInPolicy),
	]) {
		assert.throws(
			() =>
				createMihomoYaml({
					...syntheticSettings,
					residentials: { [reservedName]: syntheticSettings.residentials["Synthetic-IP"] },
				}),
			/name must not conflict with a proxy group or built-in policy name/,
		);
	}
});

test("rejects invalid ports and subscription URLs", () => {
	assert.throws(
		() =>
			createMihomoYaml({
				...syntheticSettings,
				residentials: {
					"Synthetic-IP": { ...syntheticSettings.residentials["Synthetic-IP"], port: 70000 },
				},
			}),
		/port must be an integer from 1 through 65535/,
	);
	assert.throws(
		() =>
			createMihomoYaml({
				...syntheticSettings,
				proxyProviders: { Broken: { url: "file:///not-a-subscription" } },
			}),
		/proxyProviders entry 1.url must be an absolute HTTP or HTTPS URL/,
	);
});

test("allows no proxy providers and rejects unnamed providers", () => {
	const config = parse(createMihomoYaml({ ...syntheticSettings, proxyProviders: {} })) as MihomoConfig;
	assert.deepEqual(config["proxy-providers"], {});
	assert.deepEqual(
		config["proxy-groups"].find(({ name }) => name === MihomoProxyNodeGroup.ProxyNodes),
		{
			name: MihomoProxyNodeGroup.ProxyNodes,
			type: "select",
			use: [],
		},
	);
	assert.throws(
		() => createMihomoYaml({ ...syntheticSettings, proxyProviders: { " ": { url: "https://example.com" } } }),
		/name must be non-empty and have no surrounding whitespace/,
	);
	assert.throws(
		() => createMihomoYaml({ residentials: syntheticSettings.residentials }),
		/proxyProviders must be an object/,
	);
	assert.throws(
		() => createMihomoYaml({ proxyProviders: syntheticSettings.proxyProviders }),
		/residentials must be an object/,
	);
});

test("round-trips credentials that require YAML escaping", () => {
	const username = "user:name #1";
	const password = '"quoted": value\nsecond line';
	const config = parse(
		createMihomoYaml({
			...syntheticSettings,
			residentials: {
				"Synthetic-IP": { ...syntheticSettings.residentials["Synthetic-IP"], username, password },
			},
		}),
	) as MihomoConfig;

	assert.equal(config.proxies[0]?.username, username);
	assert.equal(config.proxies[0]?.password, password);
});
