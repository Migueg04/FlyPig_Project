/**
 * FlyPig - UI Rendering & Presentation Module
 */

(function(root) {
  'use strict';

  const Calculations = root.Calculations;
  const Store = root.Store;

  const UI = {
    // Toast notification
    showToast(message, icon = '🐷') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 2800);
    },

    // Attaches smart decimal input handling so users can type ',' or '.' seamlessly
    bindDecimalInput(input) {
      if (!input || input._hasDecimalFilter) return;
      input._hasDecimalFilter = true;

      input.addEventListener('input', (e) => {
        let val = input.value;
        // Keep only numbers and comma or dot
        val = val.replace(/[^0-9.,]/g, '');

        // Allow at most one comma or dot
        const parts = val.split(/[.,]/);
        if (parts.length > 2) {
          const sep = val.match(/[.,]/)[0];
          val = parts[0] + sep + parts.slice(1).join('');
        }
        if (input.value !== val) {
          input.value = val;
        }
      });
    },

    // Modal helpers
    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
        const autofocusEl = modal.querySelector('[autofocus]');
        if (autofocusEl) setTimeout(() => autofocusEl.focus(), 80);
      }
    },

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    },

    // View navigation
    switchView(viewName) {
      document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
      });
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      });

      const targetView = document.getElementById(`view-${viewName}`);
      const targetTab = document.querySelector(`.nav-tab[data-view="${viewName}"]`);

      if (targetView) targetView.classList.add('active');
      if (targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-selected', 'true');
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Refresh specific view data if needed
      const activeMonth = Store.getActiveMonth();
      if (viewName === 'expenses') this.renderExpensesList(activeMonth);
      if (viewName === 'stats') this.renderStatistics(activeMonth);
      if (viewName === 'settings') this.renderMonthConfigForm(activeMonth);
    },

    // Populate month selector dropdown in header
    renderMonthSelector() {
      const selector = document.getElementById('month-selector');
      if (!selector) return;

      const months = Store.getAllMonths();
      const activeMonth = Store.getActiveMonth();
      selector.innerHTML = '';

      if (months.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = 'No months yet';
        selector.appendChild(opt);
        return;
      }

      for (const m of months) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (activeMonth && m.id === activeMonth.id) {
          opt.selected = true;
        }
        selector.appendChild(opt);
      }
    },

    // Populate store autocomplete suggestions
    renderStoreSuggestions() {
      const datalist = document.getElementById('store-suggestions');
      if (!datalist) return;
      const stores = Store.getUniqueStores();
      datalist.innerHTML = stores.map(s => `<option value="${s}">`).join('');
    },

    // Updates live bucket hint when picking a category in Quick Add
    updateBucketHint(categoryName) {
      const hintEl = document.getElementById('add-bucket-hint');
      if (!hintEl) return;

      const activeMonth = Store.getActiveMonth();
      const isEnvelope = Calculations.isEnvelopeCategory(activeMonth, categoryName);

      if (isEnvelope) {
        hintEl.innerHTML = `🛒 <strong>Sobre de Mercado / Esenciales:</strong> Se descuenta de tu presupuesto de comida reservado (sin restar dos veces tu dinero libre).`;
        hintEl.style.color = '#0284c7';
        hintEl.style.background = '#e0f2fe';
      } else {
        hintEl.innerHTML = `☕ <strong>Gasto Libre:</strong> Se descuenta de tu presupuesto libre para ocio, salidas y caprichos.`;
        hintEl.style.color = '#059669';
        hintEl.style.background = '#ecfdf5';
      }
    },

    // Populate category chips in Quick Add
    renderCategoryChips(selectedCategory = 'Food / Groceries') {
      const container = document.getElementById('add-category-chips');
      const hiddenInput = document.getElementById('add-selected-category');
      if (!container) return;

      const categories = root.DEFAULT_CATEGORIES || [];
      container.innerHTML = '';
      for (const cat of categories) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `chip-option ${cat.name === selectedCategory ? 'selected' : ''}`;
        chip.innerHTML = `<span>${cat.icon}</span> <span>${cat.name}</span>`;
        chip.addEventListener('click', () => {
          container.querySelectorAll('.chip-option').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          if (hiddenInput) hiddenInput.value = cat.name;
          this.updateBucketHint(cat.name);
        });
        container.appendChild(chip);
      }

      this.updateBucketHint(selectedCategory);
    },

    // Populate category dropdowns
    populateCategorySelects() {
      const selects = [
        document.getElementById('edit-category'),
        document.getElementById('expense-filter-category')
      ];

      const categories = root.DEFAULT_CATEGORIES || [];
      for (const select of selects) {
        if (!select) continue;
        const isFilter = select.id === 'expense-filter-category';
        select.innerHTML = isFilter ? '<option value="all">All Categories</option>' : '';

        for (const cat of categories) {
          const opt = document.createElement('option');
          opt.value = cat.name;
          opt.textContent = `${cat.icon} ${cat.name}`;
          select.appendChild(opt);
        }
      }
    },

    // Renders the Hero and Overview on Dashboard
    renderDashboard(month) {
      if (!month) return;
      const settings = Store.getSettings();
      const sym = settings.currencySymbol || '€';
      const loc = settings.locale || 'es-ES';

      const avail = Calculations.calculateAvailable(month);
      const paceStatus = Calculations.calculatePaceStatus(month);

      // Hero figures
      const heroAvailEl = document.getElementById('hero-available-amount');
      const heroPaceEl = document.getElementById('hero-daily-pace');
      const heroDaysEl = document.getElementById('hero-remaining-days');
      const heroCurrentDateEl = document.getElementById('hero-current-date');
      const heroSavingsEl = document.getElementById('hero-planned-savings');
      const heroSavingsStatusEl = document.getElementById('hero-savings-status');

      // Date displays
      const formattedDate = Calculations.formatCurrentDateDisplay(loc);
      if (heroCurrentDateEl) {
        heroCurrentDateEl.textContent = `🗓️ ${formattedDate}`;
      }

      if (heroAvailEl) {
        heroAvailEl.textContent = Calculations.formatCurrency(avail.availableVariable, sym, loc);
        if (avail.availableVariable < 0) {
          heroAvailEl.classList.add('negative');
        } else {
          heroAvailEl.classList.remove('negative');
        }
      }

      if (heroPaceEl) {
        heroPaceEl.textContent = `${Calculations.formatCurrency(paceStatus.dailyPace, sym, loc)} / day`;
      }

      if (heroDaysEl) {
        heroDaysEl.textContent = paceStatus.daysRemaining > 0 
          ? `🗓️ Hoy: ${formattedDate} • ${paceStatus.daysRemaining} días restantes`
          : `Mes completado`;
      }

      if (heroSavingsEl) {
        heroSavingsEl.textContent = Calculations.formatCurrency(month.plannedSavings, sym, loc);
      }

      if (heroSavingsStatusEl) {
        heroSavingsStatusEl.textContent = avail.savingsUntouched
          ? 'Protegido y seguro'
          : `Déficit: ${Calculations.formatCurrency(avail.savingsDeficit, sym, loc)}`;
      }

      // Guidance banner
      const banner = document.getElementById('status-banner');
      const badge = document.getElementById('status-badge');
      const title = document.getElementById('status-title');
      const msg = document.getElementById('status-message');

      if (banner) {
        banner.className = `status-banner ${paceStatus.level}`;
      }
      if (badge) badge.textContent = paceStatus.badge;
      if (title) title.textContent = paceStatus.title;
      if (msg) msg.textContent = paceStatus.message;

      // Budget Progress Segments
      const committedTotal = Calculations.calculateCommittedTotal(month);
      const income = month.income || 1; // avoid divide by 0
      const committedPct = Math.min(100, Math.max(0, (committedTotal / income) * 100));
      const savingsPct = Math.min(100, Math.max(0, (month.plannedSavings / income) * 100));
      const spentPct = Math.min(100, Math.max(0, (avail.normalSpent / income) * 100));
      const availablePct = Math.min(100, Math.max(0, (Math.max(0, avail.availableVariable) / income) * 100));

      const segCommitted = document.getElementById('seg-committed');
      const segSavings = document.getElementById('seg-savings');
      const segSpent = document.getElementById('seg-spent');
      const segAvailable = document.getElementById('seg-available');

      if (segCommitted) segCommitted.style.width = `${committedPct}%`;
      if (segSavings) segSavings.style.width = `${savingsPct}%`;
      if (segSpent) segSpent.style.width = `${spentPct}%`;
      if (segAvailable) segAvailable.style.width = `${availablePct}%`;

      // 4 Key Box Figures
      const incomeLabel = document.getElementById('label-income-total');
      if (incomeLabel) incomeLabel.textContent = `Ingresos: ${Calculations.formatCurrency(month.income, sym, loc)}`;

      const valCommitted = document.getElementById('val-committed');
      const valVarBudget = document.getElementById('val-variable-budget');
      const valSpent = document.getElementById('val-spent');
      const valSavings = document.getElementById('val-savings');

      if (valCommitted) valCommitted.textContent = Calculations.formatCurrency(committedTotal, sym, loc);
      if (valVarBudget) valVarBudget.textContent = Calculations.formatCurrency(avail.variableBudget, sym, loc);
      if (valSpent) valSpent.textContent = Calculations.formatCurrency(avail.totalSpent, sym, loc);
      if (valSavings) valSavings.textContent = Calculations.formatCurrency(month.plannedSavings, sym, loc);

      // Render Planned Envelopes (Groceries / Mercado tracker)
      this.renderEnvelopesSection(avail.envelopesInfo, sym, loc, paceStatus.daysRemaining);

      // Recent 5 expenses on Dashboard
      this.renderRecentExpenses(month);
    },

    // Renders Planned Envelopes (Groceries, etc.) on the Dashboard
    renderEnvelopesSection(envelopesInfo, sym, loc, daysRemaining) {
      const container = document.getElementById('envelopes-container');
      const section = document.getElementById('section-envelopes');
      if (!container || !section) return;

      const envelopes = envelopesInfo?.envelopes || [];
      if (envelopes.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'flex';
      container.innerHTML = envelopes.map(env => {
        const spentStr = Calculations.formatCurrency(env.spent, sym, loc);
        const plannedStr = Calculations.formatCurrency(env.planned, sym, loc);
        const remStr = Calculations.formatCurrency(env.remaining, sym, loc);
        const dailyEnvelopePace = daysRemaining > 0 ? Calculations.formatCurrency(Math.floor(env.remaining / daysRemaining), sym, loc) : '0';

        let badgeColor = '#0284c7';
        let barColor = '#0284c7';
        let statusText = `Te quedan <strong>${remStr}</strong> para compras (${dailyEnvelopePace}/día restante)`;

        if (env.overrun > 0) {
          const overrunStr = Calculations.formatCurrency(env.overrun, sym, loc);
          barColor = '#ef4444';
          badgeColor = '#ef4444';
          statusText = `⚠️ Excediste el presupuesto por <strong>${overrunStr}</strong> (se absorbe de tu dinero libre).`;
        } else if (env.pctUsed >= 80) {
          barColor = '#f59e0b';
        }

        return `
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 0.95rem;">${env.name || 'Mercado'}</span>
              <span style="font-size: 0.85rem; font-weight: 700; color: ${badgeColor};">
                ${spentStr} / ${plannedStr}
              </span>
            </div>

            <div class="progress-track" style="height: 10px;">
              <div class="progress-segment" style="width: ${env.pctUsed}%; background: ${barColor};"></div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted);">
              <span>${statusText}</span>
              <span style="font-weight: 600;">${env.pctUsed}%</span>
            </div>
          </div>
        `;
      }).join('');
    },

    // Helper to get category icon
    getCategoryIcon(categoryName) {
      const categories = root.DEFAULT_CATEGORIES || [];
      const found = categories.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase());
      return found ? found.icon : '💳';
    },

    // Formats date string "YYYY-MM-DD" into friendly "Oct 4"
    formatDisplayDate(dateStr, locale = 'es-ES') {
      if (!dateStr) return '';
      try {
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      } catch {
        return dateStr;
      }
    },

    // Renders Recent Expenses table on Dashboard
    renderRecentExpenses(month) {
      const container = document.getElementById('dashboard-recent-expenses');
      if (!container) return;

      const settings = Store.getSettings();
      const sym = settings.currencySymbol || '€';
      const loc = settings.locale || 'es-ES';

      const expenses = (month.expenses || []).slice().reverse().slice(0, 5);

      if (expenses.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 24px 10px;">
            <div class="empty-icon">🐷</div>
            <div style="font-weight: 600; font-size: 0.9rem;">No expenses yet this month</div>
            <div class="form-help">Tap "+ Expense" to log your first purchase!</div>
          </div>
        `;
        return;
      }

      container.innerHTML = expenses.map(exp => this.createExpenseItemHTML(exp, sym, loc, month)).join('');
    },

    // Renders All Expenses with filters
    renderExpensesList(month) {
      const container = document.getElementById('all-expenses-list');
      const countEl = document.getElementById('expenses-count');
      if (!container || !month) return;

      const settings = Store.getSettings();
      const sym = settings.currencySymbol || '€';
      const loc = settings.locale || 'es-ES';

      const searchQuery = (document.getElementById('expense-search-input')?.value || '').toLowerCase().trim();
      const filterType = document.getElementById('expense-filter-type')?.value || 'all';
      const filterCat = document.getElementById('expense-filter-category')?.value || 'all';

      let expenses = (month.expenses || []).slice().reverse();

      // Filtering
      expenses = expenses.filter(exp => {
        const matchSearch = !searchQuery || 
          (exp.store && exp.store.toLowerCase().includes(searchQuery)) ||
          (exp.description && exp.description.toLowerCase().includes(searchQuery)) ||
          (exp.category && exp.category.toLowerCase().includes(searchQuery));
        
        const matchType = filterType === 'all' || exp.type === filterType;
        const matchCat = filterCat === 'all' || exp.category === filterCat;

        return matchSearch && matchType && matchCat;
      });

      if (countEl) countEl.textContent = `${expenses.length} expense${expenses.length === 1 ? '' : 's'}`;

      if (expenses.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div style="font-weight: 600;">No matching expenses found</div>
            <div class="form-help">Try changing your filters or add a new expense.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = expenses.map(exp => this.createExpenseItemHTML(exp, sym, loc, month)).join('');
    },

    // Generates expense row HTML with Envelope badge if applicable
    createExpenseItemHTML(exp, sym, loc, month) {
      const icon = this.getCategoryIcon(exp.category);
      const formattedAmount = Calculations.formatCurrency(exp.amount, sym, loc);
      const friendlyDate = this.formatDisplayDate(exp.date, loc);
      const title = exp.store || exp.category;
      const subNote = exp.description ? ` • ${exp.description}` : '';

      const isEnvelope = Calculations.isEnvelopeCategory(month, exp.category);
      const envelopeBadge = isEnvelope 
        ? `<span style="font-size: 0.65rem; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 999px; font-weight: 700;">Sobre Mercado</span>` 
        : '';

      return `
        <div class="expense-item" data-id="${exp.id}">
          <div class="expense-left">
            <div class="expense-icon">${icon}</div>
            <div class="expense-meta">
              <div class="expense-title" style="display: flex; align-items: center; gap: 6px;">
                <span>${title}</span>
                ${envelopeBadge}
              </div>
              <div class="expense-sub">
                <span>${friendlyDate}</span>
                <span>•</span>
                <span>${exp.category}</span>
                <span>${subNote}</span>
              </div>
            </div>
          </div>
          <div class="expense-right">
            <span class="expense-amount">${formattedAmount}</span>
            <span class="expense-tag ${exp.type}">${exp.type}</span>
          </div>
          <div class="expense-actions">
            <button class="btn-icon-subtle btn-edit-exp" data-id="${exp.id}" title="Edit Expense">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    },

    // Renders Monthly Statistics & Insights
    renderStatistics(month) {
      if (!month) return;
      const settings = Store.getSettings();
      const sym = settings.currencySymbol || '€';
      const loc = settings.locale || 'es-ES';

      const spent = Calculations.calculateSpentBreakdown(month.expenses || []);
      const avail = Calculations.calculateAvailable(month);

      // Normal vs. Extraordinary vs. Emergency numbers
      const statNormal = document.getElementById('stat-normal-spent');
      const statExtra = document.getElementById('stat-extra-spent');
      const statEmerg = document.getElementById('stat-emerg-spent');
      const statTotal = document.getElementById('stat-total-spent');

      if (statNormal) statNormal.textContent = Calculations.formatCurrency(spent.normalSpent, sym, loc);
      if (statExtra) statExtra.textContent = Calculations.formatCurrency(spent.extraordinarySpent, sym, loc);
      if (statEmerg) statEmerg.textContent = Calculations.formatCurrency(spent.emergencySpent, sym, loc);
      if (statTotal) statTotal.textContent = Calculations.formatCurrency(spent.totalSpent, sym, loc);

      // Savings vs Leftover
      const statSavings = document.getElementById('stat-planned-savings');
      const statLeftover = document.getElementById('stat-estimated-leftover');

      if (statSavings) statSavings.textContent = Calculations.formatCurrency(month.plannedSavings, sym, loc);
      if (statLeftover) {
        const leftover = Math.max(0, avail.overallCashRemaining - month.plannedSavings);
        statLeftover.textContent = Calculations.formatCurrency(leftover, sym, loc);
      }

      // Category progress bars
      const catContainer = document.getElementById('stats-category-bars');
      if (!catContainer) return;

      const categories = Object.entries(spent.byCategory).sort((a, b) => b[1] - a[1]);

      if (categories.length === 0) {
        catContainer.innerHTML = '<div class="form-help">No spending recorded yet this month.</div>';
        return;
      }

      const totalSpent = spent.totalSpent || 1;
      catContainer.innerHTML = categories.map(([catName, amount]) => {
        const pct = Math.round((amount / totalSpent) * 100);
        const icon = this.getCategoryIcon(catName);
        const formatted = Calculations.formatCurrency(amount, sym, loc);

        return `
          <div class="stat-bar-item">
            <div class="stat-bar-labels">
              <span>${icon} ${catName}</span>
              <span>${formatted} (${pct}%)</span>
            </div>
            <div class="stat-bar-track">
              <div class="stat-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    },

    // Renders the Monthly Configuration form
    renderMonthConfigForm(month) {
      if (!month) return;
      const settings = Store.getSettings();
      const sym = settings.currencySymbol || '€';

      const monthNameBadge = document.getElementById('config-month-name');
      if (monthNameBadge) monthNameBadge.textContent = month.name;

      const incomeInput = document.getElementById('cfg-income');
      const savingsInput = document.getElementById('cfg-savings');

      if (incomeInput) {
        incomeInput.value = (month.income / 100).toFixed(2);
        this.bindDecimalInput(incomeInput);
      }
      if (savingsInput) {
        savingsInput.value = (month.plannedSavings / 100).toFixed(2);
        this.bindDecimalInput(savingsInput);
      }

      // Fixed obligations list
      const fixedContainer = document.getElementById('cfg-fixed-list');
      if (fixedContainer) {
        fixedContainer.innerHTML = '';
        (month.fixedExpenses || []).forEach(item => {
          this.addDynamicRow(fixedContainer, item.name, (item.amount / 100).toFixed(2), 'fixed');
        });
      }

      // Planned essentials list
      const plannedContainer = document.getElementById('cfg-planned-list');
      if (plannedContainer) {
        plannedContainer.innerHTML = '';
        (month.plannedExpenses || []).forEach(item => {
          this.addDynamicRow(plannedContainer, item.name, (item.amount / 100).toFixed(2), 'planned');
        });
      }

      this.updateConfigPreview();
    },

    // Helper to add a dynamic bill/planned item row
    addDynamicRow(container, nameVal = '', amountVal = '', type = 'fixed') {
      const row = document.createElement('div');
      row.className = 'dynamic-row';
      row.innerHTML = `
        <input type="text" class="form-input row-name" placeholder="Name (e.g. Rent, Groceries)" value="${nameVal}">
        <input type="text" inputmode="decimal" class="form-input row-amount" placeholder="0.00" value="${amountVal}">
        <button type="button" class="btn-icon-subtle delete btn-remove-row" title="Remove">&times;</button>
      `;

      const amountInput = row.querySelector('.row-amount');
      this.bindDecimalInput(amountInput);

      row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
        this.updateConfigPreview();
      });

      row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => this.updateConfigPreview());
      });

      container.appendChild(row);
    },

    // Updates the live preview calculation in the config form
    updateConfigPreview() {
      const income = Calculations.toCents(document.getElementById('cfg-income')?.value || 0);
      const savings = Calculations.toCents(document.getElementById('cfg-savings')?.value || 0);

      let fixedTotal = 0;
      document.querySelectorAll('#cfg-fixed-list .dynamic-row').forEach(row => {
        const amt = Calculations.toCents(row.querySelector('.row-amount')?.value || 0);
        fixedTotal += amt;
      });

      let plannedTotal = 0;
      document.querySelectorAll('#cfg-planned-list .dynamic-row').forEach(row => {
        const amt = Calculations.toCents(row.querySelector('.row-amount')?.value || 0);
        plannedTotal += amt;
      });

      const variableBudget = Math.max(0, income - fixedTotal - plannedTotal - savings);
      const previewEl = document.getElementById('cfg-preview-variable');
      const settings = Store.getSettings();

      if (previewEl) {
        previewEl.textContent = Calculations.formatCurrency(variableBudget, settings.currencySymbol || '€');
      }
    },

    // Updates live preview in Onboarding Wizard
    updateOnboardingPreview() {
      const income = Calculations.toCents(document.getElementById('onboard-income')?.value || 0);
      const savings = Calculations.toCents(document.getElementById('onboard-savings')?.value || 0);

      let fixedTotal = 0;
      document.querySelectorAll('#onboard-fixed-list .dynamic-row').forEach(row => {
        const amt = Calculations.toCents(row.querySelector('.row-amount')?.value || 0);
        fixedTotal += amt;
      });

      let plannedTotal = 0;
      document.querySelectorAll('#onboard-planned-list .dynamic-row').forEach(row => {
        const amt = Calculations.toCents(row.querySelector('.row-amount')?.value || 0);
        plannedTotal += amt;
      });

      const variableBudget = Math.max(0, income - fixedTotal - plannedTotal - savings);
      const previewEl = document.getElementById('onboard-preview-variable');
      const settings = Store.getSettings();

      if (previewEl) {
        previewEl.textContent = Calculations.formatCurrency(variableBudget, settings.currencySymbol || '€');
      }
    }
  };

  root.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
