import {
	MihomoProxyGroup,
	MihomoRuleType,
	mihomoProxyGroupNames,
	type MihomoConfig,
	type MihomoRule,
	type MihomoRulesConfig,
	type ProxiesConfig,
} from "./mihomo-types.ts";

/** 按既定业务优先级声明公开路由规则块；块和块内规则类型顺序共同决定匹配优先级。 */
export const rulesConfigs: MihomoRulesConfig[] = [
	// 广告分类优先于后续业务出口；误拦例外必须作为独立规则块声明在此块之前。
	{
		remarks: "广告拦截",
		group: MihomoProxyGroup.AdBlocking,
		rules: { [MihomoRuleType.GeoSite]: ["category-ads-all"] },
	},
	{
		remarks: "静态住宅IP ChatGPT",
		group: MihomoProxyGroup.Residential,
		rules: {
			[MihomoRuleType.DomainSuffix]: ["chatgpt.com", "openai.com", "oaistatic.com"],
		},
	},
	{
		remarks: "静态住宅IP Claude",
		group: MihomoProxyGroup.Residential,
		rules: {
			[MihomoRuleType.DomainSuffix]: ["claude.ai", "anthropic.com"],
		},
	},
	{
		remarks: "代理 api.ip.sb",
		group: MihomoProxyGroup.Proxy,
		rules: { [MihomoRuleType.Domain]: ["api.ip.sb"] },
	},
	{
		remarks: "代理 Google",
		group: MihomoProxyGroup.Proxy,
		rules: { [MihomoRuleType.GeoSite]: ["google"] },
	},
	{
		remarks: "绕过 中国公共 DNS 域名",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.DomainSuffix]: ["alidns.com", "doh.pub", "dot.pub", "360.cn", "onedns.net"],
		},
	},
	{
		remarks: "代理 海外公共 DNS 域名",
		group: MihomoProxyGroup.Proxy,
		rules: {
			[MihomoRuleType.DomainSuffix]: [
				"cloudflare-dns.com",
				"one.one.one.one",
				"dns.google",
				"adguard-dns.com",
				"opendns.com",
				"umbrella.com",
				"quad9.net",
				"yandex.net",
			],
		},
	},
	{
		remarks: "绕过 局域网 域名",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.GeoSite]: ["private"],
		},
	},
	{
		remarks: "绕过 国内游戏平台下载",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.GeoSite]: ["category-game-platforms-download@cn"],
			// 仅补充名称和用途明确指向 Steam 下载、但上游专项分类尚未收录的国内 CDN。
			[MihomoRuleType.Domain]: [
				"dl.steam.ksyna.com",
				"st.dl.pinyuncloud.com",
				"steampipe.steamcontent.tnkjmec.com",
			],
		},
	},
	// Loyalsoldier 的 apple-cn 是 apple 的直连子集，必须先匹配以免被宽泛分类覆盖。
	{
		remarks: "绕过 Apple-CN",
		group: MihomoProxyGroup.Direct,
		rules: { [MihomoRuleType.GeoSite]: ["apple-cn"] },
	},
	{
		remarks: "代理 Apple",
		group: MihomoProxyGroup.Proxy,
		rules: { [MihomoRuleType.GeoSite]: ["apple"] },
	},
	// GFW 分类有意覆盖宽泛的中国域名分类。
	{
		remarks: "代理 GFW",
		group: MihomoProxyGroup.Proxy,
		rules: { [MihomoRuleType.GeoSite]: ["gfw", "greatfire"] },
	},
	{
		remarks: "绕过 中国 域名",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.GeoSite]: ["cn"],
		},
	},
	// 域名策略优先；以下明确目标 IP 规则不主动触发解析。
	{
		remarks: "绕过 中国公共 DNS IP",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.NoResolveIpCidr]: [
				"223.5.5.5/32",
				"223.6.6.6/32",
				"119.29.29.29/32",
				"1.12.12.12/32",
				"120.53.53.53/32",
				"180.76.76.76/32",
				"114.114.114.114/32",
				"114.114.115.115/32",
				"114.114.114.119/32",
				"114.114.115.119/32",
				"114.114.114.110/32",
				"114.114.115.110/32",
				"180.184.1.1/32",
				"180.184.2.2/32",
				"101.226.4.6/32",
				"218.30.118.6/32",
				"123.125.81.6/32",
				"140.207.198.6/32",
				"1.2.4.8/32",
				"210.2.4.8/32",
				"52.80.66.66/32",
				"117.50.22.22/32",
				"117.50.10.10/32",
				"52.80.52.52/32",
				"117.50.60.30/32",
				"52.80.60.30/32",
			],
			[MihomoRuleType.NoResolveIpCidr6]: [
				"2400:3200::1/128",
				"2400:3200:baba::1/128",
				"2402:4e00::/128",
				"2402:4e00:1::/128",
				"2400:da00::6666/128",
				"2400:7fc0:849e:200::4/128",
				"2404:c2c0:85d8:901::4/128",
				"2400:7fc0:849e:200::8/128",
				"2404:c2c0:85d8:901::8/128",
			],
		},
	},
	{
		remarks: "代理 海外公共 DNS IP",
		group: MihomoProxyGroup.Proxy,
		rules: {
			[MihomoRuleType.NoResolveIpCidr]: [
				"1.1.1.1/32",
				"1.0.0.1/32",
				"1.1.1.2/32",
				"1.0.0.2/32",
				"1.1.1.3/32",
				"1.0.0.3/32",
				"8.8.8.8/32",
				"8.8.4.4/32",
				"94.140.14.14/32",
				"94.140.15.15/32",
				"94.140.14.15/32",
				"94.140.15.16/32",
				"94.140.14.140/32",
				"94.140.14.141/32",
				"208.67.222.222/32",
				"208.67.220.220/32",
				"208.67.222.123/32",
				"208.67.220.123/32",
				"9.9.9.9/32",
				"149.112.112.112/32",
				"9.9.9.11/32",
				"149.112.112.11/32",
				"9.9.9.10/32",
				"149.112.112.10/32",
				"77.88.8.8/32",
				"77.88.8.1/32",
				"77.88.8.88/32",
				"77.88.8.2/32",
				"77.88.8.7/32",
				"77.88.8.3/32",
			],
			[MihomoRuleType.NoResolveIpCidr6]: [
				"2606:4700:4700::1111/128",
				"2606:4700:4700::1001/128",
				"2606:4700:4700::1112/128",
				"2606:4700:4700::1002/128",
				"2606:4700:4700::1113/128",
				"2606:4700:4700::1003/128",
				"2001:4860:4860::8888/128",
				"2001:4860:4860::8844/128",
				"2a10:50c0::ad1:ff/128",
				"2a10:50c0::ad2:ff/128",
				"2a10:50c0::bad1:ff/128",
				"2a10:50c0::bad2:ff/128",
				"2a10:50c0::1:ff/128",
				"2a10:50c0::2:ff/128",
				"2620:119:35::35/128",
				"2620:119:53::53/128",
				"2620:119:35::123/128",
				"2620:119:53::123/128",
				"2620:fe::9/128",
				"2620:fe::fe/128",
				"2620:fe::11/128",
				"2620:fe::fe:11/128",
				"2620:fe::10/128",
				"2620:fe::fe:10/128",
				"2a02:6b8::feed:0ff/128",
				"2a02:6b8:0:1::feed:0ff/128",
				"2a02:6b8::feed:bad/128",
				"2a02:6b8:0:1::feed:bad/128",
				"2a02:6b8::feed:a11/128",
				"2a02:6b8:0:1::feed:a11/128",
			],
		},
	},
	// 此规则有意不加 no-resolve，以便尚无目标 IP 时主动解析；已有目标 IP 时直接分类。
	// 系统 hosts 可以提供目标 IP，但具体解析器选择仍由 DNS 配置决定。
	{
		remarks: "绕过 局域网 IP",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.GeoIp]: ["private"],
		},
	},
	// 服务 IP 分类有意覆盖宽泛的中国 IP 分类。
	{
		remarks: "代理 海外服务 IP",
		group: MihomoProxyGroup.Proxy,
		rules: {
			[MihomoRuleType.GeoIp]: ["facebook", "fastly", "google", "netflix", "telegram", "twitter"],
		},
	},
	{
		remarks: "绕过 中国 IP",
		group: MihomoProxyGroup.Direct,
		rules: {
			[MihomoRuleType.GeoIp]: ["cn"],
		},
	},
];

