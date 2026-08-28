import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";

import { createMihomoConfig } from "./config.ts";
import {
	MihomoProxyNodeGroup,
	MihomoProxyPolicyGroup,
	type BuildOptions,
	type ProxiesConfig,
	type ResidentialProxyConfig,
} from "./config-types.ts";
import { MihomoBuiltInPolicy } from "./mihomo-types.ts";

export type { BuildOptions, ProxiesConfig } from "./config-types.ts";

interface CommandLineOptions {
	proxies?: string;
	output?: string;
	help?: boolean;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const defaultProxiesConfigPath = path.join(projectRoot, "data", "proxies.json");
const defaultOutputPath = path.join(projectRoot, "dist", "clash-config.yaml");
// Mihomo 按名称解析组成员；发生冲突时可能选中内置策略，而不是配置的住宅节点。
const reservedProxyNames = new Set<string>([
	...Object.values(MihomoProxyNodeGroup),
	...Object.values(MihomoProxyPolicyGroup),
	...Object.values(MihomoBuiltInPolicy),
]);

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function requiredString(config: Record<string, unknown>, name: string, label = name): string {
	const value = config[name];
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`Proxies config value must be a non-empty string: ${label}`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验具名住宅代理输入，且不在错误信息中泄露名称、端点或凭据。 */
function readResidentials(config: Record<string, unknown>): Record<string, ResidentialProxyConfig> {
	const value = config.residentials;
	if (!isRecord(value) || Object.keys(value).length === 0) {
		throw new Error("residentials must be a non-empty object of named residential proxy settings.");
	}
	return Object.fromEntries(
		Object.entries(value).map(([name, residential], index) => {
			const field = `residentials entry ${index + 1}`;
			if (name.trim() === "" || name !== name.trim()) {
				throw new Error(`${field} name must be a non-empty string without surrounding whitespace.`);
			}
			if (reservedProxyNames.has(name)) {
				throw new Error(`${field} name must not conflict with a proxy group or built-in policy name.`);
			}
			if (!isRecord(residential)) {
				throw new Error(`${field} must be an object.`);
			}

			const server = requiredString(residential, "server", `${field}.server`);
			const username = requiredString(residential, "username", `${field}.username`);
			const password = requiredString(residential, "password", `${field}.password`);
			const port = residential.port;
			if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535) {
				throw new Error(`${field}.port must be an integer from 1 through 65535.`);
			}

			return [name, { server, port: port as number, username, password }];
		}),
	);
}

/** 读取并校验敏感代理输入，且不在错误信息中包含其值。 */
export function readProxiesConfig(proxiesConfigPath: string): ProxiesConfig {
	if (!existsSync(proxiesConfigPath)) {
		throw new Error(
			[
				`Proxies config file not found: ${proxiesConfigPath}`,
				"Create data/proxies.json with the required proxy settings before building.",
			].join("\n"),
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(proxiesConfigPath, "utf8")) as unknown;
	} catch (error) {
		throw new Error(`Cannot parse proxies config JSON: ${errorMessage(error)}`);
	}

	if (!isRecord(parsed)) {
		throw new Error("Proxies config JSON must contain an object.");
	}
	const config = parsed;
	const airportUrl = requiredString(config, "airportUrl");

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
		residentials: readResidentials(config),
	};
}

export function buildConfig({
	proxiesConfigPath = defaultProxiesConfigPath,
	outputPath = defaultOutputPath,
}: BuildOptions = {}): string {
	const resolvedProxiesConfigPath = path.resolve(proxiesConfigPath);
	const resolvedOutputPath = path.resolve(outputPath);
	const proxiesConfig = readProxiesConfig(resolvedProxiesConfigPath);
	const config = createMihomoConfig(proxiesConfig);
	const rendered = `# 由 clash-config 生成，其中包含私有凭据。\n${stringify(config, { lineWidth: 0 })}`;

	mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
	writeFileSync(resolvedOutputPath, rendered, { encoding: "utf8", mode: 0o600 });
	return resolvedOutputPath;
}

function parseArguments(arguments_: string[]): CommandLineOptions {
	const options: CommandLineOptions = {};
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (argument === "--help" || argument === "-h") {
			options.help = true;
		} else if (argument === "--proxies" || argument === "--output") {
			const value = arguments_[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for ${argument}.`);
			}
			options[argument.slice(2) as "proxies" | "output"] = path.resolve(process.cwd(), value);
			index += 1;
		} else if (argument.startsWith("--proxies=")) {
			options.proxies = path.resolve(process.cwd(), argument.slice("--proxies=".length));
		} else if (argument.startsWith("--output=")) {
			options.output = path.resolve(process.cwd(), argument.slice("--output=".length));
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	return options;
}

function printHelp(): void {
	console.log(`Usage: npm run build -- [options]

Options:
  --proxies <path>  Proxies JSON file (default: data/proxies.json)
  --output <path>   Generated YAML file (default: dist/clash-config.yaml)
  --help            Show this help`);
}

function main(): void {
	const options = parseArguments(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const outputPath = buildConfig({
		proxiesConfigPath: options.proxies ?? defaultProxiesConfigPath,
		outputPath: options.output ?? defaultOutputPath,
	});
	console.log(`Generated: ${outputPath}`);
	console.warn("This file contains private credentials. Do not commit or share it.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(`Build failed: ${errorMessage(error)}`);
		process.exitCode = 1;
	}
}
