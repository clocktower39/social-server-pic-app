const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const mongoose = require('mongoose');
const { ValidationError } = require('express-validation');
const cors = require('cors');
require('dotenv').config();
const methodOverride = require('method-override');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const conversationRoutes = require('./routes/conversationRoutes');

const dbUrl = process.env.DBURL;
let PORT = process.env.PORT;
if( PORT == null || PORT == ""){
    PORT = 8080;
}

app.use(cors());
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(methodOverride('_method'));
app.use('/', userRoutes);
app.use('/', postRoutes);
app.use('/', relationshipRoutes);
app.use('/', conversationRoutes);

app.get('/', (req,res) => {
    res.send(req.socket.remoteAddress);
})

mongoose.set('useUnifiedTopology', true);
mongoose.connect(dbUrl, 
  {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useCreateIndex: true,
      useFindAndModify: false,
  } , (err) => {
  console.log('mongo db connection', err)
})

// Error handling Function
app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json(err)
    }
    console.error(err.stack);
    res.status(500).send(err.stack);
})

let server = http.listen(PORT, ()=> {
    console.log(`Server is listening on port ${server.address().port}`);
});
    
    