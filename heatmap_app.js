// 全域變數
const IMAGE_PATH = './平面圖.png';  // 改為使用 PNG 圖片
const API_BASE = `${window.location.origin}/api`;  // 動態使用當前瀏覽器網址
const SCALE_FACTOR = 0.7; // 底圖縮放比例（0.7 = 70%）

let canvas = null;
let ctx = null;
let heatmapInstance = null;
let floorplanImage = null;
let availableAreas = []; // 資料庫中所有可用的 area
let drawnRegions = []; // 使用者繪製的區域
let dbConnected = false;

// 繪圖狀態
let isDrawing = false;
let currentPoints = []; // 當前正在繪製的多邊形點
let canvasScale = 1; // Canvas 縮放比例
let canvasOffsetX = 0;
let canvasOffsetY = 0;

// 時間軸播放
let timelineData = null;
let isPlaying = false;
let isPaused = false;
let playbackTimer = null;
let currentTimeIndex = 0;
let isUserDragging = false; // 用戶是否正在拖拉進度條

// 熱力圖提示框相關
let currentHeatmapData = null; // 當前時間點的熱力圖資料
let previousHeatmapData = null; // 前一時間點的熱力圖資料

// 區域顯示狀態管理
let regionVisibilityMap = new Map(); // 儲存每個區域的顯示/隱藏狀態 {areaName: boolean}

// 模態對話框相關
let pendingRegionPoints = null;
let areaSelectionCallback = null;

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');

    // 綁定事件
    document.getElementById('drawRegionBtn').addEventListener('click', startDrawing);
    document.getElementById('finishDrawingBtn').addEventListener('click', finishDrawing);
    document.getElementById('cancelDrawingBtn').addEventListener('click', cancelDrawing);
    document.getElementById('clearRegionsBtn').addEventListener('click', clearAllRegions);

    // 控制面板的播放按鈕(如果存在)
    const playTimelineBtn = document.getElementById('playTimelineBtn');
    if (playTimelineBtn) {
        playTimelineBtn.addEventListener('click', toggleTimelinePlayback);
    }
    const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
    if (pauseTimelineBtn) {
        pauseTimelineBtn.addEventListener('click', pauseTimelinePlayback);
    }
    const stopTimelineBtn = document.getElementById('stopTimelineBtn');
    if (stopTimelineBtn) {
        stopTimelineBtn.addEventListener('click', stopTimelinePlayback);
    }

    // 快速控制按鈕事件
    const quickPlayBtn = document.getElementById('quickPlayBtn');
    if (quickPlayBtn) {
        quickPlayBtn.addEventListener('click', toggleTimelinePlayback);
    }

    const quickPauseBtn = document.getElementById('quickPauseBtn');
    if (quickPauseBtn) {
        quickPauseBtn.addEventListener('click', pauseTimelinePlayback);
    }

    const quickStopBtn = document.getElementById('quickStopBtn');
    if (quickStopBtn) {
        quickStopBtn.addEventListener('click', stopTimelinePlayback);
    }

    const quickRefreshBtn = document.getElementById('quickRefreshBtn');
    if (quickRefreshBtn) {
        quickRefreshBtn.addEventListener('click', refreshCurrentHeatmap);
    }

    // 顯示開關事件
    const showRegionBorders = document.getElementById('showRegionBorders');
    if (showRegionBorders) {
        showRegionBorders.addEventListener('change', redrawCanvas);
    }

    const showRegionLabels = document.getElementById('showRegionLabels');
    if (showRegionLabels) {
        showRegionLabels.addEventListener('change', redrawCanvas);
    }

    // 進度條事件（地圖下方的新進度條）
    const timelineBar = document.getElementById('timelineBar');
    if (timelineBar) {
        timelineBar.addEventListener('input', onProgressBarDrag);
        timelineBar.addEventListener('change', onProgressBarChange);
    }

    // 保留原進度條的事件（控制面板中的）
    const progressBar = document.getElementById('timelineProgressBar');
    if (progressBar) {
        progressBar.addEventListener('input', onProgressBarDrag);
        progressBar.addEventListener('change', onProgressBarChange);
    }

    // 快速設定欄事件
    const quickDateRange = document.getElementById('quickDateRange');
    if (quickDateRange) {
        quickDateRange.addEventListener('change', onQuickDateRangeChange);
    }

    // 快速時間輸入同步
    const quickStartTimeEl = document.getElementById('quickStartTime');
    if (quickStartTimeEl) {
        quickStartTimeEl.addEventListener('change', function(e) {
            const startTimeEl = document.getElementById('startTime');
            if (startTimeEl) {
                startTimeEl.value = e.target.value;
            }
        });
    }

    const quickEndTimeEl = document.getElementById('quickEndTime');
    if (quickEndTimeEl) {
        quickEndTimeEl.addEventListener('change', function(e) {
            const endTimeEl = document.getElementById('endTime');
            if (endTimeEl) {
                endTimeEl.value = e.target.value;
            }
        });
    }

    // 播放速度同步
    const quickPlaybackSpeed = document.getElementById('quickPlaybackSpeed');
    if (quickPlaybackSpeed) {
        quickPlaybackSpeed.addEventListener('input', function(e) {
            const value = e.target.value;
            const quickSpeedValue = document.getElementById('quickSpeedValue');
            if (quickSpeedValue) {
                quickSpeedValue.textContent = value;
            }

            const playbackInterval = document.getElementById('playbackInterval');
            if (playbackInterval) {
                playbackInterval.value = value;
            }

            const intervalValue = document.getElementById('intervalValue');
            if (intervalValue) {
                intervalValue.textContent = value;
            }
        });
    }

    // 時間區間同步
    const quickTimeInterval = document.getElementById('quickTimeInterval');
    if (quickTimeInterval) {
        quickTimeInterval.addEventListener('input', function(e) {
            const value = e.target.value;
            const quickIntervalValue = document.getElementById('quickIntervalValue');
            if (quickIntervalValue) {
                quickIntervalValue.textContent = value;
            }

            const timelineInterval = document.getElementById('timelineInterval');
            if (timelineInterval) {
                timelineInterval.value = value;
            }

            const intervalText = document.getElementById('intervalText');
            if (intervalText) {
                intervalText.textContent = value;
            }
        });
    }

    // 顯示選項同步（快速設定 ↔ 控制面板）
    const quickShowBorders = document.getElementById('quickShowBorders');
    if (quickShowBorders) {
        quickShowBorders.addEventListener('change', function(e) {
            const showRegionBorders = document.getElementById('showRegionBorders');
            if (showRegionBorders) {
                showRegionBorders.checked = e.target.checked;
            }
            redrawCanvas();
        });
    }

    const quickShowLabels = document.getElementById('quickShowLabels');
    if (quickShowLabels) {
        quickShowLabels.addEventListener('change', function(e) {
            const showRegionLabels = document.getElementById('showRegionLabels');
            if (showRegionLabels) {
                showRegionLabels.checked = e.target.checked;
            }
            redrawCanvas();
        });
    }

    // 控制面板的選項也同步到快速設定
    const showRegionBordersSync = document.getElementById('showRegionBorders');
    if (showRegionBordersSync) {
        showRegionBordersSync.addEventListener('change', function(e) {
            const quickShowBorders = document.getElementById('quickShowBorders');
            if (quickShowBorders) {
                quickShowBorders.checked = e.target.checked;
            }
        });
    }

    const showRegionLabelsSync = document.getElementById('showRegionLabels');
    if (showRegionLabelsSync) {
        showRegionLabelsSync.addEventListener('change', function(e) {
            const quickShowLabels = document.getElementById('quickShowLabels');
            if (quickShowLabels) {
                quickShowLabels.checked = e.target.checked;
            }
        });
    }

    const minDuration = document.getElementById('minDuration');
    if (minDuration) {
        minDuration.addEventListener('input', function(e) {
            const minDurationValue = document.getElementById('minDurationValue');
            if (minDurationValue) {
                minDurationValue.textContent = e.target.value;
            }
        });
    }

    const heatmapRadius = document.getElementById('heatmapRadius');
    if (heatmapRadius) {
        heatmapRadius.addEventListener('input', function(e) {
            const heatmapRadiusValue = document.getElementById('heatmapRadiusValue');
            if (heatmapRadiusValue) {
                heatmapRadiusValue.textContent = e.target.value;
            }
        });
    }

    const maxDuration = document.getElementById('maxDuration');
    if (maxDuration) {
        maxDuration.addEventListener('input', function(e) {
            const seconds = parseInt(e.target.value);
            const minutes = Math.floor(seconds / 60);
            const maxDurationValue = document.getElementById('maxDurationValue');
            if (maxDurationValue) {
                maxDurationValue.textContent = seconds >= 60
                    ? `${minutes}分鐘`
                    : `${seconds}秒`;
            }
        });
    }

    // 控制面板的元素(如果存在)
    const playbackInterval = document.getElementById('playbackInterval');
    if (playbackInterval) {
        playbackInterval.addEventListener('input', function(e) {
            const intervalValue = document.getElementById('intervalValue');
            if (intervalValue) {
                intervalValue.textContent = e.target.value;
            }
        });
    }

    const timelineInterval = document.getElementById('timelineInterval');
    if (timelineInterval) {
        timelineInterval.addEventListener('input', function(e) {
            const intervalText = document.getElementById('intervalText');
            if (intervalText) {
                intervalText.textContent = e.target.value;
            }
        });
    }

    // Canvas 繪圖事件
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMouseMove);

    // Canvas 滑鼠移動事件（用於熱力圖提示框）
    canvas.addEventListener('mousemove', onCanvasMouseMoveForTooltip);

    // 初始化雙端點滑桿
    initializeRangeSlider();

    // 初始化最大停留時間的顯示（預設60分鐘）
    document.getElementById('maxDurationValue').textContent = '60分鐘';

    // 初始化系統
    await initializeSystem();
});

