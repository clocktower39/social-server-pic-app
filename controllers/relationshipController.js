const Relationship = require("../models/relationship");

const get_relationships = (req, res, next) => {
  Relationship.find({ user: req.body.userId }, function (err, followers) {
    if (err) return next(err);
    Relationship.find({ user: req.body.userId }, function (err, following) {
      if (err) return next(err);
      res.send({ followers, following });
    });
  });
};

module.exports = {
  get_relationships,
};
