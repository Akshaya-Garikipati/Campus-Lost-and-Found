/**
 * InSearch — Sai University Lost & Found Portal
 * Authentication & Authorization Controller (js/auth.js)
 * Real JWT Session Management & RBAC
 */

class AuthController {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    this.currentUser = State.getCurrentUser();

    State.subscribe("auth:change", user => {
      this.currentUser = user;
      this.updateUI();
      if (user) {
        this.updateNotificationBadge();
      }
    });

    State.subscribe("auth:expired", () => {
      this.currentUser = null;
      this.updateUI();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Your session has expired. Please sign in again.", "warning");
      }
    });

    // Attempt cryptographic session restoration if token exists
    await this.restoreSession();
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  isAdmin() {
    return !!(this.currentUser && this.currentUser.role === "admin");
  }

  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Restores user session using GET /api/auth/me
   */
  async restoreSession() {
    if (!window.api) return;
    const token = window.api.getToken();
    if (!token) {
      if (this.currentUser) {
        State.setCurrentUser(null);
      }
      return;
    }

    try {
      const res = await window.api.get('/api/auth/me');
      if (res && res.success && res.user) {
        State.setCurrentUser(res.user, token);
      } else {
        this.logout();
      }
    } catch (err) {
      if (err.status === 401) {
        this.logout();
      }
    }
  }

  /**
   * Login student or admin via POST /api/auth/login
   */
  async login(email, password) {
    if (!email || !password) {
      return { success: false, message: "Please provide both university email and password." };
    }

    try {
      const res = await window.api.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password: password
      });

      if (res && res.token && res.user) {
        State.setCurrentUser(res.user, res.token);
        return {
          success: true,
          user: res.user,
          message: res.message || `Welcome back, ${res.user.name}!`
        };
      }
      return { success: false, message: res.message || "Authentication failed." };
    } catch (err) {
      return {
        success: false,
        message: err.message || "Invalid university email or password."
      };
    }
  }

  /**
   * Quick login helper for demo & viva presentation via POST /api/auth/demo-login
   * Returns failure when demo login is disabled, allowing user to log in with password.
   */
  async quickLogin(role = "student") {
    try {
      const res = await window.api.post('/api/auth/demo-login', { role });
      if (res && res.token && res.user) {
        State.setCurrentUser(res.user, res.token);
        return { success: true, user: res.user, message: res.message };
      }
      return { success: false, message: res?.message || "Demo login failed." };
    } catch (err) {
      if (err.status === 403) {
        return {
          success: false,
          disabled: true,
          message: err.message || "Quick demo login is disabled on this server. Please sign in using your university credentials."
        };
      }
      return {
        success: false,
        message: err.message || "Demo login failed. Please sign in with your email and password."
      };
    }
  }

  /**
   * Register a new student via POST /api/auth/register
   */
  async register(formData) {
    const { name, email, studentId, department, phone, password } = formData;

    if (!name || !email || !studentId || !password) {
      return {
        success: false,
        message: "Please fill in all required fields (Name, Email, Student ID, Password)."
      };
    }

    try {
      const res = await window.api.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        studentId: studentId.trim().toUpperCase(),
        department: department || "School of Computing & Data Science",
        phone: phone ? phone.trim() : "",
        password: password
      });

      if (res && res.token && res.user) {
        State.setCurrentUser(res.user, res.token);
        return {
          success: true,
          user: res.user,
          message: res.message || "Registration successful! Welcome to InSearch."
        };
      }
      return { success: false, message: res.message || "Registration failed." };
    } catch (err) {
      return {
        success: false,
        message: err.message || "Registration failed. An account with this email or Student ID may already exist."
      };
    }
  }

  logout() {
    State.setCurrentUser(null);
  }

  /**
   * Synchronize top bar, buttons, and navigation depending on user role
   */
  updateUI() {
    const user = this.currentUser;
    const authLoggedOutView = document.getElementById("auth-logged-out");
    const authLoggedInView = document.getElementById("auth-logged-in");
    const userNameEl = document.getElementById("nav-user-name");
    const userRoleBadgeEl = document.getElementById("nav-user-role");
    const userAvatarEl = document.getElementById("nav-user-avatar");
    const adminNavTab = document.getElementById("nav-tab-admin");
    const adminMobileTab = document.getElementById("mobile-tab-admin");
    const studentDashNav = document.getElementById("nav-tab-dashboard");

    if (user) {
      if (authLoggedOutView) authLoggedOutView.classList.add("hidden");
      if (authLoggedInView) authLoggedInView.classList.remove("hidden");

      if (userNameEl) userNameEl.textContent = user.name;
      if (userRoleBadgeEl) {
        userRoleBadgeEl.textContent = (user.role || "student").toUpperCase();
        userRoleBadgeEl.className = `role-badge ${user.role === "admin" ? "badge-admin" : "badge-student"}`;
      }
      if (userAvatarEl) {
        userAvatarEl.src = user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80";
        userAvatarEl.alt = user.name;
      }

      if (studentDashNav) studentDashNav.classList.remove("hidden");

      // Show Admin tab only for admin role
      const isAdmin = user.role === "admin";
      if (adminNavTab) {
        if (isAdmin) adminNavTab.classList.remove("hidden");
        else adminNavTab.classList.add("hidden");
      }
      if (adminMobileTab) {
        if (isAdmin) adminMobileTab.classList.remove("hidden");
        else adminMobileTab.classList.add("hidden");
      }
    } else {
      if (authLoggedOutView) authLoggedOutView.classList.remove("hidden");
      if (authLoggedInView) authLoggedInView.classList.add("hidden");
      if (adminNavTab) adminNavTab.classList.add("hidden");
      if (adminMobileTab) adminMobileTab.classList.add("hidden");
      if (studentDashNav) studentDashNav.classList.add("hidden");
    }

    // Refresh notifications count
    this.updateNotificationBadge();
  }

  async updateNotificationBadge() {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;

    if (!this.currentUser) {
      badge.classList.add("hidden");
      return;
    }

    try {
      if (window.api && window.api.getToken()) {
        const res = await window.api.get('/api/notifications', { limit: 1 });
        const unread = (res && typeof res.unreadCount === 'number') ? res.unreadCount : 0;
        State.unreadNotificationCount = unread;
        if (unread > 0) {
          badge.textContent = unread > 9 ? "9+" : unread;
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
        return;
      }
    } catch (err) {
      // silent fallback
    }

    const unread = State.unreadNotificationCount || 0;
    if (unread > 0) {
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

// Global instance
window.Auth = new AuthController();
