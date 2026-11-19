const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const {
  validateNotificationQuery,
  validateNotificationId
} = require('../middleware/notificationValidation');

/**
 * Notification Routes — InSearch Sai University
 */

// List notifications (scoping strictly to authenticated user)
router.get('/', protect, validateNotificationQuery, notificationController.getNotifications);

// Bulk mark all notifications read for authenticated user (mounted before /:id/read)
router.patch('/read-all', protect, notificationController.markAllNotificationsAsRead);

// Single notification mark as read (recipient ownership enforced)
router.patch('/:id/read', protect, validateNotificationId, notificationController.markNotificationAsRead);

module.exports = router;
