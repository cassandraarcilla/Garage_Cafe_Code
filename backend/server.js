// dotenv — explicit path so it works regardless of where `node` is run from
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

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

const CLOUDINARY_READY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');
console.log('Cloudinary ready:', CLOUDINARY_READY);

// multer-storage-cloudinary exposes URL differently across versions — handle all
function getCloudinaryUrl(file) {
  if (!file) return null;
  const url = file.secure_url || file.path || null;
  if (!url && file.public_id) {
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${file.public_id}`;
  }
  return url;
}

function getCloudinaryPublicId(file) {
  if (!file) return null;
  return file.public_id || file.filename || null;
}

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── UPLOADS DIR (kept for safety, not used when Cloudinary is active) ─
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

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

// ── SCHEMAS ───────────────────────────────────────────────────────────
const blogSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  author:        { type: String, required: true },
  category:      { type: String },
  excerpt:       { type: String },
  content:       { type: String },
  imageUrl:      { type: String },
  imagePublicId: { type: String }
}, { timestamps: true });
const Blog = mongoose.model('Blog', blogSchema);

const menuItemSchema = new mongoose.Schema({
  name:          { type: String,   required: true },
  category:      { type: String,   required: true },
  subcategory:   { type: String,   default: '' },
  price:         { type: String,   required: true },
  description:   { type: String,   default: '' },
  imageUrl:      { type: String,   default: '' },
  imagePublicId: { type: String,   default: '' },
  tags:          { type: [String], default: [] },
  isNew:         { type: Boolean,  default: false },
  isBlended:     { type: Boolean,  default: false },
  sortOrder:     { type: Number,   default: 0 },
  active:        { type: Boolean,  default: true }
}, { timestamps: true, suppressReservedKeysWarning: true });
const MenuItem = mongoose.model('MenuItem', menuItemSchema, 'menuitems');

// ── CLOUDINARY MULTER STORAGE ─────────────────────────────────────────
const blogStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'garage-cafe/blogs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 1200, height: 630, crop: 'limit', quality: 'auto' }]
  }
});

const menuStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'garage-cafe/menu',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const uploadBlog = multer({ storage: blogStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
const uploadMenu = multer({ storage: menuStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

// Wraps multer so upload errors return proper JSON instead of crashing
function handleUpload(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ message: err.message || 'Upload failed' });
      }
      next();
    });
  };
}

// ── DELETE OLD CLOUDINARY IMAGE ───────────────────────────────────────
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
    cloudinary: CLOUDINARY_READY ? 'connected' : 'NOT CONFIGURED — images will not save',
    endpoints: { menu: 'GET /api/menuitems', adminMenu: 'GET /api/admin/menuitems', blogs: 'GET /api/blogs', health: 'GET /health' }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), cloudinary: CLOUDINARY_READY ? 'connected' : 'not configured' });
});

// ── DEBUG: test Cloudinary connection ─────────────────────────────────
// Visit http://localhost:3000/api/cloudinary-test to verify connection
app.get('/api/cloudinary-test', async (req, res) => {
  if (!CLOUDINARY_READY) {
    return res.status(500).json({ ok: false, message: 'Cloudinary env vars not set', cloud_name: process.env.CLOUDINARY_CLOUD_NAME });
  }
  try {
    const result = await cloudinary.api.ping();
    res.json({ ok: true, message: 'Cloudinary connected!', cloud_name: process.env.CLOUDINARY_CLOUD_NAME, result });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message, cloud_name: process.env.CLOUDINARY_CLOUD_NAME });
  }
});

// ── BLOG ROUTES ───────────────────────────────────────────────────────
app.get('/api/blogs', async (req, res) => {
  try { res.json(await Blog.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/blogs', handleUpload(uploadBlog.single('image')), async (req, res) => {
  try {
    const blogData = { title: req.body.title, author: req.body.author, category: req.body.category, excerpt: req.body.excerpt, content: req.body.content };
    if (req.file) {
      blogData.imageUrl      = getCloudinaryUrl(req.file);
      blogData.imagePublicId = getCloudinaryPublicId(req.file);
      console.log('Blog image saved to Cloudinary:', blogData.imageUrl);
    }
    res.status(201).json(await new Blog(blogData).save());
  } catch (err) { console.error('POST /api/blogs:', err); res.status(400).json({ message: err.message || 'Failed to save blog' }); }
});

app.put('/api/blogs/:id', handleUpload(uploadBlog.single('image')), async (req, res) => {
  try {
    const updateData = { title: req.body.title, author: req.body.author, category: req.body.category, excerpt: req.body.excerpt, content: req.body.content };
    if (req.file) {
      const existing = await Blog.findById(req.params.id);
      if (existing?.imagePublicId) await deleteCloudinaryImage(existing.imagePublicId);
      updateData.imageUrl      = getCloudinaryUrl(req.file);
      updateData.imagePublicId = getCloudinaryPublicId(req.file);
      console.log('Blog image updated on Cloudinary:', updateData.imageUrl);
    }
    const updated = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Blog not found' });
    res.json(updated);
  } catch (err) { console.error('PUT /api/blogs:', err); res.status(400).json({ message: err.message || 'Failed to update blog' }); }
});

app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Blog not found' });
    await deleteCloudinaryImage(deleted.imagePublicId);
    res.status(204).send();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── MENU ROUTES ───────────────────────────────────────────────────────
app.get('/api/menuitems', async (req, res) => {
  try { res.json(await MenuItem.find({ active: true }).sort({ sortOrder: 1, name: 1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/menuitems', async (req, res) => {
  try { res.json(await MenuItem.find().sort({ sortOrder: 1, name: 1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/menuitems', handleUpload(uploadMenu.single('image')), async (req, res) => {
  try {
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const itemData = {
      name: req.body.name, category: req.body.category, subcategory: req.body.subcategory || '',
      price: req.body.price, description: req.body.description || '', tags,
      isNew: req.body.isNew === 'true' || req.body.isNew === true,
      isBlended: req.body.isBlended === 'true' || req.body.isBlended === true,
      sortOrder: parseInt(req.body.sortOrder) || 0, active: req.body.active !== 'false'
    };
    if (req.file) {
      itemData.imageUrl      = getCloudinaryUrl(req.file);
      itemData.imagePublicId = getCloudinaryPublicId(req.file);
      console.log('Menu image saved to Cloudinary:', itemData.imageUrl);
    }
    res.status(201).json(await new MenuItem(itemData).save());
  } catch (err) { console.error('POST /api/menuitems:', err); res.status(400).json({ message: err.message || 'Failed to save menu item' }); }
});

app.put('/api/menuitems/:id', handleUpload(uploadMenu.single('image')), async (req, res) => {
  try {
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const updateData = {
      name: req.body.name, category: req.body.category, subcategory: req.body.subcategory || '',
      price: req.body.price, description: req.body.description || '', tags,
      isNew: req.body.isNew === 'true' || req.body.isNew === true,
      isBlended: req.body.isBlended === 'true' || req.body.isBlended === true,
      sortOrder: parseInt(req.body.sortOrder) || 0, active: req.body.active !== 'false'
    };
    if (req.file) {
      const existing = await MenuItem.findById(req.params.id);
      if (existing?.imagePublicId) await deleteCloudinaryImage(existing.imagePublicId);
      updateData.imageUrl      = getCloudinaryUrl(req.file);
      updateData.imagePublicId = getCloudinaryPublicId(req.file);
      console.log('Menu image updated on Cloudinary:', updateData.imageUrl);
    }
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Menu item not found' });
    res.json(updated);
  } catch (err) { console.error('PUT /api/menuitems:', err); res.status(400).json({ message: err.message || 'Failed to update menu item' }); }
});

app.delete('/api/menuitems/:id', async (req, res) => {
  try {
    const deleted = await MenuItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Menu item not found' });
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
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send('Not found');
  });
}

// ── START ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`Garage Cafe API on port ${PORT}`);
  console.log(`Cloudinary: ${CLOUDINARY_READY ? 'CONNECTED ✓' : 'NOT CONFIGURED ✗'}`);
  console.log(`=================================`);
});