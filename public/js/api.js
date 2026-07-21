// Helper central para chamadas à API: injeta o token CSRF e trata erros.
const Api = (() => {
  let csrfToken = null;

  async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function doFetch(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
      headers['X-CSRF-Token'] = await getCsrfToken();
    }
    return fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function request(method, url, body) {
    let res = await doFetch(method, url, body);

    // Login/registro/logout recriam a sessão no servidor, o que invalida o
    // token CSRF em cache no cliente. Se isso acontecer, renova e tenta 1x.
    if (res.status === 403 && method !== 'GET') {
      csrfToken = null;
      res = await doFetch(method, url, body);
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const message = (data && data.error) || `Erro (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  return {
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    del: (url) => request('DELETE', url),
  };
})();
