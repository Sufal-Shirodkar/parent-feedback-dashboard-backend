const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_LIMIT,
  parsePagination,
  paginateItems,
} = require("./pagination");

describe("parsePagination", () => {
  it("defaults to page 1 and limit 10", () => {
    assert.deepEqual(parsePagination({}), {
      value: { page: 1, limit: DEFAULT_LIMIT },
    });
  });

  it("accepts page and limit query strings", () => {
    assert.deepEqual(parsePagination({ page: "2", limit: "5" }), {
      value: { page: 2, limit: 5 },
    });
  });

  it("rejects invalid page or limit", () => {
    assert.equal(parsePagination({ page: "0" }).error, "page must be a positive integer");
    assert.equal(parsePagination({ page: "1.5" }).error, "page must be a positive integer");
    assert.equal(
      parsePagination({ limit: "101" }).error,
      "limit must be an integer between 1 and 100"
    );
  });
});

describe("paginateItems", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("returns the requested page after the full list is filtered", () => {
    assert.deepEqual(paginateItems(items, { page: 2, limit: 2 }), {
      items: ["c", "d"],
      pagination: {
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      },
    });
  });

  it("returns an empty page when page is past the end", () => {
    assert.deepEqual(paginateItems(items, { page: 4, limit: 2 }), {
      items: [],
      pagination: {
        page: 4,
        limit: 2,
        total: 5,
        totalPages: 3,
      },
    });
  });

  it("returns empty pagination metadata for an empty list", () => {
    assert.deepEqual(paginateItems([], { page: 1, limit: 10 }), {
      items: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });
});
