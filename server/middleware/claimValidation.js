const mongoose = require('mongoose');

/**
 * Claim Request Validation Middleware — InSearch Sai University
 */

const VALID_CLAIM_STATUSES = ['pending', 'approved', 'rejected'];
const VALID_CLAIM_SORTS = ['newest', 'oldest'];

/**
 * Pre-validation for creating a claim (POST /api/claims)
 */
const validateCreateClaim = (req, res, next) => {
  const { itemId, proofDescription, phone } = req.body;
  const errors = [];

  // 1. Validate itemId
  if (!itemId || typeof itemId !== 'string' || !mongoose.Types.ObjectId.isValid(itemId.trim())) {
    errors.push('A valid item ID is required.');
  }

  // 2. Validate proofDescription
  if (
    !proofDescription ||
    typeof proofDescription !== 'string' ||
    proofDescription.trim().length < 5 ||
    proofDescription.trim().length > 3000
  ) {
    errors.push('Proof of ownership description is required and must be between 5 and 3000 characters.');
  }

  // 3. Validate phone (optional)
  if (phone !== undefined && phone !== null) {
    if (typeof phone !== 'string' || phone.trim().length > 30) {
      errors.push('Phone number cannot exceed 30 characters.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for claim submission.',
      errors
    });
  }

  // Sanitize and normalize request body
  req.body.itemId = itemId.trim();
  req.body.proofDescription = proofDescription.trim();
  req.body.phone = phone ? phone.trim() : '';

  // Strictly strip privileged / client-supplied identity & state fields
  delete req.body.claimant;
  delete req.body.claimantId;
  delete req.body.claimantName;
  delete req.body.claimantEmail;
  delete req.body.status;
  delete req.body.adminNotes;
  delete req.body.submittedAt;
  delete req.body.reviewedAt;
  delete req.body.reviewedBy;

  next();
};

/**
 * Pre-validation for querying claims (GET /api/claims)
 */
const validateClaimQuery = (req, res, next) => {
  const { status, itemId, claimantId, sort, page, limit } = req.query;
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

  // Status filter
  if (status !== undefined && status !== 'all') {
    if (typeof status !== 'string' || !VALID_CLAIM_STATUSES.includes(status.trim().toLowerCase())) {
      errors.push(`Invalid claim status filter. Allowed: ${VALID_CLAIM_STATUSES.join(', ')}.`);
    }
  }

  // Item ID filter
  if (itemId !== undefined && itemId !== 'all') {
    if (typeof itemId !== 'string' || !mongoose.Types.ObjectId.isValid(itemId.trim())) {
      errors.push('Invalid item ID filter format.');
    }
  }

  // Claimant ID filter
  if (claimantId !== undefined && claimantId !== 'all') {
    if (typeof claimantId !== 'string' || !mongoose.Types.ObjectId.isValid(claimantId.trim())) {
      errors.push('Invalid claimant ID filter format.');
    }
  }

  // Sort parameter
  if (sort !== undefined) {
    if (typeof sort !== 'string' || !VALID_CLAIM_SORTS.includes(sort.trim().toLowerCase())) {
      errors.push(`Invalid sort option. Allowed: ${VALID_CLAIM_SORTS.join(', ')}.`);
    }
  }

  // Page parameter
  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push("Pagination 'page' must be a positive integer greater than or equal to 1.");
    }
  }

  // Limit parameter
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push("Pagination 'limit' must be an integer between 1 and 50.");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid claim query parameters.',
      errors
    });
  }

  next();
};

/**
 * Pre-validation for reviewing a claim (PATCH /api/claims/:id/approve or reject)
 */
const validateReviewClaim = (req, res, next) => {
  const { adminNotes } = req.body;
  const errors = [];

  if (adminNotes !== undefined && adminNotes !== null) {
    if (typeof adminNotes !== 'string' || adminNotes.trim().length > 2000) {
      errors.push('Administrative notes cannot exceed 2000 characters.');
    } else {
      req.body.adminNotes = adminNotes.trim();
    }
  } else {
    req.body.adminNotes = '';
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for claim review.',
      errors
    });
  }

  next();
};

module.exports = {
  VALID_CLAIM_STATUSES,
  VALID_CLAIM_SORTS,
  validateCreateClaim,
  validateClaimQuery,
  validateReviewClaim
};
