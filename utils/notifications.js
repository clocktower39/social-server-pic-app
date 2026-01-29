const Notification = require("../models/notification");

const populateNotification = (notificationId) => {
  return Notification.findById(notificationId)
    .populate("actor", "username profilePicture")
    .populate("post", "image user")
    .populate("conversation", "users")
    .exec();
};

const emitNotification = (notification) => {
  if (!notification || !global.io) return;
  global.io.to(`user:${notification.user.toString()}`).emit("notification", notification);
};

const createNotification = async ({
  user,
  actor,
  type,
  post,
  conversation,
  comment,
  message,
}) => {
  if (!user || !actor) return null;
  if (user.toString() === actor.toString()) return null;

  const created = await Notification.create({
    user,
    actor,
    type,
    post,
    conversation,
    comment,
    message,
  });
  const populated = await populateNotification(created._id);
  emitNotification(populated);
  return populated;
};

module.exports = {
  createNotification,
  populateNotification,
};
