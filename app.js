const EXCHANGE_RATE = 90000;
const activitiesOnly = Boolean(window.KERMESS_ACTIVITIES_ONLY) || /\/games(?:\/index\.html)?\/?$/.test(window.location.pathname);
const LEGACY_DONATION_ID = 102;

const products = [
  { id: 1, name: "Kaak Plain", price: 150000, category: "Food", icon: "🫓" },
  { id: 2, name: "Kaak Picon", price: 250000, category: "Food", icon: "🧀" },
  { id: 3, name: "Kaak Jebne", price: 350000, category: "Food", icon: "🧀" },
  { id: 4, name: "Kaak Jebne & Jambon", price: 450000, category: "Food", icon: "🥪" },
  { id: 5, name: "Kaak Nutella", price: 350000, category: "Food", icon: "🍫" },
  { id: 6, name: "+ Add Banana", price: 50000, category: "Food", icon: "🍌" },
  { id: 7, name: "Bonjus", price: 50000, category: "Drinks", icon: "🧃" },
  { id: 8, name: "Water 0.5L", price: 50000, category: "Drinks", icon: "💧" },
  { id: 9, name: "Lipton Tea", price: 100000, category: "Drinks", icon: "🍵" },
  { id: 10, name: "Lipton Green Tea", price: 100000, category: "Drinks", icon: "🍵" },
  { id: 11, name: "Nescafé 3 in 1", price: 100000, category: "Drinks", icon: "☕" },
  { id: 12, name: "Nescafé 2 in 1", price: 100000, category: "Drinks", icon: "☕" },
  { id: 13, name: "Black Coffee", price: 100000, category: "Drinks", icon: "☕" },
  { id: 14, name: "Cappuccino", price: 100000, category: "Drinks", icon: "☕" },
  { id: 15, name: "Hot Chocolate", price: 100000, category: "Drinks", icon: "🍫" },
  { id: 101, name: "Cakes Fersen", price: 30000, category: "Sweets", icon: "🍰" }
];

// [Kermess sale price, provider/person price, provider, contact]
const foodFinancials = {
  1: [150000, 65000, "Kaak menu cost", ""],
  2: [250000, 105500, "Kaak menu cost", ""],
  3: [350000, 130500, "Kaak menu cost", ""],
  4: [450000, 190500, "Kaak menu cost", ""],
  5: [350000, 134200, "Kaak menu cost", ""],
  6: [50000, 16500, "Kaak menu cost", ""],
  7: [50000, 15000, "Kaak menu cost", ""],
  8: [50000, 18300, "Kaak menu cost", ""],
  9: [100000, 8700, "Kaak menu cost", ""],
  10: [100000, 11900, "Kaak menu cost", ""],
  11: [100000, 23800, "Kaak menu cost", ""],
  12: [100000, 29700, "Kaak menu cost", ""],
  13: [100000, 20300, "Kaak menu cost", ""],
  14: [100000, 29600, "Kaak menu cost", ""],
  15: [100000, 34600, "Kaak menu cost", ""],
  101: [30000, 0, "Fersen", ""]
};

products.forEach(product => {
  const financials = foodFinancials[product.id];
  if (!financials) { product.cost = null; return; }
  product.price = financials[0];
  product.cost = financials[1];
  product.provider = financials[2] || "—";
  product.contact = financials[3] || "";
});

const accents = { Food: "#f7dfcb", Sweets: "#f2dce5", Drinks: "#dcecf2", Snacks: "#eee4ca", Activities: "#dce9df" };
const categories = activitiesOnly ? [] : ["All", "Food", "Sweets", "Drinks"];
let activeCategory = activitiesOnly ? "Activities" : "All";
let cart = {};
let completedCart = null;
const ORDER_RESET_VERSION = "2026-09-13-001";
const REMOVED_TEST_SALE_IDS = new Set(["e07db550-1e04-40cc-a6ab-2d90d7bd3284"]);
let sales = JSON.parse(localStorage.getItem("kermessSales") || "[]");
if (localStorage.getItem("kermessOrderResetVersion") !== ORDER_RESET_VERSION) {
  sales = sales.filter(sale => !REMOVED_TEST_SALE_IDS.has(sale.id));
  localStorage.setItem("kermessSales", JSON.stringify(sales));
  localStorage.setItem("kermessOrderNumber", "1");
  localStorage.setItem("kermessOrderResetVersion", ORDER_RESET_VERSION);
}
let orderNumber = Number(localStorage.getItem("kermessOrderNumber")) || 1;
let currentSaleRecorded = false;
let currentSaleId = null;
let lastReportSales = sales;
let lastReportDonations = [];
let reportSource = sales;
let reportDonations = [];
let invoiceData = [];
let editingSale = null;
let syncInProgress = null;
let reportSort = { key: "name", direction: "asc" };
const cloud = window.KERMESS_CONFIG || {};
const cloudEnabled = Boolean(cloud.supabaseUrl && cloud.supabaseAnonKey);
const makeId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const terminalId = localStorage.getItem("kermessTerminalId") || makeId();
localStorage.setItem("kermessTerminalId", terminalId);

const EVENT_TIME_ZONE = "Asia/Beirut";
const EXTRA_ACCESSIBLE_SALES_DAYS = ["2026-11-26"];
function eventDayFromDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function formatEventDay(day) {
  if (!day) return "Unknown day";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}
