const Post = require("../models/post");
const User = require("../models/user");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const crypto = require("crypto");
const path = require("path");
const { createNotification } = require("../utils/notifications");
const { extractHashtags, extractMentionUsernames } = require("../utils/parse");
const { resizeImage } = require("../utils/image");

const getBucket = (bucketName) =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });

const upload_post_image = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const caption = typeof req.body.caption === "string" ? req.body.caption : "";
    const location = typeof req.body.location === "string" ? req.body.location : "";
    const filter = typeof req.body.filter === "string" ? req.body.filter : "normal";

    let tags = [];
    if (req.body.tags) {
      try {
        const parsed = typeof req.body.tags === "string" ? JSON.parse(req.body.tags) : req.body.tags;
        if (Array.isArray(parsed)) {
          tags = parsed
            .filter((t) => t && t.user && typeof t.x === "number" && typeof t.y === "number")
            .map((t) => ({
              user: t.user,
              x: Math.max(0, Math.min(1, Number(t.x))),
              y: Math.max(0, Math.min(1, Number(t.y))),
            }));
        }
      } catch (err) {
        return res.status(400).json({ error: "Invalid tags payload" });
      }
    }

    const hashtags = extractHashtags(caption);

    let processedBuffer;
    let processedMime;
    try {
      const result = await resizeImage(req.file.buffer, req.file.mimetype);
      processedBuffer = result.buffer;
      processedMime = result.mime;
      if (result.resized) {
        console.log(
          `Resized post image: ${result.originalWidth}x${result.originalHeight} -> <=1920px (${req.file.buffer.length} -> ${processedBuffer.length} bytes)`
        );
      }
    } catch (err) {
      console.warn("Image resize failed, storing original:", err.message);
      processedBuffer = req.file.buffer;
      processedMime = req.file.mimetype;
    }

    const gridfsBucket = getBucket("post");
    const ext = path.extname(req.file.originalname) || ".jpg";
    const filename = crypto.randomBytes(16).toString("hex") + ext;

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
        const post = new Post({
          user: res.locals.user._id,
          image: new mongoose.Types.ObjectId(uploadStream.id),
          caption,
          location,
          filter,
          tags,
          hashtags,
        });
        await post.save();

        const populated = await Post.findById(post._id)
          .populate("user", "username profilePicture")
          .populate("tags.user", "username profilePicture")
          .populate("comments.user", "username profilePicture")
          .populate("comments.mentions", "username profilePicture")
          .populate("likes", "username profilePicture")
          .exec();

        await notifyTaggedUsers(populated, res.locals.user._id);

        res.status(201).json(populated);
      } catch (err) {
        console.error("Error saving post:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to save post" });
        }
      }
    });
  } catch (err) {
    console.error("Error in post image upload process:", err);
    res.status(500).json({ error: "Failed to upload post image" });
  }
};

const notifyTaggedUsers = async (post, actorId) => {
  const recipientIds = new Set();
  if (Array.isArray(post.tags)) {
    post.tags.forEach((t) => {
      if (t.user && t.user._id) recipientIds.add(t.user._id.toString());
    });
  }
  const mentionUsernames = extractMentionUsernames(post.caption);
  if (mentionUsernames.length > 0) {
    const users = await User.find({ username: { $in: mentionUsernames } })
      .select("_id")
      .exec();
    users.forEach((u) => recipientIds.add(u._id.toString()));
  }
  recipientIds.delete(actorId.toString());
  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      createNotification({
        user: userId,
        actor: actorId,
        type: "tag",
        post: post._id,
      })
    )
  );
};

const populatePost = (query) =>
  query
    .populate("user", "username profilePicture firstName lastName")
    .populate("tags.user", "username profilePicture")
    .populate({
      path: "comments",
      populate: [
        { path: "user", select: "username profilePicture" },
        { path: "mentions", select: "username profilePicture" },
      ],
    })
    .populate("likes", "username profilePicture");

