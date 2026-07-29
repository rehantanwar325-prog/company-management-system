/**
 * Dashboard Analytics Charts Manager
 * Initializes and updates Chart.js instances with modern dark theme gradients.
 */

const Charts = {
  cashflowChart: null,
  statusChart: null,

  init() {
    this.renderCashflowChart();
    this.renderStatusChart();
  },

  renderCashflowChart() {
    const ctx = document.getElementById('cashflowChart');
    if (!ctx) return;

    if (this.cashflowChart) {
      this.cashflowChart.destroy();
    }

    const metrics = Store.getDashboardMetrics();

    const monthLabels = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const incomeData = [2800, 12000, 3500, 3000, metrics.totalIncomeReceived > 15000 ? metrics.totalIncomeReceived - 15000 : 3000, metrics.totalIncomeReceived];
    const teamData = [0, 3200, 0, 0, 3700, metrics.totalPaidToTeam];
    const expenseData = [150, 420, 210, 350, 680, metrics.totalExpenses];

    this.cashflowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Income Received (₹)',
            data: incomeData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10B981',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Team Payouts (₹)',
            data: teamData,
            backgroundColor: 'rgba(99, 102, 241, 0.75)',
            borderColor: '#6366F1',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Agency Expenses (₹)',
            data: expenseData,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#F43F5E',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#9CA3AF',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1E293B',
            titleColor: '#F3F4F6',
            bodyColor: '#9CA3AF',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9CA3AF', font: { family: 'Plus Jakarta Sans' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9CA3AF', font: { family: 'Plus Jakarta Sans' }, callback: v => '₹' + v }
          }
        }
      }
    });
  },

  renderStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    if (this.statusChart) {
      this.statusChart.destroy();
    }

    const orders = Store.getWorkOrders();
    const notStarted = orders.filter(o => o.status === 'Not Started').length;
    const inProgress = orders.filter(o => o.status === 'In Progress').length;
    const completed = orders.filter(o => o.status === 'Completed').length;
    const delivered = orders.filter(o => o.status === 'Delivered').length;

    this.statusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Not Started', 'In Progress', 'Completed', 'Delivered'],
        datasets: [
          {
            data: [notStarted, inProgress, completed, delivered],
            backgroundColor: [
              'rgba(156, 163, 175, 0.8)',
              'rgba(6, 182, 212, 0.8)',
              'rgba(99, 102, 241, 0.8)',
              'rgba(16, 185, 129, 0.8)'
            ],
            borderColor: '#0B0E14',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#9CA3AF',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
            }
          }
        }
      }
    });
  },

  updateAll() {
    this.renderCashflowChart();
    this.renderStatusChart();
  }
};
