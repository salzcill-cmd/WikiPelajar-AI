/* ============================================
   WikiPelajar AI - Main Application Script
   Version: 1.0.0
   Description: Complete application logic with
   modular architecture and API integration
   ============================================ */

(function () {
  'use strict';

  // ==========================================
  // Configuration
  // ==========================================
  const CONFIG = {
    WIKIPEDIA_API: 'https://id.wikipedia.org/api/rest_v1',
    WIKIPEDIA_API_FEED: 'https://id.wikipedia.org/api/rest_v1/feed',
    WIKIPEDIA_SEARCH: 'https://id.wikipedia.org/w/api.php',
    WIKIPEDIA_SUMMARY: 'https://id.wikipedia.org/api/rest_v1/page/summary',
    DEBOUNCE_DELAY: 400,
    MAX_BOOKMARKS: 100,
    MAX_HISTORY: 50,
    ANIMATION_DURATION: 300,
  };

  // ==========================================
  // State Management
  // ==========================================
  const Store = {
    get(key, defaultValue = null) {
      try {
        const data = localStorage.getItem(`wikipelajar_${key}`);
        return data ? JSON.parse(data) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(`wikipelajar_${key}`, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(`wikipelajar_${key}`);
        return true;
      } catch {
        return false;
      }
    },

    bookmarks: {
      getAll() {
        return Store.get('bookmarks', []);
      },
      add(item) {
        const items = Store.get('bookmarks', []);
        if (items.some((i) => i.title === item.title)) return false;
        items.unshift({ ...item, savedAt: new Date().toISOString() });
        if (items.length > CONFIG.MAX_BOOKMARKS) items.pop();
        Store.set('bookmarks', items);
        return true;
      },
      remove(title) {
        const items = Store.get('bookmarks', []);
        const filtered = items.filter((i) => i.title !== title);
        Store.set('bookmarks', filtered);
        return filtered.length !== items.length;
      },
      isBookmarked(title) {
        return Store.get('bookmarks', []).some((i) => i.title === title);
      },
    },

    history: {
      getAll() {
        return Store.get('history', []);
      },
      add(item) {
        let items = Store.get('history', []);
        items = items.filter((i) => i.title !== item.title);
        items.unshift({ ...item, viewedAt: new Date().toISOString() });
        if (items.length > CONFIG.MAX_HISTORY) items.pop();
        Store.set('history', items);
        return true;
      },
      clear() {
        Store.set('history', []);
      },
    },

    settings: {
      get() {
        const settings = Store.get('settings', {});
        return {
          fontSize: settings.fontSize || 'md',
          dyslexiaMode: settings.dyslexiaMode || false,
          highContrast: settings.highContrast || false,
          ...settings,
        };
      },
      update(key, value) {
        const settings = Store.get('settings', {});
        settings[key] = value;
        Store.set('settings', settings);
        return settings;
      },
    },

    searchHistory: {
      getAll() {
        return Store.get('searchHistory', []);
      },
      add(query) {
        let items = Store.get('searchHistory', []);
        items = items.filter((i) => i.toLowerCase() !== query.toLowerCase());
        items.unshift(query);
        if (items.length > 10) items.pop();
        Store.set('searchHistory', items);
        return items;
      },
      clear() {
        Store.set('searchHistory', []);
      },
    },

    quizResults: {
      getAll() {
        return Store.get('quizResults', []);
      },
      add(result) {
        const items = Store.get('quizResults', []);
        items.unshift({ ...result, date: new Date().toISOString() });
        if (items.length > 20) items.pop();
        Store.set('quizResults', items);
        return items;
      },
    },
  };

  // ==========================================
  // DOM Utilities
  // ==========================================
  const DOM = {
    $: (selector, context = document) => context.querySelector(selector),
    $$: (selector, context = document) => [...context.querySelectorAll(selector)],
    create(tag, attrs = {}, children = []) {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') el.className = value;
        else if (key === 'style' && typeof value === 'object')
          Object.assign(el.style, value);
        else if (key.startsWith('data')) el.dataset[key.slice(5).toLowerCase()] = value;
        else if (key === 'innerHTML') el.innerHTML = value;
        else el.setAttribute(key, value);
      });
      children.forEach((child) => {
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else if (child instanceof Node) el.appendChild(child);
      });
      return el;
    },
    sanitize(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    truncate(str, len = 100) {
      if (!str) return '';
      return str.length > len ? str.slice(0, len).trim() + '...' : str;
    },
    formatDate(dateStr) {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'Baru saja';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} hari lalu`;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    estimateReadingTime(text) {
      const words = text.split(/\s+/).length;
      const minutes = Math.max(1, Math.ceil(words / 200));
      return minutes;
    },
    debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    },
    showToast(message, type = 'info', duration = 3000) {
      const container =
        DOM.$('.toast-container') ||
        (() => {
          const c = DOM.create('div', { className: 'toast-container' });
          document.body.appendChild(c);
          return c;
        })();

      const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
      };

      const toast = DOM.create('div', { className: `toast ${type}` }, [
        DOM.create('i', { className: `toast-icon bi ${icons[type] || icons.info}` }),
        document.createTextNode(message),
      ]);

      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },
  };

  // ==========================================
  // Wikipedia API Service
  // ==========================================
  const WikiAPI = {
    async search(query, limit = 20) {
      try {
        const params = new URLSearchParams({
          action: 'query',
          list: 'search',
          srsearch: query,
          srlimit: limit,
          srprop: 'snippet|pageid',
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        return res.data.query.search;
      } catch (err) {
        console.error('Search API error:', err);
        return [];
      }
    },

    async getSummary(title) {
      try {
        const res = await axios.get(
          `${CONFIG.WIKIPEDIA_SUMMARY}/${encodeURIComponent(title)}`,
          { params: { redirect: true } }
        );
        return res.data;
      } catch (err) {
        console.error('Summary API error:', err);
        return null;
      }
    },

    async getPage(title) {
      try {
        const res = await axios.get(
          `${CONFIG.WIKIPEDIA_API}/page/summary/${encodeURIComponent(title)}`,
          { params: { redirect: true } }
        );
        return res.data;
      } catch (err) {
        console.error('Page API error:', err);
        return null;
      }
    },

    async getPageHtml(title) {
      try {
        const res = await axios.get(
          `${CONFIG.WIKIPEDIA_API}/page/html/${encodeURIComponent(title)}`,
          { params: { redirect: true } }
        );
        return res.data;
      } catch (err) {
        console.error('Page HTML API error:', err);
        return null;
      }
    },

    async getPageImages(title) {
      try {
        const params = new URLSearchParams({
          action: 'query',
          titles: title,
          prop: 'pageimages',
          pithumbsize: 600,
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        const pages = res.data.query.pages;
        const page = Object.values(pages)[0];
        return page?.thumbnail?.source || null;
      } catch {
        return null;
      }
    },

    async getRandomArticles(count = 6) {
      try {
        const params = new URLSearchParams({
          action: 'query',
          list: 'random',
          rnlimit: count,
          rnnamespace: 0,
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        const pages = res.data.query.random;
        const summaries = await Promise.all(
          pages.map((p) => WikiAPI.getSummary(p.title).catch(() => null))
        );
        return summaries.filter(Boolean);
      } catch {
        return [];
      }
    },

    async getTrending() {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const res = await axios.get(
          `${CONFIG.WIKIPEDIA_API_FEED}/featured/${year}/${month}/${day}`,
          { timeout: 5000 }
        );
        return res.data;
      } catch {
        return null;
      }
    },

    async getPageSections(title) {
      try {
        const params = new URLSearchParams({
          action: 'parse',
          page: title,
          prop: 'sections',
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        return res.data?.parse?.sections || [];
      } catch {
        return [];
      }
    },

    async autoComplete(query) {
      if (!query || query.length < 2) return [];
      try {
        const params = new URLSearchParams({
          action: 'opensearch',
          search: query,
          limit: 5,
          namespace: 0,
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        return res.data[1] || [];
      } catch {
        return [];
      }
    },

    async getCategoryMembers(category, limit = 20) {
      try {
        const params = new URLSearchParams({
          action: 'query',
          list: 'categorymembers',
          cmtitle: `Category:${category}`,
          cmlimit: limit,
          cmtype: 'page',
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        return res.data.query.categorymembers;
      } catch {
        return [];
      }
    },

    async searchByCategory(query, category, limit = 20) {
      try {
        const params = new URLSearchParams({
          action: 'query',
          list: 'search',
          srsearch: `${query} ${category}`,
          srlimit: limit,
          srprop: 'snippet|pageid',
          format: 'json',
          origin: '*',
        });
        const res = await axios.get(`${CONFIG.WIKIPEDIA_SEARCH}?${params}`);
        return res.data.query.search;
      } catch {
        return [];
      }
    },
  };

  // ==========================================
  // UI Components
  // ==========================================
  const UI = {
    showLoading() {
      const existing = DOM.$('.loading-screen');
      if (existing) {
        existing.classList.remove('hidden');
        return existing;
      }
      const loader = DOM.create('div', { className: 'loading-screen' }, [
        DOM.create('div', { className: 'loading-logo' }, ['WikiPelajar']),
        DOM.create('div', { className: 'loading-spinner' }),
        DOM.create('div', { className: 'loading-text' }, ['Memuat...']),
      ]);
      document.body.prepend(loader);
      return loader;
    },

    hideLoading() {
      const loader = DOM.$('.loading-screen');
      if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
    },

    createSkeletonCard() {
      return DOM.create('div', { className: 'card skeleton-card' }, [
        DOM.create('div', { className: 'skeleton skeleton-image', style: { marginBottom: '1rem' } }),
        DOM.create('div', { className: 'skeleton skeleton-text', style: { width: '70%' } }),
        DOM.create('div', { className: 'skeleton skeleton-text', style: { width: '90%' } }),
        DOM.create('div', { className: 'skeleton skeleton-text short' }),
      ]);
    },

    renderSearchResult(result) {
      const card = DOM.create('div', { className: 'card search-result-card' });
      card.onclick = () => {
        window.location.href = `article.html?title=${encodeURIComponent(result.title)}`;
      };

      const snippet = result.snippet
        ? DOM.sanitize(result.snippet.replace(/<\/?[^>]+(>|$)/g, ''))
        : 'Tidak ada deskripsi tersedia.';

      card.innerHTML = `
        <div class="result-title">${DOM.sanitize(result.title)}</div>
        <div class="result-snippet">${snippet}</div>
        <div class="result-meta">
          <span><i class="bi bi-book"></i> Wikipedia</span>
          <span><i class="bi bi-clock"></i> ${DOM.estimateReadingTime(snippet)} menit baca</span>
        </div>
      `;
      return card;
    },

    renderArticleCard(item) {
      const card = DOM.create('div', { className: 'card article-card' });
      card.onclick = () => {
        window.location.href = `article.html?title=${encodeURIComponent(item.title)}`;
      };

      const thumbnail = item.thumbnail?.source || '';
      const description = item.description || item.extract || '';

      card.innerHTML = `
        ${thumbnail ? `<div class="card-img"><img src="${thumbnail}" alt="${DOM.sanitize(item.title)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : ''}
        <div class="card-icon" style="background:var(--primary-gradient-soft);color:var(--primary)">
          <i class="bi bi-book"></i>
        </div>
        <h3 class="card-title">${DOM.sanitize(item.title)}</h3>
        <p class="card-text">${DOM.truncate(DOM.sanitize(description || item.extract || ''), 120)}</p>
        <div class="card-footer">
          <div class="card-meta">
            <span><i class="bi bi-clock"></i> ${DOM.estimateReadingTime(description || item.extract || '')} menit</span>
          </div>
          <span class="card-link">Baca <i class="bi bi-arrow-right"></i></span>
        </div>
      `;
      return card;
    },

    renderCategoryCard(name, icon, color) {
      const card = DOM.create('div', { className: 'card category-card' });
      card.onclick = () => {
        window.location.href = `category.html?cat=${encodeURIComponent(name)}`;
      };
      card.innerHTML = `
        <div class="card-icon" style="background:${color}15;color:${color};width:64px;height:64px;border-radius:1.5rem;font-size:1.8rem;margin:0 auto 1.25rem;display:flex;align-items:center;justify-content:center">
          <i class="bi ${icon}"></i>
        </div>
        <h3 class="card-title">${name}</h3>
        <p class="card-text">Jelajahi artikel tentang ${name.toLowerCase()}</p>
      `;
      return card;
    },

    renderTrendingItem(item, index) {
      const div = DOM.create('div', { className: 'trend-card' });
      div.onclick = () => {
        window.location.href = `article.html?title=${encodeURIComponent(item.title)}`;
      };
      div.innerHTML = `
        <div class="trend-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="trend-content">
          <div class="trend-title">${DOM.sanitize(item.title)}</div>
          <div class="trend-desc">${DOM.truncate(DOM.sanitize(item.description || item.extract || ''), 100)}</div>
          <div class="trend-meta">
            <span><i class="bi bi-eye"></i> Trending</span>
            <span><i class="bi bi-clock"></i> ${DOM.estimateReadingTime(item.extract || '')} menit</span>
          </div>
        </div>
      `;
      return div;
    },

    renderBookmarkItem(item) {
      const div = DOM.create('div', { className: 'bookmark-item' });
      div.onclick = () => {
        window.location.href = `article.html?title=${encodeURIComponent(item.title)}`;
      };
      div.innerHTML = `
        <div class="bookmark-icon"><i class="bi bi-bookmark-fill"></i></div>
        <div class="bookmark-content">
          <div class="bookmark-title">${DOM.sanitize(item.title)}</div>
          <div class="bookmark-desc">${DOM.truncate(DOM.sanitize(item.desc || ''), 80)}</div>
          <div class="bookmark-time">Disimpan ${DOM.formatDate(item.savedAt || item.viewedAt || new Date())}</div>
        </div>
        <button class="bookmark-remove" data-title="${DOM.sanitize(item.title)}" onclick="event.stopPropagation(); window.removeBookmark('${DOM.sanitize(item.title)}')">
          <i class="bi bi-x-lg"></i>
        </button>
      `;
      return div;
    },

    renderHistoryItem(item) {
      const div = DOM.create('div', { className: 'bookmark-item' });
      div.onclick = () => {
        window.location.href = `article.html?title=${encodeURIComponent(item.title)}`;
      };
      div.innerHTML = `
        <div class="bookmark-icon" style="background:rgba(251,191,36,0.1);color:var(--accent)"><i class="bi bi-clock-history"></i></div>
        <div class="bookmark-content">
          <div class="bookmark-title">${DOM.sanitize(item.title)}</div>
          <div class="bookmark-desc">${DOM.truncate(DOM.sanitize(item.desc || ''), 80)}</div>
          <div class="bookmark-time">Dilihat ${DOM.formatDate(item.viewedAt)}</div>
        </div>
      `;
      return div;
    },

    renderEmptyState(icon, title, text, btnText, btnLink) {
      const div = DOM.create('div', { className: 'empty-state' }, [
        DOM.create('div', { className: 'empty-state-icon' }, [DOM.create('i', { className: `bi ${icon}` })]),
        DOM.create('h3', { className: 'empty-state-title' }, [title]),
        DOM.create('p', { className: 'empty-state-text' }, [text]),
      ]);
      if (btnText) {
        const btn = DOM.create('a', {
          className: 'btn btn-primary',
          href: btnLink || 'search.html',
        }, [btnText]);
        div.appendChild(btn);
      }
      return div;
    },
  };

  // ==========================================
  // Navigation & Theme
  // ==========================================
  const Nav = {
    init() {
      this.handleScroll();
      this.handleMobileNav();
      this.updateActiveLink();
      window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    },

    handleScroll() {
      const navbar = DOM.$('.navbar');
      if (!navbar) return;
      if (window.scrollY > 50) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    },

    handleMobileNav() {
      const toggler = DOM.$('.navbar-toggler');
      const mobileNav = DOM.$('.mobile-nav');
      const overlay = DOM.$('.mobile-nav-overlay');
      if (!toggler || !mobileNav || !overlay) return;

      const toggle = () => {
        mobileNav.classList.toggle('open');
        overlay.classList.toggle('open');
        document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
      };

      toggler.addEventListener('click', toggle);
      overlay.addEventListener('click', toggle);
      DOM.$$('.mobile-nav-link').forEach((link) => {
        link.addEventListener('click', toggle);
      });
    },

    updateActiveLink() {
      const path = window.location.pathname.split('/').pop() || 'index.html';
      DOM.$$('.nav-link').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === path);
      });
    },
  };

  // ==========================================
  // Search Feature
  // ==========================================
  const SearchFeature = {
    init() {
      this.searchInput = DOM.$('.search-input');
      this.searchForm = DOM.$('.search-form');
      this.resultsContainer = DOM.$('.search-results');
      this.suggestionsContainer = DOM.$('.search-suggestions');
      this.filterChips = DOM.$$('.filter-chip');

      if (!this.searchInput) return;

      this.currentQuery = '';
      this.currentPage = 0;
      this.currentCategory = '';
      this.isLoading = false;
      this.hasMore = true;

      this.bindEvents();
      this.loadSearchHistory();

      // Check URL params
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q');
      if (query) {
        this.searchInput.value = query;
        this.performSearch(query);
      }
    },

    bindEvents() {
      this.searchInput.addEventListener(
        'input',
        DOM.debounce((e) => {
          const query = e.target.value.trim();
          if (query.length >= 2) {
            this.showSuggestions(query);
          } else {
            this.clearSuggestions();
          }
        }, 250)
      );

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = this.searchInput.value.trim();
          if (query) {
            Store.searchHistory.add(query);
            this.performSearch(query);
            this.clearSuggestions();
          }
        }
        if (e.key === 'Escape') this.clearSuggestions();
      });

      if (this.searchForm) {
        this.searchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = this.searchInput.value.trim();
          if (query) {
            Store.searchHistory.add(query);
            this.performSearch(query);
            this.clearSuggestions();
          }
        });
      }

      this.filterChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          this.filterChips.forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          this.currentCategory = chip.dataset.category || '';
          if (this.currentQuery) this.performSearch(this.currentQuery);
        });
      });

      // Infinite scroll
      if (this.resultsContainer) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
              this.loadMore();
            }
          },
          { threshold: 0.1 }
        );
        const sentinel = DOM.create('div', { className: 'scroll-sentinel' });
        this.resultsContainer.after(sentinel);
        observer.observe(sentinel);
      }

      // Keyboard shortcut: Ctrl+K or Cmd+K
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.searchInput?.focus();
        }
      });
    },

    async showSuggestions(query) {
      try {
        const suggestions = await WikiAPI.autoComplete(query);
        const history = Store.searchHistory.getAll();

        if (!this.suggestionsContainer) return;
        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.style.display = 'block';

        // Search history
        if (history.length > 0 && query.length < 3) {
          const historyTitle = DOM.create('div', {
            className: 'search-suggestion',
            style: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray)', cursor: 'default', paddingBottom: '0.5rem' },
          }, ['Riwayat Pencarian']);
          this.suggestionsContainer.appendChild(historyTitle);

          history.slice(0, 5).forEach((h) => {
            const item = DOM.create('div', { className: 'search-suggestion' }, [
              DOM.create('i', { className: 'bi bi-clock-history', style: { marginRight: '0.5rem' } }),
              document.createTextNode(h),
            ]);
            item.onclick = () => {
              this.searchInput.value = h;
              this.performSearch(h);
              this.clearSuggestions();
            };
            this.suggestionsContainer.appendChild(item);
          });
        }

        if (suggestions.length > 0) {
          const suggestTitle = DOM.create('div', {
            className: 'search-suggestion',
            style: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray)', cursor: 'default', paddingBottom: '0.5rem', paddingTop: '0.5rem' },
          }, ['Saran Pencarian']);
          this.suggestionsContainer.appendChild(suggestTitle);

          suggestions.forEach((s) => {
            const item = DOM.create('div', { className: 'search-suggestion' }, [
              DOM.create('i', { className: 'bi bi-search', style: { marginRight: '0.5rem', fontSize: '0.8rem' } }),
              document.createTextNode(s),
            ]);
            item.onclick = () => {
              this.searchInput.value = s;
              this.performSearch(s);
              this.clearSuggestions();
            };
            this.suggestionsContainer.appendChild(item);
          });
        }
      } catch {
        // Silent fail for suggestions
      }
    },

    clearSuggestions() {
      if (this.suggestionsContainer) {
        this.suggestionsContainer.style.display = 'none';
        this.suggestionsContainer.innerHTML = '';
      }
    },

    async performSearch(query) {
      this.currentQuery = query;
      this.currentPage = 0;
      this.hasMore = true;

      if (!this.resultsContainer) return;

      this.resultsContainer.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        this.resultsContainer.appendChild(UI.createSkeletonCard());
      }

      try {
        const searchFn = this.currentCategory
          ? () => WikiAPI.searchByCategory(query, this.currentCategory, 20)
          : () => WikiAPI.search(query);

        const results = await searchFn();

        this.resultsContainer.innerHTML = '';

        if (results.length === 0) {
          this.resultsContainer.appendChild(
            UI.renderEmptyState(
              'bi-search',
              'Tidak ditemukan hasil',
              `Maaf, tidak ada hasil untuk "${query}". Coba kata kunci lain.`,
              'Jelajahi Artikel Populer',
              'explore.html'
            )
          );
          return;
        }

        results.forEach((r) => {
          this.resultsContainer.appendChild(UI.renderSearchResult(r));
        });

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('q', query);
        window.history.replaceState({}, '', url);

        // Show results count
        const countEl = DOM.$('.search-results-count');
        if (countEl) {
          countEl.textContent = `${results.length} hasil untuk "${query}"`;
        }
      } catch (err) {
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(
          UI.renderEmptyState(
            'bi-exclamation-triangle',
            'Terjadi Kesalahan',
            'Gagal memuat hasil pencarian. Silakan coba lagi.',
            'Coba Lagi',
            '#'
          )
        );
        DOM.showToast('Gagal mencari artikel', 'error');
      }
    },

    async loadMore() {
      // Simple infinite scroll by re-searching with offset
      // Wikipedia API doesn't support true pagination easily
      this.isLoading = false;
    },

    loadSearchHistory() {
      const history = Store.searchHistory.getAll();
      if (history.length > 0 && this.suggestionsContainer && !this.searchInput.value) {
        this.showSuggestions('');
      }
    },
  };

  // ==========================================
  // Article Feature
  // ==========================================
  const ArticleFeature = {
    async init() {
      const params = new URLSearchParams(window.location.search);
      const title = params.get('title');

      if (!title) {
        this.showError('Tidak ada artikel yang dipilih.');
        return;
      }

      this.title = title;
      this.setupReadingProgress();
      this.setupTOC();
      this.setupActions();
      this.setupTextToSpeech();
      this.setupFontSize();
      this.setupAccessibility();
      await this.loadArticle(title);
    },

    async loadArticle(title) {
      const loader = UI.showLoading();
      const container = DOM.$('.article-content');
      const header = DOM.$('.article-header-content');

      try {
        const [page, html] = await Promise.all([
          WikiAPI.getPage(title),
          WikiAPI.getPageHtml(title).catch(() => null),
        ]);

        if (!page) {
          this.showError('Artikel tidak ditemukan.');
          UI.hideLoading();
          return;
        }

        UI.hideLoading();

        // Save to history
        Store.history.add({
          title: page.title,
          desc: page.description || page.extract || '',
        });

        // Render header
        this.renderHeader(page);
        this.renderImage(page);
        this.renderContent(page, html);
        this.renderAISummary(page);
        this.renderKeyPoints(page);
        this.renderRelatedArticles(page);

        // Update bookmark state
        this.updateBookmarkState();

        // Setup quiz
        this.setupMiniQuiz(page);

        // Update metadata
        document.title = `${page.title} - WikiPelajar AI`;
        const metaDesc = DOM.$('meta[name="description"]');
        if (metaDesc) metaDesc.content = page.description || page.extract || '';

        // Smooth scroll
        AOS.refresh();
      } catch (err) {
        UI.hideLoading();
        this.showError('Gagal memuat artikel. Silakan coba lagi.');
        console.error('Article load error:', err);
      }
    },

    renderHeader(page) {
      const container = DOM.$('.article-header-content');
      if (!container) return;

      // Read time
      const readTime = DOM.estimateReadingTime(page.extract || '');
      const readTimeDisplay = readTime > 1 ? `${readTime} menit` : '1 menit';

      container.innerHTML = `
        <div class="breadcrumb-custom">
          <a href="index.html"><i class="bi bi-house"></i></a>
          <span class="separator"><i class="bi bi-chevron-right"></i></span>
          <a href="explore.html">Jelajahi</a>
          <span class="separator"><i class="bi bi-chevron-right"></i></span>
          <span class="current">${DOM.sanitize(page.title)}</span>
        </div>
        <h1 class="article-title">${DOM.sanitize(page.title)}</h1>
        ${page.description ? `<p style="color:var(--gray);font-size:var(--text-lg);margin-bottom:1rem">${DOM.sanitize(page.description)}</p>` : ''}
        <div class="article-meta">
          <span class="meta-item"><i class="bi bi-clock"></i> ${readTimeDisplay} baca</span>
          <span class="meta-item"><i class="bi bi-eye"></i> ${(page.page_id || Math.floor(Math.random() * 10000)).toLocaleString()} dilihat</span>
          <span class="meta-item"><i class="bi bi-bookmark"></i> ${Store.bookmarks.isBookmarked(page.title) ? 'Tersimpan' : 'Belum tersimpan'}</span>
        </div>
      `;
    },

    renderImage(page) {
      const container = DOM.$('.article-featured-image');
      if (!container) return;

      const thumbnail = page.thumbnail?.source || page.originalimage?.source || '';
      if (thumbnail) {
        container.innerHTML = `<img src="${thumbnail}" alt="${DOM.sanitize(page.title)}" loading="lazy">`;
      } else {
        container.style.display = 'none';
      }
    },

    renderContent(page, html) {
      const container = DOM.$('.article-content');
      if (!container) return;

      if (html) {
        // Parse HTML and extract meaningful content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove unwanted elements
        doc.querySelectorAll(
          '.mw-empty-elt, .mw-jump-link, .mw-editsection, .reference, .references, .navbox, .mbox-small, .sistertable, .sidebar, .toc, .infobox'
        ).forEach((el) => el.remove());

        // Get main content
        const content = doc.querySelector('.mw-parser-output, .mw-content-ltr, body');
        if (content) {
          // Add classes to tables
          content.querySelectorAll('table').forEach((t) => t.classList.add('table'));
          content.querySelectorAll('img').forEach((img) => {
            img.loading = 'lazy';
            img.style.maxWidth = '100%';
          });
          container.innerHTML = content.innerHTML;
        } else {
          container.innerHTML = `<p>${DOM.sanitize(page.extract || 'Konten tidak tersedia.')}</p>`;
        }
      } else if (page.extract) {
        container.innerHTML = `
          <div class="ai-summary-box">
            <p>${DOM.sanitize(page.extract)}</p>
          </div>
          <p style="color:var(--gray);margin-top:1rem">Kunjungi <a href="https://id.wikipedia.org/wiki/${encodeURIComponent(page.title)}" target="_blank" rel="noopener">Wikipedia Bahasa Indonesia</a> untuk artikel lengkap.</p>
        `;
      }

      // Generate TOC from content
      this.generateTOC(container);
    },

    generateTOC(container) {
      const tocList = DOM.$('.toc-list');
      if (!tocList) return;

      const headings = container.querySelectorAll('h2, h3');
      if (headings.length < 2) {
        DOM.$('.article-toc').style.display = 'none';
        return;
      }

      headings.forEach((heading, index) => {
        if (!heading.id) {
          heading.id = `section-${index}`;
        }
        const tag = heading.tagName.toLowerCase();
        const item = DOM.create('div', { className: `toc-item ${tag}`, dataHref: `#${heading.id}` }, [
          heading.textContent,
        ]);
        item.onclick = () => {
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          DOM.$$('.toc-item').forEach((i) => i.classList.remove('active'));
          item.classList.add('active');
        };
        tocList.appendChild(item);
      });

      // Highlight active TOC item on scroll
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              DOM.$$('.toc-item').forEach((i) => i.classList.remove('active'));
              const active = DOM.$(`.toc-item[data-href="#${entry.target.id}"]`);
              if (active) active.classList.add('active');
            }
          });
        },
        { threshold: 0.3 }
      );

      headings.forEach((h) => observer.observe(h));
    },

    renderAISummary(page) {
      const container = DOM.$('.ai-summary-section');
      if (!container) return;

      const extract = page.extract || '';
      const sentences = extract.split(/[.!?]+/).filter(Boolean);
      const summary = sentences.slice(0, 3).join('. ') + '.';

      if (summary.length < 20) {
        container.style.display = 'none';
        return;
      }

      container.innerHTML = `
        <div class="ai-summary-box">
          <p>${DOM.sanitize(summary)}</p>
        </div>
      `;
    },

    renderKeyPoints(page) {
      const container = DOM.$('.key-points-section');
      if (!container) return;

      const extract = page.extract || '';
      const sentences = extract.split(/[.!?]+/).filter((s) => s.trim().length > 20);

      if (sentences.length < 2) {
        container.style.display = 'none';
        return;
      }

      const points = sentences.slice(0, 5);

      let html = '<div class="key-points"><div class="key-points-title">📌 Poin Penting</div>';
      points.forEach((point) => {
        html += `
          <div class="key-point">
            <div class="key-point-bullet"></div>
            <div>${DOM.sanitize(point.trim())}</div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    },

    async renderRelatedArticles(page) {
      const container = DOM.$('.related-articles');
      if (!container) return;

      try {
        const keywords = (page.title || '').split(/\s+/).slice(0, 2);
        const query = keywords.join(' ');
        const results = await WikiAPI.search(query, 4);

        const filtered = results.filter((r) => r.title !== page.title).slice(0, 3);

        if (filtered.length === 0) {
          container.closest('.section')?.remove();
          return;
        }

        container.innerHTML = '';
        filtered.forEach((r) => {
          container.appendChild(UI.renderSearchResult(r));
        });
      } catch {
        container.closest('.section')?.remove();
      }
    },

    setupReadingProgress() {
      const bar = DOM.$('.reading-progress-bar');
      if (!bar) return;

      window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = `${Math.min(100, progress)}%`;
      }, { passive: true });
    },

    setupTOC() {
      // TOC toggle on mobile
      const toc = DOM.$('.article-toc');
      if (!toc) return;

      const toggleBtn = DOM.create('button', {
        className: 'btn btn-sm btn-glass',
        style: { display: 'none', marginBottom: '1rem', width: '100%' },
      }, ['📑 Daftar Isi']);
      toc.parentNode.insertBefore(toggleBtn, toc);

      const mediaQuery = window.matchMedia('(max-width: 992px)');
      const handleMobile = (e) => {
        if (e.matches) {
          toggleBtn.style.display = 'flex';
          toc.style.display = 'none';
          toggleBtn.onclick = () => {
            const isVisible = toc.style.display !== 'none';
            toc.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible ? '📑 Daftar Isi' : '📑 Tutup Daftar Isi';
          };
        } else {
          toggleBtn.style.display = 'none';
          toc.style.display = 'block';
        }
      };
      mediaQuery.addEventListener('change', handleMobile);
      handleMobile(mediaQuery);
    },

    setupActions() {
      const bookmarkBtn = DOM.$('#bookmark-btn');
      const shareBtn = DOM.$('#share-btn');
      const copyBtn = DOM.$('#copy-btn');
      const ttsBtn = DOM.$('#tts-btn');

      if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', () => {
          const title = this.title;
          if (Store.bookmarks.isBookmarked(title)) {
            Store.bookmarks.remove(title);
            bookmarkBtn.classList.remove('bookmarked');
            bookmarkBtn.innerHTML = '<i class="bi bi-bookmark"></i> Simpan';
            DOM.showToast('Dihapus dari bookmark', 'warning');
          } else {
            Store.bookmarks.add({
              title,
              desc: DOM.$('.article-title')?.textContent || title,
            });
            bookmarkBtn.classList.add('bookmarked');
            bookmarkBtn.innerHTML = '<i class="bi bi-bookmark-fill"></i> Tersimpan';
            DOM.showToast('Disimpan ke bookmark', 'success');
          }
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
          const url = window.location.href;
          if (navigator.share) {
            try {
              await navigator.share({ title: this.title, url });
            } catch { /* user cancelled */ }
          } else {
            await navigator.clipboard.writeText(url);
            DOM.showToast('Link disalin ke clipboard', 'success');
          }
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const text = DOM.$('.article-content')?.textContent || '';
          try {
            await navigator.clipboard.writeText(text.slice(0, 5000));
            DOM.showToast('Konten disalin', 'success');
          } catch {
            DOM.showToast('Gagal menyalin', 'error');
          }
        });
      }
    },

    setupTextToSpeech() {
      const ttsBtn = DOM.$('#tts-btn');
      if (!ttsBtn) return;

      let isSpeaking = false;

      ttsBtn.addEventListener('click', () => {
        if (isSpeaking) {
          window.speechSynthesis.cancel();
          isSpeaking = false;
          ttsBtn.innerHTML = '<i class="bi bi-volume-up"></i> Bacakan';
          DOM.showToast('Pembacaan dihentikan', 'info');
          return;
        }

        const text = DOM.$('.article-content')?.textContent || '';
        if (!text) {
          DOM.showToast('Tidak ada teks untuk dibacakan', 'error');
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
        utterance.lang = 'id-ID';
        utterance.rate = 0.9;
        utterance.onend = () => {
          isSpeaking = false;
          ttsBtn.innerHTML = '<i class="bi bi-volume-up"></i> Bacakan';
        };
        window.speechSynthesis.speak(utterance);
        isSpeaking = true;
        ttsBtn.innerHTML = '<i class="bi bi-stop-fill"></i> Berhenti';
        DOM.showToast('Sedang membacakan artikel...', 'info');
      });
    },

    setupFontSize() {
      const settings = Store.settings.get();
      if (settings.fontSize) {
        document.body.className = document.body.className
          .replace(/font-size-\w+/g, '')
          .trim();
        if (settings.fontSize !== 'md') {
          document.body.classList.add(`font-size-${settings.fontSize}`);
        }
      }
    },

    setupAccessibility() {
      const settings = Store.settings.get();

      if (settings.dyslexiaMode) {
        document.body.classList.add('dyslexia-friendly');
      }
      if (settings.highContrast) {
        document.body.classList.add('high-contrast');
      }
    },

    updateBookmarkState() {
      const bookmarkBtn = DOM.$('#bookmark-btn');
      if (bookmarkBtn && Store.bookmarks.isBookmarked(this.title)) {
        bookmarkBtn.classList.add('bookmarked');
        bookmarkBtn.innerHTML = '<i class="bi bi-bookmark-fill"></i> Tersimpan';
      }
    },

    setupMiniQuiz(page) {
      const container = DOM.$('.mini-quiz-section');
      if (!container) return;

      const extract = page.extract || '';
      const sentences = extract.split(/[.!?]+/).filter((s) => s.trim().length > 30);

      if (sentences.length < 3) {
        container.style.display = 'none';
        return;
      }

      const questions = [];
      const usedSentences = [];

      for (let i = 0; i < Math.min(3, sentences.length); i++) {
        const sentence = sentences[i].trim();
        if (usedSentences.includes(sentence)) continue;
        usedSentences.push(sentence);

        const words = sentence.split(/\s+/);
        if (words.length < 5) continue;

        // Pick a word to blank out
        const blankIndex = Math.floor(words.length / 2);
        const answer = words[blankIndex].replace(/[^a-zA-Z0-9\s-]/g, '');
        if (answer.length < 2) continue;

        words[blankIndex] = '________';

        questions.push({
          question: words.join(' '),
          answer: answer,
        });
      }

      if (questions.length < 2) {
        container.style.display = 'none';
        return;
      }

      let html = `
        <div class="card" style="margin-top:2rem">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem">
            <div class="card-icon" style="margin-bottom:0"><i class="bi bi-question-circle"></i></div>
            <div>
              <h3 style="font-size:1.1rem;font-weight:700">Quiz Mini</h3>
              <p style="font-size:0.8rem;color:var(--gray)">Isi kata yang kosong berdasarkan artikel</p>
            </div>
          </div>
          <div id="mini-quiz-questions">
      `;

      questions.forEach((q, idx) => {
        html += `
          <div class="mini-question" style="margin-bottom:1rem;padding:1rem;background:var(--glass-bg);border-radius:var(--radius-xl)">
            <p style="font-size:var(--text-sm);margin-bottom:0.5rem;line-height:1.6">${idx + 1}. ${DOM.sanitize(q.question)}</p>
            <div style="display:flex;gap:0.5rem">
              <input type="text" class="mini-quiz-input" data-answer="${DOM.sanitize(q.answer)}" placeholder="Jawaban..." style="flex:1;padding:0.5rem 0.75rem;border-radius:var(--radius-lg);border:1px solid var(--glass-border);background:var(--glass-bg);font-size:var(--text-sm)">
              <span class="mini-quiz-feedback" style="display:none;align-items:center;font-size:1.2rem"></span>
            </div>
          </div>
        `;
      });

      html += `
          </div>
          <button id="check-mini-quiz" class="btn btn-primary" style="margin-top:0.5rem">Periksa Jawaban</button>
        </div>
      `;

      container.innerHTML = html;

      const checkBtn = DOM.$('#check-mini-quiz');
      if (checkBtn) {
        checkBtn.addEventListener('click', () => {
          DOM.$$('.mini-quiz-input').forEach((input) => {
            const fb = input.nextElementSibling;
            const answer = input.dataset.answer.toLowerCase().trim();
            const userAnswer = input.value.toLowerCase().trim();

            if (userAnswer === answer) {
              fb.innerHTML = '✅';
              fb.style.display = 'inline-flex';
              input.style.borderColor = '#22C55E';
            } else {
              fb.innerHTML = '❌';
              fb.style.display = 'inline-flex';
              input.style.borderColor = '#EF4444';
              setTimeout(() => {
                input.value = answer;
                fb.innerHTML = `✅ (${input.dataset.answer})`;
              }, 1500);
            }
          });
          DOM.showToast('Quiz selesai diperiksa!', 'info');
        });
      }
    },

    showError(message) {
      const container = DOM.$('.article-content') || DOM.$('.article-header-content');
      if (container) {
        container.innerHTML = '';
        container.appendChild(
          UI.renderEmptyState(
            'bi-exclamation-triangle',
            'Oops!',
            message || 'Terjadi kesalahan saat memuat artikel.',
            'Kembali ke Beranda',
            'index.html'
          )
        );
      }
    },
  };

  // ==========================================
  // Bookmark Feature
  // ==========================================
  const BookmarkFeature = {
    init() {
      this.renderBookmarks();
      this.renderHistory();
    },

    renderBookmarks() {
      const container = DOM.$('#bookmark-list');
      if (!container) return;

      const bookmarks = Store.bookmarks.getAll();

      if (bookmarks.length === 0) {
        container.appendChild(
          UI.renderEmptyState(
            'bi-bookmark',
            'Belum ada bookmark',
            'Simpan artikel menarik dengan klik ikon bookmark di halaman artikel.',
            'Jelajahi Artikel',
            'explore.html'
          )
        );
        return;
      }

      bookmarks.forEach((item) => {
        container.appendChild(UI.renderBookmarkItem(item));
      });
    },

    renderHistory() {
      const container = DOM.$('#history-list');
      if (!container) return;

      const history = Store.history.getAll();

      if (history.length === 0) {
        container.appendChild(
          UI.renderEmptyState(
            'bi-clock-history',
            'Belum ada riwayat',
            'Riwayat bacaan akan muncul setelah kamu membaca artikel.',
            'Mulai Membaca',
            'explore.html'
          )
        );
        return;
      }

      history.slice(0, 10).forEach((item) => {
        container.appendChild(UI.renderHistoryItem(item));
      });
    },
  };

  // ==========================================
  // Explore Feature
  // ==========================================
  const ExploreFeature = {
    init() {
      this.renderCategories();
      this.renderRandomArticles();
    },

    categories: [
      { name: 'Fisika', icon: 'bi-flask', color: '#4F46E5' },
      { name: 'Teknologi', icon: 'bi-cpu', color: '#06B6D4' },
      { name: 'Sejarah', icon: 'bi-clock', color: '#F59E0B' },
      { name: 'Geografi', icon: 'bi-globe', color: '#22C55E' },
      { name: 'Matematika', icon: 'bi-calculator', color: '#EF4444' },
      { name: 'Kesenian', icon: 'bi-palette', color: '#EC4899' },
      { name: 'Bahasa', icon: 'bi-chat', color: '#8B5CF6' },
      { name: 'Olahraga', icon: 'bi-trophy', color: '#F97316' },
      { name: 'Musik', icon: 'bi-music-note', color: '#14B8A6' },
      { name: 'Film', icon: 'bi-film', color: '#6366F1' },
      { name: 'Hewan', icon: 'bi-flower1', color: '#84CC16' },
      { name: 'Tumbuhan', icon: 'bi-tree', color: '#10B981' },
      { name: 'Kesehatan', icon: 'bi-heart-pulse', color: '#EF4444' },
      { name: 'Filsafat', icon: 'bi-brain', color: '#A855F7' },
      { name: 'Ekonomi', icon: 'bi-graph-up', color: '#0EA5E9' },
      { name: 'Pendidikan', icon: 'bi-building', color: '#DC2626' },
    ],

    renderCategories() {
      const container = DOM.$('#category-grid');
      if (!container) return;

      this.categories.forEach((cat) => {
        container.appendChild(UI.renderCategoryCard(cat.name, cat.icon, cat.color));
      });
    },

    async renderRandomArticles() {
      const container = DOM.$('#random-articles');
      if (!container) return;

      try {
        const articles = await WikiAPI.getRandomArticles(6);
        container.innerHTML = '';

        articles.forEach((article) => {
          container.appendChild(UI.renderArticleCard(article));
        });
      } catch {
        container.innerHTML = '';
        container.appendChild(
          DOM.create('p', { style: { color: 'var(--gray)', textAlign: 'center', padding: '2rem' } }, [
            'Gagal memuat artikel acak.',
          ])
        );
      }
    },
  };

  // ==========================================
  // Category Feature
  // ==========================================
  const CategoryFeature = {
    async init() {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('cat');

      if (!cat) {
        this.showError('Kategori tidak ditemukan.');
        return;
      }

      this.category = cat;
      this.renderHeader(cat);
      await this.loadArticles(cat);
    },

    renderHeader(category) {
      const container = DOM.$('#category-header');
      if (!container) return;

      const icons = {
        Fisika: 'bi-flask',
        Teknologi: 'bi-cpu',
        Sejarah: 'bi-clock',
        Geografi: 'bi-globe',
        Matematika: 'bi-calculator',
        Kesenian: 'bi-palette',
        Bahasa: 'bi-chat',
        Olahraga: 'bi-trophy',
        Musik: 'bi-music-note',
        Film: 'bi-film',
        Hewan: 'bi-flower1',
        Tumbuhan: 'bi-tree',
        Kesehatan: 'bi-heart-pulse',
        Filsafat: 'bi-brain',
        Ekonomi: 'bi-graph-up',
        Pendidikan: 'bi-building',
      };

      const icon = icons[category] || 'bi-book';

      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
          <div style="width:64px;height:64px;border-radius:var(--radius-2xl);background:var(--primary-gradient-soft);display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--primary)">
            <i class="bi ${icon}"></i>
          </div>
          <div>
            <h1 class="section-title" style="margin-bottom:0.25rem">${category}</h1>
            <p style="color:var(--gray);font-size:var(--text-sm)">Jelajahi artikel tentang ${category.toLowerCase()}</p>
          </div>
        </div>
      `;
    },

    async loadArticles(category) {
      const container = DOM.$('#category-articles');
      if (!container) return;

      container.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        container.appendChild(UI.createSkeletonCard());
      }

      try {
        const members = await WikiAPI.getCategoryMembers(category, 20);

        container.innerHTML = '';

        if (members.length === 0) {
          // Fallback to search
          const results = await WikiAPI.searchByCategory(category, category, 20);
          if (results.length === 0) {
            container.appendChild(
              UI.renderEmptyState(
                'bi-inbox',
                'Tidak ada artikel',
                `Belum ada artikel untuk kategori "${category}"`,
                'Jelajahi Kategori Lain',
                'explore.html'
              )
            );
            return;
          }
          results.forEach((r) => container.appendChild(UI.renderSearchResult(r)));
          return;
        }

        const summaries = await Promise.all(
          members.slice(0, 12).map((m) =>
            WikiAPI.getSummary(m.title).catch(() => ({ title: m.title, extract: '' }))
          )
        );

        summaries.forEach((item) => {
          container.appendChild(UI.renderArticleCard(item));
        });
      } catch (err) {
        container.innerHTML = '';
        container.appendChild(
          UI.renderEmptyState(
            'bi-exclamation-triangle',
            'Gagal memuat',
            'Terjadi kesalahan. Silakan coba lagi.',
            'Coba Lagi',
            '#'
          )
        );
        console.error('Category load error:', err);
      }
    },

    showError(message) {
      const container = DOM.$('#category-articles');
      if (container) {
        container.innerHTML = '';
        container.appendChild(
          UI.renderEmptyState('bi-exclamation-triangle', 'Oops!', message, 'Kembali', 'explore.html')
        );
      }
    },
  };

  // ==========================================
  // Trending Feature
  // ==========================================
  const TrendingFeature = {
    async init() {
      this.renderSkeletons();
      await this.loadTrending();
      await this.loadDailyKnowledge();
    },

    renderSkeletons() {
      const container = DOM.$('#trending-list');
      if (container) {
        for (let i = 0; i < 5; i++) {
          const skel = DOM.create('div', { className: 'trend-card', style: { pointerEvents: 'none' } }, [
            DOM.create('div', { className: 'skeleton', style: { width: '40px', height: '40px', borderRadius: 'var(--radius-lg)' } }),
            DOM.create('div', { style: { flex: 1 } }, [
              DOM.create('div', { className: 'skeleton skeleton-text', style: { width: '60%' } }),
              DOM.create('div', { className: 'skeleton skeleton-text', style: { width: '90%' } }),
            ]),
          ]);
          container.appendChild(skel);
        }
      }
    },

    async loadTrending() {
      const container = DOM.$('#trending-list');
      if (!container) return;

      try {
        const feed = await WikiAPI.getTrending();
        container.innerHTML = '';

        if (feed?.tfa) {
          container.appendChild(UI.renderTrendingItem(feed.tfa, 0));
        }

        // Get more random articles as trending
        const random = await WikiAPI.getRandomArticles(9);
        random.forEach((article, index) => {
          const idx = feed?.tfa ? index + 1 : index;
          container.appendChild(UI.renderTrendingItem(article, idx));
        });

        if (!feed?.tfa && random.length === 0) {
          container.appendChild(
            UI.renderEmptyState('bi-trending-up', 'Belum ada trending', 'Coba lagi nanti.', 'Cari Artikel', 'search.html')
          );
        }
      } catch {
        container.innerHTML = '';
        container.appendChild(
          UI.renderEmptyState('bi-trending-up', 'Gagal memuat', 'Coba lagi.', 'Cari Artikel', 'search.html')
        );
      }
    },

    async loadDailyKnowledge() {
      const container = DOM.$('#daily-knowledge');
      if (!container) return;

      try {
        const random = await WikiAPI.getRandomArticles(1);
        if (random[0]) {
          container.innerHTML = '';
          container.appendChild(UI.renderArticleCard(random[0]));
        }
      } catch {
        // Silent
      }
    },
  };

  // ==========================================
  // Quiz Feature
  // ==========================================
  const QuizFeature = {
    init() {
      this.questions = [];
      this.currentQuestion = 0;
      this.score = 0;
      this.answers = [];

      this.setupCustomQuiz();
    },

    async setupCustomQuiz() {
      const container = DOM.$('#quiz-container');
      if (!container) return;

      try {
        const articles = await WikiAPI.getRandomArticles(3);
        const facts = [];

        for (const article of articles) {
          if (article?.extract) {
            const sentences = article.extract.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length > 10);
            if (sentences.length > 0) {
              facts.push({
                text: sentences[0].trim(),
                title: article.title,
              });
            }
          }
        }

        // Generate true/false questions from facts
        facts.forEach((fact) => {
          this.questions.push({
            question: `Berdasarkan artikel Wikipedia, apakah pernyataan berikut benar?`,
            statement: fact.text.slice(0, 150) + '...',
            answer: true,
            explanation: `Pernyataan ini diambil dari artikel "${fact.title}"`,
          });
        });

        // Add some general knowledge questions
        this.questions.push(
          {
            question: 'Hewan apa yang dikenal sebagai "raja hutan"?',
            options: ['Harimau', 'Singa', 'Gajah', 'Beruang'],
            answer: 1,
            explanation: 'Singa sering disebut sebagai "raja hutan".',
          },
          {
            question: 'Apa nama planet terdekat dari Matahari?',
            options: ['Venus', 'Merkurius', 'Bumi', 'Mars'],
            answer: 1,
            explanation: 'Merkurius adalah planet terdekat dari Matahari.',
          },
          {
            question: 'Siapa penemu teori relativitas?',
            options: ['Isaac Newton', 'Nikola Tesla', 'Albert Einstein', 'Galileo Galilei'],
            answer: 2,
            explanation: 'Albert Einstein dikenal sebagai penemu teori relativitas.',
          },
          {
            question: 'Apa nama lapisan atmosfer terluar Bumi?',
            options: ['Troposfer', 'Stratosfer', 'Mesosfer', 'Eksosfer'],
            answer: 3,
            explanation: 'Eksosfer adalah lapisan atmosfer terluar Bumi.',
          },
          {
            question: 'Siapa proklamator kemerdekaan Indonesia?',
            options: ['Soekarno-Hatta', 'Soeharto', 'B.J. Habibie', 'Mohammad Natsir'],
            answer: 0,
            explanation: 'Soekarno dan Mohammad Hatta adalah proklamator kemerdekaan Indonesia.',
          }
        );

        this.shuffleQuestions();
        this.startQuiz();
      } catch {
        container.innerHTML = '';
        container.appendChild(
          UI.renderEmptyState('bi-question-circle', 'Gagal memuat quiz', 'Coba refresh halaman.', 'Coba Lagi', '#')
        );
      }
    },

    shuffleQuestions() {
      for (let i = this.questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
      }
    },

    startQuiz() {
      this.currentQuestion = 0;
      this.score = 0;
      this.answers = [];
      this.renderQuestion();
    },

    renderQuestion() {
      const container = DOM.$('#quiz-container');
      if (!container) return;

      const q = this.questions[this.currentQuestion];
      if (!q) {
        this.renderResult();
        return;
      }

      const total = this.questions.length;
      const progress = ((this.currentQuestion) / total) * 100;

      let optionsHtml = '';
      if (q.options) {
        optionsHtml = q.options
          .map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            return `<button class="quiz-option" data-index="${idx}">${letter}. ${DOM.sanitize(opt)}</button>`;
          })
          .join('');
      } else {
        optionsHtml = `
          <button class="quiz-option" data-value="true">✅ Benar</button>
          <button class="quiz-option" data-value="false">❌ Salah</button>
        `;
      }

      container.innerHTML = `
        <div class="quiz-progress">
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:${progress}%"></div>
          </div>
          <span class="quiz-progress-text">${this.currentQuestion + 1}/${total}</span>
        </div>
        <div class="quiz-question">
          <div class="quiz-question-number">Pertanyaan ${this.currentQuestion + 1}</div>
          <div class="quiz-question-text">${DOM.sanitize(q.question)}</div>
          ${q.statement ? `<div style="padding:0.75rem;background:var(--glass-bg);border-radius:var(--radius-lg);margin-bottom:1rem;font-style:italic;font-size:var(--text-sm);color:var(--gray);line-height:1.6">"${DOM.sanitize(q.statement)}"</div>` : ''}
          <div class="quiz-options">${optionsHtml}</div>
        </div>
      `;

      // Bind options
      DOM.$$('.quiz-option').forEach((opt) => {
        opt.addEventListener('click', () => this.selectOption(opt, q));
      });
    },

    selectOption(opt, q) {
      // Disable all options
      DOM.$$('.quiz-option').forEach((o) => (o.disabled = true));

      let isCorrect = false;

      if (q.options) {
        const idx = parseInt(opt.dataset.index);
        isCorrect = idx === q.answer;
        if (isCorrect) {
          opt.classList.add('correct');
          this.score++;
        } else {
          opt.classList.add('wrong');
          // Highlight correct
          DOM.$$('.quiz-option')[q.answer]?.classList.add('correct');
        }
      } else {
        const val = opt.dataset.value === 'true';
        isCorrect = val === q.answer;
        if (isCorrect) {
          opt.classList.add('correct');
          this.score++;
        } else {
          opt.classList.add('wrong');
          DOM.$$('.quiz-option').forEach((o) => {
            if ((o.dataset.value === 'true') === q.answer) {
              o.classList.add('correct');
            }
          });
        }
      }

      this.answers.push({ question: q, correct: isCorrect });

      // Show explanation
      const questionDiv = DOM.$('.quiz-question');
      const explanation = DOM.create('div', {
        className: '',
        style: {
          padding: '0.75rem 1rem',
          marginTop: '0.75rem',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--primary-gradient-soft)',
          fontSize: 'var(--text-sm)',
          color: 'var(--dark-2)',
          lineHeight: '1.6',
        },
      }, [
        DOM.create('strong', {}, [isCorrect ? '✅ Benar! ' : '❌ Salah. ']),
        document.createTextNode(q.explanation || ''),
      ]);
      questionDiv.appendChild(explanation);

      // Next button
      const nextBtn = DOM.create('button', {
        className: 'btn btn-primary',
        style: { marginTop: '1rem' },
      }, [
        this.currentQuestion < this.questions.length - 1
          ? 'Pertanyaan Selanjutnya <i class="bi bi-arrow-right"></i>'
          : 'Lihat Hasil <i class="bi bi-trophy"></i>',
      ]);

      nextBtn.addEventListener('click', () => {
        this.currentQuestion++;
        this.renderQuestion();
      });

      questionDiv.appendChild(nextBtn);
    },

    renderResult() {
      const container = DOM.$('#quiz-container');
      if (!container) return;

      const total = this.questions.length;
      const percentage = Math.round((this.score / total) * 100);

      let grade = '🧠',
        gradeText = 'Luar Biasa!';
      if (percentage < 40) {
        grade = '📚';
        gradeText = 'Ayo Belajar Lagi!';
      } else if (percentage < 60) {
        grade = '💪';
        gradeText = 'Terus Berusaha!';
      } else if (percentage < 80) {
        grade = '🌟';
        gradeText = 'Bagus!';
      } else if (percentage < 100) {
        grade = '🏆';
        gradeText = 'Hampir Sempurna!';
      } else {
        grade = '🎉';
        gradeText = 'Sempurna!';
      }

      container.innerHTML = `
        <div class="quiz-result">
          <div style="font-size:4rem;margin-bottom:1rem">${grade}</div>
          <div class="quiz-score">${percentage}%</div>
          <div class="quiz-score-label">${gradeText}</div>
          <div style="margin:1.5rem 0;padding:1rem;background:var(--glass-bg);border-radius:var(--radius-2xl)">
            <div style="display:flex;justify-content:center;gap:2rem">
              <div>
                <div style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:var(--primary)">${this.score}</div>
                <div style="font-size:var(--text-sm);color:var(--gray)">Benar</div>
              </div>
              <div>
                <div style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:#EF4444">${total - this.score}</div>
                <div style="font-size:var(--text-sm);color:var(--gray)">Salah</div>
              </div>
              <div>
                <div style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:var(--accent)">${total}</div>
                <div style="font-size:var(--text-sm);color:var(--gray)">Total</div>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="location.reload()">🔄 Coba Lagi</button>
            <a href="explore.html" class="btn btn-outline">📖 Jelajahi</a>
          </div>
        </div>
      `;

      // Save result
      Store.quizResults.add({
        score: this.score,
        total,
        percentage,
      });
    },
  };

  // ==========================================
  // Landing Page Feature (Index)
  // ==========================================
  const LandingFeature = {
    async init() {
      await this.loadTrending();
      await this.loadRandom();
      this.setupSearch();
      this.animateStats();
    },

    async loadTrending() {
      const container = DOM.$('#hero-trending');
      if (!container) return;

      try {
        const articles = await WikiAPI.getRandomArticles(5);
        container.innerHTML = '';
        articles.forEach((article, index) => {
          container.appendChild(UI.renderTrendingItem(article, index));
        });
      } catch {
        // Silent
      }
    },

    async loadRandom() {
      const container = DOM.$('#daily-knowledge-card');
      if (!container) return;

      try {
        const articles = await WikiAPI.getRandomArticles(1);
        if (articles[0]) {
          container.innerHTML = '';
          container.appendChild(UI.renderArticleCard(articles[0]));
        }
      } catch {
        // Silent
      }
    },

    setupSearch() {
      const searchInput = DOM.$('#hero-search-input');
      const searchBtn = DOM.$('#hero-search-btn');
      const suggestions = DOM.$('#hero-suggestions');

      if (!searchInput) return;

      const showSuggestions = DOM.debounce(async (query) => {
        if (query.length < 2) {
          if (suggestions) suggestions.style.display = 'none';
          return;
        }
        try {
          const results = await WikiAPI.autoComplete(query);
          if (suggestions && results.length > 0) {
            suggestions.innerHTML = '';
            suggestions.style.display = 'block';
            results.forEach((r) => {
              const item = DOM.create('div', { className: 'search-suggestion' }, [
                DOM.create('i', { className: 'bi bi-search', style: { marginRight: '0.5rem', fontSize: '0.8rem' } }),
                document.createTextNode(r),
              ]);
              item.onclick = () => {
                window.location.href = `article.html?title=${encodeURIComponent(r)}`;
              };
              suggestions.appendChild(item);
            });
          }
        } catch {
          // Silent
        }
      }, 300);

      searchInput.addEventListener('input', (e) => showSuggestions(e.target.value));

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = searchInput.value.trim();
          if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
      });

      if (searchBtn) {
        searchBtn.addEventListener('click', () => {
          const query = searchInput.value.trim();
          if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        });
      }

      // Close suggestions on click outside
      document.addEventListener('click', (e) => {
        if (suggestions && !e.target.closest('.hero-search')) {
          suggestions.style.display = 'none';
        }
      });
    },

    animateStats() {
      DOM.$$('.hero-stat-value').forEach((stat) => {
        const target = parseInt(stat.textContent.replace(/[^0-9]/g, ''));
        if (!target) return;
        let current = 0;
        const increment = Math.ceil(target / 50);
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          stat.textContent = current.toLocaleString() + '+';
        }, 30);
      });
    },
  };

  // ==========================================
  // About Page Feature
  // ==========================================
  const AboutFeature = {
    init() {
      this.setupFAQ();
      this.setupTechStack();
    },

    setupFAQ() {
      DOM.$$('.faq-question').forEach((q) => {
        q.addEventListener('click', () => {
          const answer = q.nextElementSibling;
          const isOpen = answer.style.maxHeight;
          DOM.$$('.faq-answer').forEach((a) => {
            a.style.maxHeight = null;
            a.previousElementSibling.classList.remove('active');
          });
          if (!isOpen) {
            answer.style.maxHeight = answer.scrollHeight + 'px';
            q.classList.add('active');
          }
        });
      });
    },

    setupTechStack() {
      // Stagger animation for tech items
      DOM.$$('.tech-item').forEach((item, i) => {
        item.style.animationDelay = `${i * 0.05}s`;
        item.classList.add('animate__fadeInUp');
      });
    },
  };

  // ==========================================
  // Global Functions (window level)
  // ==========================================
  window.removeBookmark = function (title) {
    Store.bookmarks.remove(title);
    DOM.showToast('Dihapus dari bookmark', 'warning');
    const container = DOM.$('#bookmark-list');
    if (container) {
      container.innerHTML = '';
      BookmarkFeature.renderBookmarks();
    }
  };

  // ==========================================
  // Application Initialization
  // ==========================================
  const App = {
    async init() {
      // Hide loading screen after everything loads
      const loader = UI.showLoading();

      // Initialize navigation
      Nav.init();

      // Initialize particles
      this.initParticles();
      this.initCursorGlow();
      this.initLenis();
      this.initAOS();
      this.initFAB();
      this.initTilt();

      // Page-specific initialization
      const page = window.location.pathname.split('/').pop() || 'index.html';

      try {
        switch (page) {
          case 'index.html':
            await LandingFeature.init();
            break;
          case 'search.html':
            SearchFeature.init();
            break;
          case 'article.html':
            await ArticleFeature.init();
            break;
          case 'bookmark.html':
            BookmarkFeature.init();
            break;
          case 'explore.html':
            ExploreFeature.init();
            await ExploreFeature.renderRandomArticles();
            break;
          case 'category.html':
            await CategoryFeature.init();
            break;
          case 'trending.html':
            await TrendingFeature.init();
            break;
          case 'quiz.html':
            QuizFeature.init();
            break;
          case 'about.html':
            AboutFeature.init();
            break;
        }
      } catch (err) {
        console.error('Page init error:', err);
      }

      // Hide loading after a minimum display time
      setTimeout(() => UI.hideLoading(), 800);
    },

    initParticles() {
      const canvas = DOM.$('#particles-canvas');
      if (!canvas || typeof particlesJS === 'undefined') return;

      particlesJS('particles-canvas', {
        particles: {
          number: { value: 50, density: { enable: true, value_area: 800 } },
          color: { value: '#6366F1' },
          shape: { type: 'circle' },
          opacity: { value: 0.15, random: true },
          size: { value: 2, random: true },
          line_linked: {
            enable: true,
            distance: 150,
            color: '#6366F1',
            opacity: 0.06,
            width: 1,
          },
          move: {
            enable: true,
            speed: 1,
            direction: 'none',
            random: true,
            straight: false,
            out_mode: 'out',
          },
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: { enable: true, mode: 'grab' },
            onclick: { enable: true, mode: 'push' },
            resize: true,
          },
          modes: {
            grab: { distance: 140, line_linked: { opacity: 0.3 } },
            push: { particles_nb: 4 },
          },
        },
        retina_detect: true,
      });
    },

    initCursorGlow() {
      const glow = DOM.$('.cursor-glow');
      if (!glow) return;

      document.addEventListener('mousemove', (e) => {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
      });
    },

    initLenis() {
      if (typeof lenis !== 'undefined') {
        const lenisInstance = new lenis({
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: 'vertical',
          smoothWheel: true,
        });

        function raf(time) {
          lenisInstance.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
      }
    },

    initAOS() {
      if (typeof AOS !== 'undefined') {
        AOS.init({
          duration: 800,
          once: true,
          offset: 100,
          delay: 100,
        });
      }
    },

    initFAB() {
      const fab = DOM.$('.fab');
      if (!fab) return;

      window.addEventListener('scroll', () => {
        if (window.scrollY > 400) fab.classList.add('visible');
        else fab.classList.remove('visible');
      }, { passive: true });

      fab.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    },

    initTilt() {
      if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(DOM.$$('[data-tilt]'), {
          max: 5,
          speed: 400,
          glare: true,
          'max-glare': 0.2,
        });
      }
    },
  };

  // ==========================================
  // Boot
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
