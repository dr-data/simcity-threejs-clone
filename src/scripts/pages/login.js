import { authClient } from '../auth/authClient.js';
import { isHsuId, isLoginId, normalizeHsuId } from '../auth/hsuId.js';

const msg = document.getElementById('auth-message');

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = normalizeHsuId(document.getElementById('login-username').value);
  if (!isLoginId(username)) {
    msg.textContent = 'Use your HSU ID, like s123456.';
    return;
  }
  try {
    await authClient.login(username, document.getElementById('login-password').value);
    msg.textContent = 'Logged in. Redirecting…';
    setTimeout(() => (window.location.href = '/'), 600);
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('form-claim').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = normalizeHsuId(document.getElementById('claim-username').value);
  const lock = document.getElementById('claim-lock').value;
  const lock2 = document.getElementById('claim-lock2').value;
  if (!isHsuId(username)) {
    msg.textContent = 'HSU ID must look like s123456.';
    return;
  }
  if (lock !== lock2) {
    msg.textContent = 'Personal lock and confirmation do not match.';
    return;
  }
  try {
    await authClient.claim(username, lock, document.getElementById('claim-board').value);
    msg.textContent = 'ID claimed. Redirecting…';
    setTimeout(() => (window.location.href = '/'), 600);
  } catch (err) {
    msg.textContent = err.message;
  }
});