function accessibleSalesDays() {
  return [...new Set([eventDayFromDate(), ...EXTRA_ACCESSIBLE_SALES_DAYS])];
}
function isAccessibleSalesDay(day) {
  return accessibleSalesDays().includes(day);
}
let selectedSalesDay = eventDayFromDate();
localStorage.setItem("kermessSalesDay", selectedSalesDay);

// Upgrade sales created by earlier versions so they can safely synchronize once.
sales = sales.map(sale => ({ ...sale, id: sale.id || makeId(), eventDay: sale.eventDay || eventDayFromDate(sale.completedAt), deletedAt: sale.deletedAt || null, synced: sale.synced === true }));
let donations = JSON.parse(localStorage.getItem("kermessDonations") || "[]");
const knownDonationIds = new Set(donations.map(donation => donation.id));
sales = sales.filter(sale => {
  const donation = readLegacyDonation(sale);
  if (!donation) return true;
  if (!knownDonationIds.has(donation.id)) {
    donations.push(donation);
    knownDonationIds.add(donation.id);
  }
  // Keep the original lines of mixed historical invoices for any future invoice edit.
  return !sale.items.some(item => item.kind === "donation") && sale.items.some(item => Number(item.id) !== LEGACY_DONATION_ID);
});
localStorage.setItem("kermessDonations", JSON.stringify(donations));
localStorage.setItem("kermessSales", JSON.stringify(sales));

const $ = (selector) => document.querySelector(selector);
const formatLbp = (amount) => `${new Intl.NumberFormat("en-US").format(amount)} LBP`;
const formatUsd = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / EXCHANGE_RATE);
const usdCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatReceived = (amount, currency) => currency === "USD" ? usdCurrency.format(amount) : formatLbp(amount);

function readLegacyDonation(record) {
  const { id, eventDay, completedAt, deletedAt } = record;
  const terminal = record.terminalId || terminalId;
  const entry = record.items.find(item => item.kind === "donation");
  if (entry) {
    if (!Number.isSafeInteger(entry.amountLbp) || entry.amountLbp <= 0 || !Number.isFinite(entry.enteredAmount)) return null;
    return {
      id, eventDay, completedAt, deletedAt, terminalId: terminal, synced: false,
      localNumber: record.localOrderNumber || record.orderNumber || 0,
      number: entry.number, enteredAmount: entry.enteredAmount,
      enteredCurrency: entry.enteredCurrency, amountLbp: entry.amountLbp
    };
  }

  const amountLbp = record.items
    .filter(item => Number(item.id) === LEGACY_DONATION_ID)
    .reduce((sum, item) => sum + item.quantity * item.price, 0);
  if (!amountLbp) return null;
  const number = `D-OLD-${record.id.slice(0, 8).toUpperCase()}`;
  return {
    id, eventDay, completedAt, deletedAt, terminalId: terminal, localNumber: 0, synced: false,
    number, enteredAmount: amountLbp, enteredCurrency: "LBP", amountLbp
  };
}

function populateDayFilter(selector, source, preferred = selectedSalesDay) {
  const select = $(selector);
  const allowedDays = accessibleSalesDays();
  select.innerHTML = allowedDays.map(day => `<option value="${day}">${formatEventDay(day)}</option>`).join("");
  select.value = allowedDays.includes(preferred) ? preferred : eventDayFromDate();
}

function closeDayWarning() { $("#dayWarningModal").hidden = true; }

function showDayWarning() {
  $("#dayWarningText").innerHTML = `Invoices will be saved under <strong>${formatEventDay(selectedSalesDay)}</strong>, but today is <strong>${formatEventDay(eventDayFromDate())}</strong>. Please confirm which day you want to use.`;
  $("#dayWarningModal").hidden = false;
  setTimeout(() => $("#keepSelectedDayButton").focus(), 50);
}

function updateSalesDayControl(showWarning = false) {
  const input = $("#salesDay");
  selectedSalesDay = eventDayFromDate();
  localStorage.setItem("kermessSalesDay", selectedSalesDay);
  input.value = selectedSalesDay;
  input.disabled = true;
  input.title = `Orders are saved under ${formatEventDay(selectedSalesDay)}.`;
}

function renderTabs() {
  $("#categoryTabs").innerHTML = categories.map(category =>
    `<button class="category-button ${category === activeCategory ? "active" : ""}" data-category="${category}" type="button">${category}</button>`
  ).join("");
}

function filteredProducts() {
  const term = $("#searchInput").value.trim().toLowerCase();
  return products.filter(item => {
    const belongsToPage = activitiesOnly ? item.category === "Activities" : item.category !== "Activities";
    return item.active !== false && belongsToPage && (activeCategory === "All" || item.category === activeCategory) && item.name.toLowerCase().includes(term);
  });
}

function renderProducts() {
  const visible = filteredProducts();
  $("#resultCount").textContent = `${visible.length} ${visible.length === 1 ? "item" : "items"}`;
  $("#emptyProducts").hidden = visible.length !== 0;
  $("#productGrid").innerHTML = visible.map(item => `
    <button class="product-card" data-id="${item.id}" style="--card-accent:${accents[item.category]}" type="button" aria-label="Add ${item.name}">
      <span class="product-icon">${item.icon}</span>
      <h3>${item.name}</h3>
      <span class="product-price">${formatLbp(item.price)}</span>
      <span class="add-badge">+</span>
      ${cart[item.id] ? `<span class="product-quantity">${cart[item.id]}</span>` : ""}
    </button>
  `).join("");
}

