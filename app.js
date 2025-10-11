// 全域變數
let floorplanImage = null;
let canvas = null;
let ctx = null;
let heatmapCanvas = null;
let heatmapInstance = null;
let regions = [];
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentRegion = null;
let dbConnected = false;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');
    heatmapCanvas = document.getElementById('heatmapCanvas');

    // 綁定事件
    document.getElementById('uploadBtn').addEventListener('click', loadFloorplan);
    document.getElementById('connectDbBtn').addEventListener('click', connectDatabase);
    document.getElementById('addRegionBtn').addEventListener('click', startDrawingRegion);
    document.getElementById('generateBtn').addEventListener('click', generateHeatmap);
    document.getElementById('heatmapIntensity').addEventListener('input', function(e) {
        document.getElementById('intensityValue').textContent = e.target.value;
    });

    // Canvas 繪圖事件
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
});

// 載入平面圖
function loadFloorplan() {
    const fileInput = document.getElementById('floorplanUpload');
    const file = fileInput.files[0];

    if (!file) {
        alert('請先選擇平面圖檔案！');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            floorplanImage = img;

            // 設定 Canvas 尺寸
            canvas.width = img.width;
            canvas.height = img.height;
            heatmapCanvas.width = img.width;
            heatmapCanvas.height = img.height;

            // 繪製平面圖
            ctx.drawImage(img, 0, 0);

            // 啟用區域定義按鈕
            document.getElementById('addRegionBtn').disabled = false;

            alert('平面圖載入成功！');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 連接資料庫
async function connectDatabase() {
    const dbConfig = {
        host: document.getElementById('dbHost').value,
        database: document.getElementById('dbName').value,
        user: document.getElementById('dbUser').value,
        password: document.getElementById('dbPassword').value,
        table: document.getElementById('dbTable').value
    };

    if (!dbConfig.host || !dbConfig.database || !dbConfig.user || !dbConfig.table) {
        alert('請填寫完整的資料庫資訊！');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dbConfig)
        });

        const result = await response.json();

        if (result.success) {
            dbConnected = true;
            const statusEl = document.getElementById('dbStatus');
            statusEl.textContent = '✓ 已連接';
            statusEl.className = 'connected';
            document.getElementById('generateBtn').disabled = false;
            alert('資料庫連接成功！');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const statusEl = document.getElementById('dbStatus');
        statusEl.textContent = '✗ 連接失敗';
        statusEl.className = 'error';
        alert('資料庫連接失敗：' + error.message);
    }
}

// 開始繪製區域
function startDrawingRegion() {
    if (!floorplanImage) {
        alert('請先載入平面圖！');
        return;
    }

    alert('請在平面圖上拖曳滑鼠框選區域');
    canvas.style.cursor = 'crosshair';
}

// 滑鼠按下
function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDrawing = true;
}

// 滑鼠移動
function onMouseMove(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // 重繪平面圖
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(floorplanImage, 0, 0);

    // 繪製已存在的區域
    regions.forEach(region => {
        drawRegion(region);
    });

    // 繪製當前區域
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
    ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
}

// 滑鼠放開
function onMouseUp(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    isDrawing = false;
    canvas.style.cursor = 'default';

    // 檢查區域大小
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    if (width < 10 || height < 10) {
        alert('區域太小，請重新繪製！');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(floorplanImage, 0, 0);
        regions.forEach(region => drawRegion(region));
        return;
    }

    // 取得區域名稱
    const regionName = prompt('請輸入區域名稱（對應DB的地區欄位）：');

    if (!regionName) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(floorplanImage, 0, 0);
        regions.forEach(region => drawRegion(region));
        return;
    }

    // 儲存區域
    const region = {
        id: Date.now(),
        name: regionName,
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: width,
        height: height
    };

    regions.push(region);
    addRegionToList(region);

    // 重繪
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(floorplanImage, 0, 0);
    regions.forEach(r => drawRegion(r));
}

// 繪製區域
function drawRegion(region) {
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
    ctx.fillRect(region.x, region.y, region.width, region.height);
    ctx.strokeRect(region.x, region.y, region.width, region.height);

    // 繪製區域名稱
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold 16px Microsoft JhengHei';
    ctx.fillText(region.name, region.x + 5, region.y + 20);
}

// 新增區域到列表
function addRegionToList(region) {
    const regionList = document.getElementById('regionList');

    const regionItem = document.createElement('div');
    regionItem.className = 'region-item';
    regionItem.id = 'region-' + region.id;

    regionItem.innerHTML = `
        <input type="text" value="${region.name}" onchange="updateRegionName(${region.id}, this.value)">
        <button class="delete" onclick="deleteRegion(${region.id})">刪除</button>
    `;

    regionList.appendChild(regionItem);
}

// 更新區域名稱
function updateRegionName(id, newName) {
    const region = regions.find(r => r.id === id);
    if (region) {
        region.name = newName;
        // 重繪
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(floorplanImage, 0, 0);
        regions.forEach(r => drawRegion(r));
    }
}

// 刪除區域
function deleteRegion(id) {
    regions = regions.filter(r => r.id !== id);
    document.getElementById('region-' + id).remove();

    // 重繪
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(floorplanImage, 0, 0);
    regions.forEach(r => drawRegion(r));
}

// 生成熱力圖
async function generateHeatmap() {
    if (!dbConnected) {
        alert('請先連接資料庫！');
        return;
    }

    if (regions.length === 0) {
        alert('請先定義至少一個區域！');
        return;
    }

    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!startTime || !endTime) {
        alert('請選擇時間區間！');
        return;
    }

    try {
        // 取得資料
        const response = await fetch('http://localhost:3000/api/heatmap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                regions: regions.map(r => r.name),
                startTime: startTime,
                endTime: endTime
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        // 計算每個區域的人流量
        const regionData = {};
        regions.forEach(region => {
            regionData[region.name] = 0;
        });

        data.records.forEach(record => {
            if (regionData.hasOwnProperty(record.region)) {
                regionData[record.region]++;
            }
        });

        // 生成熱力圖資料點
        const heatmapData = [];
        const intensity = parseInt(document.getElementById('heatmapIntensity').value);

        regions.forEach(region => {
            const count = regionData[region.name] || 0;
            const value = Math.min(count * intensity / 10, 100);

            // 在區域內生成多個資料點
            const pointsCount = Math.max(Math.floor(count / 5), 1);
            for (let i = 0; i < pointsCount; i++) {
                heatmapData.push({
                    x: Math.floor(region.x + region.width / 2 + (Math.random() - 0.5) * region.width * 0.8),
                    y: Math.floor(region.y + region.height / 2 + (Math.random() - 0.5) * region.height * 0.8),
                    value: value
                });
            }
        });

        // 清除舊的熱力圖
        if (heatmapInstance) {
            heatmapInstance.setData({ data: [] });
        }

        // 建立新的熱力圖
        heatmapInstance = h337.create({
            container: document.querySelector('.canvas-container'),
            radius: 50,
            maxOpacity: 0.6,
            minOpacity: 0,
            blur: 0.75
        });

        heatmapInstance.setData({
            max: 100,
            data: heatmapData
        });

        alert(`熱力圖生成成功！\n總記錄數：${data.records.length}`);

    } catch (error) {
        alert('生成熱力圖失敗：' + error.message);
    }
}
