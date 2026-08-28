export interface MihomoProfileSettings {
	"store-selected": boolean;
	"store-fake-ip": true;
}

/** Mihomo 下载 DAT 格式 GeoIP 与 GeoSite 数据时使用的公开地址。 */
export interface MihomoGeoxUrls {
	geoip: string;
	geosite: string;
}

export interface MihomoHealthCheck {
	enable: boolean;
	url: string;
	interval: number;
	timeout: number;
	lazy: boolean;
	"expected-status": number;
}

export interface MihomoHttpProxyProvider {
	type: "http";
	url: string;
	path: string;
	interval: number;
	"health-check": MihomoHealthCheck;
}

export type MihomoIpVersion = "dual" | "ipv4" | "ipv6" | "ipv4-prefer" | "ipv6-prefer";

export interface MihomoSocks5Proxy {
	name: string;
	type: "socks5";
	server: string;
	port: number;
	username?: string;
	password?: string;
	udp?: boolean;
	"ip-version"?: MihomoIpVersion;
	"dialer-proxy"?: string;
}

export interface MihomoSelectProxyGroup {
	name: string;
	type: "select";
	proxies?: string[];
	use?: string[];
}

/** Mihomo 内置 DNS 的防污染设置；解析器字符串可携带指定出站代理组。 */
export interface MihomoDnsSettings {
	enable: true;
	"use-hosts": true;
	"use-system-hosts": true;
	ipv6: boolean;
	"enhanced-mode": "fake-ip";
	"fake-ip-range": string;
	"fake-ip-filter": string[];
	"default-nameserver": string[];
	"nameserver-policy": Record<string, string[]>;
	nameserver: string[];
	"proxy-server-nameserver": string[];
	"direct-nameserver": string[];
	"direct-nameserver-follow-policy": boolean;
}

/** 当前配置和名称校验使用的 Mihomo 内置策略。 */
export enum MihomoBuiltInPolicy {
	Direct = "DIRECT",
	Reject = "REJECT",
	RejectDrop = "REJECT-DROP",
	Pass = "PASS",
	PassRule = "PASS-RULE",
	Compatible = "COMPATIBLE",
	Global = "GLOBAL",
}

/** Clash/Mihomo 规则的原生类型标识。 */
export enum MihomoRuleType {
	/** `DOMAIN,<完整域名>,<策略>`：精确匹配目标域名。 */
	Domain = "DOMAIN",
	/** `DOMAIN-SUFFIX,<域名后缀>,<策略>`：匹配主域名及其子域名。 */
	DomainSuffix = "DOMAIN-SUFFIX",
	/** `DOMAIN-KEYWORD,<关键词>,<策略>`：匹配包含指定字符串的域名。 */
	DomainKeyword = "DOMAIN-KEYWORD",
	/** `GEOSITE,<分类>,<策略>[,<额外条件>]`：按 GeoSite 域名数据库分类匹配。 */
	GeoSite = "GEOSITE",
	/** `IP-CIDR,<IPv4 网段>,<策略>[,no-resolve]`：按目标 IPv4 网段匹配。 */
	IpCidr = "IP-CIDR",
	/** `IP-CIDR6,<IPv6 网段>,<策略>[,no-resolve]`：按目标 IPv6 网段匹配。 */
	IpCidr6 = "IP-CIDR6",
	/** `GEOIP,<地区代码>,<策略>[,no-resolve]`：按目标 IP 所属国家或地区匹配。 */
	GeoIp = "GEOIP",
	/** `SRC-IP-CIDR,<来源网段>,<策略>`：按客户端来源 IP 网段匹配。 */
	SrcIpCidr = "SRC-IP-CIDR",
	/** `SRC-PORT,<来源端口>,<策略>`：按本地或客户端端口匹配。 */
	SrcPort = "SRC-PORT",
	/** `DST-PORT,<目标端口>,<策略>`：按服务器端口匹配。 */
	DstPort = "DST-PORT",
	/** `PROCESS-NAME,<进程名>,<策略>`：按应用程序的进程名称匹配。 */
	ProcessName = "PROCESS-NAME",
	/** `PROCESS-PATH,<可执行文件路径>,<策略>`：按应用程序的完整进程路径匹配。 */
	ProcessPath = "PROCESS-PATH",
	/** `RULE-SET,<规则集名称>,<策略>[,<额外参数>]`：引用外部或 Provider 规则集。 */
	RuleSet = "RULE-SET",
	/** `NETWORK,<tcp|udp>,<策略>`：按传输协议匹配。 */
	Network = "NETWORK",
	/** `MATCH,<策略>`：匹配所有剩余流量；由生成器自动追加为最后一条规则。 */
	Match = "MATCH",
}

/** Mihomo 配置文件使用的逗号分隔规则。 */
export type MihomoRule = string;

export interface MihomoConfig {
	"geodata-mode": true;
	"geox-url": MihomoGeoxUrls;
	"geo-auto-update": true;
	"geo-update-interval": number;
	mode: "rule";
	"log-level": "debug" | "info" | "warning" | "error" | "silent";
	ipv6: boolean;
	"tcp-concurrent": true;
	dns: MihomoDnsSettings;
	profile: MihomoProfileSettings;
	"proxy-providers": Record<string, MihomoHttpProxyProvider>;
	proxies: MihomoSocks5Proxy[];
	"proxy-groups": MihomoSelectProxyGroup[];
	rules: MihomoRule[];
}
