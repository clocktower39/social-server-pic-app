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

let Message = mongoose.model('Message', {
    name: String,
    message: String
});

let imageSchema = new mongoose.Schema({
    name: String,
    desc: String,
    img:
    {
        data: Buffer,
        contentType: String
    }
});
    
app.get('/', (req,res) => {
    res.send(req.connection.remoteAddress)
    console.log(req.connection.remoteAddress);
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
    
    