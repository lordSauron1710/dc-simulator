import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use, testInfo) => {
    const pageErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await use(pageErrors);

    if (pageErrors.length > 0) {
      await testInfo.attach("page-errors", {
        body: pageErrors.join("\n"),
        contentType: "text/plain",
      });
    }

    expect(pageErrors).toEqual([]);
  },
});

async function openApp(page: Page, search = "") {
  await page.goto(search ? `/${search}` : "/");
  await expect(page.getByRole("status", { name: /Under construction/i })).toBeVisible();
  await expect(page.getByLabel("3D data center viewport")).toBeVisible();
}

function viewport(page: Page) {
  return page.getByLabel("3D data center viewport");
}

function authoringWorkspace(page: Page) {
  return page.getByRole("complementary", { name: "Authoring workspace" });
}

function authoringWorkspaceMinimized(page: Page) {
  return page.getByRole("complementary", { name: "Authoring workspace minimized" });
}

function presetsPanel(page: Page) {
  return page.getByRole("complementary", { name: "Presets" });
}

function presetsPanelMinimized(page: Page) {
  return page.getByRole("complementary", { name: "Presets minimized" });
}

function cameraControls(page: Page) {
  return page.getByRole("navigation", { name: "View and camera controls" });
}

function cameraControlsMinimized(page: Page) {
  return page.getByRole("navigation", { name: "View and camera controls minimized" });
}

async function selectDropdownOption(page: Page, label: string, option: string) {
  const wrapper = page.locator(".dropdown-wrapper").filter({
    has: page.locator(".dropdown-label", { hasText: label }),
  }).first();

  await wrapper.locator(".dropdown").click();

  const menu = page.locator(".dropdown-menu").last();
  await expect(menu).toBeVisible();
  await menu.locator(".dropdown-item").filter({ hasText: option }).first().click();
}

function getQueryParam(page: Page, key: string) {
  return new URL(page.url()).searchParams.get(key);
}

async function expectQueryParams(page: Page, params: Record<string, string>) {
  for (const [key, value] of Object.entries(params)) {
    await expect.poll(() => getQueryParam(page, key)).toBe(value);
  }
}

async function attachHallOverride(page: Page) {
  const secondZone = page.locator(".builder-zone-block").nth(1);

  await secondZone.locator(".builder-node-main").click();
  await secondZone.getByRole("button", { name: "+ Hall" }).click();
  await expect(page.locator(".builder-summary-inline")).toContainText("2 zones");
  await expect(page.locator(".builder-summary-inline")).toContainText("4 halls");

  await secondZone.locator(".builder-hall-row").last().locator(".builder-hall-select").click();
  await expect(page.getByLabel("Data Hall Name")).toBeVisible();
  await page.getByLabel("Rack Count").fill("450");
  await expect(page.getByText("Configuration valid")).toBeVisible();

  await page.getByRole("button", { name: "Tune Technical Parameters" }).click();
  await expect(page.getByRole("button", { name: "Rack Parameters" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Selected Hall Status")).toBeVisible();
}

test("loads the core shell cleanly", async ({ page, pageErrors }) => {
  void pageErrors;

  await openApp(page);

  await expect(authoringWorkspace(page)).toBeVisible();
  await expect(presetsPanel(page)).toBeVisible();
  await expect(cameraControls(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimize all" })).toBeVisible();
  await expect(page.locator(".builder-summary-inline")).toContainText("halls");
});

test("serves the baseline security headers", async ({ request, pageErrors }) => {
  void pageErrors;

  const response = await request.get("/");
  const headers = response.headers();

  expect(response.ok()).toBeTruthy();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("minimizes and restores every major panel", async ({ page, pageErrors }) => {
  void pageErrors;

  await openApp(page);

  await page.getByRole("button", { name: "Minimize all" }).click();
  await expect(page.getByRole("button", { name: "Show all" })).toBeVisible();
  await expect(authoringWorkspaceMinimized(page)).toBeVisible();
  await expect(presetsPanelMinimized(page)).toBeVisible();
  await expect(cameraControlsMinimized(page)).toBeVisible();

  await page.getByRole("button", { name: "Show all" }).click();
  await expect(authoringWorkspace(page)).toBeVisible();
  await expect(presetsPanel(page)).toBeVisible();
  await expect(cameraControls(page)).toBeVisible();
});

test("applies presets and preserves the share URL", async ({ page, pageErrors }) => {
  void pageErrors;

  await openApp(page);

  await page.getByRole("button", { name: /AI Liquid Cluster/i }).click();
  await expectQueryParams(page, {
    cl: "120",
    wa: "300000",
    dh: "8",
    rd: "42",
    re: "2N",
    pe: "1.14",
    ct: "DLC",
    cn: "Full Enclosure",
    vm: "orbit",
    sf: "0",
    cw: "0",
  });

  await expect(page.locator(".preset-chip.active").filter({ hasText: "AI Liquid Cluster" })).toHaveCount(1);

  await page.reload();
  await expect(page.locator(".preset-chip.active").filter({ hasText: "AI Liquid Cluster" })).toHaveCount(1);
});

test("persists control toggles and camera mode across reloads", async ({ page, pageErrors }) => {
  void pageErrors;

  await openApp(page);

  await page.getByRole("button", { name: "Pan Mode" }).click();
  await page.getByRole("button", { name: "Selection Isolate Mode" }).click();
  await page.getByRole("button", { name: /Scroll Flow: Off/i }).click();
  await page.getByRole("button", { name: /Cutaway Mode: Off/i }).click();

  await expectQueryParams(page, {
    vm: "pan",
    sm: "isolate",
    sf: "1",
    cw: "1",
  });

  await page.reload();

  await expect(page.getByRole("button", { name: "Pan Mode" })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "Selection Isolate Mode" })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /Scroll Flow: On/i })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /Cutaway Mode: On/i })).toHaveClass(/active/);
});

test("supports structural edits and hall-scope technical overrides", async ({ page, pageErrors }) => {
  void pageErrors;

  await openApp(page);
  await page.getByRole("button", { name: "Add Zone" }).click();
  await attachHallOverride(page);

  await selectDropdownOption(page, "Level", "Data Hall");
  await page.getByLabel("Rack Density (kW/rack)").fill("80");

  await expect(page.getByRole("button", { name: "Reset to Zone Defaults" })).toBeVisible();
  await expect(page.getByText("Overridden").first()).toBeVisible();

  await page.getByRole("button", { name: "Reset to Zone Defaults" }).click();
  await expect(page.getByText("Inherited from Zone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset to Zone Defaults" })).toHaveCount(0);
});

