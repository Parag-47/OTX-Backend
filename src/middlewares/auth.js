async function checkAuthentication (req, res, next) {
  if (req.session.userId) return next();
  return res.redirect("/");
}

export default checkAuthentication;