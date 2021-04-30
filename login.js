
module.exports = function (app, User) {
    app.post('/login', (req, res) => {
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
    })
}