const get_explore_posts = async (req, res, next) => {
  try {
    const {
      tag,
      user,
      location,
      sort = "random",
      limit: limitRaw = 30,
      cursor,
    } = req.query;

    const limit = Math.min(60, Math.max(1, Number(limitRaw) || 30));
    const me = res.locals.user?._id;

    const followingIds = me
      ? (await Relationship.find({ follower: me }).select("user").lean()).map((r) => r.user)
      : [];

    let cursorTs = null;
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(String(cursor), "base64").toString("utf8"));
        if (decoded?.ts) cursorTs = new Date(decoded.ts);
      } catch {
        // bad cursor, ignore
      }
    }

    const showFollowedSection =
      me && !tag && !user && !location && (sort === "random" || sort === "recent");

    const followedPosts = [];
    if (showFollowedSection && followingIds.length > 0) {
      const followedQuery = { user: { $in: followingIds } };
      if (cursorTs) followedQuery.timestamp = { $lt: cursorTs };

      const docs = await Post.find(followedQuery)
        .sort({ timestamp: -1 })
        .limit(Math.min(8, Math.ceil(limit / 4)))
        .populate("user", "username profilePicture firstName lastName isPrivate")
        .populate("tags.user", "username profilePicture")
        .populate({
          path: "comments",
          populate: [
            { path: "user", select: "username profilePicture" },
            { path: "mentions", select: "username profilePicture" },
          ],
        })
        .populate("likes", "username profilePicture")
        .lean();

      for (const p of docs) {
        if (!p.user || !p.image) continue;
        followedPosts.push({ ...p, _source: "following" });
      }
    }

    const userFilter = { ...(user ? {} : {}) };
    if (user) {
      const userDocs = await User.find({
        username: new RegExp(`^${escapeRegex(String(user))}$`, "i"),
      })
        .select("_id")
        .exec();
      userFilter.user = { $in: userDocs.map((u) => u._id) };
    }

    const discoverPipeline = [];

    const matchStage = { ...userFilter };
    if (tag) matchStage.hashtags = String(tag).toLowerCase();
    if (location) matchStage.location = new RegExp(escapeRegex(String(location)), "i");
    if (cursorTs) matchStage.timestamp = { $lt: cursorTs };
    discoverPipeline.push({ $match: matchStage });

    discoverPipeline.push(
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
      { $unwind: "$user" }
    );

    const userMatch = { "user.isPrivate": { $ne: true } };
    if (me) {
      userMatch.$and = [
        { "user._id": { $ne: me } },
        { "user._id": { $nin: followingIds } },
      ];
    }
    discoverPipeline.push({ $match: userMatch });

    if (sort === "recent") {
      discoverPipeline.push({ $sort: { timestamp: -1 } });
    } else if (sort === "popular") {
      discoverPipeline.push({
        $addFields: {
          _score: {
            $add: [
              { $size: { $ifNull: ["$likes", []] } },
              { $size: { $ifNull: ["$comments", []] } },
            ],
          },
        },
      });
      discoverPipeline.push({ $sort: { _score: -1, timestamp: -1 } });
    } else {
      const sampleSize = Math.max(limit * 3, 60);
      discoverPipeline.push({ $sample: { size: sampleSize } });
    }

    discoverPipeline.push(
      { $lookup: { from: "post.files", localField: "image", foreignField: "_id", as: "image" } },
      { $unwind: "$image" }
    );

    const discoverPool = await Post.aggregate(discoverPipeline);

    let randomPosts;
    if (sort === "random") {
      for (let i = discoverPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [discoverPool[i], discoverPool[j]] = [discoverPool[j], discoverPool[i]];
      }
      randomPosts = discoverPool.slice(0, limit).map((p) => ({ ...p, _source: "discover" }));
    } else {
      randomPosts = discoverPool.slice(0, limit).map((p) => ({ ...p, _source: "discover" }));
    }

    if (randomPosts.length === 0 && sort === "random" && !tag && !user && !location) {
      const fallbackPipeline = [
        ...(cursorTs ? [{ $match: { timestamp: { $lt: cursorTs } } }] : []),
        { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $match: { "user.isPrivate": { $ne: true }, ...(me ? { "user._id": { $ne: me } } : {}) } },
        { $sample: { size: limit * 2 } },
        { $lookup: { from: "post.files", localField: "image", foreignField: "_id", as: "image" } },
        { $unwind: "$image" },
        { $limit: limit },
      ];
      const fallback = await Post.aggregate(fallbackPipeline);
      for (let i = fallback.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fallback[i], fallback[j]] = [fallback[j], fallback[i]];
      }
      randomPosts = fallback.map((p) => ({ ...p, _source: "discover" }));
    }

    const seen = new Set();
    const combined = [];

    if (showFollowedSection && followedPosts.length > 0) {
      for (const p of followedPosts) {
        const id = p._id.toString();
        if (!seen.has(id)) {
          seen.add(id);
          combined.push(p);
        }
      }
    }

    for (const p of randomPosts) {
      const id = p._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        combined.push(p);
      }
    }

    const lastPost = combined[combined.length - 1];
    const nextCursor =
      lastPost && lastPost.timestamp
        ? Buffer.from(JSON.stringify({ ts: lastPost.timestamp })).toString("base64")
        : null;

    res.json({
      posts: combined,
      nextCursor,
      hasMore: randomPosts.length === limit,
      sources: {
        following: followedPosts.length,
        discover: randomPosts.length,
      },
    });
  } catch (error) {
    console.error("explore error", error);
    res.status(500).json({ error: "Server error" });
  }
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const get_post_image = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "No picture found" });
    }
    const gridfsBucket = getBucket("post");
    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No picture found" });
    }

    await streamImage(res, gridfsBucket, files[0], { maxDimension: 1920, quality: 85 });
  } catch (err) {
    console.error("get_post_image error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error retrieving post picture" });
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
    if (["heic", "heix", "heim", "heis", "mif1", "msf1", "hevc", "hevx", "hevm"].includes(brand)) {
      return "heic";
    }
    if (["avif", "avis"].includes(brand)) return "avif";
    return "heif";
  }
  if (
    buf[0] === 0x42 && buf[1] === 0x4d
  ) return "bmp";
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x0c) {
    return "heic";
  }
  return null;
};

