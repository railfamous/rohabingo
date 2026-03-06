/**
 * Website Scraper Service
 * Extracts video and image URLs from websites
 * Supports both static HTML and JavaScript-rendered pages
 */

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { logger } = require('../config/logger');

// Cache browser instance for reuse
let browserInstance = null;

/**
 * Get or create a puppeteer browser instance
 */
async function getBrowser() {
    if (!browserInstance || !browserInstance.isConnected()) {
        logger.info('[WebsiteScraper] Launching headless browser...');
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });
    }
    return browserInstance;
}

/**
 * Close browser instance (call on app shutdown)
 */
async function closeBrowser() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

/**
 * Extract media from HTML content using cheerio
 */
function extractMediaFromHtml(html, url, options = {}) {
    const { mediaTypes = ['video', 'image'], cssSelector = null } = options;
    const results = [];
    const $ = cheerio.load(html);
    const baseUrl = new URL(url);

    // Determine scope - use CSS selector if provided
    const scope = cssSelector ? $(cssSelector) : $('body');

    // Helper to resolve relative URLs
    const resolveUrl = (href) => {
        if (!href) return null;
        if (href.startsWith('data:')) return null; // Skip data URLs
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
    const isVideoUrl = (u) => /\.(mp4|webm|mov|avi|mkv|m3u8|flv|wmv|3gp)(\?.*)?$/i.test(u);
    const isImageUrl = (u) => /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|tiff?)(\?.*)?$/i.test(u);

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

        // data-video-src attributes
        scope.find('[data-video-src], [data-video], [data-src][data-type="video"]').each((_, el) => {
            const src = resolveUrl($(el).attr('data-video-src') || $(el).attr('data-video') || $(el).attr('data-src'));
            if (src) {
                results.push({ url: src, type: 'video', title: '' });
            }
        });
    }

    // Extract images
    if (mediaTypes.includes('image')) {
        // <img> tags with various src attributes
        scope.find('img').each((_, el) => {
            // Check multiple possible sources
            const srcOptions = [
                $(el).attr('src'),
                $(el).attr('data-src'),
                $(el).attr('data-lazy-src'),
                $(el).attr('data-original'),
                $(el).attr('data-lazy'),
                $(el).attr('data-srcset')?.split(',')[0]?.trim().split(' ')[0],
                $(el).attr('srcset')?.split(',')[0]?.trim().split(' ')[0]
            ];

            for (const srcOption of srcOptions) {
                const actualSrc = resolveUrl(srcOption);
                if (actualSrc && !actualSrc.includes('data:image')) {
                    // Skip small images (likely icons/avatars)
                    const width = parseInt($(el).attr('width')) || 0;
                    const height = parseInt($(el).attr('height')) || 0;
                    // Only add if size is unknown or larger than 100px
                    if (width > 100 || height > 100 || (!width && !height)) {
                        results.push({
                            url: actualSrc,
                            type: 'image',
                            title: $(el).attr('alt') || $(el).attr('title') || ''
                        });
                        break; // Only take first valid source
                    }
                }
            }
        });

        // Background images in inline styles
        scope.find('[style*="background"]').each((_, el) => {
            const style = $(el).attr('style') || '';
            const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
            if (match) {
                const src = resolveUrl(match[1]);
                if (src && isImageUrl(src)) {
                    results.push({ url: src, type: 'image', title: '' });
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

        // Twitter card images
        $('meta[name="twitter:image"]').each((_, el) => {
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

        // Picture elements
        scope.find('picture source[srcset]').each((_, el) => {
            const srcset = $(el).attr('srcset');
            if (srcset) {
                const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
                const src = resolveUrl(firstSrc);
                if (src) {
                    results.push({ url: src, type: 'image', title: '' });
                }
            }
        });

        // Figure elements with images
        scope.find('figure img').each((_, el) => {
            const src = resolveUrl($(el).attr('src') || $(el).attr('data-src'));
            const caption = $(el).closest('figure').find('figcaption').text().trim();
            if (src) {
                results.push({ url: src, type: 'image', title: caption || $(el).attr('alt') || '' });
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

    return unique;
}

/**
 * Fetch page with puppeteer (for JavaScript-rendered content)
 */
async function fetchWithPuppeteer(url, options = {}) {
    const { timeout = 30000 } = options;
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to page
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout
        });

        // Wait a bit for lazy-loaded content
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

        // Scroll down to trigger lazy loading
        await page.evaluate(async () => {
            const scrollStep = window.innerHeight;
            const maxScrolls = 5;
            for (let i = 0; i < maxScrolls; i++) {
                window.scrollBy(0, scrollStep);
                await new Promise(r => setTimeout(r, 300));
            }
            window.scrollTo(0, 0);
        });

        // Wait for any new content to load
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

        // Get the rendered HTML
        const html = await page.content();
        return html;
    } finally {
        await page.close();
    }
}

/**
 * Fetch page with axios (for static content)
 */
async function fetchWithAxios(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
        maxRedirects: 5,
    });
    return response.data;
}

/**
 * Extract media URLs from a webpage
 * @param {string} url - The webpage URL to scrape
 * @param {Object} options - Scraping options
 * @param {string[]} options.mediaTypes - Types to extract: 'video', 'image'
 * @param {string} options.cssSelector - Optional CSS selector to limit scope
 * @param {boolean} options.usePuppeteer - Force use of puppeteer (default: auto)
 * @returns {Promise<Array<{url: string, type: string, title?: string}>>}
 */
async function extractMediaFromUrl(url, options = {}) {
    const { mediaTypes = ['video', 'image'], cssSelector = null, usePuppeteer = 'auto' } = options;

    logger.info(`[WebsiteScraper] Starting extraction from ${url}`);
    logger.info(`[WebsiteScraper] Options: mediaTypes=${JSON.stringify(mediaTypes)}, cssSelector=${cssSelector}, usePuppeteer=${usePuppeteer}`);

    try {
        let html;
        let results = [];

        // Try static fetch first (faster)
        if (usePuppeteer !== true) {
            try {
                logger.info(`[WebsiteScraper] Trying static fetch first...`);
                html = await fetchWithAxios(url);
                results = extractMediaFromHtml(html, url, { mediaTypes, cssSelector });
                logger.info(`[WebsiteScraper] Static fetch found ${results.length} media items`);
            } catch (err) {
                logger.warn(`[WebsiteScraper] Static fetch failed: ${err.message}`);
            }
        }

        // If no results or forced puppeteer, use headless browser
        if ((results.length === 0 || usePuppeteer === true) && usePuppeteer !== false) {
            try {
                logger.info(`[WebsiteScraper] Using puppeteer for JS-rendered content...`);
                html = await fetchWithPuppeteer(url, { timeout: 45000 });
                const puppeteerResults = extractMediaFromHtml(html, url, { mediaTypes, cssSelector });
                logger.info(`[WebsiteScraper] Puppeteer found ${puppeteerResults.length} media items`);

                // Merge results, preferring puppeteer if it found more
                if (puppeteerResults.length > results.length) {
                    results = puppeteerResults;
                }
            } catch (err) {
                logger.error(`[WebsiteScraper] Puppeteer fetch failed: ${err.message}`);
                // If we have some results from static, use those
                if (results.length === 0) {
                    throw err;
                }
            }
        }

        logger.info(`[WebsiteScraper] Final: Extracted ${results.length} media items from ${url}`);
        return results;

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

// Cleanup on process exit
process.on('exit', closeBrowser);
process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit();
});
process.on('SIGTERM', async () => {
    await closeBrowser();
    process.exit();
});

module.exports = {
    extractMediaFromUrl,
    isMediaAccessible,
    closeBrowser
};
