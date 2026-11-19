/**
 * InSearch — Sai University Lost & Found Portal
 * Studio Theme Engine (Light / Dark Mode) & Interactive Controllers
 * Inspired by meech213, snogproductions, and pacomepertant
 */

const ThemeManager = {
  currentMode: "dark", // default to obsidian studio dark mode

  init() {
    // 1. Read saved mode from localStorage or system preference
    const saved = localStorage.getItem("insearch_theme_mode");
    if (saved === "light" || saved === "dark") {
      this.setMode(saved, false);
    } else {
      // Default to dark studio mode
      this.setMode("dark", false);
    }

    // 2. Floating header scroll effect
    this.initHeaderScroll();

    // 3. Spotlight Physics for cursor-reactive cards
    this.initSpotlight();
  },

  /**
   * Set theme mode: 'dark' or 'light'
   */
  setMode(mode, save = true) {
    this.currentMode = mode;
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Update segmented toggle buttons
    const lightOpt = document.getElementById("opt-light");
    const darkOpt = document.getElementById("opt-dark");
    if (lightOpt && darkOpt) {
      if (mode === "dark") {
        darkOpt.classList.add("active");
        lightOpt.classList.remove("active");
      } else {
        lightOpt.classList.add("active");
        darkOpt.classList.remove("active");
      }
    }

    if (save) {
      localStorage.setItem("insearch_theme_mode", mode);
    }

    // Trigger chart redraw if Admin console is active
    if (window.Admin && typeof window.Admin.renderCharts === "function") {
      try {
        window.Admin.renderCharts();
      } catch (e) {
        // Safe fallback
      }
    }
  },

  /**
   * Toggle between light and dark mode
   */
  toggleMode() {
    const nextMode = this.currentMode === "dark" ? "light" : "dark";
    this.setMode(nextMode);
  },

  /**
   * Floating transparent header scroll glass effect
   */
  initHeaderScroll() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    const handleScroll = () => {
      if (window.scrollY > 20) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  },

  /**
   * Cursor-reactive spotlight physics for machined glass lighting
   */
  initSpotlight() {
    document.addEventListener("mousemove", (e) => {
      const cards = document.querySelectorAll(".spotlight-card, .item-card");
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (
          e.clientX >= rect.left - 80 && e.clientX <= rect.right + 80 &&
          e.clientY >= rect.top - 80 && e.clientY <= rect.bottom + 80
        ) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty("--mouse-x", `${x}px`);
          card.style.setProperty("--mouse-y", `${y}px`);
        }
      });
    }, { passive: true });
  },

  /**
   * Kinetic morphing text in hero headline
   */
  initTextMorph() {
    const el = document.getElementById("hero-morph-text");
    if (!el) return;

    const words = [
      "AirPods Pro",
      "Student ID Card",
      "Titan Watch",
      "MacBook Charger",
      "Calculus Notes",
      "Hydro Flask",
      "Room Keycard"
    ];
    let currentIndex = 0;

    setInterval(() => {
      el.classList.add("morph-exit");
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % words.length;
        el.textContent = words[currentIndex];
        el.classList.remove("morph-exit");
        el.classList.add("morph-enter");
        
        // Force reflow
        void el.offsetWidth;

        requestAnimationFrame(() => {
          el.classList.remove("morph-enter");
        });
      }, 300);
    }, 2800);
  },

  /**
   * Interactive hero showcase carousel with auto-play & pause
   */
  initCarousel() {
    const track = document.getElementById("hero-carousel-track");
    const slides = document.querySelectorAll(".hero-carousel-slide");
    const dots = document.querySelectorAll(".carousel-dot");
    const prevBtn = document.getElementById("carousel-prev");
    const nextBtn = document.getElementById("carousel-next");
    const container = document.getElementById("hero-carousel-container");

    if (!track || slides.length === 0) return;

    let currentSlide = 0;
    const totalSlides = slides.length;
    let autoPlayTimer = null;

    const goToSlide = (index) => {
      currentSlide = (index + totalSlides) % totalSlides;
      track.style.transform = `translateX(-${currentSlide * 100}%)`;
      dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === currentSlide);
      });
    };

    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        goToSlide(currentSlide - 1);
        resetAutoPlay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        goToSlide(currentSlide + 1);
        resetAutoPlay();
      });
    }

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const slideIdx = parseInt(dot.dataset.slide, 10);
        goToSlide(slideIdx);
        resetAutoPlay();
      });
    });

    const startAutoPlay = () => {
      stopAutoPlay();
      autoPlayTimer = setInterval(() => {
        goToSlide(currentSlide + 1);
      }, 4500);
    };

    const stopAutoPlay = () => {
      if (autoPlayTimer) clearInterval(autoPlayTimer);
    };

    const resetAutoPlay = () => {
      stopAutoPlay();
      startAutoPlay();
    };

    if (container) {
      container.addEventListener("mouseenter", stopAutoPlay);
      container.addEventListener("mouseleave", startAutoPlay);
    }

    startAutoPlay();
  }
};

// Global shorthand for console & UI access
window.Theme = ThemeManager;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
});
