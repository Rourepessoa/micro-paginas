const form = document.getElementById('login-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');

function showAlert(message) {
  alertBox.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'alert error';
  div.textContent = message;
  alertBox.appendChild(div);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const emailOrUsername = document.getElementById('emailOrUsername').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Entrando...';

  try {
    await Api.post('/api/auth/login', { emailOrUsername, password });
    window.location.href = '/dashboard.html';
  } catch (err) {
    showAlert(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }
});
