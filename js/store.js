/**
 * Agency & Freelance Business Store Module
 * Clean, empty database state without mock clients.
 * Manages state, localStorage persistence, CRUD operations, relational syncing, expenses, activity logs,
 * Indian Rupee (₹) calculations, multi-installment payments, and dynamic Team Members Directory.
 */

const STORAGE_KEYS = {
  CLIENTS: 'agency_db_clients_v5',
  WORK_ORDERS: 'agency_db_work_orders_v5',
  CLIENT_PAYMENTS: 'agency_db_client_payments_v5',
  TEAM_MEMBERS: 'agency_db_team_members_v5',
  TEAM_PAYMENTS: 'agency_db_team_payments_v5',
  EXPENSES: 'agency_db_expenses_v5',
  ACTIVITY_LOG: 'agency_db_activity_log_v5'
};

// Clean initial datasets for fresh production use
const MOCK_CLIENTS = [];
const MOCK_WORK_ORDERS = [];
const MOCK_CLIENT_PAYMENTS = [];
const MOCK_TEAM_MEMBERS = [];
const MOCK_TEAM_PAYMENTS = [];
const MOCK_EXPENSES = [];
const MOCK_ACTIVITY_LOG = [];

const Store = {
  activeCompany: localStorage.getItem('agency_active_company') || 'all',

  getActiveCompany() {
    return this.activeCompany || 'all';
  },

  setActiveCompany(company) {
    this.activeCompany = company;
    localStorage.setItem('agency_active_company', company);
  },

  filterByCompany(items) {
    const current = this.getActiveCompany();
    if (current === 'all') return items;
    return items.filter(item => (item.company || 'tootherise') === current);
  },

  generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  },

  getItem(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
      return fallback;
    }
  },

  setItem(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage`, e);
    }
  },

  init() {
    if (localStorage.getItem(STORAGE_KEYS.CLIENTS) === null) this.setItem(STORAGE_KEYS.CLIENTS, []);
    if (localStorage.getItem(STORAGE_KEYS.WORK_ORDERS) === null) this.setItem(STORAGE_KEYS.WORK_ORDERS, []);
    if (localStorage.getItem(STORAGE_KEYS.CLIENT_PAYMENTS) === null) this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    if (localStorage.getItem(STORAGE_KEYS.TEAM_MEMBERS) === null) this.setItem(STORAGE_KEYS.TEAM_MEMBERS, []);
    if (localStorage.getItem(STORAGE_KEYS.TEAM_PAYMENTS) === null) this.setItem(STORAGE_KEYS.TEAM_PAYMENTS, []);
    if (localStorage.getItem(STORAGE_KEYS.EXPENSES) === null) this.setItem(STORAGE_KEYS.EXPENSES, []);
    if (localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG) === null) this.setItem(STORAGE_KEYS.ACTIVITY_LOG, []);
  },

  clearAllData() {
    this.setItem(STORAGE_KEYS.CLIENTS, []);
    this.setItem(STORAGE_KEYS.WORK_ORDERS, []);
    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    this.setItem(STORAGE_KEYS.TEAM_MEMBERS, []);
    this.setItem(STORAGE_KEYS.TEAM_PAYMENTS, []);
    this.setItem(STORAGE_KEYS.EXPENSES, []);
    this.setItem(STORAGE_KEYS.ACTIVITY_LOG, []);
    this.logActivity('All database records cleared', 'system');
  },

  resetToDefaults() {
    this.clearAllData();
  },

  getActivityLog() {
    return this.getItem(STORAGE_KEYS.ACTIVITY_LOG, []);
  },

  logActivity(text, type = 'general') {
    const logs = this.getActivityLog();
    const newLog = {
      id: this.generateId('act'),
      text,
      type,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    if (logs.length > 30) logs.pop();
    this.setItem(STORAGE_KEYS.ACTIVITY_LOG, logs);
  },

  // --- DYNAMIC TEAM MEMBERS DIRECTORY ---
  getTeamMembers() {
    const members = this.getItem(STORAGE_KEYS.TEAM_MEMBERS, []);
    const payouts = this.getTeamPayments();

    return members.map(m => {
      const memberPayouts = payouts.filter(p => p.teamMember.toLowerCase().trim() === m.name.toLowerCase().trim());
      const totalPaid = memberPayouts.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
      return {
        ...m,
        totalPaid,
        payoutsCount: memberPayouts.length
      };
    });
  },

  addTeamMember(data) {
    const members = this.getItem(STORAGE_KEYS.TEAM_MEMBERS, []);
    const nameTrimmed = data.name.trim();

    const existing = members.find(m => m.name.toLowerCase() === nameTrimmed.toLowerCase());
    if (existing) return existing;

    const newMember = {
      id: this.generateId('tm'),
      name: nameTrimmed,
      role: data.role ? data.role.trim() : 'Team Specialist',
      contact: data.contact ? data.contact.trim() : '',
      createdAt: new Date().toISOString()
    };

    members.push(newMember);
    this.setItem(STORAGE_KEYS.TEAM_MEMBERS, members);
    this.logActivity(`Added new team member "${newMember.name}"`, 'team_payment');
    return newMember;
  },

  deleteTeamMember(id) {
    let members = this.getItem(STORAGE_KEYS.TEAM_MEMBERS, []);
    const target = members.find(m => m.id === id);
    if (!target) return false;

    members = members.filter(m => m.id !== id);
    this.setItem(STORAGE_KEYS.TEAM_MEMBERS, members);
    this.logActivity(`Deleted team member "${target.name}"`, 'team_payment');
    return true;
  },

  getCleanTeamMemberNames() {
    const memberSet = new Set();
    this.getTeamMembers().forEach(m => memberSet.add(m.name));
    this.getTeamPayments().forEach(p => { if (p.teamMember) memberSet.add(p.teamMember); });
    this.getWorkOrders().forEach(w => { if (w.assignedTo) memberSet.add(w.assignedTo); });

    return Array.from(memberSet).filter(Boolean);
  },

  // --- CLIENTS ENGINE ---
  getClients() {
    const clients = this.getItem(STORAGE_KEYS.CLIENTS, []);
    const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);

    const mapped = clients.map(client => {
      let agreed = client.amount || 0;
      let received = 0;

      const clientPayRecords = payments.filter(p => p.clientId === client.id || p.clientName.toLowerCase() === client.name.toLowerCase());
      if (clientPayRecords.length > 0) {
        agreed = clientPayRecords.reduce((acc, p) => acc + (p.totalAgreed || 0), 0);
        received = clientPayRecords.reduce((acc, p) => acc + (p.amountReceived || 0), 0);
      }

      const pendingAmount = Math.max(0, agreed - received);

      return {
        ...client,
        company: client.company || 'tootherise',
        calculatedAgreed: agreed,
        calculatedReceived: received,
        pendingAmount: pendingAmount,
        paymentRecords: clientPayRecords
      };
    });

    return this.filterByCompany(mapped);
  },

  getClientById(id) {
    const clients = this.getItem(STORAGE_KEYS.CLIENTS, []);
    const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    const client = clients.find(c => c.id === id);
    if (!client) return null;

    let agreed = client.amount || 0;
    let received = 0;
    const clientPayRecords = payments.filter(p => p.clientId === client.id || p.clientName.toLowerCase() === client.name.toLowerCase());
    if (clientPayRecords.length > 0) {
      agreed = clientPayRecords.reduce((acc, p) => acc + (p.totalAgreed || 0), 0);
      received = clientPayRecords.reduce((acc, p) => acc + (p.amountReceived || 0), 0);
    }

    return {
      ...client,
      company: client.company || 'tootherise',
      calculatedAgreed: agreed,
      calculatedReceived: received,
      pendingAmount: Math.max(0, agreed - received),
      paymentRecords: clientPayRecords
    };
  },

  addClient(data) {
    const clients = this.getItem(STORAGE_KEYS.CLIENTS, []);
    const company = data.company || (this.getActiveCompany() !== 'all' ? this.getActiveCompany() : 'tootherise');
    const newClient = {
      id: this.generateId('cli'),
      company: company,
      name: data.name.trim(),
      contact: data.contact ? data.contact.trim() : `${data.email || ''} ${data.phone || ''}`.trim(),
      email: data.email ? data.email.trim() : '',
      phone: data.phone ? data.phone.trim() : '',
      serviceName: data.serviceName ? data.serviceName.trim() : 'General Services',
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      planType: data.planType || 'one-time',
      amount: parseFloat(data.amount) || 0,
      status: data.status || 'Active',
      createdAt: new Date().toISOString()
    };

    clients.unshift(newClient);
    this.setItem(STORAGE_KEYS.CLIENTS, clients);

    if (window.SupabaseService) SupabaseService.syncClient(newClient);

    if (newClient.amount > 0) {
      this.addClientPayment({
        company: newClient.company,
        clientId: newClient.id,
        clientName: newClient.name,
        totalAgreed: newClient.amount,
        amountReceived: 0,
        paymentDate: newClient.startDate,
        paymentMethod: 'Bank Transfer',
        notes: `Created with client onboarding (${newClient.serviceName})`
      }, false);
    }

    const companyTag = newClient.company === 'gomenu' ? 'Go Menu' : 'Tootherise';
    this.logActivity(`Added new client "${newClient.name}" (${companyTag})`, 'client');
    return newClient;
  },

  updateClient(id, data) {
    const clients = this.getItem(STORAGE_KEYS.CLIENTS, []);
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return null;

    const oldName = clients[index].name;
    clients[index] = {
      ...clients[index],
      company: data.company || clients[index].company || 'tootherise',
      name: data.name ? data.name.trim() : clients[index].name,
      contact: data.contact ? data.contact.trim() : clients[index].contact,
      email: data.email !== undefined ? data.email.trim() : clients[index].email,
      phone: data.phone !== undefined ? data.phone.trim() : clients[index].phone,
      serviceName: data.serviceName ? data.serviceName.trim() : clients[index].serviceName,
      startDate: data.startDate || clients[index].startDate,
      planType: data.planType || clients[index].planType,
      amount: data.amount !== undefined ? parseFloat(data.amount) : clients[index].amount,
      status: data.status || clients[index].status
    };

    this.setItem(STORAGE_KEYS.CLIENTS, clients);

    if (window.SupabaseService) SupabaseService.syncClient(clients[index]);

    if (data.name && data.name.trim() !== oldName) {
      const newName = data.name.trim();
      const orders = this.getItem(STORAGE_KEYS.WORK_ORDERS, []).map(o => o.clientId === id ? { ...o, clientName: newName } : o);
      this.setItem(STORAGE_KEYS.WORK_ORDERS, orders);

      const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []).map(p => p.clientId === id ? { ...p, clientName: newName } : p);
      this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, payments);
    }

    this.logActivity(`Updated details for client "${clients[index].name}"`, 'client');
    return clients[index];
  },

  deleteClient(id) {
    let clients = this.getItem(STORAGE_KEYS.CLIENTS, []);
    const target = clients.find(c => c.id === id);
    if (!target) return false;

    clients = clients.filter(c => c.id !== id);
    this.setItem(STORAGE_KEYS.CLIENTS, clients);

    if (window.SupabaseService) SupabaseService.deleteClient(id);

    // Also delete associated payments and work orders
    const payments = this.getClientPayments().filter(p => p.clientId !== id && p.clientName.toLowerCase() !== target.name.toLowerCase());
    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, payments);

    const workOrders = this.getWorkOrders().filter(w => w.clientId !== id && w.clientName.toLowerCase() !== target.name.toLowerCase());
    this.setItem(STORAGE_KEYS.WORK_ORDERS, workOrders);

    this.logActivity(`Deleted client "${target.name}" and associated records`, 'client');
    return true;
  },

  deleteAllClients() {
    this.setItem(STORAGE_KEYS.CLIENTS, []);
    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    this.setItem(STORAGE_KEYS.WORK_ORDERS, []);
    this.logActivity('Deleted all clients and work records', 'client');
  },

  // --- WORK ORDERS ---
  getWorkOrders() {
    const orders = this.getItem(STORAGE_KEYS.WORK_ORDERS, []).map(o => ({
      ...o,
      company: o.company || 'tootherise'
    }));
    return this.filterByCompany(orders);
  },

  addWorkOrder(data) {
    const orders = this.getItem(STORAGE_KEYS.WORK_ORDERS, []);
    let clientName = data.clientName || 'Unknown Client';
    let company = data.company || (this.getActiveCompany() !== 'all' ? this.getActiveCompany() : 'tootherise');
    if (data.clientId) {
      const client = this.getClientById(data.clientId);
      if (client) {
        clientName = client.name;
        company = client.company || company;
      }
    }

    const assignedToName = data.assignedTo ? data.assignedTo.trim() : 'Unassigned';
    if (assignedToName !== 'Unassigned') {
      this.addTeamMember({ name: assignedToName });
    }

    const newOrder = {
      id: this.generateId('wrk'),
      company: company,
      clientId: data.clientId || '',
      clientName: clientName,
      description: data.description ? data.description.trim() : '',
      dateReceived: data.dateReceived || new Date().toISOString().split('T')[0],
      deadline: data.deadline || '',
      assignedTo: assignedToName,
      status: data.status || 'Not Started',
      priority: data.priority || 'Medium',
      createdAt: new Date().toISOString()
    };

    orders.unshift(newOrder);
    this.setItem(STORAGE_KEYS.WORK_ORDERS, orders);
    if (window.SupabaseService) SupabaseService.syncWorkOrder(newOrder);
    this.logActivity(`Added work order for "${newOrder.clientName}" (${company === 'gomenu' ? 'Go Menu' : 'Tootherise'})`, 'work');
    return newOrder;
  },

  updateWorkOrder(id, data) {
    const orders = this.getItem(STORAGE_KEYS.WORK_ORDERS, []);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) return null;

    let clientName = orders[index].clientName;
    let company = data.company || orders[index].company || 'tootherise';
    if (data.clientId) {
      const client = this.getClientById(data.clientId);
      if (client) clientName = client.name;
    }

    if (data.assignedTo && data.assignedTo.trim()) {
      this.addTeamMember({ name: data.assignedTo.trim() });
    }

    orders[index] = {
      ...orders[index],
      company: company,
      clientId: data.clientId !== undefined ? data.clientId : orders[index].clientId,
      clientName: clientName,
      description: data.description !== undefined ? data.description.trim() : orders[index].description,
      dateReceived: data.dateReceived || orders[index].dateReceived,
      deadline: data.deadline !== undefined ? data.deadline : orders[index].deadline,
      assignedTo: data.assignedTo !== undefined ? data.assignedTo.trim() : orders[index].assignedTo,
      status: data.status || orders[index].status,
      priority: data.priority || orders[index].priority
    };

    this.setItem(STORAGE_KEYS.WORK_ORDERS, orders);
    if (window.SupabaseService) SupabaseService.syncWorkOrder(orders[index]);
    this.logActivity(`Updated work order "${orders[index].description.substring(0, 30)}..." (${orders[index].status})`, 'work');
    return orders[index];
  },

  deleteWorkOrder(id) {
    let orders = this.getItem(STORAGE_KEYS.WORK_ORDERS, []);
    const target = orders.find(o => o.id === id);
    if (!target) return false;

    orders = orders.filter(o => o.id !== id);
    this.setItem(STORAGE_KEYS.WORK_ORDERS, orders);
    if (window.SupabaseService) SupabaseService.deleteWorkOrder(id);
    this.logActivity(`Deleted work order for "${target.clientName}"`, 'work');
    return true;
  },

  // --- CLIENT PAYMENTS ---
  getClientPayments() {
    const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []).map(p => ({
      ...p,
      company: p.company || 'tootherise'
    }));
    return this.filterByCompany(payments);
  },

  addClientPayment(data, doLog = true) {
    const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    let clientName = data.clientName || 'Direct Payment Client';
    let company = data.company || (this.getActiveCompany() !== 'all' ? this.getActiveCompany() : 'tootherise');
    if (data.clientId) {
      const client = this.getClientById(data.clientId);
      if (client) {
        clientName = client.name;
        company = client.company || company;
      }
    }

    const totalAgreed = parseFloat(data.totalAgreed) || 0;
    const amountReceived = parseFloat(data.amountReceived) || 0;
    const paymentDate = data.paymentDate || new Date().toISOString().split('T')[0];
    const paymentMethod = data.paymentMethod || 'Bank Transfer';

    const initialInstallments = [];
    if (amountReceived > 0) {
      initialInstallments.push({
        id: this.generateId('inst'),
        date: paymentDate,
        amount: amountReceived,
        method: paymentMethod,
        notes: data.notes || '1st Payment Received'
      });
    }

    const newPayment = {
      id: this.generateId('pay'),
      company: company,
      clientId: data.clientId || '',
      clientName: clientName,
      totalAgreed: totalAgreed,
      amountReceived: amountReceived,
      paymentDate: paymentDate,
      paymentMethod: paymentMethod,
      installments: initialInstallments,
      notes: data.notes ? data.notes.trim() : '',
      createdAt: new Date().toISOString()
    };

    payments.unshift(newPayment);
    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, payments);
    if (window.SupabaseService) SupabaseService.syncClientPayment(newPayment);

    if (doLog) {
      this.logActivity(`Recorded payment of ₹${amountReceived.toLocaleString('en-IN')} from ${newPayment.clientName} (${company === 'gomenu' ? 'Go Menu' : 'Tootherise'})`, 'payment');
    }
    return newPayment;
  },

  addPaymentInstallment(paymentRecordId, installmentData) {
    const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    let index = payments.findIndex(p => p.id === paymentRecordId);
    if (index === -1) {
      index = payments.findIndex(p => p.clientId === paymentRecordId);
    }

    if (index === -1) return null;

    const amount = parseFloat(installmentData.amount) || 0;
    const date = installmentData.date || new Date().toISOString().split('T')[0];
    const method = installmentData.method || 'UPI';
    const notes = installmentData.notes ? installmentData.notes.trim() : '';

    if (!Array.isArray(payments[index].installments)) {
      payments[index].installments = [];
    }

    const newInst = {
      id: this.generateId('inst'),
      date,
      amount,
      method,
      notes
    };

    payments[index].installments.push(newInst);
    payments[index].amountReceived = payments[index].installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    payments[index].paymentDate = date;
    payments[index].paymentMethod = method;

    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, payments);
    if (window.SupabaseService) SupabaseService.syncClientPayment(payments[index]);
    this.logActivity(`Logged payment of ₹${amount.toLocaleString('en-IN')} on ${date} for "${payments[index].clientName}"`, 'payment');
    return payments[index];
  },

  updateClientPayment(id, data) {
    const payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    const index = payments.findIndex(p => p.id === id);
    if (index === -1) return null;

    let clientName = payments[index].clientName;
    let company = data.company || payments[index].company || 'tootherise';
    if (data.clientId) {
      const client = this.getClientById(data.clientId);
      if (client) clientName = client.name;
    }

    payments[index] = {
      ...payments[index],
      company: company,
      clientId: data.clientId !== undefined ? data.clientId : payments[index].clientId,
      clientName: clientName,
      totalAgreed: data.totalAgreed !== undefined ? parseFloat(data.totalAgreed) || 0 : payments[index].totalAgreed,
      amountReceived: data.amountReceived !== undefined ? parseFloat(data.amountReceived) || 0 : payments[index].amountReceived,
      paymentDate: data.paymentDate || payments[index].paymentDate,
      paymentMethod: data.paymentMethod || payments[index].paymentMethod,
      notes: data.notes !== undefined ? data.notes.trim() : payments[index].notes
    };

    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, payments);
    if (window.SupabaseService) SupabaseService.syncClientPayment(payments[index]);
    this.logActivity(`Updated payment record for "${payments[index].clientName}"`, 'payment');
    return payments[index];
  },

  deleteClientPayment(id) {
    let payments = this.getItem(STORAGE_KEYS.CLIENT_PAYMENTS, []);
    const target = payments.find(p => p.id === id);
    if (!target) return false;

    payments = payments.filter(p => p.id !== id);
    this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, payments);
    if (window.SupabaseService) SupabaseService.deleteClientPayment(id);
    this.logActivity(`Deleted payment record of "${target.name || target.clientName}"`, 'payment');
    return true;
  },

  // --- TEAM PAYMENTS ---
  getTeamPayments() {
    const teamPayments = this.getItem(STORAGE_KEYS.TEAM_PAYMENTS, []).map(tp => ({
      ...tp,
      company: tp.company || 'tootherise'
    }));
    return this.filterByCompany(teamPayments);
  },

  addTeamPayment(data) {
    const teamPayments = this.getItem(STORAGE_KEYS.TEAM_PAYMENTS, []);
    const amountPaid = parseFloat(data.amountPaid) || 0;
    const memberName = data.teamMember ? data.teamMember.trim() : 'Team Member';
    const company = data.company || (this.getActiveCompany() !== 'all' ? this.getActiveCompany() : 'tootherise');

    this.addTeamMember({ name: memberName });

    const newTeamPayment = {
      id: this.generateId('tpay'),
      company: company,
      teamMember: memberName,
      workAssigned: data.workAssigned ? data.workAssigned.trim() : 'Project Payout',
      amountPaid: amountPaid,
      datePaid: data.datePaid || new Date().toISOString().split('T')[0],
      paymentMethod: data.paymentMethod || 'Cash',
      notes: data.notes ? data.notes.trim() : '',
      createdAt: new Date().toISOString()
    };

    teamPayments.unshift(newTeamPayment);
    this.setItem(STORAGE_KEYS.TEAM_PAYMENTS, teamPayments);
    if (window.SupabaseService) SupabaseService.syncTeamPayment(newTeamPayment);
    this.logActivity(`Paid ₹${amountPaid.toLocaleString('en-IN')} to team member "${newTeamPayment.teamMember}" (${company === 'gomenu' ? 'Go Menu' : 'Tootherise'})`, 'team_payment');
    return newTeamPayment;
  },

  updateTeamPayment(id, data) {
    const teamPayments = this.getItem(STORAGE_KEYS.TEAM_PAYMENTS, []);
    const index = teamPayments.findIndex(tp => tp.id === id);
    if (index === -1) return null;

    if (data.teamMember && data.teamMember.trim()) {
      this.addTeamMember({ name: data.teamMember.trim() });
    }

    teamPayments[index] = {
      ...teamPayments[index],
      company: data.company || teamPayments[index].company || 'tootherise',
      teamMember: data.teamMember ? data.teamMember.trim() : teamPayments[index].teamMember,
      workAssigned: data.workAssigned !== undefined ? data.workAssigned.trim() : teamPayments[index].workAssigned,
      amountPaid: data.amountPaid !== undefined ? parseFloat(data.amountPaid) || 0 : teamPayments[index].amountPaid,
      datePaid: data.datePaid || teamPayments[index].datePaid,
      paymentMethod: data.paymentMethod || teamPayments[index].paymentMethod,
      notes: data.notes !== undefined ? data.notes.trim() : teamPayments[index].notes
    };

    this.setItem(STORAGE_KEYS.TEAM_PAYMENTS, teamPayments);
    if (window.SupabaseService) SupabaseService.syncTeamPayment(teamPayments[index]);
    this.logActivity(`Updated team payout for ${teamPayments[index].teamMember}`, 'team_payment');
    return teamPayments[index];
  },

  deleteTeamPayment(id) {
    let teamPayments = this.getItem(STORAGE_KEYS.TEAM_PAYMENTS, []);
    const target = teamPayments.find(tp => tp.id === id);
    if (!target) return false;

    teamPayments = teamPayments.filter(tp => tp.id !== id);
    this.setItem(STORAGE_KEYS.TEAM_PAYMENTS, teamPayments);
    if (window.SupabaseService) SupabaseService.deleteTeamPayment(id);
    this.logActivity(`Deleted payout record for ${target.teamMember}`, 'team_payment');
    return true;
  },

  // --- EXPENSES ---
  getExpenses() {
    const expenses = this.getItem(STORAGE_KEYS.EXPENSES, []).map(e => ({
      ...e,
      company: e.company || 'tootherise'
    }));
    return this.filterByCompany(expenses);
  },

  addExpense(data) {
    const expenses = this.getItem(STORAGE_KEYS.EXPENSES, []);
    const amount = parseFloat(data.amount) || 0;
    const company = data.company || (this.getActiveCompany() !== 'all' ? this.getActiveCompany() : 'tootherise');

    const newExpense = {
      id: this.generateId('exp'),
      company: company,
      title: data.title ? data.title.trim() : 'General Expense',
      category: data.category || 'Subscriptions/Tools',
      amount: amount,
      expenseDate: data.expenseDate || new Date().toISOString().split('T')[0],
      paymentMethod: data.paymentMethod || 'Credit Card',
      notes: data.notes ? data.notes.trim() : '',
      createdAt: new Date().toISOString()
    };

    expenses.unshift(newExpense);
    this.setItem(STORAGE_KEYS.EXPENSES, expenses);
    if (window.SupabaseService) SupabaseService.syncExpense(newExpense);
    this.logActivity(`Added expense ₹${amount.toLocaleString('en-IN')} for "${newExpense.title}" (${company === 'gomenu' ? 'Go Menu' : 'Tootherise'})`, 'expense');
    return newExpense;
  },

  updateExpense(id, data) {
    const expenses = this.getItem(STORAGE_KEYS.EXPENSES, []);
    const index = expenses.findIndex(e => e.id === id);
    if (index === -1) return null;

    expenses[index] = {
      ...expenses[index],
      company: data.company || expenses[index].company || 'tootherise',
      title: data.title ? data.title.trim() : expenses[index].title,
      category: data.category || expenses[index].category,
      amount: data.amount !== undefined ? parseFloat(data.amount) || 0 : expenses[index].amount,
      expenseDate: data.expenseDate || expenses[index].expenseDate,
      paymentMethod: data.paymentMethod || expenses[index].paymentMethod,
      notes: data.notes !== undefined ? data.notes.trim() : expenses[index].notes
    };

    this.setItem(STORAGE_KEYS.EXPENSES, expenses);
    if (window.SupabaseService) SupabaseService.syncExpense(expenses[index]);
    this.logActivity(`Updated expense "${expenses[index].title}"`, 'expense');
    return expenses[index];
  },

  deleteExpense(id) {
    let expenses = this.getItem(STORAGE_KEYS.EXPENSES, []);
    const target = expenses.find(e => e.id === id);
    if (!target) return false;

    expenses = expenses.filter(e => e.id !== id);
    this.setItem(STORAGE_KEYS.EXPENSES, expenses);
    if (window.SupabaseService) SupabaseService.deleteExpense(id);
    this.logActivity(`Deleted expense record "${target.title}"`, 'expense');
    return true;
  },

  // --- LEDGER HELPERS ---
  getClientLedgerData(clientQuery) {
    if (!clientQuery) return null;

    const clients = this.getClients();
    const client = clients.find(c => c.id === clientQuery || c.name.toLowerCase() === clientQuery.toLowerCase());
    if (!client) return null;

    const workOrders = this.getWorkOrders().filter(w => w.clientId === client.id || w.clientName.toLowerCase() === client.name.toLowerCase());
    const payments = this.getClientPayments().filter(p => p.clientId === client.id || p.clientName.toLowerCase() === client.name.toLowerCase());

    let totalAgreed = 0;
    let totalReceived = 0;

    payments.forEach(p => {
      totalAgreed += (p.totalAgreed || 0);
      totalReceived += (p.amountReceived || 0);
    });

    if (totalAgreed === 0 && client.amount > 0) {
      totalAgreed = client.amount;
    }

    const netPending = Math.max(0, totalAgreed - totalReceived);

    return {
      client,
      workOrders,
      payments,
      totalAgreed,
      totalReceived,
      netPending
    };
  },

  getTeamLedgerData(memberQuery) {
    if (!memberQuery) return null;

    const queryLower = memberQuery.toLowerCase().trim();
    const allOrders = this.getWorkOrders();
    const allPayouts = this.getTeamPayments();

    const assignedOrders = allOrders.filter(w => w.assignedTo.toLowerCase().trim() === queryLower || w.assignedTo.toLowerCase().includes(queryLower));
    const payouts = allPayouts.filter(tp => tp.teamMember.toLowerCase().trim() === queryLower || tp.teamMember.toLowerCase().includes(queryLower));

    let totalPaid = 0;
    payouts.forEach(tp => {
      totalPaid += (tp.amountPaid || 0);
    });

    const activeTasksCount = assignedOrders.filter(w => w.status === 'Not Started' || w.status === 'In Progress').length;
    const completedTasksCount = assignedOrders.filter(w => w.status === 'Completed' || w.status === 'Delivered').length;

    return {
      memberName: memberQuery,
      assignedOrders,
      payouts,
      totalPaid,
      activeTasksCount,
      completedTasksCount
    };
  },

  // --- DASHBOARD METRICS ---
  getDashboardMetrics() {
    const clients = this.getClients();
    const workOrders = this.getWorkOrders();
    const clientPayments = this.getClientPayments();
    const teamPayments = this.getTeamPayments();
    const expenses = this.getExpenses();

    let totalAgreed = 0;
    let totalIncomeReceived = 0;
    let totalPendingFromClients = 0;

    clientPayments.forEach(pay => {
      const agreed = pay.totalAgreed || 0;
      const received = pay.amountReceived || 0;
      const pending = Math.max(0, agreed - received);

      totalAgreed += agreed;
      totalIncomeReceived += received;
      totalPendingFromClients += pending;
    });

    let totalPaidToTeam = 0;
    teamPayments.forEach(tp => {
      totalPaidToTeam += (tp.amountPaid || 0);
    });

    let totalExpenses = 0;
    expenses.forEach(e => {
      totalExpenses += (e.amount || 0);
    });

    const companyBalance = totalIncomeReceived - (totalPaidToTeam + totalExpenses);

    const activeClientsCount = clients.filter(c => c.status === 'Active').length;
    const pendingWorkCount = workOrders.filter(w => w.status === 'Not Started' || w.status === 'In Progress').length;

    return {
      totalAgreed,
      totalIncomeReceived,
      totalPaidToTeam,
      totalExpenses,
      totalPendingFromClients,
      companyBalance,
      totalClients: clients.length,
      activeClientsCount,
      totalWorkOrders: workOrders.length,
      pendingWorkCount
    };
  },

  exportBackupJSON() {
    const backupData = {
      teamMembers: this.getTeamMembers(),
      clients: this.getItem(STORAGE_KEYS.CLIENTS, []),
      workOrders: this.getWorkOrders(),
      clientPayments: this.getClientPayments(),
      teamPayments: this.getTeamPayments(),
      expenses: this.getExpenses(),
      activityLog: this.getActivityLog(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(backupData, null, 2);
  },

  importBackupJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.teamMembers)) this.setItem(STORAGE_KEYS.TEAM_MEMBERS, data.teamMembers);
      if (Array.isArray(data.clients)) this.setItem(STORAGE_KEYS.CLIENTS, data.clients);
      if (Array.isArray(data.workOrders)) this.setItem(STORAGE_KEYS.WORK_ORDERS, data.workOrders);
      if (Array.isArray(data.clientPayments)) this.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, data.clientPayments);
      if (Array.isArray(data.teamPayments)) this.setItem(STORAGE_KEYS.TEAM_PAYMENTS, data.teamPayments);
      if (Array.isArray(data.expenses)) this.setItem(STORAGE_KEYS.EXPENSES, data.expenses);
      if (Array.isArray(data.activityLog)) this.setItem(STORAGE_KEYS.ACTIVITY_LOG, data.activityLog);
      
      this.logActivity('Imported data backup successfully', 'system');
      return true;
    } catch (e) {
      console.error('Failed to parse JSON backup', e);
      return false;
    }
  }
};

Store.init();