function cartDetails(source = cart) {
  return products.filter(item => source[item.id]).map(item => ({ ...item, quantity: source[item.id] }));
}

function productBelongsToPage(productId) {
  const product = products.find(candidate => candidate.id === Number(productId));
  return Boolean(product && (activitiesOnly ? product.category === "Activities" : product.category !== "Activities"));
}

function renderCart() {
  const items = cartDetails();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  $("#orderNumber").textContent = editingSale ? `· Editing #${String(editingSale.displayNumber).padStart(3, "0")}` : `#${String(orderNumber).padStart(3, "0")}`;
  $("#emptyCart").hidden = items.length > 0;
  $("#cartItems").hidden = items.length === 0;
  $("#clearOrder").disabled = items.length === 0 && !editingSale;
  $("#clearOrder").textContent = editingSale ? "Cancel edit" : "Clear";
  $("#completeSale").disabled = items.length === 0;
  $("#itemCount").textContent = itemCount;
  $("#totalLbp").textContent = formatLbp(total);
  $("#totalUsd").textContent = formatUsd(total);
  $("#cartItems").innerHTML = items.map(item => `
    <article class="cart-row">
      <div class="cart-info">
        <h3>${item.name}</h3>
        <p>${formatLbp(item.price)} each</p>
      </div>
      <div class="cart-right">
        <div class="quantity-control">
          <button data-action="decrease" data-id="${item.id}" aria-label="Remove one ${item.name}">−</button>
          <span>${item.quantity}</span>
          <button data-action="increase" data-id="${item.id}" aria-label="Add one ${item.name}">+</button>
        </div>
        <span class="line-total">${new Intl.NumberFormat("en-US").format(item.price * item.quantity)}</span>
      </div>
    </article>
  `).join("");
  renderProducts();
}

function changeQuantity(id, amount) {
  currentSaleRecorded = false;
  cart[id] = (cart[id] || 0) + amount;
  if (cart[id] <= 0) delete cart[id];
  renderCart();
}

function openDonation() {
  const form = $("#donationForm");
  form.reset();
  $("#donationStatus").textContent = "";
  updateDonationAmount();
  $("#donationDialog").showModal();
}

function updateDonationAmount() {
  const input = $("#donationAmount");
  formatCashInput(input);
  const amount = readCashAmount(input.value);
  const valid = amount && amount.tenderedLbp > 0;
  $("#donationCurrency").textContent = valid ? amount.enteredCurrency : "—";
  $("#donationValue").textContent = valid && amount.enteredCurrency === "USD" ? formatLbp(amount.tenderedLbp) : "";
  $("#saveDonation").disabled = !valid;
  $("#donationStatus").textContent = "";
}

function recordDonation(event) {
  event.preventDefault();
  const amount = readCashAmount($("#donationAmount").value);
  if (!amount || amount.tenderedLbp <= 0) return;

  const localNumber = donations.reduce((highest, record) => {
    return record.terminalId === terminalId ? Math.max(highest, record.localNumber) : highest;
  }, 0) + 1;
  const number = `D-${terminalId.slice(0, 8).toUpperCase()}-${String(localNumber).padStart(3, "0")}`;
  const completedAt = new Date().toISOString();
  const record = {
    id: makeId(), terminalId, localNumber, number,
    eventDay: eventDayFromDate(completedAt), completedAt, deletedAt: null, synced: false,
    enteredAmount: amount.enteredAmount, enteredCurrency: amount.enteredCurrency,
    amountLbp: amount.tenderedLbp
  };
  const updatedDonations = [...donations, record];
  try {
    localStorage.setItem("kermessDonations", JSON.stringify(updatedDonations));
  } catch (error) {
    console.warn(error);
    $("#donationStatus").textContent = "Donation could not be saved. Please try again.";
    return;
  }
  donations = updatedDonations;
  $("#donationForm").reset();
  updateDonationAmount();
  $("#donationStatus").textContent = `Donation #${number} recorded · ${formatReceived(record.enteredAmount, record.enteredCurrency)}`;
  $("#donationAmount").focus();
  syncPendingSales();
}

function showCompletedSale() {
  const items = cartDetails();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  completedCart = { items, count, total, orderNumber: editingSale?.displayNumber || orderNumber };
  $("#saleTitle").textContent = editingSale ? "Confirm invoice changes" : "Enter customer payment";
  $("#newOrder").textContent = editingSale ? "Save changes" : "Confirm sale & new order";
  const saleDay = editingSale?.eventDay || selectedSalesDay;
  $("#modalSummary").innerHTML = `${editingSale ? "Updating" : "Order"} #${String(completedCart.orderNumber).padStart(3, "0")} · ${count} ${count === 1 ? "item" : "items"}<br>${formatEventDay(saleDay)}<br><strong>${formatLbp(total)} · ${formatUsd(total)}</strong>`;
  $("#paymentAmount").value = "";
  $("#detectedCurrency").textContent = "—";
  $("#changeResult").hidden = true;
  $("#newOrder").disabled = true;
  $("#saleModal").hidden = false;
  setTimeout(() => $("#paymentAmount").focus(), 50);
}

