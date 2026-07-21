(async function verify() {
  const root = document.getElementById('verify-root');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    root.innerHTML = `
      <h1>Link inválido</h1>
      <p class="subtitle">Nenhum token de verificação foi encontrado no link.</p>
      <a href="/" class="btn">Voltar ao início</a>
    `;
    return;
  }

  try {
    await Api.post('/api/auth/verify-email', { token });
    root.innerHTML = `
      <h1>Email verificado!</h1>
      <p class="subtitle">Sua conta foi confirmada com sucesso.</p>
      <a href="/dashboard.html" class="btn">Ir para o painel</a>
    `;
  } catch (err) {
    root.innerHTML = `
      <h1>Não foi possível verificar</h1>
      <p class="subtitle">${err.message}</p>
      <a href="/dashboard.html" class="btn">Ir para o painel</a>
    `;
  }
})();
