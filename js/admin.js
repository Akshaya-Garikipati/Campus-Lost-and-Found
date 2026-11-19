/**
 * InSearch — Sai University Lost & Found Portal
 * Admin Dashboard Controller & Analytics Visualizations (js/admin.js)
 * Fully connected to Live Backend APIs: Users, Items, Claims
 */

class AdminController {
  constructor() {
    this.activeTab = "analytics";
    this.statusFilter = "all";
    this.dateFilter = "all";
    this.searchQuery = "";
    this.analyticsItems = [];
    this.totalUsersCount = 0;
    this.init();
  }

  init() {
    State.subscribe("items:change", () => this.refreshIfActive());
    State.subscribe("claims:change", () => this.refreshIfActive());
    State.subscribe("auth:change", () => this.refreshIfActive());
    State.subscribe("users:change", () => this.refreshIfActive());
  }

  refreshIfActive() {
    const adminSection = document.getElementById("view-admin");
    if (adminSection && !adminSection.classList.contains("hidden")) {
      this.render();
    }
  }

  async render() {
    if (!Auth.isAdmin()) {
      const container = document.getElementById("admin-content-area");
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔒</div>
            <h3>Admin Access Restricted</h3>
            <p>You must be signed in with a Sai University Admin account to access this dashboard.</p>
            <button class="btn btn-primary" onclick="App.handleQuickLogin('admin');">
              Switch to Campus Security Admin
            </button>
          </div>
        `;
      }
      return;
    }

    // 1. Fetch comprehensive live backend data for moderation and global analytics
    await Promise.all([
      this.loadAllAnalyticsItems(),
      State.fetchClaims({ limit: 50 }),
      this.loadUsersData()
    ]);

    // 2. Render UI views and Canvas visual components
    this.renderKPIs();
    this.renderAnalyticsCharts();
    this.renderClaimsTable();
    this.renderItemsTable();
    this.renderUsersTable();
  }

  /**
   * Retrieves all required items globally across pages for accurate category & location analytics
   */
  async loadAllAnalyticsItems() {
    if (!window.api) return;
    try {
      // Fetch up to 50 items (maximum allowed limit per query schema) for charts
      const res = await window.api.get('/api/items', { limit: 50 });
      if (res && res.data) {
        this.analyticsItems = res.data.map(i => ({
          ...i,
          id: i._id || i.id,
          image: window.api.resolveImageUrl(i.image, i.category)
        }));
      } else {
        this.analyticsItems = State.getItems();
      }
    } catch (err) {
      console.warn("Failed to load global analytics items:", err.message);
      this.analyticsItems = State.getItems();
    }
  }

  /**
   * Loads users directory from GET /api/users
   */
  async loadUsersData() {
    try {
      const res = await State.fetchUsers({ limit: 100 });
      this.totalUsersCount = (res && typeof res.total === 'number') ? res.total : State.getUsers().length;
    } catch (err) {
      this.totalUsersCount = State.getUsers().length;
    }
  }

  // --- KPI Cards ---
  renderKPIs() {
    const items = this.analyticsItems.length > 0 ? this.analyticsItems : State.getItems();
    const claims = State.getClaims();

    const totalUsers = this.totalUsersCount || State.getUsers().length;
    const totalLost = items.filter(i => i.type === "lost" && i.status !== "recovered").length;
    const totalFound = items.filter(i => i.type === "found" && i.status !== "recovered").length;
    const totalRecovered = items.filter(i => i.status === "recovered").length;
    const pendingClaims = claims.filter(c => c.status === "pending").length;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal("kpi-total-users", totalUsers);
    setVal("kpi-total-lost", totalLost);
    setVal("kpi-total-found", totalFound);
    setVal("kpi-total-recovered", totalRecovered);
    setVal("kpi-pending-claims", pendingClaims);
  }

  // --- Canvas Charts ---
  renderAnalyticsCharts() {
    this.drawLocationBarChart();
    this.drawCategoryChart();
  }

  drawLocationBarChart() {
    const canvas = document.getElementById("chart-locations");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const items = this.analyticsItems.length > 0 ? this.analyticsItems : State.getItems();

    // Group items by campus location
    const counts = {};
    CAMPUS_LOCATIONS.forEach(loc => {
      counts[loc] = { lost: 0, found: 0 };
    });

    items.forEach(item => {
      if (!counts[item.location]) counts[item.location] = { lost: 0, found: 0 };
      if (item.type === "lost") counts[item.location].lost++;
      else counts[item.location].found++;
    });

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = (canvas.width = (rect.width || 560) * dpr);
    const height = (canvas.height = 260 * dpr);
    ctx.scale(dpr, dpr);

    const chartW = width / dpr;
    const chartH = height / dpr;

    ctx.clearRect(0, 0, chartW, chartH);

    const locations = Object.keys(counts);
    const maxVal = Math.max(5, ...locations.map(l => Math.max(counts[l].lost, counts[l].found)));

    const paddingLeft = 45;
    const paddingBottom = 45;
    const paddingTop = 20;
    const paddingRight = 20;

    const graphW = chartW - paddingLeft - paddingRight;
    const graphH = chartH - paddingTop - paddingBottom;

    // Draw horizontal grid lines
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "right";

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = paddingTop + (graphH / gridLines) * i;
      const val = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(chartW - paddingRight, y);
      ctx.stroke();
      ctx.fillText(val, paddingLeft - 8, y + 4);
    }

    // Draw bars
    const barGroupWidth = graphW / locations.length;
    const singleBarW = Math.max(8, barGroupWidth * 0.28);

    locations.forEach((loc, idx) => {
      const groupX = paddingLeft + idx * barGroupWidth;
      const lostH = (counts[loc].lost / maxVal) * graphH;
      const foundH = (counts[loc].found / maxVal) * graphH;

      // Lost Bar (Terracotta Crimson)
      const lostX = groupX + barGroupWidth * 0.18;
      const lostY = paddingTop + graphH - lostH;
      ctx.fillStyle = "#C54432";
      this._roundRect(ctx, lostX, lostY, singleBarW, lostH, 4);

      // Found Bar (Fjord Teal)
      const foundX = lostX + singleBarW + 4;
      const foundY = paddingTop + graphH - foundH;
      ctx.fillStyle = "#1F7A8C";
      this._roundRect(ctx, foundX, foundY, singleBarW, foundH, 4);

      // Label below
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.font = "10px Inter, sans-serif";
      const shortName = loc.replace("Academic Block ", "Block ").replace("Student ", "");
      ctx.fillText(shortName, groupX + barGroupWidth / 2, chartH - 18);
    });
  }

  drawCategoryChart() {
    const canvas = document.getElementById("chart-categories");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const items = this.analyticsItems.length > 0 ? this.analyticsItems : State.getItems();

    // Count by category
    const catCounts = {};
    items.forEach(i => {
      if (i.category) {
        catCounts[i.category] = (catCounts[i.category] || 0) + 1;
      }
    });

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = (canvas.width = (rect.width || 360) * dpr);
    const height = (canvas.height = 260 * dpr);
    ctx.scale(dpr, dpr);

    const chartW = width / dpr;
    const chartH = height / dpr;
    ctx.clearRect(0, 0, chartW, chartH);

    const colors = ["#2D7A58", "#1F7A8C", "#C54432", "#D97706", "#16A34A", "#52B788", "#64748B"];
    const entries = Object.entries(catCounts);
    const total = items.length || 1;

    let startAngle = -0.5 * Math.PI;
    const centerX = chartW * 0.35;
    const centerY = chartH * 0.5;
    const radius = Math.min(centerX, centerY) - 25;
    const innerRadius = radius * 0.58;

    entries.forEach(([cat, count], idx) => {
      const sliceAngle = (count / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(items.length, centerX, centerY + 2);
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("Total Items", centerX, centerY + 18);

    // Legend on the right side
    const legendX = chartW * 0.68;
    let legendY = 35;
    ctx.textAlign = "left";
    ctx.font = "11px Inter, sans-serif";

    entries.slice(0, 6).forEach(([cat, count], idx) => {
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(legendX, legendY - 8, 10, 10);
      ctx.fillStyle = "#334155";
      const pct = Math.round((count / total) * 100);
      ctx.fillText(`${cat.split(" ")[0]} (${pct}%)`, legendX + 16, legendY);
      legendY += 26;
    });
  }

  _roundRect(ctx, x, y, width, height, radius) {
    if (height < 2) return;
    const r = Math.min(radius, width / 2, height);
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }

  // --- Claims Moderation Table ---
  renderClaimsTable() {
    const tableBody = document.getElementById("admin-claims-tbody");
    if (!tableBody) return;

    const claims = State.getClaims();

    if (claims.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No claims submitted yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = claims.map(claim => {
      const item = State.getItemById(claim.itemId) || { title: claim.itemTitle, location: "Campus" };
      const dateFormatted = new Date(claim.submittedAt || Date.now()).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const statusBadge = `
        <span class="badge badge-claim-${claim.status}">
          ${claim.status.toUpperCase()}
        </span>
      `;

      const actions = claim.status === "pending"
        ? `
          <div class="table-actions">
            <button class="btn btn-xs btn-success" onclick="Admin.handleClaimAction('${claim.id}', 'approve')">
              ✓ Approve
            </button>
            <button class="btn btn-xs btn-danger" onclick="Admin.handleClaimAction('${claim.id}', 'reject')">
              ✗ Reject
            </button>
          </div>
        `
        : `<span class="text-muted text-xs">${claim.adminNotes ? `Note: ${claim.adminNotes}` : "Processed"}</span>`;

      return `
        <tr>
          <td>
            <div class="fw-bold">${claim.itemTitle}</div>
            <div class="text-xs text-muted">Item ID: ${claim.itemId}</div>
          </td>
          <td>
            <div class="fw-medium">${claim.claimantName}</div>
            <div class="text-xs text-muted">${claim.claimantEmail}</div>
            <div class="text-xs text-muted">${claim.claimantPhone || ""}</div>
          </td>
          <td>
            <div class="claim-proof-snippet" title="${claim.proofDescription}">
              "${claim.proofDescription}"
            </div>
          </td>
          <td><span class="text-xs">${dateFormatted}</span></td>
          <td>${statusBadge}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join("");
  }

  async handleClaimAction(claimId, action) {
    const claim = State.getClaims().find(c => c.id === claimId);
    if (!claim) return;

    const actionText = action === "approve" ? "APPROVE this claim and mark the item as RECOVERED" : "REJECT this claim";
    const note = prompt(
      `Enter notes/instructions for ${claim.claimantName} (${action === "approve" ? "Approval notes" : "Reason for rejection"}):`,
      action === "approve" ? "Verified ownership. Available for collection from designated authority." : "Proof marks do not match item."
    );

    if (note === null) return; // User cancelled prompt

    try {
      await State.updateClaimStatus(claimId, action, note);
      App.showToast(`Claim ${action === 'approve' ? 'approved' : 'rejected'} successfully!`, "success");
      await this.render();
    } catch (err) {
      App.showToast(`Failed to update claim: ${err.message}`, "error");
    }
  }

  // --- All Items Management Table ---
  renderItemsTable() {
    const tableBody = document.getElementById("admin-items-tbody");
    if (!tableBody) return;

    let items = this.analyticsItems.length > 0 ? this.analyticsItems : State.getItems();

    // Filter by status
    if (this.statusFilter !== "all") {
      items = items.filter(i => i.status === this.statusFilter || i.type === this.statusFilter);
    }

    // Filter by search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(i =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }

    if (items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No items matching criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = items.map(item => {
      const statusBadge = `<span class="badge badge-status-${item.status}">${item.status.toUpperCase()}</span>`;
      const typeBadge = `<span class="badge ${item.type === "lost" ? "badge-lost" : "badge-found"}">${item.type.toUpperCase()}</span>`;

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <img src="${item.image}" class="table-thumb" alt="${item.title}" />
              <div>
                <div class="fw-bold text-sm">${item.title}</div>
                <div class="text-xs text-muted">${item.category}</div>
              </div>
            </div>
          </td>
          <td>${typeBadge}</td>
          <td>${statusBadge}</td>
          <td>${item.location}</td>
          <td><span class="text-xs">${item.date}</span></td>
          <td>
            <div class="text-xs fw-medium">${item.reportedBy?.name || "Student"}</div>
            <div class="text-xs text-muted">${item.reportedBy?.email || ""}</div>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn btn-xs btn-outline" onclick="App.openItemModal('${item.id}')">View</button>
              <button class="btn btn-xs btn-danger" onclick="Admin.deleteItem('${item.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async deleteItem(itemId) {
    if (!confirm("Are you sure you want to permanently delete this item listing? This action cannot be undone.")) {
      return;
    }

    try {
      await State.deleteItem(itemId);
      App.showToast("Item listing deleted successfully.", "success");
      await this.render();
    } catch (err) {
      App.showToast(`Cannot delete item: ${err.message}`, "error");
    }
  }

  // --- Users Management Table (Live from GET /api/users) ---
  renderUsersTable() {
    const tableBody = document.getElementById("admin-users-tbody");
    if (!tableBody) return;

    const users = State.getUsers();
    const items = this.analyticsItems.length > 0 ? this.analyticsItems : State.getItems();
    const claims = State.getClaims();

    if (users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No users found in directory.</td></tr>`;
      return;
    }

    tableBody.innerHTML = users.map(user => {
      const userId = user.id || user._id;
      const userItems = items.filter(i => (i.reportedBy && (i.reportedBy.id === userId || i.reportedBy._id === userId))).length;
      const userClaims = claims.filter(c => (c.claimantId === userId || c.claimant?._id === userId)).length;
      const avatarSrc = user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=7C3AED&textColor=ffffff`;

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <img src="${avatarSrc}" class="avatar-sm" alt="${user.name}" />
              <div>
                <div class="fw-bold">${user.name}</div>
                <div class="text-xs text-muted">${user.studentId || "ADMIN"}</div>
              </div>
            </div>
          </td>
          <td>${user.email}</td>
          <td><span class="role-badge ${user.role === "admin" ? "badge-admin" : "badge-student"}">${(user.role || "student").toUpperCase()}</span></td>
          <td>${user.department || "School of Computing & Data Science"}</td>
          <td>${userItems} ${userItems === 1 ? 'item' : 'items'}</td>
          <td>${userClaims} ${userClaims === 1 ? 'claim' : 'claims'}</td>
        </tr>
      `;
    }).join("");
  }

  setFilter(status) {
    this.statusFilter = status;
    this.renderItemsTable();
  }

  setSearch(q) {
    this.searchQuery = q;
    this.renderItemsTable();
  }
}

// Global instance
window.Admin = new AdminController();
