const express = require('express');
const router = express.Router();

const claimController = require('../controllers/claimController');
const { protect, authorize } = require('../middleware/auth');
const {
  validateCreateClaim,
  validateClaimQuery,
  validateReviewClaim
} = require('../middleware/claimValidation');

/**
 * Claim Routes — InSearch Sai University
 */

// Student claim creation
router.post('/', protect, validateCreateClaim, claimController.createClaim);

// List claims (Students see only own; Admins see all)
router.get('/', protect, validateClaimQuery, claimController.getClaims);

// Single claim details (Claimant or Admin only)
router.get('/:id', protect, claimController.getClaimById);

// Admin claim review endpoints
router.patch('/:id/approve', protect, authorize('admin'), validateReviewClaim, claimController.approveClaim);
router.patch('/:id/reject', protect, authorize('admin'), validateReviewClaim, claimController.rejectClaim);

module.exports = router;
