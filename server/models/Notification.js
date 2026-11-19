const mongoose = require('mongoose');

/**
 * Notification Model Schema — InSearch Sai University
 * Represents notifications delivered to students and staff regarding claims,
 * status updates, matches, or admin announcements.
 *
 * FRONTEND COMPATIBILITY:
 * The frontend (js/sample-data.js, js/state.js, and js/app.js) accesses `n.userId`
 * and `n.timestamp`. Virtual aliases `userId` and `timestamp` are configured to serialize
 * directly into JSON to ensure existing drawer filtering and date rendering work seamlessly.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user reference is required']
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1500, 'Message cannot exceed 1500 characters']
    },
    type: {
      type: String,
      enum: {
        values: ['info', 'success', 'warning', 'error'],
        message: '{VALUE} is not a valid notification type. Allowed: info, success, warning, error'
      },
      default: 'info'
    },
    read: {
      type: Boolean,
      default: false
    },
    relatedItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null
    },
    relatedClaim: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Claim',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual Aliases for Frontend Backward Compatibility
notificationSchema.virtual('userId').get(function () {
  return this.recipient
    ? (this.recipient._id ? this.recipient._id.toString() : this.recipient.toString())
    : undefined;
});

notificationSchema.virtual('timestamp')
  .get(function () {
    const ts = this.createdAt || this._timestamp;
    return ts ? (ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString()) : new Date().toISOString();
  })
  .set(function (val) {
    this._timestamp = val;
    this.createdAt = new Date(val);
  });

// Indexes
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
