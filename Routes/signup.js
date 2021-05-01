module.exports = (app, User) => {
    app.post('/signup', (req, res) => {
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
    })
}