/**
 * sitemap-blogs.js
 * Run this script whenever you publish new blog posts to regenerate sitemap.xml
 * Usage:  node sitemap-blogs.js
 * Then upload the generated sitemap.xml to your Hostinger root directory.
 */

const https = require('https');
const fs    = require('fs');

const API_URL   = 'https://garage-cafe-code.onrender.com/api/blogs';
const SITE_ROOT = 'https://www.visitgaragecafe.com';
const OUT_FILE  = './sitemap.xml';
const TODAY     = new Date().toISOString().split('T')[0];

// Static pages — edit priority / changefreq as needed
const STATIC_PAGES = [
  { loc: '/',            changefreq: 'weekly',  priority: '1.0' },
  { loc: '/about.html',  changefreq: 'monthly', priority: '0.8' },
  { loc: '/menu.html',   changefreq: 'weekly',  priority: '0.9' },
  { loc: '/blog.html',   changefreq: 'weekly',  priority: '0.8' },
  { loc: '/contact.html',changefreq: 'monthly', priority: '0.7' },
];

function fetchBlogs() {
  return new Promise((resolve, reject) => {
    https.get(API_URL, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generate() {
  console.log('Fetching blog posts from API...');
  let blogs = [];
  try {
    blogs = await fetchBlogs();
    console.log(`Found ${blogs.length} blog posts.`);
  } catch (err) {
    console.warn('Could not fetch blogs (server may be sleeping). Generating static pages only.');
    console.warn('Error:', err.message);
  }

  const staticEntries = STATIC_PAGES.map(p => `
  <url>
    <loc>${escapeXml(SITE_ROOT + p.loc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');

  const blogEntries = blogs.map(b => {
    const lastmod = b.updatedAt
      ? new Date(b.updatedAt).toISOString().split('T')[0]
      : TODAY;
    return `
  <url>
    <loc>${escapeXml(`${SITE_ROOT}/blog-single.html?id=${b._id}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${blogEntries}
</urlset>`;

  fs.writeFileSync(OUT_FILE, xml.trim(), 'utf8');
  console.log(`sitemap.xml written to ${OUT_FILE}`);
  console.log(`Total URLs: ${STATIC_PAGES.length + blogs.length}`);
}

generate();