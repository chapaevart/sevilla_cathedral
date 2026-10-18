let currentMapIndex = 0;
let isEditMode = false;
let draggedPoint = null;
let draggedDot = null;

// Переменные для зума и панорамирования
let scale = 1;
let pointX = 0, pointY = 0;
let startX = 0, startY = 0;
let panning = false;

// Для мультитача (щипок)
let pinchStartDist = 0;
let startScale = 1;
let pinchCenter = {x: 0, y: 0};
let startPoint = {x: 0, y: 0};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof mapData === 'undefined') {
        alert("Ошибка: Файл данных mapData.js не загрузился.");
        return;
    }

    const selector = document.getElementById('map-selector');
    mapData.forEach((map, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = map.name || `Объект ${index + 1}`;
        selector.appendChild(opt);
    });

    const toggle = document.getElementById('edit-mode-toggle');
    const saveBtn = document.getElementById('save-drag-btn');

    toggle.addEventListener('change', (e) => {
        isEditMode = e.target.checked;
        if (isEditMode) {
            saveBtn.classList.remove('hidden');
            document.querySelectorAll('.map-point').forEach(dot => dot.classList.add('draggable'));
            closePopup(); 
        } else {
            saveBtn.classList.add('hidden');
            document.querySelectorAll('.map-point').forEach(dot => dot.classList.remove('draggable'));
        }
    });

    // Привязываем расчет координат к новому корсету #image-bounds
    const imageBounds = document.getElementById('image-bounds');

    function updateDotPosition(clientX, clientY) {
        const rect = imageBounds.getBoundingClientRect(); 
        let x = ((clientX - rect.left) / rect.width) * 100;
        let y = ((clientY - rect.top) / rect.height) * 100;
        
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));
        
        draggedDot.style.left = x + '%';
        draggedDot.style.top = y + '%';
        
        draggedPoint.x = parseFloat(x.toFixed(2));
        draggedPoint.y = parseFloat(y.toFixed(2));
    }

    document.addEventListener('mousemove', (e) => {
        if (!isEditMode || !draggedDot) return;
        updateDotPosition(e.clientX, e.clientY);
    });

    document.addEventListener('touchmove', (e) => {
        if (!isEditMode || !draggedDot) return;
        e.preventDefault(); 
        updateDotPosition(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: false});

    const stopDragging = () => {
        if (draggedDot) {
            draggedDot.classList.remove('dragging');
            draggedDot = null;
            draggedPoint = null;
        }
    };
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);

    initPanAndZoom();

    if(mapData.length > 0) loadMap(0);
});

// Продвинутая настройка зума и перемещения карты
function initPanAndZoom() {
    const mapContainer = document.getElementById('map-container');
    const mapTransformWrapper = document.getElementById('map-transform-wrapper');

    function setTransform() {
        const w = mapContainer.clientWidth;
        const h = mapContainer.clientHeight;

        // Жесткий ограничитель, чтобы карта не уезжала далеко за пределы экрана
        const minX = w - (w * scale);
        const minY = h - (h * scale);

        // Позволяем чуть-чуть выходить за края для удобства, но возвращаем обратно
        pointX = Math.min(Math.max(pointX, minX), 0);
        pointY = Math.min(Math.max(pointY, minY), 0);

        mapTransformWrapper.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    }

    // --- Обработка мобильных жестов (Тач) ---
    mapContainer.addEventListener('touchstart', (e) => {
        if (e.target.closest('.popup')) return; // <--- ПРОПУСКАЕМ НАЖАТИЯ В ПОПАПЕ
        if (draggedDot && isEditMode) return;
        const rect = mapContainer.getBoundingClientRect();
        
        if (e.touches.length === 2) {
            panning = false;
            const t1 = e.touches[0], t2 = e.touches[1];
            pinchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            startScale = scale;
            
            // Находим точку фокуса между двумя пальцами
            pinchCenter = {
                x: ((t1.clientX + t2.clientX) / 2) - rect.left,
                y: ((t1.clientY + t2.clientY) / 2) - rect.top
            };
            startPoint = { x: pointX, y: pointY };
        } else if (e.touches.length === 1) {
            panning = true;
            startX = e.touches[0].clientX - pointX;
            startY = e.touches[0].clientY - pointY;
        }
    }, {passive: false});

    mapContainer.addEventListener('touchmove', (e) => {
        if (e.target.closest('.popup')) return; // <--- РАЗРЕШАЕМ СКРОЛЛ В ПОПАПЕ
        if (draggedDot && isEditMode) return;
        e.preventDefault(); // Блокируем системный скролл только для карты
        const rect = mapContainer.getBoundingClientRect();

        if (e.touches.length === 2) {
            const t1 = e.touches[0], t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            let newScale = Math.min(Math.max(1, startScale * (dist / pinchStartDist)), 5);

            const currentCenter = {
                x: ((t1.clientX + t2.clientX) / 2) - rect.left,
                y: ((t1.clientY + t2.clientY) / 2) - rect.top
            };

            // Зум относительно центра пальцев
            pointX = pinchCenter.x - (pinchCenter.x - startPoint.x) * (newScale / startScale);
            pointY = pinchCenter.y - (pinchCenter.y - startPoint.y) * (newScale / startScale);

            // Разрешаем двигать карту во время зума
            pointX += (currentCenter.x - pinchCenter.x);
            pointY += (currentCenter.y - pinchCenter.y);

            scale = newScale;
            setTransform();
        } else if (e.touches.length === 1 && panning) {
            pointX = e.touches[0].clientX - startX;
            pointY = e.touches[0].clientY - startY;
            setTransform();
        }
    }, {passive: false});

    mapContainer.addEventListener('touchend', (e) => {
        if (e.target.closest('.popup')) return;
        if (e.touches.length < 2) {
            if (e.touches.length === 1) {
                 startX = e.touches[0].clientX - pointX;
                 startY = e.touches[0].clientY - pointY;
            } else {
                 panning = false;
            }
        }
    });

    // --- Обработка мыши на ПК ---
    mapContainer.addEventListener('wheel', (e) => {
        if (e.target.closest('.popup')) return; // <--- РАЗРЕШАЕМ СКРОЛЛ МЫШЬЮ В ПОПАПЕ
        e.preventDefault();
        const rect = mapContainer.getBoundingClientRect();
        
        // Позиция курсора относительно контейнера
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = (e.wheelDelta ? e.wheelDelta : -e.deltaY);
        const zoomFactor = delta > 0 ? 1.15 : (1 / 1.15);
        let newScale = Math.min(Math.max(1, scale * zoomFactor), 5);

        // Расчет смещения, чтобы зум происходил ровно под курсором
        pointX = mouseX - (mouseX - pointX) * (newScale / scale);
        pointY = mouseY - (mouseY - pointY) * (newScale / scale);
        scale = newScale;
        
        setTransform();
    }, {passive: false});

    mapContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.popup')) return;
        if (isEditMode && draggedDot) return;
        panning = true;
        startX = e.clientX - pointX;
        startY = e.clientY - pointY;
    });

    mapContainer.addEventListener('mousemove', (e) => {
        if (e.target.closest('.popup')) return;
        if (!panning || (isEditMode && draggedDot)) return;
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        setTransform();
    });

    window.addEventListener('mouseup', () => { panning = false; });
}

