-- 建立資料庫
CREATE DATABASE IF NOT EXISTS heatmap_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE heatmap_db;

-- 建立資料表
CREATE TABLE IF NOT EXISTS entry_exit_records (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主鍵',
    時間 DATETIME NOT NULL COMMENT '進出時間',
    地區 VARCHAR(100) NOT NULL COMMENT '區域名稱',
    狀態 ENUM('進', '出') NOT NULL COMMENT '進或出',
    備註 VARCHAR(255) DEFAULT NULL COMMENT '備註',
    建立時間 TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '記錄建立時間',
    INDEX idx_time (時間),
    INDEX idx_region (地區),
    INDEX idx_status (狀態),
    INDEX idx_time_region (時間, 地區)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='進出記錄表';

-- 插入測試資料
INSERT INTO entry_exit_records (時間, 地區, 狀態, 備註) VALUES
-- A區資料（高流量）
('2024-01-15 09:00:00', 'A區', '進', '早班開始'),
('2024-01-15 09:05:00', 'A區', '進', NULL),
('2024-01-15 09:10:00', 'A區', '進', NULL),
('2024-01-15 09:15:00', 'A區', '出', NULL),
('2024-01-15 09:20:00', 'A區', '進', NULL),
('2024-01-15 09:25:00', 'A區', '進', NULL),
('2024-01-15 09:30:00', 'A區', '出', NULL),
('2024-01-15 09:35:00', 'A區', '進', NULL),
('2024-01-15 09:40:00', 'A區', '進', NULL),
('2024-01-15 09:45:00', 'A區', '出', NULL),
('2024-01-15 09:50:00', 'A區', '進', NULL),
('2024-01-15 09:55:00', 'A區', '進', NULL),
('2024-01-15 10:00:00', 'A區', '出', NULL),
('2024-01-15 10:05:00', 'A區', '進', NULL),
('2024-01-15 10:10:00', 'A區', '出', NULL),

-- B區資料（中流量）
('2024-01-15 09:00:00', 'B區', '進', NULL),
('2024-01-15 09:10:00', 'B區', '出', NULL),
('2024-01-15 09:20:00', 'B區', '進', NULL),
('2024-01-15 09:30:00', 'B區', '進', NULL),
('2024-01-15 09:40:00', 'B區', '出', NULL),
('2024-01-15 09:50:00', 'B區', '進', NULL),
('2024-01-15 10:00:00', 'B區', '出', NULL),
('2024-01-15 10:10:00', 'B區', '進', NULL),

-- C區資料（低流量）
('2024-01-15 09:00:00', 'C區', '進', NULL),
('2024-01-15 09:30:00', 'C區', '出', NULL),
('2024-01-15 10:00:00', 'C區', '進', NULL),
('2024-01-15 10:30:00', 'C區', '出', NULL),

-- D區資料（中流量）
('2024-01-15 09:05:00', 'D區', '進', NULL),
('2024-01-15 09:15:00', 'D區', '出', NULL),
('2024-01-15 09:25:00', 'D區', '進', NULL),
('2024-01-15 09:35:00', 'D區', '進', NULL),
('2024-01-15 09:45:00', 'D區', '出', NULL),
('2024-01-15 09:55:00', 'D區', '進', NULL),
('2024-01-15 10:05:00', 'D區', '出', NULL),

-- 下午時段資料
('2024-01-15 14:00:00', 'A區', '進', '午休結束'),
('2024-01-15 14:05:00', 'A區', '進', NULL),
('2024-01-15 14:10:00', 'A區', '進', NULL),
('2024-01-15 14:15:00', 'A區', '進', NULL),
('2024-01-15 14:20:00', 'B區', '進', NULL),
('2024-01-15 14:25:00', 'B區', '進', NULL),
('2024-01-15 14:30:00', 'C區', '進', NULL),
('2024-01-15 14:35:00', 'D區', '進', NULL),
('2024-01-15 14:40:00', 'A區', '出', NULL),
('2024-01-15 14:45:00', 'A區', '出', NULL),
('2024-01-15 14:50:00', 'B區', '出', NULL),
('2024-01-15 14:55:00', 'C區', '出', NULL),
('2024-01-15 15:00:00', 'D區', '出', NULL),

-- 下班時段資料
('2024-01-15 18:00:00', 'A區', '出', '下班時間'),
('2024-01-15 18:05:00', 'A區', '出', NULL),
('2024-01-15 18:10:00', 'A區', '出', NULL),
('2024-01-15 18:15:00', 'B區', '出', NULL),
('2024-01-15 18:20:00', 'B區', '出', NULL),
('2024-01-15 18:25:00', 'C區', '出', NULL),
('2024-01-15 18:30:00', 'D區', '出', NULL),
('2024-01-15 18:35:00', 'A區', '出', NULL);

-- 查詢統計
SELECT '總記錄數' as 項目, COUNT(*) as 數量 FROM entry_exit_records
UNION ALL
SELECT '時間範圍', CONCAT(MIN(時間), ' ~ ', MAX(時間)) FROM entry_exit_records
UNION ALL
SELECT '區域數量', COUNT(DISTINCT 地區) FROM entry_exit_records;

-- 各區域統計
SELECT
    地區,
    COUNT(*) as 總次數,
    SUM(CASE WHEN 狀態 = '進' THEN 1 ELSE 0 END) as 進入次數,
    SUM(CASE WHEN 狀態 = '出' THEN 1 ELSE 0 END) as 離開次數
FROM entry_exit_records
GROUP BY 地區
ORDER BY 總次數 DESC;

-- 時段統計
SELECT
    DATE_FORMAT(時間, '%H:00') as 時段,
    COUNT(*) as 次數
FROM entry_exit_records
GROUP BY DATE_FORMAT(時間, '%H:00')
ORDER BY 時段;
