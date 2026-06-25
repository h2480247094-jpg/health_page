const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const db = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const { upload, uploadDir } = require('../services/storage');

const router = express.Router();
router.use(authMiddleware);

// 上传照片
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择照片' });
    }

    const { date, photo_type, note } = req.body;
    if (!date || !photo_type) {
      return res.status(400).json({ error: '缺少日期或照片类型' });
    }

    const filePath = path.relative(path.resolve(uploadDir), req.file.path).replace(/\\/g, '/');

    // 生成缩略图
    const thumbFilename = 'thumb_' + req.file.filename;
    const thumbPath = path.join(req.file.destination, thumbFilename);
    await sharp(req.file.path)
      .resize(200, undefined, { fit: 'inside' })
      .jpeg({ quality: 70 })
      .toFile(thumbPath);

    const thumbnailRelPath = path.relative(path.resolve(uploadDir), thumbPath).replace(/\\/g, '/');

    const result = db.prepare(
      'INSERT INTO skin_photos (user_id, date, photo_type, file_path, thumbnail_path, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.userId, date, photo_type, filePath, thumbnailRelPath, note || '');

    const photo = db.prepare('SELECT * FROM skin_photos WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      id: photo.id,
      date: photo.date,
      photo_type: photo.photo_type,
      note: photo.note,
      thumbnail_url: `/uploads/${photo.thumbnail_path}`,
      photo_url: `/uploads/${photo.file_path}`,
      created_at: photo.created_at,
    });
  } catch (err) {
    console.error('上传照片失败:', err);
    res.status(500).json({ error: '上传失败' });
  }
});

// 获取照片列表
router.get('/', (req, res) => {
  try {
    const { date } = req.query;
    let photos;
    if (date) {
      photos = db.prepare(
        'SELECT * FROM skin_photos WHERE user_id = ? AND date = ? ORDER BY created_at DESC'
      ).all(req.userId, date);
    } else {
      photos = db.prepare(
        'SELECT * FROM skin_photos WHERE user_id = ? ORDER BY date DESC, created_at DESC'
      ).all(req.userId);
    }

    res.json(photos.map(p => ({
      id: p.id,
      date: p.date,
      photo_type: p.photo_type,
      note: p.note,
      thumbnail_url: `/uploads/${p.thumbnail_path}`,
      photo_url: `/uploads/${p.file_path}`,
      created_at: p.created_at,
    })));
  } catch (err) {
    console.error('获取照片失败:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

// 删除照片
router.delete('/:id', (req, res) => {
  try {
    const photo = db.prepare(
      'SELECT * FROM skin_photos WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.userId);

    if (!photo) {
      return res.status(404).json({ error: '照片不存在' });
    }

    // 删除文件
    const fullPath = path.join(path.resolve(uploadDir), photo.file_path);
    const fullThumbPath = path.join(path.resolve(uploadDir), photo.thumbnail_path);
    try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(fullThumbPath); } catch (e) { /* ignore */ }

    db.prepare('DELETE FROM skin_photos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('删除照片失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
