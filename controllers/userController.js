const User = require("../models/user");
const Post = require("../models/post");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const sharp = require("sharp");
const { verifyRefreshToken } = require("../middleware/auth");
const { resizeImage } = require("../utils/image");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRY = "180m";
const REFRESH_TOKEN_EXPIRY = "90d";

const sanitizeUser = (user) => {
  if (!user) return user;
  const obj = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.email;
  return obj;
};

const createTokens = (user) => {
  const payload = typeof user.toObject === "function" ? user.toObject() : { ...user._doc };
  delete payload.password;
  delete payload.email;

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return { accessToken, refreshToken };
};

const signAccessToken = (user) => {
  const payload = typeof user.toObject === "function" ? user.toObject() : { ...user._doc };
  delete payload.password;
  delete payload.email;
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const login_user = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username }).exec();
    if (!user) {
      return res.status(404).json({ error: { username: "Username not found" } });
    }
    const isMatch = await user.comparePassword(req.body.password);
    if (!isMatch) {
      return res.status(401).json({ error: { password: "Incorrect Password" } });
    }
    const tokens = createTokens(user);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
};

const refresh_tokens = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const verified = await verifyRefreshToken(refreshToken);
    const user = await User.findById(verified._id).exec();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const accessToken = signAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid refresh token" });
  }
};

const signup_user = async (req, res, next) => {
  try {
    const user = new User(req.body);
    const saved = await user.save();
    res.status(201).json({ status: "success", user: sanitizeUser(saved) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: { username: "Username already taken" } });
    }
    next(err);
  }
};

const change_password = async (req, res, next) => {
  try {
    const user = await User.findById(res.locals.user._id).exec();
    if (!user) {
      return res.status(404).json({ error: { status: "User not found" } });
    }
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: { status: "Incorrect current password" } });
    }
    user.password = req.body.newPassword;
    const savedUser = await user.save();
    const accessToken = signAccessToken(savedUser);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

const search_user = async (req, res, next) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.json({ users: [] });
    }
    const regex = new RegExp(escapeRegex(username), "i");
    const users = await User.find({ username: regex })
      .select("username firstName lastName profilePicture")
      .limit(15)
      .exec();
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const update_user = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    delete updates.password;
    delete updates.profilePicture;
    const user = await User.findByIdAndUpdate(res.locals.user._id, updates, { new: true }).exec();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const accessToken = signAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: "Username or email already in use" });
    }
    next(err);
  }
};

const getBucket = (bucketName) =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });

const upload_profile_picture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const gridfsBucket = getBucket("profilePicture");
    const user = await User.findById(res.locals.user._id).exec();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.profilePicture) {
      try {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      } catch (err) {
        console.warn("Could not delete old profile picture:", err.message);
      }
    }

    let processedBuffer;
    let processedMime;
    try {
      const result = await resizeImage(req.file.buffer, req.file.mimetype, { maxDimension: 512, jpegQuality: 80 });
      processedBuffer = result.buffer;
      processedMime = result.mime;
    } catch (err) {
      console.warn("Profile picture resize failed, storing original:", err.message);
      processedBuffer = req.file.buffer;
      processedMime = req.file.mimetype;
    }

    const filename =
      crypto.randomBytes(16).toString("hex") + (path.extname(req.file.originalname) || ".jpg");

    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: processedMime,
    });
    uploadStream.end(processedBuffer);

    uploadStream.on("error", (err) => {
      console.error("Error during file upload:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error uploading file" });
      }
    });

    uploadStream.on("finish", async () => {
      try {
        user.profilePicture = new mongoose.Types.ObjectId(uploadStream.id);
        const savedUser = await user.save();
        const tokens = createTokens(savedUser);
        res.status(200).json({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          profilePicture: user.profilePicture.toString(),
        });
      } catch (err) {
        console.error("Error saving user:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to save profile picture" });
        }
      }
    });
  } catch (err) {
    console.error("Error in profile picture upload process:", err);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
};

