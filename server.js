require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const db = require('./src/db');
const { ensureCsrfToken, verifyCsrfToken } = require('./src/middleware/csrf');
const { apiLimiter } = require('./src/middleware/rateLimit');
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const publicRoutes = require('./src/routes/public');
const { isValidUsername } = require('./src/utils/validation');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
  console.error('ERRO: defina SESSION_SECRET (>=16 caracteres) no arquivo .env antes de iniciar.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERRO: defina DATABASE_URL (string de conexão do Postgres) no arquivo .env antes de iniciar.');
  process.exit(1);
}

if (isProd) {
  app.set('trust proxy', 1); // necessário para cookies "secure" atrás de proxy/load balancer
}

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

app.use(
  session({
    store: new PgSession({ pool: db.pool, tableName: 'session', createTableIfMissing: true }),
    name: 'mp.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(ensureCsrfToken);

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

app.use('/api', apiLimiter);
app.use('/api', verifyCsrfToken);
app.use('/api/auth', authRoutes);
app.use('/api/me', profileRoutes);
app.use('/api', publicRoutes);

// URL única da página pública: /u/<username>
app.get('/u/:username', (req, res, next) => {
  if (!isValidUsername(req.params.username)) return next();
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error(err);
  const message = status < 500 ? err.message : 'Erro interno do servidor.';
  res.status(status).json({ error: message || 'Requisição inválida.' });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('ERRO: não foi possível conectar ao banco de dados.', err);
    process.exit(1);
  });
