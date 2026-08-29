import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
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

type ResidentialForm = FormGroup<{
	name: FormControl<string>;
	server: FormControl<string>;
	port: FormControl<number | null>;
	username: FormControl<string>;
	password: FormControl<string>;
}>;

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

function uniqueNames(control: AbstractControl): ValidationErrors | null {
	const rows = control.value as Array<{ name?: unknown }>;
	const names = rows
		.map(({ name }) => name)
		.filter((name): name is string => typeof name === "string" && name !== "");
	return new Set(names).size === names.length ? null : { duplicateNames: true };
}

function createResidentialForm(): ResidentialForm {
	return new FormGroup({
		name: new FormControl("", { nonNullable: true, validators: [Validators.required, proxyName] }),
		server: new FormControl("", { nonNullable: true, validators: Validators.required }),
		port: new FormControl<number | null>(null, [
			Validators.required,
			Validators.min(1),
			Validators.max(65_535),
			Validators.pattern(/^\d+$/),
		]),
		username: new FormControl("", { nonNullable: true, validators: Validators.required }),
		password: new FormControl("", { nonNullable: true, validators: Validators.required }),
	});
}

@Component({
	selector: "app-root",
	imports: [ReactiveFormsModule],
	templateUrl: "./app.html",
	styleUrl: "./app.css",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
	protected readonly form = new FormGroup({
		airportUrl: new FormControl("", {
			nonNullable: true,
			validators: [Validators.required, httpUrl],
		}),
		residentials: new FormArray<ResidentialForm>([createResidentialForm()], uniqueNames),
	});
	protected readonly generationError = signal<string | null>(null);
	protected readonly downloadComplete = signal(false);

	protected get residentials(): FormArray<ResidentialForm> {
		return this.form.controls.residentials;
	}

	protected addResidential(): void {
		this.residentials.push(createResidentialForm());
		this.downloadComplete.set(false);
	}

	protected removeResidential(index: number): void {
		if (this.residentials.length > 1) {
			this.residentials.removeAt(index);
			this.downloadComplete.set(false);
		}
	}

	/** 在浏览器内生成并下载配置；表单中的凭据不会写入本地存储或发送到网络。 */
	protected downloadConfig(): void {
		this.generationError.set(null);
		this.downloadComplete.set(false);
		this.form.markAllAsTouched();
		if (this.form.invalid) {
			return;
		}

		const value = this.form.getRawValue();
		const residentials = Object.fromEntries(
			value.residentials.map(({ name, server, port, username, password }) => [
				name,
				{ server, port: port ?? 0, username, password },
			]),
		);

		try {
			const yaml = createMihomoYaml({ airportUrl: value.airportUrl, residentials });
			const url = URL.createObjectURL(new Blob([yaml], { type: "application/yaml;charset=utf-8" }));
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "clash-config.yaml";
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			this.downloadComplete.set(true);
		} catch (error) {
			this.generationError.set(error instanceof Error ? error.message : "配置生成失败，请检查输入。");
		}
	}
}
