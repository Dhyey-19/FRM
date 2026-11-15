const path = require('path');
const { getDatabase } = require('../config/db');

const primaryDb = path.join(__dirname, 'FRM-BBP.db');
const legacyDb = path.join(__dirname, 'factoryflow.db');
const DB_PATH = fs.existsSync(primaryDb) ? primaryDb : (fs.existsSync(legacyDb) ? legacyDb : primaryDb);

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


