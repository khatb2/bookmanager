// Bookmark Manager Application
class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.currentFilter = 'all';
        this.currentView = 'grid';
        this.isLoggedIn = false;
        
        // Initialize metadata fetcher
        this.metadataFetcher = new MetadataFetcher();
        
        this.init();
    }

    init() {
        this.loadBookmarks();
        
        // Initialize import/export manager
        this.importExportManager = new ImportExportManager(this);
        window.importExportManager = this.importExportManager;
        
        this.bindEvents();
        this.renderBookmarks();
        this.updateStats();
    }

    bindEvents() {
        // Modal events
        const addBookmarkBtn = document.getElementById('add-bookmark-btn');
        const modal = document.getElementById('add-bookmark-modal');
        const closeModal = document.getElementById('close-modal');
        const cancelBtn = document.getElementById('cancel-btn');
        const bookmarkForm = document.getElementById('bookmark-form');

        addBookmarkBtn.addEventListener('click', () => this.openModal());
        closeModal.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Form submission
        bookmarkForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Fetch metadata button
        const fetchMetadataBtn = document.getElementById('fetch-metadata-btn');
        fetchMetadataBtn.addEventListener('click', () => this.fetchMetadata());

        // Search functionality
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.filter));
        });

        // View toggle
        const gridViewBtn = document.getElementById('grid-view');
        const listViewBtn = document.getElementById('list-view');
        
        gridViewBtn.addEventListener('click', () => this.setView('grid'));
        listViewBtn.addEventListener('click', () => this.setView('list'));

        // Login button
        const loginBtn = document.getElementById('login-btn');
        loginBtn.addEventListener('click', () => this.handleLogin());

        // Import/Export buttons
        const importBtn = document.getElementById('import-btn');
        const exportBtn = document.getElementById('export-btn');
        
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importExportManager.showImportModal());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.importExportManager.showExportModal());
        }
    }

    openModal() {
        const modal = document.getElementById('add-bookmark-modal');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Focus on URL input
        setTimeout(() => {
            document.getElementById('url-input').focus();
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('add-bookmark-modal');
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Reset form
        document.getElementById('bookmark-form').reset();
        
        // Reset modal to add mode
        document.querySelector('.modal-header h2').textContent = 'إضافة رابط جديد';
        document.querySelector('#bookmark-form button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> حفظ الرابط';
        
        // Clear editing ID
        this.editingId = null;
    }

    async fetchMetadata() {
        const urlInput = document.getElementById('url-input');
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('يرجى إدخال رابط صحيح أولاً');
            return;
        }

        if (!this.isValidUrl(url)) {
            alert('يرجى إدخال رابط صحيح');
            return;
        }

        this.showLoading();

        try {
            const fetcher = new MetadataFetcher();
            const metadata = await fetcher.fetchMetadata(url);
            
            // Fill form with fetched data
            document.getElementById('title-input').value = metadata.title || '';
            document.getElementById('description-input').value = metadata.description || '';
            document.getElementById('image-input').value = metadata.image || '';
            
            // Generate and set tags
            const tags = fetcher.generateTags(url, metadata.title, metadata.description);
            document.getElementById('tags-input').value = tags.join(', ');
            
        } catch (error) {
            console.error('Error fetching metadata:', error);
            // Fallback to basic extraction
            await this.simulateFetchMetadata(url);
        } finally {
            this.hideLoading();
        }
    }

    async simulateFetchMetadata(url) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Extract domain for demo purposes
        const domain = new URL(url).hostname;
        
        // Fill form with simulated data
        document.getElementById('title-input').value = `صفحة من ${domain}`;
        document.getElementById('description-input').value = `وصف تلقائي للصفحة من موقع ${domain}`;
        document.getElementById('image-input').value = `https://via.placeholder.com/400x200?text=${encodeURIComponent(domain)}`;
        document.getElementById('tags-input').value = `${domain}, موقع, رابط`;
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const bookmarkData = {
            url: formData.get('url') || document.getElementById('url-input').value,
            title: formData.get('title') || document.getElementById('title-input').value,
            description: formData.get('description') || document.getElementById('description-input').value,
            image: formData.get('image') || document.getElementById('image-input').value,
            tags: (formData.get('tags') || document.getElementById('tags-input').value).split(',').map(tag => tag.trim()).filter(tag => tag),
            category: formData.get('category') || document.getElementById('category-input').value
        };

        if (!bookmarkData.url || !bookmarkData.title) {
            alert('يرجى ملء الحقول المطلوبة');
            return;
        }

        if (this.editingId) {
            // Update existing bookmark
            this.updateBookmark(this.editingId, bookmarkData);
            this.editingId = null;
        } else {
            // Add new bookmark
            const bookmark = {
                id: Date.now(),
                ...bookmarkData,
                createdAt: new Date().toISOString(),
                isFavorite: false
            };
            this.addBookmark(bookmark);
        }
        
        this.closeModal();
    }

    addBookmark(bookmark) {
        this.bookmarks.unshift(bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
        this.updateStats();
        
        // Show success message
        this.showNotification('تم حفظ الرابط بنجاح!', 'success');
    }

    editBookmark(id) {
        const bookmark = this.bookmarks.find(b => b.id === id);
        if (!bookmark) return;
        
        // Fill form with existing data
        document.getElementById('url-input').value = bookmark.url;
        document.getElementById('title-input').value = bookmark.title;
        document.getElementById('description-input').value = bookmark.description || '';
        document.getElementById('image-input').value = bookmark.image || '';
        document.getElementById('tags-input').value = bookmark.tags.join(', ');
        document.getElementById('category-input').value = bookmark.category || '';
        
        // Change modal title and button text
        document.querySelector('.modal-header h2').textContent = 'تعديل الرابط';
        document.querySelector('#bookmark-form button[type="submit"]').innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
        
        // Store editing ID
        this.editingId = id;
        
        // Open modal
        this.openModal();
    }

    updateBookmark(id, updatedData) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            this.bookmarks[index] = { ...this.bookmarks[index], ...updatedData };
            this.saveBookmarks();
            this.renderBookmarks();
            this.updateStats();
            this.showNotification('تم تحديث الرابط بنجاح!', 'success');
        }
    }

    deleteBookmark(id) {
        if (confirm('هل أنت متأكد من حذف هذا الرابط؟')) {
            this.bookmarks = this.bookmarks.filter(bookmark => bookmark.id !== id);
            this.saveBookmarks();
            this.renderBookmarks();
            this.updateStats();
            this.showNotification('تم حذف الرابط', 'info');
        }
    }

    toggleFavorite(id) {
        const bookmark = this.bookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.isFavorite = !bookmark.isFavorite;
            this.saveBookmarks();
            this.renderBookmarks();
            
            const message = bookmark.isFavorite ? 'تم إضافة الرابط للمفضلة' : 'تم إزالة الرابط من المفضلة';
            this.showNotification(message, 'info');
        }
    }

    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.renderBookmarks();
    }

    handleFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.renderBookmarks();
    }

    setView(view) {
        this.currentView = view;
        
        // Update active view button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Update grid class
        const bookmarkList = document.getElementById('bookmark-list');
        if (view === 'list') {
            bookmarkList.classList.add('list-view');
        } else {
            bookmarkList.classList.remove('list-view');
        }
        
        this.renderBookmarks();
    }

    filterBookmarks() {
        let filtered = [...this.bookmarks];
        
        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(bookmark => 
                bookmark.title.toLowerCase().includes(this.searchQuery) ||
                bookmark.description.toLowerCase().includes(this.searchQuery) ||
                bookmark.tags.some(tag => tag.toLowerCase().includes(this.searchQuery))
            );
        }
        
        // Apply category filter
        switch (this.currentFilter) {
            case 'recent':
                filtered = filtered.slice(0, 10);
                break;
            case 'favorites':
                filtered = filtered.filter(bookmark => bookmark.isFavorite);
                break;
            default:
                // 'all' - no additional filtering
                break;
        }
        
        return filtered;
    }

    renderBookmarks() {
        const bookmarkList = document.getElementById('bookmark-list');
        const emptyState = document.getElementById('empty-state');
        const filteredBookmarks = this.filterBookmarks();
        
        if (filteredBookmarks.length === 0) {
            bookmarkList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        bookmarkList.style.display = 'grid';
        emptyState.style.display = 'none';
        
        bookmarkList.innerHTML = filteredBookmarks.map(bookmark => this.createBookmarkCard(bookmark)).join('');
        
        // Bind card events
        this.bindCardEvents();
        
        // Enable drag and drop
        this.enableDragAndDrop();
    }

    enableDragAndDrop() {
        const cards = document.querySelectorAll('.bookmark-card');
        
        cards.forEach(card => {
            card.draggable = true;
            
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.id);
                card.classList.add('dragging');
            });
            
            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
            });
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingCard = document.querySelector('.dragging');
                if (draggingCard !== card) {
                    card.classList.add('drag-over');
                }
            });
            
            card.addEventListener('dragleave', (e) => {
                card.classList.remove('drag-over');
            });
            
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                
                const draggedId = e.dataTransfer.getData('text/plain');
                const targetId = card.dataset.id;
                
                if (draggedId !== targetId) {
                    this.reorderBookmarks(draggedId, targetId);
                }
            });
        });
    }

    reorderBookmarks(draggedId, targetId) {
        const draggedIndex = this.bookmarks.findIndex(b => b.id == draggedId);
        const targetIndex = this.bookmarks.findIndex(b => b.id == targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Remove dragged item and insert at target position
            const [draggedItem] = this.bookmarks.splice(draggedIndex, 1);
            this.bookmarks.splice(targetIndex, 0, draggedItem);
            
            this.saveBookmarks();
            this.renderBookmarks();
            this.showNotification('تم إعادة ترتيب الروابط', 'info');
        }
    }

    createBookmarkCard(bookmark) {
        const tagsHtml = bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const imageHtml = bookmark.image ? 
            `<img src="${bookmark.image}" alt="${bookmark.title}" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">` : 
            `<div style="height: 200px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; color: #6c757d;">لا توجد صورة</div>`;
        
        return `
            <div class="bookmark-card" data-id="${bookmark.id}">
                ${imageHtml}
                <div class="bookmark-card-content">
                    <h3>${bookmark.title}</h3>
                    <p>${bookmark.description || 'لا يوجد وصف'}</p>
                    <div class="tags">${tagsHtml}</div>
                    <div class="bookmark-card-actions">
                        <a href="${bookmark.url}" target="_blank" class="bookmark-url">زيارة الرابط</a>
                        <div class="bookmark-actions">
                            <button class="action-btn favorite-btn" data-id="${bookmark.id}" title="${bookmark.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}">
                                <i class="fas fa-heart ${bookmark.isFavorite ? 'text-red' : ''}"></i>
                            </button>
                            <button class="action-btn edit-btn" data-id="${bookmark.id}" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" data-id="${bookmark.id}" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindCardEvents() {
        // Favorite buttons
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(parseInt(btn.dataset.id));
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteBookmark(parseInt(btn.dataset.id));
            });
        });
        
        // Edit buttons (placeholder for now)
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editBookmark(parseInt(btn.dataset.id));
            });
        });
    }

    updateStats() {
        const totalBookmarks = this.bookmarks.length;
        const totalTags = [...new Set(this.bookmarks.flatMap(b => b.tags))].length;
        const totalCategories = [...new Set(this.bookmarks.map(b => b.category).filter(c => c))].length;
        
        document.getElementById('total-bookmarks').textContent = totalBookmarks;
        document.getElementById('total-tags').textContent = totalTags;
        document.getElementById('total-categories').textContent = totalCategories;
    }

    loadBookmarks() {
        try {
            const saved = localStorage.getItem('bookmarks');
            this.bookmarks = saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.bookmarks = [];
        }
    }

    saveBookmarks() {
        try {
            localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Error saving bookmarks:', error);
            alert('حدث خطأ أثناء حفظ البيانات');
        }
    }

    handleLogin() {
        alert('وظيفة تسجيل الدخول ستتوفر في المرحلة القادمة!');
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('show');
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 4000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bookmarkManager = new BookmarkManager();
});

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .text-red {
        color: #dc3545 !important;
    }
`;
document.head.appendChild(style);


// Add helper methods to BookmarkManager prototype
BookmarkManager.prototype.showNotification = function(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add notification styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const notificationStyles = document.createElement('style');
        notificationStyles.id = 'notification-styles';
        notificationStyles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease;
                border-left: 4px solid #667eea;
            }
            
            .notification-success {
                border-left-color: #28a745;
            }
            
            .notification-error {
                border-left-color: #dc3545;
            }
            
            .notification-warning {
                border-left-color: #ffc107;
            }
            
            .notification-info {
                border-left-color: #17a2b8;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem;
            }
            
            .notification-content i:first-child {
                color: #667eea;
                font-size: 1.2rem;
            }
            
            .notification-success .notification-content i:first-child {
                color: #28a745;
            }
            
            .notification-error .notification-content i:first-child {
                color: #dc3545;
            }
            
            .notification-warning .notification-content i:first-child {
                color: #ffc107;
            }
            
            .notification-info .notification-content i:first-child {
                color: #17a2b8;
            }
            
            .notification-content span {
                flex: 1;
                color: #333;
                font-weight: 500;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .notification-close:hover {
                background: #f8f9fa;
                color: #333;
            }
        `;
        document.head.appendChild(notificationStyles);
    }

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
};

BookmarkManager.prototype.getNotificationIcon = function(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
};

BookmarkManager.prototype.showLoading = function() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
    }
};

BookmarkManager.prototype.hideLoading = function() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
};

