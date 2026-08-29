import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "yaml";

import { createMihomoYaml } from "../src/config-yaml.ts";
import { MihomoProxyNodeGroup, MihomoProxyPolicyGroup } from "../src/config-types.ts";
import { MihomoBuiltInPolicy, type MihomoConfig } from "../src/mihomo-types.ts";

const syntheticSettings = {
	airportUrl: "https://example.com/subscribe?token=replace-me",
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

	assert.equal(config["proxy-providers"]["airport"].url, syntheticSettings.airportUrl);
	assert.deepEqual(
		config.proxies.map((proxy) => proxy.name),
		["Synthetic-IP"],
	);
	assert.equal(config.proxies[0]?.["dialer-proxy"], MihomoProxyNodeGroup.ProxyNodes);
	assert.equal(config.rules.at(-1), `MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`);
});

test("rejects settings without a residential proxy", () => {
	assert.throws(
		() => createMihomoYaml({ ...syntheticSettings, residentials: {} }),
		/residentials must contain at least one named residential proxy/,
	);
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
		() => createMihomoYaml({ ...syntheticSettings, airportUrl: "file:///not-a-subscription" }),
		/airportUrl must be an absolute HTTP or HTTPS URL/,
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