function closeSale() { $("#saleModal").hidden = true; }

function startNewOrder() {
  if (!completedCart) return;
  const payment = calculateChange();
  if (!payment || payment.changeLbp < 0) return;
  if (!currentSaleRecorded) {
    currentSaleId ||= makeId();
    const hiddenItems = editingSale ? editingSale.originalItems.filter(item => !productBelongsToPage(item.id)) : [];
    const updatedItems = [...hiddenItems, ...completedCart.items.map(({ id, quantity, price }) => ({ id, quantity, price }))];
    sales = sales.filter(sale => sale.id !== currentSaleId);
    sales.push({ id: currentSaleId, orderNumber: editingSale?.localOrderNumber || orderNumber, terminalId: editingSale?.terminalId || terminalId, eventDay: editingSale?.eventDay || selectedSalesDay, deletedAt: null, synced: false, completedAt: editingSale?.completedAt || new Date().toISOString(), payment, items: updatedItems });
    localStorage.setItem("kermessSales", JSON.stringify(sales));
    currentSaleRecorded = true;
    syncPendingSales();
  }
  cart = {};
  if (!editingSale) {
    orderNumber += 1;
    localStorage.setItem("kermessOrderNumber", orderNumber);
  }
  editingSale = null;
  currentSaleRecorded = false;
  currentSaleId = null;
  completedCart = null;
  closeSale();
  renderCart();
}

function readCashAmount(value) {
  const raw = value.replace(/[,\s]/g, "");
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) return null;
  const amount = Number(raw);
  const currency = amount < 1000 ? "USD" : "LBP";
  const tenderedLbp = Math.round(currency === "USD" ? amount * EXCHANGE_RATE : amount);
  if (!Number.isSafeInteger(tenderedLbp)) return null;
  return { enteredAmount: amount, enteredCurrency: currency, tenderedLbp };
}

function calculateChange() {
  const payment = readCashAmount($("#paymentAmount").value);
  if (!payment || !completedCart) {
    $("#detectedCurrency").textContent = "—";
    $("#changeResult").hidden = true;
    $("#newOrder").disabled = true;
    return null;
  }
  const changeLbp = payment.tenderedLbp - completedCart.total;
  const enough = changeLbp >= 0;
  $("#detectedCurrency").textContent = payment.enteredCurrency;
  $("#changeResult").hidden = false;
  $("#changeResult").classList.toggle("insufficient", !enough);
  $("#changeLabel").textContent = enough ? "Change to return" : "Amount still due";
  $("#changeLbp").textContent = formatLbp(Math.abs(changeLbp));
  $("#changeUsd").textContent = formatUsd(Math.abs(changeLbp));
  $("#newOrder").disabled = !enough;
  return { ...payment, changeLbp };
}

function formatCashInput(input) {
  const raw = input.value.replace(/[,\s]/g, "");
  if (!/^\d*(?:\.\d{0,2})?$/.test(raw)) return;
  const [whole, decimal] = raw.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  input.value = decimal === undefined ? grouped : `${grouped}.${decimal}`;
}

function formatPaymentAmount() {
  formatCashInput($("#paymentAmount"));
  calculateChange();
}

function reportData(source = sales) {
  const totals = {};
  source.forEach(sale => sale.items.forEach(item => {
    totals[item.id] ||= { quantity: 0, revenue: 0 };
    totals[item.id].quantity += item.quantity;
    totals[item.id].revenue += item.price * item.quantity;
  }));
  return products.filter(item => totals[item.id]).map(item => {
    const { quantity, revenue } = totals[item.id];
    const payment = item.cost == null ? null : item.cost * quantity;
    return { ...item, quantity, revenue, payment, profitPerItem: item.cost == null ? null : item.price - item.cost, profit: payment == null ? null : revenue - payment };
  });
}

function sortReportRows(rows) {
  const { key, direction } = reportSort;
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left == null && right == null) return a.name.localeCompare(b.name);
    if (left == null) return 1;
    if (right == null) return -1;
    const comparison = typeof left === "string" ? left.localeCompare(right, undefined, { sensitivity: "base" }) : left - right;
    return comparison === 0 ? a.name.localeCompare(b.name) : comparison * factor;
  });
}

