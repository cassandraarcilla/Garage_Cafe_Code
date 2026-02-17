const blogForm = document.getElementById('blogForm');
const blogsTable = document.getElementById('blogsTable');
const quill = new Quill('#editor', { theme: 'snow' });

// ✅ Use Render backend URL
const BASE_URL = 'https://garage-cafe.onrender.com';
const API = `${BASE_URL}/api/blogs`;

// Load blogs
async function loadBlogs() {
    const res = await fetch(API);
    const blogs = await res.json();

    blogsTable.innerHTML = '';
    blogs.forEach(blog => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${blog.title}</td>
            <td>${blog.author}</td>
            <td>${blog.category}</td>
            <td>
                <button onclick="editBlog('${blog._id}')">Edit</button>
                <button onclick="deleteBlog('${blog._id}')">Delete</button>
            </td>
        `;
        blogsTable.appendChild(row);
    });
}

// Submit
blogForm.addEventListener('submit', async e => {
    e.preventDefault();

    const id = document.getElementById('blogId').value;
    const formData = new FormData();

    formData.append('title', document.getElementById('title').value);
    formData.append('author', document.getElementById('author').value);
    formData.append('category', document.getElementById('category').value);
    formData.append('excerpt', quill.getText().substring(0, 150) + '...');
    formData.append('content', quill.root.innerHTML);

    const image = document.getElementById('image').files[0];
    if (image) formData.append('image', image);

    await fetch(id ? `${API}/${id}` : API, {
        method: id ? 'PUT' : 'POST',
        body: formData
    });

    blogForm.reset();
    quill.setContents([]);
    document.getElementById('blogId').value = '';
    loadBlogs();
});

// Edit
async function editBlog(id) {
    const res = await fetch(API);
    const blogs = await res.json();
    const blog = blogs.find(b => b._id === id);

    document.getElementById('blogId').value = blog._id;
    document.getElementById('title').value = blog.title;
    document.getElementById('author').value = blog.author;
    document.getElementById('category').value = blog.category;
    quill.root.innerHTML = blog.content;
}

// Delete
async function deleteBlog(id) {
    if (!confirm('Delete this blog?')) return;
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    loadBlogs();
}

loadBlogs();