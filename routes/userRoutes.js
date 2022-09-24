const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");
const { validate, Joi } = require('express-validation');
const { uploadProfilePicture } = require("../mygridfs");

const router = express.Router();


const userUpdateValidate = {
    body: Joi.object({
        firstName: Joi.string(),
        lastName: Joi.string(),
        username: Joi.string(),
        email: Joi.string().email(),
        phoneNumber: Joi.string(),
        description: Joi.string(),
        themeMode: Joi.string(),
    }),
}

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.get('/user/profile/:username', userController.get_user_profile_page);
router.get('/user/profilePicture/:id', userController.get_profile_picture);
router.get('/user/remove/image/', auth, userController.delete_profile_picture);
router.post('/user/upload/profilePicture', auth, uploadProfilePicture.single("file"), userController.upload_profile_picture);
router.post('/user/update', auth, validate(userUpdateValidate, {}, {}), userController.update_user);
router.post('/user/changePassword', auth, userController.change_password);
router.post('/login', userController.login_user);
router.post('/search', userController.search_user);
router.post('/signup', userController.signup_user);

module.exports = router;