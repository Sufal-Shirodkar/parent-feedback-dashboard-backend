const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculatePriorityScore, getPriorityLabel } = require("./model");

function priorityFor({ rating, continuing, contactRequested = false }) {
  const priorityScore = calculatePriorityScore({
    rating,
    continuing,
    contactRequested,
  });

  return {
    priorityScore,
    priority: getPriorityLabel(priorityScore),
  };
}

describe("feedback priority calculation", () => {
  it("treats 2 stars as high or urgent (same-day action)", () => {
    const result = priorityFor({ rating: 2, continuing: "Yes" });

    assert.ok(result.priorityScore > 0);
    assert.ok(["high", "urgent"].includes(result.priority));
  });

  it("treats 5 stars + continuing No as high", () => {
    const result = priorityFor({ rating: 5, continuing: "No" });

    assert.equal(result.priority, "high");
    assert.ok(result.priorityScore >= 4);
  });

  it("treats 5 stars + contact requested as high or urgent", () => {
    const result = priorityFor({
      rating: 5,
      continuing: "Yes",
      contactRequested: true,
    });

    assert.ok(["high", "urgent"].includes(result.priority));
  });

  it("treats 3 stars as medium", () => {
    const result = priorityFor({ rating: 3, continuing: "Yes" });

    assert.equal(result.priority, "medium");
  });

  it("treats 4 stars + Yes + no contact as low", () => {
    const result = priorityFor({ rating: 4, continuing: "Yes" });

    assert.equal(result.priority, "low");
  });
});