const formatToContentType = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  avif: "image/avif",
  heif: "image/heif",
  bmp: "image/bmp",
};

const streamImage = async (res, gridfsBucket, file, opts = {}) => {
  const { maxDimension = 1920, quality = 85 } = opts;
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
    res.set("Content-Type", formatToContentType[format] || file.contentType || "image/jpeg");
    res.write(firstChunk);
    downloadStream.on("error", (err) => {
      console.error("GridFS stream error:", err);
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
    downloadStream.on("error", (err) => {
      console.error("GridFS read error during reencode:", err);
      resolve();
    });
  });
  const buffer = Buffer.concat(chunks);

  res.set("Content-Type", "image/jpeg");
  const transformer = sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true });
  transformer.on("error", (err) => {
    console.error("Image transform error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Error processing image" });
    else res.end();
  });
  transformer.pipe(res);
};

const get_following_posts = async (req, res, next) => {
  try {
    const followingList = await Relationship.find({ follower: res.locals.user._id });
    const following = followingList.map((r) => r.user);
    following.push(res.locals.user._id);

    const posts = await Post.find({ user: { $in: following } })
      .sort({ timestamp: -1 })
      .limit(100)
      .populate("user", "username profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "username profilePicture" },
          { path: "mentions", select: "username profilePicture" },
        ],
      })
      .populate("tags.user", "username profilePicture")
      .populate("likes", "username profilePicture")
      .exec();

    res.json(posts);
  } catch (err) {
    next(err);
  }
};

const get_post_by_id = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Post not found" });
    }
    const post = await populatePost(Post.findById(req.params.id)).exec();
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    next(err);
  }
};

const get_post_likes = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Post not found" });
    }
    const post = await Post.findById(req.params.id)
      .populate("likes", "username profilePicture firstName lastName")
      .exec();
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ likes: post.likes });
  } catch (err) {
    next(err);
  }
};

const like_post = async (req, res, next) => {
  try {
    const post = await Post.findById(req.body.id).exec();
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const userId = res.locals.user._id.toString();
    const alreadyLiked = post.likes.some((id) => id.toString() === userId);
    if (!alreadyLiked) {
      post.likes.addToSet(res.locals.user._id);
      await post.save();
      await createNotification({
        user: post.user,
        actor: userId,
        type: "like",
        post: post._id,
      });
    }
    res.json({ likes: post.likes.length });
  } catch (err) {
    next(err);
  }
};

const unlike_post = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.body.id,
      { $pull: { likes: res.locals.user._id } },
      { new: true }
    ).exec();
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ likes: post.likes.length });
  } catch (err) {
    next(err);
  }
};

