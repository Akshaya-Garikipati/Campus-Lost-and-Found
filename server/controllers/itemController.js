const mongoose = require('mongoose');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const { escapeRegex } = require('../utils/sanitize');
const { formatItemResponse, getCategoryFallbackImage } = require('../utils/urlHelper');

/**
 * Item Controller — InSearch Sai University Lost & Found Portal
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
 * @route   GET /api/items
 * @desc    Get paginated items with 5-field search, filters, sorting, and lightweight image URLs
 * @access  Public
 */
const getItems = async (req, res) => {
  try {
    const { q, type, status, category, location, sort, page, limit } = req.query;

    const query = {};

    // 1. Type Filter ('lost' | 'found')
    if (type && type !== 'all') {
      query.type = type.trim().toLowerCase();
    }

    // 2. Status Filter ('open' | 'claimed' | 'recovered')
    if (status && status !== 'all') {
      query.status = status.trim().toLowerCase();
    }

    // 3. Category Filter
    if (category && category !== 'all') {
      query.category = category.trim();
    }

    // 4. Campus Location Filter
    if (location && location !== 'all') {
      query.location = location.trim();
    }

    // 5. Keyword Search across 5 fields (title, description, specificLocation, category, location)
    if (q && q.trim().length > 0) {
      const safeQ = escapeRegex(q.trim());
      const searchRegex = new RegExp(safeQ, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { specificLocation: searchRegex },
        { category: searchRegex },
        { location: searchRegex }
      ];
    }

    // 6. Sorting
    let sortOptions = { createdAt: -1 }; // Default: newest first
    if (sort) {
      switch (sort.trim().toLowerCase()) {
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'name-asc':
          sortOptions = { title: 1 };
          break;
        case 'name-desc':
          sortOptions = { title: -1 };
          break;
        case 'date-desc':
          sortOptions = { date: -1 };
          break;
        case 'date-asc':
          sortOptions = { date: 1 };
          break;
        case 'newest':
        default:
          sortOptions = { createdAt: -1 };
          break;
      }
    }

    // 7. Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const total = await Item.countDocuments(query);
    const itemDocs = await Item.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('reportedBy', 'name department avatar');

    const sanitizedItems = itemDocs.map(doc => formatItemResponse(req, doc));

    return res.status(200).json({
      success: true,
      count: sanitizedItems.length,
      total,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      data: sanitizedItems
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve items.',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/items/:id
 * @desc    Get detailed item record with location suggestions timeline and sanitized reporter
 * @access  Public
 */
const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format.'
      });
    }

    const item = await Item.findById(id)
      .populate('reportedBy', 'name department avatar')
      .populate('locationSuggestions.suggestedByUser', 'name');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in campus directory.'
      });
    }

    const includeRaw = req.query.includeRawImage === 'true';
    return res.status(200).json({
      success: true,
      data: formatItemResponse(req, item, includeRaw)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve item details.',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/items/:id/image
 * @desc    Binary image delivery endpoint with caching, ETag, and fallback redirects
 * @access  Public
 */
const getItemImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format.'
      });
    }

    const item = await Item.findById(id).select('image category updatedAt');
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found.'
      });
    }

    // 1. External HTTP(S) URL -> Issue 302 redirect
    if (item.image && /^https?:\/\//i.test(item.image)) {
      return res.redirect(302, item.image);
    }

    // 2. Base64 Data URI -> Parse and stream binary buffer
    if (item.image && /^data:image\//i.test(item.image)) {
      const match = item.image.match(/^data:(image\/(jpeg|png|webp|gif|jpg));base64,([A-Za-z0-9+/=\s]+)$/i);
      if (match) {
        let mimeType = match[1].toLowerCase();
        if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
        const base64Data = match[3].replace(/\s/g, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // ETag computed from item ID and last modification timestamp
        const version = item.updatedAt ? new Date(item.updatedAt).getTime() : '0';
        const etag = `W/"${item._id.toString()}-${version}"`;

        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }

        res.set({
          'Content-Type': mimeType,
          'Content-Length': imageBuffer.length,
          'ETag': etag,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600'
        });

        return res.end(imageBuffer);
      }
    }

    // 3. Fallback for missing/corrupted image -> Redirect to category default without immutable cache
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    const fallbackUrl = getCategoryFallbackImage(item.category);
    return res.redirect(302, fallbackUrl);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to deliver item photograph.',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/items
 * @desc    Report a new lost or found item (requires authentication & compulsory photo)
 * @access  Private (protect)
 */
const createItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      status: 'open',
      reportedBy: req.user._id,
      locationSuggestions: []
    };

    const newItem = await Item.create(itemData);
    await newItem.populate('reportedBy', 'name department avatar');

    return res.status(201).json({
      success: true,
      message: 'Item report published successfully to campus directory.',
      data: formatItemResponse(req, newItem)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create item report.',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/items/:id
 * @desc    Update item details (Owner or Admin only, excludes status)
 * @access  Private (protect)
 */
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format.'
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in campus directory.'
      });
    }

    // Authorization: Owner or Admin
    const isOwner = item.reportedBy && item.reportedBy.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to edit this listing.'
      });
    }

    // Apply allowed updates
    const allowedFields = ['title', 'category', 'location', 'specificLocation', 'date', 'description', 'image'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    });

    await item.save();
    await item.populate('reportedBy', 'name department avatar');

    return res.status(200).json({
      success: true,
      message: 'Item listing updated successfully.',
      data: formatItemResponse(req, item)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update item listing.',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/items/:id/status
 * @desc    Dedicated item status transitions (Owner or Admin only)
 * @access  Private (protect)
 */
const updateItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format.'
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in campus directory.'
      });
    }

    const isOwner = item.reportedBy && item.reportedBy.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to update status for this item.'
      });
    }

    // Non-admin student restrictions:
    // Students can only mark their own items 'recovered' or 'open'
    if (!isAdmin) {
      if (newStatus === 'claimed') {
        return res.status(403).json({
          success: false,
          message: 'Students cannot set status to claimed. Custody claims are managed by Campus Security.'
        });
      }
    }

    // Desynchronization Invariant Check:
    // Prevent transitioning away from 'claimed', or reopening an item ('open'), if active pending or approved claims exist
    if (newStatus === 'open' || (item.status === 'claimed' && newStatus !== 'claimed')) {
      const activeClaimsCount = await Claim.countDocuments({
        item: item._id,
        status: { $in: ['pending', 'approved'] }
      });

      if (activeClaimsCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Cannot change item status: active pending or approved claims are associated with this listing. Review and resolve claims in the Claims Console first.'
        });
      }
    }

    item.status = newStatus;
    await item.save();
    await item.populate('reportedBy', 'name department avatar');

    return res.status(200).json({
      success: true,
      message: `Item status updated to ${newStatus.toUpperCase()}.`,
      data: formatItemResponse(req, item)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update item status.',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/items/:id
 * @desc    Concurrency-safe item deletion protected by active claims check
 * @access  Private (protect)
 */
const deleteItem = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid item ID format.'
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
    await session.withTransaction(async () => {
      // 1. Initial existence and authorization check
      const item = await Item.findById(id).session(session);
      if (!item) {
        throw createBusinessError('Item not found in campus directory.', 404);
      }

      const isOwner = item.reportedBy && item.reportedBy.equals(req.user._id);
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        throw createBusinessError('Forbidden. You are not authorized to delete this listing.', 403);
      }

      // 2. Perform conditional write against the Item document to assert write exclusivity
      // If status is 'claimed', block deletion
      const lockedItem = await Item.findOneAndUpdate(
        { _id: id, status: { $ne: 'claimed' } },
        { $set: { updatedAt: new Date() } },
        { session, new: true }
      );

      if (!lockedItem) {
        throw createBusinessError('Cannot delete item: listing is currently under custody claim status.', 409);
      }

      // 3. Check for any active ('pending' or 'approved') claims
      const activeClaimsCount = await Claim.countDocuments({
        item: id,
        status: { $in: ['pending', 'approved'] }
      }).session(session);

      if (activeClaimsCount > 0) {
        throw createBusinessError('Cannot delete listing: active or approved ownership claims are associated with it.', 409);
      }

      // 4. Safe deletion: remove Item and decouple notification references
      await Item.deleteOne({ _id: id }).session(session);
      await Notification.updateMany({ relatedItem: id }, { $set: { relatedItem: null } }).session(session);
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return res.status(200).json({
      success: true,
      message: 'Item listing deleted successfully from campus directory.'
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
      message: 'Failed to delete item listing.',
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * @route   POST /api/items/:id/locations
 * @desc    Submit a community location suggestion for an item
 * @access  Private (protect)
 */
const suggestLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { newLocation, specificSpot, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format.'
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in campus directory.'
      });
    }

    const suggestion = {
      newLocation,
      specificSpot: specificSpot || '',
      note: note || '',
      suggestedBy: req.user.name || 'Fellow Student',
      suggestedByUser: req.user._id,
      status: 'pending',
      createdAt: new Date()
    };

    item.locationSuggestions.unshift(suggestion);
    await item.save();

    return res.status(201).json({
      success: true,
      message: 'Location update suggestion recorded successfully.',
      data: item.locationSuggestions[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to record location suggestion.',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/items/:id/locations/:suggestionId
 * @desc    Verify or decline a community location suggestion (Owner or Admin only)
 * @access  Private (protect)
 */
const reviewLocationSuggestion = async (req, res) => {
  try {
    const { id, suggestionId } = req.params;
    const { status: reviewDecision } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(suggestionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item or suggestion ID format.'
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in campus directory.'
      });
    }

    // Authorization: Owner or Admin
    const isOwner = item.reportedBy && item.reportedBy.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only the original reporter or Campus Security can verify location updates.'
      });
    }

    const suggestion = item.locationSuggestions.id(suggestionId);
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Location suggestion not found on this item.'
      });
    }

    if (reviewDecision === 'verified') {
      // Apply location move and record previousLocation
      item.previousLocation = item.location;
      item.location = suggestion.newLocation;
      if (suggestion.specificSpot) {
        item.specificLocation = suggestion.specificSpot;
      }
      suggestion.status = 'verified';
    } else {
      suggestion.status = 'declined';
    }

    await item.save();
    await item.populate('reportedBy', 'name department avatar');
    await item.populate('locationSuggestions.suggestedByUser', 'name');

    return res.status(200).json({
      success: true,
      message: `Location suggestion marked as ${reviewDecision}.`,
      data: formatItemResponse(req, item)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to review location suggestion.',
      error: error.message
    });
  }
};

module.exports = {
  getItems,
  getItemById,
  getItemImage,
  createItem,
  updateItem,
  updateItemStatus,
  deleteItem,
  suggestLocation,
  reviewLocationSuggestion
};
