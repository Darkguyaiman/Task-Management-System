const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const pool = require('./config/db');
const indexRoutes = require('./routes/indexRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 24 * 60 * 60 * 1000);

if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: Number(process.env.SESSION_CHECK_EXPIRATION_INTERVAL_MS || 15 * 60 * 1000),
    expiration: sessionMaxAgeMs,
    createDatabaseTable: false,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  pool
);

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || 'sid',
    secret: process.env.SESSION_SECRET || 'change-me-in-env',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      secure: isProduction ? 'auto' : false,
      sameSite: 'lax',
      maxAge: sessionMaxAgeMs,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session ? req.session.user : null;
  res.locals.currentPath = req.path;
  next();
});

app.use(authRoutes);
app.use('/', indexRoutes);
app.use('/users', userRoutes);
app.use('/tasks', taskRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', error: null });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err : null });
});

(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    await pool.seedAdmin();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
})();

let isShuttingDown = false;

const closeSessionStore = async (signal) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  try {
    await sessionStore.close();
  } catch (error) {
    console.error('Failed to close session store:', error);
  } finally {
    if (signal) {
      process.exit(0);
    }
  }
};

process.on('SIGINT', () => {
  closeSessionStore('SIGINT');
});

process.on('SIGTERM', () => {
  closeSessionStore('SIGTERM');
});
