const User = require("../models/user");
const Post = require("../models/post");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { verifyRefreshToken } = require("../middleware/auth");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const createTokens = (user) => {
  const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
    expiresIn: "180m", // Set a shorter expiration for access tokens
  });

  const refreshToken = jwt.sign(user._doc, REFRESH_TOKEN_SECRET, {
    expiresIn: "90d", // Set a longer expiration for refresh tokens
  });

  return { accessToken, refreshToken };
};

const login_user = (req, res, next) => {
  User.findOne({ username: req.body.username })
    .then((user) => {
      if (!user) {
        res.send({
          authenticated: false,
          error: { username: "Username not found" },
        });
      } else {
        user
          .comparePassword(req.body.password)
          .then((isMatch) => {
            if (isMatch) {
              const tokens = createTokens(user);
              res.send({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
              });
            } else {
              res.send({
                error: { password: "Incorrect Password" },
              });
            }
          })
          .catch((err) => {
            console.error("Error comparing password:", err);
            res.send({ error: err, authenticated: false });
          });
      }
    })
    .catch((err) => next(err));
};

const refresh_tokens = (req, res, next) => {
  const { refreshToken } = req.body;

  verifyRefreshToken(refreshToken)
    .then((verifiedRefreshToken) => {
      return User.findById(verifiedRefreshToken._id).exec();
    })
    .then((user) => {
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      const tokens = createTokens(user);
      res.send({
        accessToken: tokens.accessToken,
      });
    })
    .catch((err) => res.status(403).send({ error: "Invalid refresh token", err }));
};

const signup_user = (req, res, next) => {
  let user = new User(req.body);

  let saveUser = () => {
    user
      .save()
      .then(() => {
        res.send({
          status: "success",
          user,
        });
      })
      .catch((err) => next(err));
  };
  saveUser();
};

const change_password = (req, res, next) => {
  User.findById(res.locals.user._id)
    .then((user) => {
      if (!user) {
        res.send({
          error: { status: "User not found" },
        });
      } else {
        user.comparePassword(req.body.currentPassword, function (err, isMatch) {
          if (err) {
            res.send({
              error: { status: "Incorrect Current Password" },
            });
          }
          if (isMatch) {
            user.password = req.body.newPassword;
            user.save().then((savedUser) => {
              const accessToken = jwt.sign(savedUser._doc, ACCESS_TOKEN_SECRET, {
                expiresIn: "30d", // expires in 30 days
              });
              res.send({ accessToken });
            });
          } else {
            res.send({
              error: { status: "Password change failed." },
            });
          }
        });
      }
    })
    .catch((err) => next(err));
};

const search_user = (req, res, next) => {
  const { username } = req.body;

  // if search string is empty, return no users instead of all
  if (username === "") {
    return res.send({ users: [] });
  }

  const searchUser = new RegExp(username, "i");
  User.find({ username: searchUser })
    .limit(15)
    .exec()
    .then((users) => {
      return res.send({ users });
    })
    .catch((err) => next(err));
};

const update_user = (req, res, next) => {
  User.findByIdAndUpdate(res.locals.user._id, { ...req.body }, { new: true })
  .then((user) => {
    if (!user) {
      res.send({
        status: "error",
        err: "No user found",
      });
    } else {
      const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
        expiresIn: "30d", // expires in 30 days
      });
      res.send({ status: "Successful", accessToken });
    }
  }).catch((err) => next(err));
};

const upload_profile_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePicture",
    });

    const user = await User.findById(res.locals.user._id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Check if the user has a profile picture before deleting
    if (user.profilePicture) {
      const existingFile = await gridfsBucket
        .find({ _id: new mongoose.Types.ObjectId(user.profilePicture) })
        .toArray();

      // Add a log to check the existing profile picture details
      console.log("Checking if profile picture exists:", existingFile);

      if (existingFile.length > 0) {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      } else {
        console.warn(`File not found for id ${user.profilePicture}, skipping delete.`);
      }
    }

    const filename = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);

    // Upload the new profile picture to GridFS
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });
    uploadStream.end(req.file.buffer);

    uploadStream.on("finish", async () => {
      // Save the new file ID to the user profile
      user.profilePicture = new mongoose.Types.ObjectId(uploadStream.id);
      const savedUser = await user.save();
      const tokens = createTokens(savedUser);

      res.status(200).json({
        accessToken: tokens.accessToken,
      });
    });

    uploadStream.on("error", (err) => {
      console.error("Error during file upload:", err);
      res.status(500).send({ error: "Error uploading file", err });
    });
  } catch (err) {
    console.error("Error in profile picture upload process:", err);
    res.status(500).send({ error: "Failed to upload profile picture", err });
  }
};

const get_profile_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePicture",
    });

    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No profile picture found" });
    }

    if (files[0].contentType === "image/jpeg" || files[0].contentType === "image/png") {
      const readstream = gridfsBucket.openDownloadStream(files[0]._id);
      readstream.pipe(res);
    } else {
      res.status(404).json({ error: "File is not an image" });
    }
  } catch (err) {
    res.status(500).send({ error: "Error retrieving profile picture", err });
  }
};

const delete_profile_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePicture",
    });

    const user = await User.findById(res.locals.user._id);
    if (user && user.profilePicture) {
      await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      user.profilePicture = undefined;
      await user.save();
      return res.sendStatus(200);
    } else {
      return res.sendStatus(204); // No content to delete
    }
  } catch (err) {
    res.status(500).send({ error: "Failed to delete profile picture", err });
  }
};

const get_user_profile_page = (req, res, next) => {
  User.findOne({ username: req.params.username })
    .then(async (user) => {
      if (user) {
        user.email = undefined;
        user.password = undefined;

        const posts = await Post.find({ user: user._id })
          .populate("user", "username profilePicture")
          .populate("comments", "comment")
          .populate("comments.user", "username profilePicture")
          .populate("likes", "username profilePicture")
          .exec();

        const followersList = await Relationship.find({ user: user._id })
          .populate("user", "username profilePicture firstName lastName")
          .populate("follower", "username profilePicture firstName lastName");
        const followingList = await Relationship.find({ follower: user._id })
          .populate("user", "username profilePicture firstName lastName")
          .populate("follower", "username profilePicture firstName lastName");

        const followers = followersList.map((u) => u.follower);
        const following = followingList.map((u) => u.user);

        res.send({ user, posts, followers, following });
      } else {
        res.send({ err: "No User found" });
      }
    })
    .catch((err) => next(err));
};

module.exports = {
  login_user,
  signup_user,
  refresh_tokens,
  change_password,
  search_user,
  update_user,
  upload_profile_picture,
  get_profile_picture,
  delete_profile_picture,
  get_user_profile_page,
};
