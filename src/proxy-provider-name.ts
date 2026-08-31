function unquoteHeaderValue(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1).replace(/\\(["\\])/g, "$1");
	}
	return trimmed;
}

function decodeExtendedFilename(value: string): string | null {
	const unquoted = unquoteHeaderValue(value);
	const match = /^[^']*'[^']*'(.*)$/.exec(unquoted);
	if (match === null) {
		return null;
	}
	try {
		return decodeURIComponent(match[1] ?? "");
	} catch {
		return null;
	}
}

/**
 * 按 Clash Verge 的优先级读取 Content-Disposition：先 filename*，再 filename。
 * 返回值仅用于表单名称，不参与本地 Provider 缓存路径构造。
 */
export function parseProxyProviderName(contentDisposition: string | null): string | null {
	if (contentDisposition === null) {
		return null;
	}

	const extendedMatch = /(?:^|;)\s*filename\*\s*=\s*("(?:\\.|[^"])*"|[^;]*)/i.exec(contentDisposition);
	const extended = extendedMatch === null ? null : decodeExtendedFilename(extendedMatch[1] ?? "");
	if (extended !== null && extended.trim() !== "") {
		return extended.trim();
	}

	const basicMatch = /(?:^|;)\s*filename\s*=\s*("(?:\\.|[^"])*"|[^;]*)/i.exec(contentDisposition);
	if (basicMatch === null) {
		return null;
	}
	const basic = unquoteHeaderValue(basicMatch[1] ?? "").trim();
	return basic === "" ? null : basic;
}

/**
 * 请求订阅响应头并尽快取消正文读取。浏览器不会允许覆盖 User-Agent，且跨域服务必须通过
 * CORS 暴露 Content-Disposition；失败时调用方应允许用户手动填写名称。
 */
export async function fetchProxyProviderName(url: string): Promise<string> {
	const response = await fetch(url, {
		method: "GET",
		credentials: "omit",
		cache: "no-store",
		referrerPolicy: "no-referrer",
	});
	try {
		if (!response.ok) {
			throw new Error("Subscription request failed.");
		}
		const name = parseProxyProviderName(response.headers.get("Content-Disposition"));
		if (name === null) {
			throw new Error("Subscription name header unavailable.");
		}
		return name;
	} finally {
		await response.body?.cancel().catch(() => undefined);
	}
}
