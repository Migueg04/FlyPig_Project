/**
 * FlyPig - Persistence & State Management
 * 
 * Handles all localStorage operations, schema defaults, event dispatches,
 * and data integrity with zero external dependencies.
 */

(function(root) {
  'use strict';

  const STORAGE_KEY = 'FLYPIG_DATA_V1';

  const DEFAULT_CATEGORIES = [
    { id: 'cat_housing', name: 'Housing', group: 'Needs', icon: '🏠' },
    { id: 'cat_food', name: 'Food / Groceries', group: 'Needs', icon: '🛒' },
    { id: 'cat_transport', name: 'Transport', group: 'Needs', icon: '🚇' },
    { id: 'cat_health', name: 'Health', group: 'Needs', icon: '💊' },
    { id: 'cat_comm', name: 'Communications', group: 'Needs', icon: '📱' },
    { id: 'cat_home', name: 'Home Essentials', group: 'Needs', icon: '🧻' },
    { id: 'cat_restaurants', name: 'Restaurants & Cafés', group: 'Leisure', icon: '☕' },
    { id: 'cat_entertainment', name: 'Entertainment', group: 'Leisure', icon: '🎬' },
    { id: 'cat_travel', name: 'Travel & Trips', group: 'Leisure', icon: '✈️' },
    { id: 'cat_shopping', name: 'Shopping & Clothes', group: 'Leisure', icon: '🛍️' },
    { id: 'cat_hobbies', name: 'Hobbies & Sports', group: 'Leisure', icon: '⚽' },
    { id: 'cat_savings', name: 'Extra Savings', group: 'Finance', icon: '🐷' },
    { id: 'cat_other', name: 'Other', group: 'Finance', icon: '📦' }
  ];

  const DEFAULT_STORES = [
    'REWE', 'Penny', 'Lidl', 'Aldi', 'dm', 'Edeka', 'Amazon', 'Burger King', 'McDonalds', 'Supermarket'
  ];

  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  function getInitialState() {
    return {
      version: 1,
      settings: {
        currency: 'EUR',
        currencySymbol: '€',
        locale: 'en-US'
      },
      months: {},
      activeMonthId: null
    };
  }

  const Store = {
    /**
     * Safe load from localStorage with fallback for corrupted data.
     */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getInitialState();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.version) {
          return getInitialState();
        }
        return parsed;
      } catch (e) {
        console.warn('Could not read FlyPig localStorage data. Reverting to initial state.', e);
        return getInitialState();
      }
    },

    /**
     * Persists state to localStorage and fires a change notification.
     */
    save(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('flypig-data-changed', { detail: state }));
        }
        return true;
      } catch (e) {
        console.error('Failed to save FlyPig state to localStorage', e);
        return false;
      }
    },

    /**
     * Resets all app data back to clean slate.
     */
    resetAll() {
      localStorage.removeItem(STORAGE_KEY);
      const initial = getInitialState();
      this.save(initial);
      return initial;
    },

    /**
     * Returns current active month object or null.
     */
    getActiveMonth() {
      const state = this.load();
      if (!state.activeMonthId || !state.months[state.activeMonthId]) {
        const monthIds = Object.keys(state.months).sort();
        if (monthIds.length > 0) {
          const latestId = monthIds[monthIds.length - 1];
          state.activeMonthId = latestId;
          this.save(state);
          return state.months[latestId];
        }
        return null;
      }
      return state.months[state.activeMonthId];
    },

    /**
     * Returns a specific month by its ID (e.g. '2026-10').
     */
    getMonth(monthId) {
      const state = this.load();
      return state.months[monthId] || null;
    },

    /**
     * Sets the active viewing month.
     */
    setActiveMonth(monthId) {
      const state = this.load();
      if (state.months[monthId]) {
        state.activeMonthId = monthId;
        this.save(state);
        return true;
      }
      return false;
    },

    /**
     * Returns all months sorted chronologically descending (newest first).
     */
    getAllMonths() {
      const state = this.load();
      return Object.values(state.months).sort((a, b) => b.id.localeCompare(a.id));
    },

    /**
     * Creates or overwrites a month record.
     * Month ID format: "YYYY-MM" (e.g. "2026-10")
     */
    createMonth(year, monthIndex1Based, config) {
      const state = this.load();
      const padMonth = String(monthIndex1Based).padStart(2, '0');
      const monthId = `${year}-${padMonth}`;

      const dateObj = new Date(year, monthIndex1Based - 1, 1);
      const monthName = dateObj.toLocaleDateString(state.settings.locale || 'en-US', {
        month: 'long',
        year: 'numeric'
      });

      const newMonth = {
        id: monthId,
        year: Number(year),
        month: Number(monthIndex1Based),
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        income: config.income || 0, // in cents
        fixedExpenses: (config.fixedExpenses || []).map(f => ({
          id: f.id || generateId('fix'),
          name: f.name || 'Expense',
          amount: f.amount || 0,
          category: f.category || 'Housing'
        })),
        plannedExpenses: (config.plannedExpenses || []).map(p => ({
          id: p.id || generateId('plan'),
          name: p.name || 'Planned',
          amount: p.amount || 0,
          category: p.category || 'Food'
        })),
        plannedSavings: config.plannedSavings || 0, // in cents
        expenses: config.expenses || [],
        closed: false,
        closingSummary: null,
        createdAt: Date.now()
      };

      state.months[monthId] = newMonth;
      state.activeMonthId = monthId;
      this.save(state);
      return newMonth;
    },

    /**
     * Copies configuration (income, fixed, planned, savings) from the most recent month
     * to a new month.
     */
    copyPreviousMonth(targetYear, targetMonthIndex1Based) {
      const state = this.load();
      const sorted = Object.values(state.months).sort((a, b) => b.id.localeCompare(a.id));
      if (sorted.length === 0) return null;

      const source = sorted[0]; // Most recent existing month
      return this.createMonth(targetYear, targetMonthIndex1Based, {
        income: source.income,
        fixedExpenses: source.fixedExpenses.map(f => ({ ...f, id: generateId('fix') })),
        plannedExpenses: source.plannedExpenses.map(p => ({ ...p, id: generateId('plan') })),
        plannedSavings: source.plannedSavings,
        expenses: []
      });
    },

    /**
     * Updates an existing month's configuration (income, fixed, planned, savings).
     */
    updateMonthConfig(monthId, updates) {
      const state = this.load();
      const month = state.months[monthId];
      if (!month) return false;

      if (updates.income !== undefined) month.income = updates.income;
      if (updates.plannedSavings !== undefined) month.plannedSavings = updates.plannedSavings;
      if (updates.fixedExpenses !== undefined) month.fixedExpenses = updates.fixedExpenses;
      if (updates.plannedExpenses !== undefined) month.plannedExpenses = updates.plannedExpenses;
      if (updates.closed !== undefined) month.closed = updates.closed;

      this.save(state);
      return true;
    },

    /**
     * Adds an expense to a month.
     */
    addExpense(monthId, expenseData) {
      const state = this.load();
      const month = state.months[monthId];
      if (!month) return null;

      const newExpense = {
        id: generateId('exp'),
        amount: expenseData.amount || 0, // in cents
        date: expenseData.date || new Date().toISOString().split('T')[0],
        category: expenseData.category || 'Food / Groceries',
        type: expenseData.type || 'normal', // 'normal' | 'extraordinary' | 'emergency'
        store: (expenseData.store || '').trim(),
        description: (expenseData.description || '').trim(),
        paymentMethod: expenseData.paymentMethod || 'Card',
        createdAt: Date.now()
      };

      month.expenses.push(newExpense);
      this.save(state);
      return newExpense;
    },

    /**
     * Updates an existing expense.
     */
    updateExpense(monthId, expenseId, updates) {
      const state = this.load();
      const month = state.months[monthId];
      if (!month) return false;

      const idx = month.expenses.findIndex(e => e.id === expenseId);
      if (idx === -1) return false;

      month.expenses[idx] = {
        ...month.expenses[idx],
        ...updates,
        updatedAt: Date.now()
      };

      this.save(state);
      return true;
    },

    /**
     * Deletes an expense.
     */
    deleteExpense(monthId, expenseId) {
      const state = this.load();
      const month = state.months[monthId];
      if (!month) return false;

      const initialLen = month.expenses.length;
      month.expenses = month.expenses.filter(e => e.id !== expenseId);

      if (month.expenses.length !== initialLen) {
        this.save(state);
        return true;
      }
      return false;
    },

    /**
     * Returns a sorted list of unique store names for autocomplete suggestions.
     */
    getUniqueStores() {
      const state = this.load();
      const storeSet = new Set(DEFAULT_STORES);
      for (const m of Object.values(state.months)) {
        for (const exp of m.expenses || []) {
          if (exp.store && exp.store.trim()) {
            storeSet.add(exp.store.trim());
          }
        }
      }
      return Array.from(storeSet).sort((a, b) => a.localeCompare(b));
    },

    /**
     * Exports entire state as JSON for backup.
     */
    exportData() {
      const state = this.load();
      return JSON.stringify(state, null, 2);
    },

    /**
     * Imports JSON data with validation.
     */
    importData(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || typeof parsed !== 'object' || !parsed.version || !parsed.months) {
          throw new Error('Invalid FlyPig data format');
        }
        this.save(parsed);
        return true;
      } catch (e) {
        console.error('Data import failed:', e);
        return false;
      }
    },

    /**
     * Returns current settings.
     */
    getSettings() {
      const state = this.load();
      return state.settings || { currency: 'EUR', currencySymbol: '€', locale: 'en-US' };
    },

    /**
     * Updates app settings.
     */
    updateSettings(updates) {
      const state = this.load();
      state.settings = { ...state.settings, ...updates };
      this.save(state);
    }
  };

  root.Store = Store;
  root.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
  root.DEFAULT_STORES = DEFAULT_STORES;
})(typeof window !== 'undefined' ? window : globalThis);
