const Relationship = require("../models/relationship");

const get_relationships = (req, res, next) => {
  Relationship.find({ user: req.body.user })
  .then((followers) => {
    if (err) return next(err);
    Relationship.find({ follower: req.body.user }, function (err, following) {
      if (err) return next(err);
      res.send({ followers, following });
    });
  })
  .catch((err) => next(err));
};

const get_my_relationships = (req, res, next) => {
  Relationship.find({ user: res.locals.user._id })
  .then((followers) => {
    Relationship.find({ follower: res.locals.user._id })
      .then((following) => {
      res.send({ followers, following });
    });
  })
  .catch((err) => next(err));
};

const request_follow = (req, res, next) => {
  Relationship.find({ user: req.body.user, follower: res.locals.user._id })
  .then((relationship) => {
    if(relationship.length > 0){
      res.send('You are already following/requested this account');
    }
    else {
      let relationship = new Relationship({
        user: req.body.user,
        follower: res.locals.user._id,
        accepted: true,
      });

      let saveRelationship = () => {
        relationship.save().then((newRelationship) => {
          res.send(newRelationship)
        })
        .catch((err) => next(err));
      }

      saveRelationship();
    }
  })
  .catch((err) => next(err));
}

const request_unfollow = (req, res, next) => {
  Relationship.findOneAndDelete({ user: req.body.user, follower: res.locals.user._id })
  .then((response) => {
      res.sendStatus(200);
  })
  .catch((err) => next(err));
}

const remove_follower = (req, res, next) => {
  Relationship.findOneAndDelete({ user: res.locals.user._id, follower: req.body.user })
  .then((response) => {
      res.sendStatus(200);
  })
  .catch((err) => next(err));
}

module.exports = {
  get_my_relationships,
  get_relationships,
  request_follow,
  request_unfollow,
  remove_follower,
};
