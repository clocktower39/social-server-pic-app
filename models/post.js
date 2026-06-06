const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const CommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const PostSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "post.files" },
    caption: { type: String, default: "" },
    location: { type: String, default: "" },
    filter: { type: String, default: "normal" },
    tags: { type: [TagSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    hashtags: { type: [String], default: [], index: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { minimize: false }
);

const Post = mongoose.model('Post', PostSchema);
module.exports = Post;
