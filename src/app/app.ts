import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
	AbstractControl,
	FormArray,
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	Validators,
	type ValidationErrors,
} from "@angular/forms";

import { createMihomoYaml } from "../config-yaml";
import { isReservedProxyName } from "../proxies-config";

type ProxyProviderForm = FormGroup<{
	name: FormControl<string>;
	url: FormControl<string>;
}>;

interface ProxyProviderFormValue {
	name: string;
	url: string;
}

type ResidentialForm = FormGroup<{
	name: FormControl<string>;
	server: FormControl<string>;
	port: FormControl<number | null>;
	username: FormControl<string>;
	password: FormControl<string>;
}>;

interface ResidentialFormValue {
	name: string;
	server: string;
	port: number | null;
	username: string;
	password: string;
}

interface StoredProxySettings {
	version: 2;
	proxyProviders: ProxyProviderFormValue[];
	residentials: ResidentialFormValue[];
}

interface ProxySummary {
	proxyProviders: Array<{ name: string; host: string }>;
	residentials: Array<Pick<ResidentialFormValue, "name" | "server">>;
}

// 版本化键名让未来的表单结构可以安全迁移，而不会误读已持久化的凭据。
const proxySettingsStorageKey = "clash-config:proxy-settings:v2";
const legacyProxySettingsStorageKey = "clash-config:proxy-settings:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredProxySettings(serialized: string): StoredProxySettings | null {
	try {
		const value: unknown = JSON.parse(serialized);
		if (!isRecord(value) || value["version"] !== 2) {
			return null;
		}
		const proxyProviders = value["proxyProviders"];
		if (!Array.isArray(proxyProviders) || proxyProviders.length > 100) {
			return null;
		}
		const parsedProxyProviders = proxyProviders.map((provider): ProxyProviderFormValue | null => {
			if (!isRecord(provider) || typeof provider["name"] !== "string" || typeof provider["url"] !== "string") {
				return null;
			}
			return { name: provider["name"], url: provider["url"] };
		});
		if (parsedProxyProviders.some((provider) => provider === null)) {
			return null;
		}

		const residentials = value["residentials"];
		if (!Array.isArray(residentials) || residentials.length > 100) {
			return null;
		}

		const parsedResidentials = residentials.map((residential): ResidentialFormValue | null => {
			if (!isRecord(residential)) {
				return null;
			}

			const { name, server, port, username, password } = residential;
			if (
				typeof name !== "string"
				|| typeof server !== "string"
				|| (port !== null && (typeof port !== "number" || !Number.isFinite(port)))
				|| typeof username !== "string"
				|| typeof password !== "string"
			) {
				return null;
			}

			return { name, server, port, username, password };
		});
		if (parsedResidentials.some((residential) => residential === null)) {
			return null;
		}

		return {
			version: 2,
			proxyProviders: parsedProxyProviders as ProxyProviderFormValue[],
			residentials: parsedResidentials as ResidentialFormValue[],
		};
	} catch {
		return null;
	}
}

function parseLegacyStoredProxySettings(serialized: string): StoredProxySettings | null {
	try {
		const value: unknown = JSON.parse(serialized);
		if (!isRecord(value) || value["version"] !== 1 || typeof value["airportUrl"] !== "string") {
			return null;
		}
		return parseStoredProxySettings(
			JSON.stringify({
				version: 2,
				proxyProviders: [{ name: "airport", url: value["airportUrl"] }],
				residentials: value["residentials"],
			}),
		);
	} catch {
		return null;
	}
}

function httpUrl(control: AbstractControl<string>): ValidationErrors | null {
	if (control.value !== control.value.trim()) {
		return { httpUrl: true };
	}
	try {
		const url = new URL(control.value);
		return ["http:", "https:"].includes(url.protocol) ? null : { httpUrl: true };
	} catch {
		return { httpUrl: true };
	}
}

function proxyName(control: AbstractControl<string>): ValidationErrors | null {
	const value = control.value;
	if (value !== value.trim()) {
		return { whitespace: true };
	}
	return isReservedProxyName(value) ? { reserved: true } : null;
}

