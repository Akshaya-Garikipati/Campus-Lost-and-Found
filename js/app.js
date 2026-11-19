/**
 * InSearch — Sai University Lost & Found Portal
 * Main UI Orchestrator, Router, Filters, Modals & Event Listeners (js/app.js)
 * Fully connected to Live Backend APIs: Authentication, Items, Claims, Notifications
 */

class Application {
  constructor() {
    this.currentView = "browse"; // 'browse' | 'report' | 'dashboard' | 'admin'
    this.activeTypeFilter = "all"; // 'all' | 'lost' | 'found' | 'recovered'
    this.activeCategoryFilter = "all";
    this.activeLocationFilter = "all";
    this.activeSort = "newest";
    this.searchQuery = "";

    this.currentPage = 1;
    this.pageSize = 12;

    this.selectedItemForModal = null;
    this.suggestingItemId = null;
    this.uploadedImageData = null;

    this.duplicateCheckTimeout = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.populateDropdowns();

    // Initial fetch of live campus items from backend
    await this.loadItems();

    Auth.updateUI();

    // Subscribe to state updates
    State.subscribe("items:change", () => {
      this.renderItems();
      this.renderStudentDashboard();
      if (this.selectedItemForModal) {
        const fresh = State.getItemById(this.selectedItemForModal.id);
        if (fresh) {
          this.selectedItemForModal = fresh;
        }
      }
    });

    State.subscribe("claims:change", () => {
      this.renderStudentDashboard();
    });

    State.subscribe("notifications:change", () => {
      this.renderNotificationsList();
      Auth.updateNotificationBadge();
    });

    State.subscribe("auth:change", () => {
      this.renderStudentDashboard();
      this.renderNotificationsList();
      Auth.updateUI();
    });
  }

