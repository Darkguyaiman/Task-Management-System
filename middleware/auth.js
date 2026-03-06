const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'You do not have access to this area.',
      error: null,
    });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
};

