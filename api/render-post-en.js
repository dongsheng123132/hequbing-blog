// English is another route into the same rendering core.
const { handleRequest } = require('./render-post');
module.exports = (req, res) => handleRequest(req, res, 'en');
