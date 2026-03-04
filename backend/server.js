require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const multer     = require('multer');
const path       = require('path');
const cors       = require('cors');
const fs         = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── STATIC FILES & UPLOADS ────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve frontend files from parent directory (adjust if your HTML is in subfolder)
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

// ── MONGODB ───────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafe?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => {
    console.error("MongoDB Error:", err);
    process.exit(1);
  });

// ── BLOG MODEL ────────────────────────────────────────────────────────
const blogSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  author:   { type: String, required: true },
  category: String,
  excerpt:  String,
  content:  String,
  imageUrl: String
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);

// ── MENU MODEL ────────────────────────────────────────────────────────
const menuItemSchema = new mongoose.Schema({
  name:        { type: String,  required: true },
  category:    { type: String,  required: true },
  subcategory: String,
  price:       { type: String,  required: true },
  description: String,
  imageUrl:    String,
  tags:        [String],
  isNew:       Boolean,
  isBlended:   Boolean,
  sortOrder:   { type: Number, default: 0 },
  active:      { type: Boolean, default: true }
}, { timestamps: true });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// ── MULTER ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── BLOG ROUTES ───────────────────────────────────────────────────────
app.get('/api/blogs', async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.json(blogs);
});

app.get('/api/blogs/:id', async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  res.json(blog || { error: "Not found" });
});

app.post('/api/blogs', upload.single('image'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;
  const blog = new Blog(data);
  await blog.save();
  res.status(201).json(blog);
});

// ── MENU ROUTES (this is what was missing or broken) ──────────────────
app.get('/api/menuitems', async (req, res) => {
  try {
    const items = await MenuItem.find({ active: true }).sort({ sortOrder: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/menuitems', async (req, res) => {
  const items = await MenuItem.find().sort({ sortOrder: 1, name: 1 });
  res.json(items);
});

app.post('/api/menuitems', upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    data.tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
    data.isNew     = data.isNew === 'true' || data.isNew === true;
    data.isBlended = data.isBlended === 'true' || data.isBlended === true;
    data.active    = data.active !== 'false';
    data.sortOrder = parseInt(data.sortOrder) || 0;

    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    const item = new MenuItem(data);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/menuitems/:id', upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    data.tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
    data.isNew     = data.isNew === 'true' || data.isNew === true;
    data.isBlended = data.isBlended === 'true' || data.isBlended === true;
    data.active    = data.active !== 'false';
    data.sortOrder = parseInt(data.sortOrder) || 0;

    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    const updated = await MenuItem.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/menuitems/:id', async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

// ── CATCH-ALL for frontend (SPA support) ──────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});