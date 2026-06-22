import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Category screens E2E (catalog-categories-redesign). Seeds the auth store + stubs
 * the backend at the network layer, then drives the real app in a real browser to
 * check the rendered layout (including the sticky title/save bars) at desktop and
 * mobile viewports.
 */

const PERMS = [
  "catalog.category.read",
  "catalog.category.create",
  "catalog.category.update",
  "catalog.category.delete",
];
const ADMIN = { id: "a1", full_name: "Test Admin", email: "t@example.com", role: "admin", permissions: PERMS };

const TREE = [
  {
    id: "football", name: "Football", parent_id: null, level: 1, position: 0,
    is_published: true, show_in_menu: true, is_deleted: false,
    children: [
      { id: "boots", name: "Boots", parent_id: "football", level: 2, position: 0, is_published: true, show_in_menu: true, is_deleted: false, children: [] },
      { id: "socks", name: "Socks", parent_id: "football", level: 2, position: 1, is_published: false, show_in_menu: true, is_deleted: false, children: [] },
    ],
  },
  { id: "jerseys", name: "Jerseys", parent_id: null, level: 1, position: 1, is_published: true, show_in_menu: false, is_deleted: false, children: [] },
  { id: "turf", name: "Turf & Futsal Shoes", parent_id: null, level: 1, position: 2, is_published: true, show_in_menu: true, is_deleted: false, children: [] },
];

const CATEGORY = {
  id: "turf", name: "Turf & Futsal Shoes", slug: "turf-futsal-shoes", parent_id: null, level: 1, position: 2,
  is_published: true, show_in_menu: true, display_mode: "products_and_description", description: null,
  image_url: null, logo_url: null, banner_url: null, meta_title: null, meta_keywords: null, meta_description: null,
  filterable_attribute_codes: [],
};

const ATTRS = [
  { id: "a1", code: "brand", admin_label: "Brand" },
  { id: "a2", code: "color", admin_label: "Color" },
  { id: "a3", code: "size", admin_label: "Size" },
  { id: "a4", code: "surface_ground", admin_label: "Surface / Ground" },
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function seed(page: Page) {
  // Hydrate the zustand-persisted auth store before the app boots.
  await page.addInitScript((admin) => {
    localStorage.setItem(
      "admin-auth",
      JSON.stringify({ state: { admin, tokens: { accessToken: "t", refreshToken: "r" } }, version: 0 }),
    );
  }, ADMIN);

  // Stub every backend call.
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/admin/me")) return json(route, { data: ADMIN });
    if (/\/admin\/categories\/[^/?]+(\?|$)/.test(url) && method === "GET") return json(route, { data: CATEGORY });
    if (url.includes("/admin/categories") && method === "GET") return json(route, { data: TREE });
    if (url.includes("/admin/attributes") && method === "GET") return json(route, { data: ATTRS });
    if (method !== "GET") return json(route, { data: { id: "turf", is_published: true } });
    return json(route, { data: [] });
  });
}

test.describe("Categories tree", () => {
  test("renders the tree and toolbar", async ({ page }) => {
    await seed(page);
    await page.goto("/admin/categories");

    await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
    await expect(page.getByText("Football")).toBeVisible();
    await expect(page.getByText("Turf & Futsal Shoes")).toBeVisible();
    await expect(page.getByPlaceholder("Search categories by name…")).toBeVisible();
    await page.screenshot({ path: `e2e/__shots__/tree-${test.info().project.name}.png`, fullPage: false });
  });
});

test.describe("Category editor", () => {
  test("renders without sticky-bar overlap", async ({ page }) => {
    await seed(page);
    await page.goto("/admin/categories/turf");

    const title = page.getByRole("heading", { name: "Edit Turf & Futsal Shoes" });
    await expect(title).toBeVisible();
    await expect(page.getByRole("heading", { name: "Description & images" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Filterable attributes" })).toBeVisible();

    // Scroll the editor down so the title bar is pinned, then verify the General
    // card does NOT bleed above the sticky title bar (the reported overlap bug).
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);

    const titleBox = await title.boundingBox();
    const showInMenu = page.getByText("Show in the top navigation (independent of publish).");
    const generalBox = await showInMenu.boundingBox().catch(() => null);

    expect(titleBox).not.toBeNull();
    // The pinned title sits near the top of the scroll area (just under the 60px topbar).
    expect(titleBox!.y).toBeLessThan(140);
    // If the General helper row is still on screen, it must be BELOW the title bar, not above it.
    if (generalBox) expect(generalBox.y).toBeGreaterThan(titleBox!.y);

    await page.screenshot({ path: `e2e/__shots__/editor-${test.info().project.name}.png`, fullPage: false });
  });

  test("save bar stays pinned to the bottom", async ({ page }) => {
    await seed(page);
    await page.goto("/admin/categories/turf");
    await expect(page.getByRole("heading", { name: "Edit Turf & Futsal Shoes" })).toBeVisible();

    const saveBtn = page.getByRole("button", { name: "Save" });
    await expect(saveBtn).toBeVisible();
    const box = await saveBtn.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Save button is within the bottom third of the viewport (sticky save bar).
    expect(box!.y).toBeGreaterThan(viewport!.height * 0.55);
  });
});
