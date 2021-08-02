const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/followers', userController.get_followers);
router.post('/followUser', userController.follow_user);
router.post('/getPosts', userController.get_posts);
router.post('/login', userController.login_user);
router.post('/search', userController.search_user);
router.post('/signup', userController.signup_user);
router.post('/updateAccount', userController.update_user);

module.exports = router;