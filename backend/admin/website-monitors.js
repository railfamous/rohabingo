/**
 * Website Monitors API Routes
 * Admin endpoints for managing website auto-post monitors
 */

const express = require('express');
const { adminAuth } = require('./auth');
const pool = require('../config/database');
const { extractMediaFromUrl } = require('../services/website-scraper');
const { logger } = require('../config/logger');

const router = express.Router();

// GET /admin/website-monitors - List all monitors
router.get('/', adminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        wm.*,
        (SELECT COUNT(*) FROM website_media_posts WHERE monitor_id = wm.id) as total_posts
      FROM website_monitors wm
      ORDER BY wm.created_at DESC
    `);
        res.json({ monitors: result.rows });
    } catch (error) {
        logger.error('Error fetching website monitors:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// POST /admin/website-monitors/preview - Preview what would be scraped from a URL
// IMPORTANT: This must be defined BEFORE /:id routes to avoid route conflicts
router.post('/preview', adminAuth, async (req, res) => {
    try {
        const { url, media_types = ['video', 'image'], css_selector = null } = req.body || {};

        if (!url) {
            return res.status(400).json({ message: 'url is required' });
        }

        const mediaItems = await extractMediaFromUrl(url, {
            mediaTypes: media_types,
            cssSelector: css_selector
        });

        res.json({
            message: 'Preview completed',
            total_found: mediaItems.length,
            media: mediaItems.slice(0, 20) // Limit preview to 20 items
        });
    } catch (error) {
        logger.error('Error previewing URL:', error);
        res.status(500).json({ message: error.message || 'Error scraping URL' });
    }
});

// GET /admin/website-monitors/:id - Get single monitor
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM website_monitors WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        res.json({ monitor: result.rows[0] });
    } catch (error) {
        logger.error('Error fetching website monitor:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// POST /admin/website-monitors - Create new monitor
router.post('/', adminAuth, async (req, res) => {
    try {
        const {
            name,
            website_url,
            check_interval_minutes = 60,
            media_types = ['video', 'image'],
            target_chat_ids = [],
            css_selector = null,
            caption_template = '',
            is_active = true
        } = req.body || {};

        if (!name || !website_url) {
            return res.status(400).json({ message: 'name and website_url are required' });
        }

        if (!target_chat_ids.length) {
            return res.status(400).json({ message: 'At least one target chat is required' });
        }

        const result = await pool.query(`
      INSERT INTO website_monitors 
        (name, website_url, check_interval_minutes, media_types, target_chat_ids, css_selector, caption_template, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
            name,
            website_url,
            check_interval_minutes,
            media_types,
            target_chat_ids,
            css_selector || null,
            caption_template,
            is_active
        ]);

        res.status(201).json({ monitor: result.rows[0] });
    } catch (error) {
        logger.error('Error creating website monitor:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// PUT /admin/website-monitors/:id - Update monitor
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            website_url,
            check_interval_minutes,
            media_types,
            target_chat_ids,
            css_selector,
            caption_template,
            is_active
        } = req.body || {};

        const result = await pool.query(`
      UPDATE website_monitors SET
        name = COALESCE($1, name),
        website_url = COALESCE($2, website_url),
        check_interval_minutes = COALESCE($3, check_interval_minutes),
        media_types = COALESCE($4, media_types),
        target_chat_ids = COALESCE($5, target_chat_ids),
        css_selector = $6,
        caption_template = COALESCE($7, caption_template),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
            name,
            website_url,
            check_interval_minutes,
            media_types,
            target_chat_ids,
            css_selector,
            caption_template,
            is_active,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        res.json({ monitor: result.rows[0] });
    } catch (error) {
        logger.error('Error updating website monitor:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// DELETE /admin/website-monitors/:id - Delete monitor
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM website_monitors WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        res.json({ message: 'Monitor deleted', id: result.rows[0].id });
    } catch (error) {
        logger.error('Error deleting website monitor:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// POST /admin/website-monitors/:id/check - Manually trigger check
router.post('/:id/check', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Get monitor
        const monitorResult = await pool.query(
            'SELECT * FROM website_monitors WHERE id = $1',
            [id]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const monitor = monitorResult.rows[0];

        // Extract media from website
        const mediaItems = await extractMediaFromUrl(monitor.website_url, {
            mediaTypes: monitor.media_types,
            cssSelector: monitor.css_selector
        });

        // Filter out already posted media
        const existingResult = await pool.query(
            'SELECT media_url FROM website_media_posts WHERE monitor_id = $1',
            [id]
        );
        const existingUrls = new Set(existingResult.rows.map(r => r.media_url));

        const newMedia = mediaItems.filter(m => !existingUrls.has(m.url));

        // Update last checked
        await pool.query(
            'UPDATE website_monitors SET last_checked_at = NOW(), last_error = NULL WHERE id = $1',
            [id]
        );

        res.json({
            message: 'Check completed',
            total_found: mediaItems.length,
            new_media: newMedia.length,
            media: newMedia
        });
    } catch (error) {
        logger.error('Error checking website:', error);

        // Update error status
        await pool.query(
            'UPDATE website_monitors SET last_checked_at = NOW(), last_error = $1 WHERE id = $2',
            [error.message, req.params.id]
        ).catch(() => { });

        res.status(500).json({ message: error.message || 'Error checking website' });
    }
});

// POST /admin/website-monitors/:id/post-now - Post specific media immediately
router.post('/:id/post-now', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { media_url, media_type, caption } = req.body || {};

        if (!media_url || !media_type) {
            return res.status(400).json({ message: 'media_url and media_type are required' });
        }

        // Get monitor to find target chats
        const monitorResult = await pool.query(
            'SELECT * FROM website_monitors WHERE id = $1',
            [id]
        );

        if (monitorResult.rows.length === 0) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        const monitor = monitorResult.rows[0];
        const targetChats = monitor.target_chat_ids || [];

        if (!targetChats.length) {
            return res.status(400).json({ message: 'No target chats configured' });
        }

        // Get bot instance
        const { createBot } = require('../bot');
        const bot = await createBot();

        if (!bot || !bot.bot) {
            return res.status(500).json({ message: 'Bot not ready' });
        }

        const postedTo = [];
        const errors = [];

        // Post to each chat
        for (const chatId of targetChats) {
            try {
                const finalCaption = caption || monitor.caption_template || '';

                if (media_type === 'video') {
                    await bot.bot.sendVideo(chatId, media_url, {
                        caption: finalCaption || undefined,
                        parse_mode: 'HTML'
                    });
                } else {
                    await bot.bot.sendPhoto(chatId, media_url, {
                        caption: finalCaption || undefined,
                        parse_mode: 'HTML'
                    });
                }
                postedTo.push(chatId);
            } catch (err) {
                logger.error(`Error posting to chat ${chatId}:`, err.message);
                errors.push({ chat_id: chatId, error: err.message });
            }
        }

        // Record the post
        if (postedTo.length > 0) {
            await pool.query(`
        INSERT INTO website_media_posts (monitor_id, media_url, media_type, chat_ids_posted)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (monitor_id, media_url) DO UPDATE SET
          chat_ids_posted = website_media_posts.chat_ids_posted || EXCLUDED.chat_ids_posted,
          posted_at = NOW()
      `, [id, media_url, media_type, postedTo]);
        }

        res.json({
            message: 'Post completed',
            posted_to: postedTo,
            errors
        });
    } catch (error) {
        logger.error('Error posting media:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// GET /admin/website-monitors/:id/posts - Get posted media history
router.get('/:id/posts', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const result = await pool.query(`
      SELECT * FROM website_media_posts 
      WHERE monitor_id = $1 
      ORDER BY posted_at DESC 
      LIMIT $2
    `, [id, limit]);

        res.json({ posts: result.rows });
    } catch (error) {
        logger.error('Error fetching posts:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

module.exports = router;
