const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let _wrapper = null;
let _filePath = null;
let _saveTimer = null;
let _dirtySince = null;

// 延迟保存：写入操作后等 2 秒，期间有新的写入则重置计时器
function scheduleSave() {
  _dirtySince = _dirtySince || Date.now();
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    if (_wrapper && _dirtySince) {
      _wrapper.save();
      console.log('💾 数据库已保存到磁盘');
      _dirtySince = null;
    }
  }, 2000);
}

// ====== DatabaseWrapper ======

class DatabaseWrapper {
  constructor(sqlDb, filePath) {
    this.sqlDb = sqlDb;
    this.filePath = filePath;
  }

  exec(sql) { return this.sqlDb.exec(sql); }

  run(sql, params = []) {
    this.sqlDb.run(sql, params);
    const s = this.sqlDb.prepare('SELECT last_insert_rowid() as id');
    let lastId = 0;
    if (s.step()) lastId = s.getAsObject().id;
    s.free();
    scheduleSave();
    return { changes: this.sqlDb.getRowsModified(), lastInsertRowid: lastId };
  }

  prepare(sql) { return new Stmt(this.sqlDb, sql); }

  transaction(fn) {
    return (...args) => {
      this.run('BEGIN');
      try { const r = fn(...args); this.run('COMMIT'); return r; }
      catch (e) { this.run('ROLLBACK'); throw e; }
    };
  }

  pragma(cmd) { this.sqlDb.run(`PRAGMA ${cmd}`); }

  save() {
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, Buffer.from(this.sqlDb.export()));
  }
}

class Stmt {
  constructor(sqlDb, sql) { this.db = sqlDb; this.sql = sql; }

  _bind(stmt, params) {
    if (params.length > 0) {
      const p = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
      stmt.bind(p);
    }
  }

  get(...params) {
    const s = this.db.prepare(this.sql);
    this._bind(s, params);
    let r; if (s.step()) r = s.getAsObject();
    s.free(); return r;
  }

  all(...params) {
    const s = this.db.prepare(this.sql);
    this._bind(s, params);
    const rows = []; while (s.step()) rows.push(s.getAsObject());
    s.free(); return rows;
  }

  run(...params) {
    const p = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
    p.length > 0 ? this.db.run(this.sql, p) : this.db.run(this.sql);
    const s = this.db.prepare('SELECT last_insert_rowid() as id');
    let lastId = 0; if (s.step()) lastId = s.getAsObject().id;
    s.free();
    scheduleSave();
    return { changes: this.db.getRowsModified(), lastInsertRowid: lastId };
  }
}

// ====== 初始化 ======

async function initDB() {
  if (_wrapper) return _wrapper;

  _filePath = path.resolve(config.dbPath);
  const dir = path.dirname(_filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(_filePath)) {
    sqlDb = new SQL.Database(fs.readFileSync(_filePath));
  } else {
    sqlDb = new SQL.Database();
  }

  _wrapper = new DatabaseWrapper(sqlDb, _filePath);
  _wrapper.pragma('journal_mode=WAL');
  _wrapper.pragma('foreign_keys=ON');

  // 每 30 秒自动保存（安全网）
  setInterval(() => {
    if (_wrapper && _dirtySince) {
      _wrapper.save();
      console.log('💾 数据库定时保存');
      _dirtySince = null;
    }
  }, 30000);

  // 进程退出时保存
  const shutdown = () => {
    if (_wrapper && _dirtySince) {
      _wrapper.save();
      console.log('💾 数据库退出保存');
    }
    process.exit();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return _wrapper;
}

// ====== 导出：直接转发到 _wrapper ======

module.exports = {
  initDB,

  get exec() { return (...a) => _wrapper.exec(...a); },
  get run() { return (...a) => _wrapper.run(...a); },
  get prepare() { return (...a) => _wrapper.prepare(...a); },
  get transaction() { return (...a) => _wrapper.transaction(...a); },
  get pragma() { return (...a) => _wrapper.pragma(...a); },

  save() { if (_wrapper) _wrapper.save(); },
  get sqlDb() { return _wrapper ? _wrapper.sqlDb : null; },
};
