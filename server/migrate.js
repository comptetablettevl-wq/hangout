/**
 * Migration one-shot : sync tables + index MySQL
 * node server/migrate.js
 */
require('dotenv').config();
const { sequelize } = require('./models');
const { applyIndexes } = require('./models/indexes');

(async () => {
  try {
    console.log('[Migrate] Connexion...');
    await sequelize.authenticate();

    console.log('[Migrate] Synchronisation des tables...');
    await sequelize.sync({ alter: true });

    console.log('[Migrate] Application des index...');
    await applyIndexes();

    console.log('[Migrate] ✅ Terminé');
    process.exit(0);
  } catch (err) {
    console.error('[Migrate] ❌', err.message);
    process.exit(1);
  }
})();
