const { validateFeedback } = require("../helpers/validator");
const { createFeedback } = require("../lib/model");

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

      const { id } = await createFeedback(validation.value);

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
};

module.exports = FeedBackController;
