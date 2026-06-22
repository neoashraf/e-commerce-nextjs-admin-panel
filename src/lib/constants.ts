/**
 * Shared admin-panel constants.
 *
 * `DEFAULT_PAGE_SIZE` is the single source of truth for how many rows every paginated
 * list/table view requests per page. Keeping one value (and the shared `TablePagination`
 * footer) makes every data table look and behave the same across the admin (design consistency).
 *
 * `PAGE_SIZE_OPTIONS` is the canonical rows-per-page set offered by the table footer's
 * rows-per-page select (design-system §8.6). One set for every table.
 */
export const DEFAULT_PAGE_SIZE = 20;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
