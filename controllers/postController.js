const Post = require("../models/post");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");

const upload_post_image = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "post"
    });

    // Create a new post instance
    let post = new Post(req.body);
    post.user = res.locals.user._id;

    // Generate a random filename for the image
    const filename = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);

    // Upload the image to GridFS
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype
    });
    uploadStream.end(req.file.buffer);

    // Handle the upload completion
    uploadStream.on('finish', async () => {
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

    uploadStream.on('error', (err) => {
      console.error("Error during file upload:", err);
      res.status(500).send({ error: "Error uploading file", err });
    });

  } catch (err) {
    console.error("Error in post image upload process:", err);
    res.status(500).send({ error: "Failed to upload post image", err });
  }
};

const get_explore_posts = async (req, res) => {
  try {
    const posts = await Post.aggregate([
      { $sample: { size: 15 } }, // fetch 15 random posts
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } }, // populate the user field
      { $unwind: '$user' }, // destructure the user array to get the single user object
      {
        $lookup: {
          from: 'post.files',
          localField: 'image',
          foreignField: '_id',
          as: 'image'
        }
      },
      { $unwind: '$image' }
    ]);
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};


const get_post_image = (req, res) => {
  if (req.params.id) {
    let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "post",
    });

    gridfsBucket.find({ _id: mongoose.Types.ObjectId(req.params.id) }).toArray((err, files) => {
      // Check if files
      if (!files || files.length === 0) {
        return res.status(404).json({
          err: "No files exist",
        });
      }

      // Check if image
      if (files[0].contentType === "image/jpeg" || files[0].contentType === "image/png") {
        // Read output to browser
        const readstream = gridfsBucket.openDownloadStream(files[0]._id);
        readstream.pipe(res);
      } else {
        res.status(404).json({
          err: "Not an image",
        });
      }
    });
  } else {
    res.status(404).json({
      err: "Missing parameter",
    });
  }
};

const get_following_posts = async (req, res) => {
  // Recieve list of usernames to load posts for home page
  const followingList = await Relationship.find({ follower: res.locals.user._id });
  let following = followingList.map((r) => r.user);
  following.push(res.locals.user._id);

  const postRequest = following. map((user) => {
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

const like_post = async (req, res) => {
  Post.updateOne(
    { _id: req.body.id },
    { $addToSet: { likes: res.locals.user._id } },
    (err, post) => {
      if (err) return res.send(err);
      res.sendStatus(200);
    }
  );
};

const unlike_post = async (req, res) => {
  Post.updateOne({ _id: req.body.id }, { $pull: { likes: res.locals.user._id } }, (err, post) => {
    if (err) return res.send(err);
    res.sendStatus(200);
  });
};

const comment_post = async (req, res) => {
  Post.findById(req.body.id, (err, post) => {
    if (err) return res.send(err);
    post.comments.push({
      user: res.locals.user._id,
      comment: req.body.comment,
      likes: [],
    });
    post.save((err, p) => {
      if (err) return res.send(err);
      return res.sendStatus(200);
    });
  });
};

const delete_comment_post = async (req, res) => {
  Post.updateOne({ _id: req.body.id }, { $pull: { 'comments': { _id: req.body.commentId } } }, (err, post) => {
    if (err) return res.send(err);
    res.sendStatus(200);
  });
};

const like_comment_post = async (req, res) => {
  Post.updateOne(
    { _id: req.body.id },
    { $addToSet: { 'comments': { likes: res.locals.user._id } } },
    (err, post) => {
      if (err) return res.send(err);
      res.sendStatus(200);
    }
  );
};

const unlike_comment_post = async (req, res) => {
  Post.updateOne({ _id: req.body.id }, { $pull: { 'comments' : { likes: res.locals.user._id } } }, (err, post) => {
    if (err) return res.send(err);
    res.sendStatus(200);
  });
};

const delete_post = async (req, res) => {
  let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'post'
  });

  Post.deleteOne({ _id: req.body.postId, user: res.locals.user._id }, (err, post) => {
      if (err) return res.send(err);
      gridfsBucket.delete(mongoose.Types.ObjectId(req.body.imageId));
      return res.sendStatus(200);
  })
}

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
