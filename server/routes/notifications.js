const express = require('express');
const db = require('../db');
const { requireAuth, requireShop } = require('../middleware/auth');

const router = express.Router();

// Create a notification
async function createNotification(userIds, title, message, type = 'info', relatedSaleId = null) {
  try {
    // If userIds is a single number, convert to array
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
    
    for (const userId of userIdArray) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, related_sale_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, title, message, type, relatedSaleId]
      );
    }
  } catch (err) {
    console.error('Error creating notification:', err);
    // Don't throw - notifications are not critical
  }
}

// Get notifications for current user (admin/super admin/customer)
router.get('/', requireAuth, requireShop, async (req, res) => {
  try {
    const { unreadOnly = false, limit = 50 } = req.query;
    
    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;
    const params = [req.user_id ?? req.user?.id];
    
    if (unreadOnly === 'true') {
      query += ` AND is_read = false`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', requireAuth, requireShop, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user_id ?? req.user?.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true, notification: result.rows[0] });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, requireShop, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false`,
      [req.user_id ?? req.user?.id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Get unread count
router.get('/unread-count', requireAuth, requireShop, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = $1 AND is_read = false`,
      [req.user_id ?? req.user?.id]
    );
    
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (err) {
    console.error('Error getting unread count:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Export the createNotification function for use in other routes
module.exports = router;
module.exports.createNotification = createNotification;

