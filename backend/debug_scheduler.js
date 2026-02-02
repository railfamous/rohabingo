require('dotenv').config();
const pool = require('./config/database');

async function check() {
    const client = await pool.connect();
    try {
        console.log('Connected.');

        const tz = await client.query('SHOW TIMEZONE');
        console.log('DB Timezone:', tz.rows[0].TimeZone);

        const res = await client.query(`
      SELECT 
        id, 
        send_at::text as send_at_raw, 
        (NOW() AT TIME ZONE 'UTC')::text as utc_now_raw,
        (send_at <= (NOW() AT TIME ZONE 'UTC')) as is_due_utc 
      FROM scheduled_posts 
      WHERE status = 'pending'
    `);

        console.log('Pending posts:', JSON.stringify(res.rows, null, 2));

        // Also check failed posts
        const failed = await client.query(`
      SELECT id, error, updated_at FROM scheduled_posts WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 5
    `);
        console.log('Recent failures:', JSON.stringify(failed.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

check();
