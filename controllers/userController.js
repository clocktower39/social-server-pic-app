const User = require('../models/user');

const get_followers = (req, res) => {
    User.find({ following: req.body.username}, function(err, users) {
        if(err) throw err;
        let usernameList = users.map(user=> user.username);
        res.send({followers: usernameList})
    })
}

const follow_user = (req, res) => {
    User.findOneAndUpdate({ username: req.body.username }, { following: req.body.following }, function(err, udpate) {
        if (err) throw err;
        res.send({udpate})
    });
}

const get_posts = (req, res) => {
    // Recieve list of usernames to load posts for home page
    let postList = [];
    let requestList = req.body.following;
    User.find({ username: requestList }, function(err, users) {
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
    }).then(()=>{
        // Create mongoose Post model
        // find all posts from models that are on the request list
        // sort the list by timeStamp
        postList.sort((a,b)=>{
            return b.timeStamp - a.timeStamp
        });
    }).then(()=>{
        res.send({posts: postList})
    });
}

const login_user = (req, res) => {
    User.findOne({ username: req.body.username }, function(err, user) {
        if (err) throw err;
        if(!user){
            res.send({
                authenticated: false,
                error: {username: 'Username not found'}
            })
        }
        else {
            user.comparePassword(req.body.password, function(err, isMatch) {
                if (err){
                    res.send({
                        authenticated: false,
                    })
                }
                //if the password does not match and previous session was not authenticated, do not authenticate
                if(req.body.authenticated && isMatch || req.body.authenticated === 'true'){
                    res.send({
                        authenticated: true,
                        user: user._doc
                    })
                }
                else{
                    res.send({
                        authenticated: false,
                        error: {password: 'Incorrect Password'}
                    })
                }
            });
        }
    });
}

const signup_user = (req, res) => {
    let user = new User(req.body);
    
    let saveUser = () => {
        user.save((err)=>{
            if(err){
                res.send({error: {...err.errors}});
            }
            else{
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
    if(req.body.username === '') {
        res.send({users: []});
    }
    else {
        let searchUser = new RegExp(req.body.username,'i');
        User.find({ username: searchUser }, function(err, users) {
            if (err) throw err;
            res.send({users: users})
        });
    }
}

const update_user = (req, res) => {
    // update username, firstName, lastName, description, email
}

module.exports = {
    get_followers,
    follow_user,
    get_posts,
    login_user,
    signup_user,
    search_user,
    update_user,
}