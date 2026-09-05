const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  calculatePriorityScore,
  getPriorityLabel,
  applyCurrentPriority,
} = require("./model");

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

describe("applyCurrentPriority for stale Firestore documents", () => {
  it("recalculates Ramesh/Suresh: 5 + No + no contact → high", () => {
    const result = applyCurrentPriority({
      parentName: "Ramesh",
      studentName: "Suresh",
      rating: 5,
      continuing: "No",
      contactRequested: false,
      priorityScore: 2,
      priority: "medium",
    });

    assert.ok(["high", "urgent"].includes(result.priority));
    assert.ok(result.priorityScore >= 4);
  });

  it("recalculates Ranjit/Sunil: 5 + Yes + contact → high or urgent", () => {
    const result = applyCurrentPriority({
      parentName: "Ranjit",
      studentName: "Sunil",
      rating: 5,
      continuing: "Yes",
      contactRequested: true,
      priorityScore: 3,
      priority: "medium",
    });

    assert.ok(["high", "urgent"].includes(result.priority));
  });

  it("recalculates Harish/Satish: 3 + Yes + no contact → medium", () => {
    const result = applyCurrentPriority({
      parentName: "Harish",
      studentName: "Satish",
      rating: 3,
      continuing: "Yes",
      contactRequested: false,
      priorityScore: 0,
      priority: "low",
    });

    assert.equal(result.priority, "medium");
  });

  it("keeps 4–5 + Yes + no contact as low", () => {
    const result = applyCurrentPriority({
      rating: 4,
      continuing: "Yes",
      contactRequested: false,
      priority: "low",
      priorityScore: 0,
    });

    assert.equal(result.priority, "low");
  });

  it("keeps rating 1–2 as high or urgent", () => {
    const result = applyCurrentPriority({
      rating: 2,
      continuing: "Yes",
      contactRequested: false,
      priority: "medium",
      priorityScore: 3,
    });

    assert.ok(["high", "urgent"].includes(result.priority));
  });

  it("keeps contact requested as high or urgent", () => {
    const result = applyCurrentPriority({
      rating: 5,
      continuing: "Yes",
      contactRequested: true,
    });

    assert.ok(["high", "urgent"].includes(result.priority));
  });
});
