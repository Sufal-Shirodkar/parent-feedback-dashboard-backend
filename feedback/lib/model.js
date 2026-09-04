const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function toContactRequested(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["yes", "true", "1"].includes(normalized);
  }

  return false;
}

function calculatePriorityScore({ rating, continuing, contactRequested }) {
  let score = 0;

  if (contactRequested) {
    score += 3;
  }

  if (rating <= 2) {
    score += 3;
  }

  if (continuing === "No") {
    score += 2;
  } else if (continuing === "Not sure") {
    score += 1;
  }

  return score;
}

function getPriorityLabel(score) {
  if (score >= 6) {
    return "urgent";
  }

  if (score >= 4) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

async function createFeedback({
  parent_name,
  student_name,
  class_label,
  rating,
  continuing,
  contact_request,
  comments,
}) {
  const contactRequested = toContactRequested(contact_request);
  const priorityScore = calculatePriorityScore({
    rating,
    continuing,
    contactRequested,
  });
  const priority = getPriorityLabel(priorityScore);

  const db = getFirestore();
  const docRef = await db.collection("feedback").add({
    parentName: String(parent_name).trim(),
    studentName: String(student_name).trim(),
    classLabel: String(class_label).trim(),
    rating,
    continuing: continuing ?? null,
    contactRequested,
    comments: comments ?? "",
    priorityScore,
    priority,
    status: "open",
    sensitive: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    id: docRef.id,
  };
}

module.exports = {
  createFeedback,
};
