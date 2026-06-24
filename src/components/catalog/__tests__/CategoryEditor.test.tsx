import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useRouter } from "next/navigation";
import { server, API } from "@/test/server";
import { renderWithProviders, seedPermissions } from "@/test/render";
import { CategoryEditor } from "@/components/catalog/CategoryEditor";
import { ToastViewport } from "@/components/ui";

const PARENT_TREE = [
  { id: "football", name: "Football", parent_id: null, level: 1, position: 0, is_published: true, show_in_menu: true, is_deleted: false, children: [] },
];
const ATTRS = [
  { id: "a1", code: "brand", admin_label: "Brand" },
  { id: "a2", code: "color", admin_label: "Color" },
];

const treeHandler = (data: unknown = PARENT_TREE) => http.get(`${API}/admin/categories`, () => HttpResponse.json({ data }));
const attrsHandler = (data: unknown = ATTRS) => http.get(`${API}/admin/attributes`, () => HttpResponse.json({ data }));

describe("CAT — CategoryEditor", () => {
  it("includes meta_keywords in the POST body and shows the saved toast", async () => {
    const user = userEvent.setup();
    seedPermissions(["catalog.category.create"]);
    let body: Record<string, unknown> | undefined;
    server.use(
      treeHandler(),
      attrsHandler(),
      http.post(`${API}/admin/categories`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { id: "new", slug: "bags", level: 1, is_published: false } }, { status: 201 });
      }),
    );
    renderWithProviders(
      <>
        <CategoryEditor mode="create" />
        <ToastViewport />
      </>,
    );
    await screen.findByRole("heading", { name: "New category" });

    await user.type(screen.getByPlaceholderText("e.g. Football Boots"), "Bags");
    await user.type(screen.getByPlaceholderText("comma, separated, terms"), "bag, kit");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Category saved.")).toBeInTheDocument();
    expect(body).toMatchObject({ name: "Bags", meta_keywords: "bag, kit" });
    expect(useRouter().push).toHaveBeenCalledWith("/admin/categories");
  });

  it("opens the discard guard when cancelling with unsaved changes", async () => {
    const user = userEvent.setup();
    seedPermissions(["catalog.category.create"]);
    server.use(treeHandler(), attrsHandler());
    renderWithProviders(<CategoryEditor mode="create" />);
    await screen.findByRole("heading", { name: "New category" });

    await user.type(screen.getByPlaceholderText("e.g. Football Boots"), "Bags");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Discard changes?")).toBeInTheDocument();
  });

  it("maps a MAX_DEPTH_EXCEEDED 400 to the inline depth error", async () => {
    const user = userEvent.setup();
    seedPermissions(["catalog.category.create"]);
    server.use(
      treeHandler(),
      attrsHandler(),
      http.post(`${API}/admin/categories`, () =>
        HttpResponse.json({ error: { code: "MAX_DEPTH_EXCEEDED", message: "too deep" } }, { status: 400 }),
      ),
    );
    renderWithProviders(<CategoryEditor mode="create" />);
    await screen.findByRole("heading", { name: "New category" });

    await user.type(screen.getByPlaceholderText("e.g. Football Boots"), "Deep");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Categories can be nested up to 3 levels deep.")).toBeInTheDocument();
  });

  it("previews the resulting level when a parent is chosen", async () => {
    const user = userEvent.setup();
    seedPermissions(["catalog.category.create"]);
    server.use(treeHandler(), attrsHandler());
    renderWithProviders(<CategoryEditor mode="create" />);
    await screen.findByRole("heading", { name: "New category" });
    // Wait for the parent tree to load so the "Football" option is selectable.
    await screen.findByRole("option", { name: "Football" });

    expect(screen.getByText("This will be a level-1 category")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Parent category" }), "football");
    expect(screen.getByText("This will be a level-2 category")).toBeInTheDocument();
  });

  it("shows the empty filterable-attributes state with a link to Attributes", async () => {
    seedPermissions(["catalog.category.create"]);
    server.use(treeHandler(), attrsHandler([]));
    renderWithProviders(<CategoryEditor mode="create" />);

    expect(await screen.findByText(/No filterable attributes defined yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Attributes/i })).toBeInTheDocument();
  });
});
