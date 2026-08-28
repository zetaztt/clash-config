import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { buildConfig } from "../scripts/build.ts";
import { createMihomoConfig, createMihomoRules, rulesConfigs } from "../scripts/config.ts";
import {
	MihomoProxyNodeGroup,
	MihomoProxyPolicyGroup,
	type MihomoRulesConfig,
	type ProxiesConfig,
} from "../scripts/config-types.ts";
import { MihomoBuiltInPolicy, MihomoRuleType, type MihomoConfig } from "../scripts/mihomo-types.ts";

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

function createRulesConfig(...configs: MihomoRulesConfig[]): MihomoRulesConfig[] {
	return configs;
}

function assertRulePrecedes(rules: string[], earlierRule: string, laterRule: string): void {
	const earlierIndex = rules.indexOf(earlierRule);
	const laterIndex = rules.indexOf(laterRule);
	assert.ok(earlierIndex >= 0, `missing earlier rule: ${earlierRule}`);
	assert.ok(laterIndex > earlierIndex, `${earlierRule} must precede ${laterRule}`);
}

test("serializes rule blocks and grouped rule types in declaration order", () => {
	assert.deepEqual(
		createMihomoRules(
			createRulesConfig(
				{
					remarks: "住宅域名",
					group: MihomoProxyPolicyGroup.RiskPolicy,
					rules: {
						[MihomoRuleType.DomainSuffix]: ["example.com", "example.org"],
						[MihomoRuleType.Domain]: ["api.example.net"],
					},
				},
				{
					remarks: "应用进程",
					group: MihomoProxyPolicyGroup.ProxyPolicy,
					rules: { [MihomoRuleType.ProcessName]: ["example.exe"] },
				},
			),
		),
		[
			`DOMAIN-SUFFIX,example.com,${MihomoProxyPolicyGroup.RiskPolicy}`,
			`DOMAIN-SUFFIX,example.org,${MihomoProxyPolicyGroup.RiskPolicy}`,
			`DOMAIN,api.example.net,${MihomoProxyPolicyGroup.RiskPolicy}`,
			`PROCESS-NAME,example.exe,${MihomoProxyPolicyGroup.ProxyPolicy}`,
			`MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`,
		],
	);
});

test("adds no-resolve to target IP rules before GEOIP private only", () => {
	assert.deepEqual(
		createMihomoRules(
			createRulesConfig(
				{
					remarks: "边界前",
					group: MihomoBuiltInPolicy.Direct,
					rules: {
						[MihomoRuleType.Domain]: ["example.com"],
						[MihomoRuleType.IpCidr]: ["192.0.2.0/24"],
						[MihomoRuleType.IpCidr6]: ["2001:db8::/32"],
						[MihomoRuleType.GeoIp]: ["test"],
						[MihomoRuleType.SrcIpCidr]: ["198.51.100.0/24"],
					},
				},
				{
					remarks: "解析边界",
					group: MihomoBuiltInPolicy.Direct,
					rules: { [MihomoRuleType.GeoIp]: ["private"] },
				},
				{
					remarks: "边界后",
					group: MihomoProxyPolicyGroup.ProxyPolicy,
					rules: {
						[MihomoRuleType.IpCidr]: ["198.51.100.0/24"],
						[MihomoRuleType.IpCidr6]: ["2001:db8:1::/48"],
						[MihomoRuleType.GeoIp]: ["cn"],
					},
				},
			),
		),
		[
			"DOMAIN,example.com,DIRECT",
			"IP-CIDR,192.0.2.0/24,DIRECT,no-resolve",
			"IP-CIDR6,2001:db8::/32,DIRECT,no-resolve",
			"GEOIP,test,DIRECT,no-resolve",
			"SRC-IP-CIDR,198.51.100.0/24,DIRECT",
			"GEOIP,private,DIRECT",
			`IP-CIDR,198.51.100.0/24,${MihomoProxyPolicyGroup.ProxyPolicy}`,
			`IP-CIDR6,2001:db8:1::/48,${MihomoProxyPolicyGroup.ProxyPolicy}`,
			`GEOIP,cn,${MihomoProxyPolicyGroup.ProxyPolicy}`,
			`MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`,
		],
	);
});

