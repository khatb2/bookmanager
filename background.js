// Background Script for Bookmark Manager Extension

// Installation and update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Bookmark Manager Extension installed');
        
        // Set default settings
        chrome.storage.local.set({
            bookmarks: [],
            settings: {
                autoSync: true,
                showNotifications: true,
                defaultCategory: 'other'
            }
        });
        
        // Open welcome page
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    } else if (details.reason === 'update') {
        console.log('Bookmark Manager Extension updated');
    }
});

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
    // Create context menu for pages
    chrome.contextMenus.create({
        id: 'save-page',
        title: 'حفظ هذه الصفحة في مدير الروابط',
        contexts: ['page']
    });
    
    // Create context menu for links
    chrome.contextMenus.create({
        id: 'save-link',
        title: 'حفظ هذا الرابط في مدير الروابط',
        contexts: ['link']
    });
    
    // Create context menu for selected text
    chrome.contextMenus.create({
        id: 'save-selection',
        title: 'حفظ النص المحدد كرابط',
        contexts: ['selection']
    });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
        switch (info.menuItemId) {
            case 'save-page':
                await saveCurrentPage(tab);
                break;
            case 'save-link':
                await saveLinkUrl(info.linkUrl, tab);
                break;
            case 'save-selection':
                await saveSelectedText(info.selectionText, tab);
                break;
        }
    } catch (error) {
        console.error('Context menu error:', error);
    }
});

// Save current page function
async function saveCurrentPage(tab) {
    try {
        const bookmark = {
            id: Date.now(),
            url: tab.url,
            title: tab.title,
            description: `محفوظ من ${new URL(tab.url).hostname}`,
            image: tab.favIconUrl || '',
            tags: generateTags(tab.url, tab.title),
            category: 'other',
            createdAt: new Date().toISOString(),
            isFavorite: false,
            source: 'context_menu'
        };
        
        await addBookmark(bookmark);
        showNotification('تم حفظ الصفحة', `تم حفظ "${tab.title}" بنجاح`);
    } catch (error) {
        console.error('Error saving page:', error);
        showNotification('خطأ', 'فشل في حفظ الصفحة', 'error');
    }
}

// Save link URL function
async function saveLinkUrl(linkUrl, tab) {
    try {
        // Try to get link title by injecting script
        let linkTitle = linkUrl;
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (url) => {
                    const link = document.querySelector(`a[href="${url}"]`);
                    return link ? link.textContent.trim() : null;
                },
                args: [linkUrl]
            });
            
            if (results[0]?.result) {
                linkTitle = results[0].result;
            }
        } catch (scriptError) {
            console.warn('Could not extract link title:', scriptError);
        }
        
        const bookmark = {
            id: Date.now(),
            url: linkUrl,
            title: linkTitle,
            description: `رابط محفوظ من ${new URL(tab.url).hostname}`,
            image: '',
            tags: generateTags(linkUrl, linkTitle),
            category: 'other',
            createdAt: new Date().toISOString(),
            isFavorite: false,
            source: 'context_menu'
        };
        
        await addBookmark(bookmark);
        showNotification('تم حفظ الرابط', `تم حفظ الرابط بنجاح`);
    } catch (error) {
        console.error('Error saving link:', error);
        showNotification('خطأ', 'فشل في حفظ الرابط', 'error');
    }
}

// Save selected text function
async function saveSelectedText(selectedText, tab) {
    try {
        // Try to find URL in selected text
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = selectedText.match(urlRegex);
        
        if (urls && urls.length > 0) {
            const url = urls[0];
            const bookmark = {
                id: Date.now(),
                url: url,
                title: selectedText.substring(0, 100) + (selectedText.length > 100 ? '...' : ''),
                description: `نص محدد من ${new URL(tab.url).hostname}`,
                image: '',
                tags: ['نص محدد', 'رابط'],
                category: 'other',
                createdAt: new Date().toISOString(),
                isFavorite: false,
                source: 'context_menu'
            };
            
            await addBookmark(bookmark);
            showNotification('تم حفظ الرابط', 'تم حفظ الرابط من النص المحدد');
        } else {
            showNotification('تنبيه', 'لم يتم العثور على رابط في النص المحدد', 'warning');
        }
    } catch (error) {
        console.error('Error saving selection:', error);
        showNotification('خطأ', 'فشل في حفظ النص المحدد', 'error');
    }
}

