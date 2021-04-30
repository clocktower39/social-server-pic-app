module.exports = (app, User) => {
    app.post('/search', (req, res) => {
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
    })
}