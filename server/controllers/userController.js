const User = require('../models/User');
const { escapeRegex } = require('../utils/sanitize');
const { formatUserResponse } = require('./authController');

/**
 * User Controller — InSearch Sai University
 * Admin-only user directory endpoint
 */

/**
 * @route   GET /api/users
 * @desc    Get paginated university users list (Admin only)
 * @access  Private / Admin
 */
const getUsers = async (req, res) => {
  try {
    const { q, role, status, page, limit } = req.query;

    const query = {};

    // 1. Role filter
    if (role && role !== 'all') {
      const cleanRole = role.trim().toLowerCase();
      if (['student', 'admin'].includes(cleanRole)) {
        query.role = cleanRole;
      }
    }

    // 2. Status filter
    if (status && status !== 'all') {
      const cleanStatus = status.trim().toLowerCase();
      if (['active', 'suspended'].includes(cleanStatus)) {
        query.status = cleanStatus;
      }
    }

    // 3. Keyword Search across name, email, studentId, department
    if (q && q.trim().length > 0) {
      const escaped = escapeRegex(q.trim());
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { studentId: regex },
        { department: regex }
      ];
    }

    // 4. Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await User.countDocuments(query);

    const userDocs = await User.find(query)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const sanitizedUsers = userDocs.map(doc => formatUserResponse(doc));

    return res.status(200).json({
      success: true,
      count: sanitizedUsers.length,
      total,
      pagination: {
        totalUsers: total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      data: sanitizedUsers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve university users directory.',
      error: error.message
    });
  }
};

module.exports = {
  getUsers
};
