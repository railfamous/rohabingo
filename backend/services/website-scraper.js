/**
 * Website Scraper Service
 * Extracts video and image URLs from websites
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../config/logger');

/**
 * Extract media URLs from a webpage
 * @param {string} url - The webpage URL to scrape
 * @param {Object} options - Scraping options
 * @param {string[]} options.mediaTypes - Types to extract: 'video', 'image'
 * @param {string} options.cssSelector - Optional CSS selector to limit scope
 * @returns {Promise<Array<{url: string, type: string, title?: string}>>}
 */
async function extractMediaFromUrl(url, options = {}) {
    const { mediaTypes = ['video', 'image'], cssSelector = null } = options;
    const results = [];

    try {
        // Fetch the page
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 30000,
            maxRedirects: 5,
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const baseUrl = new URL(url);

        // Determine scope - use CSS selector if provided
        const scope = cssSelector ? $(cssSelector) : $('body');

        // Helper to resolve relative URLs
        const resolveUrl = (href) => {
            if (!href) return null;
            try {
                if (href.startsWith('//')) return `${baseUrl.protocol}${href}`;
                if (href.startsWith('/')) return `${baseUrl.origin}${href}`;
                if (href.startsWith('http')) return href;
                return new URL(href, url).href;
            } catch {
                return null;
            }
        };

        // Helper to check if URL is a media file
        const isVideoUrl = (u) => /\.(mp4|webm|mov|avi|mkv|m3u8)(\?.*)?$/i.test(u);
        const isImageUrl = (u) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(u);

        // Extract videos
        if (mediaTypes.includes('video')) {
            // <video> tags with src
            scope.find('video[src]').each((_, el) => {
                const src = resolveUrl($(el).attr('src'));
                if (src) {
                    results.push({ url: src, type: 'video', title: $(el).attr('title') || '' });
                }
            });

            // <video> > <source> tags
            scope.find('video source[src]').each((_, el) => {
                const src = resolveUrl($(el).attr('src'));
                if (src) {
                    results.push({ url: src, type: 'video', title: '' });
                }
            });

            // Direct video links
            scope.find('a[href]').each((_, el) => {
                const href = resolveUrl($(el).attr('href'));
                if (href && isVideoUrl(href)) {
                    results.push({ url: href, type: 'video', title: $(el).text().trim() || '' });
                }
            });

            // Iframes (YouTube, Vimeo, etc.)
            scope.find('iframe[src]').each((_, el) => {
                const src = $(el).attr('src') || '';
                if (src.includes('youtube.com') || src.includes('youtu.be')) {
                    // Extract YouTube video ID and create direct link
                    const match = src.match(/(?:embed\/|v[=/])([a-zA-Z0-9_-]{11})/);
                    if (match) {
                        results.push({
                            url: `https://www.youtube.com/watch?v=${match[1]}`,
                            type: 'video',
                            title: 'YouTube Video'
                        });
                    }
                } else if (src.includes('vimeo.com')) {
                    results.push({ url: resolveUrl(src), type: 'video', title: 'Vimeo Video' });
                }
            });

            // Open Graph video meta tags
            $('meta[property="og:video"]').each((_, el) => {
                const content = $(el).attr('content');
                if (content) {
                    results.push({ url: resolveUrl(content), type: 'video', title: '' });
                }
            });
        }

        // Extract images
        if (mediaTypes.includes('image')) {
            // <img> tags
            scope.find('img[src]').each((_, el) => {
                const src = resolveUrl($(el).attr('src'));
                const dataSrc = resolveUrl($(el).attr('data-src')); // lazy loading
                const actualSrc = dataSrc || src;

                if (actualSrc && !actualSrc.includes('data:image')) {
                    // Skip small images (likely icons/avatars)
                    const width = parseInt($(el).attr('width')) || 0;
                    const height = parseInt($(el).attr('height')) || 0;
                    if (width > 100 || height > 100 || (!width && !height)) {
                        results.push({
                            url: actualSrc,
                            type: 'image',
                            title: $(el).attr('alt') || $(el).attr('title') || ''
                        });
                    }
                }
            });

            // Open Graph image meta tags
            $('meta[property="og:image"]').each((_, el) => {
                const content = $(el).attr('content');
                if (content) {
                    results.push({ url: resolveUrl(content), type: 'image', title: '' });
                }
            });

            // Direct image links
            scope.find('a[href]').each((_, el) => {
                const href = resolveUrl($(el).attr('href'));
                if (href && isImageUrl(href)) {
                    results.push({ url: href, type: 'image', title: $(el).text().trim() || '' });
                }
            });
        }

        // Deduplicate by URL
        const seen = new Set();
        const unique = results.filter(item => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });

        logger.info(`[WebsiteScraper] Extracted ${unique.length} media items from ${url}`);
        return unique;

    } catch (error) {
        logger.error(`[WebsiteScraper] Error scraping ${url}:`, error.message);
        throw error;
    }
}

/**
 * Check if a media URL is accessible
 * @param {string} url - Media URL to check
 * @returns {Promise<boolean>}
 */
async function isMediaAccessible(url) {
    try {
        const response = await axios.head(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.status >= 200 && response.status < 400;
    } catch {
        return false;
    }
}

module.exports = {
    extractMediaFromUrl,
    isMediaAccessible
};