window.switchMap = function(index) {
    loadMap(parseInt(index));
};

function loadMap(index) {
    currentMapIndex = index;
    const mapInfo = mapData[currentMapIndex];
    
    document.getElementById('map-image').src = mapInfo.image;
    
    // Сброс позиции
    scale = 1; pointX = 0; pointY = 0;
    document.getElementById('map-transform-wrapper').style.transform = `translate(0px, 0px) scale(1)`;
    
    const pointsLayer = document.getElementById('points-layer');
    pointsLayer.innerHTML = '';
    closePopup();
    
    if(!mapInfo.points) mapInfo.points = [];
    
    mapInfo.points.forEach(point => {
        const dot = document.createElement('div');
        dot.className = 'map-point' + (isEditMode ? ' draggable' : '');
        dot.title = point.name;
        dot.textContent = parseInt(point.id, 10) || point.id;
        dot.style.left = point.x + '%';
        dot.style.top = point.y + '%';
        
        dot.onclick = (e) => {
            if (isEditMode) return; 
            showPopup(point);
        };

        dot.onmousedown = (e) => {
            if (!isEditMode) return;
            e.preventDefault(); 
            draggedPoint = point;
            draggedDot = dot;
            dot.classList.add('dragging');
        };

        dot.addEventListener('touchstart', (e) => {
            if (!isEditMode) return;
            e.stopPropagation(); 
            draggedPoint = point;
            draggedDot = dot;
            dot.classList.add('dragging');
        }, {passive: false});
        
        pointsLayer.appendChild(dot);
    });
}

window.exportMapData = function() {
    const jsCode = `const mapData = ${JSON.stringify(mapData, null, 4)};`;
    const blob = new Blob([jsCode], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapData.js';
    a.click();
    
    URL.revokeObjectURL(url);
    alert("✅ Изменения сохранены! Файл mapData.js скачан.\n\nЗамените старый файл в папке проекта новым.");
};

function showPopup(point) {
    document.getElementById('popup-title').textContent = point.name || `Точка ${point.id}`;
    
    const buriedEl = document.getElementById('popup-buried');
    if(point.buried && point.buried.trim() !== '') {
        buriedEl.innerHTML = point.buried;
    } else {
        buriedEl.innerHTML = '<span style="color:#94a3b8; font-style:italic">Информация отсутствует</span>';
    }

    const artEl = document.getElementById('popup-art');
    if(point.art && point.art.trim() !== '') {
        artEl.innerHTML = point.art;
    } else {
        artEl.innerHTML = '<span style="color:#94a3b8; font-style:italic">Информация отсутствует</span>';
    }
    
    document.getElementById('popup').classList.remove('hidden');
}

function closePopup() {
    document.getElementById('popup').classList.add('hidden');
}