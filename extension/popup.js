// Popup Script for Bookmark Manager Extension
class PopupManager {
    constructor() {
        this.currentTab = null;
        this.bookmarks = [];
        this.isFormVisible = false;
        
        this.init();
    }

    async init() {
        await this.loadCurrentTab();
        await this.loadBookmarks();
        this.bindEvents();
        this.renderCurrentPage();
        this.renderRecentBookmarks();
    }

    async loadCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
        } catch (error) {
            console.error('Error loading current tab:', error);
        }
    }

    async loadBookmarks() {
        try {
            const result = await chrome.storage.local.get(['bookmarks']);
            this.bookmarks = result.bookmarks || [];
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.bookmarks = [];
        }
    }

    async saveBookmarks() {
        try {
            await chrome.storage.local.set({ bookmarks: this.bookmarks });
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    }

    bindEvents() {
        // Save current page button
        document.getElementById('save-current').addEventListener('click', () => {
            this.toggleQuickForm();
        });

        // Cancel save
        document.getElementById('cancel-save').addEventListener('click', () => {
            this.hideQuickForm();
        });

        // Confirm save
        document.getElementById('confirm-save').addEventListener('click', () => {
            this.saveCurrentPage();
        });

        // Open manager
        document.getElementById('open-manager').addEventListener('click', () => {
            this.openFullManager();
        });

        // Refresh recent
        document.getElementById('refresh-recent').addEventListener('click', () => {
            this.renderRecentBookmarks();
        });

        // Quick search
        document.getElementById('quick-search').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Import/Export/Sync buttons
        document.getElementById('import-bookmarks').addEventListener('click', () => {
            this.importBookmarks();
        });

        document.getElementById('export-bookmarks').addEventListener('click', () => {
            this.exportBookmarks();
        });

        document.getElementById('sync-bookmarks').addEventListener('click', () => {
            this.syncBookmarks();
        });
    }

    renderCurrentPage() {
        if (!this.currentTab) return;

        const favicon = document.getElementById('page-favicon');
        const title = document.getElementById('page-title');
        const url = document.getElementById('page-url');

        // Set favicon
        favicon.src = this.currentTab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23666" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        
        // Set title and URL
        title.textContent = this.currentTab.title || 'بدون عنوان';
        url.textContent = this.formatUrl(this.currentTab.url);

        // Pre-fill form if visible
        if (this.isFormVisible) {
            document.getElementById('quick-title').value = this.currentTab.title || '';
        }
    }

    formatUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        } catch {
            return url;
        }
    }

    toggleQuickForm() {
        const form = document.getElementById('quick-form');
        const button = document.getElementById('save-current');
        
        if (this.isFormVisible) {
            this.hideQuickForm();
        } else {
            this.showQuickForm();
        }
    }

    showQuickForm() {
        const form = document.getElementById('quick-form');
        const button = document.getElementById('save-current');
        
        form.style.display = 'block';
        button.innerHTML = '<i class="fas fa-times"></i> إلغاء';
        this.isFormVisible = true;

        // Pre-fill form
        if (this.currentTab) {
            document.getElementById('quick-title').value = this.currentTab.title || '';
            
            // Generate tags based on URL
            const tags = this.generateTags(this.currentTab.url, this.currentTab.title);
            document.getElementById('quick-tags').value = tags.join(', ');
        }

        // Focus on title input
        setTimeout(() => {
            document.getElementById('quick-title').focus();
        }, 100);
    }

    hideQuickForm() {
        const form = document.getElementById('quick-form');
        const button = document.getElementById('save-current');
        
        form.style.display = 'none';
        button.innerHTML = '<i class="fas fa-plus"></i> حفظ هذه الصفحة';
        this.isFormVisible = false;

        // Reset form
        document.getElementById('quick-title').value = '';
        document.getElementById('quick-tags').value = '';
        document.getElementById('quick-category').value = '';
    }

    async saveCurrentPage() {
        if (!this.currentTab) {
            this.showStatus('خطأ: لا يمكن الحصول على معلومات الصفحة', 'error');
            return;
        }

        const title = document.getElementById('quick-title').value.trim();
        const tags = document.getElementById('quick-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        const category = document.getElementById('quick-category').value;

        if (!title) {
            this.showStatus('يرجى إدخال عنوان للرابط', 'warning');
            return;
        }

        // Check if bookmark already exists
        const existingBookmark = this.bookmarks.find(b => b.url === this.currentTab.url);
        if (existingBookmark) {
            this.showStatus('هذا الرابط محفوظ مسبقاً', 'warning');
            return;
        }

        const bookmark = {
            id: Date.now(),
            url: this.currentTab.url,
            title: title,
            description: `محفوظ من ${this.formatUrl(this.currentTab.url)}`,
            image: this.currentTab.favIconUrl || '',
            tags: tags,
            category: category,
            createdAt: new Date().toISOString(),
            isFavorite: false,
            source: 'extension'
        };

        this.bookmarks.unshift(bookmark);
        await this.saveBookmarks();
        
        this.hideQuickForm();
        this.renderRecentBookmarks();
        this.showStatus('تم حفظ الرابط بنجاح!', 'success');

        // Sync with web app if available
        this.syncWithWebApp(bookmark);
    }

    generateTags(url, title) {
        const tags = new Set();
        
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            
            // Add domain
            tags.add(domain);
            
            // Add category based on domain
            if (domain.includes('github') || domain.includes('gitlab')) {
                tags.add('تطوير');
                tags.add('برمجة');
            } else if (domain.includes('youtube') || domain.includes('vimeo')) {
                tags.add('فيديو');
            } else if (domain.includes('news') || domain.includes('أخبار')) {
                tags.add('أخبار');
            } else if (domain.includes('edu') || domain.includes('تعليم')) {
                tags.add('تعليم');
            }
            
            // Add generic tag
            tags.add('موقع');
            
        } catch (error) {
            tags.add('رابط');
        }
        
        return Array.from(tags).slice(0, 4);
    }

    renderRecentBookmarks() {
        const container = document.getElementById('recent-bookmarks');
        const recentBookmarks = this.bookmarks.slice(0, 5);
        
        if (recentBookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bookmark"></i>
                    <p>لا توجد روابط محفوظة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentBookmarks.map(bookmark => `
            <div class="recent-item" data-id="${bookmark.id}">
                <img src="${bookmark.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23666" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'}" 
                     alt="أيقونة" class="favicon" onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\"><path fill=\\"%23666\\" d=\\"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z\\"/></svg>'">
                <div class="item-info">
                    <div class="item-title">${bookmark.title}</div>
                    <div class="item-url">${this.formatUrl(bookmark.url)}</div>
                </div>
                <div class="item-actions">
                    <button class="item-action" onclick="popupManager.openBookmark('${bookmark.url}')" title="فتح">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="item-action" onclick="popupManager.toggleFavorite(${bookmark.id})" title="${bookmark.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}">
                        <i class="fas fa-heart ${bookmark.isFavorite ? 'text-red' : ''}"></i>
                    </button>
                    <button class="item-action" onclick="popupManager.deleteBookmark(${bookmark.id})" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async openBookmark(url) {
        try {
            await chrome.tabs.create({ url: url });
            window.close();
        } catch (error) {
            console.error('Error opening bookmark:', error);
        }
    }

    async toggleFavorite(id) {
        const bookmark = this.bookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.isFavorite = !bookmark.isFavorite;
            await this.saveBookmarks();
            this.renderRecentBookmarks();
            
            const message = bookmark.isFavorite ? 'تم إضافة للمفضلة' : 'تم إزالة من المفضلة';
            this.showStatus(message, 'success');
        }
    }

    async deleteBookmark(id) {
        if (confirm('هل أنت متأكد من حذف هذا الرابط؟')) {
            this.bookmarks = this.bookmarks.filter(b => b.id !== id);
            await this.saveBookmarks();
            this.renderRecentBookmarks();
            this.showStatus('تم حذف الرابط', 'success');
        }
    }

    handleSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        
        if (!query.trim()) {
            resultsContainer.style.display = 'none';
            return;
        }

        const filteredBookmarks = this.bookmarks.filter(bookmark =>
            bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
            bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
            bookmark.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 5);

        if (filteredBookmarks.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item">لا توجد نتائج</div>';
        } else {
            resultsContainer.innerHTML = filteredBookmarks.map(bookmark => `
                <div class="search-result-item" onclick="popupManager.openBookmark('${bookmark.url}')">
                    <div class="item-title">${bookmark.title}</div>
                    <div class="item-url">${this.formatUrl(bookmark.url)}</div>
                </div>
            `).join('');
        }

        resultsContainer.style.display = 'block';
    }

    async openFullManager() {
        try {
            // Try to open the web app (assuming it's running on localhost:8000)
            await chrome.tabs.create({ url: 'http://localhost:8000' });
            window.close();
        } catch (error) {
            // Fallback: create a local manager page
            await chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
            window.close();
        }
    }

    async importBookmarks() {
        try {
            // Get browser bookmarks
            const bookmarkTree = await chrome.bookmarks.getTree();
            const browserBookmarks = this.extractBookmarksFromTree(bookmarkTree);
            
            // Merge with existing bookmarks
            const existingUrls = new Set(this.bookmarks.map(b => b.url));
            const newBookmarks = browserBookmarks.filter(b => !existingUrls.has(b.url));
            
            this.bookmarks = [...newBookmarks, ...this.bookmarks];
            await this.saveBookmarks();
            
            this.renderRecentBookmarks();
            this.showStatus(`تم استيراد ${newBookmarks.length} رابط جديد`, 'success');
        } catch (error) {
            console.error('Error importing bookmarks:', error);
            this.showStatus('خطأ في استيراد الروابط', 'error');
        }
    }

    extractBookmarksFromTree(nodes) {
        const bookmarks = [];
        
        const traverse = (node) => {
            if (node.url) {
                bookmarks.push({
                    id: Date.now() + Math.random(),
                    url: node.url,
                    title: node.title,
                    description: `مستورد من المتصفح`,
                    image: '',
                    tags: ['مستورد', 'متصفح'],
                    category: 'other',
                    createdAt: new Date(node.dateAdded || Date.now()).toISOString(),
                    isFavorite: false,
                    source: 'browser'
                });
            }
            
            if (node.children) {
                node.children.forEach(traverse);
            }
        };
        
        nodes.forEach(traverse);
        return bookmarks;
    }

    async exportBookmarks() {
        try {
            const dataStr = JSON.stringify(this.bookmarks, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            await chrome.downloads.download({
                url: url,
                filename: `bookmarks-${new Date().toISOString().split('T')[0]}.json`
            });
            
            this.showStatus('تم تصدير الروابط بنجاح', 'success');
        } catch (error) {
            console.error('Error exporting bookmarks:', error);
            this.showStatus('خطأ في تصدير الروابط', 'error');
        }
    }

    async syncBookmarks() {
        this.showStatus('جاري المزامنة...', 'info');
        
        try {
            // Try to sync with web app
            await this.syncWithWebApp();
            this.showStatus('تم المزامنة بنجاح', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showStatus('خطأ في المزامنة', 'error');
        }
    }

    async syncWithWebApp(bookmark = null) {
        // This would sync with the web app if it's available
        // For now, we'll just store in chrome.storage.sync for cross-device sync
        try {
            if (bookmark) {
                await chrome.storage.sync.set({ [`bookmark_${bookmark.id}`]: bookmark });
            } else {
                // Sync all bookmarks
                const syncData = {};
                this.bookmarks.forEach(b => {
                    syncData[`bookmark_${b.id}`] = b;
                });
                await chrome.storage.sync.set(syncData);
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status-message');
        const statusText = document.getElementById('status-text');
        
        statusText.textContent = message;
        statusElement.className = `status-message show ${type}`;
        
        setTimeout(() => {
            statusElement.classList.remove('show');
        }, 3000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.popupManager = new PopupManager();
});

// Add CSS for text-red class
const style = document.createElement('style');
style.textContent = `
    .text-red {
        color: #dc3545 !important;
    }
`;
document.head.appendChild(style);