// 初始化系統
async function initializeSystem() {
    try {
        // 1. 設定預設時間（今天00:00到現在）
        setDefaultDateTime();

        // 2. 連接資料庫
        await connectDatabase();

        // 3. 載入圖片底圖
        await loadImageFloorplan();

        // 4. 載入可用的區域列表
        await loadAvailableAreas();

        // 5. 載入之前保存的區域
        loadRegionsFromStorage();
    } catch (error) {
        console.error('系統初始化失敗：', error);
        alert('系統初始化失敗：' + error.message);
    }
}

// 設定預設時間為最新時間往前推一週
function setDefaultDateTime() {
    // 取得當前時間
    const now = new Date();

    // 結束時間：現在
    const defaultEnd = new Date(now);

    // 開始時間：7天前
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 7);

    // 格式化為 datetime-local 格式 (YYYY-MM-DDTHH:mm)
    const formatDateTime = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const startTimeEl = document.getElementById('startTime');
    if (startTimeEl) {
        startTimeEl.value = formatDateTime(defaultStart);
    }

    const endTimeEl = document.getElementById('endTime');
    if (endTimeEl) {
        endTimeEl.value = formatDateTime(defaultEnd);
    }

    // 同步到快速設定欄
    const quickStartTimeEl = document.getElementById('quickStartTime');
    if (quickStartTimeEl) {
        quickStartTimeEl.value = formatDateTime(defaultStart);
    }

    const quickEndTimeEl = document.getElementById('quickEndTime');
    if (quickEndTimeEl) {
        quickEndTimeEl.value = formatDateTime(defaultEnd);
    }
}

// 快速日期區間選擇
function onQuickDateRangeChange(e) {
    const value = e.target.value;

    if (value === 'custom') {
        return; // 不改變當前時間
    }

    const formatDateTime = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const now = new Date();
    let startDate, endDate;

    switch(value) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
        case 'yesterday':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59);
            break;
        case 'last7days':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
        case 'last30days':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
            break;
        default:
            return;
    }

    const startTimeEl = document.getElementById('startTime');
    if (startTimeEl) {
        startTimeEl.value = formatDateTime(startDate);
    }

    const endTimeEl = document.getElementById('endTime');
    if (endTimeEl) {
        endTimeEl.value = formatDateTime(endDate);
    }

    // 同步到快速設定欄
    const quickStartTimeEl = document.getElementById('quickStartTime');
    if (quickStartTimeEl) {
        quickStartTimeEl.value = formatDateTime(startDate);
    }

    const quickEndTimeEl = document.getElementById('quickEndTime');
    if (quickEndTimeEl) {
        quickEndTimeEl.value = formatDateTime(endDate);
    }
}

