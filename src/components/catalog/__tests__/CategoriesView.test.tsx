import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server, API } from "@/test/server";
import { renderWithProviders, seedPermissions, ALL_CATEGORY_PERMS } from "@/test/render";
import { CategoriesView } from "@/components/catalog/CategoriesView";
import { ToastViewport } from "@/components/ui";

/** Football › (Boots, Socks[unpublished]) · Jerseys[in-menu hidden]. positions 0-based. */
const TREE = [
  {
    id: "football",
    name: "Football",
    parent_id: null,
    level: 1,
    position: 0,
    is_published: true,
    show_in_menu: true,
    is_deleted: false,
    children: [
      { id: "boots", name: "Boots", parent_id: "football", level: 2, position: 0, is_published: true, show_in_menu: true, is_deleted: false, children: [] },
      { id: "socks", name: "Socks", parent_id: "football", level: 2, position: 1, is_published: false, show_in_menu: true, is_deleted: false, children: [] },
    ],
  },
  { id: "jerseys", name: "Jerseys", parent_id: null, level: 1, position: 1, is_published: true, show_in_menu: false, is_deleted: false, children: [] },
];

const treeHandler = (data: unknown = TREE) =>
  http.get(`${API}/admin/categories`, () => HttpResponse.json({ data }));

describe("CAT — CategoriesView", () => {
  it("renders the tree with the count and 'Unpublished' / In-menu 'Hidden' labels", async () => {
    seedPermissions(["catalog.category.read"]);
    server.use(treeHandler());
    renderWithProviders(<CategoriesView />);

    expect(await screen.findByText("Football")).toBeInTheDocument();
    expect(screen.getByText("Boots")).toBeInTheDocument();
    expect(screen.getByText("Socks")).toBeInTheDocument();
    expect(screen.getByText("4 categories")).toBeInTheDocument();
    // Socks is unpublished → "Unpublished" pill (not "Draft").
    expect(screen.getByText("Unpublished")).toBeInTheDocument();
    // Jerseys is hidden from the menu → explicit "Hidden" (not an absent badge).
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("filters by search, keeping matching ancestors expanded", async () => {
    const user = userEvent.setup();
    seedPermissions(["catalog.category.read"]);
    server.use(treeHandler());
    renderWithProviders(<CategoriesView />);
    await screen.findByText("Football");

    await user.type(screen.getByLabelText("Search categories"), "socks");

    expect(screen.getByText("Socks")).toBeInTheDocument();
    expect(screen.getByText("Football")).toBeInTheDocument(); // ancestor kept
    expect(screen.queryByText("Boots")).not.toBeInTheDocument();
    expect(screen.queryByText("Jerseys")).not.toBeInTheDocument();
  });

  it("shows the delete-blocked dialog with the real counts from the 409 details", async () => {
    const user = userEvent.setup();
    seedPermissions(ALL_CATEGORY_PERMS);
    server.use(
      treeHandler(),
      http.delete(`${API}/admin/categories/football`, () =>
        HttpResponse.json(
          { error: { code: "CATEGORY_HAS_DEPENDENTS", message: "x", details: { child_categories: 2, published_products: 14 } } },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<CategoriesView />);
    await screen.findByText("Football");

    await user.click(screen.getByRole("button", { name: "More actions for Football" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" })); // confirm

    expect(
      await screen.findByText(/14 published products and 2 sub-categories/i),
    ).toBeInTheDocument();
  });

  it("keyboard-reorders siblings, persisting absolute 0-based positions and a success toast", async () => {
    const patched: Array<{ id: string; body: unknown }> = [];
    seedPermissions(ALL_CATEGORY_PERMS);
    server.use(
      treeHandler(),
      http.patch(`${API}/admin/categories/:id`, async ({ params, request }) => {
        patched.push({ id: String(params.id), body: await request.json() });
        return HttpResponse.json({ data: { id: params.id, is_published: true } });
      }),
    );
    renderWithProviders(
      <>
        <CategoriesView />
        <ToastViewport />
      </>,
    );
    await screen.findByText("Football");

    const handle = () => screen.getByRole("button", { name: /Reorder Football/ });
    handle().focus();
    fireEvent.keyDown(handle(), { key: " " }); // lift
    fireEvent.keyDown(handle(), { key: "ArrowDown" }); // swap Football(0) ↔ Jerseys(1)
    fireEvent.keyDown(handle(), { key: " " }); // drop → commit

    expect(await screen.findByText("Order saved.")).toBeInTheDocument();
    await waitFor(() => expect(patched.length).toBeGreaterThanOrEqual(2));
    // Renumbered: Jerseys → 0, Football → 1.
    expect(patched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "jerseys", body: { position: 0 } }),
        expect.objectContaining({ id: "football", body: { position: 1 } }),
      ]),
    );
  });

  it("hides write actions for a read-only admin", async () => {
    seedPermissions(["catalog.category.read"]);
    server.use(treeHandler());
    renderWithProviders(<CategoriesView />);
    await screen.findByText("Football");

    expect(screen.queryByRole("link", { name: "Create Category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions for Football" })).not.toBeInTheDocument();
  });
});
