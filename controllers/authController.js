const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const getLogin = (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }

  res.render('auth/login', {
    title: 'Login',
    formError: null,
    oldInput: { email: '' },
  });
};

const postLogin = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render('auth/login', {
      title: 'Login',
      formError: 'Email and password are required.',
      oldInput: { email: email || '' },
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, password, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(400).render('auth/login', {
        title: 'Login',
        formError: 'Invalid email or password.',
        oldInput: { email },
      });
    }

    const user = rows[0];

    if (!user.password) {
      return res.status(400).render('auth/login', {
        title: 'Login',
        formError: 'No password set for this account. Contact an administrator.',
        oldInput: { email },
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).render('auth/login', {
        title: 'Login',
        formError: 'Invalid email or password.',
        oldInput: { email },
      });
    }

    req.session.regenerate((regenError) => {
      if (regenError) {
        return next(regenError);
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'staff',
      };

      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }
        return res.redirect('/');
      });
    });
  } catch (error) {
    next(error);
  }
};

const postLogout = (req, res, next) => {
  if (req.session) {
    req.session.destroy((error) => {
      if (error) {
        return next(error);
      }
      res.clearCookie(process.env.SESSION_COOKIE_NAME || 'sid');
      return res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
};

module.exports = {
  getLogin,
  postLogin,
  postLogout,
};
