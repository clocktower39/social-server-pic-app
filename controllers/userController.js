const User = require('../models/user');
const Post = require('../models/post');
const Relationship = require('../models/relationship');
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const login_user = (req, res) => {
    User.findOne({ username: req.body.username }, function (err, user) {
        if (err) throw err;
        if (!user) {
            res.send({
                authenticated: false,
                error: { username: 'Username not found' }
            })
        }
        else {
            user.comparePassword(req.body.password, function (err, isMatch) {
                if (err) {
                    res.send({
                        authenticated: false,
                    })
                }
                if (isMatch) {
                    const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
                        expiresIn: '30d'
                    });
                    res.send({
                        accessToken: accessToken,
                    })
                }
                else {
                    res.send({
                        authenticated: false,
                        error: { password: 'Incorrect Password' }
                    })
                }
            });
        }
    });
}

const checkAuthLoginToken = (req, res) => {
    res.send('Authorized')
}

const signup_user = (req, res) => {
    let user = new User(req.body);

    let saveUser = () => {
        user.save((err) => {
            if (err) {
                res.send({ error: { ...err.errors } });
            }
            else {
                res.send({
                    status: 'success',
                    user
                })
            }
        });
    }
    saveUser();
}

const change_password = (req, res, next) => {
    User.findById(res.locals.user._id, function (err, user) {
      if (err) return next(err);
      if (!user) {
        res.send({
          error: { status: "User not found" },
        });
      } else {
        user.comparePassword(req.body.currentPassword, function (err, isMatch) {
          if (err) {
            res.send({
              error: { status: 'Incorrect Current Password' },
            });
          }
          if (isMatch) {
            user.password = req.body.newPassword;
            user.save().then(savedUser => {
              const accessToken = jwt.sign(savedUser._doc, ACCESS_TOKEN_SECRET, {
                expiresIn: "30d", // expires in 30 days
              });
              res.send({ accessToken });
            })
          } else {
            res.send({
              error: { status: "Password change failed." },
            });
          }
        });
      }
    });
  };

  const search_user = (req, res) => {
    const { username } = req.body;
    
    // if search string is empty, return no users instead of all
    if (username === '') {
      return res.send({ users: [] });
    }
  
    const searchUser = new RegExp(username, 'i');
    User.find({ username: searchUser }).limit(15).exec((err, users) => {
      if (err) {
        return res.status(500).send({ error: 'Error finding users' });
      }
      return res.send({ users });
    });
  }
  

const update_user = (req, res, next) => {
  User.findByIdAndUpdate(res.locals.user._id, { ...req.body }, { new: true }, function (err, user) {
    if (err) return next(err);
    if (!user) {
      res.send({
        status: 'error',
        err: err ? err : '',
      })
    }
    else {
      const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
        expiresIn: "30d", // expires in 30 days
      });
      res.send({ status: 'Successful', accessToken });
    }
  })
}

const upload_profile_picture = (req, res) => {
    let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'profilePicture'
    });

    User.findById(res.locals.user._id, (err, user) => {
        if (err) return res.send(err);
        if (user.profilePicture) {
            gridfsBucket.delete(mongoose.Types.ObjectId(user.profilePicture));
        }
        user.profilePicture = res.req.file.id;
        user.save((err, u) => {
            if (err) return res.send(err);
            return res.sendStatus(200);
        });
    })
}

const get_profile_picture = (req, res) => {
    if (req.params.id) {
        let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'profilePicture'
        });

        gridfsBucket.find({ _id: mongoose.Types.ObjectId(req.params.id) }).toArray((err, files) => {
            // Check if files
            if (!files || files.length === 0) {
                return res.status(404).json({
                    err: 'No files exist'
                });
            }

            // Check if image
            if (files[0].contentType === 'image/jpeg' || files[0].contentType === 'image/png') {
                // Read output to browser
                const readstream = gridfsBucket.openDownloadStream(files[0]._id);
                readstream.pipe(res);
            } else {
                res.status(404).json({
                    err: 'Not an image'
                });
            }
        });
    }
    else {
        res.status(404).json({
            err: 'Missing parameter',
        })
    }
}

const delete_profile_picture = (req, res) => {
    let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'profilePicture'
    });

    User.findById(res.locals.user._id, (err, user) => {
        if (err) return res.send(err);
        if (user.profilePicture) {
            gridfsBucket.delete(mongoose.Types.ObjectId(user.profilePicture));
            user.profilePicture = undefined;
            user.save((err, u) => {
                if (err) return res.send(err);
                return res.sendStatus(200);
            });
        }
        else {
            return res.sendStatus(204);
        }
    })


}

const get_user_profile_page = (req, res) => {
    User.findOne({ username: req.params.username }, async function (err, user) {
        if (err) throw err;
        if (user) {
            user.email = undefined;
            user.password = undefined;

            const posts = await Post.find({ user: user._id })
                .populate('user', 'username profilePicture')
                .populate('comments', 'comment')
                .populate('comments.user', 'username profilePicture')
                .populate('likes', 'username profilePicture')
                .exec();

            const followersList = await Relationship.find({ user: user._id }).populate('user', 'username profilePicture firstName lastName').populate('follower', 'username profilePicture firstName lastName');
            const followingList = await Relationship.find({ follower: user._id }).populate('user', 'username profilePicture firstName lastName').populate('follower', 'username profilePicture firstName lastName');

            const followers = followersList.map(u => u.follower);
            const following = followingList.map(u => u.user);

            res.send({ user, posts, followers, following });
        }
        else {
            res.send({ err: "No User found" })
        }

    });
}

module.exports = {
    checkAuthLoginToken,
    login_user,
    signup_user,
    change_password,
    search_user,
    update_user,
    upload_profile_picture,
    get_profile_picture,
    delete_profile_picture,
    get_user_profile_page,
}