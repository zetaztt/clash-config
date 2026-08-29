import {
	MihomoProxyNodeGroup,
	MihomoProxyPolicyGroup,
	type ProxiesConfig,
	type ResidentialProxyConfig,
} from "./config-types";
import { MihomoBuiltInPolicy } from "./mihomo-types";

// Mihomo 按名称解析组成员；发生冲突时可能选中内置策略，而不是配置的住宅节点。
const reservedProxyNames = new Set<string>([
	...Object.values(MihomoProxyNodeGroup),
	...Object.values(MihomoProxyPolicyGroup),
	...Object.values(MihomoBuiltInPolicy),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(config: Record<string, unknown>, name: string, label = name): string {
	const value = config[name];
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`Proxy setting must be a non-empty string: ${label}.`);
	}
	return value;
}

/** 判断名称是否会与 Mihomo 代理组或内置策略发生解析冲突。 */
export function isReservedProxyName(name: string): boolean {
	return reservedProxyNames.has(name);
}

/** 校验具名住宅代理输入，且不在错误信息中泄露名称、端点或凭据。 */
function validateResidentials(value: unknown): Record<string, ResidentialProxyConfig> {
	if (!isRecord(value) || Object.keys(value).length === 0) {
		throw new Error("residentials must contain at least one named residential proxy.");
	}

	return Object.fromEntries(
		Object.entries(value).map(([name, residential], index) => {
			const field = `residentials entry ${index + 1}`;
			if (name.trim() === "" || name !== name.trim()) {
				throw new Error(`${field} name must be non-empty and have no surrounding whitespace.`);
			}
			if (isReservedProxyName(name)) {
				throw new Error(`${field} name must not conflict with a proxy group or built-in policy name.`);
			}
			if (!isRecord(residential)) {
				throw new Error(`${field} must be an object.`);
			}

			const server = requiredString(residential, "server", `${field}.server`);
			const username = requiredString(residential, "username", `${field}.username`);
			const password = requiredString(residential, "password", `${field}.password`);
			const port = residential["port"];
			if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535) {
				throw new Error(`${field}.port must be an integer from 1 through 65535.`);
			}

			return [name, { server, port: port as number, username, password }];
		}),
	);
}

/**
 * 在生成包含凭据的配置前校验网页输入；错误只报告字段位置和结构，不回显敏感值。
 */
export function validateProxiesConfig(value: unknown): ProxiesConfig {
	if (!isRecord(value)) {
		throw new Error("Proxy settings must be an object.");
	}

	const airportUrl = requiredString(value, "airportUrl");
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(airportUrl);
	} catch {
		throw new Error("airportUrl must be an absolute HTTP or HTTPS URL.");
	}
	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		throw new Error("airportUrl must be an absolute HTTP or HTTPS URL.");
	}

	return {
		airportUrl,
		residentials: validateResidentials(value["residentials"]),
	};
}
