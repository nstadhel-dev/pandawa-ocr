-- LANGKAH 1: Buat 5 tabel + admin (jalankan file ini dulu di D1 Studio > Query > Run)
-- Pilih SEMUA teks (Ctrl+A) lalu klik Run.
CREATE TABLE IF NOT EXISTS nota (id TEXT PRIMARY KEY, no_nota TEXT, tanggal TEXT, nama_kapal TEXT, feature_type TEXT, data TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT, salt TEXT, role TEXT, nama TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT, role TEXT, expires_at INTEGER, created_at INTEGER);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS gabungan (id TEXT PRIMARY KEY, data TEXT, created_at INTEGER);
INSERT OR IGNORE INTO users (username, password_hash, salt, role, nama, created_at) VALUES ('admin', 'ff0a447b5500e90ff20d08f9826345e6d8f418ef98ee618549232482a65e91f1', '6215722dd34a66abcdc8e633430df3d1', 'admin', 'Administrator', 1762860000000);
