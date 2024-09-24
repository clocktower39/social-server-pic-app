const mongoose = require('mongoose');

const PostSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "post.files" },
    comments: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            comment: { type: String },
            likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        }
    ],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    location: { type: String },
    timestamp: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', PostSchema);
module.exports = Post;