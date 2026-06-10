const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    mentions: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    isGroup: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    users: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], required: true },
    messages: { type: [MessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    deletedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    archivedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    mutedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
  },
  { minimize: false }
);

const Conversation = mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;
