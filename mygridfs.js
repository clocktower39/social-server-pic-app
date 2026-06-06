const multer = require("multer");

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const storage = multer.memoryStorage();

const uploadPicture = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

module.exports = {
  uploadPicture,
  MAX_UPLOAD_BYTES,
};
