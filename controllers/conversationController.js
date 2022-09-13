const Conversation = require("../models/conversation");

const create_conversation = (req, res) => {
  let conversation = new Conversation({
    messages: [],
    users: [...req.body.users, res.locals.user._id]
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
};

const send_message = async (req, res) => {
  const newMessage = {
    user: res.locals.user._id,
    message: req.body.message,
  }
  Conversation.updateOne(
    { _id: req.body.conversationId },
    { $addToSet: { messages: newMessage } },
    (err, post) => {
      if (err) return res.send(err);
      res.sendStatus(200);
    }
  );
};

module.exports = {
  create_conversation,
  send_message,
};
