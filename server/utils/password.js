const bcrypt = require('bcryptjs');

/**
 * Password Security Utility — InSearch Sai University
 * Provides cryptographically secure password hashing and comparison using bcryptjs.
 *
 * Requirements:
 * - 12 salt rounds for strong protection against rainbow tables and brute-force attacks.
 * - Zero logging of plaintext passwords or hashes.
 * - Strict rejection of missing, null, empty, or non-string inputs.
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcryptjs with 12 salt rounds.
 * @param {string} plainPassword - Plaintext password to hash
 * @returns {Promise<string>} 60-character bcrypt hash
 * @throws {Error} If input is missing or not a non-empty string
 */
async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Safely compares a plaintext password attempt against a stored bcrypt hash.
 * @param {string} plainPassword - Plaintext password attempt
 * @param {string} hashedPassword - Stored bcrypt hash
 * @returns {Promise<boolean>} True if match, false otherwise
 * @throws {Error} If either input is missing or not a non-empty string
 */
async function comparePassword(plainPassword, hashedPassword) {
  if (
    !plainPassword ||
    typeof plainPassword !== 'string' ||
    plainPassword.length === 0 ||
    !hashedPassword ||
    typeof hashedPassword !== 'string' ||
    hashedPassword.length === 0
  ) {
    throw new Error('Invalid input: plainPassword and hashedPassword must be non-empty strings');
  }

  return await bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = {
  hashPassword,
  comparePassword,
  SALT_ROUNDS
};
