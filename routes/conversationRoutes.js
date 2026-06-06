const express = require('express');
const conversationController = require('../controllers/conversationController');
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

router.get('/conversation/getConversations', verifyAccessToken, conversationController.get_conversations);
router.post('/conversation/create', verifyAccessToken, conversationController.create_conversation);
router.post('/conversation/message/send', verifyAccessToken, conversationController.send_message);
router.post('/conversation/message/delete', verifyAccessToken, conversationController.delete_message);
router.post('/conversation/addMembers', verifyAccessToken, conversationController.add_members);
router.post('/conversation/removeMember', verifyAccessToken, conversationController.remove_member);
router.post('/conversation/leave', verifyAccessToken, conversationController.leave_conversation);
router.post('/conversation/rename', verifyAccessToken, conversationController.rename_group);
router.get('/conversation/:id', verifyAccessToken, conversationController.get_conversation);

module.exports = router;
