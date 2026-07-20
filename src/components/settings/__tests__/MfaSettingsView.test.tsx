import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server, API } from "@/test/server";
import { renderWithProviders, seedPermissions } from "@/test/render";
import { MfaSettingsView } from "@/components/settings/MfaSettingsView";

/**
 * MFA hardening test-track (mfa-hardening-test AC6, mfa-default-channel-admin-fe
 * AC1–AC3): the default_channel control loads/saves, the inline disabled-channel
 * guard blocks bad saves, and a server 400 race surfaces cleanly (FR-MFA-030/036).
 */

const POLICY = {
  sms_enabled: true,
  email_enabled: true,
  enforcement_mode: "optional",
  default_channel: "sms",
  otp_ttl_seconds: 300,
  resend_cooldown_seconds: 60,
  max_attempts: 5,
  updated_by: null,
  updated_at: "2026-07-19T10:00:00Z",
};

const getHandler = (data: unknown = POLICY) =>
  http.get(`${API}/admin/settings/mfa`, () => HttpResponse.json({ data }));

describe("MFA — MfaSettingsView default_channel (FR-MFA-036)", () => {
  it("loads default_channel from GET and explains the resolution order (AC1/AC3)", async () => {
    server.use(getHandler());
    seedPermissions(["settings.setting.update"]);
    renderWithProviders(<MfaSettingsView />);

    expect(await screen.findByRole("radio", { name: /sms/i })).toBeChecked();
    expect(screen.getByText(/customer preference → this default → the only/i)).toBeInTheDocument();
  });

  it("saves the chosen default_channel via PUT (AC1)", async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      getHandler(),
      http.put(`${API}/admin/settings/mfa`, async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { ...POLICY, default_channel: "email" } });
      }),
    );
    seedPermissions(["settings.setting.update"]);
    renderWithProviders(<MfaSettingsView />);

    await userEvent.click(await screen.findByRole("radio", { name: /^email$/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toMatchObject({ default_channel: "email" });
  });

  it("blocks saving a default that points at a disabled channel — inline guard (AC2)", async () => {
    server.use(getHandler());
    seedPermissions(["settings.setting.update"]);
    renderWithProviders(<MfaSettingsView />);

    // default is SMS; turning the SMS channel off must trip the inline guard.
    await userEvent.click(await screen.findByRole("switch", { name: /sms channel/i }));

    expect(
      await screen.findByText(/default channel must be one that('|&#39;|’)s enabled/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("a server 400 MFA_NO_CHANNEL race about the default surfaces the default-channel message (AC2)", async () => {
    server.use(
      getHandler({ ...POLICY, default_channel: "email" }),
      http.put(`${API}/admin/settings/mfa`, () =>
        HttpResponse.json(
          { error: { code: "MFA_NO_CHANNEL", message: "default_channel must reference an enabled channel." } },
          { status: 400 },
        ),
      ),
    );
    seedPermissions(["settings.setting.update"]);
    renderWithProviders(<MfaSettingsView />);

    await userEvent.click(await screen.findByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(/default channel must be one that('|&#39;|’)s enabled/i),
    ).toBeInTheDocument();
  });
});
