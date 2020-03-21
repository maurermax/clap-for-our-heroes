module.exports = function(req, res, next) {
    if (req.header("x-forwarded-proto") !== 'https') {
        return res.redirect("https://" + req.header('host') + req.url);
    }
    return next();
};