/**
 * FlyPig - Application Orchestrator & Event Controller
 */

(function(root) {
  'use strict';

  const Calculations = root.Calculations;
  const Store = root.Store;
  const UI = root.UI;

  class FlyPigApp {
    constructor() {
      this.currentView = 'dashboard';
    }

    init() {
      // 1. Initial category rendering & selects
      UI.populateCategorySelects();
      UI.renderCategoryChips('Food / Groceries');
      UI.renderStoreSuggestions();

      // 2. Setup event listeners
      this.bindNavigation();
      this.bindQuickAdd();
      this.bindExpenseEditing();
      this.bindMonthManagement();
      this.bindSimulator();
      this.bindMonthConfig();
      this.bindSettingsAndBackups();
      this.bindOnboarding();

      // 3. React to any state change
      window.addEventListener('flypig-data-changed', () => {
        this.refreshCurrentView();
      });

      // 4. Check if we need first-time onboarding
      const state = Store.load();
      const months = Object.keys(state.months);

      if (months.length === 0) {
        this.startFirstTimeOnboarding();
      } else {
        this.refreshApp();
      }
    }

    // Refreshes entire UI based on active month
    refreshApp() {
      const activeMonth = Store.getActiveMonth();
      UI.renderMonthSelector();
      UI.renderStoreSuggestions();

      if (activeMonth) {
        UI.renderDashboard(activeMonth);
        if (this.currentView === 'expenses') UI.renderExpensesList(activeMonth);
        if (this.currentView === 'stats') UI.renderStatistics(activeMonth);
        if (this.currentView === 'settings') UI.renderMonthConfigForm(activeMonth);
      }
    }

    refreshCurrentView() {
      const activeMonth = Store.getActiveMonth();
      UI.renderMonthSelector();
      UI.renderStoreSuggestions();

      if (!activeMonth) return;

      if (this.currentView === 'dashboard') {
        UI.renderDashboard(activeMonth);
      } else if (this.currentView === 'expenses') {
        UI.renderExpensesList(activeMonth);
      } else if (this.currentView === 'stats') {
        UI.renderStatistics(activeMonth);
      } else if (this.currentView === 'settings') {
        UI.renderMonthConfigForm(activeMonth);
      }
    }

    // Bind Navigation Tabs
    bindNavigation() {
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const viewName = tab.getAttribute('data-view');
          this.currentView = viewName;
          UI.switchView(viewName);
        });
      });

      // Month Selector in header
      const selector = document.getElementById('month-selector');
      if (selector) {
        selector.addEventListener('change', (e) => {
          const monthId = e.target.value;
          Store.setActiveMonth(monthId);
          this.refreshApp();
        });
      }

      // Header "+ Month" button
      document.getElementById('btn-new-month-header')?.addEventListener('click', () => {
        this.openNewMonthModal();
      });

      // "View all" link on dashboard
      document.getElementById('btn-see-all-expenses')?.addEventListener('click', () => {
        this.currentView = 'expenses';
        UI.switchView('expenses');
      });

      // "Simulate" teaser on dashboard
      document.getElementById('btn-open-sim-teaser')?.addEventListener('click', () => {
        this.currentView = 'simulator';
        UI.switchView('simulator');
        document.getElementById('sim-concept')?.focus();
      });

      // Brand logo home click
      document.getElementById('brand-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentView = 'dashboard';
        UI.switchView('dashboard');
      });
    }

    // Bind Quick Add Modal
    bindQuickAdd() {
      const btnOpen = document.getElementById('btn-open-quick-add');
      const btnClose = document.getElementById('btn-close-quick-add');
      const form = document.getElementById('form-quick-add');
      const typeButtons = document.querySelectorAll('#add-type-segmented .segment-btn');
      const typeHidden = document.getElementById('add-selected-type');
      const typeHelp = document.getElementById('add-type-help');
      const dateInput = document.getElementById('add-date');
      const amountInput = document.getElementById('add-amount');

      if (amountInput) UI.bindDecimalInput(amountInput);

      btnOpen?.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = today;

        const settings = Store.getSettings();
        const currEl = document.getElementById('modal-add-currency');
        if (currEl) currEl.textContent = settings.currencySymbol || '€';

        UI.renderStoreSuggestions();
        const initialCategory = document.getElementById('add-selected-category')?.value || 'Food / Groceries';
        UI.updateBucketHint(initialCategory);
        UI.openModal('modal-quick-add');
      });

      btnClose?.addEventListener('click', () => {
        UI.closeModal('modal-quick-add');
      });

      // Segmented control for expense type
      typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          typeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const selectedType = btn.getAttribute('data-type');
          if (typeHidden) typeHidden.value = selectedType;

          if (typeHelp) {
            if (selectedType === 'normal') {
              typeHelp.textContent = 'Regular everyday spending.';
            } else if (selectedType === 'extraordinary') {
              typeHelp.textContent = 'Unexpected expense, but not compromising your stability.';
            } else if (selectedType === 'emergency') {
              typeHelp.textContent = 'Urgent shock (medical, critical repair) affecting financial stability.';
            }
          }
        });
      });

      // Form submit
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const activeMonth = Store.getActiveMonth();
        if (!activeMonth) {
          UI.showToast('Please create or select an active month first.', '⚠️');
          return;
        }

        const amountVal = document.getElementById('add-amount')?.value;
        const amountCents = Calculations.toCents(amountVal);

        if (amountCents <= 0) {
          UI.showToast('Please enter an amount greater than 0.', '⚠️');
          return;
        }

        const category = document.getElementById('add-selected-category')?.value || 'Food / Groceries';
        const store = document.getElementById('add-store')?.value || '';
        const type = document.getElementById('add-selected-type')?.value || 'normal';
        const date = document.getElementById('add-date')?.value || new Date().toISOString().split('T')[0];
        const description = document.getElementById('add-description')?.value || '';
        const paymentMethod = document.getElementById('add-payment-method')?.value || 'Card';

        Store.addExpense(activeMonth.id, {
          amount: amountCents,
          category,
          store,
          type,
          date,
          description,
          paymentMethod
        });

        // Reset form
        form.reset();
        typeButtons.forEach(b => b.classList.remove('active'));
        typeButtons[0].classList.add('active');
        if (typeHidden) typeHidden.value = 'normal';
        if (typeHelp) typeHelp.textContent = 'Regular everyday spending.';
        UI.renderCategoryChips('Food / Groceries');

        UI.closeModal('modal-quick-add');
        const settings = Store.getSettings();
        const isEnvelope = Calculations.isEnvelopeCategory(activeMonth, category);
        const toastMsg = isEnvelope 
          ? `Logged ${Calculations.formatCurrency(amountCents, settings.currencySymbol || '€')} (Sobre Mercado 🛒)`
          : `Logged ${Calculations.formatCurrency(amountCents, settings.currencySymbol || '€')}`;
        UI.showToast(toastMsg, '✅');
      });
    }

    // Bind Expense Editing & Deletion
    bindExpenseEditing() {
      const btnClose = document.getElementById('btn-close-edit-expense');
      const form = document.getElementById('form-edit-expense');
      const btnDelete = document.getElementById('btn-delete-expense');
      const editAmountInput = document.getElementById('edit-amount');

      if (editAmountInput) UI.bindDecimalInput(editAmountInput);

      btnClose?.addEventListener('click', () => {
        UI.closeModal('modal-edit-expense');
      });

      document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-exp');
        if (!editBtn) return;

        const expId = editBtn.getAttribute('data-id');
        const activeMonth = Store.getActiveMonth();
        if (!activeMonth) return;

        const expense = (activeMonth.expenses || []).find(x => x.id === expId);
        if (!expense) return;

        document.getElementById('edit-expense-id').value = expense.id;
        document.getElementById('edit-amount').value = (expense.amount / 100).toFixed(2);
        document.getElementById('edit-category').value = expense.category;
        document.getElementById('edit-store').value = expense.store || '';
        document.getElementById('edit-type').value = expense.type || 'normal';
        document.getElementById('edit-date').value = expense.date;
        document.getElementById('edit-description').value = expense.description || '';

        const settings = Store.getSettings();
        document.getElementById('modal-edit-currency').textContent = settings.currencySymbol || '€';

        UI.openModal('modal-edit-expense');
      });

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const expId = document.getElementById('edit-expense-id').value;
        const activeMonth = Store.getActiveMonth();
        if (!activeMonth || !expId) return;

        const amountCents = Calculations.toCents(document.getElementById('edit-amount').value);
        if (amountCents <= 0) {
          UI.showToast('Amount must be greater than 0', '⚠️');
          return;
        }

        Store.updateExpense(activeMonth.id, expId, {
          amount: amountCents,
          category: document.getElementById('edit-category').value,
          store: document.getElementById('edit-store').value,
          type: document.getElementById('edit-type').value,
          date: document.getElementById('edit-date').value,
          description: document.getElementById('edit-description').value
        });

        UI.closeModal('modal-edit-expense');
        UI.showToast('Expense updated', '✏️');
      });

      btnDelete?.addEventListener('click', () => {
        const expId = document.getElementById('edit-expense-id').value;
        const activeMonth = Store.getActiveMonth();
        if (!activeMonth || !expId) return;

        if (confirm('Delete this expense?')) {
          Store.deleteExpense(activeMonth.id, expId);
          UI.closeModal('modal-edit-expense');
          UI.showToast('Expense removed', '🗑️');
        }
      });

      const searchInput = document.getElementById('expense-search-input');
      const typeFilter = document.getElementById('expense-filter-type');
      const catFilter = document.getElementById('expense-filter-category');

      const triggerFilter = () => {
        const activeMonth = Store.getActiveMonth();
        if (activeMonth) UI.renderExpensesList(activeMonth);
      };

      searchInput?.addEventListener('input', triggerFilter);
      typeFilter?.addEventListener('change', triggerFilter);
      catFilter?.addEventListener('change', triggerFilter);
    }

    // Bind Month Creation & Rollover
    bindMonthManagement() {
      const btnClose = document.getElementById('btn-close-new-month');
      const form = document.getElementById('form-new-month');
      const dateInput = document.getElementById('new-month-select-date');
      const btnCopyPrev = document.getElementById('btn-copy-prev-month');

      btnClose?.addEventListener('click', () => {
        UI.closeModal('modal-new-month');
      });

      btnCopyPrev?.addEventListener('click', () => {
        const dateVal = dateInput.value;
        if (!dateVal) {
          UI.showToast('Please select a target month first.', '⚠️');
          return;
        }

        const [y, m] = dateVal.split('-').map(Number);
        const copied = Store.copyPreviousMonth(y, m);
        if (copied) {
          UI.closeModal('modal-new-month');
          this.refreshApp();
          UI.showToast(`Created ${copied.name} with copied setup!`, '📋');
        } else {
          UI.showToast('No previous month available to copy.', '⚠️');
        }
      });

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const dateVal = dateInput.value;
        if (!dateVal) return;

        const [y, m] = dateVal.split('-').map(Number);
        const existing = Store.getMonth(`${y}-${String(m).padStart(2, '0')}`);

        if (existing) {
          Store.setActiveMonth(existing.id);
          UI.closeModal('modal-new-month');
          this.refreshApp();
          UI.showToast(`Switched to ${existing.name}`, '🗓️');
          return;
        }

        const newMonth = Store.createMonth(y, m, {
          income: 0,
          fixedExpenses: [],
          plannedExpenses: [],
          plannedSavings: 0,
          expenses: []
        });

        UI.closeModal('modal-new-month');
        this.refreshApp();
        UI.showToast(`Started ${newMonth.name}`, '🎉');
        this.currentView = 'settings';
        UI.switchView('settings');
      });
    }

    openNewMonthModal() {
      const dateInput = document.getElementById('new-month-select-date');
      const now = new Date();
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const pad = (n) => String(n).padStart(2, '0');
      if (dateInput) {
        dateInput.value = `${nextMonthDate.getFullYear()}-${pad(nextMonthDate.getMonth() + 1)}`;
      }
      UI.openModal('modal-new-month');
    }

    // Bind "What-If" Purchase Simulator
    bindSimulator() {
      const form = document.getElementById('simulator-form');
      const outcomeContainer = document.getElementById('sim-outcome-container');
      const conceptInput = document.getElementById('sim-concept');
      const amountInput = document.getElementById('sim-amount');
      const currSym = document.getElementById('sim-currency-sym');

      if (amountInput) UI.bindDecimalInput(amountInput);

      const settings = Store.getSettings();
      if (currSym) currSym.textContent = settings.currencySymbol || '€';

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const activeMonth = Store.getActiveMonth();
        if (!activeMonth) {
          UI.showToast('Please select or create an active month first.', '⚠️');
          return;
        }

        const concept = conceptInput.value.trim() || 'Hypothetical Purchase';
        const amountCents = Calculations.toCents(amountInput.value);

        if (amountCents <= 0) {
          UI.showToast('Please enter an amount greater than 0', '⚠️');
          return;
        }

        const simResult = Calculations.simulatePurchase(activeMonth, amountCents, concept);
        if (!simResult) return;

        const sym = settings.currencySymbol || '€';
        const loc = settings.locale || 'es-ES';

        document.getElementById('sim-result-title').textContent = `Simulation: ${simResult.conceptName} (${Calculations.formatCurrency(amountCents, sym, loc)})`;

        document.getElementById('sim-before-avail').textContent = Calculations.formatCurrency(simResult.before.availableVariable, sym, loc);
        document.getElementById('sim-before-pace').textContent = `${Calculations.formatCurrency(simResult.before.dailyPace, sym, loc)}/d`;
        document.getElementById('sim-before-savings').textContent = Calculations.formatCurrency(simResult.before.plannedSavings, sym, loc);

        const afterAvailEl = document.getElementById('sim-after-avail');
        afterAvailEl.textContent = Calculations.formatCurrency(simResult.after.availableVariable, sym, loc);
        if (simResult.after.availableVariable < 0) {
          afterAvailEl.style.color = '#ef4444';
        } else {
          afterAvailEl.style.color = '';
        }

        document.getElementById('sim-after-pace').textContent = `${Calculations.formatCurrency(simResult.after.dailyPace, sym, loc)}/d`;
        document.getElementById('sim-after-savings').textContent = Calculations.formatCurrency(simResult.after.plannedSavings, sym, loc);

        const simBanner = document.getElementById('sim-status-banner');
        const simBadge = document.getElementById('sim-status-badge');
        const simInterp = document.getElementById('sim-interpretation');

        if (simBanner) simBanner.className = `status-banner ${simResult.statusLevel}`;
        if (simBadge) {
          simBadge.textContent = simResult.statusLevel === 'good' ? '🟢' : simResult.statusLevel === 'warning' ? '🟡' : '🔴';
        }
        if (simInterp) simInterp.textContent = simResult.interpretation;

        if (outcomeContainer) {
          outcomeContainer.style.display = 'block';
          outcomeContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // Bind Month Configuration Form
    bindMonthConfig() {
      const form = document.getElementById('month-config-form');
      const btnAddFixed = document.getElementById('btn-add-fixed-item');
      const btnAddPlanned = document.getElementById('btn-add-planned-item');
      const fixedList = document.getElementById('cfg-fixed-list');
      const plannedList = document.getElementById('cfg-planned-list');
      const incomeInput = document.getElementById('cfg-income');
      const savingsInput = document.getElementById('cfg-savings');

      if (incomeInput) UI.bindDecimalInput(incomeInput);
      if (savingsInput) UI.bindDecimalInput(savingsInput);

      btnAddFixed?.addEventListener('click', () => {
        UI.addDynamicRow(fixedList, '', '', 'fixed');
      });

      btnAddPlanned?.addEventListener('click', () => {
        UI.addDynamicRow(plannedList, '', '', 'planned');
      });

      incomeInput?.addEventListener('input', () => UI.updateConfigPreview());
      savingsInput?.addEventListener('input', () => UI.updateConfigPreview());

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const activeMonth = Store.getActiveMonth();
        if (!activeMonth) return;

        const incomeCents = Calculations.toCents(incomeInput.value);
        const savingsCents = Calculations.toCents(savingsInput.value);

        const fixedExpenses = [];
        fixedList.querySelectorAll('.dynamic-row').forEach(row => {
          const name = row.querySelector('.row-name').value.trim();
          const amt = Calculations.toCents(row.querySelector('.row-amount').value);
          if (name && amt > 0) {
            fixedExpenses.push({ id: `fix_${Date.now()}_${Math.random()}`, name, amount: amt, category: 'Housing' });
          }
        });

        const plannedExpenses = [];
        plannedList.querySelectorAll('.dynamic-row').forEach(row => {
          const name = row.querySelector('.row-name').value.trim();
          const amt = Calculations.toCents(row.querySelector('.row-amount').value);
          if (name && amt > 0) {
            plannedExpenses.push({ id: `plan_${Date.now()}_${Math.random()}`, name, amount: amt, category: 'Food / Groceries' });
          }
        });

        Store.updateMonthConfig(activeMonth.id, {
          income: incomeCents,
          plannedSavings: savingsCents,
          fixedExpenses,
          plannedExpenses
        });

        UI.showToast('Monthly configuration saved!', '💾');
        this.currentView = 'dashboard';
        UI.switchView('dashboard');
      });
    }

    // Bind Settings & Backup actions
    bindSettingsAndBackups() {
      const currSelect = document.getElementById('setting-currency');
      const btnExport = document.getElementById('btn-export-data');
      const btnReset = document.getElementById('btn-reset-data');
      const fileImport = document.getElementById('file-import-input');

      const settings = Store.getSettings();
      if (currSelect) {
        for (const opt of currSelect.options) {
          if (opt.value.startsWith(settings.currency)) {
            opt.selected = true;
            break;
          }
        }

        currSelect.addEventListener('change', () => {
          const [currCode, currSym, currLoc] = currSelect.value.split('|');
          Store.updateSettings({ currency: currCode, currencySymbol: currSym, locale: currLoc || 'es-ES' });
          UI.showToast(`Currency updated to ${currCode} (${currSym})`, '⚙️');
          this.refreshApp();
        });
      }

      btnExport?.addEventListener('click', () => {
        const dataStr = Store.exportData();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flypig-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('Backup downloaded successfully', '📦');
      });

      fileImport?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target.result;
          const success = Store.importData(content);
          if (success) {
            UI.showToast('Data imported successfully!', '🎉');
            this.refreshApp();
          } else {
            UI.showToast('Import failed: Invalid file format.', '❌');
          }
        };
        reader.readAsText(file);
      });

      btnReset?.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all FlyPig data? This cannot be undone.')) {
          Store.resetAll();
          UI.showToast('All data has been reset.', '🔄');
          this.startFirstTimeOnboarding();
        }
      });
    }

    // Bind First-time Onboarding Wizard
    bindOnboarding() {
      const btnNext1 = document.getElementById('btn-wiz-next-1');
      const btnNext2 = document.getElementById('btn-wiz-next-2');
      const btnPrev2 = document.getElementById('btn-wiz-prev-2');
      const btnNext3 = document.getElementById('btn-wiz-next-3');
      const btnPrev3 = document.getElementById('btn-wiz-prev-3');
      const btnPrev4 = document.getElementById('btn-wiz-prev-4');
      const btnFinish = document.getElementById('btn-finish-onboarding');

      const btnAddFixed = document.getElementById('btn-onboard-add-fixed');
      const btnAddPlanned = document.getElementById('btn-onboard-add-planned');

      const fixedList = document.getElementById('onboard-fixed-list');
      const plannedList = document.getElementById('onboard-planned-list');
      const incomeInput = document.getElementById('onboard-income');
      const savingsInput = document.getElementById('onboard-savings');
      const currSelect = document.getElementById('onboard-currency-select');

      if (incomeInput) UI.bindDecimalInput(incomeInput);
      if (savingsInput) UI.bindDecimalInput(savingsInput);

      // Live currency selector in onboarding step 1
      currSelect?.addEventListener('change', () => {
        const [code, symbol, locale] = currSelect.value.split('|');
        Store.updateSettings({ currency: code, currencySymbol: symbol, locale: locale || 'es-ES' });
        document.querySelectorAll('.onboard-curr-symbol').forEach(el => el.textContent = symbol);
        UI.updateOnboardingPreview();
      });

      btnAddFixed?.addEventListener('click', () => {
        UI.addDynamicRow(fixedList, '', '', 'fixed');
        UI.updateOnboardingPreview();
      });

      btnAddPlanned?.addEventListener('click', () => {
        UI.addDynamicRow(plannedList, '', '', 'planned');
        UI.updateOnboardingPreview();
      });

      incomeInput?.addEventListener('input', () => UI.updateOnboardingPreview());
      savingsInput?.addEventListener('input', () => UI.updateOnboardingPreview());

      const goToStep = (stepNumber) => {
        for (let i = 1; i <= 4; i++) {
          const panel = document.getElementById(`wizard-step-${i}`);
          const bullet = document.getElementById(`wiz-bullet-${i}`);
          if (panel) panel.style.display = i === stepNumber ? 'block' : 'none';
          if (bullet) {
            bullet.classList.remove('active', 'done');
            if (i === stepNumber) bullet.classList.add('active');
            if (i < stepNumber) bullet.classList.add('done');
          }
        }
        UI.updateOnboardingPreview();
      };

      btnNext1?.addEventListener('click', () => {
        const inc = Calculations.toCents(incomeInput.value);
        if (inc <= 0) {
          UI.showToast('Please enter your monthly income to continue.', '⚠️');
          return;
        }
        goToStep(2);
      });

      btnPrev2?.addEventListener('click', () => goToStep(1));
      btnNext2?.addEventListener('click', () => goToStep(3));
      btnPrev3?.addEventListener('click', () => goToStep(2));
      btnNext3?.addEventListener('click', () => goToStep(4));
      btnPrev4?.addEventListener('click', () => goToStep(3));

      btnFinish?.addEventListener('click', () => {
        const incomeCents = Calculations.toCents(incomeInput.value);
        const savingsCents = Calculations.toCents(savingsInput.value);

        const fixedExpenses = [];
        fixedList.querySelectorAll('.dynamic-row').forEach(row => {
          const name = row.querySelector('.row-name').value.trim();
          const amt = Calculations.toCents(row.querySelector('.row-amount').value);
          if (name && amt > 0) {
            fixedExpenses.push({ id: `fix_${Date.now()}_${Math.random()}`, name, amount: amt, category: 'Housing' });
          }
        });

        const plannedExpenses = [];
        plannedList.querySelectorAll('.dynamic-row').forEach(row => {
          const name = row.querySelector('.row-name').value.trim();
          const amt = Calculations.toCents(row.querySelector('.row-amount').value);
          if (name && amt > 0) {
            fixedExpenses.push;
            plannedExpenses.push({ id: `plan_${Date.now()}_${Math.random()}`, name, amount: amt, category: 'Food / Groceries' });
          }
        });

        // Set currency from onboarding selection
        if (currSelect) {
          const [code, symbol, locale] = currSelect.value.split('|');
          Store.updateSettings({ currency: code, currencySymbol: symbol, locale: locale || 'es-ES' });
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        Store.createMonth(currentYear, currentMonth, {
          income: incomeCents,
          plannedSavings: savingsCents,
          fixedExpenses,
          plannedExpenses,
          expenses: []
        });

        UI.closeModal('modal-onboarding');
        this.refreshApp();
        UI.showToast('Welcome to FlyPig! Your month is set up.', '🐷✨');
      });
    }

    startFirstTimeOnboarding() {
      const fixedList = document.getElementById('onboard-fixed-list');
      const plannedList = document.getElementById('onboard-planned-list');
      const currSelect = document.getElementById('onboard-currency-select');
      const incomeInput = document.getElementById('onboard-income');
      const savingsInput = document.getElementById('onboard-savings');

      if (incomeInput) UI.bindDecimalInput(incomeInput);
      if (savingsInput) UI.bindDecimalInput(savingsInput);

      if (currSelect) {
        const settings = Store.getSettings();
        for (const opt of currSelect.options) {
          if (opt.value.startsWith(settings.currency)) {
            opt.selected = true;
            break;
          }
        }
      }

      if (fixedList) {
        fixedList.innerHTML = '';
        UI.addDynamicRow(fixedList, 'Rent & Utilities', '400.00', 'fixed');
        UI.addDynamicRow(fixedList, 'Health Insurance', '80.00', 'fixed');
        UI.addDynamicRow(fixedList, 'Mobile & Internet', '20.00', 'fixed');
      }

      if (plannedList) {
        plannedList.innerHTML = '';
        UI.addDynamicRow(plannedList, 'Groceries / Mercado', '150.00', 'planned');
        UI.addDynamicRow(plannedList, 'Household Essentials', '20.00', 'planned');
      }

      for (let i = 1; i <= 4; i++) {
        const panel = document.getElementById(`wizard-step-${i}`);
        const bullet = document.getElementById(`wiz-bullet-${i}`);
        if (panel) panel.style.display = i === 1 ? 'block' : 'none';
        if (bullet) {
          bullet.classList.remove('active', 'done');
          if (i === 1) bullet.classList.add('active');
        }
      }

      UI.updateOnboardingPreview();
      UI.openModal('modal-onboarding');
    }
  }

  // Bootstrap when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    const app = new FlyPigApp();
    app.init();
  });

  root.FlyPigApp = FlyPigApp;
})(typeof window !== 'undefined' ? window : globalThis);
