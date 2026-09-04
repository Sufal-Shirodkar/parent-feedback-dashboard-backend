const { Router } = require("express");
const FeedBackController = require("../feedback/bin/controller");

const router = Router();

router.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    message: "Feedback backend is running",
  });
});

router.post("/api/feedback", FeedBackController.create);

module.exports = router;
