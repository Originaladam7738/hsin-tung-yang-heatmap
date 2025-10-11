# Docker 部署指南

## 📋 前置需求

- Docker Desktop (Mac/Windows) 或 Docker Engine (Linux)
- Docker Compose

## 🚀 快速開始

### 方法 1: 使用 Docker Compose (推薦)

1. **啟動應用程式**
   ```bash
   docker-compose up -d
   ```

2. **查看日誌**
   ```bash
   docker-compose logs -f
   ```

3. **停止應用程式**
   ```bash
   docker-compose down
   ```

4. **訪問應用程式**
   ```
   打開瀏覽器: http://localhost:3000
   ```

### 方法 2: 使用 Docker 命令

1. **建置映像**
   ```bash
   docker build -t hsin-tung-yang-heatmap .
   ```

2. **運行容器**
   ```bash
   docker run -d \
     --name heatmap-app \
     -p 3000:3000 \
     hsin-tung-yang-heatmap
   ```

3. **查看日誌**
   ```bash
   docker logs -f heatmap-app
   ```

4. **停止容器**
   ```bash
   docker stop heatmap-app
   docker rm heatmap-app
   ```

## 🔧 環境變數配置

應用程式連接到雲端 PostgreSQL 資料庫。如需修改資料庫連接,請編輯 `docker-compose.yml` 中的環境變數:

```yaml
environment:
  - DB_HOST=your-database-host
  - DB_PORT=5432
  - DB_NAME=your-database-name
  - DB_USER=your-username
  - DB_PASSWORD=your-password
```

## 📦 常用命令

### 重新建置並啟動
```bash
docker-compose up -d --build
```

### 查看運行中的容器
```bash
docker-compose ps
```

### 進入容器 Shell
```bash
docker-compose exec heatmap-app sh
```

### 查看容器資源使用情況
```bash
docker stats hsin-tung-yang-heatmap
```

### 清理所有停止的容器和未使用的映像
```bash
docker system prune -a
```

## 🐛 故障排除

### 容器無法啟動
```bash
# 查看詳細日誌
docker-compose logs

# 檢查容器狀態
docker-compose ps
```

### 端口已被占用
如果 3000 端口被占用,可以修改 `docker-compose.yml` 中的端口映射:
```yaml
ports:
  - "8080:3000"  # 改用 8080 端口
```

### 資料庫連接失敗
確認:
1. 雲端資料庫服務正常運行
2. 網路可以訪問資料庫主機
3. 資料庫憑證正確

## 📚 檔案說明

- `Dockerfile` - Docker 映像構建配置
- `docker-compose.yml` - Docker Compose 服務配置
- `.dockerignore` - Docker 構建時排除的檔案

## 🔒 安全注意事項

⚠️ **重要**: `docker-compose.yml` 中包含資料庫密碼。在生產環境中,建議:

1. 使用 `.env` 檔案存儲敏感資訊
2. 將 `.env` 加入 `.gitignore`
3. 使用 Docker secrets 或密鑰管理服務

### 使用 .env 檔案範例

創建 `.env` 檔案:
```env
DB_HOST=iseekbidbstaging.intemotech.com
DB_PORT=5404
DB_NAME=postgresdb
DB_USER=hsintungyang
DB_PASSWORD=G7pL2vX9
```

修改 `docker-compose.yml`:
```yaml
environment:
  - DB_HOST=${DB_HOST}
  - DB_PORT=${DB_PORT}
  - DB_NAME=${DB_NAME}
  - DB_USER=${DB_USER}
  - DB_PASSWORD=${DB_PASSWORD}
```

## 📊 健康檢查

容器包含健康檢查功能,每 30 秒檢查一次應用程式狀態:

```bash
# 查看健康狀態
docker inspect --format='{{.State.Health.Status}}' hsin-tung-yang-heatmap
```

## 🌐 生產環境部署建議

1. **使用反向代理 (Nginx/Traefik)**
   - 提供 HTTPS 支援
   - 負載平衡
   - 靜態檔案快取

2. **設定資源限制**
   在 `docker-compose.yml` 中添加:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 512M
   ```

3. **日誌管理**
   配置日誌驅動和輪替:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

4. **監控和警報**
   - 使用 Prometheus + Grafana 監控
   - 設定健康檢查警報

## 📞 支援

如有問題,請查看應用程式日誌:
```bash
docker-compose logs -f heatmap-app
```
