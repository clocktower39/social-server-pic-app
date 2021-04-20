const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const mongoose = require('mongoose');
const cors = require('cors');
const io = require('socket.io');
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log(process.env.YUM);
const dbUrl = process.env.DBURL;
const PORT = process.env.PORT;
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);

app.use(cors());
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

let corsWhitelist = [
    'http://10.37.39.39:3001',
    'http://mattkearns.ddns.net:3001',
    '*'];

let UserSchema = mongoose.Schema({
    username: { type: String, required: true, index: { unique: true } },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
});

UserSchema.pre('save', function(next) {
    let user = this;

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        // hash the password using our new salt
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            // override the cleartext password with the hashed one
            user.password = hash;
            next();
        });
    });
});

UserSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

let User = mongoose.model('User', UserSchema);

app.get('/', (req,res) => {
    res.send(req.socket.remoteAddress)
    console.log(req.socket.remoteAddress);
})

app.post('/login', (req, res) => {
    User.findOne({ username: req.body.username }, function(err, user) {
        if (err) throw err;
        if(!user){
            res.send({authenticated: false})
        }
        else {
            console.log('here');
            console.log(user);
            user.comparePassword(req.body.password, function(err, isMatch) {
                if (err) throw err;
                (!isMatch)?res.send({authenticated: isMatch}):
                res.send({
                    authenticated: isMatch,
                    user: user
                })
            });
        }
    });
})

app.post('/signup', (req, res) => {
    let user = new User(req.body);
    
    let saveUser = () => {
        user.save((err)=>{
            if(err){
                res.send('Username already taken or missing required field(s)');
            }
            else{
                res.sendStatus(200);
            }
        });
    }
    saveUser();
})

mongoose.connect(dbUrl, 
    {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true
    } , (err) => {
    console.log('mongo db connection', err)
})

let server = http.listen(PORT, ()=> {
    console.log(`Server is listening on port ${server.address().port}`);
});
    
    