import { MihomoBuiltInPolicy, MihomoRuleType } from "./mihomo-types.ts";

/** 一个具名住宅 SOCKS5 代理的端点和凭据。 */
export interface ResidentialProxyConfig {
	server: string;
	port: number;
	username: string;
	password: string;
}

/** 用于构建 Mihomo 配置的敏感代理 Provider 和住宅代理输入。 */
export interface ProxiesConfig {
	airportUrl: string;
	residentials: Record<string, ResidentialProxyConfig>;
}

export interface BuildOptions {
	proxiesConfigPath?: string;
	outputPath?: string;
}

/** 只能作为策略组成员使用、不能由路由规则直接选择的节点组。 */
export enum MihomoProxyNodeGroup {
	ProxyNodes = "代理节点",
	ResidentialNodes = "住宅节点",
}

/** 路由规则可以选择的用户可见策略组。 */
export enum MihomoProxyPolicyGroup {
	ProxyPolicy = "代理",
	RiskPolicy = "风控策略",
	AdPolicy = "广告拦截",
	FinalPolicy = "最终代理",
}

/** 按声明顺序构建的公开规则块；规则只能选择策略组或允许的内置策略，不能直接选择节点组。 */
export type MihomoRulesConfig = {
	remarks: string;
	group: Exclude<MihomoProxyPolicyGroup, MihomoProxyPolicyGroup.FinalPolicy> | MihomoBuiltInPolicy.Direct;
	rules: Partial<Record<Exclude<MihomoRuleType, MihomoRuleType.Match>, string[]>>;
};
