/**
 * Sanitization & Injection Defense Utilities — InSearch Sai University
 */

/**
 * Escapes all regular expression metacharacters in a string to enable literal matching.
 * Tested against: . * + ? ^ $ { } ( ) | [ ] \ /
 * 
 * @param {string} text - User input string to escape
 * @returns {string} Safe literal string for RegExp construction
 */
function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates and sanitizes a string query parameter, rejecting nested objects (operator injection).
 * @param {*} value - Query parameter value
 * @param {number} maxLength - Maximum allowable string length
 * @returns {string|null} Sanitized trimmed string or null if invalid
 */
function sanitizeString(value, maxLength = 100) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) return null;
  return trimmed;
}

module.exports = {
  escapeRegex,
  sanitizeString
};
