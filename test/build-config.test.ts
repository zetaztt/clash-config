import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { buildConfig } from "../scripts/build-config.ts";
import { MihomoProxyNodeGroup, MihomoProxyPolicyGroup, type ProxiesConfig } from "../src/config-types.ts";
import { MihomoBuiltInPolicy, type MihomoConfig } from "../src/mihomo-types.ts";

function withTemporaryDirectory(callback: (directory: string) => void): void {
	const directory = mkdtempSync(path.join(os.tmpdir(), "clash-config-test-"));
	try {
		callback(directory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

function writeSyntheticProxiesConfig(directory: string): string {
	const proxiesConfigPath = path.join(directory, "proxies.json");
	const proxiesConfig = {
		airportUrl: "https://example.com/subscribe?token=replace-me",
		residentials: {
			"JP-IP": {
				server: "jp-residential.example.com",
				port: 12345,
				username: "replace-me",
				password: "replace-me",
			},
			"US-IP": {
				server: "us-residential.example.com",
				port: 23456,
				username: "replace-me",
				password: "replace-me",
			},
		},
	} satisfies ProxiesConfig;
	writeFileSync(proxiesConfigPath, JSON.stringify(proxiesConfig), "utf8");
	return proxiesConfigPath;
}

test("builds a profile with arbitrary residential node names", () => {
	withTemporaryDirectory((directory) => {
		const proxiesConfigPath = writeSyntheticProxiesConfig(directory);
		const outputPath = path.join(directory, "clash-config.yaml");
		writeFileSync(outputPath, "existing output", "utf8");
		const result = buildConfig({
			proxiesConfigPath,
			outputPath,
		});
		const content = readFileSync(result, "utf8");
		const config = parse(content) as MihomoConfig;

		assert.equal(result, outputPath);
		assert.equal(config.mode, "rule");
		assert.equal(config["proxy-providers"].airport.type, "http");
		assert.equal(config["proxy-providers"].airport.url, "https://example.com/subscribe?token=replace-me");
		assert.deepEqual(
			config.proxies.map((proxy) => proxy.name),
			["JP-IP", "US-IP"],
		);
		assert.ok(
			config.proxies.every(
				(proxy) => proxy.type === "socks5" && proxy["dialer-proxy"] === MihomoProxyNodeGroup.ProxyNodes,
			),
		);
		assert.ok(config.proxies.every((proxy) => proxy["dialer-proxy"] !== MihomoProxyPolicyGroup.ProxyPolicy));
		assert.equal(
			config["proxy-groups"].length,
			Object.values(MihomoProxyNodeGroup).length + Object.values(MihomoProxyPolicyGroup).length,
		);
		assert.deepEqual(
			config["proxy-groups"].map((group) => group.name),
			[
				MihomoProxyPolicyGroup.ProxyPolicy,
				MihomoProxyPolicyGroup.RiskPolicy,
				MihomoProxyNodeGroup.ProxyNodes,
				MihomoProxyNodeGroup.ResidentialNodes,
				MihomoProxyPolicyGroup.AdPolicy,
				MihomoProxyPolicyGroup.FinalPolicy,
			],
		);
		assert.deepEqual(config["proxy-groups"][0]?.proxies, [
			MihomoProxyNodeGroup.ProxyNodes,
			MihomoProxyNodeGroup.ResidentialNodes,
		]);
		assert.deepEqual(config["proxy-groups"][1]?.proxies, [
			MihomoProxyNodeGroup.ResidentialNodes,
			MihomoProxyPolicyGroup.ProxyPolicy,
		]);
		assert.deepEqual(config["proxy-groups"][2]?.use, ["airport"]);
		assert.deepEqual(config["proxy-groups"][3]?.proxies, ["JP-IP", "US-IP"]);
		assert.deepEqual(config["proxy-groups"][4]?.proxies, [MihomoBuiltInPolicy.Reject, MihomoBuiltInPolicy.Pass]);
		assert.deepEqual(config["proxy-groups"][5]?.proxies, [
			MihomoProxyPolicyGroup.ProxyPolicy,
			MihomoBuiltInPolicy.Direct,
		]);
		assert.deepEqual(
			config.rules.filter((rule) => rule.startsWith("MATCH,")),
			[`MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`],
		);
		assert.ok(config.rules.includes(`GEOSITE,category-ads-all,${MihomoProxyPolicyGroup.AdPolicy}`));
		assert.equal(config.rules.includes(`DOMAIN-KEYWORD,adservice,${MihomoProxyPolicyGroup.AdPolicy}`), false);
		assert.equal(config.rules.includes(`DOMAIN-SUFFIX,doubleclick.net,${MihomoProxyPolicyGroup.AdPolicy}`), false);
		assert.equal(
			config.rules.some((rule) => rule.endsWith(",REJECT")),
			false,
		);
		assert.equal(
			config.rules.some((rule) => rule.endsWith(",PASS")),
			false,
		);
		assert.ok(config.rules.includes("GEOSITE,cn,DIRECT"));
		assert.ok(config.rules.includes("GEOSITE,category-game-platforms-download@cn,DIRECT"));
		assert.ok(config.rules.includes("DOMAIN,dl.steam.ksyna.com,DIRECT"));
		assert.ok(config.rules.includes("DOMAIN,st.dl.pinyuncloud.com,DIRECT"));
		assert.ok(config.rules.includes("DOMAIN,steampipe.steamcontent.tnkjmec.com,DIRECT"));
		assert.equal(config.rules.includes("DOMAIN-SUFFIX,steamcontent.com,DIRECT"), false);
		assert.equal(config.rules.includes("IP-CIDR,155.133.224.0/22,DIRECT"), false);
		assert.equal(config.rules.includes("DOMAIN-SUFFIX,steamcommunity.com,DIRECT"), false);
		assert.equal(config.rules.includes("DOMAIN-SUFFIX,epicgames.com,DIRECT"), false);
		assert.equal(config.rules.includes("DOMAIN-SUFFIX,easyanticheat.net,DIRECT"), false);
		assert.equal(config.rules.includes("DOMAIN,epicgames-download1.akamaized.net,DIRECT"), false);
		assert.equal(config.rules.includes("DOMAIN-SUFFIX,edgekey.net,DIRECT"), false);
		assert.equal(config.rules.includes("DST-PORT,0-65535,DIRECT"), false);
		assert.equal(config.rules.at(-1), `MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`);
	});
});

test("rejects residential node names that conflict with proxy groups or built-in policies", () => {
	const reservedNames = [
		...Object.values(MihomoProxyNodeGroup),
		...Object.values(MihomoProxyPolicyGroup),
		...Object.values(MihomoBuiltInPolicy),
	];

	for (const reservedName of reservedNames) {
		withTemporaryDirectory((directory) => {
			const proxiesConfigPath = path.join(directory, "proxies.json");
			const outputPath = path.join(directory, "result.yaml");
			writeFileSync(
				proxiesConfigPath,
				JSON.stringify({
					airportUrl: "https://example.com/subscribe?token=replace-me",
					residentials: {
						[reservedName]: {
							server: "residential.example.com",
							port: 12345,
							username: "example",
							password: "example",
						},
					},
				}),
				"utf8",
			);

			assert.throws(
				() => buildConfig({ proxiesConfigPath, outputPath }),
				/residentials entry 1 name must not conflict with a proxy group or built-in policy name/,
			);
			assert.equal(existsSync(outputPath), false);
		});
	}
});

test("rejects an invalid residential port before writing output", () => {
	withTemporaryDirectory((directory) => {
		const proxiesConfigPath = path.join(directory, "proxies.json");
		const outputPath = path.join(directory, "result.yaml");
		writeFileSync(
			proxiesConfigPath,
			JSON.stringify({
				airportUrl: "https://example.com/subscribe?token=replace-me",
				residentials: {
					"SG-IP": {
						server: "residential.example.com",
						port: 70000,
						username: "example",
						password: "example",
					},
				},
			}),
			"utf8",
		);
		assert.throws(
			() => buildConfig({ proxiesConfigPath, outputPath }),
			/residentials entry 1\.port must be an integer from 1 through 65535/,
		);
		assert.equal(existsSync(outputPath), false);
	});
});

test("rejects an invalid airport URL before writing output", () => {
	withTemporaryDirectory((directory) => {
		const proxiesConfigPath = path.join(directory, "proxies.json");
		const outputPath = path.join(directory, "result.yaml");
		writeFileSync(
			proxiesConfigPath,
			JSON.stringify({
				airportUrl: "file:///not-a-subscription",
				residentials: {
					"SG-IP": {
						server: "residential.example.com",
						port: 12345,
						username: "example",
						password: "example",
					},
				},
			}),
			"utf8",
		);
		assert.throws(
			() => buildConfig({ proxiesConfigPath, outputPath }),
			/airportUrl must be an absolute HTTP or HTTPS URL/,
		);
		assert.equal(existsSync(outputPath), false);
	});
});

test("round-trips credentials that require YAML escaping", () => {
	withTemporaryDirectory((directory) => {
		const proxiesConfigPath = path.join(directory, "proxies.json");
		const outputPath = path.join(directory, "result.yaml");
		const username = "user:name #1";
		const password = '"quoted": value\nsecond line';
		writeFileSync(
			proxiesConfigPath,
			JSON.stringify({
				airportUrl: "https://example.com/subscribe?token=escaped",
				residentials: {
					"SG-IP": {
						server: "residential.example.com",
						port: 12345,
						username,
						password,
					},
				},
			}),
			"utf8",
		);

		buildConfig({ proxiesConfigPath, outputPath });
		const config = parse(readFileSync(outputPath, "utf8")) as MihomoConfig;
		const residential = config.proxies.find((proxy) => proxy.name === "SG-IP");
		assert.equal(residential?.username, username);
		assert.equal(residential?.password, password);
	});
});
