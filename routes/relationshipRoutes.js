const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/myRelationships', verifyAccessToken, relationshipController.get_my_relationships);
router.post('/getRelationships', verifyAccessToken, relationshipController.get_relationships);
router.post('/follow', verifyAccessToken, relationshipController.request_follow);
router.post('/unfollow', verifyAccessToken, relationshipController.request_unfollow);

module.exports = router;