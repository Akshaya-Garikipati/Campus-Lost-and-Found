const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Authentication & Authorization Middleware — InSearch Sai University
 *
 * Implements:
 * 1. protect: Extracts and cryptographically verifies JWT Bearer tokens,
 *    queries the live user record from MongoDB, checks account status,
 *    and binds the user to req.user.
 * 2. authorize: Role-Based Access Control (RBAC) inspecting req.user.role.
 * 3. validateRegister: Pre-validation and normalization for registration requests.
 * 4. validateLogin: Pre-validation and normalization for login requests.
 */

/**
 * Extracts and verifies the Bearer JWT token from the Authorization header.
 * Attaches the authenticated MongoDB user (excluding password) to req.user.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing or malformed authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim().length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing from Bearer header.'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authentication token has expired. Please log in again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid or tampered authentication token.'
      });
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token payload contains no user identifier.'
      });
    }

    // Query active user from MongoDB, explicitly excluding password hash
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.'
      });
    }

    if (user.status === 'suspended') {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended. Please contact campus security or administration.'
      });
    }

    // Bind authenticated database user to req.user
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication processing.'
    });
  }
};

/**
 * Role-Based Access Control (RBAC) guard.
 * Checks req.user.role (strictly fetched from MongoDB) against allowed roles.
 * @param {...string} roles - Permitted user roles (e.g. 'admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required prior to role authorization.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
};

/**
 * Pre-validation middleware for student registration.
 * Enforces university email domain, minimum password length (>= 8 chars),
 * and strictly prevents client elevation to admin or privileged fields.
 */
const validateRegister = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a valid JSON object.'
    });
  }

  // 1. Strictly reject client-supplied role: public registration is student-only
  if (req.body.role !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'The role field cannot be specified during registration. All public accounts default to student.'
    });
  }

  // 2. Reject client-supplied privileged or internal fields
  const privilegedFields = ['status', '_id', 'id', 'passwordHash', 'hash', 'hashedPassword'];
  for (const field of privilegedFields) {
    if (req.body[field] !== undefined) {
      return res.status(400).json({
        success: false,
        message: `Privileged field '${field}' cannot be provided during registration.`
      });
    }
  }

  const { name, email, password, studentId, department, phone } = req.body;

  // 3. Required fields existence and type check
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'University email is required.' });
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Student ID is required.' });
  }

  // 4. Input lengths and normalization
  const cleanName = name.trim();
  if (cleanName.length < 2) {
    return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters long.' });
  }
  if (cleanName.length > 100) {
    return res.status(400).json({ success: false, message: 'Full name cannot exceed 100 characters.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length > 120) {
    return res.status(400).json({ success: false, message: 'Email cannot exceed 120 characters.' });
  }

  // Enforce exact @saiuniversity.edu.in domain
  const universityEmailRegex = /^[a-zA-Z0-9._%+-]+@saiuniversity\.edu\.in$/;
  if (!universityEmailRegex.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Registration is restricted to official university emails (@saiuniversity.edu.in).'
    });
  }

  // Enforce minimum 8 characters on original plaintext password
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long.'
    });
  }
  if (password.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'Password cannot exceed 128 characters.'
    });
  }

  const cleanStudentId = studentId.trim().toUpperCase();
  if (cleanStudentId.length < 3 || cleanStudentId.length > 30) {
    return res.status(400).json({
      success: false,
      message: 'Student ID must be between 3 and 30 characters.'
    });
  }

  // 5. Sanitize request body
  req.body.name = cleanName;
  req.body.email = cleanEmail;
  req.body.studentId = cleanStudentId;
  req.body.role = 'student'; // Always student for public registrations

  if (department && typeof department === 'string') {
    req.body.department = department.trim().substring(0, 120);
  }
  if (phone && typeof phone === 'string') {
    req.body.phone = phone.trim().substring(0, 30);
  }

  next();
};

/**
 * Pre-validation middleware for login requests.
 * Requires email and password presence, normalizes email,
 * and avoids leaking account existence or enforcing registration password rules.
 */
const validateLogin = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a valid JSON object.'
    });
  }

  const { email, password } = req.body;

  if (
    !email ||
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    !password ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.'
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Basic email structure check
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  req.body.email = cleanEmail;
  next();
};

module.exports = {
  protect,
  authorize,
  validateRegister,
  validateLogin
};
