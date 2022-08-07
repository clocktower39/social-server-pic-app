const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/getRelationships', auth, relationshipController.get_relationships);

module.exports = router;