function renderReport() {
  const day = $("#reportDayFilter").value || eventDayFromDate();
  const activeRecords = reportSource.filter(record => !record.deletedAt && record.eventDay === day);
  const relevantSales = activeRecords
    .map(sale => ({ ...sale, items: sale.items.filter(item => productBelongsToPage(item.id)) }))
    .filter(sale => sale.items.length);
  lastReportSales = relevantSales;
  lastReportDonations = reportDonations.filter(donation => !donation.deletedAt && donation.eventDay === day)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const donationTotal = lastReportDonations.reduce((sum, donation) => sum + donation.amountLbp, 0);
  const rows = sortReportRows(reportData(relevantSales));
  const sold = rows.reduce((sum, row) => sum + row.quantity, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const payment = rows.reduce((sum, row) => sum + (row.payment || 0), 0);
  const profit = rows.reduce((sum, row) => sum + (row.profit || 0), 0);
  const pending = rows.some(row => row.payment == null);
  $("#reportTimestamp").textContent = `${day === "all" ? "All event days" : formatEventDay(day)} · ${relevantSales.length} completed orders · Updated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  const totalProfit = profit + donationTotal;
  const cashierTotal = revenue + donationTotal;
  $("#reportStats").innerHTML = `<div class="stat-card"><span>Items sold</span><strong>${sold}</strong></div><div class="stat-card"><span>Pay providers</span><strong>${formatLbp(payment)}${pending ? "*" : ""}</strong></div><div class="stat-card profit"><span>Total profit</span><strong>${formatLbp(totalProfit)}${pending ? "*" : ""}</strong></div><div class="stat-card cashier"><span>Cashier total</span><strong>${formatLbp(cashierTotal)}</strong><small>${formatUsd(cashierTotal)}</small></div>`;
  $("#emptyReport").hidden = Boolean(rows.length || lastReportDonations.length);
  if ($("#reportSalesTable")) $("#reportSalesTable").hidden = !rows.length;
  $("#reportRows").innerHTML = rows.map(row => `<tr><td>${row.name}</td><td title="${row.contact || ""}">${row.provider || "Pending"}</td><td>${row.quantity}</td><td>${formatLbp(row.price)}</td><td>${row.cost == null ? '<span class="pending-value">Pending</span>' : formatLbp(row.cost)}</td><td>${row.cost == null ? '<span class="pending-value">Pending</span>' : formatLbp(row.price - row.cost)}</td><td>${row.payment == null ? '<span class="pending-value">Pending</span>' : formatLbp(row.payment)}</td><td>${row.profit == null ? '<span class="pending-value">Pending</span>' : formatLbp(row.profit)}</td></tr>`).join("");
  $("#reportTotals").innerHTML = rows.length ? `<tr><td colspan="2">SALES TOTAL</td><td>${sold}</td><td>—</td><td>—</td><td>—</td><td>${formatLbp(payment)}${pending ? "*" : ""}</td><td>${formatLbp(profit)}${pending ? "*" : ""}</td></tr>` : "";
  if ($("#reportDonations")) renderDonationReport(donationTotal);
  document.querySelectorAll(".sort-button").forEach(button => {
    const active = button.dataset.sort === reportSort.key;
    button.classList.toggle("active", active);
    button.dataset.direction = active ? (reportSort.direction === "asc" ? "▲" : "▼") : "";
    button.setAttribute("aria-sort", active ? (reportSort.direction === "asc" ? "ascending" : "descending") : "none");
  });
}

function renderDonationReport(total) {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TIME_ZONE, timeStyle: "short" });
  const rows = lastReportDonations.map(donation => {
    const row = document.createElement("tr");
    const cells = [
      `#${donation.number}`, time.format(new Date(donation.completedAt)),
      formatReceived(donation.enteredAmount, donation.enteredCurrency), formatLbp(donation.amountLbp)
    ];
    cells.forEach(value => {
      const cell = row.insertCell();
      cell.textContent = value;
    });
    return row;
  });
  $("#reportDonationRows").replaceChildren(...rows);
  $("#reportDonationTotal").textContent = formatLbp(total);
  $("#reportDonationTable").hidden = !rows.length;
  $("#emptyDonations").hidden = Boolean(rows.length);
}

async function openReport() {
  $("#reportModal").hidden = false;
  $("#reportSyncStatus").textContent = cloudEnabled ? "Loading combined report…" : "Local device report";
  reportSource = sales.filter(sale => isAccessibleSalesDay(sale.eventDay));
  reportDonations = activitiesOnly ? [] : donations.filter(donation => isAccessibleSalesDay(donation.eventDay));
  populateDayFilter("#reportDayFilter", reportSource, selectedSalesDay);
  renderReport();
  [reportSource, reportDonations] = await Promise.all([
    loadCombinedSales(),
    activitiesOnly ? [] : loadCombinedDonations()
  ]);
  populateDayFilter("#reportDayFilter", reportSource, $("#reportDayFilter").value);
  renderReport();
  if ($("#reportSyncStatus").textContent !== "Donations shown from this device") {
    $("#reportSyncStatus").textContent = $("#syncStatus").textContent;
  }
}
function closeReport() { $("#reportModal").hidden = true; }

