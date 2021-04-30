module.exports = (app, User) => {
    app.post('/followUser', (req, res) => {
        User.findOneAndUpdate({ username: req.body.username }, { following: req.body.following }, function(err, udpate) {
            if (err) throw err;
            res.send({udpate})
        });
    })
}