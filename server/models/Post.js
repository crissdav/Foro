const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  username: {
    type: String,
    default: 'Anónimo',
  },
  message: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: null,
  },
  reactions: {
    type: Map,
    of: Number,
    default: {},
  },
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
