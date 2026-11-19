/**
 * Item Request Validation Middleware — InSearch Sai University
 */

const VALID_CATEGORIES = [
  'Electronics',
  'ID Cards & Keys',
  'Wallets & Bags',
  'Books & Stationery',
  'Clothing & Footwear',
  'Personal Accessories',
  'Others'
];

const VALID_LOCATIONS = [
  'Admin Block',
  'Academic Block A',
  'Academic Block B',
  'Central Library',
  'Student Cafeteria',
  'Sports Complex',
  'Hostels',
  'Innovation Lab'
];

const VALID_TYPES = ['lost', 'found'];
const VALID_STATUSES = ['open', 'claimed', 'recovered'];
const VALID_SORTS = ['newest', 'oldest', 'name-asc', 'name-desc', 'date-desc', 'date-asc'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates an image string (URL or Base64 URI)
 * @param {string} imageStr 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateImagePayload(imageStr) {
  if (!imageStr || typeof imageStr !== 'string') {
    return { valid: false, error: 'A photograph of the item is required for verification.' };
  }

  const trimmed = imageStr.trim();

  // 1. External HTTP(S) URL
  if (/^https?:\/\/.+/i.test(trimmed)) {
    return { valid: true };
  }

  // 2. Base64 Image Data URI
  const base64Match = trimmed.match(/^data:(image\/(jpeg|png|webp|gif|jpg));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!base64Match) {
    return {
      valid: false,
      error: 'Item photograph must be a valid HTTP(S) URL or Base64 image data URI (JPG, PNG, WebP, GIF).'
    };
  }

  const base64Data = base64Match[3].replace(/\s/g, '');
  // Estimate decoded byte length
  const decodedBytes = Math.floor((base64Data.length * 3) / 4);

  if (decodedBytes > MAX_IMAGE_BYTES) {
    return { valid: false, error: 'Photograph exceeds the maximum allowed file size of 5MB.' };
  }

  return { valid: true };
}

/**
 * Pre-validation middleware for creating an item (POST /api/items)
 */
const validateCreateItem = (req, res, next) => {
  const { title, type, category, location, specificLocation, date, description, image } = req.body;
  const errors = [];

  // Title
  if (!title || typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 150) {
    errors.push('Title is required and must be between 2 and 150 characters.');
  }

  // Type
  const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
  if (!normalizedType || !VALID_TYPES.includes(normalizedType)) {
    errors.push(`Report type must be either 'lost' or 'found'. Received: '${type}'`);
  }

  // Category
  const normalizedCat = typeof category === 'string' ? category.trim() : '';
  if (!normalizedCat || !VALID_CATEGORIES.includes(normalizedCat)) {
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
  }

  // Location
  const normalizedLoc = typeof location === 'string' ? location.trim() : '';
  if (!normalizedLoc || !VALID_LOCATIONS.includes(normalizedLoc)) {
    errors.push(`Location must be one of: ${VALID_LOCATIONS.join(', ')}.`);
  }

  // Specific Location (optional)
  if (specificLocation && (typeof specificLocation !== 'string' || specificLocation.trim().length > 200)) {
    errors.push('Specific spot/location cannot exceed 200 characters.');
  }

  // Date
  if (!date || isNaN(new Date(date).getTime())) {
    errors.push('A valid date of occurrence is required.');
  }

  // Description
  if (!description || typeof description !== 'string' || description.trim().length < 5 || description.trim().length > 3000) {
    errors.push('Description is required and must be between 5 and 3000 characters.');
  }

  // Image (Compulsory)
  const imageCheck = validateImagePayload(image);
  if (!imageCheck.valid) {
    errors.push(imageCheck.error);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for item report.',
      errors
    });
  }

  // Sanitize and normalize request body
  req.body.title = title.trim();
  req.body.type = normalizedType;
  req.body.category = normalizedCat;
  req.body.location = normalizedLoc;
  req.body.specificLocation = specificLocation ? specificLocation.trim() : '';
  req.body.date = new Date(date);
  req.body.description = description.trim();
  req.body.image = image.trim();

  // Strip client-submitted status, reportedBy, locationSuggestions
  delete req.body.status;
  delete req.body.reportedBy;
  delete req.body.locationSuggestions;
  delete req.body.previousLocation;

  next();
};

/**
 * Pre-validation middleware for updating an item (PUT /api/items/:id)
 * Strictly disallows modifying status or reportedBy
 */
