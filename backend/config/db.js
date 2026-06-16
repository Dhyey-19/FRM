const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true, // For Azure SQL
    trustServerCertificate: false
  }
};

let poolPromise = null;

const connectDB = async () => {
  try {
    if (!poolPromise) {
      poolPromise = sql.connect(config).then(pool => {
        console.log('Connected to Azure SQL Database');
        return pool;
      }).catch(err => {
        console.error('Database Connection Failed!', err);
        poolPromise = null;
        throw err;
      });
    }
    return await poolPromise;
  } catch (err) {
    console.error('Error getting DB connection:', err);
    throw err;
  }
};

module.exports = {
  sql,
  connectDB,
  config
};
