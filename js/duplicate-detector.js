/**
 * InSearch — Sai University Lost & Found Portal
 * Smart Duplicate-Item Detection & Similar-Item Matching Engine
 */

class DuplicateDetector {
  constructor() {
    this.STOP_WORDS = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with",
      "by", "from", "up", "about", "into", "over", "after", "is", "was", "are",
      "were", "has", "have", "had", "this", "that", "these", "those", "my", "your"
    ]);
  }

  /**
   * Tokenize and normalize text into clean words
   */
  tokenize(text) {
    if (!text || typeof text !== "string") return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !this.STOP_WORDS.has(w));
  }

  /**
   * Calculate Jaccard similarity coefficient between two token lists
   */
  calculateJaccard(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = [...setA].filter(t => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Check if draft item potentially duplicates existing reports
   * @param {Object} draftItem - { title, category, location, description, type }
   * @param {Array} existingItems - Array of all items in database
   * @returns {Array} List of matched items with score and explanation
   */
  detectDuplicates(draftItem, existingItems) {
    if (!draftItem || !draftItem.title || draftItem.title.trim().length < 3) return [];

    const draftTitleTokens = this.tokenize(draftItem.title);
    const draftDescTokens = this.tokenize(draftItem.description || "");

    const matches = [];

    existingItems.forEach(existing => {
      // Don't compare with itself
      if (draftItem.id && existing.id === draftItem.id) return;
      if (existing.status === "recovered") return; // Recovered items aren't active duplicates

      let score = 0;
      const reasons = [];

      // 1. Title Similarity (High weight: up to 45 pts)
      const existingTitleTokens = this.tokenize(existing.title);
      const titleSim = this.calculateJaccard(draftTitleTokens, existingTitleTokens);
      if (titleSim > 0.6) {
        score += 45;
        reasons.push("Very similar item title");
      } else if (titleSim > 0.3) {
        score += 30;
        reasons.push("Matching keywords in title");
      } else if (titleSim > 0.15) {
        score += 15;
      }

      // Check substring or exact brand/model match
      const lowerDraftTitle = draftItem.title.toLowerCase();
      const lowerExistingTitle = existing.title.toLowerCase();
      if (lowerDraftTitle === lowerExistingTitle) {
        score += 30;
        reasons.push("Identical title");
      } else if (lowerExistingTitle.includes(lowerDraftTitle) || lowerDraftTitle.includes(lowerExistingTitle)) {
        score += 20;
        reasons.push("Direct title overlap");
      }

      // 2. Category Match (Weight: 20 pts)
      if (draftItem.category && existing.category && draftItem.category === existing.category) {
        score += 20;
        reasons.push(`Same category (${existing.category})`);
      }

      // 3. Location Match (Weight: 20 pts)
      if (draftItem.location && existing.location && draftItem.location === existing.location) {
        score += 20;
        reasons.push(`Same campus building (${existing.location})`);
      }

      // 4. Description Content Overlap (Weight: 15 pts)
      if (draftDescTokens.length && existing.description) {
        const existingDescTokens = this.tokenize(existing.description);
        const descSim = this.calculateJaccard(draftDescTokens, existingDescTokens);
        if (descSim > 0.25) {
          score += 15;
          reasons.push("Matching description phrases");
        }
      }

      // 5. Listing Type consideration
      if (draftItem.type && existing.type) {
        if (draftItem.type === existing.type) {
          reasons.push(`Both are reported as "${existing.type.toUpperCase()}"`);
        } else {
          reasons.push(`Opposite report: Existing is "${existing.type.toUpperCase()}"`);
        }
      }

      // Normalize score max 100
      const finalScore = Math.min(100, Math.round(score));

      // Filter threshold for duplicates: score >= 45
      if (finalScore >= 45) {
        matches.push({
          item: existing,
          score: finalScore,
          reasons: reasons.slice(0, 3)
        });
      }
    });

    // Sort highest score first
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Find matching opposite reports (e.g. lost item looking for found items, or vice versa)
   * @param {Object} targetItem - Current item being viewed
   * @param {Array} allItems - All items
   * @returns {Array} List of suggested potential matches
   */
  findSimilarItems(targetItem, allItems) {
    if (!targetItem) return [];

    const oppositeType = targetItem.type === "lost" ? "found" : "lost";
    const targetTitleTokens = this.tokenize(targetItem.title);
    const targetDescTokens = this.tokenize(targetItem.description || "");

    const candidates = allItems.filter(item => item.id !== targetItem.id && item.type === oppositeType && item.status !== "recovered");

    const scored = candidates.map(candidate => {
      let score = 0;
      const reasons = [];

      // Category match
      if (candidate.category === targetItem.category) {
        score += 35;
        reasons.push("Same category");
      }

      // Location match
      if (candidate.location === targetItem.location) {
        score += 25;
        reasons.push(`Reported at same building (${candidate.location})`);
      }

      // Title match
      const candTitleTokens = this.tokenize(candidate.title);
      const titleSim = this.calculateJaccard(targetTitleTokens, candTitleTokens);
      if (titleSim > 0.2) {
        score += Math.round(titleSim * 40);
        reasons.push("Shared keywords");
      }

      // Description match
      const candDescTokens = this.tokenize(candidate.description || "");
      const descSim = this.calculateJaccard(targetDescTokens, candDescTokens);
      if (descSim > 0.15) {
        score += Math.round(descSim * 20);
      }

      return {
        item: candidate,
        score: Math.min(100, Math.round(score)),
        reasons
      };
    });

    // Return items with similarity score >= 35
    return scored
      .filter(s => s.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }
}

// Global instance
window.duplicateDetector = new DuplicateDetector();
