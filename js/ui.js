/**
 * UI Renderer & DOM Controller Module
 * Handles table rendering, filtering, search, badges, modals, toasts, ledgers, expenses,
 * Indian Rupee (₹) formatting, date fixes, dynamic Team Member directory, and payout notes.
 */

const UI = {
  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },

  getCompanyBadge(company) {
    const c = company || 'tootherise';
    if (c === 'gomenu') {
      return `<span class="badge-company badge-gomenu"><i class="fa-solid fa-hotel"></i> Go Menu</span>`;
    }
    if (c === 'both') {
      return `<span class="badge-company badge-both"><i class="fa-solid fa-globe"></i> Both Companies</span>`;
    }
    return `<span class="badge-company badge-tootherise"><i class="fa-solid fa-rocket"></i> Tootherise</span>`;
  },

  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      let cleanStr = String(dateStr).trim();
      if (cleanStr.includes('T')) cleanStr = cleanStr.split('T')[0];

      const parts = cleanStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }

      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  formatRelativeTime(isoString) {
    if (!isoString) return 'Just now';
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.formatDate(isoString);
  },

  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // --- DASHBOARD RENDERER ---
  renderDashboard() {
    const metrics = Store.getDashboardMetrics();

    document.getElementById('dash-income').textContent = this.formatCurrency(metrics.totalIncomeReceived);
    document.getElementById('dash-team-paid').textContent = this.formatCurrency(metrics.totalPaidToTeam);
    document.getElementById('dash-expenses').textContent = this.formatCurrency(metrics.totalExpenses);
    document.getElementById('dash-pending').textContent = this.formatCurrency(metrics.totalPendingFromClients);
    document.getElementById('dash-balance').textContent = this.formatCurrency(metrics.companyBalance);
    document.getElementById('dash-active-clients').textContent = metrics.activeClientsCount;
    document.getElementById('dash-pending-orders').textContent = metrics.pendingWorkCount;

    this.renderActivityFeed();

    if (window.Charts) {
      Charts.updateAll();
    }
  },

  renderActivityFeed() {
    const feedContainer = document.getElementById('activity-feed-list');
    if (!feedContainer) return;

    const logs = Store.getActivityLog().slice(0, 8);
    if (logs.length === 0) {
      feedContainer.innerHTML = `<li class="activity-item"><p style="color:var(--text-dim)">No recent activity recorded.</p></li>`;
      return;
    }

    feedContainer.innerHTML = logs.map(log => {
      let icon = 'fa-bell';
      let iconBg = 'background:rgba(99,102,241,0.15); color:#818CF8;';
      if (log.type === 'client') { icon = 'fa-user-tie'; iconBg = 'background:rgba(6,182,212,0.15); color:#22D3EE;'; }
      if (log.type === 'work') { icon = 'fa-briefcase'; iconBg = 'background:rgba(245,158,11,0.15); color:#FBBF24;'; }
      if (log.type === 'payment') { icon = 'fa-wallet'; iconBg = 'background:rgba(16,185,129,0.15); color:#34D399;'; }
      if (log.type === 'team_payment') { icon = 'fa-people-group'; iconBg = 'background:rgba(139,92,246,0.15); color:#A78BFA;'; }
      if (log.type === 'expense') { icon = 'fa-receipt'; iconBg = 'background:rgba(244,63,94,0.15); color:#FB7185;'; }

      return `
        <li class="activity-item">
          <div class="activity-icon" style="${iconBg}">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="activity-content">
            <p>${log.text}</p>
            <div class="activity-time">${this.formatRelativeTime(log.timestamp)}</div>
          </div>
        </li>
      `;
    }).join('');
  },

  // --- CLIENTS MODULE RENDERER ---
  renderClients() {
    const tbody = document.getElementById('clients-table-body');
    if (!tbody) return;

    const search = (document.getElementById('client-search')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('client-status-filter')?.value || 'all';

    let clients = Store.getClients();

    if (statusFilter !== 'all') {
      clients = clients.filter(c => c.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (search) {
      clients = clients.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.contact.toLowerCase().includes(search) ||
        c.serviceName.toLowerCase().includes(search)
      );
    }

    if (clients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <i class="fa-solid fa-user-slash empty-state-icon"></i>
              <h4>No Clients Found</h4>
              <p>No client records match your search query.</p>
              <button class="btn btn-primary btn-sm" onclick="App.openAddClientModal()">
                <i class="fa-solid fa-plus"></i> Add New Client
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = clients.map(client => {
      const statusClass = `badge-${client.status.toLowerCase()}`;
      const pendingBaki = client.pendingAmount || 0;
      const pendingBadgeClass = pendingBaki > 0 ? 'badge-pending' : 'badge-completed';
      const pendingText = pendingBaki > 0 ? `${this.formatCurrency(pendingBaki)} Baki` : '0 Baki (Cleared)';

      const totalDeal = client.calculatedAgreed || client.amount;
      const companyTag = this.getCompanyBadge(client.company);

      return `
        <tr>
          <td>
            <div class="cell-primary">
              <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                <span style="font-weight:700;">${client.name}</span>
                ${companyTag}
              </div>
              <span class="cell-sub"><i class="fa-regular fa-calendar"></i> Started: ${this.formatDate(client.startDate)}</span>
            </div>
          </td>
          <td>
            <div class="contact-pill">
              <i class="fa-solid fa-address-book" style="color:var(--primary)"></i>
              <span>${client.contact || client.email || 'N/A'}</span>
            </div>
          </td>
          <td>
            <div class="cell-primary">
              <span>${client.serviceName}</span>
              <span class="cell-sub" style="text-transform:capitalize;">Plan: ${client.planType}</span>
            </div>
          </td>
          <td><span class="amount-tag amount-total">${this.formatCurrency(totalDeal)}</span></td>
          <td>
            <span class="badge ${pendingBadgeClass}">
              <i class="fa-solid ${pendingBaki > 0 ? 'fa-hourglass-half' : 'fa-check-circle'}"></i> ${pendingText}
            </span>
          </td>
          <td><span class="badge ${statusClass}">${client.status}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-primary btn-sm" style="padding:0.3rem 0.6rem; font-size:0.75rem;" title="Add Payment Received" onclick="App.openAddInstallmentForClient('${client.id}')">
                <i class="fa-solid fa-plus"></i> Add Payment
              </button>
              <button class="btn-icon" title="View Dates & Installments Breakdown" onclick="App.showClientPaymentDatesModal('${client.id}')">
                <i class="fa-solid fa-calendar-days" style="color:var(--accent-cyan)"></i>
              </button>
              <button class="btn-icon" title="View Account Ledger" onclick="App.quickInspectClientLedger('${client.id}')">
                <i class="fa-solid fa-book-open"></i>
              </button>
              <button class="btn-icon" title="Edit Client" onclick="App.openEditClientModal('${client.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon delete" title="Delete Client" onclick="App.confirmDelete('client', '${client.id}', '${client.name.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- CLIENT PAYMENTS RENDERER ---
  renderClientPayments() {
    const tbody = document.getElementById('client-payments-table-body');
    if (!tbody) return;

    const search = (document.getElementById('cpay-search')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('cpay-status-filter')?.value || 'all';

    let payments = Store.getClientPayments();

    if (statusFilter === 'pending') {
      payments = payments.filter(p => (p.totalAgreed - p.amountReceived) > 0);
    } else if (statusFilter === 'cleared') {
      payments = payments.filter(p => (p.totalAgreed - p.amountReceived) <= 0);
    }

    if (search) {
      payments = payments.filter(p => 
        p.clientName.toLowerCase().includes(search) ||
        p.paymentMethod.toLowerCase().includes(search) ||
        (p.notes && p.notes.toLowerCase().includes(search))
      );
    }

    if (payments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <i class="fa-solid fa-money-bill-transfer empty-state-icon"></i>
              <h4>No Payment Records Found</h4>
              <p>No client payments recorded matching this view.</p>
              <button class="btn btn-primary btn-sm" onclick="App.openAddClientPaymentModal()">
                <i class="fa-solid fa-plus"></i> Record Payment
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = payments.map(pay => {
      const pending = Math.max(0, (pay.totalAgreed || 0) - (pay.amountReceived || 0));
      const percentPaid = pay.totalAgreed > 0 ? Math.min(100, Math.round((pay.amountReceived / pay.totalAgreed) * 100)) : 0;
      const installmentsCount = Array.isArray(pay.installments) ? pay.installments.length : (pay.amountReceived > 0 ? 1 : 0);
      const companyTag = this.getCompanyBadge(pay.company);

      return `
        <tr>
          <td>
            <div class="cell-primary">
              <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                <span style="font-weight:700;">${pay.clientName}</span>
                ${companyTag}
              </div>
              <span class="cell-sub"><i class="fa-regular fa-calendar-check"></i> Last Date: ${this.formatDate(pay.paymentDate)}</span>
            </div>
          </td>
          <td><span class="amount-tag">${this.formatCurrency(pay.totalAgreed)}</span></td>
          <td><span class="amount-tag amount-received">${this.formatCurrency(pay.amountReceived)}</span></td>
          <td>
            <span class="amount-tag ${pending > 0 ? 'amount-pending' : ''}">
              ${this.formatCurrency(pending)} ${pending > 0 ? 'Baki' : ''}
            </span>
          </td>
          <td style="min-width: 140px;">
            <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>${installmentsCount} Payments</span>
              <span>${percentPaid}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${percentPaid}%;"></div>
            </div>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="App.showPaymentInstallmentHistoryModal('${pay.id}')">
              <i class="fa-solid fa-list"></i> Dates History (${installmentsCount})
            </button>
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-primary btn-sm" style="padding:0.3rem 0.6rem; font-size:0.75rem;" title="Add Payment Received" onclick="App.openAddInstallmentModal('${pay.id}')">
                <i class="fa-solid fa-plus"></i> Add Payment
              </button>
              <button class="btn-icon" title="Edit Record" onclick="App.openEditClientPaymentModal('${pay.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon delete" title="Delete Payment" onclick="App.confirmDelete('client_payment', '${pay.id}', 'Payment from ${pay.clientName.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- WORK ORDERS RENDERER ---
  renderWorkOrders() {
    const tbody = document.getElementById('work-table-body');
    if (!tbody) return;

    const search = (document.getElementById('work-search')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('work-status-filter')?.value || 'all';
    const priorityFilter = document.getElementById('work-priority-filter')?.value || 'all';

    let orders = Store.getWorkOrders();

    if (statusFilter !== 'all') {
      orders = orders.filter(o => o.status.toLowerCase().replace(/\s+/g, '-') === statusFilter.toLowerCase());
    }

    if (priorityFilter !== 'all') {
      orders = orders.filter(o => o.priority.toLowerCase() === priorityFilter.toLowerCase());
    }

    if (search) {
      orders = orders.filter(o => 
        o.clientName.toLowerCase().includes(search) ||
        o.description.toLowerCase().includes(search) ||
        o.assignedTo.toLowerCase().includes(search)
      );
    }

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <i class="fa-solid fa-list-check empty-state-icon"></i>
              <h4>No Work Orders Found</h4>
              <p>No work items match your query.</p>
              <button class="btn btn-primary btn-sm" onclick="App.openAddWorkModal()">
                <i class="fa-solid fa-plus"></i> Create Work Order
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const prioSlug = order.priority.toLowerCase();
      const companyTag = this.getCompanyBadge(order.company);

      let deadlineBadge = `<span class="cell-sub"><i class="fa-regular fa-clock"></i> ${this.formatDate(order.deadline)}</span>`;
      if (order.deadline && new Date(order.deadline) < new Date() && order.status !== 'Delivered' && order.status !== 'Completed') {
        deadlineBadge += ` <span style="color:var(--accent-rose); font-size:0.75rem; font-weight:700;">(Overdue)</span>`;
      }

      return `
        <tr>
          <td>
            <div class="cell-primary">
              <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                <span style="font-weight:700;">${order.clientName}</span>
                ${companyTag}
              </div>
              <span class="cell-sub">Received: ${this.formatDate(order.dateReceived)}</span>
            </div>
          </td>
          <td style="max-width:280px; line-height:1.4;">${order.description}</td>
          <td>
            <div class="contact-pill">
              <i class="fa-solid fa-user-gear" style="color:var(--accent-cyan)"></i>
              <span>${order.assignedTo}</span>
            </div>
          </td>
          <td>${deadlineBadge}</td>
          <td><span class="badge badge-prio-${prioSlug}">${order.priority}</span></td>
          <td>
            <select class="select-filter" style="padding:0.35rem 1.8rem 0.35rem 0.65rem; font-size:0.78rem;" onchange="App.quickUpdateOrderStatus('${order.id}', this.value)">
              <option value="Not Started" ${order.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
              <option value="In Progress" ${order.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            </select>
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon" title="Edit Order" onclick="App.openEditWorkModal('${order.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon delete" title="Delete Order" onclick="App.confirmDelete('work', '${order.id}', 'Work Order for ${order.clientName.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- TEAM PAYMENTS RENDERER ---
  renderTeamPayments() {
    const tbody = document.getElementById('team-payments-table-body');
    if (!tbody) return;

    const search = (document.getElementById('tpay-search')?.value || '').toLowerCase().trim();
    let teamPayments = Store.getTeamPayments();

    if (search) {
      teamPayments = teamPayments.filter(tp => 
        tp.teamMember.toLowerCase().includes(search) ||
        tp.workAssigned.toLowerCase().includes(search) ||
        tp.paymentMethod.toLowerCase().includes(search) ||
        (tp.notes && tp.notes.toLowerCase().includes(search))
      );
    }

    if (teamPayments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <i class="fa-solid fa-hand-holding-dollar empty-state-icon"></i>
              <h4>No Team Payouts Recorded</h4>
              <p>Log payments given to team members or freelancers here.</p>
              <button class="btn btn-primary btn-sm" onclick="App.openAddTeamPaymentModal()">
                <i class="fa-solid fa-plus"></i> Record Team Payout
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = teamPayments.map(tp => {
      const companyTag = this.getCompanyBadge(tp.company);
      return `
        <tr>
          <td>
            <div class="cell-primary">
              <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                <span style="font-size:0.95rem; font-weight:700;">${tp.teamMember}</span>
                ${companyTag}
              </div>
              <span class="cell-sub"><i class="fa-regular fa-calendar-check"></i> Date: ${this.formatDate(tp.datePaid)}</span>
            </div>
          </td>
          <td>${tp.workAssigned}</td>
          <td><span class="amount-tag amount-received">${this.formatCurrency(tp.amountPaid)}</span></td>
          <td><span class="platform-chip"><i class="fa-solid fa-paper-plane"></i> ${tp.paymentMethod}</span></td>
          <td style="max-width: 240px; font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${tp.notes ? `<strong>Notes:</strong> ${tp.notes}` : '—'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon" title="Edit Team Payment" onclick="App.openEditTeamPaymentModal('${tp.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon delete" title="Delete Team Payment" onclick="App.confirmDelete('team_payment', '${tp.id}', 'Payout for ${tp.teamMember.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- EXPENSES RENDERER ---
  renderExpenses() {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;

    const search = (document.getElementById('expense-search')?.value || '').toLowerCase().trim();
    const categoryFilter = document.getElementById('expense-category-filter')?.value || 'all';

    let expenses = Store.getExpenses();

    if (categoryFilter !== 'all') {
      expenses = expenses.filter(e => e.category.toLowerCase().includes(categoryFilter.toLowerCase()));
    }

    if (search) {
      expenses = expenses.filter(e => 
        e.title.toLowerCase().includes(search) ||
        e.category.toLowerCase().includes(search) ||
        e.paymentMethod.toLowerCase().includes(search) ||
        (e.notes && e.notes.toLowerCase().includes(search))
      );
    }

    let totalExpenseSum = 0;
    expenses.forEach(e => totalExpenseSum += (e.amount || 0));

    const totalExpenseDisplay = document.getElementById('total-expenses-stat');
    if (totalExpenseDisplay) {
      totalExpenseDisplay.textContent = this.formatCurrency(totalExpenseSum);
    }

    if (expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <i class="fa-solid fa-receipt empty-state-icon"></i>
              <h4>No Expenses Found</h4>
              <p>No business expenses match your search.</p>
              <button class="btn btn-primary btn-sm" onclick="App.openAddExpenseModal()">
                <i class="fa-solid fa-plus"></i> Add Expense
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = expenses.map(exp => {
      const companyTag = this.getCompanyBadge(exp.company);
      return `
        <tr>
          <td>
            <div class="cell-primary">
              <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                <span style="font-weight:700;">${exp.title}</span>
                ${companyTag}
              </div>
              <span class="cell-sub"><i class="fa-regular fa-calendar"></i> Date: ${this.formatDate(exp.expenseDate)}</span>
            </div>
          </td>
          <td><span class="platform-chip"><i class="fa-solid fa-folder"></i> ${exp.category}</span></td>
          <td><span class="amount-tag amount-expense">${this.formatCurrency(exp.amount)}</span></td>
          <td><span class="platform-chip"><i class="fa-solid fa-credit-card"></i> ${exp.paymentMethod}</span></td>
          <td style="max-width: 220px; font-size:0.82rem; color:var(--text-muted);">${exp.notes || '—'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon" title="Edit Expense" onclick="App.openEditExpenseModal('${exp.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon delete" title="Delete Expense" onclick="App.confirmDelete('expense', '${exp.id}', '${exp.title.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // --- LEDGERS MODULE RENDERER ---
  currentLedgerTab: 'client',

  renderLedgers() {
    this.populateLedgerDropdowns();

    if (this.currentLedgerTab === 'client') {
      this.renderClientLedger();
    } else {
      this.renderTeamLedger();
    }
  },

  populateLedgerDropdowns() {
    const clients = Store.getClients();
    const clientSelect = document.getElementById('ledger-client-select');
    if (clientSelect) {
      const curVal = clientSelect.value;
      clientSelect.innerHTML = `<option value="">Select a Client to View Ledger...</option>` + 
        clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (curVal) clientSelect.value = curVal;
      else if (clients.length > 0) clientSelect.value = clients[0].id;
    }

    const teamMemberNames = Store.getCleanTeamMemberNames();
    const teamSelect = document.getElementById('ledger-team-select');
    if (teamSelect) {
      const curVal = teamSelect.value;
      teamSelect.innerHTML = `<option value="">Select a Team Member to View Ledger...</option>` +
        teamMemberNames.map(m => `<option value="${m}">${m}</option>`).join('');
      if (curVal) teamSelect.value = curVal;
      else if (teamMemberNames.length > 0) teamSelect.value = teamMemberNames[0];
    }
  },

  switchLedgerTab(tabType) {
    this.currentLedgerTab = tabType;
    document.getElementById('ledger-tab-client')?.classList.toggle('active', tabType === 'client');
    document.getElementById('ledger-tab-team')?.classList.toggle('active', tabType === 'team');

    document.getElementById('ledger-client-container')?.style.setProperty('display', tabType === 'client' ? 'block' : 'none');
    document.getElementById('ledger-team-container')?.style.setProperty('display', tabType === 'team' ? 'block' : 'none');

    this.renderLedgers();
  },

  renderClientLedger() {
    const select = document.getElementById('ledger-client-select');
    const displayArea = document.getElementById('client-ledger-display');
    if (!select || !displayArea) return;

    const clientId = select.value;
    if (!clientId) {
      displayArea.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-book-open empty-state-icon"></i>
          <h4>Select a Client</h4>
          <p>Choose a client from the dropdown above to inspect their complete account statement.</p>
        </div>
      `;
      return;
    }

    const ledger = Store.getClientLedgerData(clientId);
    if (!ledger) {
      displayArea.innerHTML = `<div class="empty-state"><h4>Client Ledger Not Found</h4></div>`;
      return;
    }

    const { client, workOrders, payments, totalAgreed, totalReceived, netPending } = ledger;

    let allInstallments = [];
    payments.forEach(p => {
      if (Array.isArray(p.installments) && p.installments.length > 0) {
        allInstallments.push(...p.installments);
      } else if (p.amountReceived > 0) {
        allInstallments.push({
          date: p.paymentDate,
          amount: p.amountReceived,
          method: p.paymentMethod,
          notes: p.notes || 'Payment Received'
        });
      }
    });

    displayArea.innerHTML = `
      <div class="ledger-header-card">
        <div class="ledger-profile">
          <div class="ledger-title-group">
            <h2>${client.name}</h2>
            <p><i class="fa-solid fa-id-card" style="color:var(--primary)"></i> ${client.contact || client.email || 'N/A'}</p>
          </div>
          <div>
            <span class="badge badge-${client.status.toLowerCase()}">${client.status}</span>
          </div>
        </div>

        <div class="ledger-stats-banner">
          <div class="ledger-stat-item">
            <div class="lbl">1. Total Deal Amount</div>
            <div class="val amount-total">${this.formatCurrency(totalAgreed)}</div>
          </div>
          <div class="ledger-stat-item">
            <div class="lbl">2. Total Received</div>
            <div class="val amount-received">${this.formatCurrency(totalReceived)}</div>
          </div>
          <div class="ledger-stat-item">
            <div class="lbl">3. Remaining Baki Balance</div>
            <div class="val ${netPending > 0 ? 'amount-pending' : ''}">${this.formatCurrency(netPending)}</div>
          </div>
          <div class="ledger-stat-item">
            <div class="lbl">Service & Plan</div>
            <div class="val" style="font-size:0.95rem; font-weight:700;">${client.serviceName}</div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;" class="dashboard-grid">
        <div class="content-card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-briefcase"></i> Work Orders History (${workOrders.length})</div>
          </div>
          ${workOrders.length === 0 ? '<p style="color:var(--text-dim); font-size:0.85rem;">No work orders assigned to this client yet.</p>' : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Work Description</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${workOrders.map(w => `
                    <tr>
                      <td>
                        <div class="cell-primary">
                          <span>${w.description}</span>
                          <span class="cell-sub">Deadline: ${this.formatDate(w.deadline)}</span>
                        </div>
                      </td>
                      <td>${w.assignedTo}</td>
                      <td><span class="badge badge-${w.status.toLowerCase().replace(/\s+/g, '-')}">${w.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div class="content-card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="card-title"><i class="fa-solid fa-calendar-days"></i> Payment Dates Breakdown (${allInstallments.length})</div>
            <button class="btn btn-primary btn-sm" onclick="App.openAddInstallmentForClient('${client.id}')">
              <i class="fa-solid fa-plus"></i> Add Payment
            </button>
          </div>
          ${allInstallments.length === 0 ? '<p style="color:var(--text-dim); font-size:0.85rem;">No payments received yet for this client.</p>' : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Payment Date</th>
                    <th>Amount Received</th>
                    <th>Method & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${allInstallments.map(inst => `
                    <tr>
                      <td><i class="fa-regular fa-calendar" style="color:var(--primary)"></i> ${this.formatDate(inst.date)}</td>
                      <td class="amount-received" style="font-weight:800;">${this.formatCurrency(inst.amount)}</td>
                      <td>
                        <span class="platform-chip">${inst.method || 'Bank Transfer'}</span>
                        <div class="cell-sub">${inst.notes || ''}</div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // --- TEAM LEDGER RENDERER WITH CLEAR NOTES & ADD PAYOUT BUTTON ---
  renderTeamLedger() {
    const select = document.getElementById('ledger-team-select');
    const displayArea = document.getElementById('team-ledger-display');
    if (!select || !displayArea) return;

    const memberName = select.value;
    if (!memberName) {
      displayArea.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-user-gear empty-state-icon"></i>
          <h4>Select a Team Member</h4>
          <p>Choose a team member from the dropdown above to view their deliverables and payout history.</p>
        </div>
      `;
      return;
    }

    const ledger = Store.getTeamLedgerData(memberName);
    if (!ledger) {
      displayArea.innerHTML = `<div class="empty-state"><h4>Team Ledger Not Found</h4></div>`;
      return;
    }

    const { assignedOrders, payouts, totalPaid, activeTasksCount, completedTasksCount } = ledger;

    displayArea.innerHTML = `
      <div class="ledger-header-card">
        <div class="ledger-profile">
          <div class="ledger-title-group">
            <h2>${memberName}</h2>
            <p><i class="fa-solid fa-user-tag" style="color:var(--accent-cyan)"></i> Team Member Account Ledger</p>
          </div>
          <div>
            <button class="btn btn-primary" onclick="App.openAddTeamPaymentForMember('${memberName.replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-plus"></i> Record Payout to ${memberName}
            </button>
          </div>
        </div>

        <div class="ledger-stats-banner">
          <div class="ledger-stat-item">
            <div class="lbl">Total Paid Out</div>
            <div class="val amount-received">${this.formatCurrency(totalPaid)}</div>
          </div>
          <div class="ledger-stat-item">
            <div class="lbl">Active Deliverables</div>
            <div class="val" style="color:var(--accent-cyan)">${activeTasksCount}</div>
          </div>
          <div class="ledger-stat-item">
            <div class="lbl">Completed Tasks</div>
            <div class="val" style="color:var(--accent-emerald)">${completedTasksCount}</div>
          </div>
          <div class="ledger-stat-item">
            <div class="lbl">Total Payouts Logged</div>
            <div class="val">${payouts.length}</div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;" class="dashboard-grid">
        <div class="content-card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-tasks"></i> Assigned Work Orders (${assignedOrders.length})</div>
          </div>
          ${assignedOrders.length === 0 ? '<p style="color:var(--text-dim); font-size:0.85rem;">No tasks assigned.</p>' : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Task Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${assignedOrders.map(w => `
                    <tr>
                      <td>${w.clientName}</td>
                      <td>${w.description}</td>
                      <td><span class="badge badge-${w.status.toLowerCase().replace(/\s+/g, '-')}">${w.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Payout History Table with Notes & Dates -->
        <div class="content-card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="card-title"><i class="fa-solid fa-hand-holding-dollar"></i> Payout History (${payouts.length})</div>
            <button class="btn btn-primary btn-sm" onclick="App.openAddTeamPaymentForMember('${memberName.replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-plus"></i> Add Payout
            </button>
          </div>
          ${payouts.length === 0 ? '<p style="color:var(--text-dim); font-size:0.85rem;">No payouts recorded yet for this team member.</p>' : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date Paid</th>
                    <th>Work / Project</th>
                    <th>Amount Paid</th>
                    <th>Method & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${payouts.map(p => `
                    <tr>
                      <td><i class="fa-regular fa-calendar-check" style="color:var(--primary)"></i> <strong>${this.formatDate(p.datePaid)}</strong></td>
                      <td>${p.workAssigned}</td>
                      <td class="amount-received" style="font-weight:800; font-size:0.95rem;">${this.formatCurrency(p.amountPaid)}</td>
                      <td>
                        <span class="platform-chip">${p.paymentMethod || 'Cash'}</span>
                        <div style="font-size:0.8rem; color:var(--text-main); font-weight:600; margin-top:0.2rem;">${p.notes ? `Note: ${p.notes}` : ''}</div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  populateClientDropdowns() {
    const clients = Store.getClients();
    const options = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const workSelect = document.getElementById('work-client-id');
    const paymentSelect = document.getElementById('cpay-client-id');

    if (workSelect) workSelect.innerHTML = `<option value="">Select a Client...</option>` + options;
    if (paymentSelect) paymentSelect.innerHTML = `<option value="">Select a Client...</option>` + options;
  },

  renderAll() {
    this.populateClientDropdowns();
    this.renderDashboard();
    this.renderClients();
    this.renderWorkOrders();
    this.renderClientPayments();
    this.renderTeamPayments();
    this.renderExpenses();
    this.renderLedgers();
  }
};
