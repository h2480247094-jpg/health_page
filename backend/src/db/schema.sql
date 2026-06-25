-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    api_key         TEXT DEFAULT '',
    gender          TEXT DEFAULT 'male' CHECK(gender IN ('male','female')),
    birthday        TEXT DEFAULT '2003-01-31',
    height_cm       INTEGER DEFAULT 172,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 每日健康记录
CREATE TABLE IF NOT EXISTS health_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            TEXT NOT NULL,
    weight          REAL,
    sleep           REAL DEFAULT 0,
    sleep_segments  TEXT DEFAULT '[]',
    bed_time        TEXT,
    wake_time       TEXT,
    diet            TEXT DEFAULT '[]',
    exercises       TEXT DEFAULT '[]',
    supplements     TEXT DEFAULT '[]',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_records_user_date ON health_records(user_id, date);

-- 护肤照片
CREATE TABLE IF NOT EXISTS skin_photos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            TEXT NOT NULL,
    photo_type      TEXT NOT NULL CHECK(photo_type IN ('left','front','right')),
    file_path       TEXT NOT NULL,
    thumbnail_path  TEXT,
    note            TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_user_date ON skin_photos(user_id, date);

-- AI 对话记录
CREATE TABLE IF NOT EXISTS chat_histories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_type       TEXT NOT NULL DEFAULT 'health' CHECK(chat_type IN ('health','skincare')),
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_user_type ON chat_histories(user_id, chat_type, created_at);

-- 补剂预设
CREATE TABLE IF NOT EXISTS supplement_presets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    dosage          REAL DEFAULT 1,
    unit            TEXT DEFAULT '粒',
    emoji           TEXT DEFAULT '💊',
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
);
