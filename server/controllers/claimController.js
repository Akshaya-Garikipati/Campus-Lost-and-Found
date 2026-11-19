const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const Notification = require('../models/Notification');

/**
 * Claim Controller — InSearch Sai University Lost & Found Portal
 */

/**
 * Helper to construct standardized business errors inside transactions
 */
function createBusinessError(message, statusCode = 400) {
  const err = new Error(message);
  err.isBusinessError = true;
  err.statusCode = statusCode;
  return err;
}

/**
 * @route   POST /api/claims
 * @desc    Submit an ownership claim for a found item (Student only)
 * @access  Private (protect, Student role)
 */
const createClaim = async (req, res) => {
  // Authorization guard: Student role only
  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Claims can only be submitted by student accounts.'
    });
  }

  const { itemId, proofDescription, phone } = req.body;

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Transaction error: Multi-document ACID transactions require a MongoDB replica set.'
    });
  }

  try {
    let createdClaim = null;

    await session.withTransaction(async () => {
      // 1. Conditional Item write (Write Lock acquisition)
      // Uses { new: false } to inspect pre-update document status
      const originalItem = await Item.findOneAndUpdate(
        { _id: itemId, status: { $in: ['open', 'claimed'] }, type: 'found' },
        { $set: { status: 'claimed', updatedAt: new Date() } },
        { session, new: false }
      );

      if (!originalItem) {
        // Inspect reason for match failure
        const existingItem = await Item.findById(itemId).session(session);
        if (!existingItem) {
          throw createBusinessError('Item not found in campus directory.', 404);
        }
        if (existingItem.type !== 'found') {
          throw createBusinessError('Only found items can be claimed. Lost item reports cannot be claimed.', 400);
        }
        if (existingItem.status === 'recovered') {
          throw createBusinessError('This item has already been marked as recovered and is no longer available for claims.', 409);
        }
        throw createBusinessError('Item is not available for claims.', 409);
      }

      // 2. Custody-Hold Check using original pre-update status
      if (originalItem.status === 'claimed') {
        const pendingClaimsCount = await Claim.countDocuments({
          item: itemId,
          status: 'pending'
        }).session(session);

        // An administrative custody hold with 0 pending claims cannot be claimed
        if (pendingClaimsCount === 0) {
          throw createBusinessError(
            'This item is currently under administrative custody hold and is not open for public claims. Please coordinate with the university\'s designated collection authority.',
            409
          );
        }
      }

      // 3. Post-Lock Duplicate Active-Claim Check
      const existingClaim = await Claim.findOne({
        item: itemId,
        claimant: req.user._id,
        status: { $in: ['pending', 'approved'] }
      }).session(session);

      if (existingClaim) {
        throw createBusinessError('You already have an active or approved claim for this item.', 409);
      }

      // 4. Insert Claim Document
      const claimantPhone = phone || req.user.phone || '';
      const newClaimDocs = await Claim.create([{
        item: itemId,
        itemTitle: originalItem.title,
        claimant: req.user._id,
        claimantName: req.user.name,
        claimantEmail: req.user.email,
        claimantPhone,
        proofDescription,
        status: 'pending',
        submittedAt: new Date()
      }], { session });

      createdClaim = newClaimDocs[0];

      // 5. Insert Reporter Notification within transaction
      if (originalItem.reportedBy && !originalItem.reportedBy.equals(req.user._id)) {
        await Notification.create([{
          recipient: originalItem.reportedBy,
          title: 'New Claim Submitted',
          message: `${req.user.name} filed an ownership claim for '${originalItem.title}'. Pending verification.`,
          type: 'info',
          relatedItem: itemId,
          relatedClaim: createdClaim._id
        }], { session });
      }
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return res.status(201).json({
      success: true,
      message: 'Ownership claim submitted successfully. The university\'s designated collection authority will verify your proof.',
      data: createdClaim
    });
  } catch (error) {
    if (error.isBusinessError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message && error.message.includes('Transaction numbers are only allowed on a replica set')) {
      return res.status(500).json({
        success: false,
        message: 'Transaction error: Multi-document ACID transactions require a MongoDB replica set.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to process claim submission.',
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * @route   GET /api/claims
 * @desc    Retrieve claims with role-based visibility (Students: own claims; Admins: all claims)
 * @access  Private (protect)
 */
const getClaims = async (req, res) => {
  try {
    const { status, itemId, claimantId, sort, page, limit } = req.query;
    const query = {};

    // Role-based scoping:
    // Students can ONLY view claims they filed
    if (req.user.role === 'student') {
      query.claimant = req.user._id;
    } else if (req.user.role === 'admin') {
      // Admins may optionally filter by claimantId
      if (claimantId && claimantId !== 'all') {
        query.claimant = claimantId;
      }
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status.trim().toLowerCase();
    }

    // Item ID filter
    if (itemId && itemId !== 'all') {
      query.item = itemId;
    }

    // Sort options
    let sortOptions = { submittedAt: -1 }; // Default newest first
    if (sort && sort.trim().toLowerCase() === 'oldest') {
      sortOptions = { submittedAt: 1 };
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('item', 'title type category location specificLocation status image date');

    return res.status(200).json({
      success: true,
      count: claims.length,
      total,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      data: claims
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve claims.',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/claims/:id
 * @desc    Retrieve single claim details (Claimant or Admin only)
 * @access  Private (protect)
 */
const getClaimById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid claim ID format.'
      });
    }

    const claim = await Claim.findById(id)
      .populate('item', 'title type category location specificLocation status image date');

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found.'
      });
    }

    // Authorization: Claimant or Admin
    const isClaimant = claim.claimant && claim.claimant.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isClaimant && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to view this claim.'
      });
    }

    return res.status(200).json({
      success: true,
      data: claim
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve claim details.',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/claims/:id/approve
 * @desc    Approve a pending claim, mark item recovered, reject competing claims (Admin only)
 * @access  Private (protect, Admin role)
 */
const approveClaim = async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid claim ID format.'
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Transaction error: Multi-document ACID transactions require a MongoDB replica set.'
    });
  }

  try {
    let approvedClaim = null;

    await session.withTransaction(async () => {
      // 1. Conditionally lock and update target claim (must be pending)
      const claim = await Claim.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: 'approved',
            reviewedAt: new Date(),
            reviewedBy: req.user._id,
            adminNotes: adminNotes || 'Verified ownership proof. Item is ready for physical collection from the designated university collection authority.'
          }
        },
        { session, new: true }
      );

      if (!claim) {
        const existingClaim = await Claim.findById(id).session(session);
        if (!existingClaim) {
          throw createBusinessError('Claim not found.', 404);
        }
        throw createBusinessError('Claim is not in pending status or has already been reviewed.', 409);
      }

      // 2. Conditionally lock and update parent Item (must be open or claimed)
      const item = await Item.findOneAndUpdate(
        { _id: claim.item, status: { $in: ['open', 'claimed'] } },
        { $set: { status: 'recovered', updatedAt: new Date() } },
        { session, new: true }
      );

      if (!item) {
        throw createBusinessError('Cannot approve claim: item is already marked as recovered or unavailable.', 409);
      }

      // 3. Atomically close all competing pending claims for the same item
      const competingClaims = await Claim.find({
        item: claim.item,
        _id: { $ne: claim._id },
        status: 'pending'
      }).session(session);

      for (const compClaim of competingClaims) {
        compClaim.status = 'rejected';
        compClaim.reviewedAt = new Date();
        compClaim.reviewedBy = req.user._id;
        compClaim.adminNotes = 'Claim closed: item awarded to another claimant with verified proof.';
        await compClaim.save({ session });

        // Notification for competing claimant
        await Notification.create([{
          recipient: compClaim.claimant,
          title: 'Claim Closed',
          message: `Your claim for '${claim.itemTitle}' was closed because the item was awarded to another claimant with verified proof.`,
          type: 'info',
          relatedItem: claim.item,
          relatedClaim: compClaim._id
        }], { session });
      }

      // 4. Notification for approved claimant
      await Notification.create([{
        recipient: claim.claimant,
        title: 'Claim Approved! 🎉',
        message: `Your claim for '${claim.itemTitle}' was approved. Please coordinate with the university's designated collection authority for physical collection.`,
        type: 'success',
        relatedItem: claim.item,
        relatedClaim: claim._id
      }], { session });

      approvedClaim = claim;
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return res.status(200).json({
      success: true,
      message: 'Claim approved successfully. Item marked as recovered and competing claims closed.',
      data: approvedClaim
    });
  } catch (error) {
    if (error.isBusinessError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message && error.message.includes('Transaction numbers are only allowed on a replica set')) {
      return res.status(500).json({
        success: false,
        message: 'Transaction error: Multi-document ACID transactions require a MongoDB replica set.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to approve claim.',
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * @route   PATCH /api/claims/:id/reject
 * @desc    Reject a pending claim, revert item to open if no pending claims remain (Admin only)
 * @access  Private (protect, Admin role)
 */
const rejectClaim = async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid claim ID format.'
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Transaction error: Multi-document ACID transactions require a MongoDB replica set.'
    });
  }

  try {
    let rejectedClaim = null;

    await session.withTransaction(async () => {
      // 1. Conditionally lock and update target claim (must be pending)
      const claim = await Claim.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedBy: req.user._id,
            adminNotes: adminNotes || 'Details could not be verified.'
          }
        },
        { session, new: true }
      );

      if (!claim) {
        const existingClaim = await Claim.findById(id).session(session);
        if (!existingClaim) {
          throw createBusinessError('Claim not found.', 404);
        }
        throw createBusinessError('Claim is not in pending status or has already been reviewed.', 409);
      }

      // 2. Perform atomic write on Item document (takes write lock)
      await Item.updateOne(
        { _id: claim.item },
        { $set: { updatedAt: new Date() } },
        { session }
      );

      // 3. Recalculate remaining pending claims for this item
      const remainingPending = await Claim.countDocuments({
        item: claim.item,
        _id: { $ne: claim._id },
        status: 'pending'
      }).session(session);

      if (remainingPending === 0) {
        // Revert item back to open
        await Item.updateOne(
          { _id: claim.item },
          { $set: { status: 'open' } },
          { session }
        );
      } else {
        // Retain claimed status as competing claims remain
        await Item.updateOne(
          { _id: claim.item },
          { $set: { status: 'claimed' } },
          { session }
        );
      }

      // 4. Notification for rejected claimant
      await Notification.create([{
        recipient: claim.claimant,
        title: 'Claim Update',
        message: `Your claim for '${claim.itemTitle}' was reviewed: ${claim.adminNotes}`,
        type: 'warning',
        relatedItem: claim.item,
        relatedClaim: claim._id
      }], { session });

      rejectedClaim = claim;
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return res.status(200).json({
      success: true,
      message: 'Claim rejected successfully.',
      data: rejectedClaim
    });
  } catch (error) {
    if (error.isBusinessError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message && error.message.includes('Transaction numbers are only allowed on a replica set')) {
      return res.status(500).json({
        success: false,
        message: 'Transaction error: Multi-document ACID transactions require a MongoDB replica set.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to reject claim.',
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  createClaim,
  getClaims,
  getClaimById,
  approveClaim,
  rejectClaim
};
