const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// 中介軟體
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// PostgreSQL 連線池
let pool = null;

// 預設資料庫配置（新東陽專案）
const defaultDbConfig = {
    host: 'iseekbidbstaging.intemotech.com',
    port: 5404,
    database: 'postgresdb',
    user: 'hsintungyang',
    password: 'G7pL2vX9',
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// 連接資料庫 API
app.post('/api/connect', async (req, res) => {
    try {
        const { host, port, database, user, password } = req.body;

        // 使用提供的配置或預設配置
        const dbConfig = {
            host: host || defaultDbConfig.host,
            port: port || defaultDbConfig.port,
            database: database || defaultDbConfig.database,
            user: user || defaultDbConfig.user,
            password: password || defaultDbConfig.password,
            ssl: false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        // 建立連線池
        pool = new Pool(dbConfig);

        // 測試連線
        const client = await pool.connect();

        // 檢查必要的表是否存在
        const tableCheck = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('v_store_analysis', 'v_area')
        `);

        const tables = tableCheck.rows.map(row => row.table_name);

        client.release();

        if (!tables.includes('v_store_analysis')) {
            return res.json({
                success: false,
                message: '找不到 v_store_analysis 表'
            });
        }

        if (!tables.includes('v_area')) {
            return res.json({
                success: false,
                message: '找不到 v_area 表'
            });
        }

        res.json({
            success: true,
            message: '資料庫連接成功',
            tables: tables
        });

    } catch (error) {
        console.error('資料庫連接錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 取得所有區域列表 API
app.get('/api/areas', async (req, res) => {
    try {
        if (!pool) {
            return res.json({
                success: false,
                message: '請先連接資料庫'
            });
        }

        const result = await pool.query(`
            SELECT DISTINCT area_id, area_name, area_number
            FROM v_area
            WHERE area_name IS NOT NULL
            ORDER BY area_id
        `);

        res.json({
            success: true,
            areas: result.rows
        });

    } catch (error) {
        console.error('查詢錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 取得熱力圖資料 API（基於容留時間）
app.post('/api/heatmap', async (req, res) => {
    try {
        if (!pool) {
            return res.json({
                success: false,
                message: '請先連接資料庫'
            });
        }

        const { areaIds, startTime, endTime, minDurationSeconds = 0, maxDurationSeconds = 999999 } = req.body;

        if (!areaIds || areaIds.length === 0) {
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

        console.log(`熱力圖查詢：${areaIds.length} 個區域，時間：${startTime} ~ ${endTime}，停留時間範圍：${minDurationSeconds} ~ ${maxDurationSeconds} 秒`);

        // 查詢容留時間資料
        // 使用 COUNT(DISTINCT reid) 計算不重複人數，避免同一人多次進出被重複計算
        const query = `
            SELECT
                sa.area_id,
                a.area_name,
                a.area_number,
                COUNT(DISTINCT sa.reid) as visit_count,
                SUM(EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time))) as total_duration_seconds,
                AVG(EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time))) as avg_duration_seconds
            FROM v_store_analysis sa
            JOIN v_area a ON sa.area_id = a.area_id
            WHERE sa.area_id = ANY($1)
            AND sa.enter_time >= $2
            AND sa.enter_time < $3
            AND sa.exit_time > sa.enter_time
            AND EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) > $4
            AND EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) < $5
            GROUP BY sa.area_id, a.area_name, a.area_number
            ORDER BY total_duration_seconds DESC
        `;

        const result = await pool.query(query, [areaIds, startTime, endTime, minDurationSeconds, maxDurationSeconds]);

        // 轉換資料格式
        const heatmapData = result.rows.map(row => ({
            areaId: row.area_id,
            areaName: row.area_name,
            areaNumber: row.area_number,
            visitCount: parseInt(row.visit_count),
            totalDurationSeconds: parseFloat(row.total_duration_seconds) || 0,
            avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0,
            totalDurationMinutes: (parseFloat(row.total_duration_seconds) || 0) / 60,
            avgDurationMinutes: (parseFloat(row.avg_duration_seconds) || 0) / 60
        }));

        res.json({
            success: true,
            data: heatmapData,
            summary: {
                totalAreas: heatmapData.length,
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

// 取得區域詳細統計 API
app.post('/api/statistics', async (req, res) => {
    try {
        if (!pool) {
            return res.json({
                success: false,
                message: '請先連接資料庫'
            });
        }

        const { areaIds, startTime, endTime, minDurationSeconds = 0, maxDurationSeconds = 999999 } = req.body;

        console.log(`統計查詢：${areaIds.length} 個區域，時間：${startTime} ~ ${endTime}，停留時間範圍：${minDurationSeconds} ~ ${maxDurationSeconds} 秒`);

        // 查詢詳細統計，並過濾掉停留時間過短或過長的記錄
        // 使用與另一個軟體一致的查詢邏輯
        const query = `
            SELECT
                sa.area_id,
                a.area_name,
                a.area_number,
                sa.reid,
                sa.enter_time,
                sa.exit_time,
                EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) as duration_seconds
            FROM v_store_analysis sa
            JOIN v_area a ON sa.area_id = a.area_id
            WHERE sa.area_id = ANY($1)
            AND sa.enter_time >= $2
            AND sa.enter_time < $3
            AND sa.exit_time > sa.enter_time
            AND EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) > $4
            AND EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) < $5
            ORDER BY sa.enter_time
        `;

        const result = await pool.query(query, [areaIds, startTime, endTime, minDurationSeconds, maxDurationSeconds]);

        const records = result.rows.map(row => ({
            areaId: row.area_id,
            areaName: row.area_name,
            areaNumber: row.area_number,
            personId: row.reid,
            enterTime: row.enter_time,
            exitTime: row.exit_time,
            durationSeconds: parseFloat(row.duration_seconds),
            durationMinutes: parseFloat(row.duration_seconds) / 60
        }));

        res.json({
            success: true,
            records: records,
            summary: {
                totalRecords: records.length
            }
        });

    } catch (error) {
        console.error('統計錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 測試查詢 API - 用於驗證數據
app.post('/api/test-query', async (req, res) => {
    try {
        if (!pool) {
            pool = new Pool(defaultDbConfig);
        }

        const { areaName, startTime, endTime, minDurationSeconds = 15, maxDurationSeconds = 3600 } = req.body;

        console.log('=== 測試查詢 ===');
        console.log(`區域名稱: ${areaName}`);
        console.log(`時間範圍: ${startTime} ~ ${endTime}`);
        console.log(`停留時間範圍: ${minDurationSeconds} ~ ${maxDurationSeconds} 秒`);

        // 先查詢區域ID
        const areaQuery = `
            SELECT area_id, area_name, area_number
            FROM v_area
            WHERE area_name = $1
        `;
        const areaResult = await pool.query(areaQuery, [areaName]);

        if (areaResult.rows.length === 0) {
            return res.json({
                success: false,
                message: `找不到區域: ${areaName}`
            });
        }

        const areaIds = areaResult.rows.map(row => row.area_id);
        console.log(`找到 ${areaIds.length} 個 area_id:`, areaIds);

        // 查詢數據
        const dataQuery = `
            SELECT
                sa.area_id,
                a.area_name,
                sa.reid,
                sa.enter_time,
                sa.exit_time,
                EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) as duration_seconds
            FROM v_store_analysis sa
            JOIN v_area a ON sa.area_id = a.area_id
            WHERE sa.area_id = ANY($1)
            AND sa.enter_time >= $2
            AND sa.exit_time <= $3
            AND sa.exit_time > sa.enter_time
            AND EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) >= $4
            AND EXTRACT(EPOCH FROM (sa.exit_time - sa.enter_time)) <= $5
            ORDER BY sa.enter_time
        `;

        const dataResult = await pool.query(dataQuery, [areaIds, startTime, endTime, minDurationSeconds, maxDurationSeconds]);

        console.log(`查詢到 ${dataResult.rows.length} 筆記錄`);

        res.json({
            success: true,
            areaIds: areaIds,
            totalRecords: dataResult.rows.length,
            records: dataResult.rows.map(row => ({
                areaId: row.area_id,
                areaName: row.area_name,
                personId: row.reid,
                enterTime: row.enter_time,
                exitTime: row.exit_time,
                durationSeconds: parseFloat(row.duration_seconds).toFixed(2)
            }))
        });

    } catch (error) {
        console.error('測試查詢錯誤：', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
    console.log('新東陽熱力圖系統已啟動！');
    console.log('使用 PostgreSQL 資料庫');

    // 自動連接到預設資料庫
    pool = new Pool(defaultDbConfig);
    console.log('已自動連接到新東陽資料庫');
});

// 優雅關閉
process.on('SIGINT', async () => {
    console.log('\n正在關閉伺服器...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});
