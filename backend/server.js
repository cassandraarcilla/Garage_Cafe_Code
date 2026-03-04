require('dotenv').config();

const express        = require('express');
const mongoose       = require('mongoose');
const multer         = require('multer');
const path           = require('path');
const cors           = require('cors');
const fs             = require('fs');
const cloudinary     = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CLOUDINARY CONFIG ─────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── CORS ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://visitgaragecafe.com',
  'https://www.visitgaragecafe.com',
  'https://garage-cafe-code.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── FRONTEND (local dev only) ─────────────────────────────────────────
const IS_RENDER    = !!process.env.RENDER;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

if (!IS_RENDER && fs.existsSync(FRONTEND_DIR)) {
  console.log('Local mode: serving frontend from', FRONTEND_DIR);
  app.use(express.static(FRONTEND_DIR));
} else {
  console.log('Production mode: API only (frontend on Hostinger)');
}

// ── MONGODB ───────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafe?retryWrites=true&w=majority";

console.log("Connecting to MongoDB...");
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => { console.error("MongoDB error:", err.message); process.exit(1); });

// ── SCHEMAS & MODELS ──────────────────────────────────────────────────
const blogSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  author:   { type: String, required: true },
  category: { type: String },
  excerpt:  { type: String },
  content:  { type: String },
  imageUrl:  { type: String },
  imagePublicId: { type: String }   // stores Cloudinary public_id for deletion
}, { timestamps: true });

const Blog = mongoose.model('Blog', blogSchema);

const menuItemSchema = new mongoose.Schema({
  name:          { type: String,   required: true },
  category:      { type: String,   required: true },
  subcategory:   { type: String,   default: '' },
  price:         { type: String,   required: true },
  description:   { type: String,   default: '' },
  imageUrl:      { type: String,   default: '' },
  imagePublicId: { type: String,   default: '' }, // stores Cloudinary public_id for deletion
  tags:          { type: [String], default: [] },
  isNew:         { type: Boolean,  default: false },
  isBlended:     { type: Boolean,  default: false },
  sortOrder:     { type: Number,   default: 0 },
  active:        { type: Boolean,  default: true }
}, { timestamps: true, suppressReservedKeysWarning: true });

const MenuItem = mongoose.model('MenuItem', menuItemSchema, 'menuitems');

// ── MULTER → CLOUDINARY STORAGE ───────────────────────────────────────
// Blog images go into garage-cafe/blogs folder on Cloudinary
const blogStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'garage-cafe/blogs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 630, crop: 'limit', quality: 'auto' }]
  }
});

// Menu item images go into garage-cafe/menu folder on Cloudinary
const menuStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'garage-cafe/menu',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});

const uploadBlog = multer({
  storage: blogStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const uploadMenu = multer({
  storage: menuStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ── HELPER: delete old Cloudinary image ──────────────────────────────
async function deleteCloudinaryImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log('Deleted Cloudinary image:', publicId);
  } catch (err) {
    console.warn('Could not delete Cloudinary image:', err.message);
  }
}

// ── ROOT & HEALTH ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (!IS_RENDER && fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
    return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }
  res.json({
    status: 'Garage Cafe API is running ☕',
    endpoints: {
      menu:      'GET /api/menuitems',
      adminMenu: 'GET /api/admin/menuitems',
      blogs:     'GET /api/blogs',
      health:    'GET /health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
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
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/blogs', uploadBlog.single('image'), async (req, res) => {
  try {
    const blogData = {
      title:    req.body.title,
      author:   req.body.author,
      category: req.body.category,
      excerpt:  req.body.excerpt,
      content:  req.body.content
    };
    if (req.file) {
      blogData.imageUrl      = req.file.path;        // Cloudinary HTTPS URL
      blogData.imagePublicId = req.file.filename;    // Cloudinary public_id
    }
    const blog = new Blog(blogData);
    await blog.save();
    res.status(201).json(blog);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.put('/api/blogs/:id', uploadBlog.single('image'), async (req, res) => {
  try {
    const updateData = {
      title:    req.body.title,
      author:   req.body.author,
      category: req.body.category,
      excerpt:  req.body.excerpt,
      content:  req.body.content
    };
    if (req.file) {
      // Delete old image from Cloudinary before replacing
      const existing = await Blog.findById(req.params.id);
      if (existing && existing.imagePublicId) {
        await deleteCloudinaryImage(existing.imagePublicId);
      }
      updateData.imageUrl      = req.file.path;
      updateData.imagePublicId = req.file.filename;
    }
    const updated = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Blog not found' });
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Blog not found' });
    // Clean up Cloudinary image
    await deleteCloudinaryImage(deleted.imagePublicId);
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

app.post('/api/menuitems', uploadMenu.single('image'), async (req, res) => {
  try {
    const tags = req.body.tags
      ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const itemData = {
      name:        req.body.name,
      category:    req.body.category,
      subcategory: req.body.subcategory || '',
      price:       req.body.price,
      description: req.body.description || '',
      tags,
      isNew:     req.body.isNew     === 'true' || req.body.isNew     === true,
      isBlended: req.body.isBlended === 'true' || req.body.isBlended === true,
      sortOrder: parseInt(req.body.sortOrder) || 0,
      active:    req.body.active !== 'false'
    };
    if (req.file) {
      itemData.imageUrl      = req.file.path;       // Cloudinary HTTPS URL
      itemData.imagePublicId = req.file.filename;   // Cloudinary public_id
    }
    const newItem = new MenuItem(itemData);
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.put('/api/menuitems/:id', uploadMenu.single('image'), async (req, res) => {
  try {
    const tags = req.body.tags
      ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const updateData = {
      name:        req.body.name,
      category:    req.body.category,
      subcategory: req.body.subcategory || '',
      price:       req.body.price,
      description: req.body.description || '',
      tags,
      isNew:     req.body.isNew     === 'true' || req.body.isNew     === true,
      isBlended: req.body.isBlended === 'true' || req.body.isBlended === true,
      sortOrder: parseInt(req.body.sortOrder) || 0,
      active:    req.body.active !== 'false'
    };
    if (req.file) {
      // Delete old image from Cloudinary before replacing
      const existing = await MenuItem.findById(req.params.id);
      if (existing && existing.imagePublicId) {
        await deleteCloudinaryImage(existing.imagePublicId);
      }
      updateData.imageUrl      = req.file.path;
      updateData.imagePublicId = req.file.filename;
    }
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Menu item not found' });
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/menuitems/:id', async (req, res) => {
  try {
    const deleted = await MenuItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Menu item not found' });
    // Clean up Cloudinary image
    await deleteCloudinaryImage(deleted.imagePublicId);
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

// ── SPA CATCH-ALL (local only) ────────────────────────────────────────
if (!IS_RENDER) {
  app.use((req, res) => {
    const filePath = path.join(FRONTEND_DIR, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.status(404).send('Not found');
  });
}

// ── START ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`Garage Cafe API running on port ${PORT}`);
  console.log(`=================================`);
});