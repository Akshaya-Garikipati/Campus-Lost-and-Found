const mongoose = require('mongoose');

/**
 * Claim Model Schema — InSearch Sai University
 * Represents an ownership claim submitted by a student for a found/reported item.
 *
 * FRONTEND COMPATIBILITY & CACHED METADATA:
 * The frontend (js/admin.js and js/app.js) accesses `claim.itemId` and `claim.claimantId`.
 * Virtual aliases `itemId` and `claimantId` are exposed to serialize directly into JSON.
 *
 * Historical snapshots (`claimantName`, `claimantEmail`, `claimantPhone`, `itemTitle`)
 * are preserved for permanent audit records. In future Phase 4/5 API controllers,
 * current live item details should also be populated from the `item` reference during
 * administrative review to cross-check against any post-report modifications.
 */
const claimSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item reference is required']
    },
    itemTitle: {
      type: String,
      trim: true,
      default: ''
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Claimant user reference is required']
    },
    claimantName: {
      type: String,
      trim: true,
      default: ''
    },
    claimantEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    claimantPhone: {
      type: String,
      trim: true,
      default: ''
    },
    proofDescription: {
      type: String,
      required: [true, 'Proof description and verification details are required'],
      trim: true,
      minlength: [5, 'Proof description must be at least 5 characters'],
      maxlength: [3000, 'Proof description cannot exceed 3000 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid claim status. Allowed: pending, approved, rejected'
      },
      default: 'pending'
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters']
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual Aliases for 100% Frontend Backward Compatibility
claimSchema.virtual('itemId').get(function () {
  return this.item ? (this.item._id ? this.item._id.toString() : this.item.toString()) : undefined;
});

claimSchema.virtual('claimantId').get(function () {
  return this.claimant
    ? (this.claimant._id ? this.claimant._id.toString() : this.claimant.toString())
    : undefined;
});

// Indexes
claimSchema.index({ item: 1 });
claimSchema.index({ claimant: 1 });
claimSchema.index({ status: 1 });
claimSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Claim || mongoose.model('Claim', claimSchema);
