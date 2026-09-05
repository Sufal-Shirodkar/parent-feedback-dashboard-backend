const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function toPositiveInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : NaN;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return NaN;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function parsePagination(query = {}) {
  const page = query.page === undefined || query.page === ""
    ? DEFAULT_PAGE
    : toPositiveInteger(query.page);
  const limit = query.limit === undefined || query.limit === ""
    ? DEFAULT_LIMIT
    : toPositiveInteger(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    return { error: "page must be a positive integer" };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
  }

  return { value: { page, limit } };
}

function paginateItems(items, { page, limit }) {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  paginateItems,
};
