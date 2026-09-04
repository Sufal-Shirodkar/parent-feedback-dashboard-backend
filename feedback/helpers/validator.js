const { feedbackSchema } = require("../lib/schema");

function validateFeedback(body = {}) {
  const { error, value } = feedbackSchema.validate(body, {
    abortEarly: false,
  });

  if (!error) {
    return {
      value: {
        parent_name: value.parent_name,
        student_name: value.student_name,
        class_label: value.class_label,
        rating: value.rating,
        continuing: value.continuing,
        contact_request: value.contact_request,
        comments: value.comments,
      },
    };
  }

  const missingFields = [
    ...new Set(
      error.details
        .filter((detail) =>
          ["any.required", "string.empty", "string.min"].includes(detail.type)
        )
        .map((detail) => detail.path.join("."))
    ),
  ];

  if (missingFields.length > 0) {
    return {
      error: `Missing required fields: ${missingFields.join(", ")}`,
    };
  }

  const ratingError = error.details.find((detail) => detail.path[0] === "rating");

  if (ratingError) {
    return {
      error: "rating must be a number",
    };
  }

  return {
    error: error.details[0].message,
  };
}

module.exports = {
  validateFeedback,
};
