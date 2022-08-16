const express = require('express');
const postController = require('../controllers/postController');
const auth = require("../middleware/auth");
const { uploadUserPost } = require("../mygridfs");

const router = express.Router();

router.get('/post/image/:id', postController.get_post_image);
router.post('/post/upload', auth, uploadUserPost.single("file"), postController.upload_post_image);
router.get('/post/followingPosts', auth, postController.get_following_posts);

module.exports = router;