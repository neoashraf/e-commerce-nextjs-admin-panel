import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server, API } from "@/test/server";
import { renderWithProviders, seedPermissions } from "@/test/render";
import { OrderDrawer } from "@/components/orders/OrderDrawer";

/**
 * ORD — OrderDrawer modal-dialog contract (order-detail-admin §10 a11y).
 *
 * The drawer is the shared surface both the orders list and the Customer 360 profile
 * open an order into (cust-order-drawer-fe, FR-CUST-014 / AC5). These tests pin the
 * a11y contract the profile relies on but cannot own: focus moves in on open and is
 * trapped, Esc / ✕ / back / scrim all close via `onClose`, and focus returns to the
 * control that opened it. The order body (OrderDetailAdminView) is stubbed — it is
 * owned and covered separately — so failures here point at the drawer shell.
 */

const ORDER_NO = "SO-100024";

vi.mock("@/components/orders/OrderDetailAdminView", () => ({
  OrderDetailAdminView: ({ orderNo }: { orderNo: string }) => (
    <div>Order body for {orderNo}</div>
  ),
}));

/** `document.activeElement` narrowed for jest-dom's element matchers. */
const activeEl = () => document.activeElement as HTMLElement | null;

/** Mirrors the profile: a focused trigger row that mounts/unmounts the drawer. */
function DrawerHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {ORDER_NO}
      </button>
      {open && <OrderDrawer orderNo={ORDER_NO} onClose={close} />}
    </>
  );
}

beforeEach(() => {
  seedPermissions(["orders.order.read"]);
  server.use(
    http.get(`${API}/admin/orders/${ORDER_NO}`, () =>
      HttpResponse.json({
        data: { order_no: ORDER_NO, status: "confirmed", placed_at: "2026-06-11T17:22:00Z" },
      }),
    ),
  );
});

describe("ORD — OrderDrawer a11y contract", () => {
  it("renders as a labelled modal dialog for the order", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: ORDER_NO }));

    const dialog = await screen.findByRole("dialog", { name: `Order ${ORDER_NO}` });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(`Order body for ${ORDER_NO}`)).toBeInTheDocument();
  });

  it("moves focus into the drawer when it opens", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: ORDER_NO }));
    const dialog = await screen.findByRole("dialog");

    await waitFor(() => expect(dialog).toContainElement(activeEl()));
  });

  it("traps Tab inside the drawer — focus never escapes to the page behind", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: ORDER_NO }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(activeEl()));

    // Tab well past the drawer's control count; focus must still be inside it.
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(activeEl());
    }
    // Shift+Tab off the first control wraps to the last, not back to the trigger.
    for (let i = 0; i < 12; i += 1) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(activeEl());
    }
  });

  it.each([
    ["the ✕ button", async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Close" }))],
    ["the back arrow", async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Back to orders" }))],
    ["Esc", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
  ])("closes on %s", async (_label, act) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<DrawerHarness onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: ORDER_NO }));
    await screen.findByRole("dialog");

    await act(user);

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes when the scrim behind the panel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<DrawerHarness onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: ORDER_NO }));
    const dialog = await screen.findByRole("dialog");

    // The scrim is intentionally aria-hidden (it is not an assistive-tech target —
    // Esc and ✕ are), so it has no role/label to query by; reach it structurally as
    // the panel's sibling overlay. Keyboard users are covered by the Esc case above.
    const scrim = dialog.parentElement!.firstElementChild!;
    expect(scrim).toHaveAttribute("aria-hidden", "true");
    await user.click(scrim);

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("restores focus to the control that opened it when closed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DrawerHarness />);

    const trigger = screen.getByRole("button", { name: ORDER_NO });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("locks background scroll while open and releases it on close", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: ORDER_NO }));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });
});