const get_profile_picture = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "No profile picture found" });
    }
    const gridfsBucket = getBucket("profilePicture");
    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No profile picture found" });
    }

    await streamProfilePicture(res, gridfsBucket, files[0]);
  } catch (err) {
    console.error("get_profile_picture error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error retrieving profile picture" });
    }
  }
};

const detectImageFormat = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.toString("ascii", 8, 12).toLowerCase();
    if (["heic", "heix", "heim", "heis", "mif1", "msf1", "hevc", "hevx", "hevm"].includes(brand)) return "heic";
    if (["avif", "avis"].includes(brand)) return "avif";
    return "heif";
  }
  return null;
};

const formatToContentType = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/jpeg",
  avif: "image/jpeg",
  heif: "image/jpeg",
};

const streamProfilePicture = async (res, gridfsBucket, file) => {
  const downloadStream = gridfsBucket.openDownloadStream(file._id);
  const firstChunk = await new Promise((resolve, reject) => {
    downloadStream.once("data", resolve);
    downloadStream.once("error", reject);
  });

  const format = detectImageFormat(firstChunk);
  if (!format) {
    downloadStream.destroy();
    return res.status(404).json({ error: "File is not an image" });
  }

  const needsReencode = format === "heic" || format === "heif" || format === "avif";

  if (!needsReencode) {
    res.set("Content-Type", formatToContentType[format] || "image/jpeg");
    res.write(firstChunk);
    downloadStream.on("error", (err) => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    downloadStream.pipe(res);
    return;
  }

  const chunks = [firstChunk];
  downloadStream.on("data", (c) => chunks.push(c));
  await new Promise((resolve) => {
    downloadStream.on("end", resolve);
    downloadStream.on("error", () => resolve());
  });
  const buffer = Buffer.concat(chunks);

  res.set("Content-Type", "image/jpeg");
  sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 512, height: 512, fit: "cover" })
    .jpeg({ quality: 80, mozjpeg: true })
    .on("error", (err) => {
      console.error("Profile transform error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Error processing image" });
      else res.end();
    })
    .pipe(res);
};

const delete_profile_picture = async (req, res, next) => {
  try {
    const gridfsBucket = getBucket("profilePicture");
    const user = await User.findById(res.locals.user._id).exec();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.profilePicture) {
      return res.status(204).send();
    }
    try {
      await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
    } catch (err) {
      console.warn("Could not delete profile picture file:", err.message);
    }
    user.profilePicture = undefined;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete profile picture" });
  }
};

const get_user_profile_page = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username }).exec();
    if (!user) {
      return res.status(404).json({ error: "No user found" });
    }

    const viewer = res.locals.user;
    let canViewPosts = !user.isPrivate;
    let isFollowing = false;
    if (user.isPrivate && viewer) {
      if (viewer._id.toString() === user._id.toString()) {
        canViewPosts = true;
      } else {
        const rel = await Relationship.findOne({
          user: user._id,
          follower: viewer._id,
        }).exec();
        isFollowing = Boolean(rel);
        canViewPosts = isFollowing;
      }
    } else if (user.isPrivate && !viewer) {
      canViewPosts = false;
    }

    const [posts, followersList, followingList] = await Promise.all([
      canViewPosts
        ? Post.find({ user: user._id })
            .sort({ timestamp: -1 })
            .populate("user", "username profilePicture firstName lastName")
            .populate({
              path: "comments",
              populate: [
                { path: "user", select: "username profilePicture" },
                { path: "mentions", select: "username profilePicture" },
              ],
            })
            .populate("tags.user", "username profilePicture")
            .populate("likes", "username profilePicture")
            .exec()
        : Promise.resolve([]),
      Relationship.find({ user: user._id })
        .populate("follower", "username profilePicture firstName lastName")
        .exec(),
      Relationship.find({ follower: user._id })
        .populate("user", "username profilePicture firstName lastName")
        .exec(),
    ]);

    const followers = followersList.map((u) => u.follower);
    const following = followingList.map((u) => u.user);

    res.json({
      user: sanitizeUser(user),
      posts,
      followers,
      following,
      isFollowing,
    });
  } catch (err) {
    next(err);
  }
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
  sanitizeUser,
};
