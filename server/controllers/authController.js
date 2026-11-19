const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

/**
 * Authentication Controller — InSearch Sai University
 *
 * Implements:
 * 1. register: Creates verified student accounts with 12-round bcrypt hash & signed JWT.
 * 2. login: Verifies credentials, guards against suspended accounts, & issues JWT.
 * 3. getMe: Delivers sanitized profile for authenticated session verification.
 */

/**
 * Sanitizes and formats the user document for frontend consumption.
 * Guarantees that internal fields (password, __v) are excluded and both `id` and `_id` are present.
 * @param {Object} user - Mongoose document or user object
 * @returns {Object} Frontend-compatible user representation
 */
function formatUserResponse(user) {
  const userObj = user && typeof user.toObject === 'function' ? user.toObject({ virtuals: true }) : user || {};
  const id = userObj._id ? userObj._id.toString() : userObj.id ? userObj.id.toString() : '';

  return {
    id: id,
    _id: id,
    name: userObj.name || '',
    email: userObj.email || '',
    role: userObj.role || 'student',
    studentId: userObj.studentId || '',
    department: userObj.department || 'School of Computing & Data Science',
    phone: userObj.phone || '',
    avatar: userObj.avatar || '',
    status: userObj.status || 'active'
  };
}

/**
 * Registers a new student account.
 * Route: POST /api/auth/register
 * Access: Public
 */
const register = async (req, res) => {
  try {
    // Pick strictly allowed fields — ignore any external injections
    const { name, email, password, studentId, department, phone } = req.body;

    // Check for duplicate email in database
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this university email address is already registered.'
      });
    }

    // Check for duplicate studentId in database
    const existingStudent = await User.findOne({ studentId });
    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: 'An account with this Student ID is already registered.'
      });
    }

    // Hash the plaintext password using 12 salt rounds
    const hashedPassword = await hashPassword(password);

    // Save student to MongoDB (role is strictly enforced as 'student')
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      studentId,
      department: department || 'School of Computing & Data Science',
      phone: phone || '',
      role: 'student',
      status: 'active'
    });

    // Generate cryptographic JWT token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to InSearch.',
      token,
      user: formatUserResponse(newUser)
    });
  } catch (error) {
    // Handle MongoDB duplicate key race condition (code 11000)
    if (error.code === 11000) {
      const isStudentId =
        (error.keyPattern && error.keyPattern.studentId) ||
        (error.keyValue && error.keyValue.studentId) ||
        (error.message && error.message.includes('studentId'));

      return res.status(409).json({
        success: false,
        message: isStudentId
          ? 'An account with this Student ID is already registered.'
          : 'An account with this university email address is already registered.'
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error occurred during account registration.'
    });
  }
};

/**
 * Authenticates user credentials and issues a session JWT.
 * Route: POST /api/auth/login
 * Access: Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Unified generic message to prevent account enumeration
    const genericAuthError = {
      success: false,
      message: 'Invalid university email or password.'
    };

    // Find user by normalized email, explicitly including password hash for verification
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json(genericAuthError);
    }

    // Check account status: suspended accounts cannot authenticate (uniform generic 401 to prevent enumeration)
    if (user.status === 'suspended') {
      return res.status(401).json(genericAuthError);
    }

    // Compare submitted plaintext password against stored bcrypt hash
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json(genericAuthError);
    }

    // Issue cryptographic JWT
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error occurred during login processing.'
    });
  }
};

/**
 * Returns current authenticated user profile.
 * Route: GET /api/auth/me
 * Access: Private (requires protect middleware)
 */
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access profile.'
      });
    }

    return res.status(200).json({
      success: true,
      user: formatUserResponse(req.user)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error occurred retrieving user profile.'
    });
  }
};

/**
 * Quick/Demo Login for Presentation & Development Testing.
 * Strictly gated: Disabled by default, strictly forbidden in production.
 * Only permits pre-designated demo student and admin accounts.
 *
 * Route: POST /api/auth/demo-login
 * Access: Restricted Public (development & demo environments only)
 */
const demoLogin = async (req, res) => {
  try {
    // 1. Strict Environment & Configuration Gates (Production can NEVER be overridden)
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Demo login is permanently disabled in production environments.'
      });
    }

    if (process.env.ALLOW_DEMO_LOGIN !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Demo login is currently disabled by server configuration.'
      });
    }

    // 2. Strict Role Validation: Only 'student' and 'admin' are permitted
    const rawRole = req.body && typeof req.body === 'object' ? req.body.role : null;
    if (!rawRole || typeof rawRole !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid demo role (student or admin) is required.'
      });
    }

    const cleanRole = rawRole.trim().toLowerCase();
    if (!['student', 'admin'].includes(cleanRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid demo role. Only 'student' and 'admin' are permitted."
      });
    }

    // 3. Strict Pre-Designated Demo Identity Lookup (Arbitrary identifiers rejected)
    const DEMO_EMAILS = {
      admin: 'admin@saiuniversity.edu.in',
      student: 'akshaya@saiuniversity.edu.in'
    };
    const targetEmail = DEMO_EMAILS[cleanRole];

    const user = await User.findOne({ email: targetEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Designated demo account for '${cleanRole}' does not exist. Please seed the demo accounts.`
      });
    }

    // 4. Invariant Verification: Confirm exact role and active status (Zero fallback)
    if (user.role !== cleanRole) {
      return res.status(403).json({
        success: false,
        message: 'Account role mismatch for demo login.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Demo account is ${user.status || 'inactive'}. Access denied.`
      });
    }

    // 5. Generate genuine signed JWT and return sanitized user profile
    const token = generateToken(user);
    return res.status(200).json({
      success: true,
      message: `Demo login successful as ${user.name} (${cleanRole}).`,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during demo login processing.'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  demoLogin,
  formatUserResponse
};
