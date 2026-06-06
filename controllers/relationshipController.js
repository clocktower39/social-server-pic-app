const Relationship = require("../models/relationship");
const { createNotification } = require("../utils/notifications");

const get_relationships = async (req, res, next) => {
  try {
    const { user } = req.body;
    if (!user) {
      return res.status(400).json({ error: "user is required" });
    }
    const [followersList, followingList] = await Promise.all([
      Relationship.find({ user }).populate("follower", "username profilePicture firstName lastName").exec(),
      Relationship.find({ follower: user }).populate("user", "username profilePicture firstName lastName").exec(),
    ]);
    res.json({
      followers: followersList.map((r) => r.follower),
      following: followingList.map((r) => r.user),
    });
  } catch (err) {
    next(err);
  }
};

const get_my_relationships = async (req, res, next) => {
  try {
    const [followersList, followingList] = await Promise.all([
      Relationship.find({ user: res.locals.user._id })
        .populate("follower", "username profilePicture firstName lastName")
        .exec(),
      Relationship.find({ follower: res.locals.user._id })
        .populate("user", "username profilePicture firstName lastName")
        .exec(),
    ]);
    res.json({
      followers: followersList.map((r) => r.follower),
      following: followingList.map((r) => r.user),
    });
  } catch (err) {
    next(err);
  }
};

const request_follow = async (req, res, next) => {
  try {
    const existing = await Relationship.findOne({
      user: req.body.user,
      follower: res.locals.user._id,
    }).exec();

    if (existing) {
      return res.status(200).json(existing);
    }

    const relationship = new Relationship({
      user: req.body.user,
      follower: res.locals.user._id,
      accepted: true,
    });

    const saved = await relationship.save();
    await createNotification({
      user: req.body.user,
      actor: res.locals.user._id,
      type: "follow",
    });
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
};

const request_unfollow = async (req, res, next) => {
  try {
    const response = await Relationship.findOneAndDelete({
      user: req.body.user,
      follower: res.locals.user._id,
    }).exec();

    if (response) {
      await createNotification({
        user: req.body.user,
        actor: res.locals.user._id,
        type: "unfollow",
      });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const remove_follower = async (req, res, next) => {
  try {
    await Relationship.findOneAndDelete({
      user: res.locals.user._id,
      follower: req.body.user,
    }).exec();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  get_my_relationships,
  get_relationships,
  request_follow,
  request_unfollow,
  remove_follower,
};
