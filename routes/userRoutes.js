const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");
const { uploadProfilePicture } = require("../mygridfs");

const router = express.Router();

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.get('/user/profile/:username', userController.get_user_profile_page);
router.get('/user/profilePicture/:id', userController.get_profile_picture);
router.get('/user/remove/image/', auth, userController.delete_profile_picture);
router.post('/user/upload/profilePicture', auth, uploadProfilePicture.single("file"), userController.upload_profile_picture);
router.post('/login', userController.login_user);
router.post('/search', userController.search_user);
router.post('/signup', userController.signup_user);

module.exports = router;