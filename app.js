// GoDaddy / cPanel Node.js application entry point
const { startServer, app } = require('./backend/server');

startServer();

module.exports = app;
