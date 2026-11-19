/**
 * InSearch — Sai University Lost & Found Portal
 * Central State Store & Persistence Layer (API-Backed State + Event Emitter)
 */

class StateManager {
  constructor() {
    this.STORAGE_KEYS = {
      CURRENT_USER: "insearch_current_user_v1",
      TOKEN: "insearch_jwt_token_v1"
    };

    this.listeners = {};

    // In-memory runtime caches for live API data
    this._items = [];
    this._claims = [];
    this._notifications = [];
    this._users = [];
    this.unreadNotificationCount = 0;
    this.itemsPagination = null;

    this.init();
  }

  init() {
    // Purge obsolete legacy localStorage keys to ensure live backend data is never overridden
    const legacyKeys = ["insearch_items_v1", "insearch_users_v1", "insearch_claims_v1", "insearch_notifs_v1", "insearch_token"];
    legacyKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // silent
      }
    });

    // Handle token expiration event from api client
    if (window.api) {
      window.api.request = (function (originalRequest) {
        return originalRequest;
      })(window.api.request);
    }
  }

  // --- Subscriptions / Event System ---
  subscribe(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in state listener for ${event}:`, err);
        }
      });
    }
  }

  // --- User / Auth Session ---
  getCurrentUser() {
    try {
      const user = localStorage.getItem(this.STORAGE_KEYS.CURRENT_USER);
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  }

  setCurrentUser(user, token = null) {
    if (user) {
      try {
        localStorage.setItem(this.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        if (token && window.api) {
          window.api.setToken(token);
        }
      } catch (e) {
        console.error("Failed to store user profile in localStorage:", e);
      }
    } else {
      try {
        localStorage.removeItem(this.STORAGE_KEYS.CURRENT_USER);
        if (window.api) {
          window.api.clearSession();
        }
      } catch (e) {
        // silent
      }
    }
    this.emit("auth:change", user);
  }

  // --- Users Directory (Admin Only via GET /api/users) ---
  getUsers() {
    return this._users;
  }

  getUserById(id) {
    return this._users.find(u => u.id === id || u._id === id);
  }

  async fetchUsers(params = {}) {
    if (!window.api) return { data: [], total: 0 };
    try {
      const res = await window.api.get('/api/users', params);
      const rawUsers = res.data || [];
      this._users = rawUsers.map(u => ({
        ...u,
        id: u.id || u._id
      }));
      this.emit("users:change", this._users);
      return res;
    } catch (err) {
      console.warn("fetchUsers warning:", err.message);
      return { success: false, data: this._users, total: this._users.length, error: err.message };
    }
  }

  saveUser(userData) {
    const existingIndex = this._users.findIndex(u => (u.email && u.email.toLowerCase() === userData.email.toLowerCase()));
    if (existingIndex >= 0) {
      this._users[existingIndex] = { ...this._users[existingIndex], ...userData };
    } else {
      userData.id = userData.id || userData._id || `usr_${Date.now()}`;
      this._users.push(userData);
    }
    this.emit("users:change", this._users);
    return userData;
  }

  // --- Items Management ---
  getItems() {
    return this._items;
  }

  getItemById(id) {
    return this._items.find(item => item.id === id || item._id === id);
  }

  _normalizeItem(raw) {
    if (!raw) return null;
    const item = { ...raw };
    item.id = item._id || item.id;
    if (window.api && typeof window.api.resolveImageUrl === 'function') {
      item.image = window.api.resolveImageUrl(item.image, item.category);
    }
    // Normalize locationSuggestions
    if (Array.isArray(item.locationSuggestions)) {
      item.locationSuggestions = item.locationSuggestions.map(s => ({
        ...s,
        id: s._id || s.id,
        suggestedBy: s.suggestedByUser?.name || s.suggestedBy || "Student"
      }));
    }
    return item;
  }

  async fetchItems(params = {}) {
    if (!window.api) return { data: [], total: 0 };
    try {
      const res = await window.api.get('/api/items', params);
      const rawItems = res.data || [];
      this._items = rawItems.map(i => this._normalizeItem(i));
      this.itemsPagination = res.pagination || null;
      this.emit("items:change", this._items);
      return res;
    } catch (err) {
      console.warn("fetchItems warning:", err.message);
      return { success: false, data: this._items, total: this._items.length, error: err.message };
    }
  }

  async createItem(itemData) {
    if (!window.api) throw new Error("API Client not loaded");
    const payload = {
      title: itemData.title ? itemData.title.trim() : "",
      type: itemData.type,
      category: itemData.category,
      location: itemData.location,
      specificLocation: itemData.specificLocation ? itemData.specificLocation.trim() : "",
      date: itemData.date || new Date().toISOString().split("T")[0],
      description: itemData.description ? itemData.description.trim() : "",
      image: itemData.image
    };

    const res = await window.api.post('/api/items', payload);
    const createdItem = this._normalizeItem(res.data);
    this._items.unshift(createdItem);
    this.emit("items:change", this._items);
    return createdItem;
  }

  async updateItem(id, updateData) {
    if (!window.api) throw new Error("API Client not loaded");
    const payload = {
      title: updateData.title ? updateData.title.trim() : undefined,
      category: updateData.category,
      location: updateData.location,
      specificLocation: updateData.specificLocation !== undefined ? updateData.specificLocation.trim() : undefined,
      description: updateData.description ? updateData.description.trim() : undefined
    };

    const res = await window.api.put(`/api/items/${id}`, payload);
    const updated = this._normalizeItem(res.data);
    const index = this._items.findIndex(i => i.id === id || i._id === id);
    if (index >= 0) {
      this._items[index] = updated;
    }
    this.emit("items:change", this._items);
    return updated;
  }

  async updateItemStatus(id, status) {
    if (!window.api) throw new Error("API Client not loaded");
    const res = await window.api.patch(`/api/items/${id}/status`, { status });
    const updated = this._normalizeItem(res.data);
    const index = this._items.findIndex(i => i.id === id || i._id === id);
    if (index >= 0) {
      this._items[index] = updated;
    }
    this.emit("items:change", this._items);
    return updated;
  }

  async deleteItem(id) {
    if (!window.api) throw new Error("API Client not loaded");
    const res = await window.api.delete(`/api/items/${id}`);
    this._items = this._items.filter(i => i.id !== id && i._id !== id);
    this.emit("items:change", this._items);
    return res;
  }

  async suggestLocationUpdate(itemId, suggestion) {
    if (!window.api) throw new Error("API Client not loaded");
    const payload = {
      newLocation: suggestion.location ? suggestion.location.trim() : (suggestion.newLocation ? suggestion.newLocation.trim() : ""),
      specificSpot: suggestion.specificSpot ? suggestion.specificSpot.trim() : "",
      note: suggestion.note ? suggestion.note.trim() : ""
    };

    const res = await window.api.post(`/api/items/${itemId}/locations`, payload);
    const updated = this._normalizeItem(res.data);
    const index = this._items.findIndex(i => i.id === itemId || i._id === itemId);
    if (index >= 0) {
      this._items[index] = updated;
    }
    this.emit("items:change", this._items);
    return updated;
  }

  async updateLocationSuggestionStatus(itemId, suggestionId, newStatus) {
    if (!window.api) throw new Error("API Client not loaded");
    const action = newStatus === 'verified' ? 'verify' : 'decline';
    const res = await window.api.patch(`/api/items/${itemId}/locations/${suggestionId}`, { status: action });
    const updated = this._normalizeItem(res.data);
    const index = this._items.findIndex(i => i.id === itemId || i._id === itemId);
    if (index >= 0) {
      this._items[index] = updated;
    }
    this.emit("items:change", this._items);
    return updated;
  }

  // --- Claims Management ---
  getClaims() {
    return this._claims;
  }

  getClaimsByClaimant(userId) {
    if (!userId) return [];
    return this._claims.filter(c => c.claimantId === userId || c.claimant?._id === userId || c.claimant?.id === userId);
  }

  _normalizeClaim(raw) {
    if (!raw) return null;
    const claim = { ...raw };
    claim.id = claim._id || claim.id;
    claim.itemId = claim.item?._id || claim.item?.id || claim.itemId;
    claim.itemTitle = claim.item?.title || claim.itemTitle || "Reported Item";
    claim.claimantId = claim.claimant?._id || claim.claimant?.id || claim.claimantId;
    claim.claimantName = claim.claimant?.name || claim.claimantName || "Student";
    claim.claimantEmail = claim.claimant?.email || claim.claimantEmail || "";
    claim.claimantPhone = claim.claimant?.phone || claim.claimantPhone || claim.phone || "";
    return claim;
  }

  async fetchClaims(params = {}) {
    if (!window.api) return { data: [], total: 0 };
    try {
      const res = await window.api.get('/api/claims', params);
      const rawClaims = res.data || [];
      this._claims = rawClaims.map(c => this._normalizeClaim(c));
      this.emit("claims:change", this._claims);
      return res;
    } catch (err) {
      console.warn("fetchClaims warning:", err.message);
      return { success: false, data: this._claims, total: this._claims.length, error: err.message };
    }
  }

  async createClaim(claimData) {
    if (!window.api) throw new Error("API Client not loaded");
    const payload = {
      itemId: claimData.itemId,
      proofDescription: claimData.proofDescription ? claimData.proofDescription.trim() : "",
      phone: claimData.phone ? claimData.phone.trim() : undefined
    };

    const res = await window.api.post('/api/claims', payload);
    // Refresh claims and items to reflect claimed state
    await this.fetchClaims();
    await this.fetchItems();
    return res;
  }

  async updateClaimStatus(claimId, status, adminNotes = "") {
    if (!window.api) throw new Error("API Client not loaded");
    const endpoint = status === "approved" ? `/api/claims/${claimId}/approve` : `/api/claims/${claimId}/reject`;
    const res = await window.api.patch(endpoint, { adminNotes });

    // Refresh claims and items after moderation decision
    await this.fetchClaims();
    await this.fetchItems();
    return res;
  }

  // --- Notifications ---
  getNotifications(userId) {
    if (!userId) return this._notifications;
    return this._notifications.filter(n => n.userId === userId || n.recipient === userId);
  }

  async fetchNotifications(params = {}) {
    if (!window.api) return { data: [], unreadCount: 0 };
    try {
      const res = await window.api.get('/api/notifications', params);
      const rawNotifs = res.data || [];
      this._notifications = rawNotifs.map(n => ({
        ...n,
        id: n._id || n.id,
        timestamp: n.timestamp || n.createdAt
      }));
      this.unreadNotificationCount = typeof res.unreadCount === 'number' ? res.unreadCount : 0;
      this.emit("notifications:change", this._notifications);
      return res;
    } catch (err) {
      console.warn("fetchNotifications warning:", err.message);
      return { success: false, data: this._notifications, unreadCount: 0, error: err.message };
    }
  }

  addNotification(notif) {
    const newNotif = {
      id: `notif_${Date.now()}`,
      userId: notif.userId,
      title: notif.title,
      message: notif.message,
      type: notif.type || "info",
      timestamp: new Date().toISOString(),
      read: false
    };
    this._notifications.unshift(newNotif);
    this.unreadNotificationCount++;
    this.emit("notifications:change", this._notifications);
    return newNotif;
  }

  async markNotificationRead(id) {
    if (!window.api) return;
    try {
      await window.api.patch(`/api/notifications/${id}/read`);
      const target = this._notifications.find(n => n.id === id || n._id === id);
      if (target && !target.read) {
        target.read = true;
        this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
      }
      this.emit("notifications:change", this._notifications);
    } catch (err) {
      console.warn("Failed to mark notification read:", err.message);
    }
  }

  async markAllNotificationsRead(userId) {
    if (window.api && window.api.getToken()) {
      try {
        await window.api.patch('/api/notifications/read-all');
      } catch (err) {
        console.warn("Failed to mark all read via API:", err.message);
      }
    }
    this._notifications = this._notifications.map(n => ({ ...n, read: true }));
    this.unreadNotificationCount = 0;
    this.emit("notifications:change", this._notifications);
  }

  resetToDefaults() {
    this._items = [];
    this._claims = [];
    this._notifications = [];
    this._users = [];
    this.unreadNotificationCount = 0;
    this.setCurrentUser(null);
    this.emit("items:change", []);
    this.emit("claims:change", []);
    this.emit("notifications:change", []);
  }
}

// Global instance available across app
window.State = new StateManager();
