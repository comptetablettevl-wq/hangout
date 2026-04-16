const { Sequelize } = require('sequelize');
const { db: cfg } = require('./config');

const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host:    cfg.host,
  port:    cfg.port,
  dialect: cfg.dialect,
  logging: cfg.logging,
  pool:    cfg.pool,
  define:  cfg.define,
});

module.exports = sequelize;
