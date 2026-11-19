const express = require('express');
const router = express.Router();

const itemController = require('../controllers/itemController');
const { protect } = require('../middleware/auth');
const {
  validateCreateItem,
  validateUpdateItem,
  validateStatusTransition,
  validateQueryItems,
  validateLocationSuggestion,
  validateSuggestionReview
} = require('../middleware/itemValidation');

/**
 * Item Routes — InSearch Sai University
 */

// Public catalog and image routes
router.get('/', validateQueryItems, itemController.getItems);
router.get('/:id', itemController.getItemById);
router.get('/:id/image', itemController.getItemImage);

// Authenticated item creation
router.post('/', protect, validateCreateItem, itemController.createItem);

// Authenticated item updates (Owner or Admin)
router.put('/:id', protect, validateUpdateItem, itemController.updateItem);
router.patch('/:id/status', protect, validateStatusTransition, itemController.updateItemStatus);
router.delete('/:id', protect, itemController.deleteItem);

// Location suggestions
router.post('/:id/locations', protect, validateLocationSuggestion, itemController.suggestLocation);
router.patch('/:id/locations/:suggestionId', protect, validateSuggestionReview, itemController.reviewLocationSuggestion);

module.exports = router;
