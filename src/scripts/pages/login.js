import { authClient } from '../auth/authClient.js';

function showTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('form-reset').style.display = tab === 'reset' ? 'block' : 'none';
}
window.showTab = showTab;

const msg = document.getElementById('auth-message');

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await authClient.login(
      document.getElementById('login-username').value,
      document.getElementById('login-password').value
    );
    msg.textContent = 'Logged in! Redirecting...';
    setTimeout(() => (window.location.href = '/'), 1000);
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await authClient.signup(
      document.getElementById('signup-username').value,
      document.getElementById('signup-password').value,
      document.getElementById('signup-email').value
    );
    msg.textContent = 'Account created! Redirecting...';
    setTimeout(() => (window.location.href = '/'), 1000);
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('form-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const result = await authClient.resetRequest(document.getElementById('reset-email').value);
    msg.textContent = result.message || 'Check your email for reset instructions.';
    if (result.resetToken) {
      document.getElementById('reset-token').value = result.resetToken;
    }
  } catch (err) {
    msg.textContent = err.message;
  }
});

window.submitReset = async () => {
  try {
    await authClient.reset(
      document.getElementById('reset-token').value,
      document.getElementById('reset-password').value
    );
    msg.textContent = 'Password reset! You can log in now.';
    showTab('login');
  } catch (err) {
    msg.textContent = err.message;
  }
};
