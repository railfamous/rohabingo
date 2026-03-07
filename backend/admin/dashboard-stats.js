const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { adminAuth } = require('./auth');

const queryWithFallback = async (queryText, fallbackRow, contextLabel) => {
  try {
    return await pool.query(queryText);
  } catch (error) {
    if (error && error.code === '42P01') {
      console.warn(`[dashboard-stats] Missing relation for ${contextLabel}. Returning fallback counts.`);
      return { rows: [fallbackRow] };
    }
    throw error;
  }
};

const toInt = (value) => parseInt(value, 10) || 0;

// Get dashboard statistics and counts
router.get('/', adminAuth, async (req, res) => {
  try {
    // Get all counts in parallel for better performance
    const [
      promotionSubmissionsResult,
      userPromotionsResult,
      usersResult,
      quizzesResult,
      videoTasksResult,
      telegramChannelsResult,
      referralsResult,
      spinWheelRewardsResult
    ] = await Promise.all([
      // Promotion submissions counts
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) as total
        FROM promotion_submissions
      `, { pending: 0, approved: 0, rejected: 0, total: 0 }, 'promotion_submissions'),
      
      // User submitted promotions counts
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'declined') as declined,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) as total
        FROM user_submitted_promotions
      `, { pending: 0, approved: 0, declined: 0, active: 0, total: 0 }, 'user_submitted_promotions'),
      
      // Users counts
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE is_banned = false) as active,
          COUNT(*) FILTER (WHERE is_banned = true) as banned,
          COUNT(*) as total
        FROM telegram_users
      `, { active: 0, banned: 0, total: 0 }, 'telegram_users'),
      
      // Quizzes counts
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          COUNT(*) as total
        FROM quizzes
      `, { active: 0, inactive: 0, total: 0 }, 'quizzes'),
      
      // Video tasks counts
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE disabled = false AND (expires_at IS NULL OR expires_at > NOW())) as active,
          COUNT(*) FILTER (WHERE disabled = true OR (expires_at IS NOT NULL AND expires_at <= NOW())) as inactive,
          COUNT(*) as total
        FROM youtube_tasks
      `, { active: 0, inactive: 0, total: 0 }, 'youtube_tasks'),
      
      // Telegram channels counts
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE disabled = false AND (expires_at IS NULL OR expires_at > NOW())) as active,
          COUNT(*) FILTER (WHERE disabled = true OR (expires_at IS NOT NULL AND expires_at <= NOW())) as inactive,
          COUNT(*) as total
        FROM telegram_channels
      `, { active: 0, inactive: 0, total: 0 }, 'telegram_channels'),
      
      // Referrals count
      queryWithFallback('SELECT COUNT(*) as total FROM referrals', { total: 0 }, 'referrals'),
      
      // Spin wheel rewards count
      queryWithFallback(`
        SELECT 
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          COUNT(*) as total
        FROM spin_wheel_rewards
      `, { active: 0, inactive: 0, total: 0 }, 'spin_wheel_rewards')
    ]);

    const stats = {
      promotionSubmissions: {
        pending: toInt(promotionSubmissionsResult.rows[0].pending),
        approved: toInt(promotionSubmissionsResult.rows[0].approved),
        rejected: toInt(promotionSubmissionsResult.rows[0].rejected),
        total: toInt(promotionSubmissionsResult.rows[0].total)
      },
      userPromotions: {
        pending: toInt(userPromotionsResult.rows[0].pending),
        approved: toInt(userPromotionsResult.rows[0].approved),
        declined: toInt(userPromotionsResult.rows[0].declined),
        active: toInt(userPromotionsResult.rows[0].active),
        total: toInt(userPromotionsResult.rows[0].total)
      },
      users: {
        active: toInt(usersResult.rows[0].active),
        banned: toInt(usersResult.rows[0].banned),
        total: toInt(usersResult.rows[0].total)
      },
      quizzes: {
        active: toInt(quizzesResult.rows[0].active),
        inactive: toInt(quizzesResult.rows[0].inactive),
        total: toInt(quizzesResult.rows[0].total)
      },
      videoTasks: {
        active: toInt(videoTasksResult.rows[0].active),
        inactive: toInt(videoTasksResult.rows[0].inactive),
        total: toInt(videoTasksResult.rows[0].total)
      },
      telegramChannels: {
        active: toInt(telegramChannelsResult.rows[0].active),
        inactive: toInt(telegramChannelsResult.rows[0].inactive),
        total: toInt(telegramChannelsResult.rows[0].total)
      },
      referrals: {
        total: toInt(referralsResult.rows[0].total)
      },
      spinWheelRewards: {
        active: toInt(spinWheelRewardsResult.rows[0].active),
        inactive: toInt(spinWheelRewardsResult.rows[0].inactive),
        total: toInt(spinWheelRewardsResult.rows[0].total)
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
