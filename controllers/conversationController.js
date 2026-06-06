const Conversation = require("../models/conversation");
const User = require("../models/user");
const mongoose = require("mongoose");
const { createNotification } = require("../utils/notifications");
const { extractMentionUsernames } = require("../utils/parse");

const sortConversations = (a, b) => {
  const aTime = a.lastMessageAt || (a.messages && a.messages.length ? a.messages[a.messages.length - 1].timestamp : 0);
  const bTime = b.lastMessageAt || (b.messages && b.messages.length ? b.messages[b.messages.length - 1].timestamp : 0);
  return new Date(bTime) - new Date(aTime);
};

const create_conversation = async (req, res, next) => {
  try {
    const { name, userIds = [], isGroup = false } = req.body;
    const me = res.locals.user._id;
    const members = Array.from(new Set([me.toString(), ...userIds.map(String)]));

    if (members.length < 2) {
      return res.status(400).json({ error: "Need at least one other user" });
    }

    if (isGroup && members.length < 3) {
      return res.status(400).json({ error: "Group conversations need at least 3 users" });
    }

    if (!isGroup) {
      const others = members.filter((id) => id !== me.toString());
      const existing = await Conversation.findOne({
        isGroup: false,
        users: { $all: others, $size: 1 },
      });
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    const conversation = new Conversation({
      name: isGroup && name ? name.trim() : null,
      isGroup: Boolean(isGroup),
      createdBy: me,
      users: members,
      messages: [],
    });
    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("users", "username profilePicture")
      .exec();

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

const get_conversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ users: res.locals.user._id })
      .populate("users", "username profilePicture firstName lastName")
      .populate({
        path: "messages.user",
        select: "username profilePicture",
      })
      .sort({ lastMessageAt: -1 })
      .exec();
    res.json(conversations);
  } catch (err) {
    next(err);
  }
};

const get_conversation = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      users: res.locals.user._id,
    })
      .populate("users", "username profilePicture firstName lastName")
      .populate({
        path: "messages.user",
        select: "username profilePicture",
      })
      .exec();
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  } catch (err) {
    next(err);
  }
};

const send_message = async (req, res, next) => {
  try {
    const { conversationId, message, mentions = [] } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const mentionUsernames = extractMentionUsernames(message);
    let mentionIds = Array.isArray(mentions) ? mentions.map(String) : [];
    if (mentionUsernames.length > 0) {
      const users = await User.find({ username: { $in: mentionUsernames } })
        .select("_id")
        .exec();
      mentionIds = Array.from(new Set([...mentionIds, ...users.map((u) => u._id.toString())]));
    }

    const newMessage = {
      user: res.locals.user._id,
      message: message.trim(),
      mentions: mentionIds,
      timestamp: new Date(),
    };

    const convo = await Conversation.findOneAndUpdate(
      { _id: conversationId, users: res.locals.user._id },
      { $push: { messages: newMessage }, $set: { lastMessageAt: newMessage.timestamp } },
      { new: true }
    )
      .populate("users", "username profilePicture firstName lastName")
      .populate({
        path: "messages.user",
        select: "username profilePicture",
      })
      .exec();

    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const recipients = convo.users.filter(
      (u) => u._id.toString() !== res.locals.user._id.toString()
    );
    await Promise.all(
      recipients.map((recipient) =>
        createNotification({
          user: recipient._id,
          actor: res.locals.user._id,
          type: "message",
          conversation: convo._id,
          message: newMessage.message,
        })
      )
    );

    if (global.io) {
      global.io.sockets.in(conversationId).emit("update_messages", convo);
    }

    res.status(201).json(convo);
  } catch (err) {
    next(err);
  }
};

const delete_message = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.body;
    const convo = await Conversation.findOneAndUpdate(
      { _id: conversationId, users: res.locals.user._id },
      { $pull: { messages: { _id: messageId, user: res.locals.user._id } } },
      { new: true }
    )
      .populate("users", "username profilePicture firstName lastName")
      .populate({
        path: "messages.user",
        select: "username profilePicture",
      })
      .exec();

    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (global.io) {
      global.io.sockets.in(conversationId).emit("update_messages", convo);
    }
    res.json(convo);
  } catch (err) {
    next(err);
  }
};

const add_members = async (req, res, next) => {
  try {
    const { conversationId, userIds = [] } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds required" });
    }
    const convo = await Conversation.findOne({
      _id: conversationId,
      users: res.locals.user._id,
    }).exec();
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    if (!convo.isGroup) {
      return res.status(400).json({ error: "Cannot add members to a direct conversation" });
    }
    convo.users = Array.from(new Set([...convo.users.map(String), ...userIds.map(String)]));
    await convo.save();

    const populated = await Conversation.findById(convo._id)
      .populate("users", "username profilePicture firstName lastName")
      .populate({ path: "messages.user", select: "username profilePicture" })
      .exec();

    if (global.io) {
      global.io.sockets.in(conversationId).emit("update_messages", populated);
    }
    res.json(populated);
  } catch (err) {
    next(err);
  }
};

const remove_member = async (req, res, next) => {
  try {
    const { conversationId, userId } = req.body;
    const convo = await Conversation.findOne({
      _id: conversationId,
      users: res.locals.user._id,
    }).exec();
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    if (!convo.isGroup) {
      return res.status(400).json({ error: "Cannot remove from direct conversation" });
    }
    if (userId === res.locals.user._id.toString()) {
      return res.status(400).json({ error: "Use the leave endpoint to remove yourself" });
    }
    convo.users = convo.users.filter((u) => u.toString() !== userId);
    await convo.save();
    const populated = await Conversation.findById(convo._id)
      .populate("users", "username profilePicture firstName lastName")
      .populate({ path: "messages.user", select: "username profilePicture" })
      .exec();
    if (global.io) {
      global.io.sockets.in(conversationId).emit("update_messages", populated);
    }
    res.json(populated);
  } catch (err) {
    next(err);
  }
};

const leave_conversation = async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    const convo = await Conversation.findOneAndUpdate(
      { _id: conversationId, users: res.locals.user._id, isGroup: true },
      { $pull: { users: res.locals.user._id } },
      { new: true }
    ).exec();
    if (!convo) {
      return res.status(404).json({ error: "Group conversation not found" });
    }
    if (global.io) {
      global.io.sockets.in(conversationId).emit("update_messages", convo);
    }
    res.json({ success: true, conversationId });
  } catch (err) {
    next(err);
  }
};

const rename_group = async (req, res, next) => {
  try {
    const { conversationId, name } = req.body;
    const convo = await Conversation.findOneAndUpdate(
      { _id: conversationId, users: res.locals.user._id, isGroup: true },
      { $set: { name: name ? name.trim() : null } },
      { new: true }
    )
      .populate("users", "username profilePicture firstName lastName")
      .populate({ path: "messages.user", select: "username profilePicture" })
      .exec();
    if (!convo) return res.status(404).json({ error: "Group conversation not found" });
    if (global.io) {
      global.io.sockets.in(conversationId).emit("update_messages", convo);
    }
    res.json(convo);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create_conversation,
  get_conversations,
  get_conversation,
  send_message,
  delete_message,
  add_members,
  remove_member,
  leave_conversation,
  rename_group,
  sortConversations,
};
