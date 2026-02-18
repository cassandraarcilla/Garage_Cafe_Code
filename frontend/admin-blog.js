// ============ ADMIN BLOG SCRIPT ============
const blogForm = document.getElementById('blogForm');
const blogsTable = document.getElementById('blogsTable');

// Initialize Quill editor
const quill = new Quill('#editor', { 
    theme: 'snow',
    modules: {
        toolbar: [
            [{ 'header': [1,2,3,4,5,6, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['link', 'image'],
            ['clean']
        ]
    }
});

// AUTO SWITCH: Local vs Render
const BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : "https://garage-cafe.onrender.com";

const API = `${BASE_URL}/api/blogs`;

console.log('API URL:', API);

// Helper function to properly construct image URLs
function getFullImageUrl(imageUrl) {
    if (!imageUrl) return '';
    
    console.log('Original imageUrl:', imageUrl);
    
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        console.log('Already full URL:', imageUrl);
        return imageUrl;
    }
    
    // If it's a local GRG file
    if (imageUrl.startsWith('GRG/')) {
        console.log('Local GRG file:', imageUrl);
        return imageUrl;
    }
    
    // If it starts with /uploads, construct full URL to backend
    if (imageUrl.startsWith('/uploads/')) {
        const fullUrl = `${BASE_URL}${imageUrl}`;
        console.log('Constructed upload URL:', fullUrl);
        return fullUrl;
    }
    
    // Clean the path and construct URL
    const cleanPath = imageUrl.replace(/^\.\/|^\.\.\/|^\/+/, '');
    const fullUrl = `${BASE_URL}/${cleanPath}`;
    console.log('Constructed URL:', fullUrl);
    return fullUrl;
}

// Load blogs
async function loadBlogs() {
    try {
        console.log('Fetching blogs from:', API);
        const res = await fetch(API, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const blogs = await res.json();
        console.log('Blogs loaded:', blogs.length);

        blogsTable.innerHTML = '';
        
        if (blogs.length === 0) {
            blogsTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem;">No blogs found. Create your first blog post!</td></tr>';
            return;
        }
        
        blogs.forEach(blog => {
            const row = document.createElement('tr');

            // PHOTO COLUMN REMOVED - No image preview in table

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
    } catch (error) {
        console.error('Error loading blogs:', error);
        blogsTable.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding:2rem;">
            Error loading blogs: ${error.message}<br>
            <button onclick="loadBlogs()" style="width:auto; margin-top:1rem;">Retry</button>
        </td></tr>`;
    }
}

// Submit form
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
    if (image) {
        console.log('Uploading image:', image.name);
        formData.append('image', image);
    }

    try {
        console.log('Saving blog to:', id ? `${API}/${id}` : API);
        const res = await fetch(id ? `${API}/${id}` : API, {
            method: id ? 'PUT' : 'POST',
            body: formData
        });

        if (res.ok) {
            const savedBlog = await res.json();
            console.log('Blog saved successfully:', savedBlog);
            alert(id ? 'Blog updated successfully!' : 'Blog posted successfully!');
            
            // Reset form
            blogForm.reset();
            quill.setContents([]);
            document.getElementById('blogId').value = '';
            
            // Hide image preview
            const preview = document.getElementById('currentImagePreview');
            const previewLabel = document.getElementById('currentImageLabel');
            if (preview) {
                preview.style.display = 'none';
                previewLabel.style.display = 'none';
            }
            
            // Reload blogs
            loadBlogs();
        } else {
            const errorText = await res.text();
            console.error('Server error:', errorText);
            alert('Something went wrong: ' + (errorText || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving blog:', error);
        alert('Error saving blog. Check your connection and try again.');
    }
});

// Edit blog
async function editBlog(id) {
    try {
        console.log('Editing blog:', id);
        const res = await fetch(API);
        const blogs = await res.json();
        const blog = blogs.find(b => b._id === id);

        if (!blog) {
            alert('Blog not found');
            return;
        }

        console.log('Blog data:', blog);

        document.getElementById('blogId').value = blog._id;
        document.getElementById('title').value = blog.title;
        document.getElementById('author').value = blog.author;
        document.getElementById('category').value = blog.category;
        quill.root.innerHTML = blog.content;

        // Show current image
        const preview = document.getElementById('currentImagePreview');
        const previewLabel = document.getElementById('currentImageLabel');
        
        if (preview && blog.imageUrl) {
            const fullImageUrl = getFullImageUrl(blog.imageUrl);
            preview.src = fullImageUrl;
            preview.style.display = 'block';
            previewLabel.style.display = 'block';
            console.log('Preview image set to:', fullImageUrl);
        }

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('Error editing blog:', error);
        alert('Error loading blog for editing');
    }
}

// Delete blog
async function deleteBlog(id) {
    if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('Deleting blog:', id);
        const res = await fetch(`${API}/${id}`, { 
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (res.ok || res.status === 204) {
            console.log('Blog deleted successfully');
            alert('Blog deleted successfully');
            loadBlogs();
        } else {
            const error = await res.text();
            console.error('Delete failed:', error);
            alert('Failed to delete blog: ' + error);
        }
    } catch (error) {
        console.error('Error deleting blog:', error);
        alert('Error deleting blog. Check your connection.');
    }
}

// Load blogs when page loads and user is logged in
document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        console.log('User logged in, loading blogs...');
        setTimeout(loadBlogs, 500); // Small delay to ensure DOM is ready
    }
});

// Make functions available globally
window.editBlog = editBlog;
window.deleteBlog = deleteBlog;
window.loadBlogs = loadBlogs;