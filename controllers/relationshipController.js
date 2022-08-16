const Relationship = require("../models/relationship");

const get_relationships = (req, res, next) => {
  Relationship.find({ user: req.body.user }, function (err, followers) {
    if (err) return next(err);
    Relationship.find({ follower: req.body.user }, function (err, following) {
      if (err) return next(err);
      res.send({ followers, following });
    });
  });
};

const get_my_relationships = (req, res, next) => {
  Relationship.find({ user: res.locals.user._id }, function (err, followers) {
    if (err) return next(err);
    Relationship.find({ follower: res.locals.user._id }, function (err, following) {
      if (err) return next(err);
      res.send({ followers, following });
    });
  });
};

const request_follow = (req, res, next) => {
  Relationship.find({ user: req.body.user, follower: res.locals.user._id }, (err, relationship) => {
    if(err) return next(err);
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
        relationship.save((err, newRelationship) => {
          if(err) return next(err);
          res.send(newRelationship)
        })
      }

      saveRelationship();
    }
  })
}

const request_unfollow = (req, res, next) => {
  Relationship.findOneAndDelete({ user: req.body.user, follower: res.locals.user._id }, (err, resposne) => {
    if(err) return next(err);
    else{
      res.sendStatus(200);
    }
  })
}

const remove_follower = (req, res, next) => {
  Relationship.findOneAndDelete({ user: res.locals.user._id, follower: req.body.user }, (err, resposne) => {
    if(err) return next(err);
    else{
      res.sendStatus(200);
    }
  })
}

module.exports = {
  get_my_relationships,
  get_relationships,
  request_follow,
  request_unfollow,
  remove_follower,
};
