module.exports = (app, User) => {
    app.post('/getPosts', (req, res) => {
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
    })
}
