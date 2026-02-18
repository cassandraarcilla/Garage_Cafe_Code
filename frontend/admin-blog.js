const blogForm = document.getElementById('blogForm');
const blogsTable = document.getElementById('blogsTable');
const quill = new Quill('#editor', { theme: 'snow' });

// AUTO SWITCH: Local vs Render
const BASE_URL =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://garage-cafe.onrender.com";

const API = `${BASE_URL}/api/blogs`;

// Load blogs
async function loadBlogs() {
    try {
        const res = await fetch(API);
        const blogs = await res.json();

        blogsTable.innerHTML = '';
        blogs.forEach(blog => {
            const row = document.createElement('tr');

            // Show thumbnail preview in table
            const imgPreview = blog.imageUrl
                ? `<img src="${blog.imageUrl}" style="width:60px;height:40px;object-fit:cover;border-radius:6px;">`
                : '—';

            row.innerHTML = `
                <td>${imgPreview}</td>
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
    } catch (error) {
        console.error('Error loading blogs:', error);
    }
}

// Submit
blogForm.addEventListener('submit', async e => {
    e.preventDefault();

    const id = document.getElementById('blogId').value;
    const formData = new FormData();

    formData.append('title', document.getElementById('title').value);
    formData.append('author', document.getElementById('author').value);
    formData.append('category', document.getElementById('category').value);

    const plainText = quill.getText().trim();
    const excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
    formData.append('excerpt', excerpt);
    formData.append('content', quill.root.innerHTML);

    const image = document.getElementById('image').files[0];
    if (image) formData.append('image', image);

    try {
        const res = await fetch(id ? `${API}/${id}` : API, {
            method: id ? 'PUT' : 'POST',
            body: formData
        });

        if (res.ok) {
            alert(id ? 'Blog updated!' : 'Blog posted!');
            blogForm.reset();
            quill.setContents([]);
            document.getElementById('blogId').value = '';
            loadBlogs();
        } else {
            alert('Something went wrong. Please try again.');
        }
    } catch (error) {
        console.error('Error saving blog:', error);
        alert('Error saving blog. Check your connection.');
    }
});

// Edit
async function editBlog(id) {
    try {
        const res = await fetch(API);
        const blogs = await res.json();
        const blog = blogs.find(b => b._id === id);

        document.getElementById('blogId').value = blog._id;
        document.getElementById('title').value = blog.title;
        document.getElementById('author').value = blog.author;
        document.getElementById('category').value = blog.category;
        quill.root.innerHTML = blog.content;

        // Show current image
        const preview = document.getElementById('currentImagePreview');
        if (preview) {
            preview.src = blog.imageUrl || '';
            preview.style.display = blog.imageUrl ? 'block' : 'none';
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('Error editing blog:', error);
    }
}

// Delete
async function deleteBlog(id) {
    if (!confirm('Delete this blog?')) return;
    try {
        await fetch(`${API}/${id}`, { method: 'DELETE' });
        loadBlogs();
    } catch (error) {
        console.error('Error deleting blog:', error);
    }
}

loadBlogs();