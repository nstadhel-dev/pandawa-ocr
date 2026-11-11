-- LANGKAH 2: Cek tabel sudah kebuat (jalankan setelah Langkah 1)
SELECT 'users' AS tabel, COUNT(*) AS jumlah FROM users
UNION ALL SELECT 'nota', COUNT(*) FROM nota
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'settings', COUNT(*) FROM settings
UNION ALL SELECT 'gabungan', COUNT(*) FROM gabungan;
