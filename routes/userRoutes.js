const express = require('express');
const userController = require('../controllers/userController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { validate, Joi } = require('express-validation');
const { uploadPicture } = require("../mygridfs");

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

router.get('/user/profile/:username', userController.get_user_profile_page);
router.get('/user/profilePicture/:id', userController.get_profile_picture);
router.get('/user/remove/image/', verifyAccessToken, userController.delete_profile_picture);
router.post('/user/upload/profilePicture', verifyAccessToken, uploadPicture.single("file"), userController.upload_profile_picture);
router.post('/user/update', verifyAccessToken, validate(userUpdateValidate, {}, {}), userController.update_user);
router.post('/user/changePassword', verifyAccessToken, userController.change_password);
router.post("/refresh-tokens", userController.refresh_tokens);
router.post('/login', userController.login_user);
router.post('/search', userController.search_user);
router.post('/signup', userController.signup_user);

module.exports = router;