const mongoose = require('mongoose');

/**
 * Notification Request Validation Middleware — InSearch Sai University
 */

const ALLOWED_UNREAD_ONLY = ['true', 'false', '1', '0'];

/**
 * Validates query parameters for GET /api/notifications
 */
const validateNotificationQuery = (req, res, next) => {
  const { page, limit, unreadOnly } = req.query;
  const errors = [];

  // Reject nested object parameters (MongoDB operator injection defense)
  for (const [key, val] of Object.entries(req.query)) {
    if (typeof val === 'object' && val !== null) {
      return res.status(400).json({
        success: false,
        message: `Query parameter '${key}' cannot be an object or operator.`
      });
    }
  }

  // Page validation
  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push("Pagination 'page' must be a positive integer greater than or equal to 1.");
    }
  }

  // Limit validation
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push("Pagination 'limit' must be an integer between 1 and 50.");
    }
  }

  // unreadOnly validation
  if (unreadOnly !== undefined) {
    if (typeof unreadOnly !== 'string' || !ALLOWED_UNREAD_ONLY.includes(unreadOnly.trim().toLowerCase())) {
      errors.push("Query parameter 'unreadOnly' must be a boolean ('true' or 'false').");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification query parameters.',
      errors
    });
  }

  next();
};

/**
 * Validates notification ObjectId route parameter (:id)
 */
const validateNotificationId = (req, res, next) => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification ID format.'
    });
  }

  req.params.id = id.trim();
  next();
};

module.exports = {
  validateNotificationQuery,
  validateNotificationId
};
