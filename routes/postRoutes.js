const express = require('express');
const postController = require('../controllers/postController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { uploadPicture } = require("../mygridfs");

const router = express.Router();

router.get('/explore', postController.get_explore_posts);
router.get('/post/image/:id', postController.get_post_image);
router.post('/post/upload', verifyAccessToken, uploadPicture.single("file"), postController.upload_post_image);
router.post('/post/delete', verifyAccessToken, postController.delete_post);
router.get('/post/followingPosts', verifyAccessToken, postController.get_following_posts);
router.post('/post/like', verifyAccessToken, postController.like_post);
router.post('/post/unlike', verifyAccessToken, postController.unlike_post);
router.post('/post/comment', verifyAccessToken, postController.comment_post);
router.post('/post/deleteComment', verifyAccessToken, postController.delete_comment_post);
router.post('/post/likeComment', verifyAccessToken, postController.like_comment_post);
router.post('/post/unlikeComment', verifyAccessToken, postController.unlike_comment_post);

module.exports = router;