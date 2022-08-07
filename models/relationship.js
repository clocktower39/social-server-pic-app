const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  follower: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  accepted: { type: Boolean, required: true },
})

const Relationship = mongoose.model('Relationship', relationshipSchema);
module.exports = Relationship;