test("hydrates safely at extreme public input ranges", async ({ page, pageErrors }) => {
  void pageErrors;
  test.slow();

  const search = new URLSearchParams({
    cl: "1000",
    wa: "1000000",
    dh: "100",
    wr: "0.65",
    rd: "80",
    re: "2N",
    pe: "2",
    ct: "DLC",
    cn: "Full Enclosure",
    sel: "hall:H-01",
    vm: "pan",
    sf: "1",
    cw: "1",
  }).toString();

  await openApp(page, `?${search}`);

  await expect(page.locator(".builder-summary-inline")).toContainText("100 halls");
  await expect(page.getByRole("button", { name: "Pan Mode" })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /Scroll Flow: On/i })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /Cutaway Mode: On/i })).toHaveClass(/active/);
  await expect(page.getByText("Configuration valid")).toBeVisible();
});

test("applies rack isolate and zone-to-campus scope transitions without leaking viewport scope", async ({ page, pageErrors }) => {
  void pageErrors;

  const rackSelectionSearch = new URLSearchParams({
    sel: "rack:R-0001",
    sm: "isolate",
  }).toString();

  await openApp(page, `?${rackSelectionSearch}`);

  await expect(viewport(page)).toHaveAttribute("data-selection-type", "rack");
  await expect(viewport(page)).toHaveAttribute("data-selection-mode", "isolate");
  await expect(viewport(page)).toHaveAttribute("data-selection-scope-type", "rack");
  await expect(viewport(page)).toHaveAttribute("data-selection-visible-rack-count", "1");
  await expect(viewport(page)).toHaveAttribute("data-selection-visible-hall-count", "0");
  await expect(page.locator(".inspector-selection")).toContainText("R-0001");

  await openApp(page);
  await page.getByRole("button", { name: "Add Zone" }).click();

  const secondZone = page.locator(".builder-zone-block").nth(1);
  await secondZone.locator(".builder-node-main").click();
  await page.getByRole("button", { name: "Selection Isolate Mode" }).click();

  await expect(viewport(page)).toHaveAttribute("data-selection-type", "zone");
  await expect(viewport(page)).toHaveAttribute("data-selection-mode", "isolate");
  await expect(viewport(page)).toHaveAttribute("data-selection-scope-type", "zone");
  await expect(viewport(page)).toHaveAttribute("data-selection-scope-id", "Z-02");
  await expect(viewport(page)).toHaveAttribute("data-selection-scope-hall-ids", "H-03");
  await expect(viewport(page)).toHaveAttribute("data-selection-visible-hall-count", "1");
  await expect(viewport(page)).toHaveAttribute("data-selection-total-hall-count", "3");
  await expect(page.locator(".inspector-selection")).toContainText("Zone B");

  await page.locator(".builder-node-campus .builder-node-main").click();

  const totalRackCount = await viewport(page).getAttribute("data-selection-total-rack-count");

  await expect(viewport(page)).toHaveAttribute("data-selection-type", "campus");
  await expect(viewport(page)).toHaveAttribute("data-selection-scope-type", "campus");
  await expect(viewport(page)).toHaveAttribute("data-selection-visible-hall-count", "3");
  await expect(viewport(page)).toHaveAttribute("data-selection-visible-rack-count", totalRackCount ?? "");
});

test("keeps mobile controls recoverable after the auto-minimize pass", async ({ page, pageErrors }) => {
  void pageErrors;

  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  await expect(authoringWorkspaceMinimized(page)).toBeVisible();
  await expect(presetsPanelMinimized(page)).toBeVisible();

  await page.getByRole("button", { name: "Builder" }).click();
  await expect(authoringWorkspace(page)).toBeVisible();

  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await expect(cameraControls(page)).toBeVisible();
});
