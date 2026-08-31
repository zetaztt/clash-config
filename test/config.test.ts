import assert from "node:assert/strict";
import test from "node:test";

import { createMihomoConfig, createMihomoRules, rulesConfigs } from "../src/config.ts";
import { MihomoProxyNodeGroup, MihomoProxyPolicyGroup, type MihomoRulesConfig } from "../src/config-types.ts";
import { MihomoBuiltInPolicy, MihomoRuleType } from "../src/mihomo-types.ts";

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
		proxyProviders: { Synthetic: { url: "https://example.com/subscribe?token=replace-me" } },
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
		proxyProviders: { Synthetic: { url: "https://example.com/subscribe?token=replace-me" } },
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
		proxyProviders: { Synthetic: { url: "https://example.com/subscribe?token=replace-me" } },
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
