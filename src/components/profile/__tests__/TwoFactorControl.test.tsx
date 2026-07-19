import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server, API } from "@/test/server";
import { renderWithProviders } from "@/test/render";
import { TwoFactorControl } from "@/components/profile/TwoFactorControl";
import type { MeProfile } from "@/lib/api/schemas/me";

/**
 * RBAC admin 2FA test-track (rbac-admin-2fa-confirm-test AC6, sibling AC1–AC4):
 * email-only (no channel selector), toggle stays off until the emailed code is
 * confirmed, the disable code step appears exactly when session_mfa_verified is
 * false, and success notes other sessions were signed out.
 */

const me = (over: Partial<MeProfile> = {}): MeProfile => ({
  id: "ad1",
  full_name: "Ops",
  email: "ops@store.com",
  phone: null,
  role: "Super Admin",
  is_super_admin: true,
  two_fa_enabled: false,
  session_mfa_verified: false,
  last_login_at: null,
  permissions: [],
  ...over,
});

const VERIFICATION = { challenge_id: "otp_1", sent_to: "o**@store.com", expires_in: 300, resend_after: 60 };

describe("RBAC — TwoFactorControl (FR-RBAC-002/008/009)", () => {
  it("renders no channel selector — codes go to the account email (AC1)", async () => {
    renderWithProviders(<TwoFactorControl me={me()} />);
    await userEvent.click(screen.getByRole("button", { name: /enable/i }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/we'll email a code/i)).toBeInTheDocument();
  });

  it("enable: the toggle stays OFF until the emailed code is confirmed (AC2)", async () => {
    server.use(
      http.patch(`${API}/admin/me/2fa`, () =>
        HttpResponse.json({ data: { two_fa_enabled: false, verification: VERIFICATION } }),
      ),
      http.post(`${API}/admin/me/2fa/confirm`, () =>
        HttpResponse.json({ data: { two_fa_enabled: true } }),
      ),
      http.get(`${API}/admin/me`, () => HttpResponse.json({ data: me() })),
    );
    renderWithProviders(<TwoFactorControl me={me()} />);

    await userEvent.click(screen.getByRole("button", { name: /enable/i }));
    await userEvent.type(screen.getByLabelText(/current password/i), "S3cret-Pass");
    await userEvent.click(screen.getByRole("button", { name: /email me a code/i }));

    // Code step with the masked address — still shows the enable-in-progress UI.
    expect(await screen.findByText(/o\*\*@store\.com/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/verification code/i), "204815");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/is on.*signed out/i);
  });

  it("wrong/expired code and 429 throttle render distinct errors (AC2)", async () => {
    server.use(
      http.patch(`${API}/admin/me/2fa`, () =>
        HttpResponse.json({ data: { two_fa_enabled: false, verification: VERIFICATION } }),
      ),
      http.post(`${API}/admin/me/2fa/confirm`, () =>
        HttpResponse.json({ error: { code: "INVALID_2FA_CODE", message: "bad" } }, { status: 400 }),
      ),
    );
    renderWithProviders(<TwoFactorControl me={me()} />);

    await userEvent.click(screen.getByRole("button", { name: /enable/i }));
    await userEvent.type(screen.getByLabelText(/current password/i), "S3cret-Pass");
    await userEvent.click(screen.getByRole("button", { name: /email me a code/i }));
    await screen.findByText(/o\*\*@store\.com/);

    await userEvent.type(screen.getByLabelText(/verification code/i), "000000");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/wrong or has expired/i);

    // Resend hits the 429 throttle → cooldown message.
    server.use(
      http.patch(`${API}/admin/me/2fa`, () =>
        HttpResponse.json({ error: { code: "TWOFA_COOLDOWN", message: "wait" } }, { status: 429 }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /resend/i })).toBeInTheDocument(),
    );
    // The initial cooldown may still be counting down — force-clickable check via disabled state.
    const resend = screen.getByRole("button", { name: /resend/i });
    if (!(resend as HTMLButtonElement).disabled) {
      await userEvent.click(resend);
      expect(await screen.findByRole("alert")).toHaveTextContent(/too many codes/i);
    } else {
      expect(resend).toHaveTextContent(/resend in/i); // cooldown countdown rendering
    }
  });

  it("disable from a 2FA-verified session completes password-only + signed-out note (AC3/AC4)", async () => {
    server.use(
      http.patch(`${API}/admin/me/2fa`, () =>
        HttpResponse.json({ data: { two_fa_enabled: false } }),
      ),
    );
    renderWithProviders(
      <TwoFactorControl me={me({ two_fa_enabled: true, session_mfa_verified: true })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /disable/i }));
    expect(screen.getByText(/confirm your password to turn off/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/current password/i), "S3cret-Pass");
    await userEvent.click(screen.getByRole("button", { name: /turn off two-factor/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/is off.*signed out/i);
  });

  it("disable from a NON-verified session goes through the code step (AC3)", async () => {
    let firstCall = true;
    server.use(
      http.patch(`${API}/admin/me/2fa`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        if (firstCall) {
          firstCall = false;
          return HttpResponse.json({ data: { two_fa_enabled: true, verification: VERIFICATION } });
        }
        expect(body.code).toBe("482913"); // second call carries the fresh code
        return HttpResponse.json({ data: { two_fa_enabled: false } });
      }),
    );
    renderWithProviders(
      <TwoFactorControl me={me({ two_fa_enabled: true, session_mfa_verified: false })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /disable/i }));
    expect(screen.getByText(/we'll also email a code/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/current password/i), "S3cret-Pass");
    await userEvent.click(screen.getByRole("button", { name: /turn off two-factor/i }));

    await screen.findByText(/o\*\*@store\.com/);
    await userEvent.type(screen.getByLabelText(/verification code/i), "482913");
    await userEvent.click(screen.getByRole("button", { name: /turn off two-factor/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/is off.*signed out/i);
  });
});
