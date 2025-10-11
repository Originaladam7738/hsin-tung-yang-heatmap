# 🚀 快速安裝指南

## 方法 1: 使用 Docker (推薦)

### 前置需求
- [Docker](https://www.docker.com/get-started) 已安裝
- [Docker Compose](https://docs.docker.com/compose/install/) 已安裝

### 安裝步驟

```bash
# 1. 下載專案
git clone https://github.com/Originaladam7738/hsin-tung-yang-heatmap.git
cd hsin-tung-yang-heatmap

# 2. 啟動服務
docker-compose up -d

# 3. 查看日誌 (確認啟動成功)
docker-compose logs -f

# 4. 開啟瀏覽器
# http://localhost:3000/heatmap.html
```

### 常用指令

```bash
# 停止服務
docker-compose down

# 重新啟動
docker-compose restart

# 查看運行狀態
docker-compose ps
```

---

## 方法 2: 手動安裝

### 前置需求
- [Node.js](https://nodejs.org/) v18 或以上
- PostgreSQL 資料庫 (或 MySQL)

### 安裝步驟

```bash
# 1. 下載專案
git clone https://github.com/Originaladam7738/hsin-tung-yang-heatmap.git
cd hsin-tung-yang-heatmap

# 2. 安裝依賴
npm install

# 3. 設定資料庫連線 (編輯 server_pg.js)
# 修改第 18-28 行的資料庫設定

# 4. 啟動服務
npm start

# 5. 開啟瀏覽器
# http://localhost:3000/heatmap.html
```

---

## ⚠️ 常見問題

### 1. Port 3000 已被佔用
```bash
# 查看誰在使用 port 3000
lsof -i :3000

# 修改 docker-compose.yml 或 server_pg.js 中的 PORT
```

### 2. 資料庫連線失敗
- 檢查資料庫服務是否啟動
- 確認連線資訊 (host, port, user, password)
- 檢查防火牆設定

### 3. 平面圖無法載入
- 確認 `平面圖.png` 檔案存在
- 檢查檔案權限
- 清除瀏覽器快取 (Ctrl+Shift+R / Cmd+Shift+R)

### 4. node_modules 錯誤
```bash
# 刪除並重新安裝
rm -rf node_modules package-lock.json
npm install
```

---

## 📦 資料庫設定

系統已預設連接到雲端資料庫,如需使用自己的資料庫:

1. 編輯 `server_pg.js` (PostgreSQL) 或 `server.js` (MySQL)
2. 修改 `defaultDbConfig` 區塊
3. 確保資料庫有 `v_store_analysis` 和 `v_area` 表

---

## 🎯 驗證安裝

1. 開啟 http://localhost:3000/heatmap.html
2. 查看「資料庫狀態」顯示「已連接到新東陽資料庫」
3. 平面圖應自動載入
4. 可以看到設定檔下拉選單

---

## 📞 需要協助?

- 查看 [README.md](README.md) 詳細說明
- 查看 [DOCKER_README.md](DOCKER_README.md) Docker 部署說明
- 查看 [使用說明.md](使用說明.md) 功能使用說明
- 提交 [Issue](https://github.com/Originaladam7738/hsin-tung-yang-heatmap/issues)
