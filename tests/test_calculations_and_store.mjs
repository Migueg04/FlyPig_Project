/**
 * Automated Test Suite for FlyPig Core Financial Logic & Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup Mock LocalStorage & Window for testing Store module in Node
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
global.window = {
  dispatchEvent: () => {}
};
global.CustomEvent = class CustomEvent { constructor(name, detail) { this.name = name; this.detail = detail; } };

// Load scripts into execution scope
const calcCode = fs.readFileSync(path.join(__dirname, '../js/calculations.js'), 'utf8');
const storeCode = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf8');

eval(calcCode);
eval(storeCode);

const Calculations = global.window.Calculations || globalThis.Calculations;
const Store = global.window.Store || globalThis.Store;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ PASS: ${message} (Value: ${actual})`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
  }
}

console.log('🧪 Starting FlyPig Test Suite...\n');

// ==========================================
// 1. Cents Conversion & Flexible Decimal Parsing
// ==========================================
console.log('--- 1. Cents Conversion & Decimal Separators (Comma & Dot) ---');
assertEqual(Calculations.toCents(8.50), 850, '8.50 decimal to cents');
assertEqual(Calculations.toCents('8,50'), 850, 'Comma formatted "8,50" to 850 cents');
assertEqual(Calculations.toCents('114,16'), 11416, 'User input "114,16" to 11416 cents');
assertEqual(Calculations.toCents('114.16'), 11416, 'User input "114.16" to 11416 cents');
assertEqual(Calculations.toCents('114'), 11400, 'Whole number "114" to 11400 cents');
assertEqual(Calculations.toCents(0.1 + 0.2), 30, '0.1 + 0.2 correctly converted to 30 cents without float bug');
assertEqual(Calculations.fromCents(850), 8.5, '850 cents to 8.50 float');
assertEqual(Calculations.formatCurrency(850, '€', 'es-ES'), '€8,50', 'Format 850 cents as €8,50 in es-ES');
assertEqual(Calculations.formatCurrency(-28000, '€', 'en-US'), '-€280.00', 'Format negative cents correctly');

// ==========================================
// 2. Budget Formulas & Planned Envelopes (No Double Deduction)
// ==========================================
console.log('\n--- 2. Budget Formulas & Grocery Envelopes ---');
const sampleMonth = {
  id: '2026-10',
  year: 2026,
  month: 10,
  name: 'October 2026',
  income: 99200, // €992.00
  fixedExpenses: [
    { id: '1', name: 'Rent', amount: 40000 },
    { id: '2', name: 'Insurance', amount: 8000 },
    { id: '3', name: 'Phone', amount: 2000 }
  ], // Total fixed = €500.00
  plannedExpenses: [
    { id: 'p1', name: 'Groceries / Mercado', amount: 10000, category: 'Food / Groceries' },
    { id: 'p2', name: 'Home Essentials', amount: 1500, category: 'Home Essentials' }
  ], // Total planned = €115.00
  plannedSavings: 15000, // €150.00
  expenses: []
};

const committed = Calculations.calculateCommittedTotal(sampleMonth);
assertEqual(committed, 61500, 'Committed expenses = €500 + €115 = €615.00');

const variableBudget = Calculations.calculateVariableBudget(sampleMonth);
assertEqual(variableBudget, 22700, 'Free variable budget = €992 - €615 - €150 = €227.00');

// Initial state with 0 expenses
const avail0 = Calculations.calculateAvailable(sampleMonth);
assertEqual(avail0.availableVariable, 22700, 'Initial free variable spending available = €227.00');
assertEqual(avail0.savingsUntouched, true, 'Planned savings remain 100% untouched');

// Test Envelope: Add a Grocery purchase of €35.00 (3500 cents)
sampleMonth.expenses.push({
  id: 'exp_grocery_1',
  amount: 3500,
  type: 'normal',
  category: 'Food / Groceries',
  store: 'Lidl',
  date: '2026-10-04'
});

const availWithGrocery = Calculations.calculateAvailable(sampleMonth);
// Grocery envelope should absorb this €35, NOT double deduct from free leisure budget!
const groceryEnv = availWithGrocery.envelopesInfo.envelopes[0];
assertEqual(groceryEnv.spent, 3500, 'Grocery envelope spent = €35.00');
assertEqual(groceryEnv.remaining, 6500, 'Grocery envelope remaining = €65.00 of €100.00');
assertEqual(availWithGrocery.availableVariable, 22700, 'Free variable leisure budget is NOT double deducted by grocery purchase!');
assertEqual(availWithGrocery.overallCashRemaining, 99200 - 50000 - 3500, 'Real cash remaining reflects actual €35 spent, not full €100 reserved phantom deduction');

// Now add a Leisure expense of €84.00 (8400 cents) on Restaurants
sampleMonth.expenses.push({
  id: 'exp_leisure_1',
  amount: 8400,
  type: 'normal',
  category: 'Restaurants & Cafés',
  date: '2026-10-05'
});

const availWithLeisure = Calculations.calculateAvailable(sampleMonth);
assertEqual(availWithLeisure.availableVariable, 22700 - 8400, 'Free variable budget drops by €84 to €143.00 from leisure spending');

// Check remaining days & pace on Oct 4 (31 - 4 + 1 = 28 days left)
const refDate = new Date(2026, 9, 4); // Oct 4, 2026
const daysLeft = Calculations.calculateDaysRemaining(2026, 10, refDate);
assertEqual(daysLeft, 28, 'Days remaining in October from 4th = 28 days');

const dailyPace = Calculations.calculateDailyPace(availWithLeisure.availableVariable, daysLeft);
assertEqual(dailyPace, Math.floor(14300 / 28), 'Daily pace = €143 / 28 = €5.10 / day');

// Pace Status
const paceStatus = Calculations.calculatePaceStatus(sampleMonth, refDate);
assert(paceStatus.level === 'good' || paceStatus.level === 'warning', 'Pace status successfully calculated');
console.log(`    Pace status message: "${paceStatus.message}"`);

// ==========================================
// 3. Extraordinary & Emergency Expenses (Section 13)
// ==========================================
console.log('\n--- 3. Extraordinary & Emergency Classification ---');
sampleMonth.expenses.push({
  id: 'exp_emergency',
  amount: 5000, // €50.00
  type: 'emergency',
  category: 'Health',
  date: '2026-10-05',
  description: 'Doctor urgent prescription'
});

const avail2 = Calculations.calculateAvailable(sampleMonth);
assertEqual(avail2.emergencySpent, 5000, 'Emergency spending tracked separately');
assertEqual(avail2.availableVariable, 14300, 'Normal available variable budget is preserved for daily living pace');

// ==========================================
// 4. "What-If" Purchase Simulator (Section 18)
// ==========================================
console.log('\n--- 4. "What-If" Purchase Simulator (Zero-mutation) ---');
const expensesBeforeSim = JSON.stringify(sampleMonth.expenses);
const sim1 = Calculations.simulatePurchase(sampleMonth, 28000, 'Paris trip', refDate);

assertEqual(JSON.stringify(sampleMonth.expenses), expensesBeforeSim, 'Simulator NEVER modifies real expense data');
assert(sim1 !== null, 'Simulation returned non-null result');
assertEqual(sim1.conceptName, 'Paris trip', 'Preserved concept name');
assertEqual(sim1.before.availableVariable, 14300, 'Accurate before snapshot');
assertEqual(sim1.after.availableVariable, 14300 - 28000, 'Calculated hypothetical reduction');
console.log(`    Simulator interpretation: "${sim1.interpretation}"`);

// Smaller affordable simulation
const sim2 = Calculations.simulatePurchase(sampleMonth, 2000, 'Cinema ticket', refDate);
assertEqual(sim2.statusLevel, 'good', 'Cinema ticket is fully affordable');
assert(sim2.interpretation.includes('comfortably afford'), 'Helpful non-judgmental wording');

// ==========================================
// 5. Store / LocalStorage Engine Integration
// ==========================================
console.log('\n--- 5. Store Persistence & Lifecycle ---');
Store.resetAll();

// New user flow
const newMonth = Store.createMonth(2026, 10, {
  income: 99200,
  fixedExpenses: [{ name: 'Rent', amount: 40000, category: 'Housing' }],
  plannedExpenses: [{ name: 'Groceries / Mercado', amount: 10000, category: 'Food / Groceries' }],
  plannedSavings: 15000
});

assert(newMonth.id === '2026-10', 'Created month 2026-10');
assertEqual(Store.getActiveMonth().id, '2026-10', 'Active month is set to 2026-10');

// Add expense
const addedExp = Store.addExpense('2026-10', {
  amount: 850,
  category: 'Food / Groceries',
  store: 'REWE',
  type: 'normal',
  date: '2026-10-04',
  description: 'Sandwich'
});
assert(addedExp && addedExp.id, 'Expense successfully created with unique ID');
assertEqual(Store.getActiveMonth().expenses.length, 1, 'Expense array contains 1 item');

// Edit expense
Store.updateExpense('2026-10', addedExp.id, {
  amount: 950,
  store: 'Penny'
});
const updated = Store.getActiveMonth().expenses[0];
assertEqual(updated.amount, 950, 'Expense amount updated to 950 cents');
assertEqual(updated.store, 'Penny', 'Expense store updated to Penny');

// Store suggestions / Future price intelligence
const uniqueStores = Store.getUniqueStores();
assert(uniqueStores.includes('Penny'), 'Penny registered in unique stores list');

// Delete expense
Store.deleteExpense('2026-10', addedExp.id);
assertEqual(Store.getActiveMonth().expenses.length, 0, 'Expense successfully deleted');

// Copy previous month
const novMonth = Store.copyPreviousMonth(2026, 11);
assert(novMonth !== null, 'Copied previous month to 2026-11');
assertEqual(novMonth.income, 99200, 'Copied income accurately');
assertEqual(novMonth.fixedExpenses.length, 1, 'Copied fixed bills');
assertEqual(novMonth.expenses.length, 0, 'New month starts with 0 expenses');

// Verify old month 2026-10 is still accessible and intact
const octCheck = Store.getMonth('2026-10');
assert(octCheck !== null, 'Previous month 2026-10 remains accessible in history');
assertEqual(octCheck.income, 99200, 'Original month data was not mutated by copying');

// ==========================================
// 6. Edge Cases
// ==========================================
console.log('\n--- 6. Edge Cases (Section 31) ---');

// Edge case: €0 expenses
const zeroExp = Calculations.toCents(0);
assertEqual(zeroExp, 0, '€0 handled safely');

// Edge case: No income (income = 0)
const zeroIncomeMonth = {
  id: '2026-12',
  year: 2026,
  month: 12,
  income: 0,
  fixedExpenses: [{ amount: 10000 }],
  plannedExpenses: [],
  plannedSavings: 0,
  expenses: []
};
const zeroIncomeBudget = Calculations.calculateVariableBudget(zeroIncomeMonth);
assertEqual(zeroIncomeBudget, 0, 'Zero income results in €0 variable budget (no negative budget displayed)');

// Edge case: No planned savings
const noSavingsMonth = {
  id: '2027-01',
  year: 2027,
  month: 1,
  income: 50000,
  fixedExpenses: [{ amount: 20000 }],
  plannedExpenses: [{ amount: 10000 }],
  plannedSavings: 0,
  expenses: []
};
const noSavingsBudget = Calculations.calculateVariableBudget(noSavingsMonth);
assertEqual(noSavingsBudget, 20000, 'No planned savings cleanly yields remaining as variable budget');

// Edge case: Very large expense
const largeSim = Calculations.simulatePurchase(noSavingsMonth, 1000000, 'Luxury Yacht', refDate);
assertEqual(largeSim.statusLevel, 'danger', 'Huge purchase marked as danger');

// Summary
console.log('\n==========================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('==========================================');

if (failed > 0) {
  process.exit(1);
}
