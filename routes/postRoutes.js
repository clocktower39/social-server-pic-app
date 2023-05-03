const express = require('express');
const postController = require('../controllers/postController');
const auth = require("../middleware/auth");
const { uploadUserPost } = require("../mygridfs");

const router = express.Router();

router.get('/explore', postController.get_explore_posts);
router.get('/post/image/:id', postController.get_post_image);
router.post('/post/upload', auth, uploadUserPost.single("file"), postController.upload_post_image);
router.post('/post/delete', auth, postController.delete_post);
router.get('/post/followingPosts', auth, postController.get_following_posts);
router.post('/post/like', auth, postController.like_post);
router.post('/post/unlike', auth, postController.unlike_post);
router.post('/post/comment', auth, postController.comment_post);
router.post('/post/deleteComment', auth, postController.delete_comment_post);
router.post('/post/likeComment', auth, postController.like_comment_post);
router.post('/post/unlikeComment', auth, postController.unlike_comment_post);

module.exports = router;