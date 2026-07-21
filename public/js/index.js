(async () => {
  try {
    const { user } = await Api.get('/api/auth/me');
    if (user) {
      const nav = document.getElementById('nav-actions');
      nav.innerHTML = '';
      const link = document.createElement('a');
      link.href = '/dashboard.html';
      link.className = 'btn';
      link.textContent = 'Ir para o painel';
      nav.appendChild(link);
    }
  } catch {
    // segue como visitante deslogado
  }
})();
