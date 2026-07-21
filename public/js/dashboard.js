function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function showAlert(containerId, message, type = 'error') {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  if (!message) return;
  const div = document.createElement('div');
  div.className = `alert ${type}`;
  div.textContent = message;
  box.appendChild(div);
  if (type === 'success') {
    setTimeout(() => {
      box.innerHTML = '';
    }, 2500);
  }
}

// --- Auth guard + boot ---
let currentUser = null;

(async function boot() {
  try {
    const { user } = await Api.get('/api/auth/me');
    if (!user) {
      window.location.href = '/login.html';
      return;
    }
    currentUser = user;
    initVerifyBanner(user);
    initShareUrl(user);
    initProfileForm(user);
    initTabs();
    initLogout();
    initLinks();
    initPortfolio();
  } catch {
    window.location.href = '/login.html';
  }
})();

function initVerifyBanner(user) {
  const banner = document.getElementById('verify-banner');
  if (user.emailVerified) {
    banner.innerHTML = '';
    return;
  }

  banner.innerHTML = `
    <div class="alert warning" id="verify-alert">
      <span>Confirme seu email (<strong>${escapeHtml(user.email)}</strong>) para garantir o acesso à sua conta.</span>
      <button type="button" class="secondary" id="resend-verification-btn">Reenviar email</button>
    </div>
  `;

  document.getElementById('resend-verification-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const result = await Api.post('/api/auth/resend-verification');
      btn.textContent = result.alreadyVerified ? 'Já verificado' : 'Email enviado!';
    } catch (err) {
      showAlert('global-alert', err.message);
      btn.disabled = false;
      btn.textContent = 'Reenviar email';
    }
  });
}

function initShareUrl(user) {
  const fullUrl = `${window.location.origin}/u/${user.username}`;
  document.getElementById('share-url-text').textContent = fullUrl;
  document.getElementById('visit-url-link').href = fullUrl;
  document.getElementById('copy-url-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      const btn = document.getElementById('copy-url-btn');
      const original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => (btn.textContent = original), 1500);
    } catch {
      // clipboard indisponível; usuário pode copiar manualmente
    }
  });
}

function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function initLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await Api.post('/api/auth/logout');
    } finally {
      window.location.href = '/';
    }
  });
}

// --- Perfil ---
function initProfileForm(user) {
  document.getElementById('displayName').value = user.displayName || '';
  document.getElementById('bio').value = user.bio || '';
  document.getElementById('avatarUrl').value = user.avatarUrl || '';
  document.getElementById('theme').value = user.theme || 'default';

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      displayName: document.getElementById('displayName').value.trim(),
      bio: document.getElementById('bio').value.trim(),
      avatarUrl: document.getElementById('avatarUrl').value.trim(),
      theme: document.getElementById('theme').value,
    };
    try {
      await Api.put('/api/me/profile', payload);
      showAlert('profile-alert', 'Perfil atualizado com sucesso.', 'success');
    } catch (err) {
      showAlert('profile-alert', err.message);
    }
  });
}

// --- Links ---
async function initLinks() {
  const form = document.getElementById('link-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('link-title').value.trim();
    const url = document.getElementById('link-url').value.trim();
    try {
      await Api.post('/api/me/links', { title, url });
      document.getElementById('link-title').value = '';
      document.getElementById('link-url').value = '';
      showAlert('link-alert', 'Link adicionado.', 'success');
      await renderLinks();
    } catch (err) {
      showAlert('link-alert', err.message);
    }
  });

  await renderLinks();
}

async function renderLinks() {
  const { links } = await Api.get('/api/me/links');
  const container = document.getElementById('links-list');
  container.innerHTML = '';

  if (links.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum link ainda.</p>';
    return;
  }

  links.forEach((link) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="grow">
        <strong>${escapeHtml(link.title)}</strong>
        <span>${escapeHtml(link.url)}</span>
      </div>
      <div class="actions">
        <button class="secondary icon-only" data-action="edit">Editar</button>
        <button class="danger icon-only" data-action="delete">Excluir</button>
      </div>
    `;

    item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm('Excluir este link?')) return;
      try {
        await Api.del(`/api/me/links/${link.id}`);
        await renderLinks();
      } catch (err) {
        showAlert('link-alert', err.message);
      }
    });

    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
      item.innerHTML = `
        <div class="grow">
          <input type="text" class="edit-title mb-8" value="${escapeHtml(link.title)}" />
          <input type="url" class="edit-url" value="${escapeHtml(link.url)}" />
        </div>
        <div class="actions">
          <button data-action="save">Salvar</button>
          <button class="secondary" data-action="cancel">Cancelar</button>
        </div>
      `;
      item.querySelector('[data-action="cancel"]').addEventListener('click', renderLinks);
      item.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const title = item.querySelector('.edit-title').value.trim();
        const url = item.querySelector('.edit-url').value.trim();
        try {
          await Api.put(`/api/me/links/${link.id}`, { title, url });
          await renderLinks();
        } catch (err) {
          showAlert('link-alert', err.message);
        }
      });
    });

    container.appendChild(item);
  });
}

// --- Portfólio ---
async function initPortfolio() {
  const form = document.getElementById('portfolio-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('pf-title').value.trim(),
      description: document.getElementById('pf-description').value.trim(),
      url: document.getElementById('pf-url').value.trim(),
      imageUrl: document.getElementById('pf-image').value.trim(),
    };
    try {
      await Api.post('/api/me/portfolio', payload);
      form.reset();
      showAlert('portfolio-alert', 'Item adicionado.', 'success');
      await renderPortfolio();
    } catch (err) {
      showAlert('portfolio-alert', err.message);
    }
  });

  await renderPortfolio();
}

async function renderPortfolio() {
  const { items } = await Api.get('/api/me/portfolio');
  const container = document.getElementById('portfolio-list');
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum item de portfólio ainda.</p>';
    return;
  }

  items.forEach((pfItem) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="grow">
        <strong>${escapeHtml(pfItem.title)}</strong>
        <span>${escapeHtml(pfItem.description || pfItem.url || '')}</span>
      </div>
      <div class="actions">
        <button class="danger icon-only" data-action="delete">Excluir</button>
      </div>
    `;
    item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm('Excluir este item do portfólio?')) return;
      try {
        await Api.del(`/api/me/portfolio/${pfItem.id}`);
        await renderPortfolio();
      } catch (err) {
        showAlert('portfolio-alert', err.message);
      }
    });
    container.appendChild(item);
  });
}
