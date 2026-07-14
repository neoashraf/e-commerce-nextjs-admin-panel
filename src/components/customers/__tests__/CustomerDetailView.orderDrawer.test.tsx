import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
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

/** Captures the query params the order-history panel requests. */
let ordersQuery: URLSearchParams;

function seedHandlers(orderNo = "SO-100024") {
  ordersQuery = new URLSearchParams();
  server.use(
    http.get(`${API}/admin/customers/${CUSTOMER_ID}`, () =>
      HttpResponse.json({ data: CUSTOMER }),
    ),
    http.get(`${API}/admin/customers/${CUSTOMER_ID}/notes`, () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(`${API}/admin/customers/${CUSTOMER_ID}/wishlist`, () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(`${API}/admin/orders`, ({ request }) => {
      ordersQuery = new URL(request.url).searchParams;
      return HttpResponse.json({
        data: [
          {
            order_no: orderNo,
            customer: { name: "Rakib Demo", phone: "+8801711000001" },
            status: "confirmed",
            grand_total: "4570.00",
            placed_at: "2026-06-11T17:22:00Z",
          },
        ],
        meta: { page: 1, limit: 10, total: 1 },
      });
    }),
  );
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
    expect(ordersQuery.get("customer_id")).toBe(CUSTOMER_ID);
    expect(ordersQuery.get("limit")).toBe("10");
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
});
