const express = require("express");
const notificationController = require("../controllers/notificationController");
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

router.get("/notifications", verifyAccessToken, notificationController.get_notifications);
router.post("/notifications/read", verifyAccessToken, notificationController.mark_notifications_read);

module.exports = router;
