/**
 * Supabase Cloud Database Client & Synchronization Module
 * Provides seamless cloud data persistence, dual-company filtering,
 * auto-pull on launch, and real-time syncing for Tootherise & Go Menu.
 */

const SUPABASE_STORAGE_KEYS = {
  URL: 'agency_supabase_url',
  KEY: 'agency_supabase_anon_key'
};

const SupabaseService = {
  client: null,
  isConnected: false,

  checkUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const url = params.get('s_url') || params.get('supabase_url');
      const key = params.get('s_key') || params.get('supabase_key');
      
      if (url && key) {
        localStorage.setItem(SUPABASE_STORAGE_KEYS.URL, url.trim());
        localStorage.setItem(SUPABASE_STORAGE_KEYS.KEY, key.trim());
        // Clean URL params without reloading page
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      }
    } catch (e) {
      console.error('Error checking URL params for Supabase credentials:', e);
    }
  },

  getUrl() {
    return localStorage.getItem(SUPABASE_STORAGE_KEYS.URL) || 'https://oblymoynkedhmwjotpoj.supabase.co';
  },

  getKey() {
    return localStorage.getItem(SUPABASE_STORAGE_KEYS.KEY) || '';
  },

  setConfig(url, key) {
    localStorage.setItem(SUPABASE_STORAGE_KEYS.URL, url.trim());
    localStorage.setItem(SUPABASE_STORAGE_KEYS.KEY, key.trim());
    return this.init();
  },

  generateShareableLink() {
    const url = this.getUrl();
    const key = this.getKey();
    if (!url || !key) return null;
    const baseUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    return `${baseUrl}?s_url=${encodeURIComponent(url)}&s_key=${encodeURIComponent(key)}`;
  },

  init() {
    this.checkUrlParams();
    const url = this.getUrl();
    const key = this.getKey();

    if (!url || !key || typeof supabase === 'undefined') {
      this.client = null;
      this.isConnected = false;
      this.updateStatusBadge();
      return false;
    }

    try {
      this.client = supabase.createClient(url, key);
      this.testConnection();
      return true;
    } catch (e) {
      console.error('Supabase initialization failed:', e);
      this.client = null;
      this.isConnected = false;
      this.updateStatusBadge();
      return false;
    }
  },

  async testConnection() {
    if (!this.client) {
      this.isConnected = false;
      this.updateStatusBadge();
      return false;
    }

    try {
      const { data, error } = await this.client.from('clients').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        console.warn('Supabase ping response:', error.message);
      }
      this.isConnected = !error;
      this.updateStatusBadge();
      return this.isConnected;
    } catch (e) {
      this.isConnected = false;
      this.updateStatusBadge();
      return false;
    }
  },

  updateStatusBadge() {
    const badge = document.getElementById('supabase-status-badge');
    if (!badge) return;

    if (this.isConnected) {
      badge.className = 'badge-company';
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = '#34d399';
      badge.style.border = '1px solid rgba(16, 185, 129, 0.35)';
      badge.innerHTML = `<i class="fa-solid fa-cloud-check"></i> Cloud Synced`;
    } else if (this.getUrl() && this.getKey()) {
      badge.className = 'badge-company';
      badge.style.background = 'rgba(245, 158, 11, 0.15)';
      badge.style.color = '#fbbf24';
      badge.style.border = '1px solid rgba(245, 158, 11, 0.35)';
      badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Local Only`;
    } else {
      badge.className = 'badge-company';
      badge.style.background = 'rgba(255, 255, 255, 0.05)';
      badge.style.color = 'var(--text-muted)';
      badge.style.border = '1px solid var(--border-color)';
      badge.innerHTML = `<i class="fa-solid fa-cloud-slash"></i> Configure Supabase`;
    }
  },

  // --- CLOUD SYNC & PULL DATA ---
  async pullAllDataFromCloud() {
    if (!this.client) return false;

    try {
      // 1. Fetch Clients
      const { data: clientsData } = await this.client.from('clients').select('*');
      if (Array.isArray(clientsData) && clientsData.length > 0) {
        const formatted = clientsData.map(c => ({
          id: c.id,
          company: c.company || 'tootherise',
          name: c.name,
          contact: c.contact || '',
          email: c.email || '',
          phone: c.phone || '',
          serviceName: c.service_name || 'General Services',
          startDate: c.start_date || '',
          planType: c.plan_type || 'one-time',
          amount: parseFloat(c.amount) || 0,
          status: c.status || 'Active',
          createdAt: c.created_at
        }));
        Store.setItem(STORAGE_KEYS.CLIENTS, formatted);
      }

      // 2. Fetch Work Orders
      const { data: workData } = await this.client.from('work_orders').select('*');
      if (Array.isArray(workData) && workData.length > 0) {
        const formatted = workData.map(w => ({
          id: w.id,
          company: w.company || 'tootherise',
          clientId: w.client_id || '',
          clientName: w.client_name || '',
          description: w.description || '',
          dateReceived: w.date_received || '',
          deadline: w.deadline || '',
          assignedTo: w.assigned_to || 'Unassigned',
          status: w.status || 'Not Started',
          priority: w.priority || 'Medium',
          createdAt: w.created_at
        }));
        Store.setItem(STORAGE_KEYS.WORK_ORDERS, formatted);
      }

      // 3. Fetch Client Payments
      const { data: payData } = await this.client.from('client_payments').select('*');
      if (Array.isArray(payData) && payData.length > 0) {
        const formatted = payData.map(p => ({
          id: p.id,
          company: p.company || 'tootherise',
          clientId: p.client_id || '',
          clientName: p.client_name || '',
          totalAgreed: parseFloat(p.total_agreed) || 0,
          amountReceived: parseFloat(p.amount_received) || 0,
          paymentDate: p.payment_date || '',
          paymentMethod: p.payment_method || 'Bank Transfer',
          installments: p.installments || [],
          notes: p.notes || '',
          createdAt: p.created_at
        }));
        Store.setItem(STORAGE_KEYS.CLIENT_PAYMENTS, formatted);
      }

      // 4. Fetch Team Payments
      const { data: teamPayData } = await this.client.from('team_payments').select('*');
      if (Array.isArray(teamPayData) && teamPayData.length > 0) {
        const formatted = teamPayData.map(tp => ({
          id: tp.id,
          company: tp.company || 'tootherise',
          teamMember: tp.team_member || 'Team Member',
          workAssigned: tp.work_assigned || '',
          amountPaid: parseFloat(tp.amount_paid) || 0,
          datePaid: tp.date_paid || '',
          paymentMethod: tp.payment_method || 'Cash',
          notes: tp.notes || '',
          createdAt: tp.created_at
        }));
        Store.setItem(STORAGE_KEYS.TEAM_PAYMENTS, formatted);
      }

      // 5. Fetch Expenses
      const { data: expData } = await this.client.from('expenses').select('*');
      if (Array.isArray(expData) && expData.length > 0) {
        const formatted = expData.map(e => ({
          id: e.id,
          company: e.company || 'tootherise',
          title: e.title || 'General Expense',
          category: e.category || 'Subscriptions/Tools',
          amount: parseFloat(e.amount) || 0,
          expenseDate: e.expense_date || '',
          paymentMethod: e.payment_method || 'Credit Card',
          notes: e.notes || '',
          createdAt: e.created_at
        }));
        Store.setItem(STORAGE_KEYS.EXPENSES, formatted);
      }

      UI.renderAll();
      return true;
    } catch (e) {
      console.error('Error pulling data from Supabase:', e);
      return false;
    }
  },

  // --- INDIVIDUAL ENTITY SYNCING ---
  async syncClient(client) {
    if (!this.client) return;
    try {
      await this.client.from('clients').upsert({
        id: client.id,
        company: client.company || 'tootherise',
        name: client.name,
        contact: client.contact,
        email: client.email,
        phone: client.phone,
        service_name: client.serviceName,
        start_date: client.startDate,
        plan_type: client.planType,
        amount: client.amount,
        status: client.status
      });
      this.testConnection();
    } catch (e) { console.error('Supabase syncClient failed:', e); }
  },

  async deleteClient(id) {
    if (!this.client) return;
    try {
      await this.client.from('clients').delete().eq('id', id);
    } catch (e) { console.error('Supabase deleteClient failed:', e); }
  },

  async syncWorkOrder(order) {
    if (!this.client) return;
    try {
      await this.client.from('work_orders').upsert({
        id: order.id,
        company: order.company || 'tootherise',
        client_id: order.clientId,
        client_name: order.clientName,
        description: order.description,
        date_received: order.dateReceived,
        deadline: order.deadline,
        assigned_to: order.assignedTo,
        status: order.status,
        priority: order.priority
      });
      this.testConnection();
    } catch (e) { console.error('Supabase syncWorkOrder failed:', e); }
  },

  async deleteWorkOrder(id) {
    if (!this.client) return;
    try {
      await this.client.from('work_orders').delete().eq('id', id);
    } catch (e) { console.error('Supabase deleteWorkOrder failed:', e); }
  },

  async syncClientPayment(payment) {
    if (!this.client) return;
    try {
      await this.client.from('client_payments').upsert({
        id: payment.id,
        company: payment.company || 'tootherise',
        client_id: payment.clientId,
        client_name: payment.clientName,
        total_agreed: payment.totalAgreed,
        amount_received: payment.amountReceived,
        payment_date: payment.paymentDate,
        payment_method: payment.paymentMethod,
        installments: payment.installments || [],
        notes: payment.notes
      });
      this.testConnection();
    } catch (e) { console.error('Supabase syncClientPayment failed:', e); }
  },

  async deleteClientPayment(id) {
    if (!this.client) return;
    try {
      await this.client.from('client_payments').delete().eq('id', id);
    } catch (e) { console.error('Supabase deleteClientPayment failed:', e); }
  },

  async syncTeamPayment(tp) {
    if (!this.client) return;
    try {
      await this.client.from('team_payments').upsert({
        id: tp.id,
        company: tp.company || 'tootherise',
        team_member: tp.teamMember,
        work_assigned: tp.workAssigned,
        amount_paid: tp.amountPaid,
        date_paid: tp.datePaid,
        payment_method: tp.paymentMethod,
        notes: tp.notes
      });
      this.testConnection();
    } catch (e) { console.error('Supabase syncTeamPayment failed:', e); }
  },

  async deleteTeamPayment(id) {
    if (!this.client) return;
    try {
      await this.client.from('team_payments').delete().eq('id', id);
    } catch (e) { console.error('Supabase deleteTeamPayment failed:', e); }
  },

  async syncExpense(exp) {
    if (!this.client) return;
    try {
      await this.client.from('expenses').upsert({
        id: exp.id,
        company: exp.company || 'tootherise',
        title: exp.title,
        category: exp.category,
        amount: exp.amount,
        expense_date: exp.expenseDate,
        payment_method: exp.paymentMethod,
        notes: exp.notes
      });
      this.testConnection();
    } catch (e) { console.error('Supabase syncExpense failed:', e); }
  },

  async deleteExpense(id) {
    if (!this.client) return;
    try {
      await this.client.from('expenses').delete().eq('id', id);
    } catch (e) { console.error('Supabase deleteExpense failed:', e); }
  }
};
