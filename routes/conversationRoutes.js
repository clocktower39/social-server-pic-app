const express = require('express');
const conversationController = require('../controllers/conversationController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/conversation/create', auth, conversationController.create_conversation);
router.post('/conversation/send', auth, conversationController.send_message);

module.exports = router;