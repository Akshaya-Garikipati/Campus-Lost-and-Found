const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * Notification Controller — InSearch Sai University Lost & Found Portal
 */

/**
 * @route   GET /api/notifications
 * @desc    Retrieve paginated notifications for the authenticated user
 * @access  Private (protect)
 */
const getNotifications = async (req, res) => {
  try {
    const { page, limit, unreadOnly } = req.query;

    // Strict recipient scoping to authenticated user
    const query = { recipient: req.user._id };

    if (unreadOnly === 'true' || unreadOnly === '1') {
      query.read = false;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Parallel index-covered queries for list, total matching, and unread badge count
    const [total, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('relatedItem', 'title type category location specificLocation status image')
        .populate('relatedClaim', 'status submittedAt itemTitle')
    ]);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      data: notifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications.',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a single notification as read (recipient only)
 * @access  Private (protect)
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
      .populate('relatedItem', 'title type category location specificLocation status image')
      .populate('relatedClaim', 'status submittedAt itemTitle');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }

    // Strict ownership verification: only target recipient can modify
    if (!notification.recipient || !notification.recipient.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to modify this notification.'
      });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read.',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all unread notifications for the authenticated user as read
 * @access  Private (protect)
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    // Atomic bulk update strictly scoped to authenticated user
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read.',
      error: error.message
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
