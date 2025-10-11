# 使用官方 Node.js 18 LTS 映像作為基礎
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製應用程式檔案
COPY . .

# 暴露應用程式端口
EXPOSE 3000

# 設定環境變數（可以在 docker-compose.yml 中覆蓋）
ENV NODE_ENV=production
ENV PORT=3000

# 啟動應用程式
CMD ["npm", "start"]
