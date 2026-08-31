import { authClient } from '../auth/authClient.js';

function formatEvent(event) {
  const when = event.created_at
    ? new Date(event.created_at).toLocaleString()
    : '';
  const source = event.source === 'random' ? 'random' : 'triggered';
  return `<tr>
    <td>${when}</td>
    <td>${event.username || 'Guest'}</td>
    <td>${event.type} (${event.level})</td>
    <td>${source}</td>
    <td>${event.casualties ?? 0}</td>
    <td>${event.injured ?? 0}</td>
    <td>$${event.cost ?? 0}</td>
  </tr>`;
}

async function load() {
  const status = document.getElementById('leaderboard-status');
  const tbody = document.querySelector('#leaderboard-table tbody');
  const logStatus = document.getElementById('disaster-log-status');
  const logBody = document.querySelector('#disaster-log-table tbody');
  try {
    const data = await authClient.leaderboard();
    if (data.hidden) {
      status.textContent = 'Leaderboard is temporarily hidden by admin.';
      return;
    }
    status.textContent = `Top ${data.leaderboard.length} players — disaster totals are cumulative across sessions`;
    tbody.innerHTML = data.leaderboard
      .map(
        (row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${row.username}</td>
          <td>${row.best_score}</td>
          <td>${row.best_residents}</td>
          <td>${row.best_disaster_resilience}%</td>
          <td>${row.total_casualties ?? 0}</td>
          <td>${row.total_injured ?? 0}</td>
          <td>$${row.total_disaster_cost ?? 0}</td>
          <td>${row.total_sessions}</td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }

  try {
    const data = await authClient.disasterLog();
    const events = data.events || [];
    if (logStatus) {
      logStatus.textContent = events.length
        ? `Last ${events.length} recorded disasters (random and triggered)`
        : 'No disasters recorded yet. Play a session (logged in) to save the log.';
    }
    if (logBody) logBody.innerHTML = events.map(formatEvent).join('');
  } catch (err) {
    if (logStatus) logStatus.textContent = `Disaster log: ${err.message}`;
  }
}

load();
