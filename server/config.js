require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'hangout_dev_secret_change_in_production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  jwtExpiry: '7d',
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  db: {
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'hangout',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    dialect:  'mysql',
    logging:  false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: true, timestamps: true },
  },
};
