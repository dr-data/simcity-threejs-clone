import { authClient } from '../auth/authClient.js';

const adminApp = {
  users: [],
  selectedUserId: null,

  async init() {
    try {
      const { user } = await authClient.me();
      if (!user?.is_admin) {
        document.getElementById('admin-status').textContent =
          'Admin access required. Log in with an admin account.';
        return;
      }
      document.getElementById('admin-status').textContent = `Logged in as ${user.username}`;
      document.getElementById('admin-content').style.display = 'block';
      await this.loadUsers();
      await this.loadSessions();
      await this.loadAudit();
      await this.loadClassCode();
      this.bindForm();
    } catch {
      document.getElementById('admin-status').textContent =
        'Please log in first. <a href="/login.html">Login</a>';
    }
  },

  async loadUsers(search = '') {
    const data = await authClient.adminUsers(search ? { search } : {});
    this.users = data.users;
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = this.users
      .map(
        (u) => `
      <tr onclick="adminApp.selectUser(${u.id})" class="clickable-row">
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.last_login_at ? new Date(u.last_login_at).toLocaleString() : ''}</td>
        <td>${u.best_score}</td>
        <td>${u.best_residents}</td>
        <td>${u.best_developed_zones}</td>
        <td>${u.best_disaster_resilience}</td>
        <td>${u.total_sessions}</td>
        <td>${u.last_played || ''}</td>
        <td><button class="action-btn small" onclick="event.stopPropagation();adminApp.selectUser(${u.id})">Edit</button></td>
      </tr>`
      )
      .join('');
  },

  selectUser(id) {
    const u = this.users.find((x) => x.id === id);
    if (!u) return;
    this.selectedUserId = id;
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-score').value = u.best_score;
    document.getElementById('edit-residents').value = u.best_residents;
    document.getElementById('edit-zones').value = u.best_developed_zones;
    document.getElementById('edit-resilience').value = u.best_disaster_resilience;
    document.getElementById('edit-sessions').value = u.total_sessions;
  },

  bindForm() {
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = this.selectedUserId;
      if (!id) return alert('Select a user first');
      await authClient.adminUpdateUser(id, {
        best_score: parseInt(document.getElementById('edit-score').value, 10),
        best_residents: parseInt(document.getElementById('edit-residents').value, 10),
        best_developed_zones: parseInt(document.getElementById('edit-zones').value, 10),
        best_disaster_resilience: parseFloat(document.getElementById('edit-resilience').value),
        total_sessions: parseInt(document.getElementById('edit-sessions').value, 10),
        note: document.getElementById('edit-note').value,
      });
      alert('Updated!');
      await this.loadUsers();
      await this.loadAudit();
    });
  },

  async loadClassCode() {
    try {
      const data = await authClient.adminGetClassCode();
      const el = document.getElementById('class-board-code');
      if (el) el.value = data.code || '';
    } catch {
      /* older API */
    }
  },

  async saveClassCode() {
    const code = document.getElementById('class-board-code').value.trim();
    if (code.length < 4) return alert('Board code must be at least 4 characters');
    await authClient.adminSetClassCode(code);
    alert('Board code updated');
    await this.loadAudit();
  },

  async resetUserLock() {
    const id = this.selectedUserId;
    if (!id) return alert('Select a user');
    if (!confirm('Issue a new personal lock? Show it to the student once. There is no email reset.')) return;
    const data = await authClient.adminResetLock(id);
    alert(`New lock (show once): ${data.lock}`);
    await this.loadAudit();
  },

  async searchUsers() {
    await this.loadUsers(document.getElementById('user-search').value);
  },

  async deleteUser(soft) {
    const id = this.selectedUserId;
    if (!id) return alert('Select a user');
    if (!confirm(`Confirm ${soft ? 'soft' : 'permanent'} delete?`)) return;
    await authClient.adminDeleteUser(id, soft);
    alert('Deleted');
    this.selectedUserId = null;
    await this.loadUsers();
    await this.loadAudit();
  },

  async resetUserStats() {
    const id = this.selectedUserId;
    if (!id) return alert('Select a user');
    if (!confirm('Reset all stats to zero?')) return;
    await authClient.adminUpdateUser(id, {
      best_score: 0,
      best_residents: 0,
      best_developed_zones: 0,
      best_disaster_resilience: 0,
      total_sessions: 0,
      note: 'Stats reset by admin',
    });
    await this.loadUsers();
    await this.loadAudit();
  },

  async resetLeaderboard() {
    if (!confirm('Reset ALL leaderboard data? This cannot be undone.')) return;
    await authClient.adminResetLeaderboard();
    alert('Leaderboard reset');
    await this.loadUsers();
    await this.loadAudit();
  },

  async toggleLeaderboard() {
    const hidden = confirm('Hide leaderboard? (Cancel to show)');
    await authClient.adminHideLeaderboard(hidden);
    alert(hidden ? 'Leaderboard hidden' : 'Leaderboard visible');
    await this.loadAudit();
  },

  async loadSessions() {
    const data = await authClient.adminSessions();
    const tbody = document.querySelector('#sessions-table tbody');
    tbody.innerHTML = data.sessions
      .map(
        (s) => `
      <tr>
        <td>${s.id}</td>
        <td>${s.user_id}</td>
        <td>${s.score}</td>
        <td>${s.residents}</td>
        <td>${s.disaster_resilience}%</td>
        <td>${s.created_at}</td>
        <td><button class="action-btn small danger" onclick="adminApp.deleteSession(${s.id})">Del</button></td>
      </tr>`
      )
      .join('');
  },

  async deleteSession(id) {
    if (!confirm('Delete session?')) return;
    await authClient.adminDeleteSession(id);
    await this.loadSessions();
  },

  async loadAudit() {
    const data = await authClient.adminAuditLog();
    const tbody = document.querySelector('#audit-table tbody');
    tbody.innerHTML = data.log
      .map(
        (a) => `
      <tr>
        <td>${a.created_at}</td>
        <td>${a.admin_username || a.admin_user_id}</td>
        <td>${a.action}</td>
        <td>${a.target_user_id || ''}</td>
        <td>${a.changes || ''}</td>
      </tr>`
      )
      .join('');
  },
};

window.adminApp = adminApp;
adminApp.init();
