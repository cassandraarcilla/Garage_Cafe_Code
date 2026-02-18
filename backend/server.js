require('dotenv').config({ path: __dirname + '/.env' }); // Always loads .env from backend folder
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- MIDDLEWARE ----------------
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- FRONTEND ----------------
const FRONTEND_DIR = path.join(__dirname, '../frontend');
app.use(express.static(FRONTEND_DIR));

// ---------------- CLOUDINARY CONFIG ----------------
// Set these environment variables on Render:
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- MULTER → CLOUDINARY ----------------
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'garage-cafe-blogs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1200, quality: 'auto', fetch_format: 'auto' }],
  },
});

const upload = multer({ storage });

// ---------------- MONGODB CONNECTION ----------------
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafe?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// ---------------- BLOG SCHEMA ----------------
const blogSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  author:   { type: String, required: true },
  category: { type: String },
  excerpt:  { type: String },
  content:  { type: String },
  imageUrl: { type: String },   // Cloudinary HTTPS URL
  imagePublicId: { type: String }, // Cloudinary public_id for deletion
}, { timestamps: true });

const Blog = mongoose.model('Blog', blogSchema);

// ---------------- API ROUTES ----------------

// GET all blogs
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a blog
app.post('/api/blogs', upload.single('image'), async (req, res) => {
  try {
    const blog = new Blog({
      title:    req.body.title,
      author:   req.body.author,
      category: req.body.category,
      excerpt:  req.body.excerpt,
      content:  req.body.content,
      imageUrl: req.file ? req.file.path : '',           // Cloudinary full HTTPS URL
      imagePublicId: req.file ? req.file.filename : '',  // Cloudinary public_id
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update a blog
app.put('/api/blogs/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = {
      title:    req.body.title,
      author:   req.body.author,
      category: req.body.category,
      excerpt:  req.body.excerpt,
      content:  req.body.content,
    };

    if (req.file) {
      // Delete old image from Cloudinary if it exists
      const existing = await Blog.findById(req.params.id);
      if (existing && existing.imagePublicId) {
        await cloudinary.uploader.destroy(existing.imagePublicId).catch(() => {});
      }
      updateData.imageUrl = req.file.path;
      updateData.imagePublicId = req.file.filename;
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      updateData,
      { returnDocument: 'after' }
    );

    if (!updatedBlog) return res.status(404).json({ message: 'Blog not found' });
    res.json(updatedBlog);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a blog
app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Blog not found' });

    // Delete image from Cloudinary
    if (deleted.imagePublicId) {
      await cloudinary.uploader.destroy(deleted.imagePublicId).catch(() => {});
    }

    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`Garage Cafe API & Frontend running on port ${PORT}`);
});