  // --- View Navigation ---
  navigateTo(viewName) {
    this.currentView = viewName;
    const views = {
      browse: document.getElementById("view-browse"),
      report: document.getElementById("view-report"),
      dashboard: document.getElementById("view-dashboard"),
      admin: document.getElementById("view-admin")
    };

    // Hide all views
    Object.values(views).forEach(el => el && el.classList.add("hidden"));

    // Update active nav links
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    // Show target view
    if (views[viewName]) {
      views[viewName].classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (viewName === "admin") {
      Admin.render();
    } else if (viewName === "dashboard") {
      this.renderStudentDashboard();
    } else if (viewName === "browse") {
      this.loadItems();
    }
  }

  // --- Quick Login Handler with Gating & Safe Failure Fallback ---
  async handleQuickLogin(role, targetView = null) {
    const res = await Auth.quickLogin(role);
    if (res.success) {
      this.closeModal("modal-auth");
      this.showToast(res.message || `Signed in as ${res.user.name}`, "success");
      if (targetView) {
        this.navigateTo(targetView);
      }
    } else {
      this.showToast(res.message, "warning");
      this.openAuthModal("login");
    }
  }

  // --- Dropdowns Population ---
  populateDropdowns() {
    const filterLoc = document.getElementById("filter-location");
    const reportLoc = document.getElementById("report-location");
    const editLoc = document.getElementById("edit-location");
    const suggestLoc = document.getElementById("suggest-new-location");

    CAMPUS_LOCATIONS.forEach(loc => {
      const opt = `<option value="${loc}">${loc}</option>`;
      if (filterLoc) filterLoc.insertAdjacentHTML("beforeend", opt);
      if (reportLoc) reportLoc.insertAdjacentHTML("beforeend", opt);
      if (editLoc) editLoc.insertAdjacentHTML("beforeend", opt);
      if (suggestLoc) suggestLoc.insertAdjacentHTML("beforeend", opt);
    });

    const filterCat = document.getElementById("filter-category");
    const reportCat = document.getElementById("report-category");
    const editCat = document.getElementById("edit-category");

    ITEM_CATEGORIES.forEach(cat => {
      const opt = `<option value="${cat.name}">${cat.name}</option>`;
      if (filterCat) filterCat.insertAdjacentHTML("beforeend", opt);
      if (reportCat) reportCat.insertAdjacentHTML("beforeend", opt);
      if (editCat) editCat.insertAdjacentHTML("beforeend", opt);
    });
  }

  // --- Event Binding ---
  bindEvents() {
    // Navigation items
    document.querySelectorAll("[data-view]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        this.navigateTo(btn.dataset.view);
      });
    });

    // Mobile Navigation Hamburger Toggle
    const mobileMenuBtn = document.getElementById("mobile-menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    if (mobileMenuBtn && navMenu) {
      mobileMenuBtn.addEventListener("click", () => {
        navMenu.classList.toggle("open");
        const isOpen = navMenu.classList.contains("open");
        mobileMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      // Close mobile menu when a nav link is clicked
      navMenu.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
          navMenu.classList.remove("open");
          mobileMenuBtn.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Search Input
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      let searchTimeout = null;
      searchInput.addEventListener("input", e => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentPage = 1;
          this.loadItems();
        }, 350);
      });
    }

    // Type Filter Pills ('all' | 'lost' | 'found' | 'recovered')
    document.querySelectorAll(".type-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".type-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.activeTypeFilter = pill.dataset.type;
        this.currentPage = 1;
        this.loadItems();
      });
    });

    // Category Filter Dropdown
    const filterCat = document.getElementById("filter-category");
    if (filterCat) {
      filterCat.addEventListener("change", e => {
        this.activeCategoryFilter = e.target.value;
        this.currentPage = 1;
        this.loadItems();
      });
    }

    // Location Filter Dropdown
    const filterLoc = document.getElementById("filter-location");
    if (filterLoc) {
      filterLoc.addEventListener("change", e => {
        this.activeLocationFilter = e.target.value;
        this.currentPage = 1;
        this.loadItems();
      });
    }

    // Sorting Dropdown (newest, oldest, name-asc, name-desc)
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", e => {
        this.activeSort = e.target.value;
        this.currentPage = 1;
        this.loadItems();
      });
    }

    // Reset Filters Button
    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.activeTypeFilter = "all";
        this.activeCategoryFilter = "all";
        this.activeLocationFilter = "all";
        this.activeSort = "newest";
        this.searchQuery = "";
        this.currentPage = 1;

        if (searchInput) searchInput.value = "";
        if (filterCat) filterCat.value = "all";
        if (filterLoc) filterLoc.value = "all";
        if (sortSelect) sortSelect.value = "newest";

        document.querySelectorAll(".type-pill").forEach(p => {
          p.classList.toggle("active", p.dataset.type === "all");
        });

        this.loadItems();
      });
    }

    // Report Form Duplicate Checking Listeners
    const titleInput = document.getElementById("report-title");
    const descInput = document.getElementById("report-description");
    const catSelect = document.getElementById("report-category");
    const locSelect = document.getElementById("report-location");
    const typeInputs = document.querySelectorAll("input[name='report-type']");

    const triggerDuplicateCheck = () => {
      clearTimeout(this.duplicateCheckTimeout);
      this.duplicateCheckTimeout = setTimeout(() => this.checkDuplicatesOnReport(), 400);
    };

    if (titleInput) titleInput.addEventListener("input", triggerDuplicateCheck);
    if (descInput) descInput.addEventListener("input", triggerDuplicateCheck);
    if (catSelect) catSelect.addEventListener("change", triggerDuplicateCheck);
    if (locSelect) locSelect.addEventListener("change", triggerDuplicateCheck);
    typeInputs.forEach(radio => radio.addEventListener("change", triggerDuplicateCheck));

    // Compulsory Image Upload Handling & Drag-and-Drop
    const imageInput = document.getElementById("report-image-input");
    const imageDropzone = document.getElementById("image-dropzone");
    const imagePreview = document.getElementById("report-image-preview");
    const uploadPlaceholder = document.getElementById("upload-placeholder");
    const removeImgBtn = document.getElementById("btn-remove-image");
    const imageErrorEl = document.getElementById("report-image-error");

    const processSelectedFile = (file) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        this.showToast("Please upload an image file (JPG, PNG, WebP).", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.showToast("Image exceeds 5MB limit. Please choose a smaller file.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = ev => {
        this.uploadedImageData = ev.target.result;
        if (imagePreview) {
          imagePreview.src = this.uploadedImageData;
          imagePreview.classList.remove("hidden");
        }
        if (uploadPlaceholder) uploadPlaceholder.classList.add("hidden");
        if (removeImgBtn) removeImgBtn.classList.remove("hidden");
        if (imageErrorEl) imageErrorEl.classList.add("hidden");
        if (imageDropzone) imageDropzone.classList.remove("dropzone-error");
      };
      reader.readAsDataURL(file);
    };

    if (imageInput) {
      imageInput.addEventListener("change", e => {
        if (e.target.files && e.target.files[0]) {
          processSelectedFile(e.target.files[0]);
        }
      });
    }

    if (imageDropzone) {
      imageDropzone.addEventListener("dragover", e => {
        e.preventDefault();
        imageDropzone.classList.add("dragover");
      });
      imageDropzone.addEventListener("dragleave", e => {
        e.preventDefault();
        imageDropzone.classList.remove("dragover");
      });
      imageDropzone.addEventListener("drop", e => {
        e.preventDefault();
        imageDropzone.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          processSelectedFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (removeImgBtn) {
      removeImgBtn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        this.uploadedImageData = null;
        if (imageInput) imageInput.value = "";
        if (imagePreview) {
          imagePreview.src = "";
          imagePreview.classList.add("hidden");
        }
        if (uploadPlaceholder) uploadPlaceholder.classList.remove("hidden");
        removeImgBtn.classList.add("hidden");
      });
    }

    // Report Form Submit
    const reportForm = document.getElementById("report-form");
    if (reportForm) {
      reportForm.addEventListener("submit", e => {
        e.preventDefault();
        this.handleReportSubmit();
      });
    }

    // Suggest Location Form Submit
    const suggestLocForm = document.getElementById("suggest-location-form");
    if (suggestLocForm) {
      suggestLocForm.addEventListener("submit", e => {
        e.preventDefault();
        this.handleSuggestLocationSubmit();
      });
    }

    // Claim Form Submit
    const claimForm = document.getElementById("claim-form");
    if (claimForm) {
      claimForm.addEventListener("submit", e => {
        e.preventDefault();
        this.handleClaimSubmit();
      });
    }

    // Auth Forms (Asynchronous with Real JWT Processing)
    const loginForm = document.getElementById("form-login");
    if (loginForm) {
      loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-password").value;
        const submitBtn = loginForm.querySelector("button[type='submit']");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Signing In..."; }

        try {
          const res = await Auth.login(email, pass);
          if (res.success) {
            this.closeModal("modal-auth");
            this.showToast(res.message, "success");
          } else {
            this.showToast(res.message, "error");
          }
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Sign In & Continue"; }
        }
      });
    }

    const registerForm = document.getElementById("form-register");
    if (registerForm) {
      registerForm.addEventListener("submit", async e => {
        e.preventDefault();
        const data = {
          name: document.getElementById("reg-name").value,
          email: document.getElementById("reg-email").value,
          studentId: document.getElementById("reg-id").value,
          department: document.getElementById("reg-dept").value,
          phone: document.getElementById("reg-phone").value,
          password: document.getElementById("reg-password").value
        };
        const submitBtn = registerForm.querySelector("button[type='submit']");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Registering..."; }

        try {
          const res = await Auth.register(data);
          if (res.success) {
            this.closeModal("modal-auth");
            this.showToast(res.message, "success");
          } else {
            this.showToast(res.message, "error");
          }
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Complete Student Registration"; }
        }
      });
    }

    // Notifications toggle
    const notifBtn = document.getElementById("btn-notifications");
    const notifDrawer = document.getElementById("notifications-drawer");
    if (notifBtn && notifDrawer) {
      notifBtn.addEventListener("click", () => {
        notifDrawer.classList.toggle("open");
        if (notifDrawer.classList.contains("open")) {
          this.renderNotificationsList();
        }
      });
    }

    // Close modals on Escape key
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
        if (notifDrawer) notifDrawer.classList.remove("open");
      }
    });

    // Close modals when clicking backdrop
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", e => {
        if (e.target === overlay) {
          overlay.classList.remove("active");
        }
      });
    });
  }

  /**
   * Loads items from backend with active filters, global database sorting, and pagination
   */
  async loadItems() {
    const params = {
      page: this.currentPage || 1,
      limit: this.pageSize || 12,
      sort: this.activeSort || 'newest'
    };

    if (this.activeTypeFilter !== "all") {
      if (this.activeTypeFilter === "recovered") {
        params.status = "recovered";
      } else {
        params.type = this.activeTypeFilter;
      }
    }

    if (this.activeCategoryFilter !== "all") {
      params.category = this.activeCategoryFilter;
    }

    if (this.activeLocationFilter !== "all") {
      params.location = this.activeLocationFilter;
    }

    if (this.searchQuery) {
      params.q = this.searchQuery;
    }

    await State.fetchItems(params);
    this.renderItems();
  }

  changePage(newPage) {
    if (newPage < 1) return;
    if (State.itemsPagination && newPage > State.itemsPagination.totalPages) return;
    this.currentPage = newPage;
    this.loadItems();
    const grid = document.getElementById("items-grid");
    if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // --- Rendering Items Grid ---
  renderItems() {
    const grid = document.getElementById("items-grid");
    const countEl = document.getElementById("items-count-badge");
    if (!grid) return;

    const items = State.getItems();
    const pagination = State.itemsPagination;
    const totalItems = pagination && typeof pagination.totalItems === 'number' ? pagination.totalItems : items.length;

    if (countEl) {
      countEl.textContent = `${totalItems} ${totalItems === 1 ? "item" : "items"} registered`;
    }

    // Empty States
    if (items.length === 0) {
      const isFiltered = this.searchQuery || this.activeTypeFilter !== "all" || this.activeCategoryFilter !== "all" || this.activeLocationFilter !== "all";

      if (isFiltered) {
        grid.innerHTML = `
          <div class="empty-state-box col-span-full">
            <div class="empty-state-icon">🔍</div>
            <h3 class="empty-state-title">No matching items found</h3>
            <p class="empty-state-text">We couldn't find any reports matching your active filters or search terms. Try clearing filters or submit a new report if you found this item.</p>
            <div class="empty-state-actions">
              <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('btn-reset-filters').click()">
                Reset All Filters
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="App.navigateTo('report')">
                + Report an Item
              </button>
            </div>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="empty-state-box col-span-full">
            <div class="empty-state-icon">📦</div>
            <h3 class="empty-state-title">No items reported yet</h3>
            <p class="empty-state-text">The campus lost and found registry is currently clear. If you found a misplaced belonging on campus, report it to help return it to its owner.</p>
            <div class="empty-state-actions">
              <button type="button" class="btn btn-primary" onclick="App.navigateTo('report')">
                + Report Found Item
              </button>
            </div>
          </div>
        `;
      }
      return;
    }

    // Cards HTML
    const cardsHTML = items.map(item => this.createItemCardHTML(item)).join("");

    // Render Pagination Bar if totalPages > 1
    let paginationHTML = "";
    if (pagination && pagination.totalPages > 1) {
      const prevDisabled = !pagination.hasPrevPage ? "disabled" : "";
      const nextDisabled = !pagination.hasNextPage ? "disabled" : "";
      paginationHTML = `
        <div class="items-pagination-bar col-span-full d-flex justify-content-center align-items-center gap-3 py-4 mt-2">
          <button type="button" class="btn btn-sm btn-outline" ${prevDisabled} onclick="App.changePage(${pagination.currentPage - 1})">
            &larr; Previous
          </button>
          <span class="text-xs fw-medium text-muted">
            Page <strong>${pagination.currentPage}</strong> of <strong>${pagination.totalPages}</strong> (${pagination.totalItems} items)
          </span>
          <button type="button" class="btn btn-sm btn-outline" ${nextDisabled} onclick="App.changePage(${pagination.currentPage + 1})">
            Next &rarr;
          </button>
        </div>
      `;
    }

    grid.innerHTML = cardsHTML + paginationHTML;
  }

  createItemCardHTML(item) {
    const isRecovered = item.status === "recovered";
    const typeLabel = isRecovered ? "RECOVERED" : (item.type ? item.type.toUpperCase() : "FOUND");
    const typeClass = isRecovered ? "badge-recovered" : (item.type === "lost" ? "badge-lost" : "badge-found");

    const formattedDate = item.date
      ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Date not provided";

    const locationDisplay = item.location
      ? `${item.location}${item.specificLocation ? " • " + item.specificLocation : ""}`
      : "Location not provided";

    const descSnippet = item.description
      ? (item.description.length > 95 ? item.description.substring(0, 95) + "..." : item.description)
      : "No additional details provided.";

    const actionBtn = item.type === "found" && item.status !== "recovered"
      ? `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); App.openClaimModal('${item.id}')">Claim Item &rarr;</button>`
      : `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); App.openItemModal('${item.id}')">View Details &rarr;</button>`;

    const imageSrc = item.image || this.getCategoryFallbackImage(item.category);

    return `
      <div class="item-card spotlight-card" onclick="App.openItemModal('${item.id}')" tabindex="0" role="button" aria-label="View details for ${item.title || 'item'}">
        <div class="item-card-image-wrapper">
          <img src="${imageSrc}" alt="${item.title || 'Campus item'}" class="item-card-image" loading="lazy" />
          <span class="item-status-badge ${typeClass}">${typeLabel}</span>
          <span class="item-category-tag">${item.category || "General"}</span>
        </div>
        <div class="item-card-body">
          <h3 class="item-card-title">${item.title || "Untitled Report"}</h3>
          <div class="item-meta">
            <span class="item-meta-item" title="Campus Location">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${locationDisplay}
            </span>
            <span class="item-meta-item" title="Report Date">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="18" y2="10"></line></svg>
              ${formattedDate}
            </span>
          </div>
          <p class="item-card-snippet">${descSnippet}</p>
          <div class="item-card-footer">
            <span class="item-reporter text-xs text-muted">Reported by ${item.reportedBy?.name || "Student"}</span>
            ${actionBtn}
          </div>
        </div>
      </div>
    `;
  }

  // --- Duplicate Detection During Report ---
  checkDuplicatesOnReport() {
    const title = document.getElementById("report-title")?.value || "";
    const description = document.getElementById("report-description")?.value || "";
    const category = document.getElementById("report-category")?.value || "";
    const location = document.getElementById("report-location")?.value || "";
    const type = document.querySelector("input[name='report-type']:checked")?.value || "found";

    const banner = document.getElementById("duplicate-warning-banner");
    const container = document.getElementById("duplicate-matches-list");

    if (!banner || !container) return;

    if (title.trim().length < 3) {
      banner.classList.add("hidden");
      return;
    }

    const draft = { title, description, category, location, type };
    const allItems = State.getItems();
    const duplicates = duplicateDetector.detectDuplicates(draft, allItems);

    if (duplicates.length > 0) {
      banner.classList.remove("hidden");
      container.innerHTML = duplicates.slice(0, 3).map(match => `
        <div class="duplicate-match-card">
          <div class="duplicate-match-score">${match.score}% match</div>
          <img src="${match.item.image || this.getCategoryFallbackImage(match.item.category)}" class="duplicate-match-thumb" alt="${match.item.title}" />
          <div class="duplicate-match-info">
            <div class="fw-bold">${match.item.title}</div>
            <div class="text-xs text-muted">${match.item.type.toUpperCase()} • ${match.item.location} • ${match.reasons.join(", ")}</div>
          </div>
          <button type="button" class="btn btn-xs btn-outline" onclick="App.openItemModal('${match.item.id}')">
            View Report
          </button>
        </div>
      `).join("");
    } else {
      banner.classList.add("hidden");
    }
  }

  // --- Report Submission (Strict Compulsory Photo Requirement) ---
  async handleReportSubmit() {
    if (!Auth.isLoggedIn()) {
      this.showToast("Please sign in with your university account to submit a report.", "warning");
      this.openAuthModal("login");
      return;
    }

    const imageErrorEl = document.getElementById("report-image-error");
    const imageDropzone = document.getElementById("image-dropzone");

    // STRICT CHECK: An image is compulsory for all submissions
    if (!this.uploadedImageData) {
      if (imageErrorEl) {
        imageErrorEl.textContent = "A photograph of the item is required so owners and campus security can verify it.";
        imageErrorEl.classList.remove("hidden");
      }
      if (imageDropzone) {
        imageDropzone.classList.add("dropzone-error");
        imageDropzone.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      this.showToast("Please upload a photo of the item before submitting.", "error");
      return;
    }

    const title = document.getElementById("report-title").value.trim();
    const type = document.querySelector("input[name='report-type']:checked").value;
    const category = document.getElementById("report-category").value;
    const location = document.getElementById("report-location").value;
    const specificLocation = document.getElementById("report-specific-loc").value.trim();
    const date = document.getElementById("report-date").value;
    const description = document.getElementById("report-description").value.trim();

    if (!title || !category || !location || !date || !description) {
      this.showToast("Please fill out all required fields.", "error");
      return;
    }

    const submitBtn = document.querySelector("#report-form button[type='submit']");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Publishing Report..."; }

    try {
      const newItem = await State.createItem({
        title,
        type,
        category,
        location,
        specificLocation,
        date,
        description,
        image: this.uploadedImageData
      });

      this.showToast(`Your ${type.toUpperCase()} item report has been published to the campus directory!`, "success");

      // Reset form
      document.getElementById("report-form").reset();
      this.uploadedImageData = null;
      const preview = document.getElementById("report-image-preview");
      const placeholder = document.getElementById("upload-placeholder");
      const removeBtn = document.getElementById("btn-remove-image");
      if (preview) {
        preview.src = "";
        preview.classList.add("hidden");
      }
      if (placeholder) placeholder.classList.remove("hidden");
      if (removeBtn) removeBtn.classList.add("hidden");
      if (imageErrorEl) imageErrorEl.classList.add("hidden");
      if (imageDropzone) imageDropzone.classList.remove("dropzone-error");
      document.getElementById("duplicate-warning-banner")?.classList.add("hidden");

      // Navigate to Browse and open the newly created item
      this.navigateTo("browse");
      if (newItem && (newItem.id || newItem._id)) {
        this.openItemModal(newItem.id || newItem._id);
      }
    } catch (err) {
      this.showToast(`Failed to publish report: ${err.message}`, "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Publish Report to Campus Directory"; }
    }
  }

  getCategoryFallbackImage(category) {
    if (window.api && typeof window.api.resolveImageUrl === 'function') {
      return window.api.resolveImageUrl(null, category);
    }
    return "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80";
  }

  // --- Detailed Item Modal ---
  async openItemModal(itemId) {
    let item = State.getItemById(itemId);

    // If item not cached in state, retrieve directly from backend
    if (!item && window.api) {
      try {
        const res = await window.api.get(`/api/items/${itemId}`);
        if (res && res.data) {
          item = State._normalizeItem(res.data);
        }
      } catch (err) {
        // silent
      }
    }

    if (!item) return;

    this.selectedItemForModal = item;

    const modal = document.getElementById("modal-item-detail");
    if (!modal) return;

    // Fill details
    const imgEl = document.getElementById("modal-item-img");
    if (imgEl) imgEl.src = item.image || this.getCategoryFallbackImage(item.category);

    const titleEl = document.getElementById("modal-item-title");
    if (titleEl) titleEl.textContent = item.title || "Item Record";

    const isRecovered = item.status === "recovered";
    const typeLabel = isRecovered ? "RECOVERED" : (item.type ? item.type.toUpperCase() : "FOUND");
    const typeClass = isRecovered ? "badge-recovered" : (item.type === "lost" ? "badge-lost" : "badge-found");

    const badgeEl = document.getElementById("modal-item-badge");
    if (badgeEl) {
      badgeEl.textContent = typeLabel;
      badgeEl.className = `modal-type-badge ${typeClass}`;
    }

    const catEl = document.getElementById("modal-item-category");
    if (catEl) catEl.textContent = item.category || "General";

    const locEl = document.getElementById("modal-item-location");
    if (locEl) locEl.textContent = item.location || "Location not provided";

    const specLocEl = document.getElementById("modal-item-specific-loc");
    if (specLocEl) {
      specLocEl.textContent = item.specificLocation ? `(${item.specificLocation})` : "";
    }

    const dateEl = document.getElementById("modal-item-date");
    if (dateEl) {
      dateEl.textContent = item.date
        ? new Date(item.date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
        : "Date not provided";
    }

    const descEl = document.getElementById("modal-item-desc");
    if (descEl) descEl.textContent = item.description || "No detailed description provided.";

    const repNameEl = document.getElementById("modal-item-reporter-name");
    if (repNameEl) repNameEl.textContent = item.reportedBy?.name || "Sai University Member";

    const repEmailEl = document.getElementById("modal-item-reporter-email");
    if (repEmailEl) repEmailEl.textContent = item.reportedBy?.email || "";

    // Action button
    const claimBtn = document.getElementById("modal-item-claim-btn");
    if (claimBtn) {
      if (item.status === "recovered") {
        claimBtn.textContent = "Item Reunited";
        claimBtn.disabled = true;
        claimBtn.className = "btn btn-secondary";
      } else if (item.type === "found") {
        claimBtn.textContent = "Claim This Item";
        claimBtn.disabled = false;
        claimBtn.className = "btn btn-primary";
        claimBtn.onclick = () => {
          this.closeModal("modal-item-detail");
          this.openClaimModal(item.id);
        };
      } else {
        claimBtn.textContent = "I Found This Item (Contact)";
        claimBtn.disabled = false;
        claimBtn.className = "btn btn-primary";
        claimBtn.onclick = () => {
          alert(`You can contact the reporter ${item.reportedBy?.name || "Student"} directly at: ${item.reportedBy?.email || "lostandfound@saiuniversity.edu.in"}`);
        };
      }
    }

    // "Suggest Location Update" Trigger Button inside Item Modal
    const suggestLocBtn = document.getElementById("modal-suggest-loc-btn");
    if (suggestLocBtn) {
      suggestLocBtn.onclick = () => {
        this.openSuggestLocationModal(item.id);
      };
    }

    // Render Location Update History Timeline
    const locSection = document.getElementById("modal-location-history-section");
    const locHistoryList = document.getElementById("modal-location-history-list");
    if (locSection && locHistoryList) {
      const suggestions = item.locationSuggestions || [];
      if (suggestions.length > 0) {
        locSection.classList.remove("hidden");
        locHistoryList.innerHTML = suggestions.map(s => {
          const statusBadge = s.status === "verified"
            ? `<span class="badge badge-recovered text-xs">VERIFIED</span>`
            : s.status === "declined"
            ? `<span class="badge badge-lost text-xs">DECLINED</span>`
            : `<span class="badge badge-found text-xs">PENDING REVIEW</span>`;

          const adminButtons = Auth.isAdmin() && s.status === "pending"
            ? `
              <div class="loc-sugg-admin-actions mt-2">
                <button type="button" class="btn btn-xs btn-primary" onclick="App.verifyLocationSuggestion('${item.id}', '${s.id}')">Verify &amp; Update Location</button>
                <button type="button" class="btn btn-xs btn-outline" onclick="App.declineLocationSuggestion('${item.id}', '${s.id}')">Decline</button>
              </div>
            `
            : "";

          return `
            <div class="loc-suggestion-card status-${s.status}">
              <div class="loc-sugg-top">
                ${statusBadge}
                <span class="text-xs text-muted">Proposed by ${s.suggestedBy || "Student"} &bull; ${new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="loc-sugg-place">
                <strong>${s.newLocation}</strong> ${s.specificSpot ? `<span class="text-muted">(${s.specificSpot})</span>` : ""}
              </div>
              ${s.note ? `<p class="loc-sugg-note">"${s.note}"</p>` : ""}
              ${adminButtons}
            </div>
          `;
        }).join("");
      } else {
        locSection.classList.add("hidden");
      }
    }

    // Similar Items Suggestions
    const similarContainer = document.getElementById("modal-similar-items");
    const similarMatches = duplicateDetector.findSimilarItems(item, State.getItems());

    if (similarMatches.length > 0) {
      document.getElementById("modal-similar-section")?.classList.remove("hidden");
      if (similarContainer) {
        similarContainer.innerHTML = similarMatches.map(match => `
          <div class="similar-card" onclick="App.openItemModal('${match.item.id}')">
            <img src="${match.item.image || this.getCategoryFallbackImage(match.item.category)}" alt="${match.item.title}" />
            <div class="similar-card-info">
              <span class="badge ${match.item.type === "lost" ? "badge-lost" : "badge-found"} text-xs">${match.item.type.toUpperCase()}</span>
              <div class="similar-card-title">${match.item.title}</div>
              <div class="text-xs text-muted">${match.item.location}</div>
            </div>
          </div>
        `).join("");
      }
    } else {
      document.getElementById("modal-similar-section")?.classList.add("hidden");
    }

    this.openModal("modal-item-detail");
  }

  // --- Location Update Suggestions ---
  openSuggestLocationModal(itemId) {
    const item = State.getItemById(itemId);
    if (!item) return;

    this.suggestingItemId = itemId;
    const titleEl = document.getElementById("suggest-loc-item-title");
    const currentLocEl = document.getElementById("suggest-loc-current");
    const idInput = document.getElementById("suggest-loc-item-id");
    const selectEl = document.getElementById("suggest-new-location");
    const spotInput = document.getElementById("suggest-specific-spot");
    const noteInput = document.getElementById("suggest-note");

    if (titleEl) titleEl.textContent = item.title;
    if (currentLocEl) {
      currentLocEl.textContent = item.location
        ? `${item.location}${item.specificLocation ? " (" + item.specificLocation + ")" : ""}`
        : "Not specified";
    }
    if (idInput) idInput.value = item.id;

    if (selectEl) {
      selectEl.innerHTML = `<option value="">-- Choose New Campus Location --</option>` +
        CAMPUS_LOCATIONS.map(loc => `<option value="${loc}" ${loc === item.location ? "disabled" : ""}>${loc}</option>`).join("");
    }
    if (spotInput) spotInput.value = "";
    if (noteInput) noteInput.value = "";

    this.openModal("modal-suggest-location");
  }

  async handleSuggestLocationSubmit() {
    const idInput = document.getElementById("suggest-loc-item-id");
    const selectEl = document.getElementById("suggest-new-location");
    const spotInput = document.getElementById("suggest-specific-spot");
    const noteInput = document.getElementById("suggest-note");

    const itemId = idInput ? idInput.value : this.suggestingItemId;
    const newLocation = selectEl ? selectEl.value.trim() : "";
    const specificSpot = spotInput ? spotInput.value.trim() : "";
    const note = noteInput ? noteInput.value.trim() : "";

    if (!newLocation) {
      this.showToast("Please choose a campus location for the suggestion.", "error");
      return;
    }

    try {
      await State.suggestLocationUpdate(itemId, {
        location: newLocation,
        specificSpot: specificSpot,
        note: note
      });

      this.closeModal("modal-suggest-location");
      this.showToast("Location suggestion recorded! Campus security and students have been informed.", "success");

      // Refresh item modal to display new suggestion
      if (this.selectedItemForModal && (this.selectedItemForModal.id === itemId || this.selectedItemForModal._id === itemId)) {
        this.openItemModal(itemId);
      }
    } catch (err) {
      this.showToast(`Failed to record suggestion: ${err.message}`, "error");
    }
  }

  async verifyLocationSuggestion(itemId, suggId) {
    try {
      await State.updateLocationSuggestionStatus(itemId, suggId, "verified");
      this.showToast("Location update verified and applied as the official item location!", "success");
      this.openItemModal(itemId);
    } catch (err) {
      this.showToast(`Failed to verify suggestion: ${err.message}`, "error");
    }
  }

  async declineLocationSuggestion(itemId, suggId) {
    try {
      await State.updateLocationSuggestionStatus(itemId, suggId, "declined");
      this.showToast("Location suggestion declined.", "info");
      this.openItemModal(itemId);
    } catch (err) {
      this.showToast(`Failed to decline suggestion: ${err.message}`, "error");
    }
  }

  // --- Claim Modal ---
  openClaimModal(itemId) {
    if (!Auth.isLoggedIn()) {
      this.showToast("Please log in with your university ID to file a claim.", "warning");
      this.openAuthModal("login");
      return;
    }

    const item = State.getItemById(itemId);
    if (!item) return;

    this.selectedItemForModal = item;
    const user = Auth.getCurrentUser();

    document.getElementById("claim-item-id").value = item.id;
    document.getElementById("claim-item-title-display").textContent = item.title;
    document.getElementById("claim-item-loc-display").textContent = `${item.location} • Reported on ${item.date}`;
    document.getElementById("claim-name").value = user.name;
    document.getElementById("claim-email").value = user.email;
    document.getElementById("claim-phone").value = user.phone || "";
    document.getElementById("claim-proof").value = "";

    this.openModal("modal-claim");
  }

  async handleClaimSubmit() {
    const itemId = document.getElementById("claim-item-id").value;
    const phone = document.getElementById("claim-phone").value;
    const proofDescription = document.getElementById("claim-proof").value;

    if (!proofDescription.trim()) {
      this.showToast("Please provide proof of ownership or identifying marks.", "error");
      return;
    }

    const submitBtn = document.querySelector("#claim-form button[type='submit']");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting Claim..."; }

    try {
      await State.createClaim({
        itemId,
        phone,
        proofDescription
      });

      this.closeModal("modal-claim");
      this.showToast("Your ownership claim has been submitted! Campus Security will verify it.", "success");
      this.navigateTo("dashboard");
    } catch (err) {
      if (err.status === 409) {
        this.showToast("Cannot submit claim: This item already has an active claim or is under custody hold.", "error");
      } else {
        this.showToast(`Claim submission failed: ${err.message}`, "error");
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit Ownership Claim"; }
    }
  }

  // --- Student Dashboard ---
  async renderStudentDashboard() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    // Student Header
    const nameEl = document.getElementById("dash-user-name");
    const idEl = document.getElementById("dash-user-id");
    const deptEl = document.getElementById("dash-user-dept");
    if (nameEl) nameEl.textContent = user.name;
    if (idEl) idEl.textContent = user.studentId || "Student Member";
    if (deptEl) deptEl.textContent = user.department || "Sai University";

    // My Reported Items
    const userId = user.id || user._id;
    const allItems = State.getItems();
    const myItems = allItems.filter(i => i.reportedBy && (i.reportedBy.id === userId || i.reportedBy._id === userId));
    const myItemsContainer = document.getElementById("dash-my-items-list");
    const repCountEl = document.getElementById("dash-reported-count");
    if (repCountEl) {
      repCountEl.textContent = `${myItems.length} listing${myItems.length === 1 ? '' : 's'}`;
    }

    if (myItemsContainer) {
      if (myItems.length === 0) {
        myItemsContainer.innerHTML = `
          <div class="empty-state py-4 text-center">
            <p class="text-muted text-sm">You haven't reported any lost or found items yet.</p>
            <button type="button" class="btn btn-primary btn-xs mt-2" onclick="App.navigateTo('report')">
              + Report an Item
            </button>
          </div>
        `;
      } else {
        myItemsContainer.innerHTML = myItems.map(item => `
          <div class="dash-item-card">
            <img src="${item.image || this.getCategoryFallbackImage(item.category)}" class="dash-item-thumb" alt="${item.title}" />
            <div class="dash-item-info">
              <div class="d-flex gap-2 align-items-center mb-1">
                <span class="badge ${item.type === "lost" ? "badge-lost" : "badge-found"} text-xs">${item.type.toUpperCase()}</span>
                <span class="badge badge-status-${item.status} text-xs">${item.status.toUpperCase()}</span>
              </div>
              <h4 class="dash-item-title">${item.title}</h4>
              <div class="text-xs text-muted">${item.location} &bull; ${item.date}</div>
            </div>
            <div class="dash-item-actions">
              <button class="btn btn-outline btn-xs" onclick="App.openEditItemModal('${item.id}')">
                Edit
              </button>
              <button class="btn btn-outline btn-xs" style="color: var(--danger); border-color: rgba(220, 38, 38, 0.3);" onclick="App.deleteMyItem('${item.id}')">
                Delete
              </button>
            </div>
          </div>
        `).join("");
      }
    }

    // My Claims
    try {
      await State.fetchClaims();
    } catch (err) {
      // silent
    }
    const myClaims = State.getClaimsByClaimant(userId);
    const myClaimsContainer = document.getElementById("dash-my-claims-list");
    const claimCountEl = document.getElementById("dash-claims-count");
    if (claimCountEl) {
      claimCountEl.textContent = `${myClaims.length} claim${myClaims.length === 1 ? '' : 's'}`;
    }

    if (myClaimsContainer) {
      if (myClaims.length === 0) {
        myClaimsContainer.innerHTML = `
          <div class="empty-state py-4 text-center">
            <p class="text-muted text-sm">You have no active claims currently filed.</p>
          </div>
        `;
      } else {
        myClaimsContainer.innerHTML = myClaims.map(claim => `
          <div class="dash-claim-card">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h4 class="dash-claim-title">${claim.itemTitle}</h4>
              <span class="badge badge-claim-${claim.status} text-xs">${claim.status.toUpperCase()}</span>
            </div>
            <p class="text-xs text-muted mb-1" style="line-height: 1.5;"><strong>Proof Details:</strong> "${claim.proofDescription}"</p>
            ${claim.adminNotes ? `<div class="claim-admin-note text-xs mt-1"><strong>Security Desk:</strong> ${claim.adminNotes}</div>` : ""}
            <div class="text-xs text-muted mt-2">Submitted: ${new Date(claim.submittedAt || Date.now()).toLocaleDateString()}</div>
          </div>
        `).join("");
      }
    }
  }

  async deleteMyItem(itemId) {
    if (!confirm("Are you sure you want to delete this listing from the portal?")) {
      return;
    }

    try {
      await State.deleteItem(itemId);
      this.showToast("Listing removed successfully.", "info");
      await this.renderStudentDashboard();
    } catch (err) {
      if (err.status === 409) {
        this.showToast("Cannot delete listing: An active claim is currently under review for this item.", "error");
      } else {
        this.showToast(`Failed to delete listing: ${err.message}`, "error");
      }
    }
  }

  openEditItemModal(itemId) {
    const item = State.getItemById(itemId);
    if (!item) return;

    document.getElementById("edit-item-id").value = item.id;
    document.getElementById("edit-title").value = item.title;
    document.getElementById("edit-category").value = item.category;
    document.getElementById("edit-location").value = item.location;
    document.getElementById("edit-specific-loc").value = item.specificLocation || "";
    document.getElementById("edit-description").value = item.description;

    this.openModal("modal-edit-item");
  }

  async handleEditSubmit() {
    const id = document.getElementById("edit-item-id").value;
    const title = document.getElementById("edit-title").value.trim();
    const category = document.getElementById("edit-category").value;
    const location = document.getElementById("edit-location").value;
    const specificLocation = document.getElementById("edit-specific-loc").value.trim();
    const description = document.getElementById("edit-description").value.trim();

    try {
      await State.updateItem(id, { title, category, location, specificLocation, description });
      this.closeModal("modal-edit-item");
      this.showToast("Item details updated successfully!", "success");
      await this.renderStudentDashboard();
    } catch (err) {
      this.showToast(`Failed to update item: ${err.message}`, "error");
    }
  }

  // --- Notifications ---
  async renderNotificationsList() {
    const container = document.getElementById("notifications-container");
    if (!container) return;

    const user = Auth.getCurrentUser();
    if (!user) {
      container.innerHTML = `<p class="p-3 text-muted text-center text-xs">Please log in to view notifications.</p>`;
      return;
    }

    try {
      await State.fetchNotifications({ limit: 20 });
    } catch (err) {
      // silent
    }

    const notifs = State.getNotifications(user.id || user._id);

    if (notifs.length === 0) {
      container.innerHTML = `<p class="p-4 text-muted text-center text-xs">No notifications yet.</p>`;
      return;
    }

    container.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read ? "read" : "unread"}" onclick="App.handleNotificationClick('${n.id}')" style="cursor: pointer;">
        <div class="fw-bold text-sm">${n.title}</div>
        <p class="text-xs text-muted mt-1 mb-1">${n.message}</p>
        <span class="text-xs text-light-muted">${new Date(n.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `).join("");
  }

  async handleNotificationClick(notifId) {
    await State.markNotificationRead(notifId);
    this.renderNotificationsList();
    Auth.updateNotificationBadge();
  }

  async markAllNotifsRead() {
    const user = Auth.getCurrentUser();
    if (user) {
      await State.markAllNotificationsRead(user.id || user._id);
      this.showToast("All notifications marked as read.", "info");
      this.renderNotificationsList();
      Auth.updateNotificationBadge();
    }
  }

  // --- Modal Utilities ---
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  openAuthModal(tab = "login") {
    this.openModal("modal-auth");
    this.switchAuthTab(tab);
  }

  switchAuthTab(tab) {
    const loginForm = document.getElementById("form-login");
    const regForm = document.getElementById("form-register");
    const btnTabLogin = document.getElementById("tab-login-btn");
    const btnTabReg = document.getElementById("tab-register-btn");

    if (tab === "login") {
      loginForm?.classList.remove("hidden");
      regForm?.classList.add("hidden");
      btnTabLogin?.classList.add("active");
      btnTabReg?.classList.remove("active");
    } else {
      loginForm?.classList.add("hidden");
      regForm?.classList.remove("hidden");
      btnTabLogin?.classList.remove("active");
      btnTabReg?.classList.add("active");
    }
  }

  // --- Toast Notification System ---
  showToast(message, type = "info") {
    const toastArea = document.getElementById("toast-area");
    if (!toastArea) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌"
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || "ℹ️"}</span>
      <span class="toast-message">${message}</span>
    `;

    toastArea.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
}

// Global instance initialization on DOM load
document.addEventListener("DOMContentLoaded", () => {
  window.App = new Application();
});
