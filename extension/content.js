// Content Script for Bookmark Manager Extension

class BookmarkContentScript {
    constructor() {
        this.isInitialized = false;
        this.floatingButton = null;
        this.quickSaveModal = null;
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
        
        this.isInitialized = true;
    }

    setup() {
        this.createFloatingButton();
        this.bindEvents();
        this.injectStyles();
    }

    createFloatingButton() {
        // Create floating save button
        this.floatingButton = document.createElement('div');
        this.floatingButton.id = 'bookmark-manager-float-btn';
        this.floatingButton.innerHTML = `
            <div class="bm-float-btn" title="حفظ في مدير الروابط">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(this.floatingButton);
        
        // Initially hide the button
        this.floatingButton.style.display = 'none';
    }

    createQuickSaveModal() {
        this.quickSaveModal = document.createElement('div');
        this.quickSaveModal.id = 'bookmark-manager-modal';
        this.quickSaveModal.innerHTML = `
            <div class="bm-modal-overlay">
                <div class="bm-modal-content">
                    <div class="bm-modal-header">
                        <h3>حفظ الرابط</h3>
                        <button class="bm-close-btn">&times;</button>
                    </div>
                    <div class="bm-modal-body">
                        <div class="bm-form-group">
                            <label>العنوان</label>
                            <input type="text" id="bm-quick-title" value="${document.title}">
                        </div>
                        <div class="bm-form-group">
                            <label>الوسوم</label>
                            <input type="text" id="bm-quick-tags" placeholder="وسم1, وسم2, وسم3">
                        </div>
                        <div class="bm-form-group">
                            <label>التصنيف</label>
                            <select id="bm-quick-category">
                                <option value="">اختر تصنيف</option>
                                <option value="work">عمل</option>
                                <option value="personal">شخصي</option>
                                <option value="education">تعليم</option>
                                <option value="entertainment">ترفيه</option>
                                <option value="news">أخبار</option>
                                <option value="technology">تقنية</option>
                                <option value="other">أخرى</option>
                            </select>
                        </div>
                    </div>
                    <div class="bm-modal-footer">
                        <button class="bm-btn bm-btn-secondary" id="bm-cancel">إلغاء</button>
                        <button class="bm-btn bm-btn-primary" id="bm-save">حفظ</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.quickSaveModal);
    }

    bindEvents() {
        // Show floating button on hover over links
        document.addEventListener('mouseover', (e) => {
            if (e.target.tagName === 'A' && e.target.href) {
                this.showFloatingButton(e.target);
            }
        });

        // Hide floating button when not hovering
        document.addEventListener('mouseout', (e) => {
            if (e.target.tagName === 'A') {
                setTimeout(() => {
                    if (!this.floatingButton.matches(':hover')) {
                        this.hideFloatingButton();
                    }
                }, 100);
            }
        });

        // Handle floating button click
        this.floatingButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleQuickSave();
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+S or Cmd+Shift+S to save current page
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                this.saveCurrentPage();
            }
            
            // Ctrl+Shift+B or Cmd+Shift+B to open bookmark manager
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                this.openBookmarkManager();
            }
        });

        // Handle double-click on selected text
        document.addEventListener('dblclick', (e) => {
            const selection = window.getSelection();
            if (selection.toString().trim()) {
                // Check if selected text contains URL
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const selectedText = selection.toString();
                const urls = selectedText.match(urlRegex);
                
                if (urls && urls.length > 0) {
                    this.showQuickSaveForUrl(urls[0], selectedText);
                }
            }
        });
    }

    showFloatingButton(linkElement) {
        const rect = linkElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        this.floatingButton.style.display = 'block';
        this.floatingButton.style.top = (rect.top + scrollTop - 10) + 'px';
        this.floatingButton.style.left = (rect.right + scrollLeft + 5) + 'px';
        
        // Store the link for later use
        this.currentLink = linkElement;
    }

    hideFloatingButton() {
        this.floatingButton.style.display = 'none';
        this.currentLink = null;
    }

    handleQuickSave() {
        if (this.currentLink) {
            this.showQuickSaveForUrl(this.currentLink.href, this.currentLink.textContent.trim());
        }
        this.hideFloatingButton();
    }

    showQuickSaveForUrl(url, title) {
        if (!this.quickSaveModal) {
            this.createQuickSaveModal();
        }
        
        // Fill form with data
        document.getElementById('bm-quick-title').value = title || document.title;
        document.getElementById('bm-quick-tags').value = this.generateTags(url, title).join(', ');
        
        // Show modal
        this.quickSaveModal.style.display = 'block';
        
        // Bind modal events
        this.bindModalEvents(url);
        
        // Focus on title input
        setTimeout(() => {
            document.getElementById('bm-quick-title').focus();
        }, 100);
    }

    bindModalEvents(url) {
        const modal = this.quickSaveModal;
        const closeBtn = modal.querySelector('.bm-close-btn');
        const cancelBtn = modal.querySelector('#bm-cancel');
        const saveBtn = modal.querySelector('#bm-save');
        const overlay = modal.querySelector('.bm-modal-overlay');
        
        // Close modal events
        const closeModal = () => {
            modal.style.display = 'none';
        };
        
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        
        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        };
        
        // Save button
        saveBtn.onclick = () => {
            this.saveBookmarkFromModal(url);
            closeModal();
        };
        
        // Handle Enter key
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveBookmarkFromModal(url);
                closeModal();
            } else if (e.key === 'Escape') {
                closeModal();
            }
        });
    }

    async saveBookmarkFromModal(url) {
        const title = document.getElementById('bm-quick-title').value.trim();
        const tags = document.getElementById('bm-quick-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        const category = document.getElementById('bm-quick-category').value;
        
        if (!title) {
            this.showNotification('يرجى إدخال عنوان للرابط', 'warning');
            return;
        }
        
        const bookmark = {
            id: Date.now(),
            url: url,
            title: title,
            description: `محفوظ من ${window.location.hostname}`,
            image: this.extractFavicon(),
            tags: tags,
            category: category,
            createdAt: new Date().toISOString(),
            isFavorite: false,
            source: 'content_script'
        };
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'saveBookmark',
                bookmark: bookmark
            });
            
            if (response.success) {
                this.showNotification('تم حفظ الرابط بنجاح!', 'success');
            } else {
                this.showNotification('خطأ في حفظ الرابط: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error saving bookmark:', error);
            this.showNotification('خطأ في حفظ الرابط', 'error');
        }
    }

    async saveCurrentPage() {
        const bookmark = {
            id: Date.now(),
            url: window.location.href,
            title: document.title,
            description: `محفوظ من ${window.location.hostname}`,
            image: this.extractFavicon(),
            tags: this.generateTags(window.location.href, document.title),
            category: 'other',
            createdAt: new Date().toISOString(),
            isFavorite: false,
            source: 'content_script'
        };
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'saveBookmark',
                bookmark: bookmark
            });
            
            if (response.success) {
                this.showNotification('تم حفظ الصفحة بنجاح!', 'success');
            } else {
                this.showNotification('خطأ في حفظ الصفحة: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error saving page:', error);
            this.showNotification('خطأ في حفظ الصفحة', 'error');
        }
    }

    async openBookmarkManager() {
        try {
            await chrome.runtime.sendMessage({ action: 'openManager' });
        } catch (error) {
            console.error('Error opening manager:', error);
        }
    }

    extractFavicon() {
        const favicon = document.querySelector('link[rel="icon"]') ||
                      document.querySelector('link[rel="shortcut icon"]') ||
                      document.querySelector('link[rel="apple-touch-icon"]');
        
        if (favicon) {
            return favicon.href;
        }
        
        return `${window.location.protocol}//${window.location.hostname}/favicon.ico`;
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

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `bm-notification bm-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('bm-notification-show');
        }, 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('bm-notification-show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    injectStyles() {
        const styles = `
            #bookmark-manager-float-btn {
                position: absolute;
                z-index: 10000;
                pointer-events: auto;
            }
            
            .bm-float-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
                opacity: 0.8;
            }
            
            .bm-float-btn:hover {
                opacity: 1;
                transform: scale(1.1);
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            
            #bookmark-manager-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10001;
                display: none;
            }
            
            .bm-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .bm-modal-content {
                background: white;
                border-radius: 10px;
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                direction: rtl;
            }
            
            .bm-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                border-bottom: 1px solid #e9ecef;
            }
            
            .bm-modal-header h3 {
                margin: 0;
                color: #333;
                font-size: 1.2rem;
            }
            
            .bm-close-btn {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #6c757d;
                padding: 0.25rem;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .bm-close-btn:hover {
                background: #f8f9fa;
                color: #333;
            }
            
            .bm-modal-body {
                padding: 1rem;
            }
            
            .bm-form-group {
                margin-bottom: 1rem;
            }
            
            .bm-form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                color: #333;
                font-size: 0.9rem;
            }
            
            .bm-form-group input,
            .bm-form-group select {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                font-size: 0.9rem;
                transition: all 0.3s ease;
                box-sizing: border-box;
            }
            
            .bm-form-group input:focus,
            .bm-form-group select:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
            }
            
            .bm-modal-footer {
                display: flex;
                gap: 0.5rem;
                justify-content: flex-end;
                padding: 1rem;
                border-top: 1px solid #e9ecef;
            }
            
            .bm-btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .bm-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .bm-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
            }
            
            .bm-btn-secondary {
                background: #f8f9fa;
                color: #495057;
                border: 1px solid #dee2e6;
            }
            
            .bm-btn-secondary:hover {
                background: #e9ecef;
            }
            
            .bm-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 10002;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                direction: rtl;
            }
            
            .bm-notification-show {
                transform: translateX(0);
            }
            
            .bm-notification-success {
                background: #28a745;
            }
            
            .bm-notification-error {
                background: #dc3545;
            }
            
            .bm-notification-warning {
                background: #ffc107;
                color: #333;
            }
            
            .bm-notification-info {
                background: #17a2b8;
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

// Initialize content script
if (typeof window !== 'undefined' && !window.bookmarkContentScript) {
    window.bookmarkContentScript = new BookmarkContentScript();
}

