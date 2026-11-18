/**
 * Lightweight database migrator stub for GoDaddy / SQLite production.
 * All schema changes, tables, and seed data are already permanently baked into FRM-BBP.db.
 */
async function runSQLiteMigrations() {}
async function runMssqlMigrations() {}
async function autoHealMssqlSchema() {}
async function autoHealSQLiteSchema() {}

module.exports = {
  runMigrations: runSQLiteMigrations,
  runSQLiteMigrations,
  runMssqlMigrations,
  autoHealMssqlSchema,
  autoHealSQLiteSchema
};