// Add bookmark to storage
async function addBookmark(bookmark) {
    try {
        const result = await chrome.storage.local.get(['bookmarks']);
        const bookmarks = result.bookmarks || [];
        
        // Check if bookmark already exists
        const existingBookmark = bookmarks.find(b => b.url === bookmark.url);
        if (existingBookmark) {
            throw new Error('Bookmark already exists');
        }
        
        bookmarks.unshift(bookmark);
        await chrome.storage.local.set({ bookmarks });
        
        // Sync with cloud storage if enabled
        const settings = await chrome.storage.local.get(['settings']);
        if (settings.settings?.autoSync) {
            await chrome.storage.sync.set({ [`bookmark_${bookmark.id}`]: bookmark });
        }
        
        return bookmark;
    } catch (error) {
        throw error;
    }
}

// Generate tags based on URL and title
function generateTags(url, title) {
    const tags = new Set();
    
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        
        // Add domain
        tags.add(domain);
        
        // Add category based on domain
        if (domain.includes('github') || domain.includes('gitlab') || domain.includes('bitbucket')) {
            tags.add('تطوير');
            tags.add('برمجة');
        } else if (domain.includes('youtube') || domain.includes('vimeo')) {
            tags.add('فيديو');
            tags.add('ترفيه');
        } else if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) {
            tags.add('أخبار');
        } else if (domain.includes('edu') || domain.includes('coursera') || domain.includes('udemy')) {
            tags.add('تعليم');
        } else if (domain.includes('shop') || domain.includes('store') || domain.includes('amazon')) {
            tags.add('تسوق');
        }
        
        // Add generic tag
        tags.add('موقع');
        
    } catch (error) {
        tags.add('رابط');
    }
    
    return Array.from(tags).slice(0, 4);
}

// Show notification
function showNotification(title, message, type = 'basic') {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
    });
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        switch (command) {
            case 'save-current-page':
                await saveCurrentPage(tab);
                break;
            case 'open-popup':
                // This will be handled by the browser automatically
                break;
        }
    } catch (error) {
        console.error('Command error:', error);
    }
});

// Handle tab updates for auto-save functionality
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process when page is completely loaded
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            // Check if auto-save is enabled for certain domains
            const settings = await chrome.storage.local.get(['settings']);
            const autoSaveDomains = settings.settings?.autoSaveDomains || [];
            
            const url = new URL(tab.url);
            if (autoSaveDomains.includes(url.hostname)) {
                await saveCurrentPage(tab);
            }
        } catch (error) {
            // Ignore errors for auto-save
            console.warn('Auto-save error:', error);
        }
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'saveBookmark':
            addBookmark(request.bookmark)
                .then(bookmark => sendResponse({ success: true, bookmark }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep message channel open for async response
            
        case 'getBookmarks':
            chrome.storage.local.get(['bookmarks'])
                .then(result => sendResponse({ bookmarks: result.bookmarks || [] }))
                .catch(error => sendResponse({ error: error.message }));
            return true;
            
        case 'deleteBookmark':
            deleteBookmark(request.id)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Delete bookmark function
async function deleteBookmark(id) {
    try {
        const result = await chrome.storage.local.get(['bookmarks']);
        const bookmarks = result.bookmarks || [];
        
        const filteredBookmarks = bookmarks.filter(b => b.id !== id);
        await chrome.storage.local.set({ bookmarks: filteredBookmarks });
        
        // Also remove from sync storage
        await chrome.storage.sync.remove([`bookmark_${id}`]);
        
        return true;
    } catch (error) {
        throw error;
    }
}

// Periodic sync with web app (if available)
setInterval(async () => {
    try {
        const settings = await chrome.storage.local.get(['settings']);
        if (settings.settings?.autoSync) {
            // Try to sync with web app
            // This would be implemented based on the web app's API
        }
    } catch (error) {
        console.warn('Periodic sync error:', error);
    }
}, 5 * 60 * 1000); // Every 5 minutes

