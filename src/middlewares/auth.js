async function checkAuthentication (req, res, next) {
  if (!req.session.userId) return res.redirect("/");
  return next();
}

export default checkAuthentication;