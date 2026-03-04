require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const multer     = require('multer');
const path       = require('path');
const cors       = require('cors');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── STATIC FILES & UPLOADS ────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('Uploads directory created:', UPLOAD_DIR);
}
app.use('/uploads', express.static(UPLOAD_DIR));

// ── FRONTEND DIRECTORY ────────────────────────────────────────────────
// Change ONLY this line to match your real folder structure
const FRONTEND_DIR = path.join(__dirname, '../frontend');  // ← most common fix

console.log('Serving static files from:', FRONTEND_DIR);
console.log('index.html exists?', fs.existsSync(path.join(FRONTEND_DIR, 'index.html')) ? 'YES' : 'NO');
console.log('menu.html exists?',  fs.existsSync(path.join(FRONTEND_DIR, 'menu.html'))  ? 'YES' : 'NO');
console.log('admin-menu.html exists?', fs.existsSync(path.join(FRONTEND_DIR, 'admin-menu.html')) ? 'YES' : 'NO');

app.use(express.static(FRONTEND_DIR));

// ── MONGODB CONNECTION ────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafe?retryWrites=true&w=majority";

console.log("Connecting to MongoDB...");
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// ── BLOG SCHEMA & MODEL ───────────────────────────────────────────────
const blogSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  author:   { type: String, required: true },
  category: { type: String },
  excerpt:  { type: String },
  content:  { type: String },
  imageUrl: { type: String }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);

// ── MENU SCHEMA & MODEL ───────────────────────────────────────────────
const menuItemSchema = new mongoose.Schema({
  name:        { type: String,  required: true },
  category:    { type: String,  required: true },
  subcategory: { type: String,  default: '' },
  price:       { type: String,  required: true },
  description: { type: String,  default: '' },
  imageUrl:    { type: String,  default: '' },
  tags:        { type: [String], default: [] },
  isNew:       { type: Boolean, default: false },
  isBlended:   { type: Boolean, default: false },
  sortOrder:   { type: Number,  default: 0 },
  active:      { type: Boolean, default: true }
}, { timestamps: true, suppressReservedKeysWarning: true });

const MenuItem = mongoose.model('MenuItem', menuItemSchema, 'menuitems');

// ── MULTER STORAGE ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ── BLOG ROUTES ───────────────────────────────────────────────────────
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/blogs', upload.single('image'), async (req, res) => {
  try {
    const blogData = {
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      excerpt: req.body.excerpt,
      content: req.body.content,
    };
    if (req.file) blogData.imageUrl = `/uploads/${req.file.filename}`;
    const blog = new Blog(blogData);
    await blog.save();
    res.status(201).json(blog);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.put('/api/blogs/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      excerpt: req.body.excerpt,
      content: req.body.content
    };
    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;
    const updated = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Blog not found" });
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Blog not found" });
    res.status(204).send();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── MENU ROUTES ───────────────────────────────────────────────────────
app.get('/api/menuitems', async (req, res) => {
  try {
    const items = await MenuItem.find({ active: true }).sort({ sortOrder: 1, name: 1 });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/menuitems', async (req, res) => {
  try {
    const items = await MenuItem.find().sort({ sortOrder: 1, name: 1 });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/menuitems', upload.single('image'), async (req, res) => {
  try {
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const itemData = {
      name:        req.body.name,
      category:    req.body.category,
      subcategory: req.body.subcategory || '',
      price:       req.body.price,
      description: req.body.description || '',
      tags,
      isNew:       req.body.isNew === 'true' || req.body.isNew === true,
      isBlended:   req.body.isBlended === 'true' || req.body.isBlended === true,
      sortOrder:   parseInt(req.body.sortOrder) || 0,
      active:      req.body.active !== 'false'
    };
    if (req.file) itemData.imageUrl = `/uploads/${req.file.filename}`;
    const newItem = new MenuItem(itemData);
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.put('/api/menuitems/:id', upload.single('image'), async (req, res) => {
  try {
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const updateData = {
      name:        req.body.name,
      category:    req.body.category,
      subcategory: req.body.subcategory || '',
      price:       req.body.price,
      description: req.body.description || '',
      tags,
      isNew:       req.body.isNew === 'true' || req.body.isNew === true,
      isBlended:   req.body.isBlended === 'true' || req.body.isBlended === true,
      sortOrder:   parseInt(req.body.sortOrder) || 0,
      active:      req.body.active !== 'false'
    };
    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Menu item not found' });
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/menuitems/:id', async (req, res) => {
  try {
    const deleted = await MenuItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Menu item not found' });
    res.status(204).send();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/menuitems/:id/toggle', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    item.active = !item.active;
    await item.save();
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── HEALTH CHECK (now shows more info) ────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uploadsDir: UPLOAD_DIR,
    frontendDir: FRONTEND_DIR,
    indexExists: fs.existsSync(path.join(FRONTEND_DIR, 'index.html')),
    menuExists: fs.existsSync(path.join(FRONTEND_DIR, 'menu.html')),
    adminMenuExists: fs.existsSync(path.join(FRONTEND_DIR, 'admin-menu.html'))
  });
});

// ── SPA CATCH-ALL (fixed wildcard syntax) ─────────────────────────────
app.get('/*all', (req, res) => {
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Better fallback message
    res.status(404).send(`
      <h1>404 - Frontend Entry Point Missing</h1>
      <p>Express is configured to serve static files from:</p>
      <pre>${FRONTEND_DIR}</pre>
      <p>But <strong>index.html</strong> was not found there.</p>
      <p>Possible fixes:</p>
      <ul>
        <li>Move your HTML files into <code>${FRONTEND_DIR}</code></li>
        <li>Or change <code>FRONTEND_DIR</code> in server.js to the correct path</li>
        <li>Check file names (must be index.html for default route)</li>
      </ul>
      <p><a href="/health">View detailed server health</a></p>
    `);
  }
});

// ── START SERVER ──────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend directory: ${FRONTEND_DIR}`);
  console.log(`index.html found? ${fs.existsSync(path.join(FRONTEND_DIR, 'index.html')) ? 'YES' : 'NO'}`);
  console.log(`menu.html found?  ${fs.existsSync(path.join(FRONTEND_DIR, 'menu.html'))  ? 'YES' : 'NO'}`);
  console.log(`admin-menu.html found? ${fs.existsSync(path.join(FRONTEND_DIR, 'admin-menu.html')) ? 'YES' : 'NO'}`);
  console.log(`=================================`);
});