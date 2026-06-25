const db = require('./pool');
const fs = require('fs');
const path = require('path');

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  try {
    db.exec(schema);
  } catch (err) {
    // 如果表已存在则忽略
    if (!err.message.includes('already exists')) {
      console.error('初始化数据表失败:', err.message);
    }
  }

  // 迁移：为已有 users 表添加 api_key 列（如果不存在）
  try {
    db.run("ALTER TABLE users ADD COLUMN api_key TEXT DEFAULT ''");
    console.log('✅ 数据库迁移：已添加 api_key 列');
  } catch (e) {
    // 列已存在则忽略
  }

  // 迁移：为已有 users 表添加 username 列（如果不存在）
  try {
    db.run("ALTER TABLE users ADD COLUMN username TEXT DEFAULT ''");
    console.log('✅ 数据库迁移：已添加 username 列');
  } catch (e) {
    // 列已存在则忽略
  }

  // 保存到磁盘
  db.save();
  console.log('✅ 数据表初始化完成');
}

module.exports = initSchema;
