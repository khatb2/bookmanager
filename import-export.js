// Import/Export functionality for Bookmark Manager
class ImportExportManager {
    constructor(bookmarkManager) {
        this.bookmarkManager = bookmarkManager;
        this.supportedFormats = {
            json: 'application/json',
            csv: 'text/csv',
            html: 'text/html'
        };
    }

    // Export functions
    async exportToJSON() {
        try {
            const data = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                totalBookmarks: this.bookmarkManager.bookmarks.length,
                bookmarks: this.bookmarkManager.bookmarks.map(bookmark => ({
                    ...bookmark,
                    exportedAt: new Date().toISOString()
                }))
            };

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: this.supportedFormats.json });
            
            this.downloadFile(blob, `bookmarks-${this.getDateString()}.json`);
            this.bookmarkManager.showNotification('تم تصدير الروابط بتنسيق JSON بنجاح!', 'success');
            
            return true;
        } catch (error) {
            console.error('Error exporting to JSON:', error);
            this.bookmarkManager.showNotification('خطأ في تصدير الروابط', 'error');
            return false;
        }
    }

    async exportToCSV() {
        try {
            const headers = ['العنوان', 'الرابط', 'الوصف', 'الوسوم', 'التصنيف', 'مفضل', 'تاريخ الإنشاء'];
            const csvContent = [
                headers.join(','),
                ...this.bookmarkManager.bookmarks.map(bookmark => [
                    this.escapeCsvField(bookmark.title),
                    this.escapeCsvField(bookmark.url),
                    this.escapeCsvField(bookmark.description || ''),
                    this.escapeCsvField(bookmark.tags.join('; ')),
                    this.escapeCsvField(bookmark.category || ''),
                    bookmark.isFavorite ? 'نعم' : 'لا',
                    this.escapeCsvField(new Date(bookmark.createdAt).toLocaleDateString('ar-SA'))
                ].join(','))
            ].join('\n');

            // Add BOM for proper Arabic display in Excel
            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: this.supportedFormats.csv });
            
            this.downloadFile(blob, `bookmarks-${this.getDateString()}.csv`);
            this.bookmarkManager.showNotification('تم تصدير الروابط بتنسيق CSV بنجاح!', 'success');
            
            return true;
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            this.bookmarkManager.showNotification('خطأ في تصدير الروابط', 'error');
            return false;
        }
    }

    async exportToHTML() {
        try {
            const htmlContent = this.generateHTMLBookmarks();
            const blob = new Blob([htmlContent], { type: this.supportedFormats.html });
            
            this.downloadFile(blob, `bookmarks-${this.getDateString()}.html`);
            this.bookmarkManager.showNotification('تم تصدير الروابط بتنسيق HTML بنجاح!', 'success');
            
            return true;
        } catch (error) {
            console.error('Error exporting to HTML:', error);
            this.bookmarkManager.showNotification('خطأ في تصدير الروابط', 'error');
            return false;
        }
    }

    // Import functions
    async importFromJSON(file) {
        try {
            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);
            
            // Validate JSON structure
            if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
                throw new Error('تنسيق ملف JSON غير صحيح');
            }

            const importedBookmarks = data.bookmarks.map(bookmark => ({
                id: Date.now() + Math.random(),
                url: bookmark.url || '',
                title: bookmark.title || 'بدون عنوان',
                description: bookmark.description || '',
                image: bookmark.image || '',
                tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
                category: bookmark.category || 'other',
                createdAt: bookmark.createdAt || new Date().toISOString(),
                isFavorite: Boolean(bookmark.isFavorite),
                source: 'imported_json'
            }));

            const result = await this.mergeBookmarks(importedBookmarks);
            this.bookmarkManager.showNotification(
                `تم استيراد ${result.imported} رابط جديد من أصل ${importedBookmarks.length}`, 
                'success'
            );
            
            return result;
        } catch (error) {
            console.error('Error importing JSON:', error);
            this.bookmarkManager.showNotification('خطأ في استيراد ملف JSON: ' + error.message, 'error');
            return { imported: 0, duplicates: 0 };
        }
    }

    async importFromCSV(file) {
        try {
            const text = await this.readFileAsText(file);
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                throw new Error('ملف CSV فارغ أو لا يحتوي على بيانات');
            }

            // Skip header row
            const dataLines = lines.slice(1);
            const importedBookmarks = [];

            for (const line of dataLines) {
                const fields = this.parseCSVLine(line);
                if (fields.length >= 2 && fields[1]) { // At least title and URL
                    importedBookmarks.push({
                        id: Date.now() + Math.random(),
                        title: fields[0] || 'بدون عنوان',
                        url: fields[1],
                        description: fields[2] || '',
                        tags: fields[3] ? fields[3].split(';').map(tag => tag.trim()) : [],
                        category: fields[4] || 'other',
                        isFavorite: fields[5] === 'نعم' || fields[5] === 'true',
                        createdAt: new Date().toISOString(),
                        image: '',
                        source: 'imported_csv'
                    });
                }
            }

            const result = await this.mergeBookmarks(importedBookmarks);
            this.bookmarkManager.showNotification(
                `تم استيراد ${result.imported} رابط جديد من أصل ${importedBookmarks.length}`, 
                'success'
            );
            
            return result;
        } catch (error) {
            console.error('Error importing CSV:', error);
            this.bookmarkManager.showNotification('خطأ في استيراد ملف CSV: ' + error.message, 'error');
            return { imported: 0, duplicates: 0 };
        }
    }

    async importFromHTML(file) {
        try {
            const text = await this.readFileAsText(file);
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            const links = doc.querySelectorAll('a[href]');
            const importedBookmarks = [];

            links.forEach(link => {
                const url = link.getAttribute('href');
                const title = link.textContent.trim() || link.getAttribute('title') || 'بدون عنوان';
                
                if (url && this.isValidUrl(url)) {
                    importedBookmarks.push({
                        id: Date.now() + Math.random(),
                        url: url,
                        title: title,
                        description: `مستورد من ملف HTML`,
                        tags: ['مستورد', 'HTML'],
                        category: 'other',
                        createdAt: new Date().toISOString(),
                        isFavorite: false,
                        image: '',
                        source: 'imported_html'
                    });
                }
            });

            const result = await this.mergeBookmarks(importedBookmarks);
            this.bookmarkManager.showNotification(
                `تم استيراد ${result.imported} رابط جديد من أصل ${importedBookmarks.length}`, 
                'success'
            );
            
            return result;
        } catch (error) {
            console.error('Error importing HTML:', error);
            this.bookmarkManager.showNotification('خطأ في استيراد ملف HTML: ' + error.message, 'error');
            return { imported: 0, duplicates: 0 };
        }
    }

    async importBrowserBookmarks() {
        try {
            // This function would work in the browser extension context
            // For the web version, we'll show instructions to the user
            this.showBrowserImportInstructions();
            return { imported: 0, duplicates: 0 };
        } catch (error) {
            console.error('Error importing browser bookmarks:', error);
            this.bookmarkManager.showNotification('خطأ في استيراد روابط المتصفح', 'error');
            return { imported: 0, duplicates: 0 };
        }
    }

    // Helper functions
    async mergeBookmarks(newBookmarks) {
        const existingUrls = new Set(this.bookmarkManager.bookmarks.map(b => b.url));
        const uniqueBookmarks = newBookmarks.filter(bookmark => !existingUrls.has(bookmark.url));
        
        // Add unique bookmarks to the beginning of the list
        this.bookmarkManager.bookmarks = [...uniqueBookmarks, ...this.bookmarkManager.bookmarks];
        this.bookmarkManager.saveBookmarks();
        this.bookmarkManager.renderBookmarks();
        this.bookmarkManager.updateStats();
        
        return {
            imported: uniqueBookmarks.length,
            duplicates: newBookmarks.length - uniqueBookmarks.length
        };
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('خطأ في قراءة الملف'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    escapeCsvField(field) {
        if (typeof field !== 'string') {
            field = String(field);
        }
        
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }

    parseCSVLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                fields.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        fields.push(current);
        return fields;
    }

    generateHTMLBookmarks() {
        const bookmarksByCategory = this.groupBookmarksByCategory();
        
        let html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>الروابط المحفوظة - مدير الروابط</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 2rem;
            background: #f8f9fa;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding: 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
        }
        .category {
            margin-bottom: 2rem;
            background: white;
            border-radius: 10px;
            padding: 1.5rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .category h2 {
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }
        .bookmark {
            margin-bottom: 1rem;
            padding: 1rem;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            background: #f8f9fa;
        }
        .bookmark-title {
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .bookmark-url {
            color: #667eea;
            text-decoration: none;
            margin-bottom: 0.5rem;
            display: block;
        }
        .bookmark-url:hover {
            text-decoration: underline;
        }
        .bookmark-description {
            color: #6c757d;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        .bookmark-tags {
            font-size: 0.8rem;
        }
        .tag {
            background: #667eea;
            color: white;
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            margin-left: 0.25rem;
        }
        .favorite {
            color: #dc3545;
            font-weight: bold;
        }
        .stats {
            text-align: center;
            margin-bottom: 1rem;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>الروابط المحفوظة</h1>
        <p>مُصدّر من مدير الروابط</p>
        <div class="stats">
            تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')} | 
            إجمالي الروابط: ${this.bookmarkManager.bookmarks.length}
        </div>
    </div>
`;

        Object.entries(bookmarksByCategory).forEach(([category, bookmarks]) => {
            const categoryName = this.getCategoryDisplayName(category);
            html += `
    <div class="category">
        <h2>${categoryName} (${bookmarks.length})</h2>
`;
            
            bookmarks.forEach(bookmark => {
                html += `
        <div class="bookmark">
            <div class="bookmark-title">
                ${bookmark.title}
                ${bookmark.isFavorite ? '<span class="favorite">★</span>' : ''}
            </div>
            <a href="${bookmark.url}" class="bookmark-url" target="_blank">${bookmark.url}</a>
            ${bookmark.description ? `<div class="bookmark-description">${bookmark.description}</div>` : ''}
            <div class="bookmark-tags">
                الوسوم: ${bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        </div>
`;
            });
            
            html += `    </div>
`;
        });

        html += `
    <div style="text-align: center; margin-top: 2rem; color: #6c757d; font-size: 0.9rem;">
        تم إنشاء هذا الملف بواسطة مدير الروابط - ${new Date().toLocaleDateString('ar-SA')}
    </div>
</body>
</html>`;

        return html;
    }

    groupBookmarksByCategory() {
        const groups = {};
        
        this.bookmarkManager.bookmarks.forEach(bookmark => {
            const category = bookmark.category || 'other';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(bookmark);
        });
        
        return groups;
    }

    getCategoryDisplayName(category) {
        const categoryNames = {
            work: 'عمل',
            personal: 'شخصي',
            education: 'تعليم',
            entertainment: 'ترفيه',
            news: 'أخبار',
            technology: 'تقنية',
            other: 'أخرى'
        };
        
        return categoryNames[category] || 'غير محدد';
    }

    showBrowserImportInstructions() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>استيراد روابط المتصفح</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>لاستيراد روابط المتصفح، يرجى اتباع الخطوات التالية:</p>
                        
                        <h3>لمتصفح Chrome:</h3>
                        <ol>
                            <li>اضغط على القائمة (⋮) في الزاوية العلوية اليمنى</li>
                            <li>اختر "الإشارات المرجعية" > "مدير الإشارات المرجعية"</li>
                            <li>اضغط على القائمة (⋮) في صفحة الإشارات المرجعية</li>
                            <li>اختر "تصدير الإشارات المرجعية"</li>
                            <li>احفظ الملف ثم استورده هنا باستخدام "استيراد من HTML"</li>
                        </ol>
                        
                        <h3>لمتصفح Edge:</h3>
                        <ol>
                            <li>اضغط على القائمة (⋯) في الزاوية العلوية اليمنى</li>
                            <li>اختر "المفضلة" > "إدارة المفضلة"</li>
                            <li>اضغط على "تصدير المفضلة"</li>
                            <li>احفظ الملف ثم استورده هنا باستخدام "استيراد من HTML"</li>
                        </ol>
                        
                        <h3>لمتصفح Firefox:</h3>
                        <ol>
                            <li>اضغط على القائمة (☰) في الزاوية العلوية اليمنى</li>
                            <li>اختر "الإشارات المرجعية" > "إدارة الإشارات المرجعية"</li>
                            <li>اضغط على "استيراد وتصدير" > "تصدير الإشارات المرجعية إلى HTML"</li>
                            <li>احفظ الملف ثم استورده هنا باستخدام "استيراد من HTML"</li>
                        </ol>
                        
                        <div style="background: #e3f2fd; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                            <strong>نصيحة:</strong> يمكنك أيضاً استخدام إضافة المتصفح الخاصة بنا للاستيراد التلقائي!
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">فهمت</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    // Show export options modal
    showExportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>تصدير الروابط</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>اختر تنسيق التصدير المناسب:</p>
                        
                        <div class="export-options">
                            <div class="export-option" onclick="importExportManager.exportToJSON(); this.closest('.modal').remove();">
                                <div class="option-icon">📄</div>
                                <div class="option-details">
                                    <h3>JSON</h3>
                                    <p>تنسيق JSON كامل مع جميع البيانات والإعدادات</p>
                                    <small>مُوصى به للنسخ الاحتياطي</small>
                                </div>
                            </div>
                            
                            <div class="export-option" onclick="importExportManager.exportToCSV(); this.closest('.modal').remove();">
                                <div class="option-icon">📊</div>
                                <div class="option-details">
                                    <h3>CSV</h3>
                                    <p>جدول بيانات يمكن فتحه في Excel أو Google Sheets</p>
                                    <small>مناسب للتحليل والمعالجة</small>
                                </div>
                            </div>
                            
                            <div class="export-option" onclick="importExportManager.exportToHTML(); this.closest('.modal').remove();">
                                <div class="option-icon">🌐</div>
                                <div class="option-details">
                                    <h3>HTML</h3>
                                    <p>صفحة ويب يمكن فتحها في أي متصفح</p>
                                    <small>مناسب للمشاركة والعرض</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Show import options modal
    showImportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>استيراد الروابط</h2>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>اختر مصدر الاستيراد:</p>
                        
                        <div class="import-options">
                            <div class="import-option" onclick="document.getElementById('json-file-input').click()">
                                <div class="option-icon">📄</div>
                                <div class="option-details">
                                    <h3>ملف JSON</h3>
                                    <p>استيراد من ملف JSON مُصدّر مسبقاً</p>
                                </div>
                            </div>
                            
                            <div class="import-option" onclick="document.getElementById('csv-file-input').click()">
                                <div class="option-icon">📊</div>
                                <div class="option-details">
                                    <h3>ملف CSV</h3>
                                    <p>استيراد من ملف CSV أو Excel</p>
                                </div>
                            </div>
                            
                            <div class="import-option" onclick="document.getElementById('html-file-input').click()">
                                <div class="option-icon">🌐</div>
                                <div class="option-details">
                                    <h3>ملف HTML</h3>
                                    <p>استيراد من ملف HTML أو روابط المتصفح المُصدّرة</p>
                                </div>
                            </div>
                            
                            <div class="import-option" onclick="importExportManager.importBrowserBookmarks()">
                                <div class="option-icon">🔖</div>
                                <div class="option-details">
                                    <h3>روابط المتصفح</h3>
                                    <p>تعليمات لاستيراد روابط المتصفح</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Hidden file inputs -->
                        <input type="file" id="json-file-input" accept=".json" style="display: none;" 
                               onchange="importExportManager.handleFileImport(this, 'json')">
                        <input type="file" id="csv-file-input" accept=".csv" style="display: none;" 
                               onchange="importExportManager.handleFileImport(this, 'csv')">
                        <input type="file" id="html-file-input" accept=".html,.htm" style="display: none;" 
                               onchange="importExportManager.handleFileImport(this, 'html')">
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async handleFileImport(input, type) {
        const file = input.files[0];
        if (!file) return;

        // Close modal
        const modal = input.closest('.modal');
        if (modal) modal.remove();

        // Show loading
        this.bookmarkManager.showLoading();

        try {
            let result;
            switch (type) {
                case 'json':
                    result = await this.importFromJSON(file);
                    break;
                case 'csv':
                    result = await this.importFromCSV(file);
                    break;
                case 'html':
                    result = await this.importFromHTML(file);
                    break;
                default:
                    throw new Error('نوع ملف غير مدعوم');
            }

            if (result.duplicates > 0) {
                this.bookmarkManager.showNotification(
                    `تم تجاهل ${result.duplicates} رابط مكرر`, 
                    'info'
                );
            }
        } catch (error) {
            console.error('Import error:', error);
        } finally {
            this.bookmarkManager.hideLoading();
            // Reset file input
            input.value = '';
        }
    }
}

// Export for use in main script
window.ImportExportManager = ImportExportManager;