const comment_post = async (req, res, next) => {
  try {
    const { id, comment, mentions = [] } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: "Comment cannot be empty" });
    }

    const mentionUsernames = extractMentionUsernames(comment);
    let mentionIds = [];
    if (Array.isArray(mentions) && mentions.length > 0) {
      mentionIds = mentions;
    }
    if (mentionUsernames.length > 0) {
      const users = await User.find({ username: { $in: mentionUsernames } })
        .select("_id")
        .exec();
      mentionIds = Array.from(new Set([...mentionIds, ...users.map((u) => u._id.toString())]));
    }

    const newComment = {
      user: res.locals.user._id,
      comment: comment.trim(),
      likes: [],
      mentions: mentionIds,
    };

    const post = await Post.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } },
      { new: true }
    )
      .populate("user", "username profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "username profilePicture" },
          { path: "mentions", select: "username profilePicture" },
        ],
      })
      .populate("tags.user", "username profilePicture")
      .populate("likes", "username profilePicture")
      .exec();

    if (!post) return res.status(404).json({ error: "Post not found" });

    const createdComment = post.comments[post.comments.length - 1];

    await createNotification({
      user: post.user,
      actor: res.locals.user._id,
      type: "comment",
      post: post._id,
      comment: comment.trim(),
    });

    for (const mentionId of mentionIds) {
      if (mentionId.toString() === res.locals.user._id.toString()) continue;
      if (mentionId.toString() === post.user.toString()) continue;
      await createNotification({
        user: mentionId,
        actor: res.locals.user._id,
        type: "mention",
        post: post._id,
        comment: comment.trim(),
      });
    }

    res.status(201).json({ post, comment: createdComment });
  } catch (err) {
    next(err);
  }
};

const delete_comment_post = async (req, res, next) => {
  try {
    const { id, commentId } = req.body;
    const post = await Post.findById(id).exec();
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const isCommentOwner = comment.user.toString() === res.locals.user._id.toString();
    const isPostOwner = post.user.toString() === res.locals.user._id.toString();
    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({ error: "Not authorized to delete this comment" });
    }

    post.comments.pull({ _id: commentId });
    await post.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const like_comment_post = async (req, res, next) => {
  try {
    const { id, commentId } = req.body;
    const post = await Post.findById(id).exec();
    if (!post) return res.status(404).json({ error: "Post not found" });
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const userId = res.locals.user._id.toString();
    const alreadyLiked = comment.likes.some((u) => u.toString() === userId);
    if (!alreadyLiked) {
      comment.likes.addToSet(res.locals.user._id);
      await post.save();
    }
    res.json({ likes: comment.likes.length });
  } catch (err) {
    next(err);
  }
};

const unlike_comment_post = async (req, res, next) => {
  try {
    const { id, commentId } = req.body;
    const post = await Post.findByIdAndUpdate(
      id,
      { $pull: { "comments.$[c].likes": res.locals.user._id } },
      { arrayFilters: [{ "c._id": commentId }], new: true }
    ).exec();
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const delete_post = async (req, res, next) => {
  try {
    const post = await Post.findOneAndDelete({
      _id: req.body.postId,
      user: res.locals.user._id,
    }).exec();

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    try {
      const gridfsBucket = getBucket("post");
      if (post.image) {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(post.image));
      }
    } catch (err) {
      console.warn("Failed to delete image from gridfs:", err.message);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const get_posts_by_tag = async (req, res, next) => {
  try {
    const tag = String(req.params.tag || "").toLowerCase();
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));
    const posts = await Post.find({ hashtags: tag })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("user", "username profilePicture")
      .populate("tags.user", "username profilePicture")
      .populate({
        path: "comments",
        populate: [
          { path: "user", select: "username profilePicture" },
          { path: "mentions", select: "username profilePicture" },
        ],
      })
      .populate("likes", "username profilePicture")
      .exec();
    res.json({ tag, count: posts.length, posts });
  } catch (err) {
    next(err);
  }
};

const get_trending_tags = async (req, res, next) => {
  try {
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));
    const sinceDays = Math.max(1, Number(req.query.days) || 14);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { timestamp: { $gte: since }, hashtags: { $exists: true, $ne: [] } } },
      { $unwind: "$hashtags" },
      { $group: { _id: "$hashtags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, tag: "$_id", count: 1 } },
    ];

    const tags = await Post.aggregate(pipeline);
    res.json({ tags });
  } catch (err) {
    next(err);
   }
};

module.exports = {
  get_explore_posts,
  upload_post_image,
  get_post_image,
  get_following_posts,
  get_post_by_id,
  get_post_likes,
  like_post,
  unlike_post,
  comment_post,
  delete_comment_post,
  like_comment_post,
  unlike_comment_post,
  delete_post,
  get_posts_by_tag,
  get_trending_tags,
};
