import { stringify } from "yaml";

import { createMihomoConfig } from "./config";
import { validateProxiesConfig } from "./proxies-config";

/** 校验网页输入并在内存中序列化配置，不读取本地文件或持久化凭据。 */
export function createMihomoYaml(value: unknown): string {
	const proxiesConfig = validateProxiesConfig(value);
	return `# 由 clash-config 网页生成，其中包含私有凭据。\n${stringify(createMihomoConfig(proxiesConfig), {
		lineWidth: 0,
	})}`;
}
