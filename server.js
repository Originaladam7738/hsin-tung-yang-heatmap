const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// 中介軟體
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// 資料庫連線池
let pool = null;
let currentTableName = 'entry_exit_records';

// 連接資料庫 API
app.post('/api/connect', async (req, res) => {
    try {
        const { host, database, user, password, table } = req.body;

        // 建立連線池
        pool = mysql.createPool({
            host: host,
            user: user,
            password: password,
            database: database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // 測試連線
        const connection = await pool.getConnection();

        // 檢查資料表是否存在
        const [tables] = await connection.query(
            'SHOW TABLES LIKE ?',
            [table]
        );

        if (tables.length === 0) {
            connection.release();
            return res.json({
                success: false,
                message: `資料表 "${table}" 不存在`
            });
        }

        // 檢查資料表結構
        const [columns] = await connection.query(
            'SHOW COLUMNS FROM ??',
            [table]
        );

        const columnNames = columns.map(col => col.Field.toLowerCase());
        const requiredColumns = ['時間', '地區', '狀態'];
        const missingColumns = [];

        // 檢查必要欄位（不分大小寫）
        requiredColumns.forEach(reqCol => {
            const found = columns.some(col =>
                col.Field === reqCol || col.Field.toLowerCase() === reqCol.toLowerCase()
            );
            if (!found) {
                missingColumns.push(reqCol);
            }
        });

        connection.release();

        if (missingColumns.length > 0) {
            return res.json({
                success: false,
                message: `資料表缺少必要欄位：${missingColumns.join(', ')}`
            });
        }

        currentTableName = table;

        res.json({
            success: true,
            message: '資料庫連接成功',
            columns: columns.map(col => col.Field)
        });

    } catch (error) {
        console.error('資料庫連接錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 取得熱力圖資料 API
app.post('/api/heatmap', async (req, res) => {
    try {
        if (!pool) {
            return res.json({
                success: false,
                message: '請先連接資料庫'
            });
        }

        const { regions, startTime, endTime } = req.body;

        if (!regions || regions.length === 0) {
            return res.json({
                success: false,
                message: '請至少選擇一個區域'
            });
        }

        if (!startTime || !endTime) {
            return res.json({
                success: false,
                message: '請選擇時間區間'
            });
        }

        // 建立查詢
        const placeholders = regions.map(() => '?').join(',');
        const query = `
            SELECT 時間, 地區, 狀態
            FROM ??
            WHERE 地區 IN (${placeholders})
            AND 時間 BETWEEN ? AND ?
            ORDER BY 時間
        `;

        const params = [currentTableName, ...regions, startTime, endTime];

        const [rows] = await pool.query(query, params);

        // 轉換資料格式
        const records = rows.map(row => ({
            time: row['時間'],
            region: row['地區'],
            status: row['狀態']
        }));

        res.json({
            success: true,
            records: records,
            summary: {
                totalRecords: records.length,
                regions: regions,
                timeRange: {
                    start: startTime,
                    end: endTime
                }
            }
        });

    } catch (error) {
        console.error('查詢錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 取得資料統計 API
app.post('/api/statistics', async (req, res) => {
    try {
        if (!pool) {
            return res.json({
                success: false,
                message: '請先連接資料庫'
            });
        }

        const { regions, startTime, endTime } = req.body;

        const placeholders = regions.map(() => '?').join(',');
        const query = `
            SELECT
                地區,
                狀態,
                COUNT(*) as count
            FROM ??
            WHERE 地區 IN (${placeholders})
            AND 時間 BETWEEN ? AND ?
            GROUP BY 地區, 狀態
        `;

        const params = [currentTableName, ...regions, startTime, endTime];
        const [rows] = await pool.query(query, params);

        const statistics = {};
        rows.forEach(row => {
            const region = row['地區'];
            if (!statistics[region]) {
                statistics[region] = {
                    進: 0,
                    出: 0,
                    total: 0
                };
            }
            const status = row['狀態'];
            const count = parseInt(row.count);
            statistics[region][status] = count;
            statistics[region].total += count;
        });

        res.json({
            success: true,
            statistics: statistics
        });

    } catch (error) {
        console.error('統計錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
    console.log('熱力圖系統已啟動！');
});

// 優雅關閉
process.on('SIGINT', async () => {
    console.log('\n正在關閉伺服器...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});
