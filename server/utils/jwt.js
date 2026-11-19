const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Utility — InSearch Sai University
 * Provides cryptographically signed JSON Web Token generation and verification.
 *
 * Requirements:
 * - Read JWT_SECRET and JWT_EXPIRES_IN strictly from environment variables.
 * - Minimum secret length requirement: 32+ characters for strong HMAC-SHA256 resistance.
 * - Explicitly enforce HS256 algorithm.
 * - Token subject ('sub') bound to the user's canonical MongoDB ObjectId string.
 * - Zero role trust inside token payload: authorization guards fetch live role from DB.
 * - Never log or expose secrets or token strings.
 */

/**
 * Validates and retrieves the JWT secret from environment variables.
 * @returns {string} Verified JWT secret key
 * @throws {Error} If JWT_SECRET is missing or insufficiently strong (< 32 chars)
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('JWT_SECRET environment variable is missing or undefined.');
  }

  if (secret.trim().length < 32) {
    throw new Error('JWT_SECRET is insufficiently strong. It must be at least 32 characters long.');
  }

  return secret;
}

/**
 * Signs and issues a new JWT access token for an authenticated user.
 * @param {Object|string} user - User document, object with _id/id, or MongoDB ObjectId string
 * @param {Object} [customOptions={}] - Optional overrides (e.g. custom expiresIn for testing)
 * @returns {string} Signed JWT token string
 * @throws {Error} If user MongoDB ID is missing or secret is invalid
 */
function generateToken(user, customOptions = {}) {
  const userId =
    user && (user._id ? user._id.toString() : user.id ? user.id.toString() : typeof user === 'string' ? user : null);

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('User MongoDB ID is required to generate a token');
  }

  const secret = getJwtSecret();
  const expiresIn = customOptions.expiresIn || process.env.JWT_EXPIRES_IN || '7d';

  // Token subject ('sub') holds the user's MongoDB ID.
  // Role is intentionally excluded: live authorization state must always be queried from MongoDB.
  const payload = {
    sub: userId,
    id: userId
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn
  });
}

/**
 * Verifies a JWT token's cryptographic signature, algorithm, and expiration.
 * @param {string} token - The raw JWT token string to verify
 * @returns {Object} Decoded token payload containing `sub` and `id`
 * @throws {Error} If token is missing, invalid, tampered, or expired
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    const error = new Error('Authentication token is required');
    error.name = 'TokenMissingError';
    throw error;
  }

  const secret = getJwtSecret();

  return jwt.verify(token, secret, {
    algorithms: ['HS256']
  });
}

module.exports = {
  generateToken,
  verifyToken,
  getJwtSecret
};
