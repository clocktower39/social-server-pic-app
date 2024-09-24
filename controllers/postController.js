const Post = require("../models/post");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");

const upload_post_image = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "post",
    });

    // Create a new post instance
    let post = new Post(req.body);
    post.user = res.locals.user._id;

    // Generate a random filename for the image
    const filename = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);

    // Upload the image to GridFS
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });
    uploadStream.end(req.file.buffer);

    // Handle the upload completion
    uploadStream.on("finish", async () => {
      // Save the image's ObjectId in the post
      post.image = new mongoose.Types.ObjectId(uploadStream.id);

      // Save the post to the database
      post.save((err) => {
        if (err) {
          return res.status(500).send({ error: err.errors });
        }

        // Respond with the uploaded image filename (or any other necessary data)
        res.json({ src: filename });
      });
    });

    uploadStream.on("error", (err) => {
      console.error("Error during file upload:", err);
      res.status(500).send({ error: "Error uploading file", err });
    });
  } catch (err) {
    console.error("Error in post image upload process:", err);
    res.status(500).send({ error: "Failed to upload post image", err });
  }
};

const get_explore_posts = async (req, res, next) => {
  try {
    const posts = await Post.aggregate([
      { $sample: { size: 15 } }, // fetch 15 random posts
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } }, // populate the user field
      { $unwind: "$user" }, // destructure the user array to get the single user object
      {
        $lookup: {
          from: "post.files",
          localField: "image",
          foreignField: "_id",
          as: "image",
        },
      },
      { $unwind: "$image" },
    ]);
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const get_post_image = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "post",
    });

    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No picture found" });
    }

    if (files[0].contentType === "image/jpeg" || files[0].contentType === "image/png") {
      const readstream = gridfsBucket.openDownloadStream(files[0]._id);
      readstream.pipe(res);
    } else {
      res.status(404).json({ error: "File is not an image" });
    }
  } catch (err) {
    res.status(500).send({ error: "Error retrieving post picture", err });
  }
};

const get_following_posts = async (req, res, next) => {
  // Recieve list of usernames to load posts for home page
  const followingList = await Relationship.find({ follower: res.locals.user._id });
  let following = followingList.map((r) => r.user);
  following.push(res.locals.user._id);

  const postRequest = following.map((user) => {
    return Post.find({ user })
      .populate("user", "username profilePicture")
      .populate("comments", "comment")
      .populate("comments.user", "username profilePicture")
      .populate("likes", "username profilePicture")
      .exec();
  });
  const postResponse = await Promise.all(postRequest);

  const sortedPosts = postResponse.flat().sort((a, b) => b.timestamp - a.timestamp);
  res.send(sortedPosts);
};

const like_post = async (req, res, next) => {
  Post.updateOne({ _id: req.body.id }, { $addToSet: { likes: res.locals.user._id } })
    .then((post) => {
      res.sendStatus(200);
    })
    .catch((err) => next(err));
};

const unlike_post = async (req, res, next) => {
  Post.updateOne({ _id: req.body.id }, { $pull: { likes: res.locals.user._id } })
    .then((post) => {
      res.sendStatus(200);
    })
    .catch((err) => next(err));
};

const comment_post = async (req, res, next) => {
  Post.findById(req.body.id)
    .then((post) => {
      post.comments.push({
        user: res.locals.user._id,
        comment: req.body.comment,
        likes: [],
      });
      post
        .save()
        .then((p) => {
          return res.sendStatus(200);
        })
        .catch((err) => next(err));
    })
    .catch((err) => next(err));
};

const delete_comment_post = async (req, res, next) => {
  Post.updateOne({ _id: req.body.id }, { $pull: { comments: { _id: req.body.commentId } } })
    .then((post) => {
      res.sendStatus(200);
    })
    .catch((err) => next(err));
};

const like_comment_post = async (req, res, next) => {
  Post.updateOne({ _id: req.body.id }, { $addToSet: { comments: { likes: res.locals.user._id } } })
    .then((post) => {
      res.sendStatus(200);
    })
    .catch((err) => next(err));
};

const unlike_comment_post = async (req, res, next) => {
  Post.updateOne({ _id: req.body.id }, { $pull: { comments: { likes: res.locals.user._id } } })
    .then((post) => {
      res.sendStatus(200);
    })
    .catch((err) => next(err));
};

const delete_post = async (req, res, next) => {
  let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "post",
  });

  Post.deleteOne({ _id: req.body.postId, user: res.locals.user._id })
    .then((post) => {
      gridfsBucket.delete(new mongoose.Types.ObjectId(req.body.imageId));
      return res.sendStatus(200);
    })
    .catch((err) => next(err));
};

module.exports = {
  get_explore_posts,
  upload_post_image,
  get_post_image,
  get_following_posts,
  like_post,
  unlike_post,
  comment_post,
  delete_comment_post,
  like_comment_post,
  unlike_comment_post,
  delete_post,
};
