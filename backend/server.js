require('dotenv').config(); // loads .env variables

const express = require('express'); 
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- MIDDLEWARE ----------------
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- UPLOADS ----------------
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('Uploads directory created:', UPLOAD_DIR);
}

app.use('/uploads', express.static(UPLOAD_DIR));

// ---------------- FRONTEND ----------------
const FRONTEND_DIR = path.join(__dirname, '../frontend');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
  console.log('Serving frontend from:', FRONTEND_DIR);
} else {
  console.log('Frontend directory not found, only API will be served');
}

// ---------------- MONGODB CONNECTION ----------------
const MONGO_URI = process.env.MONGO_URI || 
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafe?retryWrites=true&w=majority"; // ✅ FIXED: password case now matches .env

console.log("Connecting to MongoDB...");

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// ---------------- BLOG SCHEMA ----------------
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String },
  excerpt: { type: String },
  content: { type: String },
  imageUrl: { type: String }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);

// ---------------- MULTER ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Saving file to:', UPLOAD_DIR);
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    console.log('Generated filename:', uniqueName);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ---------------- API ROUTES ----------------

// GET all blogs
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    console.log(`Found ${blogs.length} blogs`);
    res.json(blogs);
  } catch (err) {
    console.error('Error fetching blogs:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET single blog by ID
app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.json(blog);
  } catch (err) {
    console.error('Error fetching blog:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create a blog
app.post('/api/blogs', upload.single('image'), async (req, res) => {
  try {
    console.log('Creating new blog post');
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    const blogData = {
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      excerpt: req.body.excerpt,
      content: req.body.content,
    };

    if (req.file) {
      blogData.imageUrl = `/uploads/${req.file.filename}`;
      console.log('Image URL set to:', blogData.imageUrl);
    }

    const blog = new Blog(blogData);
    await blog.save();
    
    console.log('Blog created successfully with ID:', blog._id);
    res.status(201).json(blog);

  } catch (err) {
    console.error('Error creating blog:', err);
    res.status(400).json({ message: err.message });
  }
});

// PUT update a blog
app.put('/api/blogs/:id', upload.single('image'), async (req, res) => {
  try {
    console.log('Updating blog:', req.params.id);
    
    const updateData = {
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      excerpt: req.body.excerpt,
      content: req.body.content
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
      console.log('New image URL:', updateData.imageUrl);
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    console.log('Blog updated successfully');
    res.json(updatedBlog);

  } catch (err) {
    console.error('Error updating blog:', err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE a blog
app.delete('/api/blogs/:id', async (req, res) => {
  try {
    console.log('Deleting blog:', req.params.id);
    
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Blog not found" });
    }
    
    console.log('Blog deleted successfully');
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting blog:', err);
    res.status(500).json({ message: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uploadsDir: UPLOAD_DIR,
    frontendDir: FRONTEND_DIR
  });
});

// ---------------- START SERVER ----------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`Server is running on port ${PORT}`);
  console.log(`Uploads directory: ${UPLOAD_DIR}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=================================`);
});