const User = require('../models/user');
const Post = require('../models/post');
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const get_followers = (req, res) => {
    User.find({ following: req.body.username }, function (err, users) {
        if (err) throw err;
        let usernameList = users.map(user => user.username);
        res.send({ followers: usernameList })
    })
}

const follow_user = (req, res) => {
    User.findOneAndUpdate({ username: req.body.username }, { following: req.body.following }, function (err, udpate) {
        if (err) throw err;
        res.send({ udpate })
    });
}

const get_posts = (req, res) => {
    // Recieve list of usernames to load posts for home page
    let postList = [];
    let requestList = req.body.following;
    User.find({ username: requestList }, function (err, users) {
        if (err) throw err;
        users.forEach(user => {
            user.posts.forEach(post => {
                post.user = {
                    username: user.username,
                    profilePic: user._doc.profilePic,
                }
            })
            postList.push(...user.posts);
        })
    }).then(() => {
        // Create mongoose Post model
        // find all posts from models that are on the request list
        // sort the list by timeStamp
        postList.sort((a, b) => {
            return b.timeStamp - a.timeStamp
        });
    }).then(() => {
        res.send({ posts: postList })
    });
}

const get_following_posts = async (req, res) => {
    // Recieve list of usernames to load posts for home page
    const user = await User.findById(res.locals.user._id);
    const postRequest = user.following.map( f => {
        return Post.find({ user: f })
        .populate('user', 'username profilePicture')
        .populate('comments', 'comment')
        .populate('comments.user', 'username profilePicture')
        .populate('likes', 'username profilePicture')
        .exec();
    })
    const postResponse = await Promise.all(postRequest);

    const sortedPosts = postResponse.flat().sort((a,b) => b.timestamp - a.timestamp);
    res.send(sortedPosts);
}

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

const search_user = (req, res) => {
    // if search string is empty, return no users instead of all
    if (req.body.username === '') {
        res.send({ users: [] });
    }
    else {
        let searchUser = new RegExp(req.body.username, 'i');
        User.find({ username: searchUser }, function (err, users) {
            if (err) throw err;
            res.send({ users: users })
        });
    }
}

const update_user = (req, res) => {
    // update username, firstName, lastName, description, email
}

module.exports = {
    checkAuthLoginToken,
    get_followers,
    follow_user,
    get_posts,
    get_following_posts,
    login_user,
    signup_user,
    search_user,
    update_user,
}