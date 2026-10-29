/**
 * FlyPig - Financial Calculations Module
 * 
 * All internal monetary calculations are performed in integer cents to eliminate
 * JavaScript floating point rounding errors (e.g. 0.1 + 0.2 != 0.3).
 * Functions are pure and do not mutate input data.
 */

(function(root) {
  'use strict';

  const Calculations = {
    /**
     * Converts a float/decimal number or string (e.g. "8.50", "8,50", "114,16", or 8.5) to integer cents (850).
     * Accepts both comma and dot as decimal separators effortlessly.
     */
    toCents(amount) {
      if (amount === null || amount === undefined) return 0;
      if (typeof amount === 'string') {
        const cleaned = amount.trim().replace(/[^\d.,-]/g, '').replace(',', '.');
        if (!cleaned || isNaN(cleaned)) return 0;
        return Math.round(parseFloat(cleaned) * 100);
      }
      if (isNaN(amount)) return 0;
      return Math.round(amount * 100);
    },

    /**
     * Converts integer cents (850) to decimal number (8.50).
     */
    fromCents(cents) {
      if (!cents || isNaN(cents)) return 0;
      return cents / 100;
    },

    /**
     * Formats cents into a clean currency string using Intl.NumberFormat.
     */
    formatCurrency(cents, currencySymbol = '€', locale = 'en-US') {
      const val = this.fromCents(cents);
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(val));
      
      const sign = val < 0 ? '-' : '';
      return `${sign}${currencySymbol}${formatted}`;
    },

    /**
     * Sums fixed recurring expenses (rent, insurance, subscriptions).
     */
    calculateFixedTotal(fixedExpenses = []) {
      return fixedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    },

    /**
     * Sums planned/expected essential envelope budgets (groceries, home basics).
     */
    calculatePlannedTotal(plannedExpenses = []) {
      return plannedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    },

    /**
     * Total committed/obligated expenses = Fixed obligations + Planned envelopes.
     */
    calculateCommittedTotal(month) {
      if (!month) return 0;
      const fixed = this.calculateFixedTotal(month.fixedExpenses);
      const planned = this.calculatePlannedTotal(month.plannedExpenses);
      return fixed + planned;
    },

    /**
     * Calculates the free discretionary variable spending budget for the month.
     * Variable Budget = Income - Fixed Expenses - Planned Envelopes - Planned Savings.
     */
    calculateVariableBudget(month) {
      if (!month) return 0;
      const income = month.income || 0;
      const committed = this.calculateCommittedTotal(month);
      const savings = month.plannedSavings || 0;
      return Math.max(0, income - committed - savings);
    },

    /**
     * Breakdown of actual spending by expense type and category.
     */
    calculateSpentBreakdown(expenses = []) {
      let totalSpent = 0;
      let normalSpent = 0;
      let extraordinarySpent = 0;
      let emergencySpent = 0;
      const byCategory = {};

      for (const exp of expenses) {
        const amt = exp.amount || 0;
        totalSpent += amt;

        const type = exp.type || 'normal';
        if (type === 'normal') {
          normalSpent += amt;
        } else if (type === 'extraordinary') {
          extraordinarySpent += amt;
        } else if (type === 'emergency') {
          emergencySpent += amt;
        }

        const cat = exp.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
      }

      return {
        totalSpent,
        normalSpent,
        extraordinarySpent,
        emergencySpent,
        byCategory
      };
    },

    /**
     * Calculates Planned Essential Envelopes (e.g. Groceries / Mercado).
     * Prevents the double-deduction bug:
     * When an expense matches a planned envelope (e.g. Food / Groceries),
     * it draws down from that envelope instead of double-deducting from free variable leisure spending.
     */
    calculateEnvelopes(month) {
      if (!month) {
        return { envelopes: [], totalPlanned: 0, totalSpent: 0, totalRemaining: 0, totalOverrun: 0 };
      }

      const plannedList = month.plannedExpenses || [];
      const expenses = month.expenses || [];

      let totalPlanned = 0;
      let totalSpent = 0;
      let totalOverrun = 0;
      let totalRemaining = 0;

      const envelopes = plannedList.map(plan => {
        const planCat = (plan.category || '').toLowerCase().trim();
        const planName = (plan.name || '').toLowerCase().trim();

        // Match normal expenses that belong to this envelope
        const matchingExpenses = expenses.filter(exp => {
          if (exp.type && exp.type !== 'normal') return false; // emergency/extraordinary tracked separately
          const expCat = (exp.category || '').toLowerCase().trim();
          const expDesc = (exp.description || '').toLowerCase().trim();
          const expStore = (exp.store || '').toLowerCase().trim();

          const isFoodCategory = (planCat.includes('food') || planCat.includes('grocer') || planName.includes('mercad') || planName.includes('grocer')) &&
                                 (expCat.includes('food') || expCat.includes('grocer') || expCat.includes('mercad'));

          return expCat === planCat || isFoodCategory || expCat === planName || expDesc.includes(planName) || expStore.includes(planName);
        });

        const spent = matchingExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const planned = plan.amount || 0;
        const remaining = Math.max(0, planned - spent);
        const overrun = Math.max(0, spent - planned);
        const pctUsed = planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : 0;

        totalPlanned += planned;
        totalSpent += spent;
        totalRemaining += remaining;
        totalOverrun += overrun;

        return {
          id: plan.id,
          name: plan.name,
          category: plan.category,
          planned,
          spent,
          remaining,
          overrun,
          pctUsed,
          expenseCount: matchingExpenses.length
        };
      });

      return {
        envelopes,
        totalPlanned,
        totalSpent,
        totalRemaining,
        totalOverrun
      };
    },

    /**
     * Checks if an expense category matches a planned envelope.
     */
    isEnvelopeCategory(month, categoryName) {
      if (!month || !month.plannedExpenses || !categoryName) return false;
      const cat = categoryName.toLowerCase().trim();
      return month.plannedExpenses.some(p => {
        const pCat = (p.category || '').toLowerCase().trim();
        const pName = (p.name || '').toLowerCase().trim();
        const isFood = (cat.includes('food') || cat.includes('grocer') || cat.includes('mercad')) &&
                       (pCat.includes('food') || pCat.includes('grocer') || pName.includes('mercad'));
        return pCat === cat || pName === cat || isFood;
      });
    },

    /**
     * Calculates remaining amount available for variable spending and cash in account.
     * Prevents double-counting: expenses in planned envelopes draw from their envelope,
     * while free variable spending draws from discretionary leisure budget.
     */
    calculateAvailable(month) {
      if (!month) return { availableVariable: 0, overallCashRemaining: 0, savingsUntouched: true };

      const income = month.income || 0;
      const fixedTotal = this.calculateFixedTotal(month.fixedExpenses);
      const plannedSavings = month.plannedSavings || 0;
      const variableBudget = this.calculateVariableBudget(month);
      const spent = this.calculateSpentBreakdown(month.expenses || []);
      const envelopesInfo = this.calculateEnvelopes(month);

      // Discretionary expenses = normal expenses that do NOT belong to a planned envelope
      let discretionarySpent = 0;
      for (const exp of month.expenses || []) {
        if (exp.type === 'normal') {
          if (!this.isEnvelopeCategory(month, exp.category)) {
            discretionarySpent += (exp.amount || 0);
          }
        }
      }

      // If user had no envelopes configured, fall back directly to normalSpent
      if (envelopesInfo.envelopes.length === 0) {
        discretionarySpent = spent.normalSpent;
      }

      // Any overrun beyond planned envelopes spills into the discretionary budget
      const totalDiscretionaryDeduction = discretionarySpent + envelopesInfo.totalOverrun;
      const availableVariable = variableBudget - totalDiscretionaryDeduction;

      // Real Cash remaining in account = Income - Fixed Bills - Actual Purchases Incurred
      // (No phantom double-deduction of unspent grocery money!)
      const overallCashRemaining = income - fixedTotal - spent.totalSpent;

      // Did spending eat into planned savings?
      const savingsUntouched = overallCashRemaining >= plannedSavings;
      const savingsDeficit = savingsUntouched ? 0 : plannedSavings - Math.max(0, overallCashRemaining);

      return {
        variableBudget,
        availableVariable,
        discretionarySpent,
        overallCashRemaining,
        plannedSavings,
        totalSpent: spent.totalSpent,
        normalSpent: spent.normalSpent,
        extraordinarySpent: spent.extraordinarySpent,
        emergencySpent: spent.emergencySpent,
        envelopesInfo,
        savingsUntouched,
        savingsDeficit
      };
    },

    /**
     * Computes the number of days remaining in the month.
     * If viewing the current calendar month, counts from today through end of month (inclusive).
     * If viewing a past month, returns 0.
     * If viewing a future month, returns total days in that month.
     */
    calculateDaysRemaining(year, monthIndex1Based, referenceDate = new Date()) {
      const totalDaysInMonth = new Date(year, monthIndex1Based, 0).getDate();
      const currentYear = referenceDate.getFullYear();
      const currentMonth = referenceDate.getMonth() + 1;
      const currentDay = referenceDate.getDate();

      if (year < currentYear || (year === currentYear && monthIndex1Based < currentMonth)) {
        return 0; // Past month
      }
      if (year > currentYear || (year === currentYear && monthIndex1Based > currentMonth)) {
        return totalDaysInMonth; // Future month
      }

      // Current month: today through the last day of month
      return Math.max(1, totalDaysInMonth - currentDay + 1);
    },

    /**
     * Formats current date for display (e.g. "Oct 12, 2026" or "12 de octubre").
     */
    formatCurrentDateDisplay(locale = 'es-ES', referenceDate = new Date()) {
      try {
        return referenceDate.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return referenceDate.toDateString();
      }
    },

    /**
     * Calculates the total days in a month.
     */
    getTotalDaysInMonth(year, monthIndex1Based) {
      return new Date(year, monthIndex1Based, 0).getDate();
    },

    /**
     * Recommended daily spending pace.
     * Daily Pace = Remaining Available Variable Budget / Remaining Days.
     */
    calculateDailyPace(availableVariableCents, daysRemaining) {
      if (daysRemaining <= 0) return 0;
      if (availableVariableCents <= 0) return 0;
      return Math.floor(availableVariableCents / daysRemaining);
    },

    /**
     * Computes financial pace status and non-judgmental guidance message.
     */
    calculatePaceStatus(month, referenceDate = new Date()) {
      if (!month) return { level: 'neutral', message: 'No financial data for this month.', badge: '⚪' };

      const { year, month: monthNum } = month;
      const daysRemaining = this.calculateDaysRemaining(year, monthNum, referenceDate);
      const totalDays = this.getTotalDaysInMonth(year, monthNum);
      const currentDay = referenceDate.getDate();

      const avail = this.calculateAvailable(month);
      const dailyPace = this.calculateDailyPace(avail.availableVariable, daysRemaining);

      // If past month
      if (daysRemaining === 0) {
        if (avail.overallCashRemaining >= avail.plannedSavings) {
          return {
            level: 'good',
            badge: '🟢',
            title: 'Month Completed',
            message: `You successfully met your planned savings of ${this.formatCurrency(avail.plannedSavings)} with ${this.formatCurrency(avail.overallCashRemaining - avail.plannedSavings)} leftover.`,
            dailyPace: 0,
            daysRemaining: 0
          };
        } else {
          return {
            level: 'warning',
            badge: '🟡',
            title: 'Month Completed',
            message: `The month closed with ${this.formatCurrency(Math.max(0, avail.overallCashRemaining))} in remaining funds.`,
            dailyPace: 0,
            daysRemaining: 0
          };
        }
      }

      // Check emergency absorption
      let emergencyNote = '';
      if (avail.emergencySpent > 0 || avail.extraordinarySpent > 0) {
        const extraTotal = avail.emergencySpent + avail.extraordinarySpent;
        if (avail.savingsUntouched) {
          emergencyNote = ` Note: You absorbed ${this.formatCurrency(extraTotal)} in unexpected expenses without compromising your planned savings.`;
        } else {
          emergencyNote = ` Note: Unexpected expenses of ${this.formatCurrency(extraTotal)} are currently dipping into your planned savings margin.`;
        }
      }

      // Determine status level
      if (avail.availableVariable <= 0) {
        return {
          level: 'danger',
          badge: '🔴',
          title: 'Variable Budget Depleted',
          message: `You have reached your variable spending budget for this month. Any further spending will draw from your planned savings of ${this.formatCurrency(avail.plannedSavings)}.${emergencyNote}`,
          dailyPace: 0,
          daysRemaining
        };
      }

      // Expected discretionary spending by today if paced evenly
      const expectedNormalSpent = totalDays > 0 ? (avail.variableBudget / totalDays) * currentDay : 0;
      const actualDiscretionary = avail.discretionarySpent;

      // If spending faster than average by more than 15%
      if (actualDiscretionary > expectedNormalSpent * 1.15) {
        return {
          level: 'warning',
          badge: '🟡',
          title: 'Pacing a bit faster',
          message: `You are spending slightly faster than your initial daily pace, but you still have ${this.formatCurrency(avail.availableVariable)} remaining (${this.formatCurrency(dailyPace)}/day).${emergencyNote}`,
          dailyPace,
          daysRemaining
        };
      }

      // On track or ahead of pace
      return {
        level: 'good',
        badge: '🟢',
        title: 'Comfortably on track',
        message: `You are on track this month. You have ${this.formatCurrency(avail.availableVariable)} available (${this.formatCurrency(dailyPace)}/day for the next ${daysRemaining} days).${emergencyNote}`,
        dailyPace,
        daysRemaining
      };
    },

    /**
     * "What-If" Purchase Simulator.
     * Evaluates the impact of a hypothetical expense without modifying any data.
     */
    simulatePurchase(month, purchaseAmountCents, conceptName = 'Hypothetical Purchase', referenceDate = new Date()) {
      if (!month) return null;

      const currentAvail = this.calculateAvailable(month);
      const { year, month: monthNum } = month;
      const daysRemaining = this.calculateDaysRemaining(year, monthNum, referenceDate);
      const currentDailyPace = this.calculateDailyPace(currentAvail.availableVariable, daysRemaining);

      // Hypothetical after purchase
      const simulatedAvailableVariable = currentAvail.availableVariable - purchaseAmountCents;
      const simulatedCashRemaining = currentAvail.overallCashRemaining - purchaseAmountCents;
      const simulatedDailyPace = this.calculateDailyPace(simulatedAvailableVariable, daysRemaining);
      const simulatedSavingsUntouched = simulatedCashRemaining >= currentAvail.plannedSavings;
      const savingsCompromisedAmount = simulatedSavingsUntouched ? 0 : currentAvail.plannedSavings - Math.max(0, simulatedCashRemaining);

      // Formulate neutral, helpful explanation based on product philosophy (Section 2.1)
      let interpretation = '';
      let statusLevel = 'good';

      if (simulatedAvailableVariable >= 0 && simulatedSavingsUntouched) {
        statusLevel = 'good';
        interpretation = `You can comfortably afford "${conceptName}". Your planned savings of ${this.formatCurrency(currentAvail.plannedSavings)} remain completely untouched, and your recommended pace would adjust to ${this.formatCurrency(simulatedDailyPace)}/day.`;
      } else if (simulatedAvailableVariable < 0 && simulatedSavingsUntouched) {
        statusLevel = 'warning';
        interpretation = `You can afford "${conceptName}", but it would exceed your planned variable spending by ${this.formatCurrency(Math.abs(simulatedAvailableVariable))}. Your planned savings are still protected, but your daily spending margin for the rest of the month will be very tight.`;
      } else if (simulatedCashRemaining >= 0 && !simulatedSavingsUntouched) {
        statusLevel = 'warning';
        interpretation = `This purchase is possible with your available funds, but it would reduce your planned monthly savings by ${this.formatCurrency(savingsCompromisedAmount)} (leaving ${this.formatCurrency(simulatedCashRemaining)} saved instead of ${this.formatCurrency(currentAvail.plannedSavings)}).`;
      } else {
        statusLevel = 'danger';
        interpretation = `This purchase would exceed your total monthly income and commitments by ${this.formatCurrency(Math.abs(simulatedCashRemaining))}, completely consuming this month's savings.`;
      }

      return {
        conceptName,
        purchaseAmount: purchaseAmountCents,
        before: {
          availableVariable: currentAvail.availableVariable,
          dailyPace: currentDailyPace,
          plannedSavings: currentAvail.plannedSavings,
          cashRemaining: currentAvail.overallCashRemaining
        },
        after: {
          availableVariable: simulatedAvailableVariable,
          dailyPace: simulatedDailyPace,
          plannedSavings: currentAvail.plannedSavings,
          cashRemaining: simulatedCashRemaining,
          savingsUntouched: simulatedSavingsUntouched,
          savingsCompromisedAmount
        },
        statusLevel,
        interpretation
      };
    }
  };

  root.Calculations = Calculations;
})(typeof window !== 'undefined' ? window : globalThis);
