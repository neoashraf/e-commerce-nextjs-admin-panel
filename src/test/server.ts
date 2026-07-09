import { setupServer } from "msw/node";

/**
 * Shared MSW server (fe-testing). Tests register their own handlers with
 * `server.use(http.get(...))`; the lifecycle (listen/reset/close) is wired in
 * `setup.tsx`. The API base is `http://localhost/api/v1` (see vitest.config).
 */
export const server = setupServer();

export const API = "http://localhost/api/v1";
