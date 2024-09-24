const Conversation = require("../models/conversation");

const create_conversation = (req, res, next) => {
  const userList = [...req.body.users, res.locals.user._id];

  Conversation.find({ users: userList })
    .then((conversations) => {
      if (conversations.length > 0) {
        res.send({ error: "Conversation between these users already exists." });
      } else {
        let conversation = new Conversation({
          messages: [],
          users: userList,
        });

        let saveConversation = () => {
          conversation.save((err, convo) => {
            if (err) {
              res.send({ err: { ...err.errors } });
            } else {
              res.send(convo);
            }
          });
        };
        saveConversation();
      }
    })
    .catch((err) => next(err));
};

const get_conversations = async (req, res, next) => {
  const conversations = await Conversation.find({ users: res.locals.user._id })
    .populate("users", "username profilePicture")
    .populate("messages.user", "username profilePicture")
    .exec()
    .catch((err) => next(err));

  res.send(conversations);
};

const send_message = async (req, res, next) => {
  const newMessage = {
    user: res.locals.user._id,
    message: req.body.message,
  };
  Conversation.findOneAndUpdate(
    { _id: req.body.conversationId, users: res.locals.user._id },
    { $addToSet: { messages: newMessage } },
    { new: true }
  )
    .populate("messages.user", "username profilePicture")
    .exec()
    .then((convo) => {
      if (convo) {
        global.io.sockets.in(req.body.conversationId).emit("update_messages", convo);
        res.send(convo);
      } else {
        res.send({ error: "Conversation not found." });
      }
    })
    .catch((err) => next(err));
};

const delete_message = async (req, res, next) => {
  Conversation.findOneAndUpdate(
    { _id: req.body.conversationId, users: res.locals.user._id },
    { $pull: { messages: { _id: req.body.messageId, user: res.locals.user._id } } },
    { new: true }
  )
    .populate("messages.user", "username profilePicture")
    .exec()
    .then((convo) => {
      if (convo) {
        global.io.sockets.in(req.body.conversationId).emit("update_messages", convo);
        res.send(convo);
      } else {
        res.send({ error: "Conversation not found." });
      }
    })
    .catch((err) => next(err));
};

module.exports = {
  create_conversation,
  get_conversations,
  send_message,
  delete_message,
};
