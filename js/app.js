/**
 * Application Main Controller
 * Handles SPA navigation, modal triggers, form submissions, state updates, theme toggling, ledgers, expenses,
 * Indian Rupee (₹) formatting, team member management, and multi-date payout history with notes.
 */

const App = {
  activeModule: 'dashboard',
  pendingDelete: null,

  init() {
    this.bindNavigation();
    this.bindSearchAndFilters();
    this.bindFormSubmissions();
    this.bindThemeToggle();

    if (window.SupabaseService) {
      SupabaseService.init();
      SupabaseService.pullAllDataFromCloud();

      // Auto-pull fresh cloud data whenever user opens/switches back to tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && SupabaseService.client) {
          SupabaseService.pullAllDataFromCloud();
        }
      });
    }

    const activeCompany = Store.getActiveCompany();
    document.querySelectorAll('.company-tab').forEach(tab => {
      if (tab.getAttribute('data-company') === activeCompany) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    UI.renderAll();

    const agreedInput = document.getElementById('cpay-agreed');
    const receivedInput = document.getElementById('cpay-received');
    if (agreedInput && receivedInput) {
      const calcHandler = () => {
        const agreed = parseFloat(agreedInput.value) || 0;
        const received = parseFloat(receivedInput.value) || 0;
        const pending = Math.max(0, agreed - received);
        const preview = document.getElementById('cpay-pending-preview');
        if (preview) {
          preview.textContent = `Auto-calculated Pending Baki Balance: ${UI.formatCurrency(pending)}`;
        }
      };
      agreedInput.addEventListener('input', calcHandler);
      receivedInput.addEventListener('input', calcHandler);
    }
  },

  setCompanyFilter(company) {
    Store.setActiveCompany(company);
    document.querySelectorAll('.company-tab').forEach(tab => {
      if (tab.getAttribute('data-company') === company) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    UI.renderAll();
    const label = company === 'all' ? 'All Companies' : company === 'tootherise' ? 'Tootherise Agency' : 'Go Menu Hotel SaaS';
    UI.showToast(`Switched view to: ${label}`, 'info');
  },

  // Router / Navigation
  bindNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-module]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const moduleName = link.getAttribute('data-module');
        this.switchModule(moduleName);

        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    });

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('open');
      });
    }
  },

  switchModule(moduleName) {
    this.activeModule = moduleName;

    document.querySelectorAll('.nav-link[data-module]').forEach(link => {
      if (link.getAttribute('data-module') === moduleName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    document.querySelectorAll('.module-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`module-${moduleName}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    const titleEl = document.getElementById('header-title');
    const descEl = document.getElementById('header-desc');

    const titles = {
      dashboard: { title: 'Dashboard & Balance Overview', desc: 'Real-time agency revenue, team payouts, expenses, and net profit' },
      ledgers: { title: 'Client & Team Account Ledgers', desc: 'Detailed statements, work history, and payment transactions per account' },
      expenses: { title: 'Agency Expenses Tracker', desc: 'Track software tools, cloud hosting, marketing, and operational costs' },
      clients: { title: 'Clients', desc: 'Manage client accounts, contracts, plans, and pending baki balance' },
      work: { title: 'Work & Order Management', desc: 'Track project deliverables, deadlines, and team assignments' },
      'client-payments': { title: 'Client Payments & Installments', desc: 'Monitor incoming client payments, date-wise installments, and pending balances' },
      'team-payments': { title: 'Team Payouts Tracker', desc: 'Track freelancer and team member compensations, date-wise payouts, and notes' }
    };

    if (titles[moduleName] && titleEl && descEl) {
      titleEl.textContent = titles[moduleName].title;
      descEl.textContent = titles[moduleName].desc;
    }

    UI.renderAll();
  },

  bindSearchAndFilters() {
    document.getElementById('client-search')?.addEventListener('input', () => UI.renderClients());
    document.getElementById('client-status-filter')?.addEventListener('change', () => UI.renderClients());

    document.getElementById('work-search')?.addEventListener('input', () => UI.renderWorkOrders());
    document.getElementById('work-status-filter')?.addEventListener('change', () => UI.renderWorkOrders());
    document.getElementById('work-priority-filter')?.addEventListener('change', () => UI.renderWorkOrders());

    document.getElementById('cpay-search')?.addEventListener('input', () => UI.renderClientPayments());
    document.getElementById('cpay-status-filter')?.addEventListener('change', () => UI.renderClientPayments());

    document.getElementById('tpay-search')?.addEventListener('input', () => UI.renderTeamPayments());

    document.getElementById('expense-search')?.addEventListener('input', () => UI.renderExpenses());
    document.getElementById('expense-category-filter')?.addEventListener('change', () => UI.renderExpenses());

    document.getElementById('ledger-client-select')?.addEventListener('change', () => UI.renderClientLedger());
    document.getElementById('ledger-team-select')?.addEventListener('change', () => UI.renderTeamLedger());
  },

  quickInspectClientLedger(clientId) {
    this.switchModule('ledgers');
    UI.switchLedgerTab('client');
    const select = document.getElementById('ledger-client-select');
    if (select) {
      select.value = clientId;
      UI.renderClientLedger();
    }
  },

  quickInspectTeamLedger(memberName) {
    this.switchModule('ledgers');
    UI.switchLedgerTab('team');
    const select = document.getElementById('ledger-team-select');
    if (select) {
      select.value = memberName;
      UI.renderTeamLedger();
    }
  },

  // Modal helpers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // --- CLIENT MODAL HANDLERS ---
  openAddClientModal() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    const activeComp = Store.getActiveCompany();
    const select = document.getElementById('client-company');
    if (select) select.value = activeComp !== 'all' ? activeComp : 'tootherise';
    document.getElementById('client-modal-title').textContent = 'Add New Client';
    this.openModal('client-modal');
  },

  openEditClientModal(clientId) {
    const client = Store.getClientById(clientId);
    if (!client) return;

    document.getElementById('client-id').value = client.id;
    const select = document.getElementById('client-company');
    if (select) select.value = client.company || 'tootherise';
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-contact').value = client.contact || '';
    document.getElementById('client-email').value = client.email || '';
    document.getElementById('client-phone').value = client.phone || '';
    document.getElementById('client-service').value = client.serviceName;
    document.getElementById('client-start-date').value = client.startDate || '';
    document.getElementById('client-plan-type').value = client.planType;
    document.getElementById('client-amount').value = client.amount;
    document.getElementById('client-status').value = client.status;

    document.getElementById('client-modal-title').textContent = 'Edit Client Record';
    this.openModal('client-modal');
  },

  deleteAllClientsWithConfirm() {
    if (confirm('Are you sure you want to delete all clients and clear the clients list?')) {
      Store.deleteAllClients();
      UI.renderAll();
      UI.showToast('All clients deleted successfully', 'warning');
    }
  },

  // --- INSTALLMENTS & PAYMENT DATES DIALOGS ---
  openAddInstallmentForClient(clientId) {
    const client = Store.getClientById(clientId);
    if (!client) return;

    let paymentRecord = client.paymentRecords && client.paymentRecords.length > 0 ? client.paymentRecords[0] : null;

    if (!paymentRecord) {
      paymentRecord = Store.addClientPayment({
        company: client.company || 'tootherise',
        clientId: client.id,
        clientName: client.name,
        totalAgreed: client.amount,
        amountReceived: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank Transfer',
        notes: 'Payment Record'
      }, false);
    }

    this.openAddInstallmentModal(paymentRecord.id);
  },

  showClientPaymentDatesModal(clientId) {
    const ledger = Store.getClientLedgerData(clientId);
    if (!ledger) return;

    const { client, payments, totalAgreed, totalReceived, netPending } = ledger;
    document.getElementById('history-client-name').textContent = client.name;

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

    const body = document.getElementById('history-modal-body');
    if (body) {
      body.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.75rem; margin-bottom:1.25rem;">
          <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); padding:0.85rem; border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:0.72rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">1. Total Deal Amount</div>
            <div style="font-size:1.2rem; font-weight:800; color:var(--text-main); margin-top:0.25rem;">${UI.formatCurrency(totalAgreed)}</div>
          </div>
          <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:0.85rem; border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:0.72rem; color:var(--accent-emerald); font-weight:700; text-transform:uppercase;">2. Total Received</div>
            <div style="font-size:1.2rem; font-weight:800; color:var(--accent-emerald); margin-top:0.25rem;">${UI.formatCurrency(totalReceived)}</div>
          </div>
          <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:0.85rem; border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:0.72rem; color:var(--accent-amber); font-weight:700; text-transform:uppercase;">3. Remaining Baki</div>
            <div style="font-size:1.2rem; font-weight:800; color:var(--accent-amber); margin-top:0.25rem;">${UI.formatCurrency(netPending)}</div>
          </div>
        </div>

        ${allInstallments.length === 0 ? '<p style="text-align:center; color:var(--text-dim); padding:1.5rem;">No payment installments received yet for this client.</p>' : `
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
                    <td><i class="fa-regular fa-calendar-check" style="color:var(--primary)"></i> <strong>${UI.formatDate(inst.date)}</strong></td>
                    <td class="amount-received" style="font-weight:800; font-size:1rem;">${UI.formatCurrency(inst.amount)}</td>
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

        <div style="margin-top:1.25rem; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.8rem; color:var(--text-muted);">Log payments in multiple installments anytime</span>
          <button class="btn btn-primary btn-sm" onclick="App.closeModal('history-modal'); App.openAddInstallmentForClient('${client.id}')">
            <i class="fa-solid fa-plus"></i> Add Payment Received (+ Money)
          </button>
        </div>
      `;
    }

    this.openModal('history-modal');
  },

  showPaymentInstallmentHistoryModal(paymentId) {
    const pay = Store.getClientPayments().find(p => p.id === paymentId);
    if (!pay) return;

    document.getElementById('history-client-name').textContent = pay.clientName;

    let installments = Array.isArray(pay.installments) && pay.installments.length > 0 
      ? pay.installments 
      : [{ date: pay.paymentDate, amount: pay.amountReceived, method: pay.paymentMethod, notes: pay.notes }];

    const pending = Math.max(0, pay.totalAgreed - pay.amountReceived);

    const body = document.getElementById('history-modal-body');
    if (body) {
      body.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.75rem; margin-bottom:1.25rem;">
          <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); padding:0.85rem; border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:0.72rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">1. Total Deal Amount</div>
            <div style="font-size:1.2rem; font-weight:800;">${UI.formatCurrency(pay.totalAgreed)}</div>
          </div>
          <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:0.85rem; border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:0.72rem; color:var(--accent-emerald); font-weight:700; text-transform:uppercase;">2. Total Received</div>
            <div style="font-size:1.2rem; font-weight:800; color:var(--accent-emerald);">${UI.formatCurrency(pay.amountReceived)}</div>
          </div>
          <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:0.85rem; border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:0.72rem; color:var(--accent-amber); font-weight:700; text-transform:uppercase;">3. Remaining Baki</div>
            <div style="font-size:1.2rem; font-weight:800; color:var(--accent-amber);">${UI.formatCurrency(pending)}</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date Received</th>
                <th>Installment Amount</th>
                <th>Payment Method</th>
              </tr>
            </thead>
            <tbody>
              ${installments.map(inst => `
                <tr>
                  <td><i class="fa-regular fa-calendar" style="color:var(--primary)"></i> ${UI.formatDate(inst.date)}</td>
                  <td class="amount-received" style="font-weight:800;">${UI.formatCurrency(inst.amount)}</td>
                  <td>
                    <span class="platform-chip">${inst.method || 'Bank Transfer'}</span>
                    <div class="cell-sub">${inst.notes || ''}</div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top:1.25rem; text-align:right;">
          <button class="btn btn-primary btn-sm" onclick="App.closeModal('history-modal'); App.openAddInstallmentModal('${pay.id}')">
            <i class="fa-solid fa-plus"></i> Add Payment Received (+ Money)
          </button>
        </div>
      `;
    }

    this.openModal('history-modal');
  },

  openAddInstallmentModal(paymentRecordId) {
    document.getElementById('inst-form').reset();
    document.getElementById('inst-pay-id').value = paymentRecordId;
    document.getElementById('inst-date').value = new Date().toISOString().split('T')[0];

    const pay = Store.getClientPayments().find(p => p.id === paymentRecordId);
    if (pay) {
      document.getElementById('inst-client-label').textContent = pay.clientName;
      const pending = Math.max(0, pay.totalAgreed - pay.amountReceived);
      document.getElementById('inst-pending-preview').innerHTML = `
        <div>Deal Amount: <strong>${UI.formatCurrency(pay.totalAgreed)}</strong></div>
        <div style="color:var(--accent-emerald)">Received so far: <strong>${UI.formatCurrency(pay.amountReceived)}</strong></div>
        <div style="color:var(--accent-amber); font-weight:800;">Remaining Baki: ${UI.formatCurrency(pending)}</div>
      `;
    }

    this.openModal('inst-modal');
  },

  // --- WORK ORDER MODAL HANDLERS ---
  openAddWorkModal() {
    UI.populateClientDropdowns();
    document.getElementById('work-form').reset();
    document.getElementById('work-id').value = '';
    const activeComp = Store.getActiveCompany();
    const select = document.getElementById('work-company');
    if (select) select.value = activeComp !== 'all' ? activeComp : 'tootherise';
    document.getElementById('work-date-received').value = new Date().toISOString().split('T')[0];
    document.getElementById('work-modal-title').textContent = 'Create Work Order';
    this.openModal('work-modal');
  },

  openEditWorkModal(orderId) {
    UI.populateClientDropdowns();
    const order = Store.getWorkOrders().find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('work-id').value = order.id;
    const select = document.getElementById('work-company');
    if (select) select.value = order.company || 'tootherise';
    document.getElementById('work-client-id').value = order.clientId || '';
    document.getElementById('work-desc').value = order.description;
    document.getElementById('work-date-received').value = order.dateReceived;
    document.getElementById('work-deadline').value = order.deadline || '';
    document.getElementById('work-assigned').value = order.assignedTo;
    document.getElementById('work-status').value = order.status;
    document.getElementById('work-priority').value = order.priority;

    document.getElementById('work-modal-title').textContent = 'Edit Work Order';
    this.openModal('work-modal');
  },

  quickUpdateOrderStatus(orderId, newStatus) {
    Store.updateWorkOrder(orderId, { status: newStatus });
    UI.renderAll();
    UI.showToast(`Order status updated to "${newStatus}"`, 'success');
  },

  // --- CLIENT PAYMENTS MODAL HANDLERS ---
  openAddClientPaymentModal() {
    UI.populateClientDropdowns();
    document.getElementById('cpay-form').reset();
    document.getElementById('cpay-id').value = '';
    const activeComp = Store.getActiveCompany();
    const select = document.getElementById('cpay-company');
    if (select) select.value = activeComp !== 'all' ? activeComp : 'tootherise';
    document.getElementById('cpay-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('cpay-modal-title').textContent = 'Record Client Payment';
    document.getElementById('cpay-pending-preview').textContent = '';
    this.openModal('cpay-modal');
  },

  openEditClientPaymentModal(paymentId) {
    UI.populateClientDropdowns();
    const pay = Store.getClientPayments().find(p => p.id === paymentId);
    if (!pay) return;

    document.getElementById('cpay-id').value = pay.id;
    const select = document.getElementById('cpay-company');
    if (select) select.value = pay.company || 'tootherise';
    document.getElementById('cpay-client-id').value = pay.clientId || '';
    document.getElementById('cpay-agreed').value = pay.totalAgreed;
    document.getElementById('cpay-received').value = pay.amountReceived;
    document.getElementById('cpay-date').value = pay.paymentDate;
    document.getElementById('cpay-method').value = pay.paymentMethod;
    document.getElementById('cpay-notes').value = pay.notes || '';

    const pending = Math.max(0, pay.totalAgreed - pay.amountReceived);
    document.getElementById('cpay-pending-preview').textContent = `Auto-calculated Pending Baki Balance: ${UI.formatCurrency(pending)}`;

    document.getElementById('cpay-modal-title').textContent = 'Edit Payment Record';
    this.openModal('cpay-modal');
  },

  // --- TEAM PAYMENTS MODAL HANDLERS ---
  openAddTeamPaymentModal() {
    document.getElementById('tpay-form').reset();
    document.getElementById('tpay-id').value = '';
    const activeComp = Store.getActiveCompany();
    const select = document.getElementById('tpay-company');
    if (select) select.value = activeComp !== 'all' ? activeComp : 'tootherise';
    document.getElementById('tpay-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('tpay-modal-title').textContent = 'Record Team Payout';
    this.openModal('tpay-modal');
  },

  openAddTeamPaymentForMember(memberName) {
    this.openAddTeamPaymentModal();
    document.getElementById('tpay-member').value = memberName;
    document.getElementById('tpay-work').focus();
  },

  openEditTeamPaymentModal(tpayId) {
    const tp = Store.getTeamPayments().find(t => t.id === tpayId);
    if (!tp) return;

    document.getElementById('tpay-id').value = tp.id;
    const select = document.getElementById('tpay-company');
    if (select) select.value = tp.company || 'tootherise';
    document.getElementById('tpay-member').value = tp.teamMember;
    document.getElementById('tpay-work').value = tp.workAssigned;
    document.getElementById('tpay-amount').value = tp.amountPaid;
    document.getElementById('tpay-date').value = tp.datePaid;
    document.getElementById('tpay-method').value = tp.paymentMethod;
    document.getElementById('tpay-notes').value = tp.notes || '';

    document.getElementById('tpay-modal-title').textContent = 'Edit Team Payout';
    this.openModal('tpay-modal');
  },

  // --- EXPENSE MODAL HANDLERS ---
  openAddExpenseModal() {
    document.getElementById('expense-form').reset();
    document.getElementById('expense-id').value = '';
    const activeComp = Store.getActiveCompany();
    const select = document.getElementById('expense-company');
    if (select) select.value = activeComp !== 'all' ? activeComp : 'tootherise';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-modal-title').textContent = 'Record Business Expense';
    this.openModal('expense-modal');
  },

  openEditExpenseModal(expId) {
    const exp = Store.getExpenses().find(e => e.id === expId);
    if (!exp) return;

    document.getElementById('expense-id').value = exp.id;
    const select = document.getElementById('expense-company');
    if (select) select.value = exp.company || 'tootherise';
    document.getElementById('expense-title').value = exp.title;
    document.getElementById('expense-category').value = exp.category;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-date').value = exp.expenseDate;
    document.getElementById('expense-method').value = exp.paymentMethod;
    document.getElementById('expense-notes').value = exp.notes || '';

    document.getElementById('expense-modal-title').textContent = 'Edit Business Expense';
    this.openModal('expense-modal');
  },

  // --- FORM SUBMISSIONS ---
  bindFormSubmissions() {
    // Client Form
    document.getElementById('client-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('client-id').value;
      const data = {
        company: document.getElementById('client-company')?.value || 'tootherise',
        name: document.getElementById('client-name').value,
        contact: document.getElementById('client-contact').value,
        email: document.getElementById('client-email').value,
        phone: document.getElementById('client-phone').value,
        serviceName: document.getElementById('client-service').value,
        startDate: document.getElementById('client-start-date').value,
        planType: document.getElementById('client-plan-type').value,
        amount: document.getElementById('client-amount').value,
        status: document.getElementById('client-status').value
      };

      if (id) {
        Store.updateClient(id, data);
        UI.showToast('Client details updated successfully', 'success');
      } else {
        Store.addClient(data);
        UI.showToast('New client added successfully', 'success');
      }

      this.closeModal('client-modal');
      UI.renderAll();
    });

    // New Payment Installment Submission
    document.getElementById('inst-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const payId = document.getElementById('inst-pay-id').value;
      const data = {
        date: document.getElementById('inst-date').value,
        amount: document.getElementById('inst-amount').value,
        method: document.getElementById('inst-method').value,
        notes: document.getElementById('inst-notes').value
      };

      Store.addPaymentInstallment(payId, data);
      UI.showToast(`Logged payment of ₹${parseFloat(data.amount).toLocaleString('en-IN')}`, 'success');
      this.closeModal('inst-modal');
      UI.renderAll();
    });

    // Work Form
    document.getElementById('work-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('work-id').value;
      const data = {
        company: document.getElementById('work-company')?.value || 'tootherise',
        clientId: document.getElementById('work-client-id').value,
        description: document.getElementById('work-desc').value,
        dateReceived: document.getElementById('work-date-received').value,
        deadline: document.getElementById('work-deadline').value,
        assignedTo: document.getElementById('work-assigned').value,
        status: document.getElementById('work-status').value,
        priority: document.getElementById('work-priority').value
      };

      if (id) {
        Store.updateWorkOrder(id, data);
        UI.showToast('Work order updated', 'success');
      } else {
        Store.addWorkOrder(data);
        UI.showToast('Work order created', 'success');
      }

      this.closeModal('work-modal');
      UI.renderAll();
    });

    // Client Payment Form
    document.getElementById('cpay-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('cpay-id').value;
      const data = {
        company: document.getElementById('cpay-company')?.value || 'tootherise',
        clientId: document.getElementById('cpay-client-id').value,
        totalAgreed: document.getElementById('cpay-agreed').value,
        amountReceived: document.getElementById('cpay-received').value,
        paymentDate: document.getElementById('cpay-date').value,
        paymentMethod: document.getElementById('cpay-method').value,
        notes: document.getElementById('cpay-notes').value
      };

      if (id) {
        Store.updateClientPayment(id, data);
        UI.showToast('Payment record updated', 'success');
      } else {
        Store.addClientPayment(data);
        UI.showToast('Payment recorded successfully', 'success');
      }

      this.closeModal('cpay-modal');
      UI.renderAll();
    });

    // Team Payment Form
    document.getElementById('tpay-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('tpay-id').value;
      const data = {
        company: document.getElementById('tpay-company')?.value || 'tootherise',
        teamMember: document.getElementById('tpay-member').value,
        workAssigned: document.getElementById('tpay-work').value,
        amountPaid: document.getElementById('tpay-amount').value,
        datePaid: document.getElementById('tpay-date').value,
        paymentMethod: document.getElementById('tpay-method').value,
        notes: document.getElementById('tpay-notes').value
      };

      if (id) {
        Store.updateTeamPayment(id, data);
        UI.showToast('Team payout record updated', 'success');
      } else {
        Store.addTeamPayment(data);
        UI.showToast(`Logged payout of ₹${parseFloat(data.amountPaid).toLocaleString('en-IN')} to ${data.teamMember}`, 'success');
      }

      this.closeModal('tpay-modal');
      UI.renderAll();
    });

    // Expense Form
    document.getElementById('expense-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('expense-id').value;
      const data = {
        company: document.getElementById('expense-company')?.value || 'tootherise',
        title: document.getElementById('expense-title').value,
        category: document.getElementById('expense-category').value,
        amount: document.getElementById('expense-amount').value,
        expenseDate: document.getElementById('expense-date').value,
        paymentMethod: document.getElementById('expense-method').value,
        notes: document.getElementById('expense-notes').value
      };

      if (id) {
        Store.updateExpense(id, data);
        UI.showToast('Expense record updated', 'success');
      } else {
        Store.addExpense(data);
        UI.showToast('Expense logged successfully', 'success');
      }

      this.closeModal('expense-modal');
      UI.renderAll();
    });

    // Supabase Form
    document.getElementById('supabase-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('supabase-url-input').value;
      const key = document.getElementById('supabase-key-input').value;

      if (window.SupabaseService) {
        SupabaseService.setConfig(url, key);
        const connected = await SupabaseService.testConnection();
        if (connected) {
          UI.showToast('Connected to Supabase Cloud successfully!', 'success');
          SupabaseService.pullAllDataFromCloud();
        } else {
          UI.showToast('Config saved, but connection test failed. Verify URL/Key & SQL Schema.', 'warning');
        }
      }
      this.closeModal('supabase-modal');
    });
  },

  openSupabaseModal() {
    if (window.SupabaseService) {
      document.getElementById('supabase-url-input').value = SupabaseService.getUrl();
      document.getElementById('supabase-key-input').value = SupabaseService.getKey();
    }
    this.openModal('supabase-modal');
  },

  async pullCloudDataManually() {
    if (!window.SupabaseService || !SupabaseService.client) {
      UI.showToast('Please configure & save Supabase URL & Key first', 'warning');
      return;
    }
    UI.showToast('Pulling data from Supabase Cloud...', 'info');
    const success = await SupabaseService.pullAllDataFromCloud();
    if (success) {
      UI.showToast('Successfully synced all data from Supabase Cloud', 'success');
    } else {
      UI.showToast('Failed to pull cloud data. Verify database schema.', 'danger');
    }
  },

  copyMobileSyncLink() {
    if (!window.SupabaseService) return;
    const link = SupabaseService.generateShareableLink();
    if (!link || !SupabaseService.getKey()) {
      UI.showToast('Please enter & save Supabase Anon Key first to generate Mobile Sync link.', 'warning');
      return;
    }
    navigator.clipboard.writeText(link).then(() => {
      UI.showToast('Mobile Auto-Sync Link copied to clipboard! Send it to your phone & open it once.', 'success');
    }).catch(() => {
      prompt('Copy this Auto-Sync Link and open on your mobile phone:', link);
    });
  },

  confirmDelete(type, id, itemName) {
    this.pendingDelete = { type, id, itemName };
    document.getElementById('delete-item-name').textContent = itemName;
    this.openModal('delete-modal');
  },

  executePendingDelete() {
    if (!this.pendingDelete) return;

    const { type, id, itemName } = this.pendingDelete;

    if (type === 'client') Store.deleteClient(id);
    if (type === 'work') Store.deleteWorkOrder(id);
    if (type === 'client_payment') Store.deleteClientPayment(id);
    if (type === 'team_payment') Store.deleteTeamPayment(id);
    if (type === 'expense') Store.deleteExpense(id);

    UI.showToast(`Deleted "${itemName}"`, 'warning');
    this.pendingDelete = null;
    this.closeModal('delete-modal');
    UI.renderAll();
  },

  bindThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        toggleBtn.innerHTML = isLight 
          ? `<i class="fa-solid fa-moon"></i> <span>Dark Mode</span>`
          : `<i class="fa-solid fa-sun"></i> <span>Light Mode</span>`;
      });
    }
  },

  exportBackup() {
    const jsonStr = Store.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agency_management_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Backup downloaded successfully', 'success');
  },

  importBackup(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const success = Store.importBackupJSON(content);
      if (success) {
        UI.renderAll();
        UI.showToast('Data imported successfully!', 'success');
        if (window.SupabaseService && SupabaseService.client) {
          // Sync imported items to cloud if connected
          const clients = Store.getItem(STORAGE_KEYS.CLIENTS, []);
          clients.forEach(c => SupabaseService.syncClient(c));
        }
      } else {
        UI.showToast('Failed to import data. Invalid JSON file format.', 'danger');
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  },

  resetSystemData() {
    if (confirm('Are you sure you want to clear all database records?')) {
      Store.resetToDefaults();
      UI.renderAll();
      UI.showToast('All database records cleared', 'warning');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
