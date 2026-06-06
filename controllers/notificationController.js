const Notification = require("../models/notification");

const get_notifications = async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: res.locals.user._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("actor", "username profilePicture firstName lastName")
        .populate({
          path: "post",
          select: "image user caption",
          populate: { path: "user", select: "username" },
        })
        .populate("conversation", "users isGroup name")
        .exec(),
      Notification.countDocuments({ user: res.locals.user._id, read: false }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

const mark_notifications_read = async (req, res, next) => {
  try {
    const { ids = [], all = false } = req.body || {};
    const query = { user: res.locals.user._id };

    if (Array.isArray(ids) && ids.length > 0) {
      query._id = { $in: ids };
    } else if (!all) {
      return res.status(400).json({ error: "No notification ids provided" });
    }

    await Notification.updateMany(query, { $set: { read: true } }).exec();
    const unreadCount = await Notification.countDocuments({
      user: res.locals.user._id,
      read: false,
    });

    res.json({ unreadCount, updatedIds: ids.length ? ids : "all" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  get_notifications,
  mark_notifications_read,
};
