const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/myRelationships', auth, relationshipController.get_my_relationships);
router.post('/getRelationships', auth, relationshipController.get_relationships);
router.post('/follow', auth, relationshipController.request_follow);

module.exports = router;