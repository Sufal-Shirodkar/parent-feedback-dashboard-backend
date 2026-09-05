const { validateFeedback } = require("../helpers/validator");
const { canAccessFeedback, redactFeedbackForUser } = require("../helpers/access");
const {
  createFeedback,
  listFeedback,
  getFeedbackById,
  markFeedbackHandled,
} = require("../lib/model");

const FeedBackController = {
  async create(req, res) {
    try {
      const validation = validateFeedback(req.body || {});

      if (validation.error) {
        return res.status(400).json({
          status: "error",
          message: validation.error,
        });
      }

      const { id, duplicate } = await createFeedback(validation.value);

      if (duplicate) {
        return res.status(200).json({
          status: "ok",
          message: "Feedback already exists",
          id,
        });
      }

      return res.status(201).json({
        status: "ok",
        message: "Feedback created successfully",
        id,
      });
    } catch (error) {
      console.error("Failed to create feedback:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to create feedback",
      });
    }
  },

  async list(req, res) {
    try {
      const feedback = await listFeedback();
      const visible = feedback
        .filter((item) => canAccessFeedback(req.user, item))
        .map((item) => redactFeedbackForUser(req.user, item));

      return res.status(200).json({
        status: "ok",
        feedback: visible,
      });
    } catch (error) {
      console.error("Failed to list feedback:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to list feedback",
      });
    }
  },

  async markHandled(req, res) {
    try {
      const existing = await getFeedbackById(req.params.id);

      if (!existing) {
        return res.status(404).json({
          status: "error",
          message: "Feedback not found",
        });
      }

      if (!canAccessFeedback(req.user, existing)) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden",
        });
      }

      const updated = await markFeedbackHandled(req.params.id, {
        uid: req.user.uid,
        name: req.user.name,
      });

      return res.status(200).json({
        status: "ok",
        message: "Feedback marked as handled",
        id: updated.id,
      });
    } catch (error) {
      console.error("Failed to mark feedback as handled:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to mark feedback as handled",
      });
    }
  },
};

module.exports = FeedBackController;
