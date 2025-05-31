// (Immediately Invoked Function Expression to create a private scope)
(function () {
  'use strict';

  // --- CONFIGURATION ---
  const CONFIG = {
    API_BASE_URL: '/api',
    COLUMN_MAPPING: { // Not strictly needed with direct object properties now
      DATE: 'date',
      NAME: 'name', // This will be name_value from JOIN
      CATEGORY: 'category', // This will be category_value from JOIN
      AMOUNT: 'amount',
      STATUS: 'status',
      TYPE: 'type',
      DESC: 'desc',
      MONTH: 'month',
      ID: 'id'
    }
  };

  // --- APPLICATION STATE ---
  let appState = {
    allRecords: [], // Holds transaction records with joined name/category text
    allNames: [],     // Holds {id, name_value} from /api/names
    allCategories: [],// Holds {id, category_value} from /api/categories
    editModalInstance: null,
    addModalInstance: null,
    addNameModalInstance: null,
    addCategoryModalInstance: null,
  };

  // --- DOM ELEMENTS CACHE ---
  const DOMElements = {
    financeTableBody: null, resultsCount: null, monthFilter: null,
    typeFilter: null, dateFilter: null, statusFilter: null, nameFilter: null, categoryFilter: null,
    monthlySummaryContainer: null,
    // Add Record Modal
    addForm: null, addModal: null,
    addDateInput: null, addNameSelect: null, addCategorySelect: null, addAmountInput: null,
    addStatusInput: null, addTypeInput: null, addDescInput: null,
    // Edit Record Modal
    editModal: null, editRowIndexInput: null,
    modalDateInput: null, modalNameSelect: null, modalCategorySelect: null,
    modalAmountInput: null, modalStatusInput: null, modalTypeInput: null,
    modalDescInput: null, updateRecordButton: null,
    // Add Name Modal
    addNameModal: null, addNameForm: null, newNameValueInput: null,
    // Add Category Modal
    addCategoryModal: null, addCategoryForm: null, newCategoryValueInput: null,
    // Others
    clearFiltersButton: null, pageUpButton: null,
  };

  function cacheDOMElements() {
    DOMElements.financeTableBody = document.getElementById('finance-data');
    DOMElements.resultsCount = document.getElementById('results-count');
    DOMElements.monthFilter = document.getElementById('month-filter');
    DOMElements.typeFilter = document.getElementById('type-filter');
    DOMElements.dateFilter = document.getElementById('date-filter');
    DOMElements.statusFilter = document.getElementById('status-filter');
    DOMElements.nameFilter = document.getElementById('name-filter');
    DOMElements.categoryFilter = document.getElementById('category-filter');
    DOMElements.monthlySummaryContainer = document.getElementById('monthly-summary');
    DOMElements.clearFiltersButton = document.getElementById('clear-filters-btn');

    // Add Record Modal elements
    DOMElements.addForm = document.getElementById('add-form');
    DOMElements.addModal = document.getElementById('addModal');
    DOMElements.addDateInput = document.getElementById('add-date');
    DOMElements.addNameSelect = document.getElementById('add-name-select');
    DOMElements.addCategorySelect = document.getElementById('add-category-select');
    DOMElements.addAmountInput = document.getElementById('add-amount');
    DOMElements.addStatusInput = document.getElementById('add-status');
    DOMElements.addTypeInput = document.getElementById('add-type');
    DOMElements.addDescInput = document.getElementById('add-desc');
    if (DOMElements.addModal) appState.addModalInstance = new bootstrap.Modal(DOMElements.addModal);

    // Edit Record Modal elements
    DOMElements.editModal = document.getElementById('editModal');
    DOMElements.editRowIndexInput = document.getElementById('edit-row-index');
    DOMElements.modalDateInput = document.getElementById('modal-date');
    DOMElements.modalNameSelect = document.getElementById('modal-name-select');
    DOMElements.modalCategorySelect = document.getElementById('modal-category-select');
    DOMElements.modalAmountInput = document.getElementById('modal-amount');
    DOMElements.modalStatusInput = document.getElementById('modal-status');
    DOMElements.modalTypeInput = document.getElementById('modal-type');
    DOMElements.modalDescInput = document.getElementById('modal-desc');
    DOMElements.updateRecordButton = document.getElementById('update-record-btn');
    if (DOMElements.editModal) appState.editModalInstance = new bootstrap.Modal(DOMElements.editModal);

    // Add Name Modal elements
    DOMElements.addNameModal = document.getElementById('addNameModal');
    DOMElements.addNameForm = document.getElementById('add-name-form');
    DOMElements.newNameValueInput = document.getElementById('new-name-value');
    if (DOMElements.addNameModal) appState.addNameModalInstance = new bootstrap.Modal(DOMElements.addNameModal);

    // Add Category Modal elements
    DOMElements.addCategoryModal = document.getElementById('addCategoryModal');
    DOMElements.addCategoryForm = document.getElementById('add-category-form');
    DOMElements.newCategoryValueInput = document.getElementById('new-category-value');
    if (DOMElements.addCategoryModal) appState.addCategoryModalInstance = new bootstrap.Modal(DOMElements.addCategoryModal);
    
    DOMElements.pageUpButton = document.getElementById('pageUpBtn');
  }

  // --- PAGE SCROLL UTILITIES ---
  function handleScroll() {
    if (DOMElements.pageUpButton) {
      if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
        DOMElements.pageUpButton.style.display = "block";
      } else {
        DOMElements.pageUpButton.style.display = "none";
      }
    }
  }
  window.scrollToTop = function() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  function parseAmount(amountInput) {
    if (typeof amountInput === 'number') return amountInput;
    if (typeof amountInput === 'string') return parseFloat(amountInput.replace(/,/g, '')) || 0;
    return 0;
  }

  // --- DATE UTILITY FUNCTIONS ---
  function formatDateToCustom(dateStringYYYYMMDD) {
    if (!dateStringYYYYMMDD) return '';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStringYYYYMMDD)) {
        const parts = dateStringYYYYMMDD.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12) {
            return `${day}-${months[month - 1]}-${year}`;
        }
    }
    console.warn(`Could not parse date for custom formatting: "${dateStringYYYYMMDD}". Returning as is.`);
    return dateStringYYYYMMDD;
  }

  function mapBackendRecordToAppRecord(backendRecord) {
    return {
      id: backendRecord.id,
      date: backendRecord.date,
      name: backendRecord.name || '', // This is name_value from JOIN
      category: backendRecord.category || '', // This is category_value from JOIN
      amount: backendRecord.amount || '',
      status: (backendRecord.status || '').trim(),
      type: (backendRecord.type || '').trim(),
      desc: backendRecord.desc || '',
      month: backendRecord.month || (backendRecord.date ? backendRecord.date.substring(0, 7) : ''),
    };
  }

  function renderTable(recordsToRender) {
    if (!DOMElements.financeTableBody) return;
    const sortedRecords = [...recordsToRender].sort((a, b) => new Date(a.date) - new Date(b.date));
    DOMElements.financeTableBody.innerHTML = '';
    sortedRecords.forEach(record => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDateToCustom(record.date)}</td>
        <td>${record.name}</td>
        <td>${record.category}</td>
        <td>${record.amount}</td>
        <td>${record.status}</td>
        <td>${record.type}</td>
        <td>${record.desc || ''}</td>
        <td>
          <button class="btn btn-warning btn-sm edit-btn" data-id="${record.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${record.id}">Delete</button>
        </td>`;
      DOMElements.financeTableBody.appendChild(tr);
    });
    DOMElements.resultsCount.textContent = `Showing ${sortedRecords.length} result${sortedRecords.length !== 1 ? 's' : ''}`;
  }

  function populateSelectWithOptions(selectElement, items, valueField, textField, currentSelectedId) {
    if (!selectElement) return;
    const previousSelectedId = currentSelectedId || selectElement.value;
    selectElement.innerHTML = '<option value="">Select...</option>';
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item[valueField];
      option.textContent = item[textField];
      selectElement.appendChild(option);
    });
     if (items.some(item => String(item[valueField]) === String(previousSelectedId))) {
        selectElement.value = previousSelectedId;
    }
  }

  async function fetchAndPopulateNames(currentSelectedId) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/names`);
      if (!response.ok) throw new Error('Failed to fetch names');
      appState.allNames = await response.json();
      populateSelectWithOptions(DOMElements.addNameSelect, appState.allNames, 'id', 'name_value');
      populateSelectWithOptions(DOMElements.modalNameSelect, appState.allNames, 'id', 'name_value', currentSelectedId);
    } catch (error) {
      console.error(error.message);
      // alert('Could not load names for dropdowns.');
    }
  }

  async function fetchAndPopulateCategories(currentSelectedId) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      appState.allCategories = await response.json();
      populateSelectWithOptions(DOMElements.addCategorySelect, appState.allCategories, 'id', 'category_value');
      populateSelectWithOptions(DOMElements.modalCategorySelect, appState.allCategories, 'id', 'category_value', currentSelectedId);
    } catch (error) {
      console.error(error.message);
      // alert('Could not load categories for dropdowns.');
    }
  }
  
  function populateFilterDropdown(filterElement, records, fieldName, allOptionText) {
    if (!filterElement) return;
    const uniqueValues = new Set();
    records.forEach(record => {
        if (record[fieldName] && String(record[fieldName]).trim() !== '') {
            uniqueValues.add(String(record[fieldName]).trim());
        }
    });
    filterElement.innerHTML = `<option value="All">${allOptionText}</option>`;
    Array.from(uniqueValues).sort().forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterElement.appendChild(option);
    });
  }


  function populateNameFilter() {
    populateFilterDropdown(DOMElements.nameFilter, appState.allRecords, 'name', 'All Names');
  }

  function populateCategoryFilter() {
    populateFilterDropdown(DOMElements.categoryFilter, appState.allRecords, 'category', 'All Categories');
  }

  function applyFilters() {
    const selectedMonth = DOMElements.monthFilter ? DOMElements.monthFilter.value : '';
    const selectedType = DOMElements.typeFilter ? DOMElements.typeFilter.value : 'All';
    const selectedDate = DOMElements.dateFilter ? DOMElements.dateFilter.value : '';
    const selectedStatus = DOMElements.statusFilter ? DOMElements.statusFilter.value : 'All';
    const selectedName = DOMElements.nameFilter ? DOMElements.nameFilter.value : 'All';
    const selectedCategory = DOMElements.categoryFilter ? DOMElements.categoryFilter.value : 'All';

    const filtered = appState.allRecords.filter(record => {
      let match = true;
      if (selectedMonth) match = match && record.month === selectedMonth;
      if (selectedType !== 'All') match = match && record.type.toLowerCase() === selectedType.toLowerCase();
      if (selectedDate) match = match && record.date === selectedDate;
      if (selectedStatus !== 'All') match = match && record.status.toLowerCase() === selectedStatus.toLowerCase();
      if (selectedName !== 'All') match = match && record.name === selectedName;
      if (selectedCategory !== 'All') match = match && record.category === selectedCategory;
      return match;
    });
    renderTable(filtered);
    generateMonthlySummary(filtered);
  }

  function clearFilters() {
    if (DOMElements.monthFilter) DOMElements.monthFilter.value = '';
    if (DOMElements.typeFilter) DOMElements.typeFilter.value = 'All';
    if (DOMElements.dateFilter) DOMElements.dateFilter.value = '';
    if (DOMElements.statusFilter) DOMElements.statusFilter.value = 'All';
    if (DOMElements.nameFilter) DOMElements.nameFilter.value = 'All';
    if (DOMElements.categoryFilter) DOMElements.categoryFilter.value = 'All';
    applyFilters();
  }

  function generateMonthlySummary(records) {
    if (!DOMElements.monthlySummaryContainer) return;
    const summaryMap = {};
    records.forEach(record => {
      const month = record.month; if (!month) return;
      if (!summaryMap[month]) summaryMap[month] = { income: 0, expenses: 0 };
      const amount = parseAmount(record.amount);
      const type = (record.type || '').toLowerCase();
      if (type === 'income') summaryMap[month].income += amount;
      else if (type === 'expenses' || type === 'expense') summaryMap[month].expenses += amount;
    });
    DOMElements.monthlySummaryContainer.innerHTML = '<h5>Month-wise Summary</h5>';
    const table = document.createElement('table');
    table.className = 'table table-bordered table-sm mb-4';
    table.innerHTML = `<thead><tr><th>Month</th><th>Total Income</th><th>Total Expenses</th><th>Balance</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    Object.keys(summaryMap).sort().forEach(monthKey => {
      const income = summaryMap[monthKey].income.toFixed(2);
      const expenses = summaryMap[monthKey].expenses.toFixed(2);
      const balance = (summaryMap[monthKey].income - summaryMap[monthKey].expenses).toFixed(2);
      let displayMonth = monthKey;
      if (/^\d{4}-\d{2}$/.test(monthKey)) {
        const [year, monthNum] = monthKey.split('-');
        const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        const monthName = monthDate.toLocaleString('default', { month: 'short' });
        displayMonth = `${monthName}-${year}`;
      }
      tbody.innerHTML += `<tr><td>${displayMonth}</td><td style="color:green;">₹${income}</td><td style="color:red;">₹${expenses}</td><td><strong>₹${balance}</strong></td></tr>`;
    });
    table.appendChild(tbody);
    DOMElements.monthlySummaryContainer.appendChild(table);
  }

  async function loadDataFromBackend() {
    try {
      const transactionsResponse = await fetch(`${CONFIG.API_BASE_URL}/transactions`);
      if (!transactionsResponse.ok) throw new Error('Failed to fetch transactions');
      const transactionsData = await transactionsResponse.json();
      
      appState.allRecords = transactionsData.map(mapBackendRecordToAppRecord);

      await fetchAndPopulateNames();
      await fetchAndPopulateCategories();
      
      populateNameFilter(); // Populates main page filter based on current transactions
      populateCategoryFilter(); // Populates main page filter based on current transactions
      
      applyFilters();

    } catch (err) {
      console.error('Failed to fetch data from backend:', err);
      DOMElements.resultsCount.textContent = `Failed to load data: ${err.message}`;
    }
  }

  async function openEditModal(recordId) {
    const record = appState.allRecords.find(r => r.id === recordId);
    if (!record) { alert('Record not found for editing.'); return; }
    
    DOMElements.editRowIndexInput.value = record.id;
    DOMElements.modalDateInput.value = record.date;

    // Pre-populate and select the correct name and category
    // Ensure names and categories are loaded before trying to set value
    await fetchAndPopulateNames(); // Ensure latest names are loaded
    await fetchAndPopulateCategories(); // Ensure latest categories are loaded

    const nameEntry = appState.allNames.find(n => n.name_value === record.name);
    DOMElements.modalNameSelect.value = nameEntry ? nameEntry.id : '';
    
    const categoryEntry = appState.allCategories.find(c => c.category_value === record.category);
    DOMElements.modalCategorySelect.value = categoryEntry ? categoryEntry.id : '';

    DOMElements.modalAmountInput.value = record.amount;
    DOMElements.modalStatusInput.value = record.status;
    DOMElements.modalTypeInput.value = record.type;
    DOMElements.modalDescInput.value = record.desc;
    if (appState.editModalInstance) appState.editModalInstance.show();
  }

  async function handleUpdateRecord() {
    const recordId = parseInt(DOMElements.editRowIndexInput.value);
    if (isNaN(recordId)) { alert("Invalid record reference for update."); return; }

    const dateYYYYMMDD = DOMElements.modalDateInput.value;
    const nameId = DOMElements.modalNameSelect.value;
    const categoryId = DOMElements.modalCategorySelect.value;
    const amount = DOMElements.modalAmountInput.value;
    const status = DOMElements.modalStatusInput.value;
    const type = DOMElements.modalTypeInput.value;
    const desc = DOMElements.modalDescInput.value.trim();
    const month = dateYYYYMMDD ? dateYYYYMMDD.substring(0, 7) : '';

    if (!dateYYYYMMDD || !nameId || !categoryId || !amount || !status || !type) {
      alert('Please fill all required fields (Date, Name, Category, Amount, Status, Type).'); return;
    }

    const updatedRecord = {
      date: dateYYYYMMDD,
      name_id: parseInt(nameId),
      category_id: parseInt(categoryId),
      amount: parseAmount(amount),
      status, type, desc, month
    };

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/transactions/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      alert('Record updated successfully!');
      if (appState.editModalInstance) appState.editModalInstance.hide();
      await loadDataFromBackend();
    } catch (err) {
      console.error('Update error:', err);
      alert(`Error updating record: ${err.message}`);
    }
  }

  async function deleteRecord(recordId) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/transactions/${recordId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      alert('Record deleted successfully!');
      await loadDataFromBackend();
    } catch (err) {
      console.error('Delete error:', err);
      alert(`Error deleting record: ${err.message}`);
    }
  }

  async function handleAddRecord(event) {
    event.preventDefault();
    const dateValue = DOMElements.addDateInput.value;
    const nameId = DOMElements.addNameSelect.value;
    const categoryId = DOMElements.addCategorySelect.value;
    const amountValue = DOMElements.addAmountInput.value;
    const statusValue = DOMElements.addStatusInput.value;
    const typeValue = DOMElements.addTypeInput.value;
    const descValue = DOMElements.addDescInput.value.trim();
    const monthValue = dateValue ? dateValue.substring(0, 7) : '';

    if (!dateValue || !nameId || !categoryId || !amountValue || !statusValue || !typeValue) {
      alert('Please fill all required fields (Date, Name, Category, Amount, Status, Type).'); return;
    }

    const newRecord = {
      date: dateValue,
      name_id: parseInt(nameId),
      category_id: parseInt(categoryId),
      amount: parseAmount(amountValue),
      status: statusValue, type: typeValue, desc: descValue, month: monthValue,
    };

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      alert('Record added successfully!');
      if (appState.addModalInstance) appState.addModalInstance.hide();
      DOMElements.addForm.reset();
      await loadDataFromBackend();
    } catch (err) {
      console.error('Add error:', err);
      alert(`Error adding record: ${err.message}`);
    }
  }

  async function handleAddNewName(event) {
    event.preventDefault();
    const nameValue = DOMElements.newNameValueInput.value.trim();
    if (!nameValue) {
      alert('Name value cannot be empty.'); return;
    }
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_value: nameValue }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const newName = await response.json();
      alert('Name added successfully!');
      DOMElements.newNameValueInput.value = '';
      if(appState.addNameModalInstance) appState.addNameModalInstance.hide();
      await fetchAndPopulateNames(newName.id); // Refresh and select new name
    } catch (err) {
      console.error('Add name error:', err);
      alert(`Error adding name: ${err.message}`);
    }
  }

  async function handleAddNewCategory(event) {
    event.preventDefault();
    const categoryValue = DOMElements.newCategoryValueInput.value.trim();
    if (!categoryValue) {
      alert('Category value cannot be empty.'); return;
    }
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_value: categoryValue }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const newCategory = await response.json();
      alert('Category added successfully!');
      DOMElements.newCategoryValueInput.value = '';
      if(appState.addCategoryModalInstance) appState.addCategoryModalInstance.hide();
      await fetchAndPopulateCategories(newCategory.id); // Refresh and select new category
    } catch (err) {
      console.error('Add category error:', err);
      alert(`Error adding category: ${err.message}`);
    }
  }

  function initEventListeners() {
    [
      DOMElements.monthFilter, DOMElements.typeFilter, DOMElements.dateFilter,
      DOMElements.statusFilter, DOMElements.nameFilter, DOMElements.categoryFilter
    ].forEach(el => {
      if (el) el.addEventListener('change', applyFilters);
    });

    if (DOMElements.clearFiltersButton) {
        DOMElements.clearFiltersButton.addEventListener('click', clearFilters);
    }
    
    if (DOMElements.addForm) {
      DOMElements.addForm.addEventListener('submit', handleAddRecord);
    }
    if (DOMElements.updateRecordButton) {
      DOMElements.updateRecordButton.addEventListener('click', handleUpdateRecord);
    }

    if (DOMElements.addNameForm) {
      DOMElements.addNameForm.addEventListener('submit', handleAddNewName);
    }
    if (DOMElements.addCategoryForm) {
      DOMElements.addCategoryForm.addEventListener('submit', handleAddNewCategory);
    }

    if (DOMElements.financeTableBody) {
      DOMElements.financeTableBody.addEventListener('click', function (event) {
        const target = event.target;
        if (target.classList.contains('edit-btn')) {
          const recordId = parseInt(target.dataset.id);
          openEditModal(recordId);
        } else if (target.classList.contains('delete-btn')) {
          const recordId = parseInt(target.dataset.id);
          deleteRecord(recordId);
        }
      });
    }
    
    window.onscroll = handleScroll;
    if (DOMElements.pageUpButton) {
        DOMElements.pageUpButton.addEventListener('click', scrollToTop);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    cacheDOMElements();
    initEventListeners();
    await loadDataFromBackend();
  });

})();