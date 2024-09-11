async function checkAuthentication (req, res, next) {
  if (!req.session.userId) return res.redirect("/oauth/Not Authenticated!");
  return next();
}

export default checkAuthentication;