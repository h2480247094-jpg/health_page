require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'health_tracker_jwt_secret_default',
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads/photos',
  dbPath: process.env.DB_PATH || './data/health_tracker.db',
};