function exportReport() {
  const heading = ["Sales day", "Item", "Provider", "Contact", "Items sold", "Sale price LBP", "Provider per item LBP", "Profit per item LBP", "Total to provider LBP", "Total profit LBP"];
  const selectedDay = $("#reportDayFilter").value || eventDayFromDate();
  const body = sortReportRows(reportData(lastReportSales)).map(row => [selectedDay === "all" ? "All event days" : selectedDay, row.name, row.provider || "Pending", row.contact || "", row.quantity, row.price, row.cost ?? "Pending", row.cost == null ? "Pending" : row.price - row.cost, row.payment ?? "Pending", row.profit ?? "Pending"]);
  if (!activitiesOnly) {
    heading.push("Record type", "Donation number", "Amount received", "Currency");
    body.forEach(row => row.push("Sale", "", "", ""));
    lastReportDonations.forEach(donation => {
      body.push([selectedDay, "", "", "", "", "", "", "", "", donation.amountLbp, "Donation", donation.number, donation.enteredAmount, donation.enteredCurrency]);
    });
  }
  const csv = [heading, ...body].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `kermess-sales-${selectedDay === "all" ? "all-days" : selectedDay}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderInvoices() {
  const term = $("#invoiceSearch").value.trim().toLowerCase();
  const day = $("#invoiceDayFilter").value || eventDayFromDate();
  const status = $("#invoiceStatusFilter").value;
  const visible = invoiceData.filter(sale => {
    const pageItems = sale.items.filter(item => productBelongsToPage(item.id));
    const names = pageItems.map(item => products.find(product => product.id === Number(item.id))?.name || "").join(" ");
    const hasRequestedStatus = status === "deleted" ? Boolean(sale.deletedAt) : !sale.deletedAt;
    return hasRequestedStatus && sale.eventDay === day && pageItems.length && `${sale.orderNumber} ${sale.localOrderNumber || ""} ${names}`.toLowerCase().includes(term);
  }).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  $("#emptyInvoices").hidden = visible.length !== 0;
  $("#invoiceList").innerHTML = visible.map(sale => {
    const pageItems = sale.items.filter(item => productBelongsToPage(item.id));
    const count = pageItems.reduce((sum, item) => sum + item.quantity, 0);
    const total = pageItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemText = pageItems.map(item => `${item.quantity} × ${products.find(product => product.id === Number(item.id))?.name || `Item ${item.id}`}`).join(" · ");
    const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.completedAt));
    const buttons = sale.deletedAt
      ? `<button class="restore-invoice-button" data-restore-invoice="${sale.id}" type="button">Restore</button>`
      : `<button class="edit-invoice-button" data-edit-invoice="${sale.id}" type="button">Edit</button><button class="delete-invoice-button" data-delete-invoice="${sale.id}" type="button">Delete</button>`;
    const deletedText = sale.deletedAt ? `<br>Deleted ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.deletedAt))}` : "";
    return `<article class="invoice-entry ${sale.deletedAt ? "deleted" : ""}"><div class="invoice-reference"><strong>Order #${String(sale.orderNumber).padStart(3, "0")}</strong><span>${formatEventDay(sale.eventDay)}<br>${date}${deletedText}</span></div><div class="invoice-items"><p>${itemText}</p><small>${count} ${count === 1 ? "item" : "items"}</small></div><div class="invoice-actions"><strong>${formatLbp(total)}</strong><div class="invoice-action-buttons">${buttons}</div></div></article>`;
  }).join("");
  $("#invoicesStatus").textContent = `${visible.length} ${status === "deleted" ? "deleted" : "current"} ${visible.length === 1 ? "invoice" : "invoices"} · ${day === "all" ? "All event days" : formatEventDay(day)}`;
}

async function openInvoices() {
  $("#invoicesModal").hidden = false;
  $("#invoiceSearch").value = "";
  $("#invoiceStatusFilter").value = "current";
  $("#invoicesStatus").textContent = cloudEnabled ? "Loading accessible invoices from all devices…" : "Showing accessible invoices saved on this device";
  invoiceData = await loadCombinedSales();
  populateDayFilter("#invoiceDayFilter", invoiceData, selectedSalesDay);
  renderInvoices();
}

function closeInvoices() { $("#invoicesModal").hidden = true; }