function providerName(control: AbstractControl<string>): ValidationErrors | null {
	return control.value === control.value.trim() ? null : { whitespace: true };
}

function uniqueNames(control: AbstractControl): ValidationErrors | null {
	const rows = control.value as Array<{ name?: unknown }>;
	const names = rows
		.map(({ name }) => name)
		.filter((name): name is string => typeof name === "string" && name !== "");
	return new Set(names).size === names.length ? null : { duplicateNames: true };
}

function createProxyProviderForm(value?: ProxyProviderFormValue): ProxyProviderForm {
	return new FormGroup({
		name: new FormControl(value?.name ?? "", {
			nonNullable: true,
			validators: [Validators.required, providerName],
		}),
		url: new FormControl(value?.url ?? "", {
			nonNullable: true,
			validators: [Validators.required, httpUrl],
		}),
	});
}

function createResidentialForm(value?: ResidentialFormValue): ResidentialForm {
	return new FormGroup({
		name: new FormControl(value?.name ?? "", {
			nonNullable: true,
			validators: [Validators.required, proxyName],
		}),
		server: new FormControl(value?.server ?? "", {
			nonNullable: true,
			validators: Validators.required,
		}),
		port: new FormControl<number | null>(value?.port ?? null, [
			Validators.required,
			Validators.min(1),
			Validators.max(65_535),
			Validators.pattern(/^\d+$/),
		]),
		username: new FormControl(value?.username ?? "", {
			nonNullable: true,
			validators: Validators.required,
		}),
		password: new FormControl(value?.password ?? "", {
			nonNullable: true,
			validators: Validators.required,
		}),
	});
}

/** 将 Clash 风格的 SOCKS5 链接转换为当前住宅节点所需的字段，不接受本配置无法生成的代理类型。 */
function parseResidentialProxyLink(value: string): ResidentialFormValue {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error("链接格式无效，请使用 socks5://用户名:密码@服务器:端口#名称。");
	}

	if (!["socks5:", "socks:"].includes(url.protocol)) {
		throw new Error("当前仅支持 SOCKS5 链接。");
	}
	if (url.hostname === "" || url.port === "" || url.username === "" || url.password === "" || url.hash === "") {
		throw new Error("链接必须包含用户名、密码、服务器、端口和名称。");
	}
	if (!["", "/"].includes(url.pathname) || url.search !== "") {
		throw new Error("链接不能包含额外路径或查询参数。");
	}

	const port = Number(url.port);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error("链接端口必须是 1–65535 的整数。");
	}

	try {
		return {
			name: decodeURIComponent(url.hash.slice(1)),
			server: url.hostname,
			port,
			username: decodeURIComponent(url.username),
			password: decodeURIComponent(url.password),
		};
	} catch {
		throw new Error("链接中的编码无效。");
	}
}

/** 摘要避免展示订阅令牌、用户名和密码，只保留主页所需的基本信息。 */
function createProxySummary(value: {
	proxyProviders: ProxyProviderFormValue[];
	residentials: ResidentialFormValue[];
}): ProxySummary {
	return {
		proxyProviders: value.proxyProviders.map(({ name, url }) => {
			let host = "地址待校验";
			try {
				const parsedUrl = new URL(url);
				if (["http:", "https:"].includes(parsedUrl.protocol)) {
					host = parsedUrl.host;
				}
			} catch {
				if (url === "") {
					host = "地址待填写";
				}
			}
			return { name, host };
		}),
		residentials: value.residentials.map(({ name, server }) => ({ name, server })),
	};
}

