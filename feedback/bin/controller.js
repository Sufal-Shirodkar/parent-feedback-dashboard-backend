const { validateFeedback } = require("../helpers/validator");
const { canAccessFeedback, redactFeedbackForUser } = require("../helpers/access");
const { parsePagination, paginateItems } = require("../helpers/pagination");
const {
  createFeedback,
  listFeedback,
  getFeedbackById,
  markFeedbackHandled,
} = require("../lib/model");
const { getWeeklyDigest } = require("../lib/digest");

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
      const paginationQuery = parsePagination(req.query);

      if (paginationQuery.error) {
        return res.status(400).json({
          status: "error",
          message: paginationQuery.error,
        });
      }

      const feedback = await listFeedback();
      const visible = feedback
        .filter((item) => canAccessFeedback(req.user, item))
        .map((item) => redactFeedbackForUser(req.user, item));
      const { items, pagination } = paginateItems(visible, paginationQuery.value);

      return res.status(200).json({
        status: "ok",
        feedback: items,
        pagination,
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

  async weeklyDigest(req, res) {
    try {
      const result = await getWeeklyDigest(req.user);

      return res.status(200).json({
        status: "ok",
        ...result,
      });
    } catch (error) {
      console.error("Failed to generate weekly digest:", error.message);

      if (error.code === "GEMINI_NOT_CONFIGURED") {
        return res.status(503).json({
          status: "error",
          message: "Weekly digest is not configured",
        });
      }

      return res.status(502).json({
        status: "error",
        message: "Failed to generate weekly digest",
      });
    }
  },

  async proxyRoster(req, res) {
    const page = String(req.query.page || "1");
    const apiKey = process.env.ROSTER_API_KEY || req.query.api_key || "";
    const target = new URL("https://contourcandidate.web.app/api/roster");
    target.searchParams.set("page", page);

    if (apiKey) {
      target.searchParams.set("api_key", apiKey);
    }

    try {
      const response = await fetch(target);
      const payload = await response.json().catch(() => null);

      if (!payload) {
        return res.status(502).json({
          status: "error",
          message: "Unable to load staff roster",
        });
      }

      return res.status(response.status).json(payload);
    } catch (error) {
      console.error("Failed to load staff roster:", error.message);

      return res.status(502).json({
        status: "error",
        message: "Unable to load staff roster",
      });
    }
  },
};

module.exports = FeedBackController;
