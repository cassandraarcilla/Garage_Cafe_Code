const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Paths
const DATA_FILE = path.join(__dirname, 'blogs.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend'); // frontend folder

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(FRONTEND_DIR)); // serve all frontend files

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ---------------- API ----------------
function readBlogs() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function writeBlogs(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all blogs
app.get('/api/blogs', (req, res) => res.json(readBlogs()));

// Create a blog
app.post('/api/blogs', upload.single('image'), (req, res) => {
  const blogs = readBlogs();
  const blog = {
    _id: Date.now().toString(),
    title: req.body.title,
    author: req.body.author,
    category: req.body.category,
    excerpt: req.body.excerpt,
    content: req.body.content,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : ''
  };
  blogs.push(blog);
  writeBlogs(blogs);
  res.json(blog);
});

// Update a blog
app.put('/api/blogs/:id', upload.single('image'), (req, res) => {
  const blogs = readBlogs();
  const blog = blogs.find(b => b._id === req.params.id);
  if (!blog) return res.sendStatus(404);

  blog.title = req.body.title;
  blog.author = req.body.author;
  blog.category = req.body.category;
  blog.excerpt = req.body.excerpt;
  blog.content = req.body.content;
  if (req.file) blog.imageUrl = `/uploads/${req.file.filename}`;

  writeBlogs(blogs);
  res.json(blog);
});

// Delete a blog
app.delete('/api/blogs/:id', (req, res) => {
  const blogs = readBlogs().filter(b => b._id !== req.params.id);
  writeBlogs(blogs);
  res.sendStatus(204);
});

// ---------------- Frontend Routes (Clean URLs) ----------------
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
app.get('/blog', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'blog.html')));
app.get('/blog-single', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'blog-single.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin-blog.html')));

// Optional: catch-all route for SPA
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
