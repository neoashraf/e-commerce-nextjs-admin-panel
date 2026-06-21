/**
 * Shared admin-panel constants.
 *
 * `DEFAULT_PAGE_SIZE` is the single source of truth for how many rows every paginated
 * list/table view requests per page. Keeping one value (and the shared `TablePagination`
 * footer) makes every data table look and behave the same across the admin (design consistency).
 */
export const DEFAULT_PAGE_SIZE = 15;
