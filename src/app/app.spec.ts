import { TestBed } from "@angular/core/testing";

import { App } from "./app";

describe("App", () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders one editable residential node initially", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		expect(element.querySelectorAll(".residential-card")).toHaveLength(1);
		expect(element.textContent).toContain("把代理链路");
	});

	it("adds another residential node without persisting credentials", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		const addButton = element.querySelector<HTMLButtonElement>(".add-button");

		addButton?.click();
		await fixture.whenStable();

		expect(element.querySelectorAll(".residential-card")).toHaveLength(2);
		expect(element.textContent).toContain("2 个住宅节点");
	});

	it("shows validation guidance instead of generating an empty config", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;

		element.querySelector<HTMLButtonElement>(".download-button")?.click();
		await fixture.whenStable();

		expect(element.querySelectorAll(".field-error").length).toBeGreaterThan(0);
		expect(element.textContent).toContain("请输入完整的 HTTP 或 HTTPS 订阅地址");
	});

	it("downloads a YAML blob after validating synthetic settings", async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		const element = fixture.nativeElement as HTMLElement;
		const fill = (selector: string, value: string): void => {
			const input = element.querySelector<HTMLInputElement>(selector);
			if (!input) {
				throw new Error(`Missing test input: ${selector}`);
			}
			input.value = value;
			input.dispatchEvent(new Event("input"));
		};
		const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-config");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
		const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

		fill("#airport-url", "https://example.com/subscription?token=replace-me");
		fill("#name-0", "Synthetic-IP");
		fill("#server-0", "residential.example.com");
		fill("#port-0", "12345");
		fill("#username-0", "replace-me");
		fill("#password-0", "replace-me");
		element.querySelector<HTMLButtonElement>(".download-button")?.click();
		await fixture.whenStable();

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
		expect(anchorClick).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:synthetic-config");
		expect(element.textContent).toContain("配置已生成");
	});
});
