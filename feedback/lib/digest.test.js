const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  getCurrentWeekRange,
  toDigestItem,
  isInWeek,
  emptyDigest,
  parseGeminiDigest,
  isTextDigestModel,
  selectGeminiModels,
} = require("./digest");

describe("weekly digest helpers", () => {
  it("starts the current week on Monday UTC", () => {
    const wednesday = new Date(Date.UTC(2026, 8, 2, 15, 0, 0));
    const { start, end } = getCurrentWeekRange(wednesday);

    assert.equal(start.toISOString(), "2026-08-31T00:00:00.000Z");
    assert.equal(end.toISOString(), wednesday.toISOString());
  });

  it("omits parent and student names from Gemini payloads", () => {
    const item = toDigestItem({
      parentName: "Francis",
      studentName: "Frank",
      classLabel: "VCE Methods — Mon 6pm (Rohan)",
      rating: 2,
      continuing: "No",
      contactRequested: true,
      comments: "Didn't understand the class",
      priority: "urgent",
    });

    assert.deepEqual(item, {
      rating: 2,
      continuing: "No",
      contactRequested: true,
      comments: "Didn't understand the class",
      class: "VCE Methods — Mon 6pm (Rohan)",
      priority: "urgent",
    });
    assert.equal(item.parentName, undefined);
    assert.equal(item.studentName, undefined);
  });

  it("includes only items from the current week", () => {
    const start = new Date("2026-08-31T00:00:00.000Z");
    const end = new Date("2026-09-05T12:00:00.000Z");

    assert.equal(isInWeek("2026-09-05T06:14:00.000Z", start, end), true);
    assert.equal(isInWeek("2026-08-20T00:00:00.000Z", start, end), false);
    assert.equal(isInWeek(null, start, end), false);
  });

  it("returns a graceful empty digest", () => {
    const digest = emptyDigest();

    assert.equal(digest.overallVibe, "No feedback was submitted this week.");
    assert.deepEqual(digest.urgentFires, []);
    assert.deepEqual(digest.bigThemes, []);
    assert.deepEqual(digest.highPriorityFlags, []);
  });

  it("parses Gemini JSON into the frontend digest shape", () => {
    const digest = parseGeminiDigest(JSON.stringify({
      overallVibe: "Parents were mostly positive.",
      urgentFires: ["One 2-star Methods class"],
      bigThemes: ["Clarity of explanations"],
      highPriorityFlags: ["Contact requested"],
    }));

    assert.equal(digest.overallVibe, "Parents were mostly positive.");
    assert.equal(digest.urgentFires.length, 1);
    assert.equal(digest.bigThemes[0], "Clarity of explanations");
  });

  it("skips image and TTS models when choosing Gemini", () => {
    assert.equal(isTextDigestModel("gemini-2.5-flash"), true);
    assert.equal(isTextDigestModel("gemini-2.5-flash-preview-tts"), false);
    assert.equal(isTextDigestModel("gemini-2.5-flash-image"), false);

    const selected = selectGeminiModels([
      "gemini-2.5-flash-preview-tts",
      "gemini-2.5-flash-image",
      "gemini-flash-latest",
    ]);

    assert.equal(selected.includes("gemini-flash-latest"), true);
    assert.equal(selected.includes("gemini-2.5-flash-image"), false);
    assert.equal(selected.includes("gemini-2.5-flash-preview-tts"), false);
  });
});