const validateUpdateItem = (req, res, next) => {
  const { title, category, location, specificLocation, date, description, image } = req.body;
  const errors = [];

  // Title
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 150) {
      errors.push('Title must be between 2 and 150 characters.');
    } else {
      req.body.title = title.trim();
    }
  }

  // Category
  if (category !== undefined) {
    const norm = typeof category === 'string' ? category.trim() : '';
    if (!VALID_CATEGORIES.includes(norm)) {
      errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
    } else {
      req.body.category = norm;
    }
  }

  // Location
  if (location !== undefined) {
    const norm = typeof location === 'string' ? location.trim() : '';
    if (!VALID_LOCATIONS.includes(norm)) {
      errors.push(`Location must be one of: ${VALID_LOCATIONS.join(', ')}.`);
    } else {
      req.body.location = norm;
    }
  }

  // Specific Location
  if (specificLocation !== undefined) {
    if (typeof specificLocation !== 'string' || specificLocation.trim().length > 200) {
      errors.push('Specific spot/location cannot exceed 200 characters.');
    } else {
      req.body.specificLocation = specificLocation.trim();
    }
  }

  // Date
  if (date !== undefined) {
    if (isNaN(new Date(date).getTime())) {
      errors.push('Date must be a valid date.');
    } else {
      req.body.date = new Date(date);
    }
  }

  // Description
  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim().length < 5 || description.trim().length > 3000) {
      errors.push('Description must be between 5 and 3000 characters.');
    } else {
      req.body.description = description.trim();
    }
  }

  // Image
  if (image !== undefined) {
    const imageCheck = validateImagePayload(image);
    if (!imageCheck.valid) {
      errors.push(imageCheck.error);
    } else {
      req.body.image = image.trim();
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for item update.',
      errors
    });
  }

  // Strictly strip immutable or privileged fields
  delete req.body.status;
  delete req.body.type;
  delete req.body.reportedBy;
  delete req.body.locationSuggestions;
  delete req.body.previousLocation;

  next();
};

/**
 * Pre-validation for status transitions (PATCH /api/items/:id/status)
 */
const validateStatusTransition = (req, res, next) => {
  const { status } = req.body;

  if (!status || typeof status !== 'string' || !VALID_STATUSES.includes(status.trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid item status. Allowed: ${VALID_STATUSES.join(', ')}.`
    });
  }

  req.body.status = status.trim().toLowerCase();
  next();
};

/**
 * Pre-validation for item listing query parameters (GET /api/items)
 */
const validateQueryItems = (req, res, next) => {
  const { q, type, status, category, location, sort, page, limit } = req.query;
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

  // Search keyword 'q'
  if (q !== undefined) {
    if (typeof q !== 'string') {
      errors.push("Search query 'q' must be a string.");
    } else if (q.length > 100) {
      errors.push('Search query exceeds maximum allowed length of 100 characters.');
    }
  }

  // Type filter
  if (type !== undefined && type !== 'all') {
    if (typeof type !== 'string' || !VALID_TYPES.includes(type.trim().toLowerCase())) {
      errors.push(`Invalid type filter. Allowed: ${VALID_TYPES.join(', ')}.`);
    }
  }

  // Status filter
  if (status !== undefined && status !== 'all') {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status.trim().toLowerCase())) {
      errors.push(`Invalid status filter. Allowed: ${VALID_STATUSES.join(', ')}.`);
    }
  }

  // Category filter
  if (category !== undefined && category !== 'all') {
    if (typeof category !== 'string' || !VALID_CATEGORIES.includes(category.trim())) {
      errors.push(`Invalid category filter. Allowed: ${VALID_CATEGORIES.join(', ')}.`);
    }
  }

  // Location filter
  if (location !== undefined && location !== 'all') {
    if (typeof location !== 'string' || !VALID_LOCATIONS.includes(location.trim())) {
      errors.push(`Invalid location filter. Allowed: ${VALID_LOCATIONS.join(', ')}.`);
    }
  }

  // Sort parameter
  if (sort !== undefined) {
    if (typeof sort !== 'string' || !VALID_SORTS.includes(sort.trim().toLowerCase())) {
      errors.push(`Invalid sort option. Allowed: ${VALID_SORTS.join(', ')}.`);
    }
  }

  // Pagination page
  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push("Pagination 'page' must be a positive integer greater than or equal to 1.");
    }
  }

  // Pagination limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push("Pagination 'limit' must be an integer between 1 and 50.");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid query parameters.',
      errors
    });
  }

  next();
};

/**
 * Pre-validation for location suggestions (POST /api/items/:id/locations)
 */
const validateLocationSuggestion = (req, res, next) => {
  const { newLocation, specificSpot, note } = req.body;
  const errors = [];

  const normLoc = typeof newLocation === 'string' ? newLocation.trim() : '';
  if (!normLoc || !VALID_LOCATIONS.includes(normLoc)) {
    errors.push(`New campus location must be one of: ${VALID_LOCATIONS.join(', ')}.`);
  }

  if (specificSpot && (typeof specificSpot !== 'string' || specificSpot.trim().length > 200)) {
    errors.push('Specific spot cannot exceed 200 characters.');
  }

  if (note && (typeof note !== 'string' || note.trim().length > 1000)) {
    errors.push('Context note cannot exceed 1000 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed for location suggestion.',
      errors
    });
  }

  req.body.newLocation = normLoc;
  req.body.specificSpot = specificSpot ? specificSpot.trim() : '';
  req.body.note = note ? note.trim() : '';

  next();
};

/**
 * Pre-validation for reviewing location suggestion (PATCH /api/items/:id/locations/:suggestionId)
 */
const validateSuggestionReview = (req, res, next) => {
  const { status } = req.body;
  const allowed = ['verified', 'declined'];

  if (!status || typeof status !== 'string' || !allowed.includes(status.trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Suggestion review status must be either 'verified' or 'declined'.`
    });
  }

  req.body.status = status.trim().toLowerCase();
  next();
};

module.exports = {
  VALID_CATEGORIES,
  VALID_LOCATIONS,
  VALID_TYPES,
  VALID_STATUSES,
  VALID_SORTS,
  validateCreateItem,
  validateUpdateItem,
  validateStatusTransition,
  validateQueryItems,
  validateLocationSuggestion,
  validateSuggestionReview
};
