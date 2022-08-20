const User = require('../models/user');
const Post = require('../models/post');
const Relationship = require('../models/relationship');
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;


const upload_post_image = (req, res) => {
    let post = new Post(req.body);
    post.user = res.locals.user._id;
    post.image = res.req.file.id;

    let savePost = () => {
        post.save((err) => {
            if(err) {
                res.send({err: { ...err.errors } });
            }
            else {
                res.json({ src: res.req.file.filename });
            }
        })
    }
    savePost();
}

const get_post_image = (req, res) => {
    if (req.params.id) {
        let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'post'
        });

        gridfsBucket.find({ _id: mongoose.Types.ObjectId(req.params.id) }).toArray((err, files) => {
            // Check if files
            if (!files || files.length === 0) {
                return res.status(404).json({
                    err: 'No files exist'
                });
            }

            // Check if image
            if (files[0].contentType === 'image/jpeg' || files[0].contentType === 'image/png') {
                // Read output to browser
                const readstream = gridfsBucket.openDownloadStream(files[0]._id);
                readstream.pipe(res);
            } else {
                res.status(404).json({
                    err: 'Not an image'
                });
            }
        });
    }
    else {
        res.status(404).json({
            err: 'Missing parameter',
        })
    }
}

const get_following_posts = async (req, res) => {
    // Recieve list of usernames to load posts for home page
    const followingList = await Relationship.find({ follower: res.locals.user._id });
    let following = followingList.map(r => r.user);
    following.push(res.locals.user._id);

    const postRequest = following.map(user => {
        return Post.find({ user })
            .populate('user', 'username profilePicture')
            .populate('comments', 'comment')
            .populate('comments.user', 'username profilePicture')
            .populate('likes', 'username profilePicture')
            .exec();
    })
    const postResponse = await Promise.all(postRequest);

    const sortedPosts = postResponse.flat().sort((a, b) => b.timestamp - a.timestamp);
    res.send(sortedPosts);
}

const like_post = async (req, res) => {
    Post.update({ _id: req.body.id }, { $push: { likes: res.locals.user._id } }, (err, post) => {
        if(err) return res.send(err);
        res.sendStatus(200);
    })
}

module.exports = {
    upload_post_image,
    get_post_image,
    get_following_posts,
    like_post,
}