test("keeps inlined rule structure valid", () => {
	assert.equal(
		rulesConfigs.some(({ remarks }) => remarks.includes("v2rayN")),
		false,
	);

	const rules = createMihomoRules(rulesConfigs);
	const nodeGroupNames = new Set<string>(Object.values(MihomoProxyNodeGroup));
	assert.ok(rulesConfigs.every(({ group }) => !nodeGroupNames.has(group)));
	assert.equal(rules[0], `GEOSITE,category-ads-all,${MihomoProxyPolicyGroup.AdPolicy}`);
	assert.deepEqual(
		rules.filter((rule) => rule.includes("category-ads-all")),
		[`GEOSITE,category-ads-all,${MihomoProxyPolicyGroup.AdPolicy}`],
	);
	assert.equal(rules.includes(`DOMAIN-KEYWORD,adservice,${MihomoProxyPolicyGroup.AdPolicy}`), false);
	assert.equal(rules.includes(`DOMAIN-SUFFIX,doubleclick.net,${MihomoProxyPolicyGroup.AdPolicy}`), false);
	assert.equal(
		rules.some((rule) => rule.split(",")[2] === MihomoProxyNodeGroup.ProxyNodes),
		false,
	);
	assert.equal(
		rules.some((rule) => rule.split(",")[2] === MihomoProxyNodeGroup.ResidentialNodes),
		false,
	);
	assert.ok(rules.includes(`DOMAIN-SUFFIX,chatgpt.com,${MihomoProxyPolicyGroup.RiskPolicy}`));
	assert.ok(rules.includes(`DOMAIN,api.ip.sb,${MihomoProxyPolicyGroup.ProxyPolicy}`));
	assert.equal(rules.includes(`DOMAIN-KEYWORD,api.ip.sb,${MihomoProxyPolicyGroup.ProxyPolicy}`), false);
	assert.ok(rules.includes("IP-CIDR,223.5.5.5/32,DIRECT,no-resolve"));
	assert.ok(rules.includes(`IP-CIDR,1.1.1.1/32,${MihomoProxyPolicyGroup.ProxyPolicy},no-resolve`));
	assert.ok(rules.includes("IP-CIDR6,2400:3200::1/128,DIRECT,no-resolve"));
	assert.ok(rules.includes(`IP-CIDR6,2606:4700:4700::1111/128,${MihomoProxyPolicyGroup.ProxyPolicy},no-resolve`));
	assert.ok(rules.includes("GEOIP,private,DIRECT"));
	assert.ok(rules.includes("GEOSITE,category-game-platforms-download@cn,DIRECT"));
	assert.equal(rules.includes("IP-CIDR,155.133.224.0/22,DIRECT"), false);
	assert.ok(rules.includes(`GEOIP,facebook,${MihomoProxyPolicyGroup.ProxyPolicy}`));
	assert.ok(rules.includes("GEOIP,cn,DIRECT"));
	assertRulePrecedes(rules, "GEOSITE,apple-cn,DIRECT", `GEOSITE,apple,${MihomoProxyPolicyGroup.ProxyPolicy}`);
	assertRulePrecedes(rules, `GEOSITE,gfw,${MihomoProxyPolicyGroup.ProxyPolicy}`, "GEOSITE,cn,DIRECT");
	assertRulePrecedes(rules, `GEOSITE,greatfire,${MihomoProxyPolicyGroup.ProxyPolicy}`, "GEOSITE,cn,DIRECT");

	const privateIpIndex = rules.indexOf("GEOIP,private,DIRECT");
	assert.ok(privateIpIndex >= 0);
	for (const [index, rule] of rules.entries()) {
		if (["DOMAIN,", "DOMAIN-SUFFIX,", "DOMAIN-KEYWORD,", "GEOSITE,"].some((prefix) => rule.startsWith(prefix))) {
			assert.ok(index < privateIpIndex, `${rule} must precede GEOIP,private,DIRECT`);
		}
		if ((rule.startsWith("IP-CIDR,") || rule.startsWith("IP-CIDR6,")) && rule.endsWith(",no-resolve")) {
			assert.ok(index < privateIpIndex, `${rule} must precede GEOIP,private,DIRECT`);
		}
	}

	for (const service of ["facebook", "fastly", "google", "netflix", "telegram", "twitter"]) {
		const serviceRule = `GEOIP,${service},${MihomoProxyPolicyGroup.ProxyPolicy}`;
		assertRulePrecedes(rules, "GEOIP,private,DIRECT", serviceRule);
		assertRulePrecedes(rules, serviceRule, "GEOIP,cn,DIRECT");
	}
	assert.equal(rules.includes("DOMAIN-SUFFIX,apple.com,DIRECT"), false);
	assert.equal(rules.includes(`DOMAIN,developer.apple.com,${MihomoProxyPolicyGroup.ProxyPolicy}`), false);
	assert.ok(
		rulesConfigs.every(
			({ rules: configuredRules }) =>
				configuredRules[MihomoRuleType.DstPort] === undefined
				&& configuredRules[MihomoRuleType.Network] === undefined,
		),
	);
	assert.equal(rules.at(-1), `MATCH,${MihomoProxyPolicyGroup.FinalPolicy}`);
});

