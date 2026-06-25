const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 确保上传目录存在
const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 按用户分目录
    const userDir = path.join(uploadDir, String(req.userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const type = req.body.photo_type || 'front';
    const uuid = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${date}_${type}_${uuid}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/WebP/HEIC 格式'));
    }
  },
});

module.exports = { upload, uploadDir };
