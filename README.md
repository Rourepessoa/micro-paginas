# MicroPáginas

Plataforma "link na bio": cada usuário cria uma conta, edita seu perfil, links e um
mini portfólio, e recebe uma URL única (`/u/seunome`) para compartilhar.

Stack: Node.js + Express no back-end (JavaScript puro), HTML/CSS/JS puro no
front-end (sem frameworks), banco SQLite embutido (`node:sqlite`, nativo do
Node — sem dependências de compilação).

## Rodando localmente

```bash
npm install
npm start
```

Acesse http://localhost:3000

Para desenvolvimento com reinício automático ao salvar arquivos:

```bash
npm run dev
```

O arquivo `.env` já foi criado com um `SESSION_SECRET` aleatório. Se precisar
recriar, copie `.env.example` e gere um novo valor aleatório longo.

## Estrutura

```
server.js              # entrada do servidor Express, segurança (helmet, sessão, CSP)
src/
  db.js                 # schema SQLite (users, links, portfolio_items)
  middleware/
    auth.js              # exige sessão autenticada
    csrf.js               # proteção CSRF (double-submit token)
    rateLimit.js          # limites de requisição
  routes/
    auth.js               # registro, login, logout, /me, verificação de email
    profile.js             # CRUD de perfil, links e portfólio (autenticado)
    public.js              # dados públicos de /u/:username, checagem de username
  utils/
    validation.js          # validação de username, email, senha, URLs
    mailer.js               # envio do email de verificação (nodemailer/SMTP)
public/
  index.html, login.html, register.html, dashboard.html, profile.html,
  verify-email.html, 404.html
  css/style.css
  js/                     # api.js (helper fetch+CSRF) e um script por página
```

## Segurança implementada

- Senhas com hash `bcrypt` (12 rounds), nunca armazenadas em texto puro.
- Sessão via cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção.
- Proteção CSRF (token de sessão comparado a header customizado) em todas as
  rotas que alteram dados.
- Rate limiting: tentativas de login/registro e chamadas de API em geral.
- Bloqueio temporário de conta após várias tentativas de senha incorretas.
- Content-Security-Policy estrita via `helmet` (sem scripts/estilos inline).
- Validação de entrada no servidor: username, email, senha, e URLs (apenas
  `http`/`https`, prevenindo esquemas como `javascript:`).
- Consultas SQL sempre parametrizadas (sem concatenação de strings).
- Conteúdo gerado pelo usuário é inserido no DOM via `textContent`/atributos
  seguros, nunca via HTML bruto — previne XSS na página pública.
- Mensagens de erro de login genéricas (não revelam se o email existe).

## Verificação de email

Ao se cadastrar, o usuário recebe um email (via Gmail SMTP + senha de app)
com um link de verificação válido por 24h. Enquanto não verificado, o
painel mostra um aviso com opção de reenviar o email. Configure
`SMTP_USER`/`SMTP_PASS` no `.env` com uma [senha de
app](https://myaccount.google.com/apppasswords) do Gmail — sem isso, o link
de verificação é apenas impresso no console do servidor (modo dev).

## O que falta para produção

- **HTTPS**: rodar atrás de um proxy reverso (nginx, Caddy) ou plataforma que
  já cuide de TLS (Render, Railway, Fly.io) — o cookie de sessão só fica
  `Secure` quando `NODE_ENV=production`.
- **Upload de imagem**: hoje avatar e imagens do portfólio são apenas URLs
  externas; um upload de arquivo próprio exigiria armazenamento (S3, etc.).
- **Backups do arquivo `data/app.sqlite`** em produção.