test("builds auto-updating Loyalsoldier DAT geodata settings", () => {
	const config = createMihomoConfig({
		airportUrl: "https://example.com/subscribe?token=replace-me",
		residentials: {},
	});

	assert.equal(config["geodata-mode"], true);
	assert.deepEqual(config["geox-url"], {
		geoip: "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
		geosite: "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
	});
	assert.equal(config["geo-auto-update"], true);
	assert.equal(config["geo-update-interval"], 24);
});

test("persists fake-IP mappings and races TCP connection addresses", () => {
	const config = createMihomoConfig({
		airportUrl: "https://example.com/subscribe?token=replace-me",
		residentials: {},
	});

	assert.equal(config["tcp-concurrent"], true);
	assert.deepEqual(config.profile, {
		"store-selected": true,
		"store-fake-ip": true,
	});
});

test("builds DNS settings that proxy encrypted overseas resolution", () => {
	const config = createMihomoConfig({
		airportUrl: "https://example.com/subscribe?token=replace-me",
		residentials: {
			"Synthetic-IP": {
				server: "residential.example.com",
				port: 12345,
				username: "replace-me",
				password: "replace-me",
			},
		},
	});

	assert.equal(config.ipv6, true);
	assert.deepEqual(config.dns, {
		enable: true,
		"use-hosts": true,
		"use-system-hosts": true,
		ipv6: true,
		"enhanced-mode": "fake-ip",
		"fake-ip-range": "198.18.0.1/16",
		"fake-ip-filter": ["geosite:private", "+.msftncsi.com", "www.msftconnecttest.com", "+.market.xiaomi.com"],
		"default-nameserver": ["223.5.5.5", "119.29.29.29"],
		"nameserver-policy": {
			"geosite:private": ["system"],
			"geosite:cn": ["https://dns.alidns.com/dns-query"],
		},
		nameserver: [
			`https://1.1.1.1/dns-query#${MihomoProxyPolicyGroup.ProxyPolicy}`,
			`https://8.8.8.8/dns-query#${MihomoProxyPolicyGroup.ProxyPolicy}`,
		],
		"proxy-server-nameserver": ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"],
		"direct-nameserver": ["https://dns.alidns.com/dns-query"],
		"direct-nameserver-follow-policy": true,
	});
});

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
