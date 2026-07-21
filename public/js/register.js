const usernameInput = document.getElementById('username');
const urlPreview = document.getElementById('url-preview');
const form = document.getElementById('register-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');

let usernameCheckTimer = null;

usernameInput.addEventListener('input', () => {
  const value = usernameInput.value.trim().toLowerCase();
  urlPreview.textContent = `/u/${value || 'seunome'}`;

  clearTimeout(usernameCheckTimer);
  if (!value) return;
  usernameCheckTimer = setTimeout(async () => {
    try {
      const { available } = await Api.get(`/api/check-username/${encodeURIComponent(value)}`);
      document.getElementById('username-hint').style.color = available ? 'var(--success)' : 'var(--danger)';
    } catch {
      // ignora erro de verificação em tempo real
    }
  }, 400);
});

function showAlert(message, type = 'error') {
  alertBox.innerHTML = '';
  const div = document.createElement('div');
  div.className = `alert ${type}`;
  div.textContent = message;
  alertBox.appendChild(div);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert('', 'success');
  alertBox.innerHTML = '';

  const username = usernameInput.value.trim().toLowerCase();
  const displayName = document.getElementById('displayName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Criando...';

  try {
    await Api.post('/api/auth/register', { username, displayName, email, password });
    window.location.href = '/dashboard.html';
  } catch (err) {
    showAlert(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Criar conta';
  }
});
