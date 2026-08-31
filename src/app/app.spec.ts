import { TestBed } from "@angular/core/testing";

import { App } from "./app";

function fillInput(element: HTMLElement, selector: string, value: string): void {
	const input = element.querySelector<HTMLInputElement>(selector);
	if (!input) {
		throw new Error(`Missing test input: ${selector}`);
	}
	input.value = value;
	input.dispatchEvent(new Event("input"));
}

describe("App", () => {
	beforeEach(async () => {
		localStorage.clear();
		await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("shows basic information and separate edit entries on the home page", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		expect(element.querySelector<HTMLInputElement>("#provider-url-0")).toBeNull();
		expect(element.querySelectorAll(".summary-edit-button")).toHaveLength(3);
		expect(element.textContent).toContain("0 个 Provider");
		expect(element.textContent).toContain("0 个节点");
	});

	it("opens an individual subscription editor", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		element.querySelector<HTMLButtonElement>(".overview-section .summary-edit-button")?.click();
		await fixture.whenStable();

		expect(element.querySelector(".subscription-modal")).not.toBeNull();
		expect(element.querySelector(".residential-modal")).toBeNull();
	});

	it("adds multiple providers with manually entered names", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		element.querySelectorAll<HTMLButtonElement>(".summary-buttons .summary-edit-button")[1]?.click();
		await fixture.whenStable();
		fillInput(element, "#provider-name-0", "Synthetic Airport");
		fillInput(element, "#provider-url-0", "https://example.com/subscription?token=synthetic");
		expect(element.querySelector<HTMLInputElement>("#provider-name-0")?.value).toBe("Synthetic Airport");

		element.querySelector<HTMLButtonElement>(".add-button")?.click();
		await fixture.whenStable();
		expect(element.querySelectorAll(".provider-card")).toHaveLength(2);
	});

	it("opens an individual node editor and adds a node directly into its editor", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		element.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await fixture.whenStable();

		expect(element.querySelector(".residential-modal")).not.toBeNull();
		expect(element.querySelectorAll(".residential-card")).toHaveLength(1);
		element.querySelector<HTMLButtonElement>(".close-button")?.click();
		await fixture.whenStable();
		element.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await fixture.whenStable();

		expect(element.querySelector(".residential-modal")).not.toBeNull();
		expect(element.textContent).toContain("编辑住宅节点 2");
		expect(element.textContent).toContain("2 个节点");
	});

	it("fills a residential node from a Clash-style SOCKS5 link", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		element.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await fixture.whenStable();

		fillInput(
			element,
			"#proxy-link",
			"socks5://synthetic-user:synthetic-password@residential.example.com:12345#Synthetic-IP",
		);
		element.querySelector<HTMLButtonElement>(".parse-link-button")?.click();
		await fixture.whenStable();

		expect(element.querySelector<HTMLInputElement>("#name")?.value).toBe("Synthetic-IP");
		expect(element.querySelector<HTMLInputElement>("#server")?.value).toBe("residential.example.com");
		expect(element.querySelector<HTMLInputElement>("#port")?.value).toBe("12345");
		expect(element.querySelector<HTMLInputElement>("#username")?.value).toBe("synthetic-user");
		expect(element.querySelector<HTMLInputElement>("#password")?.value).toBe("synthetic-password");
	});

	it("shows a safe error for an unsupported proxy link type", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		element.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await fixture.whenStable();

		fillInput(
			element,
			"#proxy-link",
			"http://synthetic-user:synthetic-password@residential.example.com:12345#Synthetic-IP",
		);
		element.querySelector<HTMLButtonElement>(".parse-link-button")?.click();
		await fixture.whenStable();

		expect(element.textContent).toContain("当前仅支持 SOCKS5 链接");
	});

	it("automatically saves and restores synthetic settings edited separately", async () => {
		const firstFixture = TestBed.createComponent(App);
		await firstFixture.whenStable();
		const firstElement = firstFixture.nativeElement as HTMLElement;
		firstElement.querySelectorAll<HTMLButtonElement>(".summary-buttons .summary-edit-button")[1]?.click();
		await firstFixture.whenStable();
		fillInput(firstElement, "#provider-name-0", "Synthetic Airport");
		fillInput(firstElement, "#provider-url-0", "https://example.com/subscription?token=synthetic");
		firstElement.querySelector<HTMLButtonElement>(".close-button")?.click();
		await firstFixture.whenStable();
		firstElement.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await firstFixture.whenStable();
		fillInput(firstElement, "#name", "Synthetic-IP");
		fillInput(firstElement, "#server", "residential.example.com");
		fillInput(firstElement, "#port", "12345");
		fillInput(firstElement, "#username", "synthetic-user");
		fillInput(firstElement, "#password", "synthetic-password");
		firstFixture.destroy();

		const secondFixture = TestBed.createComponent(App);
		await secondFixture.whenStable();
		const secondElement = secondFixture.nativeElement as HTMLElement;
		expect(secondElement.textContent).toContain("Synthetic Airport");
		expect(secondElement.textContent).toContain("example.com");
		expect(secondElement.textContent).toContain("Synthetic-IP");
		secondElement.querySelector<HTMLButtonElement>(".node-summary .summary-edit-button")?.click();
		await secondFixture.whenStable();

		expect(secondElement.querySelector<HTMLInputElement>("#password")?.value).toBe("synthetic-password");
	});

	it("migrates version 1 browser settings to a named provider", async () => {
		localStorage.setItem(
			"clash-config:proxy-settings:v1",
			JSON.stringify({
				version: 1,
				airportUrl: "https://example.com/subscription?token=synthetic",
				residentials: [],
			}),
		);

		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		expect(element.textContent).toContain("airport");
		expect(element.textContent).toContain("example.com");
		expect(localStorage.getItem("clash-config:proxy-settings:v1")).toBeNull();
		expect(localStorage.getItem("clash-config:proxy-settings:v2")).not.toBeNull();
	});

	it("clears the current form and saved copy from the subscription editor", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		element.querySelector<HTMLButtonElement>(".overview-section .summary-edit-button")?.click();
		await fixture.whenStable();
		element.querySelector<HTMLButtonElement>(".add-button")?.click();
		await fixture.whenStable();
		fillInput(element, "#provider-name-0", "Synthetic Airport");
		fillInput(element, "#provider-url-0", "https://example.com/subscription?token=synthetic");
		element.querySelector<HTMLButtonElement>(".clear-button")?.click();
		await fixture.whenStable();

		expect(localStorage.getItem("clash-config:proxy-settings:v2")).toBeNull();
		expect(element.textContent).toContain("0 个 Provider");
		expect(element.textContent).toContain("0 个节点");
	});

	it("generates a config when providers and residential nodes are both empty", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:empty-synthetic-config");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
		const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

		element.querySelector<HTMLButtonElement>(".action-bar .download-button")?.click();
		await fixture.whenStable();

		expect(element.querySelector(".subscription-modal")).toBeNull();
		expect(element.querySelector(".residential-modal")).toBeNull();
		expect(element.textContent).toContain("0 个 Provider");
		expect(element.textContent).toContain("0 个节点");
		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(anchorClick).toHaveBeenCalledOnce();
		expect(element.textContent).toContain("配置已生成");
	});

	it("downloads a YAML blob after validating synthetic settings", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-config");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
		const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

		element.querySelectorAll<HTMLButtonElement>(".summary-buttons .summary-edit-button")[1]?.click();
		await fixture.whenStable();
		fillInput(element, "#provider-name-0", "Synthetic Airport");
		fillInput(element, "#provider-url-0", "https://example.com/subscription?token=replace-me");
		element.querySelector<HTMLButtonElement>(".close-button")?.click();
		await fixture.whenStable();
		element.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await fixture.whenStable();
		fillInput(element, "#name", "Synthetic-IP");
		fillInput(element, "#server", "residential.example.com");
		fillInput(element, "#port", "12345");
		fillInput(element, "#username", "replace-me");
		fillInput(element, "#password", "replace-me");
		element.querySelector<HTMLButtonElement>(".close-button")?.click();
		await fixture.whenStable();
		element.querySelector<HTMLButtonElement>(".action-bar .download-button")?.click();
		await fixture.whenStable();

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
		expect(anchorClick).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:synthetic-config");
		expect(element.textContent).toContain("配置已生成");
	});

	it("copies a validated YAML config to the clipboard", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

		element.querySelector<HTMLButtonElement>(".residential-overview .summary-edit-button")?.click();
		await fixture.whenStable();
		fillInput(element, "#name", "Synthetic-IP");
		fillInput(element, "#server", "residential.example.com");
		fillInput(element, "#port", "12345");
		fillInput(element, "#username", "replace-me");
		fillInput(element, "#password", "replace-me");
		element.querySelector<HTMLButtonElement>(".close-button")?.click();
		await fixture.whenStable();
		element.querySelector<HTMLButtonElement>(".copy-button")?.click();
		await fixture.whenStable();

		expect(writeText).toHaveBeenCalledOnce();
		expect(writeText.mock.calls[0]?.[0]).toEqual(expect.any(String));
		expect(writeText.mock.calls[0]?.[0]).toContain("proxy-providers: {}");
		expect(writeText.mock.calls[0]?.[0]).toContain("use: []");
		expect(element.textContent).toContain("配置已复制到剪切板");
	});
});
