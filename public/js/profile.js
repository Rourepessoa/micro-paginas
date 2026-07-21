function isSafeUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

(async () => {
  const root = document.getElementById('profile-root');
  const username = window.location.pathname.split('/').filter(Boolean).pop();

  let data;
  try {
    data = await Api.get(`/api/u/${encodeURIComponent(username)}`);
  } catch {
    root.innerHTML = '<h1>Página não encontrada</h1><p class="muted">Este usuário não existe.</p>';
    return;
  }

  const { profile, links, portfolio } = data;

  if (profile.theme && profile.theme !== 'default') {
    document.body.classList.add(`theme-${profile.theme}`);
  }

  document.title = `${profile.displayName || profile.username} — MicroPáginas`;

  root.innerHTML = '';

  if (profile.avatarUrl && isSafeUrl(profile.avatarUrl)) {
    const img = document.createElement('img');
    img.className = 'profile-avatar';
    img.src = profile.avatarUrl;
    img.alt = profile.displayName || profile.username;
    img.referrerPolicy = 'no-referrer';
    root.appendChild(img);
  }

  const name = document.createElement('div');
  name.className = 'profile-name';
  name.textContent = profile.displayName || profile.username;
  root.appendChild(name);

  const handle = document.createElement('div');
  handle.className = 'profile-username';
  handle.textContent = `@${profile.username}`;
  root.appendChild(handle);

  if (profile.bio) {
    const bio = document.createElement('p');
    bio.className = 'profile-bio';
    bio.textContent = profile.bio;
    root.appendChild(bio);
  }

  const linksWrap = document.createElement('div');
  links.forEach((link) => {
    if (!isSafeUrl(link.url)) return;
    const a = document.createElement('a');
    a.className = 'profile-link';
    a.href = link.url;
    a.textContent = link.title;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    linksWrap.appendChild(a);
  });
  root.appendChild(linksWrap);

  if (portfolio.length > 0) {
    const section = document.createElement('div');
    section.className = 'portfolio-section';

    const heading = document.createElement('h2');
    heading.textContent = 'Portfólio';
    section.appendChild(heading);

    portfolio.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'portfolio-item';

      if (item.image_url && isSafeUrl(item.image_url)) {
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.title;
        img.referrerPolicy = 'no-referrer';
        card.appendChild(img);
      }

      const body = document.createElement('div');
      body.className = 'body';

      const title = document.createElement('h3');
      title.textContent = item.title;
      body.appendChild(title);

      if (item.description) {
        const desc = document.createElement('p');
        desc.textContent = item.description;
        body.appendChild(desc);
      }

      if (item.url && isSafeUrl(item.url)) {
        const link = document.createElement('a');
        link.href = item.url;
        link.textContent = 'Ver projeto →';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        body.appendChild(link);
      }

      card.appendChild(body);
      section.appendChild(card);
    });

    root.appendChild(section);
  }

  const footer = document.createElement('div');
  footer.className = 'footer-note';
  footer.innerHTML = 'Feito com <a href="/">MicroPáginas</a>';
  root.appendChild(footer);
})();
