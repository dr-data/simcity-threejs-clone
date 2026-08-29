import { authClient } from '../auth/authClient.js';

async function load() {
  const status = document.getElementById('leaderboard-status');
  const tbody = document.querySelector('#leaderboard-table tbody');
  try {
    const data = await authClient.leaderboard();
    if (data.hidden) {
      status.textContent = 'Leaderboard is temporarily hidden by admin.';
      return;
    }
    status.textContent = `Top ${data.leaderboard.length} players`;
    tbody.innerHTML = data.leaderboard
      .map((row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${row.username}</td>
          <td>${row.best_score}</td>
          <td>${row.best_residents}</td>
          <td>${row.best_disaster_resilience}%</td>
          <td>${row.total_sessions}</td>
        </tr>
      `)
      .join('');
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
}

load();
