const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png|gif|webp/;
    const ok = types.test(path.extname(file.originalname).toLowerCase()) && types.test(file.mimetype);
    cb(null, ok);
  },
});

router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).lean();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { username, message } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const post = new Post({ username: username || 'Anónimo', message, image });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/react', async (req, res) => {
  try {
    const { emoji, dir } = req.body;
    if (!emoji || typeof dir !== 'number' || dir === 0) {
      return res.status(400).json({ error: 'emoji requerido y dir debe ser 1 o -1' });
    }
    const key = `reactions.${emoji}`;
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { [key]: dir } },
      { new: true, lean: true }
    );
    if (!post) return res.status(404).json({ error: 'No encontrado' });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
