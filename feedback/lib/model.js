const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const FEEDBACK_COLLECTION = "feedback";

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
    score += 4;
  }

  if (rating <= 2) {
    score += 4;
  } else if (rating === 3) {
    score += 2;
  }

  if (continuing === "No") {
    score += 4;
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

function buildFeedbackDocument({
  parent_name,
  student_name,
  class_label,
  rating,
  continuing,
  contact_request,
  comments,
  source_id,
}) {
  const contactRequested = toContactRequested(contact_request);
  const priorityScore = calculatePriorityScore({
    rating,
    continuing,
    contactRequested,
  });

  return {
    parentName: String(parent_name).trim(),
    studentName: String(student_name).trim(),
    classLabel: String(class_label).trim(),
    rating,
    continuing: continuing ?? null,
    contactRequested,
    comments: comments ?? "",
    priorityScore,
    priority: getPriorityLabel(priorityScore),
    status: "open",
    handledByUid: null,
    handledByName: null,
    handledAt: null,
    sensitive: false,
    createdAt: FieldValue.serverTimestamp(),
    sourceId: source_id || null,
  };
}

function isAlreadyExistsError(error) {
  return error.code === 6 || error.code === "already-exists";
}

async function createFeedback(input) {
  const db = getFirestore();
  const document = buildFeedbackDocument(input);
  const sourceId = input.source_id ? String(input.source_id).trim() : "";

  if (!sourceId) {
    const docRef = await db.collection(FEEDBACK_COLLECTION).add(document);
    return { id: docRef.id, duplicate: false };
  }

  const docRef = db.collection(FEEDBACK_COLLECTION).doc(sourceId);

  try {
    await docRef.create(document);
    return { id: docRef.id, duplicate: false };
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return { id: docRef.id, duplicate: true };
    }

    throw error;
  }
}

function serializeFeedback(doc) {
  const data = doc.data();
  const createdAt = data.createdAt && typeof data.createdAt.toDate === "function"
    ? data.createdAt.toDate().toISOString()
    : data.createdAt || null;
  const handledAt = data.handledAt && typeof data.handledAt.toDate === "function"
    ? data.handledAt.toDate().toISOString()
    : data.handledAt || null;

  return {
    id: doc.id,
    ...data,
    createdAt,
    handledAt,
  };
}

async function listFeedback() {
  const db = getFirestore();
  const snapshot = await db
    .collection(FEEDBACK_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map(serializeFeedback);
}

async function getFeedbackById(id) {
  const db = getFirestore();
  const doc = await db.collection(FEEDBACK_COLLECTION).doc(id).get();

  if (!doc.exists) {
    return null;
  }

  return serializeFeedback(doc);
}

async function markFeedbackHandled(id, { uid, name }) {
  const db = getFirestore();
  const docRef = db.collection(FEEDBACK_COLLECTION).doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  await docRef.update({
    status: "handled",
    handledByUid: uid,
    handledByName: name,
    handledAt: FieldValue.serverTimestamp(),
  });

  return getFeedbackById(id);
}

module.exports = {
  createFeedback,
  listFeedback,
  getFeedbackById,
  markFeedbackHandled,
  calculatePriorityScore,
  getPriorityLabel,
};
