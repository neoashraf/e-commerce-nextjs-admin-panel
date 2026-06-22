import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server, API } from "@/test/server";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

/**
 * The error-envelope split (catalog-categories-redesign-fe plumbing): an object
 * `error.details` becomes `ApiError.context` (e.g. the 409 delete-blocked counts),
 * while an array `details` stays as field errors. This is what lets the tree show
 * real `{ child_categories, published_products }` counts.
 */
describe("CAT — api client error envelope", () => {
  it("exposes object-shaped error.details as ApiError.context (409 counts)", async () => {
    server.use(
      http.delete(`${API}/admin/categories/c1`, () =>
        HttpResponse.json(
          {
            error: {
              code: "CATEGORY_HAS_DEPENDENTS",
              message: "resolve dependents first",
              details: { child_categories: 2, published_products: 14 },
            },
          },
          { status: 409 },
        ),
      ),
    );

    let err: ApiError | undefined;
    try {
      await api.delete("/admin/categories/c1");
    } catch (e) {
      err = e as ApiError;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe("CATEGORY_HAS_DEPENDENTS");
    expect(err?.context).toEqual({ child_categories: 2, published_products: 14 });
    expect(err?.details).toEqual([]);
  });

  it("exposes array-shaped details as field errors (context stays null)", async () => {
    server.use(
      http.post(`${API}/admin/categories`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "bad",
              details: [{ field: "name", message: "too short" }],
            },
          },
          { status: 400 },
        ),
      ),
    );

    let err: ApiError | undefined;
    try {
      await api.post("/admin/categories", {});
    } catch (e) {
      err = e as ApiError;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.fieldErrors.name).toBe("too short");
    expect(err?.context).toBeNull();
  });
});
