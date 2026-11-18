const path = require('path');
const { getDatabase } = require('../config/db');

const DB_PATH = path.join(__dirname, 'FRM-BBP.db');

/**
 * Returns a singleton connection to the local SQLite database.
 */
async function getLocalDB() {
  return await getDatabase();
}

module.exports = {
  getLocalDB,
  DB_PATH
};


