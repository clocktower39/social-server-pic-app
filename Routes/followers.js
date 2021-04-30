module.exports = (app, User) => {
    app.post('/followers', (req, res) => {
        User.find({ following: req.body.username}, function(err, users) {
            if(err) throw err;
            let usernameList = users.map(user=> user.username);
            res.send({followers: usernameList})
        })
    })
}