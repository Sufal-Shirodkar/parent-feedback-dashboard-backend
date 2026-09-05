const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  canAccessFeedback,
  redactFeedbackForUser,
  normalizeClassLabel,
} = require("./access");

const physicsEmDash = "VCE Physics — Tue 6pm (Daniel)";
const physicsHyphen = "VCE Physics - Tue 6pm (Daniel)";
const physicsEnDash = "VCE Physics – Tue 6pm (Daniel)";

describe("normalizeClassLabel", () => {
  it("treats em dash, en dash, hyphen, and extra spaces as the same class", () => {
    const expected = normalizeClassLabel(physicsHyphen);

    assert.equal(normalizeClassLabel(physicsEmDash), expected);
    assert.equal(normalizeClassLabel(physicsEnDash), expected);
    assert.equal(normalizeClassLabel("  VCE Physics   —   Tue 6pm (Daniel)  "), expected);
    assert.equal(normalizeClassLabel("vce physics - tue 6pm (daniel)"), expected);
  });
});

describe("canAccessFeedback", () => {
  it("lets a tutor with a hyphenated class access feedback stored with an em dash", () => {
    const tutor = {
      role: "tutor",
      uid: "tutor-1",
      name: "Daniel",
      classes: [normalizeClassLabel(physicsHyphen)],
    };

    assert.equal(
      canAccessFeedback(tutor, { classLabel: physicsEmDash }),
      true
    );
  });

  it("does not let a tutor access an unrelated class", () => {
    const tutor = {
      role: "tutor",
      uid: "tutor-1",
      name: "Daniel",
      classes: [normalizeClassLabel(physicsHyphen)],
    };

    assert.equal(
      canAccessFeedback(tutor, {
        classLabel: "VCE Biology — Thu 7pm (Chloe)",
      }),
      false
    );
  });

  it("does not change lead or coordinator access", () => {
    const feedback = { classLabel: "VCE Biology — Thu 7pm (Chloe)" };

    assert.equal(canAccessFeedback({ role: "lead", classes: [] }, feedback), true);
    assert.equal(
      canAccessFeedback({ role: "coordinator", classes: [] }, feedback),
      true
    );
  });
});

describe("redactFeedbackForUser", () => {
  it("keeps the original classLabel in the API payload", () => {
    const tutor = {
      role: "tutor",
      uid: "tutor-1",
      name: "Daniel",
      classes: [normalizeClassLabel(physicsHyphen)],
    };

    const redacted = redactFeedbackForUser(tutor, {
      classLabel: physicsEmDash,
      parentName: "Test Parent",
      comments: "Please call",
      studentName: "Test Student",
    });

    assert.equal(redacted.classLabel, physicsEmDash);
    assert.equal(redacted.studentName, "Test Student");
    assert.equal(redacted.parentName, undefined);
    assert.equal(redacted.comments, undefined);
  });
});
