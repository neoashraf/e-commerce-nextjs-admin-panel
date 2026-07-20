import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { server, API } from "@/test/server";
import { renderWithProviders, seedPermissions } from "@/test/render";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";

/**
 * CUST — cust-order-drawer-fe (Product stabilization).
 *
 * The Customer 360 profile opens an order from its history as a drawer OVER the
 * profile via `?order=<no>` (design customer-profile §3/§5/§6, FR-CUST-012/014) —
 * so the admin never loses the customer, and the order-history panel defaults to
 * 10 rows/page. We override next/navigation per-file with a controllable search +
 * push spy, and stub the separately-owned OrderDrawer (ord-admin-fe) at the unit
 * boundary — asserting CustomerDetailView's contract with it (renders it for the
 * `?order=` order, wires onClose to clear the param), not the order subtree.
 */

const CUSTOMER_ID = "c_1";
const PROFILE_PATH = `/admin/customers/${CUSTOMER_ID}`;

// Controllable App-Router mock (overrides the empty global one in test/setup.tsx).
const nav = vi.hoisted(() => ({ push: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: nav.push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => PROFILE_PATH,
}));

// The order detail drawer is owned + tested by ord-admin-fe; stub it to a minimal
// dialog so these tests assert the profile↔drawer wiring, not the order subtree.
vi.mock("@/components/orders/OrderDrawer", () => ({
  OrderDrawer: ({ orderNo, onClose }: { orderNo: string; onClose: () => void }) => (
    <div role="dialog" aria-label={`Order ${orderNo}`}>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

const CUSTOMER = {
  customer_id: CUSTOMER_ID,
  full_name: "Rakib Demo",
  phone: "+8801711000001",
  email: "rakib.demo@example.com",
  status: "active",
  aggregates: { order_count: 10, total_spent: "93260.00" },
  recent_orders: [],
  addresses: [],
  leads: [],
  tags: [],
};

/** Captures the query params of every order-history request, newest last. */
let ordersQueries: URLSearchParams[];
/** The params of the most recent order-history request. */
const lastOrdersQuery = () => ordersQueries[ordersQueries.length - 1];

const buildOrder = (orderNo: string) => ({
  order_no: orderNo,
  customer: { name: "Rakib Demo", phone: "+8801711000001" },
  status: "confirmed",
  grand_total: "4570.00",
  placed_at: "2026-06-11T17:22:00Z",
});

/** The always-present profile sub-resource handlers (not under test here). */
function profileHandlers() {
  return [
    http.get(`${API}/admin/customers/${CUSTOMER_ID}`, () =>
      HttpResponse.json({ data: CUSTOMER }),
    ),
    http.get(`${API}/admin/customers/${CUSTOMER_ID}/notes`, () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(`${API}/admin/customers/${CUSTOMER_ID}/wishlist`, () =>
      HttpResponse.json({ data: [] }),
    ),
  ];
}

/**
 * Seeds the profile + an order-history page. `total` drives pagination (rows are
 * generated per requested page/limit) so page + rows-per-page changes are observable
 * through the params the panel sends.
 */
function seedHandlers({
  orderNo = "SO-100024",
  total = 1,
}: { orderNo?: string; total?: number } = {}) {
  ordersQueries = [];
  server.use(
    ...profileHandlers(),
    http.get(`${API}/admin/orders`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      ordersQueries.push(q);
      const page = Number(q.get("page") ?? 1);
      const limit = Number(q.get("limit") ?? 10);
      const count = Math.max(0, Math.min(limit, total - (page - 1) * limit));
      // Page 1 leads with the fixed order number the assertions click on.
      const rows = Array.from({ length: count }, (_, i) =>
        buildOrder(page === 1 && i === 0 ? orderNo : `SO-2${page}00${i}`),
      );
      return HttpResponse.json({ data: rows, meta: { page, limit, total } });
    }),
  );
}

/** Seeds the profile with an order-history endpoint in a non-loaded state. */
function seedOrdersState(responder: Parameters<typeof http.get>[1]) {
  ordersQueries = [];
  server.use(...profileHandlers(), http.get(`${API}/admin/orders`, responder));
}

beforeEach(() => {
  nav.push.mockClear();
  nav.search = "";
  seedPermissions(["customers.customer.read"]);
});

describe("CUST — CustomerDetailView order drawer (in-context)", () => {
  it("fetches the order history with customer_id + a default page size of 10", async () => {
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    // Wait until the order row (proof the orders request resolved) is on screen.
    expect(await screen.findByRole("link", { name: "SO-100024" })).toBeInTheDocument();
    expect(lastOrdersQuery().get("customer_id")).toBe(CUSTOMER_ID);
    expect(lastOrdersQuery().get("limit")).toBe("10");
  });

  it("opens an order as a drawer over the profile (?order=) instead of navigating away", async () => {
    const user = userEvent.setup();
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    const orderLink = await screen.findByRole("link", { name: "SO-100024" });
    // Canonical href is preserved for middle-click / open-in-new-tab / copy-link.
    expect(orderLink).toHaveAttribute("href", "/admin/orders/SO-100024");

    await user.click(orderLink);

    // A plain left-click opens the in-context drawer via ?order= on the profile route,
    // NOT a full-page navigation to /admin/orders/SO-100024.
    expect(nav.push).toHaveBeenCalledWith(
      `${PROFILE_PATH}?order=SO-100024`,
      expect.objectContaining({ scroll: false }),
    );
    expect(nav.push).not.toHaveBeenCalledWith(
      expect.stringContaining("/admin/orders/SO-100024"),
      expect.anything(),
    );
  });

  it("renders the order drawer when the page loads with ?order= (deep-link / refresh)", async () => {
    nav.search = "order=SO-100024";
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    // The drawer for that order is present over the (still-mounted) profile.
    expect(await screen.findByRole("dialog", { name: "Order SO-100024" })).toBeInTheDocument();
    // Profile is still mounted underneath (its breadcrumb back-link is present).
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
  });

  it("closing the drawer returns to the profile (clears ?order=), not the orders list", async () => {
    const user = userEvent.setup();
    nav.search = "order=SO-100024";
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        PROFILE_PATH,
        expect.objectContaining({ scroll: false }),
      ),
    );
    // Never routes to the standalone orders list on close.
    expect(nav.push).not.toHaveBeenCalledWith("/admin/orders", expect.anything());
  });

  it("does not render a drawer when the profile URL has no ?order=", async () => {
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    expect(await screen.findByRole("link", { name: "SO-100024" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves a modified click (⌘/Ctrl) to the browser so the order still opens in a new tab", async () => {
    const user = userEvent.setup();
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    const orderLink = await screen.findByRole("link", { name: "SO-100024" });
    await user.keyboard("{Control>}");
    await user.click(orderLink);
    await user.keyboard("{/Control}");

    // The in-context drawer is for plain clicks only — a modified click keeps the
    // canonical /admin/orders/{no} href the browser handles itself.
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the profile's other query params when opening the drawer", async () => {
    const user = userEvent.setup();
    nav.search = "tab=notes";
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    await user.click(await screen.findByRole("link", { name: "SO-100024" }));

    expect(nav.push).toHaveBeenCalledWith(
      `${PROFILE_PATH}?tab=notes&order=SO-100024`,
      expect.objectContaining({ scroll: false }),
    );
  });

  it("drops only `order` from the URL when closing the drawer", async () => {
    const user = userEvent.setup();
    nav.search = "tab=notes&order=SO-100024";
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        `${PROFILE_PATH}?tab=notes`,
        expect.objectContaining({ scroll: false }),
      ),
    );
  });
});

describe("CUST — CustomerDetailView order history pagination", () => {
  it("offers 10 / 20 / 50 rows per page with 10 selected by default", async () => {
    seedHandlers({ total: 25 });
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    const select = await screen.findByRole("combobox", { name: "Rows per page" });
    expect(select).toHaveValue("10");
    const offered = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(offered).toEqual(expect.arrayContaining(["10", "20", "50"]));
  });

  it("resets to page 1 when the rows-per-page size changes", async () => {
    const user = userEvent.setup();
    seedHandlers({ total: 25 });
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    // Go to page 2 of the 10-per-page history…
    await user.click(await screen.findByRole("button", { name: "Page 2" }));
    await waitFor(() => expect(lastOrdersQuery().get("page")).toBe("2"));

    // …then widen the page size: the panel must re-request from page 1, not page 2
    // (page 2 of 20-per-page would be empty for a 25-order customer).
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Rows per page" }),
      "20",
    );
    await waitFor(() => expect(lastOrdersQuery().get("limit")).toBe("20"));
    expect(lastOrdersQuery().get("page")).toBe("1");
  });
});

describe("CUST — CustomerDetailView order history states", () => {
  it("shows neither the empty nor the error state while the history is loading", async () => {
    seedOrdersState(async () => {
      await delay("infinite");
      return HttpResponse.json({ data: [], meta: { page: 1, limit: 10, total: 0 } });
    });
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    // The profile itself has loaded around the still-pending history panel.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Rakib Demo" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the empty state when the customer has no orders", async () => {
    seedHandlers({ total: 0 });
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(
      screen.getByText("This customer hasn’t placed any orders."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a non-blocking error with Retry when the history fails, and recovers", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    seedOrdersState(({ request }) => {
      ordersQueries.push(new URL(request.url).searchParams);
      attempt += 1;
      if (attempt === 1) return new HttpResponse(null, { status: 500 });
      return HttpResponse.json({
        data: [buildOrder("SO-100024")],
        meta: { page: 1, limit: 10, total: 1 },
      });
    });
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    expect(await screen.findByText("Couldn’t load orders.")).toBeInTheDocument();
    // Non-blocking: the rest of the profile is still usable.
    expect(
      screen.getByRole("heading", { level: 1, name: "Rakib Demo" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "SO-100024" })).toBeInTheDocument();
  });

  it("hides the whole profile from an admin without customers.customer.read", async () => {
    seedPermissions([]);
    seedHandlers();
    renderWithProviders(<CustomerDetailView id={CUSTOMER_ID} />);

    expect(await screen.findByText("No access to this customer")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SO-100024" })).not.toBeInTheDocument();
  });
});
