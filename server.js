const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const pool = require('./config/db');
const indexRoutes = require('./routes/indexRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
})();