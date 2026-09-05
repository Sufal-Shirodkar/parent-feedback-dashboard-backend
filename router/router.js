const { Router } = require("express");
const FeedBackController = require("../feedback/bin/controller");
const {
  requireIngestSecret,
  requireDashboardUser,
} = require("../feedback/helpers/access");

const router = Router();

router.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    message: "Feedback backend is running",
  });
});

router.get("/api/roster", FeedBackController.proxyRoster);

router.post("/api/feedback", requireIngestSecret, FeedBackController.create);
router.get("/api/feedback", requireDashboardUser, FeedBackController.list);
router.patch(
  "/api/feedback/:id/handled",
  requireDashboardUser,
  FeedBackController.markHandled
);
router.get(
  "/api/ai/weekly-digest",
  requireDashboardUser,
  FeedBackController.weeklyDigest
);

module.exports = router;
