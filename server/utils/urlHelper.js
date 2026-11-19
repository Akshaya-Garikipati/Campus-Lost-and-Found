/**
 * URL Resolution & Response Formatting Utilities — InSearch Sai University
 */

const CATEGORY_FALLBACK_IMAGES = {
  'Electronics': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
  'ID Cards & Keys': 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80',
  'Wallets & Bags': 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
  'Books & Stationery': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
  'Clothing & Footwear': 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
  'Personal Accessories': 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
  'Others': 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80'
};

const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80';

/**
 * Returns the category fallback image URL for an item category.
 * @param {string} category 
 * @returns {string} Image URL
 */
function getCategoryFallbackImage(category) {
  return CATEGORY_FALLBACK_IMAGES[category] || DEFAULT_FALLBACK_IMAGE;
}

/**
 * Determines the server's base URL for image links.
 * Checks API_BASE_URL environment variable first, then dynamically inspects the request host.
 * @param {import('express').Request} req 
 * @returns {string} Base URL without trailing slash
 */
function getBaseUrl(req) {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/+$/, '');
  }
  if (!req) return 'http://localhost:5000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
  return `${protocol}://${host}`;
}

/**
 * Resolves an item's image URL.
 * - If image is an external HTTP(S) URL, returns it verbatim.
 * - If image is a Base64 data URI, returns the dedicated image streaming URL with cache-busting timestamp.
 * - If image is missing, returns category fallback URL.
 * 
 * @param {import('express').Request} req 
 * @param {object} item - Plain item object or Mongoose document
 * @returns {string} Resolved image URL
 */
function resolveImageUrl(req, item) {
  if (!item) return DEFAULT_FALLBACK_IMAGE;
  const rawImage = item.image;

  if (!rawImage || typeof rawImage !== 'string') {
    return getCategoryFallbackImage(item.category);
  }

  // External HTTP(S) URLs returned as-is
  if (/^https?:\/\//i.test(rawImage)) {
    return rawImage;
  }

  // Base64 Data URI -> resolve to dedicated streaming endpoint
  const baseUrl = getBaseUrl(req);
  const itemId = item._id ? item._id.toString() : (item.id || item.itemId);
  const version = item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now();

  return `${baseUrl}/api/items/${itemId}/image?v=${version}`;
}

/**
 * Sanitizes and formats an item response for public delivery.
 * Strips raw multi-megabyte Base64 image payloads, replaces with lightweight URLs,
 * and ensures student private data (emails, phone numbers, studentId) is never exposed.
 * 
 * @param {import('express').Request} req 
 * @param {object} itemDoc - Mongoose Item document
 * @param {boolean} includeRawImage - Whether to include raw base64 string (defaults to false)
 * @returns {object} Clean sanitized item object
 */
function formatItemResponse(req, itemDoc, includeRawImage = false) {
  if (!itemDoc) return null;
  const item = typeof itemDoc.toObject === 'function'
    ? itemDoc.toObject({ virtuals: true })
    : { ...itemDoc };

  const rawImage = item.image;
  const isBase64 = typeof rawImage === 'string' && /^data:image\//i.test(rawImage);

  // 1. Resolve lightweight public image URL
  const resolvedUrl = resolveImageUrl(req, item);
  item.image = resolvedUrl;
  item.hasImage = !!rawImage;
  item.imageType = isBase64 ? 'base64' : (/^https?:\/\//i.test(rawImage) ? 'url' : 'none');

  if (includeRawImage && isBase64) {
    item.rawImage = rawImage;
  }

  // 2. Sanitize reportedBy (never expose email, phone, studentId, or passwords)
  if (item.reportedBy && typeof item.reportedBy === 'object') {
    item.reportedBy = {
      _id: item.reportedBy._id ? item.reportedBy._id.toString() : item.reportedBy.id,
      id: item.reportedBy._id ? item.reportedBy._id.toString() : item.reportedBy.id,
      name: item.reportedBy.name || 'Sai University Member',
      department: item.reportedBy.department || 'General',
      avatar: item.reportedBy.avatar || ''
    };
  }

  // 3. Sanitize locationSuggestions
  if (Array.isArray(item.locationSuggestions)) {
    item.locationSuggestions = item.locationSuggestions.map(sug => {
      const sanitized = {
        _id: sug._id ? sug._id.toString() : sug.id,
        id: sug._id ? sug._id.toString() : sug.id,
        newLocation: sug.newLocation,
        specificSpot: sug.specificSpot || '',
        note: sug.note || '',
        suggestedBy: sug.suggestedBy || 'Fellow Student',
        status: sug.status || 'pending',
        createdAt: sug.createdAt
      };

      if (sug.suggestedByUser && typeof sug.suggestedByUser === 'object') {
        sanitized.suggestedByUser = {
          _id: sug.suggestedByUser._id ? sug.suggestedByUser._id.toString() : sug.suggestedByUser.id,
          id: sug.suggestedByUser._id ? sug.suggestedByUser._id.toString() : sug.suggestedByUser.id,
          name: sug.suggestedByUser.name || 'Student'
        };
      } else if (sug.suggestedByUser) {
        sanitized.suggestedByUser = sug.suggestedByUser.toString();
      }

      return sanitized;
    });
  }

  // Exclude internal mongoose version key
  delete item.__v;

  return item;
}

module.exports = {
  CATEGORY_FALLBACK_IMAGES,
  DEFAULT_FALLBACK_IMAGE,
  getCategoryFallbackImage,
  getBaseUrl,
  resolveImageUrl,
  formatItemResponse
};