// 連接資料庫
async function connectDatabase() {
    try {
        const response = await fetch(`${API_BASE}/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            dbConnected = true;
            const statusEl = document.getElementById('dbStatus');
            statusEl.textContent = '✓ 已連接到新東陽資料庫';
            statusEl.className = 'status connected';
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const statusEl = document.getElementById('dbStatus');
        statusEl.textContent = '✗ 連接失敗：' + error.message;
        statusEl.className = 'status error';
        throw error;
    }
}

// 載入圖片底圖
async function loadImageFloorplan() {
    return new Promise((resolve, reject) => {
        const container = document.getElementById('canvasContainer');
        if (!container) {
            const error = new Error('找不到 canvasContainer 元素');
            console.error('DOM 元素錯誤：', error);
            reject(error);
            return;
        }

        const img = new Image();

        img.onload = function() {
            try {
                floorplanImage = img;

                // 計算縮放後的尺寸
                const containerWidth = container.offsetWidth - 40; // 減去 padding

                const scaledWidth = img.width * SCALE_FACTOR;
                const scaledHeight = img.height * SCALE_FACTOR;

                // 如果縮放後還是太寬，再次調整
                let finalScale = SCALE_FACTOR;
                if (scaledWidth > containerWidth && containerWidth > 0) {
                    finalScale = (containerWidth / img.width) * 0.95; // 留 5% 邊距
                }

                canvasScale = finalScale;

                // 設定 Canvas 尺寸
                canvas.width = Math.floor(img.width * finalScale);
                canvas.height = Math.floor(img.height * finalScale);

                // 繪製圖片
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 標記為已載入
                container.classList.add('loaded');

                console.log(`平面圖載入成功: ${IMAGE_PATH} (${img.width}x${img.height})`);

                // 載入完成後,如果有儲存的區域,需要重繪以顯示它們
                // 使用 setTimeout 確保在下一個事件循環中執行,讓 loadRegionsFromStorage 先完成
                setTimeout(() => {
                    if (drawnRegions.length > 0) {
                        console.log('重繪已載入的區域:', drawnRegions.length, '個');
                        redrawCanvas();
                    }
                }, 100);

                resolve();
            } catch (error) {
                console.error('繪製平面圖時發生錯誤：', error);
                reject(error);
            }
        };

        img.onerror = function(error) {
            const errMsg = `無法載入平面圖: ${IMAGE_PATH}`;
            console.error('圖片載入失敗：', IMAGE_PATH, error);
            reject(new Error(errMsg));
        };

        console.log(`開始載入平面圖: ${IMAGE_PATH}`);
        img.src = IMAGE_PATH;
    });
}

// 載入可用的區域列表
async function loadAvailableAreas() {
    try {
        const response = await fetch(`${API_BASE}/areas`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        availableAreas = result.areas;
    } catch (error) {
        console.error('載入區域失敗：', error);
        throw error;
    }
}

// 開始繪製區域
function startDrawing() {
    // 確保停止任何正在進行的播放
    if (isPlaying) {
        stopTimelinePlayback();
    }

    isDrawing = true;
    currentPoints = [];
    canvas.style.cursor = 'crosshair';

    document.getElementById('drawRegionBtn').style.display = 'none';
    document.getElementById('finishDrawingBtn').style.display = 'inline-block';
    document.getElementById('cancelDrawingBtn').style.display = 'inline-block';
    document.getElementById('clearRegionsBtn').disabled = true;

    alert('點擊平面圖以添加錨點，至少需要 3 個點。完成後點擊「✓ 完成」按鈕。');
}

// Canvas 點擊事件
function onCanvasClick(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 添加點
    currentPoints.push({ x, y });

    // 重繪
    redrawCanvas();
}

// Canvas 滑鼠移動事件
function onCanvasMouseMove(e) {
    if (!isDrawing || currentPoints.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 重繪並顯示預覽線
    redrawCanvas();

    // 繪製從最後一個點到滑鼠位置的預覽線
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
}

// 完成繪製
async function finishDrawing() {
    if (currentPoints.length < 3) {
        alert('至少需要 3 個點才能形成區域！');
        return;
    }

    // 儲存當前繪製的點
    pendingRegionPoints = [...currentPoints];

    // 顯示模態對話框
    showAreaSelectModal();
}

// 顯示區域選擇模態對話框
function showAreaSelectModal() {
    const modal = document.getElementById('areaSelectModal');
    const select = document.getElementById('areaSelect');

    // 清空並填充選項
    select.innerHTML = '';

    // 按 area_name 分組，合併相同名稱的區域
    const areaMap = new Map();

    availableAreas.forEach(area => {
        const areaName = area.area_name || area.area_number || `區域${area.area_id}`;

        if (!areaMap.has(areaName)) {
            // 如果是新的區域名稱，記錄第一個 area_id
            areaMap.set(areaName, {
                areaName: areaName,
                areaIds: [area.area_id],
                areaNumber: area.area_number
            });
        } else {
            // 如果區域名稱已存在，添加到 area_id 列表
            areaMap.get(areaName).areaIds.push(area.area_id);
        }
    });

    // 按區域名稱排序並創建選項
    const sortedAreas = Array.from(areaMap.values()).sort((a, b) =>
        a.areaName.localeCompare(b.areaName, 'zh-TW')
    );

    sortedAreas.forEach(area => {
        const option = document.createElement('option');
        // 將所有相關的 area_id 存儲在 value 中，用逗號分隔
        option.value = area.areaIds.join(',');
        // 顯示區域名稱，如果有多個 ID，顯示數量
        const displayText = area.areaIds.length > 1
            ? `${area.areaName} (${area.areaIds.length}個區域)`
            : area.areaName;
        option.textContent = displayText;
        select.appendChild(option);
    });

    // 顯示模態
    modal.classList.add('show');
}

// 確認區域選擇
function confirmAreaSelection() {
    const select = document.getElementById('areaSelect');
    const selectedValue = select.value;

    if (!selectedValue) {
        alert('請選擇一個區域！');
        return;
    }

    // 解析選中的 area_id（可能有多個，用逗號分隔）
    const areaIds = selectedValue.split(',').map(id => parseInt(id));

    // 使用第一個 area_id 來獲取區域資訊
    const area = availableAreas.find(a => a.area_id === areaIds[0]);

    if (!area) {
        alert('找不到該區域！');
        return;
    }

    const areaName = area.area_name || area.area_number || `區域${areaIds[0]}`;

    // 檢查是否已經繪製過這個區域名稱
    const existingRegion = drawnRegions.find(r => r.areaName === areaName);
    if (existingRegion) {
        const confirmOverwrite = window.confirm(`區域「${areaName}」已經存在，是否覆蓋？`);
        if (!confirmOverwrite) {
            cancelAreaSelection();
            return;
        }
        // 刪除舊的
        drawnRegions = drawnRegions.filter(r => r.areaName !== areaName);
    }

    // 儲存區域（包含所有相關的 area_id）
    const region = {
        id: Date.now(),
        areaIds: areaIds,  // 儲存所有相關的 area_id
        areaName: areaName,
        areaNumber: area.area_number,
        points: [...pendingRegionPoints],
        color: getRandomColor()
    };

    drawnRegions.push(region);

    // 關閉模態並結束繪製模式
    closeAreaSelectModal();
    completeDrawing();
}

// 取消區域選擇
function cancelAreaSelection() {
    closeAreaSelectModal();
    cancelDrawing();
}

// 關閉模態對話框
function closeAreaSelectModal() {
    const modal = document.getElementById('areaSelectModal');
    modal.classList.remove('show');
    pendingRegionPoints = null;
}

// 完成繪製並更新UI
function completeDrawing() {
    isDrawing = false;
    currentPoints = [];
    canvas.style.cursor = 'default';

    document.getElementById('drawRegionBtn').style.display = 'inline-block';
    document.getElementById('finishDrawingBtn').style.display = 'none';
    document.getElementById('cancelDrawingBtn').style.display = 'none';
    document.getElementById('clearRegionsBtn').disabled = false;

    // 更新顯示
    redrawCanvas();
    updateRegionList();
    updateGenerateButton();

    // 保存區域到 localStorage
    saveRegionsToStorage();
}

// 取消繪製
function cancelDrawing() {
    isDrawing = false;
    currentPoints = [];
    canvas.style.cursor = 'default';

    document.getElementById('drawRegionBtn').style.display = 'inline-block';
    document.getElementById('finishDrawingBtn').style.display = 'none';
    document.getElementById('cancelDrawingBtn').style.display = 'none';
    document.getElementById('clearRegionsBtn').disabled = false;

    redrawCanvas();
}

// 清除所有區域
function clearAllRegions() {
    if (drawnRegions.length === 0) return;

    const confirm = window.confirm('確定要清除所有繪製的區域嗎？');
    if (!confirm) return;

    drawnRegions = [];
    redrawCanvas();
    updateRegionList(null);
    updateGenerateButton();

    // 保存到 localStorage
    saveRegionsToStorage();
}

// 刪除單個區域
function deleteRegion(regionId) {
    drawnRegions = drawnRegions.filter(r => r.id !== regionId);
    redrawCanvas();
    updateRegionList(null);
    updateGenerateButton();

    // 保存到 localStorage
    saveRegionsToStorage();
}

// 保存繪製的區域到 localStorage
function saveRegionsToStorage() {
    try {
        localStorage.setItem('heatmap_drawn_regions', JSON.stringify(drawnRegions));
    } catch (error) {
        console.error('保存區域失敗：', error);
        alert('保存區域失敗：' + error.message);
    }
}

// 從 localStorage 載入繪製的區域
function loadRegionsFromStorage() {
    try {
        const saved = localStorage.getItem('heatmap_drawn_regions');
        if (saved) {
            const loadedRegions = JSON.parse(saved);
            drawnRegions = loadedRegions;

            console.log('從 localStorage 載入區域:', drawnRegions.length, '個');

            // 重繪 Canvas 以顯示載入的區域
            // 如果圖片還沒載入完成,redrawCanvas 會返回,但沒關係
            // 因為圖片載入完成後會再次調用 redrawCanvas
            redrawCanvas();

            // 更新區域列表
            updateRegionList();

            // 更新按鈕狀態
            updateGenerateButton();
        } else {
            console.log('localStorage 中沒有儲存的區域');
        }
    } catch (error) {
        console.error('載入區域失敗：', error);
        alert('載入區域失敗：' + error.message);
        drawnRegions = [];
    }
}

// 重繪 Canvas
function redrawCanvas() {
    if (!floorplanImage) {
        console.log('redrawCanvas: 平面圖尚未載入,無法重繪');
        return;
    }

    console.log('redrawCanvas: 開始重繪, 區域數量:', drawnRegions.length);

    // 清空並繪製底圖
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(floorplanImage, 0, 0, canvas.width, canvas.height);

    // 繪製已儲存的區域
    drawnRegions.forEach((region, index) => {
        console.log(`  繪製區域 ${index + 1}:`, region.areaName || region.areaNumber, '點數:', region.points.length);
        drawPolygon(region.points, region.color, region.areaName || region.areaNumber);
    });

    // 繪製當前正在畫的區域
    if (isDrawing && currentPoints.length > 0) {
        drawPolygon(currentPoints, '#667eea', null, true);
    }

    console.log('redrawCanvas: 重繪完成');
}

// 繪製多邊形
function drawPolygon(points, color, label, isPreview = false) {
    if (points.length === 0) return;

    // 取得開關狀態
    const showBorders = document.getElementById('showRegionBorders').checked;
    const showLabels = document.getElementById('showRegionLabels').checked;

    ctx.strokeStyle = color;
    ctx.fillStyle = color + '33'; // 半透明
    ctx.lineWidth = 3;

    // 繪製多邊形（只在開啟框線或預覽模式時繪製）
    if (showBorders || isPreview) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        if (!isPreview) {
            ctx.closePath();
            ctx.fill();
        }
        ctx.stroke();

        // 繪製錨點
        points.forEach((point, index) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fill();

            // 繪製點的編號
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(index + 1, point.x, point.y);
        });
    }

    // 繪製標籤（只在開啟標籤時繪製）
    if (label && !isPreview && showLabels) {
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        ctx.fillStyle = color;
        ctx.font = 'bold 16px Microsoft JhengHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 繪製白色背景
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'white';
        ctx.fillRect(centerX - textWidth / 2 - 5, centerY - 12, textWidth + 10, 24);

        ctx.fillStyle = color;
        ctx.fillText(label, centerX, centerY);
    }
}

// 更新區域列表
function updateRegionList(heatmapData = null, dataMinValue = 0, dataMaxValue = 100) {
    const listEl = document.getElementById('regionList');

    // 檢查元素是否存在（已從 HTML 移除）
    if (!listEl) return;

    if (drawnRegions.length === 0) {
        listEl.innerHTML = '<div class="loading">尚未繪製任何區域</div>';
        const drawnRegionsEl = document.getElementById('drawnRegions');
        if (drawnRegionsEl) {
            drawnRegionsEl.textContent = '0';
        }
        return;
    }

    listEl.innerHTML = '';
    drawnRegions.forEach(region => {
        const item = document.createElement('div');
        item.className = 'region-item';
        item.style.borderLeftColor = region.color;

        // 支援新舊格式（areaIds 或 areaId）
        const areaIds = region.areaIds || [region.areaId];
        const idDisplay = areaIds.length > 1
            ? `${areaIds.length}個區域`
            : `ID: ${areaIds[0]}`;

        // 查找該區域的數據
        let regionData = null;
        if (heatmapData) {
            // 找到所有匹配此區域的數據（可能有多個area_id）
            const matchingData = heatmapData.filter(data => areaIds.includes(data.areaId));

            // 合併數據
            if (matchingData.length > 0) {
                const totalVisits = matchingData.reduce((sum, d) => sum + d.visitCount, 0);
                const totalDuration = matchingData.reduce((sum, d) => sum + d.totalDurationMinutes, 0);
                regionData = {
                    visitCount: totalVisits,
                    totalDurationMinutes: totalDuration,
                    avgDurationMinutes: totalVisits > 0 ? totalDuration / totalVisits : 0
                };
            }
        }

        // 構建HTML
        let html = `
            <div class="region-item-header">
                <div style="width: 16px; height: 16px; background: ${region.color}; border-radius: 3px; flex-shrink: 0;"></div>
                <label style="flex: 1; margin: 0; font-weight: bold;">${region.areaName || region.areaNumber}</label>
                <button class="delete" onclick="deleteRegion(${region.id})" style="width: auto; padding: 4px 8px; font-size: 0.8em;">刪除</button>
            </div>
        `;

        // 如果有數據，顯示數據
        if (regionData) {
            const metric = document.getElementById('heatmapMetric').value;

            // 計算當前顯示的指標值
            let displayValue = 0;
            let displayUnit = '';
            if (metric === 'visitCount') {
                displayValue = regionData.visitCount;
                displayUnit = '人次';
            } else if (metric === 'totalDuration') {
                displayValue = regionData.totalDurationMinutes.toFixed(1);
                displayUnit = '分鐘';
            } else if (metric === 'avgDuration') {
                displayValue = regionData.avgDurationMinutes.toFixed(1);
                displayUnit = '分鐘';
            }

            // 計算正規化值和熱力值（使用當前數據集的範圍）
            let normalizedValue = 0;
            if (dataMaxValue > dataMinValue) {
                const rawValue = metric === 'visitCount' ? regionData.visitCount :
                               metric === 'totalDuration' ? regionData.totalDurationMinutes :
                               regionData.avgDurationMinutes;
                normalizedValue = (rawValue - dataMinValue) / (dataMaxValue - dataMinValue);
                normalizedValue = Math.max(0, Math.min(1, normalizedValue));
            } else {
                normalizedValue = 0.5; // 所有值相同時設為中間值
            }
            const heatValue = (normalizedValue * 100).toFixed(1);

            // 顏色指示
            let colorIndicator = '';
            if (normalizedValue >= 0.8) colorIndicator = '🔴';
            else if (normalizedValue >= 0.6) colorIndicator = '🟠';
            else if (normalizedValue >= 0.4) colorIndicator = '🟡';
            else if (normalizedValue >= 0.2) colorIndicator = '🟢';
            else colorIndicator = '🔵';

            html += `
                <div class="region-item-data">
                    <div class="region-data-item">
                        <span class="region-data-label">訪問人次</span>
                        <span class="region-data-value">${regionData.visitCount}</span>
                    </div>
                    <div class="region-data-item">
                        <span class="region-data-label">總停留</span>
                        <span class="region-data-value">${regionData.totalDurationMinutes.toFixed(1)}分</span>
                    </div>
                    <div class="region-data-item">
                        <span class="region-data-label">平均停留</span>
                        <span class="region-data-value">${regionData.avgDurationMinutes.toFixed(1)}分</span>
                    </div>
                </div>
                <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 0.85em;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #666;">熱力圖使用: <strong>${displayValue}${displayUnit}</strong></span>
                        <span style="font-size: 1.2em;">${colorIndicator}</span>
                    </div>
                    <div style="margin-top: 4px; color: #999; font-size: 0.9em;">
                        正規化值: ${(normalizedValue * 100).toFixed(1)}% (範圍: ${dataMinValue.toFixed(1)}-${dataMaxValue.toFixed(1)})
                    </div>
                </div>
            `;
        } else {
            html += `
                <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 0.85em; color: #999; text-align: center;">
                    播放時間軸後將顯示數據
                </div>
            `;
        }

        item.innerHTML = html;
        listEl.appendChild(item);
    });

    const drawnRegionsEl = document.getElementById('drawnRegions');
    if (drawnRegionsEl) {
        drawnRegionsEl.textContent = drawnRegions.length;
    }
}

// 更新播放按鈕狀態
function updateGenerateButton() {
    const hasRegions = drawnRegions.length > 0;

    const playTimelineBtn = document.getElementById('playTimelineBtn');
    if (playTimelineBtn) {
        playTimelineBtn.disabled = !hasRegions;
    }

    const quickPlayBtn = document.getElementById('quickPlayBtn');
    if (quickPlayBtn) {
        quickPlayBtn.disabled = !hasRegions;
    }
}

// 刷新當前熱力圖（重新套用設定參數）
function refreshCurrentHeatmap() {
    if (!timelineData || timelineData.length === 0) {
        alert('請先播放時間軸！');
        return;
    }

    if (currentTimeIndex < 0 || currentTimeIndex >= timelineData.length) {
        alert('沒有可刷新的熱力圖！');
        return;
    }

    // 取得當前時間點的資料
    const currentData = timelineData[currentTimeIndex];

    // 取得播放速度（從快速控制或控制面板）
    const playbackIntervalEl = document.getElementById('playbackInterval');
    const quickPlaybackSpeedEl = document.getElementById('quickPlaybackSpeed');
    const playbackInterval = playbackIntervalEl ?
        parseInt(playbackIntervalEl.value) :
        (quickPlaybackSpeedEl ? parseInt(quickPlaybackSpeedEl.value) : 1000);

    // 重新繪製熱力圖（會套用最新的設定參數）
    drawHeatmapOnRegions(currentData.data, playbackInterval);

    // 更新區域列表（會套用最新的指標）
    updateRegionList(currentData.data,
        parseFloat(document.getElementById('heatmapMinValue').value),
        parseFloat(document.getElementById('heatmapMaxValue').value));

    console.log('熱力圖已刷新，套用最新設定');
}

// 查詢熱力圖資料（供時間軸使用）
async function fetchHeatmapData(startTime, endTime) {
    // 取得所有繪製區域的 area IDs（支援新舊格式）
    const allAreaIds = [];
    drawnRegions.forEach(region => {
        if (region.areaIds) {
            allAreaIds.push(...region.areaIds);
        } else if (region.areaId) {
            allAreaIds.push(region.areaId);
        }
    });

    const uniqueAreaIds = [...new Set(allAreaIds)];

    // 取得停留時間範圍設定
    const minDurationSeconds = parseInt(document.getElementById('minDuration').value);
    const maxDurationSeconds = parseInt(document.getElementById('maxDuration').value);

    // 查詢熱力圖資料
    const response = await fetch(`${API_BASE}/heatmap`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            areaIds: uniqueAreaIds,
            startTime: startTime,
            endTime: endTime,
            minDurationSeconds: minDurationSeconds,
            maxDurationSeconds: maxDurationSeconds
        })
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message);
    }

    return result.data;
}

// 在繪製的區域上繪製熱力圖
function drawHeatmapOnRegions(heatmapData, playbackInterval) {
    if (heatmapData.length === 0) {
        // 清空區域數據顯示
        updateRegionList(null);
        currentHeatmapData = null;
        return;
    }

    // 儲存當前熱力圖資料（用於提示框）
    currentHeatmapData = heatmapData;

    // 重繪 Canvas 確保底圖和區域可見
    redrawCanvas();

    // 執行實際的熱力圖更新
    updateHeatmapData(heatmapData);
}

// 實際更新熱力圖數據的函數
function updateHeatmapData(heatmapData) {
    // 取得用戶選擇的指標
    const metric = document.getElementById('heatmapMetric').value;

    // 取得用戶設定的固定範圍
    const userMinValue = parseFloat(document.getElementById('heatmapMinValue').value);
    const userMaxValue = parseFloat(document.getElementById('heatmapMaxValue').value);

    // 更新區域列表顯示實際數據（傳入用戶設定的範圍）
    updateRegionList(heatmapData, userMinValue, userMaxValue);

    // 生成熱力圖資料點
    const heatPoints = [];

    heatmapData.forEach(data => {
        // 找到對應的繪製區域（支援新舊格式）
        const region = drawnRegions.find(r => {
            if (r.areaIds) {
                // 新格式：檢查是否包含此 area_id
                return r.areaIds.includes(data.areaId);
            } else if (r.areaId) {
                // 舊格式：直接比對
                return r.areaId === data.areaId;
            }
            return false;
        });

        if (!region) {
            return;
        }

        // 檢查區域是否被隱藏（預設為顯示）
        const isVisible = regionVisibilityMap.get(data.areaName) !== false;
        if (!isVisible) {
            return; // 跳過被隱藏的區域
        }

        // 計算區域中心點
        const centerX = region.points.reduce((sum, p) => sum + p.x, 0) / region.points.length;
        const centerY = region.points.reduce((sum, p) => sum + p.y, 0) / region.points.length;

        // 取得當前區域的指標值
        let rawValue = 0;
        if (metric === 'totalDuration') {
            rawValue = data.totalDurationMinutes;
        } else if (metric === 'visitCount') {
            rawValue = data.visitCount;
        } else if (metric === 'avgDuration') {
            rawValue = data.avgDurationMinutes;
        }

        // 使用用戶設定的固定範圍進行正規化
        let normalizedValue = 0;
        if (userMaxValue > userMinValue) {
            // 線性映射到 0-1
            normalizedValue = (rawValue - userMinValue) / (userMaxValue - userMinValue);
            // 限制在 0-1 範圍內
            normalizedValue = Math.max(0, Math.min(1, normalizedValue));
        } else {
            normalizedValue = 0;
        }

        // 映射到 0-100
        let value = normalizedValue * 100;

        // 在整個多邊形區域內均勻生成熱力點
        // 找出多邊形的邊界框
        const minX = Math.min(...region.points.map(p => p.x));
        const maxX = Math.max(...region.points.map(p => p.x));
        const minY = Math.min(...region.points.map(p => p.y));
        const maxY = Math.max(...region.points.map(p => p.y));

        // 計算需要的點密度（根據區域大小和 radius）
        const areaWidth = maxX - minX;
        const areaHeight = maxY - minY;

        // 網格間距根據 radius 調整，但確保最小密度
        const heatmapRadius = parseInt(document.getElementById('heatmapRadius').value);
        const gridSize = Math.max(5, Math.floor(heatmapRadius * 0.4)); // 降低到 40%，增加點密度
        const pointsX = Math.max(3, Math.ceil(areaWidth / gridSize)); // 至少 3x3 網格
        const pointsY = Math.max(3, Math.ceil(areaHeight / gridSize));

        // 在網格上生成點，只保留在多邊形內的點
        let pointsGenerated = 0;
        for (let i = 0; i <= pointsX; i++) {
            for (let j = 0; j <= pointsY; j++) {
                const x = minX + (areaWidth * i / pointsX);
                const y = minY + (areaHeight * j / pointsY);

                // 檢查點是否在多邊形內
                if (isPointInPolygon({ x, y }, region.points)) {
                    heatPoints.push({
                        x: Math.floor(x),
                        y: Math.floor(y),
                        value: value
                    });
                    pointsGenerated++;
                }
            }
        }

        // 如果沒有生成任何點，至少在中心點生成一個
        if (pointsGenerated === 0) {
            const centerX = region.points.reduce((sum, p) => sum + p.x, 0) / region.points.length;
            const centerY = region.points.reduce((sum, p) => sum + p.y, 0) / region.points.length;
            heatPoints.push({
                x: Math.floor(centerX),
                y: Math.floor(centerY),
                value: value
            });
            pointsGenerated = 1;
        }
    });

    // 清除舊的熱力圖
    if (heatmapInstance) {
        heatmapInstance = null;
    }

    // 清空熱力圖容器
    const heatmapContainer = document.getElementById('heatmapContainer');
    heatmapContainer.innerHTML = '';

    // 獲取 canvas 的位置和尺寸
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();

    // 設定熱力圖容器的位置和尺寸，使其與 canvas 完全對齊
    heatmapContainer.style.position = 'absolute';
    heatmapContainer.style.left = (canvasRect.left - containerRect.left) + 'px';
    heatmapContainer.style.top = (canvasRect.top - containerRect.top) + 'px';
    heatmapContainer.style.width = canvas.width + 'px';
    heatmapContainer.style.height = canvas.height + 'px';
    heatmapContainer.style.pointerEvents = 'none';

    // 取得用戶設定的 radius
    const heatmapRadius = parseInt(document.getElementById('heatmapRadius').value);

    // 建立新的熱力圖，使用用戶設定的 radius
    heatmapInstance = h337.create({
        container: heatmapContainer,
        radius: heatmapRadius,  // 使用用戶設定的半徑
        maxOpacity: 0.65,  // 最大不透明度
        minOpacity: 0.05,  // 降低最小不透明度，讓小值更淡
        blur: 0.95,        // 提高模糊度，讓邊界更柔和、漸層更平滑
        gradient: {        // 調整漸變色，讓低值更透明
            0.0:  'rgba(0, 0, 255, 0.1)',    // 0% - 很淺的藍色
            0.05: 'rgba(0, 50, 255, 0.2)',   // 5% - 淺藍色
            0.1:  'rgba(0, 100, 255, 0.3)',  // 10% - 藍色
            0.2:  'rgba(0, 150, 255, 0.45)', // 20% - 亮藍色
            0.3:  'rgba(0, 200, 200, 0.55)', // 30% - 青色
            0.4:  'rgba(0, 230, 150, 0.6)',  // 40% - 青綠色
            0.5:  'rgba(100, 255, 100, 0.65)', // 50% - 綠色
            0.6:  'rgba(180, 255, 0, 0.7)',  // 60% - 黃綠色
            0.7:  'rgba(255, 255, 0, 0.75)', // 70% - 黃色
            0.8:  'rgba(255, 180, 0, 0.8)',  // 80% - 橘色
            0.9:  'rgba(255, 100, 0, 0.85)', // 90% - 橘紅色
            1.0:  'rgba(255, 0, 0, 0.9)'     // 100% - 紅色
        },
        backgroundColor: 'transparent'
    });

    // 設定數據，max 設為 100（對應 normalizedValue * 100）
    heatmapInstance.setData({
        max: 100,
        min: 0,
        data: heatPoints
    });
}

// 在多邊形內生成隨機點
function getRandomPointInPolygon(points) {
    if (points.length < 3) return null;

    // 找出多邊形的邊界框
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    // 嘗試生成點（最多100次）
    for (let i = 0; i < 100; i++) {
        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);

        if (isPointInPolygon({ x, y }, points)) {
            return { x, y };
        }
    }

    // 如果無法生成，返回中心點
    return {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length
    };
}

// 判斷點是否在多邊形內（射線法）
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 更新統計資訊
function updateStatistics(data) {
    const totalVisitsEl = document.getElementById('totalVisits');
    const totalDurationEl = document.getElementById('totalDuration');

    // 檢查元素是否存在（已從 HTML 移除）
    if (!totalVisitsEl || !totalDurationEl) return;

    const totalVisits = data.reduce((sum, area) => sum + area.visitCount, 0);
    const totalDurationMinutes = data.reduce((sum, area) => sum + area.totalDurationMinutes, 0);

    totalVisitsEl.textContent = totalVisits.toLocaleString();
    totalDurationEl.textContent = formatDuration(totalDurationMinutes);
}

// 更新即時排名
function updateRanking(data) {
    const rankingList = document.getElementById('rankingList');

    if (!data || data.length === 0) {
        rankingList.innerHTML = '<div class="ranking-empty">無資料</div>';
        return;
    }

    // 按照 areaName 合併資料（同名區域加總）
    const mergedData = {};
    data.forEach(area => {
        const name = area.areaName;
        if (!mergedData[name]) {
            mergedData[name] = {
                areaName: name,
                visitCount: 0,
                totalDurationMinutes: 0
            };
        }
        mergedData[name].visitCount += area.visitCount;
        mergedData[name].totalDurationMinutes += area.totalDurationMinutes;
    });

    // 計算平均停留時間
    const mergedArray = Object.values(mergedData).map(area => ({
        ...area,
        avgDurationMinutes: area.visitCount > 0 ? area.totalDurationMinutes / area.visitCount : 0
    }));

    // 計算總計（用於顯示）
    const totalVisits = mergedArray.reduce((sum, area) => sum + area.visitCount, 0);
    const totalDuration = mergedArray.reduce((sum, area) => sum + area.totalDurationMinutes, 0);

    // 取得當前選擇的指標
    const metric = document.getElementById('heatmapMetric').value;

    // 根據指標排序
    const sortedData = [...mergedArray].sort((a, b) => {
        if (metric === 'totalDuration') {
            return b.totalDurationMinutes - a.totalDurationMinutes;
        } else if (metric === 'visitCount') {
            return b.visitCount - a.visitCount;
        } else if (metric === 'avgDuration') {
            return b.avgDurationMinutes - a.avgDurationMinutes;
        }
        return 0;
    });

    // 取前 10 名
    const topData = sortedData.slice(0, 10);

    // 找出最大值用於計算百分比
    const maxValue = topData.length > 0 ?
        (metric === 'totalDuration' ? topData[0].totalDurationMinutes :
         metric === 'visitCount' ? topData[0].visitCount :
         topData[0].avgDurationMinutes) : 1;

    // 生成排名 HTML
    let html = '';
    topData.forEach((area, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';

        let value, unit, displayValue;
        if (metric === 'totalDuration') {
            value = area.totalDurationMinutes;
            displayValue = value.toFixed(1);
            unit = '分鐘';
        } else if (metric === 'visitCount') {
            value = area.visitCount;
            displayValue = value;
            unit = '人次';
        } else {
            value = area.avgDurationMinutes;
            displayValue = value.toFixed(1);
            unit = '分鐘';
        }

        const percentage = maxValue > 0 ? (value / maxValue * 100) : 0;

        // 檢查區域顯示狀態（預設為顯示）
        const isVisible = regionVisibilityMap.get(area.areaName) !== false;
        const eyeIcon = isVisible ? '👁️' : '⚫';
        const eyeClass = isVisible ? '' : 'hidden';

        html += `
            <div class="ranking-item">
                <div class="ranking-number ${rankClass}">${rank}</div>
                <div class="ranking-info">
                    <div class="ranking-name" title="${area.areaName}">${area.areaName}</div>
                    <div class="ranking-value">${displayValue} ${unit}</div>
                    <div class="ranking-bar">
                        <div class="ranking-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="ranking-eye-icon ${eyeClass}" onclick="toggleRegionVisibility('${area.areaName}')" title="${isVisible ? '點擊隱藏' : '點擊顯示'}">
                    ${eyeIcon}
                </div>
            </div>
        `;
    });

    // 添加總計資訊（如果有超過10個區域）
    if (mergedArray.length > 10) {
        html += `
            <div style="margin-top: 10px; padding: 10px; background: #e9ecef; border-radius: 6px; font-size: 0.85em;">
                <div style="color: #666;">顯示前 10 名，共 ${mergedArray.length} 個區域</div>
                <div style="margin-top: 5px; color: #667eea; font-weight: bold;">
                    總計：${totalVisits.toLocaleString()} 人次
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="margin-top: 10px; padding: 10px; background: #e9ecef; border-radius: 6px; font-size: 0.85em;">
                <div style="color: #667eea; font-weight: bold;">
                    總計：${totalVisits.toLocaleString()} 人次
                </div>
            </div>
        `;
    }

    rankingList.innerHTML = html;
}

// 格式化時間長度
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);

    if (hours > 0) {
        return `${hours}小時${mins}分鐘`;
    } else {
        return `${mins}分鐘`;
    }
}

// 生成隨機顏色
function getRandomColor() {
    const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0',
        '#a8edea', '#fed6e3', '#c471f5', '#fa71cd'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ========== 時間軸播放功能 ==========

// 切換時間軸播放
async function toggleTimelinePlayback() {
    if (isPlaying) {
        pauseTimelinePlayback();
    } else {
        if (isPaused) {
            // 恢復播放
            resumeTimelinePlayback();
        } else {
            // 開始新的播放
            await startTimelinePlayback();
        }
    }
}

// 開始時間軸播放
async function startTimelinePlayback() {
    if (drawnRegions.length === 0) {
        alert('請先繪製至少一個區域！');
        return;
    }

    // 嘗試從控制面板或快速設定取得時間
    const startTimeEl = document.getElementById('startTime');
    const endTimeEl = document.getElementById('endTime');
    const quickStartTimeEl = document.getElementById('quickStartTime');
    const quickEndTimeEl = document.getElementById('quickEndTime');

    const startTime = startTimeEl ? startTimeEl.value : (quickStartTimeEl ? quickStartTimeEl.value : null);
    const endTime = endTimeEl ? endTimeEl.value : (quickEndTimeEl ? quickEndTimeEl.value : null);

    if (!startTime || !endTime) {
        alert('請選擇時間區間！');
        return;
    }

    try {
        const playTimelineBtn = document.getElementById('playTimelineBtn');
        if (playTimelineBtn) {
            playTimelineBtn.disabled = true;
            playTimelineBtn.textContent = '載入中...';
        }

        // 取得時間軸資料
        await loadTimelineData(startTime, endTime);

        if (!timelineData || timelineData.length === 0) {
            if (playTimelineBtn) {
                playTimelineBtn.disabled = false;
                playTimelineBtn.textContent = '▶ 播放時間軸';
            }
            alert('該時間區間內沒有資料\n\n可能原因：\n1. 資料庫中該時間範圍沒有記錄\n2. 所選區域在該時間範圍沒有訪客\n3. 停留時間篩選條件過於嚴格\n\n建議：\n- 檢查資料庫是否有該時段的資料\n- 嘗試放寬停留時間條件');
            return;
        }

        // 開始播放
        isPlaying = true;
        isPaused = false;
        currentTimeIndex = 0;

        if (playTimelineBtn) {
            playTimelineBtn.textContent = '⏸ 暫停';
        }

        const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
        if (pauseTimelineBtn) {
            pauseTimelineBtn.disabled = false;
        }

        const stopTimelineBtn = document.getElementById('stopTimelineBtn');
        if (stopTimelineBtn) {
            stopTimelineBtn.disabled = false;
        }

        const currentTimeDisplay = document.getElementById('currentTimeDisplay');
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = formatTimelineTime(timelineData[0].time);
        }

        // 更新快速控制按鈕狀態
        const quickPlayBtn = document.getElementById('quickPlayBtn');
        if (quickPlayBtn) {
            quickPlayBtn.textContent = '⏸ 暫停';
            quickPlayBtn.disabled = false;
        }

        const quickPauseBtn = document.getElementById('quickPauseBtn');
        if (quickPauseBtn) {
            quickPauseBtn.disabled = false;
        }

        const quickStopBtn = document.getElementById('quickStopBtn');
        if (quickStopBtn) {
            quickStopBtn.disabled = false;
        }

        const quickRefreshBtn = document.getElementById('quickRefreshBtn');
        if (quickRefreshBtn) {
            quickRefreshBtn.disabled = false;
        }

        // 顯示時間浮水印
        const watermark = document.getElementById('timeWatermark');
        if (watermark) {
            watermark.style.display = 'block';
            watermark.textContent = formatTimelineTime(timelineData[0].time);
        }

        // 顯示排名面板
        const rankingPanel = document.getElementById('rankingPanel');
        if (rankingPanel) {
            rankingPanel.style.display = 'flex';
        }

        // 啟用並重置兩個進度條
        const progressBar = document.getElementById('timelineProgressBar');
        if (progressBar) {
            progressBar.disabled = false;
            progressBar.max = timelineData.length - 1;
            progressBar.value = 0;
        }

        const timelineBar = document.getElementById('timelineBar');
        if (timelineBar) {
            timelineBar.disabled = false;
            timelineBar.max = timelineData.length - 1;
            timelineBar.value = 0;
        }

        // 更新地圖下方的時間顯示
        const timelineBarTime = document.getElementById('timelineBarTime');
        if (timelineBarTime) {
            timelineBarTime.textContent = formatTimelineTime(timelineData[0].time);
        }

        const timelineBarProgress = document.getElementById('timelineBarProgress');
        if (timelineBarProgress) {
            timelineBarProgress.textContent = `1 / ${timelineData.length}`;
        }

        playNextFrame();

    } catch (error) {
        console.error('載入時間軸資料失敗：', error);
        alert('載入時間軸資料失敗：' + error.message);
        const playTimelineBtn = document.getElementById('playTimelineBtn');
        if (playTimelineBtn) {
            playTimelineBtn.disabled = false;
            playTimelineBtn.textContent = '▶ 播放時間軸';
        }
    }
}

// 暫停時間軸播放
function pauseTimelinePlayback() {
    if (!isPlaying) return;

    isPlaying = false;
    isPaused = true;

    if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
    }

    const playTimelineBtn = document.getElementById('playTimelineBtn');
    if (playTimelineBtn) {
        playTimelineBtn.textContent = '▶ 繼續播放';
    }

    const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
    if (pauseTimelineBtn) {
        pauseTimelineBtn.disabled = true;
    }

    // 更新快速控制按鈕狀態
    const quickPlayBtn = document.getElementById('quickPlayBtn');
    if (quickPlayBtn) {
        quickPlayBtn.textContent = '▶ 繼續';
    }

    const quickPauseBtn = document.getElementById('quickPauseBtn');
    if (quickPauseBtn) {
        quickPauseBtn.disabled = true;
    }
    // 暫停時仍可刷新
}

// 恢復時間軸播放
function resumeTimelinePlayback() {
    if (!isPaused || !timelineData) return;

    isPlaying = true;
    isPaused = false;

    const playTimelineBtn = document.getElementById('playTimelineBtn');
    if (playTimelineBtn) {
        playTimelineBtn.textContent = '⏸ 暫停';
    }

    const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
    if (pauseTimelineBtn) {
        pauseTimelineBtn.disabled = false;
    }

    // 更新快速控制按鈕狀態
    const quickPlayBtn = document.getElementById('quickPlayBtn');
    if (quickPlayBtn) {
        quickPlayBtn.textContent = '⏸ 暫停';
    }

    const quickPauseBtn = document.getElementById('quickPauseBtn');
    if (quickPauseBtn) {
        quickPauseBtn.disabled = false;
    }

    playNextFrame();
}

// 停止時間軸播放
function stopTimelinePlayback() {
    isPlaying = false;
    isPaused = false;

    if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
    }

    currentTimeIndex = 0;

    const playTimelineBtn = document.getElementById('playTimelineBtn');
    if (playTimelineBtn) {
        playTimelineBtn.textContent = '▶ 播放時間軸';
        playTimelineBtn.disabled = false;
    }

    const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
    if (pauseTimelineBtn) {
        pauseTimelineBtn.disabled = true;
    }

    const stopTimelineBtn = document.getElementById('stopTimelineBtn');
    if (stopTimelineBtn) {
        stopTimelineBtn.disabled = true;
    }

    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = '-';
    }

    const timelineProgress = document.getElementById('timelineProgress');
    if (timelineProgress) {
        timelineProgress.textContent = '-';
    }

    // 更新快速控制按鈕狀態
    const quickPlayBtn = document.getElementById('quickPlayBtn');
    if (quickPlayBtn) {
        quickPlayBtn.textContent = '▶ 播放';
        quickPlayBtn.disabled = false;
    }

    const quickPauseBtn = document.getElementById('quickPauseBtn');
    if (quickPauseBtn) {
        quickPauseBtn.disabled = true;
    }

    const quickStopBtn = document.getElementById('quickStopBtn');
    if (quickStopBtn) {
        quickStopBtn.disabled = true;
    }

    const quickRefreshBtn = document.getElementById('quickRefreshBtn');
    if (quickRefreshBtn) {
        quickRefreshBtn.disabled = true;
    }

    // 隱藏時間浮水印
    const watermark = document.getElementById('timeWatermark');
    if (watermark) {
        watermark.style.display = 'none';
    }

    // 隱藏排名面板
    const rankingPanel = document.getElementById('rankingPanel');
    if (rankingPanel) {
        rankingPanel.style.display = 'none';
    }

    // 重置並禁用兩個進度條
    const progressBar = document.getElementById('timelineProgressBar');
    if (progressBar) {
        progressBar.value = 0;
        progressBar.disabled = true;
    }

    const timelineBar = document.getElementById('timelineBar');
    if (timelineBar) {
        timelineBar.value = 0;
        timelineBar.disabled = true;
    }

    // 清除熱力圖
    if (heatmapInstance) {
        heatmapInstance = null;
    }
    const heatmapContainer = document.getElementById('heatmapContainer');
    if (heatmapContainer) {
        heatmapContainer.innerHTML = '';
    }

    // 清除熱力圖資料
    currentHeatmapData = null;
    previousHeatmapData = null;

    // 隱藏提示框
    hideTooltip();

    // 重繪底圖
    redrawCanvas();
}

// 載入時間軸資料
async function loadTimelineData(startTime, endTime) {
    // 取得所有繪製區域的 area IDs（支援新舊格式）
    const allAreaIds = [];
    drawnRegions.forEach(region => {
        if (region.areaIds) {
            allAreaIds.push(...region.areaIds);
        } else if (region.areaId) {
            allAreaIds.push(region.areaId);
        }
    });
    const areaIds = [...new Set(allAreaIds)]; // 去除重複

    // 取得時間區間設定（從快速設定或控制面板）
    const timelineIntervalEl = document.getElementById('timelineInterval');
    const quickTimeIntervalEl = document.getElementById('quickTimeInterval');
    const intervalMinutes = timelineIntervalEl ?
        parseInt(timelineIntervalEl.value) :
        (quickTimeIntervalEl ? parseInt(quickTimeIntervalEl.value) : 60);

    const minDurationSeconds = parseInt(document.getElementById('minDuration').value);
    const maxDurationSeconds = parseInt(document.getElementById('maxDuration').value);

    // 查詢詳細統計資料
    const response = await fetch(`${API_BASE}/statistics`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            areaIds: areaIds,
            startTime: startTime,
            endTime: endTime,
            minDurationSeconds: minDurationSeconds,
            maxDurationSeconds: maxDurationSeconds
        })
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message);
    }

    if (!result.records || result.records.length === 0) {
        timelineData = [];
        return;
    }

    // 將資料按時間區間分組
    timelineData = groupDataByTimeInterval(result.records, intervalMinutes);
}

// 將資料按時間區間分組
function groupDataByTimeInterval(records, intervalMinutes) {
    if (!records || records.length === 0) {
        return [];
    }

    try {
        // 找出時間範圍（使用更安全的方式）
        let minTime = Infinity;
        let maxTime = -Infinity;
        let validCount = 0;

        for (let i = 0; i < records.length; i++) {
            const time = new Date(records[i].enterTime).getTime();
            if (!isNaN(time) && time > 0) {
                if (time < minTime) minTime = time;
                if (time > maxTime) maxTime = time;
                validCount++;
            }
        }

        if (validCount === 0 || minTime === Infinity) {
            console.error('沒有有效的時間記錄');
            return [];
        }

        const intervalMs = intervalMinutes * 60 * 1000;
        const totalSlots = Math.ceil((maxTime - minTime) / intervalMs);

        // 限制最大時間片段數量，避免堆疊溢出和記憶體問題
        const maxSlots = 500;  // 降低上限以避免問題

        if (totalSlots > maxSlots) {
            const minIntervalMinutes = Math.ceil((maxTime - minTime) / (maxSlots * 60 * 1000));
            console.error(`時間片段數量過多 (${totalSlots})，超過限制 (${maxSlots})`);
            alert(`時間範圍太大！\n\n當前設定會產生 ${totalSlots} 個時間片段，超過系統限制 (${maxSlots})。\n\n請選擇以下方案：\n1. 縮小時間範圍（建議）\n2. 將時間區間增加到至少 ${minIntervalMinutes} 分鐘`);
            return [];
        }

        // 使用 Map 來提高效能
        const timeSlotsMap = new Map();

        // 將每筆記錄分配到對應的時間片段
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const enterTime = new Date(record.enterTime).getTime();

            if (isNaN(enterTime) || enterTime < minTime || enterTime > maxTime) {
                continue;
            }

            // 計算這筆記錄屬於哪個時間片段
            const slotIndex = Math.floor((enterTime - minTime) / intervalMs);
            const slotTime = minTime + (slotIndex * intervalMs);

            // 取得或建立該時間片段
            if (!timeSlotsMap.has(slotTime)) {
                timeSlotsMap.set(slotTime, {});
            }

            const areaData = timeSlotsMap.get(slotTime);
            const areaId = record.areaId;

            // 累加該區域的資料
            if (!areaData[areaId]) {
                areaData[areaId] = {
                    areaId: areaId,
                    areaName: record.areaName,
                    areaNumber: record.areaNumber,
                    visitCount: 0,
                    totalDurationMinutes: 0
                };
            }

            areaData[areaId].visitCount++;
            areaData[areaId].totalDurationMinutes += (record.durationMinutes || 0);
        }

        // 轉換為陣列並計算平均值
        const timeSlots = [];
        timeSlotsMap.forEach((areaData, time) => {
            const areas = Object.values(areaData);
            areas.forEach(area => {
                area.avgDurationMinutes = area.visitCount > 0 ? area.totalDurationMinutes / area.visitCount : 0;
            });

            timeSlots.push({
                time: new Date(time),
                data: areas
            });
        });

        // 按時間排序
        timeSlots.sort((a, b) => a.time.getTime() - b.time.getTime());

        return timeSlots;

    } catch (error) {
        console.error('分組資料時發生錯誤:', error);
        console.error('錯誤堆疊:', error.stack);
        alert('處理時間軸資料時發生錯誤：' + error.message + '\n\n請嘗試縮小時間範圍或增加時間區間。');
        return [];
    }
}

// 播放下一幀
function playNextFrame() {
    if (!isPlaying || currentTimeIndex >= timelineData.length) {
        // 播放完成
        isPlaying = false;
        isPaused = false;
        if (playbackTimer) {
            clearTimeout(playbackTimer);
            playbackTimer = null;
        }

        const playTimelineBtn = document.getElementById('playTimelineBtn');
        if (playTimelineBtn) {
            playTimelineBtn.textContent = '▶ 播放時間軸';
        }

        const pauseTimelineBtn = document.getElementById('pauseTimelineBtn');
        if (pauseTimelineBtn) {
            pauseTimelineBtn.disabled = true;
        }

        // 更新快速控制按鈕狀態
        const quickPlayBtn = document.getElementById('quickPlayBtn');
        if (quickPlayBtn) {
            quickPlayBtn.textContent = '▶ 播放';
        }

        const quickPauseBtn = document.getElementById('quickPauseBtn');
        if (quickPauseBtn) {
            quickPauseBtn.disabled = true;
        }
        // 播放完成後仍可刷新最後一幀

        alert('時間軸播放完成！');
        return;
    }

    // 取得當前時間點的資料
    const currentData = timelineData[currentTimeIndex];

    // 更新時間顯示
    const timeText = formatTimelineTime(currentData.time);
    const progressText = `${currentTimeIndex + 1} / ${timelineData.length}`;

    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = timeText;
    }

    const timelineProgress = document.getElementById('timelineProgress');
    if (timelineProgress) {
        timelineProgress.textContent = progressText;
    }

    // 更新時間浮水印
    const watermark = document.getElementById('timeWatermark');
    if (watermark) {
        watermark.textContent = timeText;
    }

    // 更新地圖下方的時間顯示
    const timelineBarTime = document.getElementById('timelineBarTime');
    if (timelineBarTime) {
        timelineBarTime.textContent = timeText;
    }

    const timelineBarProgress = document.getElementById('timelineBarProgress');
    if (timelineBarProgress) {
        timelineBarProgress.textContent = progressText;
    }

    // 更新兩個進度條（只有在用戶沒有拖拉時才更新）
    if (!isUserDragging) {
        const progressBar = document.getElementById('timelineProgressBar');
        if (progressBar) {
            progressBar.value = currentTimeIndex;
        }

        const timelineBar = document.getElementById('timelineBar');
        if (timelineBar) {
            timelineBar.value = currentTimeIndex;
        }
    }

    // 取得播放速度（從快速控制或控制面板）
    const playbackIntervalEl = document.getElementById('playbackInterval');
    const quickPlaybackSpeedEl = document.getElementById('quickPlaybackSpeed');
    const playbackInterval = playbackIntervalEl ?
        parseInt(playbackIntervalEl.value) :
        (quickPlaybackSpeedEl ? parseInt(quickPlaybackSpeedEl.value) : 1000);

    // 儲存前一時間點的資料（用於提示框比較）
    if (currentTimeIndex > 0) {
        previousHeatmapData = timelineData[currentTimeIndex - 1].data;
    } else {
        previousHeatmapData = null;
    }

    // 繪製熱力圖（傳入播放速度用於動畫）
    drawHeatmapOnRegions(currentData.data, playbackInterval);

    // 更新統計資訊
    updateStatistics(currentData.data);

    // 更新排名
    updateRanking(currentData.data);

    // 移到下一幀
    currentTimeIndex++;

    // 設定下一幀的計時器
    playbackTimer = setTimeout(() => {
        playNextFrame();
    }, playbackInterval);
}

// 格式化時間軸時間
function formatTimelineTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 進度條拖拉中
function onProgressBarDrag(e) {
    if (!timelineData || timelineData.length === 0) return;

    isUserDragging = true;
    const newIndex = parseInt(e.target.value);

    // 即時預覽該時間點
    if (newIndex >= 0 && newIndex < timelineData.length) {
        const previewData = timelineData[newIndex];
        const timeText = formatTimelineTime(previewData.time);
        const progressText = `${newIndex + 1} / ${timelineData.length}`;

        // 更新控制面板的時間顯示
        const currentTimeDisplay = document.getElementById('currentTimeDisplay');
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = timeText;
        }

        const timelineProgress = document.getElementById('timelineProgress');
        if (timelineProgress) {
            timelineProgress.textContent = progressText;
        }

        // 更新時間浮水印
        const watermark = document.getElementById('timeWatermark');
        if (watermark) {
            watermark.textContent = timeText;
        }

        // 更新地圖下方的時間顯示
        const timelineBarTime = document.getElementById('timelineBarTime');
        if (timelineBarTime) {
            timelineBarTime.textContent = timeText;
        }

        const timelineBarProgress = document.getElementById('timelineBarProgress');
        if (timelineBarProgress) {
            timelineBarProgress.textContent = progressText;
        }

        // 同步兩個進度條
        const progressBar = document.getElementById('timelineProgressBar');
        if (progressBar) {
            progressBar.value = newIndex;
        }
        const timelineBar = document.getElementById('timelineBar');
        if (timelineBar) {
            timelineBar.value = newIndex;
        }
    }
}

// 進度條拖拉完成
function onProgressBarChange(e) {
    if (!timelineData || timelineData.length === 0) return;

    const newIndex = parseInt(e.target.value);

    // 跳到指定時間點
    if (newIndex >= 0 && newIndex < timelineData.length) {
        currentTimeIndex = newIndex;

        const currentData = timelineData[currentTimeIndex];
        const timeText = formatTimelineTime(currentData.time);
        const progressText = `${currentTimeIndex + 1} / ${timelineData.length}`;

        // 更新控制面板顯示
        const currentTimeDisplay = document.getElementById('currentTimeDisplay');
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = timeText;
        }

        const timelineProgress = document.getElementById('timelineProgress');
        if (timelineProgress) {
            timelineProgress.textContent = progressText;
        }

        // 更新時間浮水印
        const watermark = document.getElementById('timeWatermark');
        if (watermark) {
            watermark.textContent = timeText;
        }

        // 更新地圖下方的時間顯示
        const timelineBarTime = document.getElementById('timelineBarTime');
        if (timelineBarTime) {
            timelineBarTime.textContent = timeText;
        }

        const timelineBarProgress = document.getElementById('timelineBarProgress');
        if (timelineBarProgress) {
            timelineBarProgress.textContent = progressText;
        }

        // 取得播放速度（從快速控制或控制面板）
        const playbackIntervalEl = document.getElementById('playbackInterval');
        const quickPlaybackSpeedEl = document.getElementById('quickPlaybackSpeed');
        const playbackInterval = playbackIntervalEl ?
            parseInt(playbackIntervalEl.value) :
            (quickPlaybackSpeedEl ? parseInt(quickPlaybackSpeedEl.value) : 1000);

        // 繪製該時間點的熱力圖（傳入播放速度用於動畫）
        drawHeatmapOnRegions(currentData.data, playbackInterval);

        // 更新統計資訊
        updateStatistics(currentData.data);

        // 更新排名
        updateRanking(currentData.data);
    }

    isUserDragging = false;
}

// Canvas 滑鼠移動事件處理（熱力圖提示框）
function onCanvasMouseMoveForTooltip(e) {
    // 如果沒有熱力圖資料或正在繪製區域，不顯示提示框
    if (!currentHeatmapData || isDrawing) {
        hideTooltip();
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 檢查滑鼠是否在任何繪製的區域內
    let hoveredRegion = null;
    for (const region of drawnRegions) {
        if (isPointInPolygon({ x, y }, region.points)) {
            hoveredRegion = region;
            break;
        }
    }

    if (hoveredRegion) {
        // 找到該區域的當前資料
        const areaIds = hoveredRegion.areaIds || [hoveredRegion.areaId];

        // 合併所有相關 area_id 的數據
        const currentAreaData = currentHeatmapData.filter(data => areaIds.includes(data.areaId));
        const previousAreaData = previousHeatmapData ?
            previousHeatmapData.filter(data => areaIds.includes(data.areaId)) : null;

        if (currentAreaData.length > 0) {
            showTooltip(e.clientX, e.clientY, hoveredRegion, currentAreaData, previousAreaData);
        } else {
            hideTooltip();
        }
    } else {
        hideTooltip();
    }
}

// 顯示提示框
function showTooltip(mouseX, mouseY, region, currentData, previousData) {
    const tooltip = document.getElementById('heatmapTooltip');
    const metric = document.getElementById('heatmapMetric').value;

    // 取得當前時間點
    let currentTimeText = '';
    if (timelineData && currentTimeIndex >= 0 && currentTimeIndex < timelineData.length) {
        currentTimeText = formatTimelineTime(timelineData[currentTimeIndex].time);
    }

    // 計算當前總數據
    const currentTotal = {
        visitCount: currentData.reduce((sum, d) => sum + d.visitCount, 0),
        totalDurationMinutes: currentData.reduce((sum, d) => sum + d.totalDurationMinutes, 0),
        avgDurationMinutes: 0
    };
    currentTotal.avgDurationMinutes = currentTotal.visitCount > 0 ?
        currentTotal.totalDurationMinutes / currentTotal.visitCount : 0;

    // 計算前一時段總數據
    let previousTotal = null;
    if (previousData && previousData.length > 0) {
        previousTotal = {
            visitCount: previousData.reduce((sum, d) => sum + d.visitCount, 0),
            totalDurationMinutes: previousData.reduce((sum, d) => sum + d.totalDurationMinutes, 0),
            avgDurationMinutes: 0
        };
        previousTotal.avgDurationMinutes = previousTotal.visitCount > 0 ?
            previousTotal.totalDurationMinutes / previousTotal.visitCount : 0;
    }

    // 根據指標選擇顯示的值
    let currentValue, previousValue, unit;
    if (metric === 'visitCount') {
        currentValue = currentTotal.visitCount;
        previousValue = previousTotal ? previousTotal.visitCount : 0;
        unit = '人次';
    } else if (metric === 'totalDuration') {
        currentValue = currentTotal.totalDurationMinutes;
        previousValue = previousTotal ? previousTotal.totalDurationMinutes : 0;
        unit = '分鐘';
    } else {
        currentValue = currentTotal.avgDurationMinutes;
        previousValue = previousTotal ? previousTotal.avgDurationMinutes : 0;
        unit = '分鐘';
    }

    // 計算變化比例
    let changePercent = 0;
    let changeClass = 'same';
    let changeIcon = '━';
    if (previousValue > 0) {
        changePercent = ((currentValue - previousValue) / previousValue) * 100;
        if (changePercent > 0) {
            changeClass = 'increase';
            changeIcon = '▲';
        } else if (changePercent < 0) {
            changeClass = 'decrease';
            changeIcon = '▼';
        }
    } else if (currentValue > 0) {
        changeClass = 'increase';
        changeIcon = '▲';
        changePercent = 100;
    }

    // 生成提示框內容
    let html = `
        <div class="tooltip-title">
            ${region.areaName || region.areaNumber}
            ${currentTimeText ? `<div style="font-size: 0.75em; color: #999; font-weight: normal; margin-top: 4px;">${currentTimeText}</div>` : ''}
        </div>
        <div class="tooltip-row">
            <span class="tooltip-label">訪問人次：</span>
            <span class="tooltip-value">${currentTotal.visitCount}</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-label">總停留：</span>
            <span class="tooltip-value">${currentTotal.totalDurationMinutes.toFixed(1)} 分</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-label">平均停留：</span>
            <span class="tooltip-value">${currentTotal.avgDurationMinutes.toFixed(1)} 分</span>
        </div>
    `;

    if (previousTotal) {
        html += `
            <div class="tooltip-change ${changeClass}">
                <strong>${changeIcon} 與前一時段比較：</strong>
                <span>${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%</span>
            </div>
            <div class="tooltip-row" style="font-size: 0.85em; color: #999;">
                <span>前一時段：</span>
                <span>${previousValue.toFixed(unit === '人次' ? 0 : 1)} ${unit}</span>
            </div>
        `;
    }

    tooltip.innerHTML = html;

    // 定位提示框（避免超出螢幕）
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();

    // 將提示框顯示在滑鼠右上方，靠近滑鼠游標
    let left = mouseX + 10;
    let top = mouseY - tooltipRect.height - 10;

    // 如果右邊超出螢幕，顯示在左邊
    if (left + tooltipRect.width > window.innerWidth) {
        left = mouseX - tooltipRect.width - 10;
    }

    // 如果上方超出螢幕，顯示在下方
    if (top < 0) {
        top = mouseY + 10;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// 隱藏提示框
function hideTooltip() {
    const tooltip = document.getElementById('heatmapTooltip');
    tooltip.style.display = 'none';
}

// ========== 雙端點滑桿功能 ==========

// 初始化雙端點滑桿
function initializeRangeSlider() {
    const rangeMin = document.getElementById('rangeMin');
    const rangeMax = document.getElementById('rangeMax');
    const rangeMinValue = document.getElementById('rangeMinValue');
    const rangeMaxValue = document.getElementById('rangeMaxValue');
    const rangeSliderRange = document.getElementById('rangeSliderRange');

    // 檢查所有必需的元素是否存在
    if (!rangeMin || !rangeMax || !rangeMinValue || !rangeMaxValue || !rangeSliderRange) {
        console.log('雙端點滑桿元素不存在，跳過初始化');
        return;
    }

    // 從控制面板的熱力圖設定取得初始值
    const heatmapMinValueEl = document.getElementById('heatmapMinValue');
    const heatmapMaxValueEl = document.getElementById('heatmapMaxValue');
    const minValue = heatmapMinValueEl ? parseFloat(heatmapMinValueEl.value) : 0;
    const maxValue = heatmapMaxValueEl ? parseFloat(heatmapMaxValueEl.value) : 1000;

    rangeMin.value = minValue;
    rangeMax.value = maxValue;
    rangeMinValue.textContent = minValue;
    rangeMaxValue.textContent = maxValue;

    updateRangeSliderTrack();

    // 最小值滑桿事件
    rangeMin.addEventListener('input', function() {
        let min = parseInt(this.value);
        let max = parseInt(rangeMax.value);

        // 確保最小值不超過最大值
        if (min > max - 10) {
            min = max - 10;
            this.value = min;
        }

        rangeMinValue.textContent = min;
        const heatmapMinValueEl = document.getElementById('heatmapMinValue');
        if (heatmapMinValueEl) {
            heatmapMinValueEl.value = min;
        }
        updateRangeSliderTrack();
    });

    // 最大值滑桿事件
    rangeMax.addEventListener('input', function() {
        let max = parseInt(this.value);
        let min = parseInt(rangeMin.value);

        // 確保最大值不低於最小值
        if (max < min + 10) {
            max = min + 10;
            this.value = max;
        }

        rangeMaxValue.textContent = max;
        const heatmapMaxValueEl = document.getElementById('heatmapMaxValue');
        if (heatmapMaxValueEl) {
            heatmapMaxValueEl.value = max;
        }
        updateRangeSliderTrack();
    });

    // 當滑桿釋放時，自動刷新熱力圖
    rangeMin.addEventListener('change', () => {
        if (timelineData && timelineData.length > 0 && currentTimeIndex >= 0) {
            refreshCurrentHeatmap();
        }
    });

    rangeMax.addEventListener('change', () => {
        if (timelineData && timelineData.length > 0 && currentTimeIndex >= 0) {
            refreshCurrentHeatmap();
        }
    });
}

// 更新雙端點滑桿的範圍顯示
function updateRangeSliderTrack() {
    const rangeMin = document.getElementById('rangeMin');
    const rangeMax = document.getElementById('rangeMax');
    const rangeSliderRange = document.getElementById('rangeSliderRange');

    // 檢查元素是否存在
    if (!rangeMin || !rangeMax || !rangeSliderRange) {
        return;
    }

    const min = parseInt(rangeMin.value);
    const max = parseInt(rangeMax.value);
    const minPercent = (min / parseInt(rangeMin.max)) * 100;
    const maxPercent = (max / parseInt(rangeMax.max)) * 100;

    rangeSliderRange.style.left = minPercent + '%';
    rangeSliderRange.style.width = (maxPercent - minPercent) + '%';
}

// ========== 區域顯示/隱藏功能 ==========

// 切換區域的顯示/隱藏狀態
function toggleRegionVisibility(areaName) {
    // 切換狀態
    const currentState = regionVisibilityMap.get(areaName);
    const newState = currentState === false ? true : false;
    regionVisibilityMap.set(areaName, newState);

    // 如果有熱力圖資料，重新繪製
    if (currentHeatmapData) {
        // 取得播放速度（從快速控制或控制面板）
        const playbackIntervalEl = document.getElementById('playbackInterval');
        const quickPlaybackSpeedEl = document.getElementById('quickPlaybackSpeed');
        const playbackInterval = playbackIntervalEl ?
            parseInt(playbackIntervalEl.value) :
            (quickPlaybackSpeedEl ? parseInt(quickPlaybackSpeedEl.value) : 1000);

        drawHeatmapOnRegions(currentHeatmapData, playbackInterval);

        // 更新排名顯示
        updateRanking(currentHeatmapData);
    }
}

// 切換排名面板的收合狀態
function toggleRankingPanel() {
    const panel = document.getElementById('rankingPanel');
    panel.classList.toggle('collapsed');
}

// 進階設定的密碼
const ADVANCED_SETTINGS_PASSWORD = '3f5d6007';
let advancedSettingsUnlocked = false;

// 切換進階設定的顯示/隱藏
function toggleAdvancedSettings() {
    const toggle = document.getElementById('advancedSettingsToggle');
    const content = document.getElementById('advancedSettingsContent');

    // 如果已經解鎖,直接切換
    if (advancedSettingsUnlocked) {
        toggle.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
        return;
    }

    // 如果當前是收合狀態,需要驗證密碼
    if (toggle.classList.contains('collapsed')) {
        const password = prompt('請輸入進階設定密碼：');
        if (password === ADVANCED_SETTINGS_PASSWORD) {
            advancedSettingsUnlocked = true;
            toggle.classList.remove('collapsed');
            content.classList.remove('collapsed');
            alert('密碼正確！進階設定已解鎖。');
        } else if (password !== null) {
            alert('密碼錯誤！');
        }
    } else {
        // 收合不需要密碼
        toggle.classList.add('collapsed');
        content.classList.add('collapsed');
    }
}

// 將函數暴露到全域以便 HTML 調用
window.deleteRegion = deleteRegion;
window.confirmAreaSelection = confirmAreaSelection;
window.cancelAreaSelection = cancelAreaSelection;
window.toggleRegionVisibility = toggleRegionVisibility;
window.toggleRankingPanel = toggleRankingPanel;
window.toggleAdvancedSettings = toggleAdvancedSettings;
