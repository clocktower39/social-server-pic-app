const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const mongoose = require('mongoose');
const { ValidationError } = require('express-validation');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);

global.io = require('./io').initialize(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3003;
const DBURL = process.env.DBURL;

app.use(cors());
app.use(bodyParser.json({ limit: "60mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "60mb" }));

app.use('/', userRoutes);
app.use('/', postRoutes);
app.use('/', relationshipRoutes);
app.use('/', conversationRoutes);
app.use('/', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ status: "ok", service: "social-picture-app" });
});

global.io.on('connection', (socket) => {
  socket.on('join', (data) => {
    if (data && data.conversationId) {
      socket.join(data.conversationId);
    }
  });

  socket.on('join_user', (data) => {
    try {
      if (!data || !data.token) return;
      const decoded = jwt.verify(data.token, process.env.ACCESS_TOKEN_SECRET);
      if (!decoded || !decoded._id) return;
      socket.join(`user:${decoded._id}`);
    } catch (err) {
      console.warn("Failed to join user room:", err.message);
    }
  });

  socket.on('disconnect', () => {
    /* no-op */
  });
});

const connectToDB = async () => {
  if (!DBURL) {
    console.error("DBURL is not set. Set it in .env");
    return;
  }
  try {
    await mongoose.connect(DBURL);
    console.log("MongoDB connection successful");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};
connectToDB();

app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode || 400).json(err);
  }
  if (err && err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File is too large. Please pick a smaller image." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Upload too large. Please pick a smaller image." });
  }
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
