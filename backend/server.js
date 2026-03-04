require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_DIR));

const FRONTEND_DIR = path.join(__dirname, '../frontend');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
}

const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafeDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => { console.error("MongoDB error:", err.message); process.exit(1); });

// ── Blog Schema (unchanged) ──────────────────────────────────────────
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String },
  excerpt: { type: String },
  content: { type: String },
  imageUrl: { type: String }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);

// ── Menu Item Schema ─────────────────────────────────────────────────
// Connects to garageCafeDB → menuitems collection
const menuItemSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  category:    { type: String, required: true },
  subcategory: { type: String, default: '' },
  price:       { type: String, required: true },
  description: { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  tags:        [{ type: String }],
  isNew:       { type: Boolean, default: false },
  isBlended:   { type: Boolean, default: false },
  sortOrder:   { type: Number, default: 0 },
  active:      { type: Boolean, default: true }
}, { timestamps: true });

const MenuItem = mongoose.model("MenuItem", menuItemSchema, "menuitems");

// ── Multer ────────────────────────────────────────────────────────────
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
    else cb(new Error('Only image files allowed'));
  }
});

// ====================================================================
// BLOG ROUTES (all original, unchanged)
// ====================================================================
app.get('/api/blogs', async (req, res) => {
  try { res.json(await Blog.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
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
    const blogData = { title: req.body.title, author: req.body.author, category: req.body.category, excerpt: req.body.excerpt, content: req.body.content };
    if (req.file) blogData.imageUrl = `/uploads/${req.file.filename}`;
    res.status(201).json(await new Blog(blogData).save());
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.put('/api/blogs/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = { title: req.body.title, author: req.body.author, category: req.body.category, excerpt: req.body.excerpt, content: req.body.content };
    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;
    const updated = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
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

// ====================================================================
// MENU ITEMS ROUTES
// ====================================================================

// Public — menu.html fetches this (active items only)
app.get('/api/menuitems', async (req, res) => {
  try {
    res.json(await MenuItem.find({ active: true }).sort({ category: 1, sortOrder: 1, createdAt: 1 }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin — admin-menu.html fetches this (all items)
app.get('/api/admin/menuitems', async (req, res) => {
  try {
    res.json(await MenuItem.find().sort({ category: 1, sortOrder: 1, createdAt: 1 }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/menuitems/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/menuitems', upload.single('image'), async (req, res) => {
  try {
    const tags = req.body.tags
      ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const itemData = {
      name: req.body.name, category: req.body.category, subcategory: req.body.subcategory || '',
      price: req.body.price, description: req.body.description || '', tags,
      isNew: req.body.isNew === 'true', isBlended: req.body.isBlended === 'true',
      sortOrder: parseInt(req.body.sortOrder) || 0, active: req.body.active !== 'false'
    };
    if (req.file) itemData.imageUrl = `/uploads/${req.file.filename}`;
    res.status(201).json(await new MenuItem(itemData).save());
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.put('/api/menuitems/:id', upload.single('image'), async (req, res) => {
  try {
    const tags = req.body.tags
      ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const updateData = {
      name: req.body.name, category: req.body.category, subcategory: req.body.subcategory || '',
      price: req.body.price, description: req.body.description || '', tags,
      isNew: req.body.isNew === 'true', isBlended: req.body.isBlended === 'true',
      sortOrder: parseInt(req.body.sortOrder) || 0, active: req.body.active !== 'false'
    };
    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Menu item not found" });
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/menuitems/:id', async (req, res) => {
  try {
    const deleted = await MenuItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Menu item not found" });
    res.status(204).send();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/menuitems/:id/toggle', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    item.active = !item.active;
    await item.save();
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});