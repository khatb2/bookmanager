// Metadata Fetcher for Bookmark Manager
class MetadataFetcher {
    constructor() {
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://corsproxy.io/?',
            'https://cors-anywhere.herokuapp.com/'
        ];
    }

    async fetchMetadata(url) {
        try {
            // First try to extract basic info from URL
            const basicInfo = this.extractBasicInfo(url);
            
            // Try to fetch actual metadata
            const metadata = await this.fetchFromUrl(url);
            
            return {
                ...basicInfo,
                ...metadata
            };
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return this.extractBasicInfo(url);
        }
    }

    extractBasicInfo(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const path = urlObj.pathname;
            
            // Extract title from URL path
            let title = domain;
            if (path && path !== '/') {
                const pathParts = path.split('/').filter(part => part);
                if (pathParts.length > 0) {
                    title = pathParts[pathParts.length - 1]
                        .replace(/[-_]/g, ' ')
                        .replace(/\.(html|php|asp|jsp)$/i, '');
                }
            }
            
            return {
                title: this.capitalizeWords(title),
                description: `صفحة من موقع ${domain}`,
                image: `https://via.placeholder.com/400x200?text=${encodeURIComponent(domain)}`,
                tags: [domain, 'موقع', 'رابط'],
                favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
            };
        } catch (error) {
            return {
                title: 'رابط جديد',
                description: 'وصف الرابط',
                image: 'https://via.placeholder.com/400x200?text=No+Preview',
                tags: ['رابط'],
                favicon: null
            };
        }
    }

    async fetchFromUrl(url) {
        // Try different methods to fetch metadata
        const methods = [
            () => this.fetchWithCorsProxy(url),
            () => this.fetchOpenGraph(url),
            () => this.fetchWithJsonApi(url)
        ];

        for (const method of methods) {
            try {
                const result = await method();
                if (result && result.title) {
                    return result;
                }
            } catch (error) {
                console.warn('Method failed, trying next:', error.message);
            }
        }

        throw new Error('All methods failed');
    }

    async fetchWithCorsProxy(url) {
        const proxyUrl = this.corsProxies[0] + encodeURIComponent(url);
        
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const html = data.contents;
        
        return this.parseHtmlMetadata(html);
    }

    async fetchOpenGraph(url) {
        // Try to use a service that provides OpenGraph data
        const apiUrl = `https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}`;
        
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                return {
                    title: data.hybridGraph?.title || data.openGraph?.title,
                    description: data.hybridGraph?.description || data.openGraph?.description,
                    image: data.hybridGraph?.image || data.openGraph?.image,
                    favicon: data.hybridGraph?.favicon
                };
            }
        } catch (error) {
            throw new Error('OpenGraph API failed');
        }
    }

    async fetchWithJsonApi(url) {
        // Try using a metadata extraction service
        const apiUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        return {
            title: data.title,
            description: data.description,
            image: data.images?.[0]?.url || data.image,
            favicon: data.favicon
        };
    }

    parseHtmlMetadata(html) {
        // Create a temporary DOM to parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract title
        let title = doc.querySelector('title')?.textContent?.trim();
        
        // Extract Open Graph data
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        
        // Extract Twitter Card data
        const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
        const twitterDescription = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
        const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        
        // Extract standard meta tags
        const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        
        // Extract favicon
        let favicon = doc.querySelector('link[rel="icon"]')?.getAttribute('href') ||
                     doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
                     doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
        
        return {
            title: ogTitle || twitterTitle || title || 'بدون عنوان',
            description: ogDescription || twitterDescription || metaDescription || 'لا يوجد وصف',
            image: ogImage || twitterImage,
            favicon: favicon
        };
    }

    capitalizeWords(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    // Enhanced URL validation
    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    // Generate tags from URL and content
    generateTags(url, title, description) {
        const tags = new Set();
        
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            
            // Add domain
            tags.add(domain);
            
            // Add common website categories based on domain
            const categories = this.categorizeByDomain(domain);
            categories.forEach(cat => tags.add(cat));
            
            // Extract keywords from title and description
            const text = `${title} ${description}`.toLowerCase();
            const keywords = this.extractKeywords(text);
            keywords.forEach(keyword => tags.add(keyword));
            
        } catch (error) {
            tags.add('رابط');
        }
        
        return Array.from(tags).slice(0, 5); // Limit to 5 tags
    }

    categorizeByDomain(domain) {
        const categories = [];
        
        if (domain.includes('github') || domain.includes('gitlab') || domain.includes('bitbucket')) {
            categories.push('تطوير', 'برمجة');
        } else if (domain.includes('youtube') || domain.includes('vimeo')) {
            categories.push('فيديو', 'ترفيه');
        } else if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) {
            categories.push('أخبار');
        } else if (domain.includes('edu') || domain.includes('coursera') || domain.includes('udemy')) {
            categories.push('تعليم');
        } else if (domain.includes('shop') || domain.includes('store') || domain.includes('amazon')) {
            categories.push('تسوق');
        }
        
        return categories;
    }

    extractKeywords(text) {
        // Simple keyword extraction (in a real app, you'd use more sophisticated NLP)
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const words = text.match(/\b\w{3,}\b/g) || [];
        
        return words
            .filter(word => !commonWords.includes(word.toLowerCase()))
            .slice(0, 3);
    }
}

// Export for use in main script
window.MetadataFetcher = MetadataFetcher;