@Component({
	selector: "app-root",
	imports: [ReactiveFormsModule],
	templateUrl: "./app.html",
	styleUrl: "./app.css",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
	private readonly destroyRef = inject(DestroyRef);
	private suppressAutoSave = false;
	protected readonly form = new FormGroup({
		proxyProviders: new FormArray<ProxyProviderForm>([], [uniqueNames]),
		residentials: new FormArray<ResidentialForm>([], [uniqueNames]),
	});
	protected readonly generationError = signal<string | null>(null);
	protected readonly downloadComplete = signal(false);
	protected readonly copyComplete = signal(false);
	protected readonly proxyLinkError = signal<string | null>(null);
	protected readonly autoSaveError = signal(false);
	protected readonly activeDialog = signal<"subscription" | "residential" | null>(null);
	protected readonly editingResidentialIndex = signal<number | null>(null);
	protected readonly summary = signal<ProxySummary>(createProxySummary(this.form.getRawValue()));

	constructor() {
		this.restoreSavedSettings();
		this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
			this.downloadComplete.set(false);
			this.copyComplete.set(false);
			this.updateSummary();
			this.saveSettings();
		});
	}

	protected get residentials(): FormArray<ResidentialForm> {
		return this.form.controls.residentials;
	}

	protected get proxyProviders(): FormArray<ProxyProviderForm> {
		return this.form.controls.proxyProviders;
	}

	protected addProxyProvider(): void {
		this.proxyProviders.push(createProxyProviderForm());
		this.openSubscriptionEditor();
	}

	protected removeProxyProvider(index: number): void {
		if (index >= 0 && index < this.proxyProviders.length) {
			this.proxyProviders.removeAt(index);
		}
	}

	protected addResidential(): void {
		this.residentials.push(createResidentialForm());
		this.downloadComplete.set(false);
		this.copyComplete.set(false);
		this.openResidentialEditor(this.residentials.length - 1);
	}

	protected removeResidential(index: number): void {
		if (this.residentials.length > 0) {
			this.residentials.removeAt(index);
			this.downloadComplete.set(false);
			this.copyComplete.set(false);
			this.closeDialog();
		}
	}

	protected openSubscriptionEditor(): void {
		this.editingResidentialIndex.set(null);
		this.activeDialog.set("subscription");
	}

	protected openResidentialEditor(index: number): void {
		if (index < 0 || index >= this.residentials.length) {
			return;
		}
		this.editingResidentialIndex.set(index);
		this.proxyLinkError.set(null);
		this.activeDialog.set("residential");
	}

	protected closeDialog(): void {
		this.activeDialog.set(null);
		this.editingResidentialIndex.set(null);
		this.proxyLinkError.set(null);
	}

	protected get editingResidential(): ResidentialForm | null {
		const index = this.editingResidentialIndex();
		return index === null ? null : (this.residentials.at(index) ?? null);
	}

	/** 链接只用于当前弹窗填充表单，不写入浏览器持久化存储。 */
	protected importResidentialProxyLink(link: string): void {
		const residential = this.editingResidential;
		if (residential === null) {
			return;
		}

		try {
			residential.patchValue(parseResidentialProxyLink(link));
			this.proxyLinkError.set(null);
		} catch (error) {
			this.proxyLinkError.set(error instanceof Error ? error.message : "链接解析失败，请检查格式。");
		}
	}

	/** 同时清空当前表单和持久化副本，避免下一次值变更立即重新写入旧凭据。 */
	protected clearSavedSettings(): void {
		this.suppressAutoSave = true;
		this.proxyProviders.clear({ emitEvent: false });
		this.residentials.clear({ emitEvent: false });
		this.form.markAsUntouched();
		this.suppressAutoSave = false;
		this.generationError.set(null);
		this.downloadComplete.set(false);
		this.copyComplete.set(false);
		this.autoSaveError.set(false);
		this.updateSummary();
		try {
			localStorage.removeItem(proxySettingsStorageKey);
			localStorage.removeItem(legacyProxySettingsStorageKey);
		} catch {
			this.autoSaveError.set(true);
		}
	}

	private restoreSavedSettings(): void {
		try {
			const currentSerialized = localStorage.getItem(proxySettingsStorageKey);
			const legacySerialized = localStorage.getItem(legacyProxySettingsStorageKey);
			if (currentSerialized === null && legacySerialized === null) {
				return;
			}

			const settings =
				currentSerialized === null
					? parseLegacyStoredProxySettings(legacySerialized as string)
					: parseStoredProxySettings(currentSerialized);
			if (settings === null) {
				localStorage.removeItem(proxySettingsStorageKey);
				localStorage.removeItem(legacyProxySettingsStorageKey);
				return;
			}

			this.suppressAutoSave = true;
			this.proxyProviders.clear({ emitEvent: false });
			for (const provider of settings.proxyProviders) {
				this.proxyProviders.push(createProxyProviderForm(provider), { emitEvent: false });
			}
			this.residentials.clear({ emitEvent: false });
			for (const residential of settings.residentials) {
				this.residentials.push(createResidentialForm(residential), { emitEvent: false });
			}
			this.suppressAutoSave = false;
			this.updateSummary();
			if (currentSerialized === null) {
				this.saveSettings();
				localStorage.removeItem(legacyProxySettingsStorageKey);
			}
		} catch {
			this.suppressAutoSave = false;
			this.autoSaveError.set(true);
		}
	}

	/** 凭据按用户要求明文保存在当前站点的浏览器存储中，绝不进入日志或错误消息。 */
	private saveSettings(): void {
		if (this.suppressAutoSave) {
			return;
		}

		const settings: StoredProxySettings = {
			version: 2,
			...this.form.getRawValue(),
		};
		try {
			localStorage.setItem(proxySettingsStorageKey, JSON.stringify(settings));
			this.autoSaveError.set(false);
		} catch {
			this.autoSaveError.set(true);
		}
	}

	private updateSummary(): void {
		this.summary.set(createProxySummary(this.form.getRawValue()));
	}

	/** 校验并生成仅在当前浏览器内使用的 YAML，失败时定位到需要修正的独立编辑窗口。 */
	private createOutputYaml(): string | null {
		this.generationError.set(null);
		this.downloadComplete.set(false);
		this.copyComplete.set(false);
		this.form.markAllAsTouched();
		if (this.form.invalid) {
			if (this.proxyProviders.invalid) {
				this.openSubscriptionEditor();
			} else {
				const invalidIndex = this.residentials.controls.findIndex((residential) => residential.invalid);
				this.openResidentialEditor(Math.max(invalidIndex, 0));
			}
			return null;
		}

		const value = this.form.getRawValue();
		const proxyProviders = Object.fromEntries(value.proxyProviders.map(({ name, url }) => [name, { url }]));
		const residentials = Object.fromEntries(
			value.residentials.map(({ name, server, port, username, password }) => [
				name,
				{ server, port: port ?? 0, username, password },
			]),
		);

		try {
			return createMihomoYaml({ proxyProviders, residentials });
		} catch (error) {
			this.generationError.set(error instanceof Error ? error.message : "配置生成失败，请检查输入。");
			return null;
		}
	}

	/** 在浏览器内生成并下载配置；表单凭据不会发送到网络。 */
	protected downloadConfig(): void {
		const yaml = this.createOutputYaml();
		if (yaml === null) {
			return;
		}

		try {
			const url = URL.createObjectURL(new Blob([yaml], { type: "application/yaml;charset=utf-8" }));
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "clash-config.yaml";
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			this.downloadComplete.set(true);
			this.closeDialog();
		} catch (error) {
			this.generationError.set(error instanceof Error ? error.message : "配置生成失败，请检查输入。");
		}
	}

	/** 使用系统剪切板 API 复制完整 YAML；内容仍只在本机浏览器和系统剪切板内流转。 */
	protected async copyConfig(): Promise<void> {
		const yaml = this.createOutputYaml();
		if (yaml === null) {
			return;
		}

		try {
			if (!("clipboard" in navigator) || navigator.clipboard === undefined) {
				throw new Error("Clipboard API unavailable");
			}
			await navigator.clipboard.writeText(yaml);
			this.copyComplete.set(true);
		} catch {
			this.generationError.set("无法复制到剪切板，请检查浏览器权限后重试。");
		}
	}
}
