const crypto = require("crypto");

const FULL_ACCESS_ROLES = new Set(["lead", "coordinator"]);
const ALLOWED_ROLES = new Set(["lead", "coordinator", "tutor"]);
const TUTOR_REDACTED_FIELDS = ["parentName", "comments"];

function secretsMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function requireIngestSecret(req, res, next) {
  const expected = process.env.FEEDBACK_INGEST_SECRET;
  const provided = req.get("X-Feedback-Secret");

  if (!expected || !secretsMatch(provided, expected)) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized",
    });
  }

  return next();
}

function normalizeClassLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseAssignedClasses(headerValue) {
  return String(headerValue || "")
    .split(",")
    .map((value) => normalizeClassLabel(value))
    .filter(Boolean);
}

function requireDashboardUser(req, res, next) {
  const role = String(req.get("X-User-Role") || "")
    .trim()
    .toLowerCase();
  const uid = String(req.get("X-User-Uid") || "").trim();
  const name = String(req.get("X-User-Name") || "").trim();
  const classes = parseAssignedClasses(req.get("X-User-Classes"));

  if (!role || !uid || !name) {
    return res.status(401).json({
      status: "error",
      message: "Missing dashboard identity headers",
    });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return res.status(403).json({
      status: "error",
      message: "Invalid role",
    });
  }

  if (role === "tutor" && classes.length === 0) {
    return res.status(403).json({
      status: "error",
      message: "Tutors must have assigned classes",
    });
  }

  req.user = {
    role,
    uid,
    name,
    classes,
  };

  return next();
}

function hasFullFeedbackAccess(user) {
  return FULL_ACCESS_ROLES.has(user.role);
}

function canAccessFeedback(user, feedback) {
  if (hasFullFeedbackAccess(user)) {
    return true;
  }

  const feedbackClass = normalizeClassLabel(feedback.classLabel);

  return user.role === "tutor" && user.classes.includes(feedbackClass);
}

function redactFeedbackForUser(user, feedback) {
  if (hasFullFeedbackAccess(user)) {
    return feedback;
  }

  const redacted = { ...feedback };

  for (const field of TUTOR_REDACTED_FIELDS) {
    delete redacted[field];
  }

  return redacted;
}

module.exports = {
  requireIngestSecret,
  requireDashboardUser,
  canAccessFeedback,
  redactFeedbackForUser,
  normalizeClassLabel,
};
