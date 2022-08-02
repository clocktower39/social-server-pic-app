const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.get('/followingPosts', auth, userController.get_following_posts);
router.post('/login', userController.login_user);
router.post('/search', userController.search_user);
router.post('/signup', userController.signup_user);

module.exports = router;