function editInvoice(saleId) {
  const sale = invoiceData.find(candidate => candidate.id === saleId);
  if (!sale || sale.deletedAt) return;
  cart = {};
  sale.items.filter(item => productBelongsToPage(item.id)).forEach(item => { cart[item.id] = item.quantity; });
  editingSale = { id: sale.id, displayNumber: sale.orderNumber, localOrderNumber: sale.localOrderNumber || sale.orderNumber, terminalId: sale.terminalId, eventDay: sale.eventDay, completedAt: sale.completedAt, originalItems: sale.items };
  currentSaleId = sale.id;
  currentSaleRecorded = false;
  completedCart = null;
  closeInvoices();
  renderCart();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveInvoiceStatus(saleId, deletedAt) {
  const sale = invoiceData.find(candidate => candidate.id === saleId);
  if (!sale) return;
  const updatedSale = { ...sale, deletedAt, synced: false };
  invoiceData = invoiceData.map(candidate => candidate.id === saleId ? updatedSale : candidate);
  sales = [...sales.filter(candidate => candidate.id !== saleId), updatedSale];
  localStorage.setItem("kermessSales", JSON.stringify(sales));
  renderInvoices();
  syncPendingSales();
}

function deleteInvoice(saleId) {
  const sale = invoiceData.find(candidate => candidate.id === saleId);
  if (!sale || sale.deletedAt) return;
  if (!window.confirm(`Delete invoice #${String(sale.orderNumber).padStart(3, "0")}? It will be removed from all totals but kept in Deleted invoices.`)) return;
  saveInvoiceStatus(saleId, new Date().toISOString());
}

function restoreInvoice(saleId) {
  const sale = invoiceData.find(candidate => candidate.id === saleId);
  if (!sale || !sale.deletedAt) return;
  if (!window.confirm(`Restore invoice #${String(sale.orderNumber).padStart(3, "0")}? It will be included in totals again.`)) return;
  saveInvoiceStatus(saleId, null);
}

function clearOrCancelOrder() {
  cart = {};
  currentSaleRecorded = false;
  currentSaleId = null;
  editingSale = null;
  completedCart = null;
  renderCart();
}

function setSyncStatus(state, text) {
  $("#syncDot").className = `status-dot ${state}`.trim();
  $("#syncStatus").textContent = text;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${cloud.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: cloud.supabaseAnonKey, Authorization: `Bearer ${cloud.supabaseAnonKey}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Cloud request failed (${response.status})`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function syncPendingSales() {
  if (!cloudEnabled) { setSyncStatus("offline", "Cloud not configured"); return; }
  if (!navigator.onLine) { setSyncStatus("offline", "Offline · records queued"); return; }
  if (syncInProgress) return syncInProgress;
  const pendingSales = sales.filter(sale => !sale.synced && isAccessibleSalesDay(sale.eventDay));
  const pendingDonations = donations.filter(donation => !donation.synced && !donation.deletedAt);
  const count = pendingSales.length + pendingDonations.length;
  if (!count) { setSyncStatus("", "All records synced"); return; }
  setSyncStatus("syncing", `Syncing ${count} record${count === 1 ? "" : "s"}…`);
  syncInProgress = Promise.allSettled([uploadSales(pendingSales), uploadDonations(pendingDonations)])
    .then(results => {
      const failed = results.filter(result => result.status === "rejected");
      failed.forEach(result => console.warn(result.reason));
      const stillPending = sales.some(sale => !sale.synced && isAccessibleSalesDay(sale.eventDay)) ||
        donations.some(donation => !donation.synced && !donation.deletedAt);
      if (failed.length || stillPending) setSyncStatus("offline", "Saved locally · sync pending");
      else setSyncStatus("", "All records synced");
    })
    .finally(() => { syncInProgress = null; });
  return syncInProgress;
}

async function uploadSales(pending) {
  if (!pending.length) return;
  const payload = pending.map(sale => ({ id: sale.id, terminal_id: sale.terminalId || terminalId, local_order_number: sale.localOrderNumber || sale.orderNumber, event_day: sale.eventDay, completed_at: sale.completedAt, items: sale.items, deleted_at: sale.deletedAt || null }));
  await supabaseRequest("sales_orders?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(payload) });
  const sent = new Set(pending);
  sales = sales.map(sale => sent.has(sale) ? { ...sale, synced: true } : sale);
  localStorage.setItem("kermessSales", JSON.stringify(sales));
}

async function uploadDonations(pending) {
  if (!pending.length) return;
  const payload = pending.map(donation => ({
    id: donation.id, donation_number: donation.number, terminal_id: donation.terminalId,
    local_number: donation.localNumber, event_day: donation.eventDay, received_at: donation.completedAt,
    amount_received: donation.enteredAmount, currency: donation.enteredCurrency, amount_lbp: donation.amountLbp
  }));
  await supabaseRequest("donations?on_conflict=id", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(payload)
  });
  const sent = new Set(pending);
  donations = donations.map(donation => sent.has(donation) ? { ...donation, synced: true } : donation);
  localStorage.setItem("kermessDonations", JSON.stringify(donations));
}

async function loadCombinedDonations() {
  const allowedDays = accessibleSalesDays();
  const isAllowed = donation => allowedDays.includes(donation.eventDay);
  const local = () => donations.filter(isAllowed);
  if (!cloudEnabled || !navigator.onLine) return local();
  await syncPendingSales();
  try {
    const combined = new Map();
    const pageSize = 1000;
    const columns = "id,donation_number,terminal_id,local_number,event_day,received_at,amount_received,currency,amount_lbp,deleted_at";
    for (let offset = 0; ; offset += pageSize) {
      const dayFilter = encodeURIComponent(`(${allowedDays.join(",")})`);
      const page = await supabaseRequest(`donations?select=${columns}&event_day=in.${dayFilter}&order=received_at.asc,id.asc&limit=${pageSize}&offset=${offset}`);
      page.forEach(row => combined.set(row.id, {
        id: row.id, number: row.donation_number, terminalId: row.terminal_id, localNumber: row.local_number,
        eventDay: row.event_day, completedAt: row.received_at, enteredAmount: Number(row.amount_received),
        enteredCurrency: row.currency, amountLbp: Number(row.amount_lbp), deletedAt: row.deleted_at, synced: true
      }));
      if (page.length < pageSize) break;
    }
    const refreshed = donations.map(donation => combined.get(donation.id) || donation);
    localStorage.setItem("kermessDonations", JSON.stringify(refreshed));
    donations = refreshed;
    local().forEach(donation => {
      if (!donation.synced && !combined.has(donation.id)) combined.set(donation.id, donation);
    });
    return [...combined.values()];
  } catch (error) {
    console.warn(error);
    $("#reportSyncStatus").textContent = "Donations shown from this device";
    return local();
  }
}

async function loadCombinedSales() {
  const allowedDays = accessibleSalesDays();
  const isAllowed = sale => allowedDays.includes(sale.eventDay);
  if (!cloudEnabled || !navigator.onLine) return sales.filter(isAllowed);
  await syncPendingSales();
  try {
    const remote = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const dayFilter = encodeURIComponent(`(${allowedDays.join(",")})`);
      const page = await supabaseRequest(`sales_orders?select=id,order_number,local_order_number,terminal_id,event_day,completed_at,items,deleted_at&event_day=in.${dayFilter}&order=completed_at.asc&limit=${pageSize}&offset=${offset}`);
      remote.push(...page);
      if (page.length < pageSize) break;
    }
    const serverSales = remote.map(row => ({ id: row.id, orderNumber: row.order_number, localOrderNumber: row.local_order_number, terminalId: row.terminal_id, eventDay: row.event_day || eventDayFromDate(row.completed_at), completedAt: row.completed_at, items: row.items, deletedAt: row.deleted_at || null, synced: true }));
    const combined = new Map(serverSales.filter(isAllowed).map(sale => [sale.id, sale]));
    sales.filter(isAllowed).forEach(sale => {
      if (!sale.synced) combined.set(sale.id, sale);
    });
    return [...combined.values()];
  } catch (error) {
    console.warn(error);
    return sales.filter(isAllowed);
  }
}

function updateConnectionStatus() {
  if (!cloudEnabled) setSyncStatus("offline", "Cloud not configured");
  else if (!navigator.onLine) setSyncStatus("offline", "Offline · records queued");
  else syncPendingSales();
}


$("#categoryTabs").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderTabs();
  renderProducts();
});
$("#productGrid").addEventListener("click", event => {
  const card = event.target.closest("[data-id]");
  if (card) changeQuantity(card.dataset.id, 1);
});
$("#cartItems").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (button) changeQuantity(button.dataset.id, button.dataset.action === "increase" ? 1 : -1);
});
if ($("#donationDialog")) {
  $("#openDonation").addEventListener("click", openDonation);
  $("#checkoutDonation").addEventListener("click", openDonation);
  $("#closeDonation").addEventListener("click", () => $("#donationDialog").close());
  $("#donationAmount").addEventListener("input", updateDonationAmount);
  $("#donationForm").addEventListener("submit", recordDonation);
}
$("#searchInput").addEventListener("input", renderProducts);
$("#salesDay").addEventListener("change", event => {
  if (!event.target.value) { updateSalesDayControl(); return; }
  selectedSalesDay = event.target.value;
  localStorage.setItem("kermessSalesDay", selectedSalesDay);
  updateSalesDayControl(true);
});
$("#keepSelectedDayButton").addEventListener("click", closeDayWarning);
$("#useTodayButton").addEventListener("click", () => {
  selectedSalesDay = eventDayFromDate();
  localStorage.setItem("kermessSalesDay", selectedSalesDay);
  updateSalesDayControl();
  closeDayWarning();
});
$("#clearOrder").addEventListener("click", clearOrCancelOrder);
$("#completeSale").addEventListener("click", showCompletedSale);
$("#closeModal").addEventListener("click", closeSale);
$("#saleModal .modal-backdrop").addEventListener("click", closeSale);
$("#newOrder").addEventListener("click", startNewOrder);
$("#paymentAmount").addEventListener("input", formatPaymentAmount);
$("#paymentAmount").addEventListener("keydown", event => { if (event.key === "Enter" && !$("#newOrder").disabled) startNewOrder(); });
$("#openReport").addEventListener("click", openReport);
$("#closeReport").addEventListener("click", closeReport);
$("#reportModal .modal-backdrop").addEventListener("click", closeReport);
$("#exportReport").addEventListener("click", exportReport);
$("#reportDayFilter").addEventListener("change", renderReport);
$(".report-table thead").addEventListener("click", event => {
  const button = event.target.closest("[data-sort]");
  if (!button) return;
  const key = button.dataset.sort;
  if (reportSort.key === key) reportSort.direction = reportSort.direction === "asc" ? "desc" : "asc";
  else reportSort = { key, direction: key === "name" || key === "provider" ? "asc" : "desc" };
  renderReport();
});
$("#openInvoices").addEventListener("click", openInvoices);
$("#closeInvoices").addEventListener("click", closeInvoices);
$("#invoicesModal .modal-backdrop").addEventListener("click", closeInvoices);
$("#invoiceSearch").addEventListener("input", renderInvoices);
$("#invoiceDayFilter").addEventListener("change", renderInvoices);
$("#invoiceStatusFilter").addEventListener("change", renderInvoices);
$("#invoiceList").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-invoice]");
  const deleteButton = event.target.closest("[data-delete-invoice]");
  const restoreButton = event.target.closest("[data-restore-invoice]");
  if (editButton) editInvoice(editButton.dataset.editInvoice);
  else if (deleteButton) deleteInvoice(deleteButton.dataset.deleteInvoice);
  else if (restoreButton) restoreInvoice(restoreButton.dataset.restoreInvoice);
});
document.addEventListener("keydown", event => {
  if ($("#donationDialog")?.open) return;
  if (event.key === "/" && document.activeElement !== $("#searchInput")) { event.preventDefault(); $("#searchInput").focus(); }
  if (event.key === "Escape") { closeSale(); closeReport(); closeInvoices(); }
});

function updateClock() {
  $("#clock").textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

renderTabs();
updateSalesDayControl(true);
renderCart();
if (activitiesOnly) {
  document.title = "Kermess Games POS";
  $(".catalog-heading h1").textContent = "Choose an activity";
}
updateClock();
setInterval(updateClock, 30000);
window.addEventListener("online", syncPendingSales);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();
setInterval(syncPendingSales, 15000);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js?v=30", { updateViaCache: "none" }).catch(error => console.warn("Offline cache unavailable", error));
}