/** 按规则块与块内规则的声明顺序展开所有规则，再追加最终 MATCH。 */
export function createMihomoRules(configs: MihomoRulesConfig[]): MihomoRule[] {
	return [
		...configs.flatMap(({ group, rules }) =>
			Object.entries(rules).flatMap(([configuredType, values]) =>
				values.map((value) => {
					const [type, ...parameters] = configuredType.split(",");
					return [type, value, mihomoProxyGroupNames[group], ...parameters].join(",");
				}),
			),
		),
		`${MihomoRuleType.Match},${mihomoProxyGroupNames[MihomoProxyGroup.Fallback]}`,
	];
}

export function createMihomoConfig(proxiesConfig: ProxiesConfig): MihomoConfig {
	const residentialNames = Object.keys(proxiesConfig.residentials);
	const domesticDns = "https://dns.alidns.com/dns-query";

	return {
		"geodata-mode": true,
		"geox-url": {
			geoip: "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
			geosite: "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
		},
		"geo-auto-update": true,
		"geo-update-interval": 24,
		mode: "rule",
		"log-level": "info",
		ipv6: true,
		"tcp-concurrent": true,
		dns: {
			enable: true,
			"use-hosts": true,
			"use-system-hosts": true,
			ipv6: true,
			"enhanced-mode": "fake-ip",
			"fake-ip-range": "198.18.0.1/16",
			"fake-ip-filter": ["geosite:private", "+.msftncsi.com", "www.msftconnecttest.com", "+.market.xiaomi.com"],
			// 明文 DNS 只用于加密解析器的引导；错误地址仍无法通过后续 TLS 校验。
			"default-nameserver": ["223.5.5.5", "119.29.29.29"],
			"nameserver-policy": {
				"geosite:private": ["system"],
				"geosite:cn": [domesticDns],
			},
			// 显式指定代理组，避免海外 DoH 连接绕过路由规则而直接发出。
			nameserver: [
				`https://1.1.1.1/dns-query#${mihomoProxyGroupNames[MihomoProxyGroup.Proxy]}`,
				`https://8.8.8.8/dns-query#${mihomoProxyGroupNames[MihomoProxyGroup.Proxy]}`,
			],
			// 独立的节点解析器用于打破“先连接代理才能解析代理节点”的循环依赖。
			"proxy-server-nameserver": [domesticDns, "https://doh.pub/dns-query"],
			"direct-nameserver": [domesticDns],
			"direct-nameserver-follow-policy": true,
		},
		profile: {
			"store-selected": true,
			"store-fake-ip": true,
		},
		"proxy-providers": {
			airport: {
				type: "http",
				url: proxiesConfig.airportUrl,
				path: "./proxy_providers/airport.yaml",
				interval: 3600,
				"health-check": {
					enable: true,
					url: "https://www.gstatic.com/generate_204",
					interval: 300,
					timeout: 5000,
					lazy: true,
					"expected-status": 204,
				},
			},
		},
		proxies: Object.entries(proxiesConfig.residentials).map(([name, residential]) => ({
			name,
			type: "socks5",
			server: residential.server,
			port: residential.port,
			username: residential.username,
			password: residential.password,
			udp: true,
			"ip-version": "ipv4",
			"dialer-proxy": mihomoProxyGroupNames[MihomoProxyGroup.Proxy],
		})),
		"proxy-groups": [
			{
				name: mihomoProxyGroupNames[MihomoProxyGroup.Proxy],
				type: "select",
				use: ["airport"],
			},
			{
				name: mihomoProxyGroupNames[MihomoProxyGroup.Residential],
				type: "select",
				proxies: residentialNames,
			},
			{
				name: mihomoProxyGroupNames[MihomoProxyGroup.AdBlocking],
				type: "select",
				proxies: ["REJECT", "PASS"],
			},
			{
				name: mihomoProxyGroupNames[MihomoProxyGroup.Fallback],
				type: "select",
				proxies: [
					mihomoProxyGroupNames[MihomoProxyGroup.Proxy],
					mihomoProxyGroupNames[MihomoProxyGroup.Residential],
					mihomoProxyGroupNames[MihomoProxyGroup.Direct],
				],
			},
		],
		rules: createMihomoRules(rulesConfigs),
	};
}
