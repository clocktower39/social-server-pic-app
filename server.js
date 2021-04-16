const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

console.log(process.env.YUM);
const dbUrl = process.env.DBURL;
const PORT = process.env.PORT;

app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

let corsWhitelist = [
    'http://10.37.39.39:3001',
    'http://mattkearns.ddns.net:3001',
    '*'];


let User = mongoose.model('Message', {
    username: String,
    firstName: String,
    lastName: String,
    email: String,
});
    
app.get('/', (req,res) => {
    res.send(req.socket.remoteAddress)
    console.log(req.socket.remoteAddress);
})

app.post('/login', (req, res) => {
    res.send(req.socket.remoteAddress)
})

app.post('/signup', (req, res) => {
    let user = new User(req.body);
    
    let saveUser = () => {
        user.save((err)=>{
            if(err){
                sendStatus(500);
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
    
    