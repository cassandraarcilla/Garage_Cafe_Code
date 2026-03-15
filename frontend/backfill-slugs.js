require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://annenicholealimurung_db_user:G4r%40geCaFE@cluster0.ic7yr6s.mongodb.net/garageCafe?retryWrites=true&w=majority";

function toSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

const Blog = mongoose.model('Blog', new mongoose.Schema({ title: String, slug: String }, { strict: false }));

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected');
  const posts = await Blog.find({ slug: { $exists: false } });
  console.log(`${posts.length} posts need slugs`);
  for (const post of posts) {
    let slug = toSlug(post.title), n = 2;
    while (await Blog.findOne({ slug, _id: { $ne: post._id } })) slug = `${toSlug(post.title)}-${n++}`;
    post.slug = slug;
    await post.save();
    console.log(`  "${post.title}" → "${slug}"`);
  }
  console.log('Done!');
  await mongoose.disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
