let map = null
let markers = []
let currentStep = 1
let stepData = {
    images: [],
    ph: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    lat: null,
    lng: null,
    notes: null
}
let baseLayers = {}
let overlayLayers = {}

function initMap() {
    if (map) return
    map = L.map('leaflet-map').setView([55.75, 37.61], 10)
    
    // Базовый слой - OpenStreetMap
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    })
    
    // Быстрый спутниковый слой - MODIS (оптимизированный)
    const satelliteLayer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
        'MODIS_Terra_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        {
            attribution: 'NASA GIBS | MODIS Terra',
            maxZoom: 12,  // Ограничиваем для скорости
            minZoom: 1,
            opacity: 1,
            time: new Date().toISOString().split('T')[0],
            // Оптимизация загрузки
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }
    )
    
    // Быстрый слой Landsat 8 (оптимизированный)
    const landsatLayer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
        'Landsat_8_Surface_Reflectance/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        {
            attribution: 'NASA GIBS | Landsat 8',
            maxZoom: 12,  // Ограничиваем для скорости
            minZoom: 1,
            opacity: 1,
            time: new Date().toISOString().split('T')[0],
            // Оптимизация загрузки
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }
    )
    
    // Запасной вариант - Esri World Imagery (всегда работает)
    const esriLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 19,
            minZoom: 1,
            opacity: 1
        }
    )
    
    // Слои для переключателя
    baseLayers = {
        "🗺️ Карта (OSM)": osmLayer,
        "🛰️ Спутник (MODIS)": satelliteLayer,
        "🛰️ Спутник (Landsat)": landsatLayer,
        "🛰️ Спутник (Esri)": esriLayer
    }
    
    // Добавляем информацию о слоях
    console.log('[MAP] Satellite layers info:');
    console.log('  MODIS Terra: Ежедневное, оптимизирован до zoom 12, 250м/пиксель');
    console.log('  Landsat 8: 8-16 дней, оптимизирован до zoom 12, 30м/пиксель');
    console.log('  Esri World: Статичные, всегда быстрый, высокое качество');
    console.log('  Рекомендация: используйте Esri для скорости, MODIS для свежести');
    
    // Добавляем OSM по умолчанию
    osmLayer.addTo(map)
    
    // Добавляем переключатель слоёв
    L.control.layers(baseLayers, null, {
        position: 'topright',
        collapsed: true
    }).addTo(map)
    
    console.log('[MAP] Initialized with OSM and NASA layers')
}

const user_id = localStorage.getItem('user_id') || crypto.randomUUID()
localStorage.setItem('user_id', user_id)
async function loadPoints() {
    try {
        console.log('Loading all points for general map...');
        const res = await fetch("/api/points");
        const points = await res.json();
        console.log(`Loaded ${points.length} points from backend`);
        
        // Сохраняем точки для использования в popup
        window.lastLoadedPoints = points;
        
        // Удаляем старые маркеры
        if (markers) {
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];
        }
        
        points.forEach(p => {
            addPointToMap(p);
        });
        
        console.log(`Added ${points.length} points to map`);
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

// =========================
// SECTION NAVIGATION
// =========================
function showSection(section) {
    if (window.debugLog) debugLog('Showing section: ' + section);
    
    // Hide all sections
    document.getElementById("analysis").style.display = "none";
    document.getElementById("map").style.display = "none";
    document.getElementById("cabinet").style.display = "none";
    
    // Show selected section
    const targetSection = document.getElementById(section);
    if (targetSection) {
        targetSection.style.display = "block";
        if (window.debugLog) debugLog('Section ' + section + ' displayed');
    } else {
        if (window.debugLog) debugLog('ERROR: Section ' + section + ' not found', 'error');
        alert('Ошибка: секция ' + section + ' не найдена');
        return;
    }
    
    if (section === "map") {
        setTimeout(() => {
            if (!map) {
                initMap();
            }
            if (map) {
                map.invalidateSize();
            }
            loadMyPoints();
        }, 100);
    }
    
    if (section === "cabinet") {
        loadUserCabinet();
    }
    
    if (section === "analysis") {
        // Reset to step 1 and show it
        currentStep = 1;
        updateStepUI();
        if (window.debugLog) debugLog('Analysis section opened, showing step 1');
    }
}

// =========================
// STEP NAVIGATION
// =========================
async function nextStep(step) {
    if (window.debugLog) debugLog('nextStep called: from ' + currentStep + ' to ' + step);
    
    if (step > currentStep) {
        // Validate current step before proceeding
        const isValid = await validateStep(currentStep);
        if (window.debugLog) debugLog('Validation result: ' + isValid);
        if (!isValid) {
            if (window.debugLog) debugLog('Validation failed, stopping', 'warn');
            return;
        }
        
        const oldStep = currentStep;
        currentStep = step;
        if (window.debugLog) debugLog('Moving to step ' + step);
        
        // Update layers
        updateLayers(oldStep, currentStep);
        processStep(step);
        updateStepUI();
    } else {
        const oldStep = currentStep;
        currentStep = step;
        if (window.debugLog) debugLog('Moving backwards to step ' + step);
        updateLayers(oldStep, currentStep);
        processStep(step);
        updateStepUI();
    }
}

function prevStep(step) {
    if (window.debugLog) debugLog('prevStep called: from ' + currentStep + ' to ' + step);
    const oldStep = currentStep;
    currentStep = step;
    updateLayers(oldStep, currentStep);
    updateStepUI();
}

function updateLayers(oldStep, newStep) {
    // Remove all layer classes
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.classList.remove('active', 'previous', 'completed');
    });
    
    // Set new active panel
    const newPanel = document.querySelector(`.step-panel[data-step="${newStep}"]`);
    newPanel.classList.add('active');
    
    // Set previous panels with layering effect
    for (let i = 1; i < newStep; i++) {
        const panel = document.querySelector(`.step-panel[data-step="${i}"]`);
        if (i === newStep - 1) {
            panel.classList.add('previous');
        } else {
            panel.classList.add('completed');
        }
    }
}

async function validateStep(step) {
    switch(step) {
        case 1:
            // Validate photos - MANDATORY for step 1
            if (!stepData.images || stepData.images.length === 0) {
                alert('❌ Необходимо загрузить хотя бы одно фото почвы для продолжения');
                return false;
            }
            
            try {
                // Simple client-side validation
                if (stepData.images.length > 10) {
                    alert('Слишком много фото. Максимум 10 фото.');
                    return false;
                }
                console.log(`Validated ${stepData.images.length} photos`);
            } catch (error) {
                console.error('Validation error:', error);
                return false;
            }
            return true;
        case 3:
            // Collect chemistry data if present
            const ph = document.getElementById('step3-ph')?.value;
            const nitrogen = document.getElementById('step3-nitrogen')?.value;
            const phosphorus = document.getElementById('step3-phosphorus')?.value;
            const potassium = document.getElementById('step3-potassium')?.value;
            
            if (ph) stepData.ph = parseFloat(ph);
            if (nitrogen) stepData.nitrogen = parseFloat(nitrogen);
            if (phosphorus) stepData.phosphorus = parseFloat(phosphorus);
            if (potassium) stepData.potassium = parseFloat(potassium);
            
            return true;
        case 4:
            // Geolocation required
            const lat = document.getElementById('step4-lat').value;
            const lng = document.getElementById('step4-lng').value;
            if (!lat || !lng) {
                alert('Пожалуйста, введите координаты');
                return false;
            }
            stepData.lat = parseFloat(lat);
            stepData.lng = parseFloat(lng);
            return true;
        case 2:
            // Validate photo processing results - MANDATORY for step 2
            if (!stepData.images || stepData.images.length === 0) {
                alert('❌ Необходимо загрузить фото почвы для продолжения анализа');
                return false;
            }
            return true;
        default:
            return true;
    }
}

// =========================
// STEP PROCESSING
// =========================
async function processStep(step) {
    switch(step) {
        case 1:
            // Photo classification
            break;
        case 2:
            await processStep2();
            break;
        case 3:
            await processStep3();
            break;
        case 4:
            await processStep4();
            break;
        case 5:
            // Map fixation - map is already initialized
            break;
        case 6:
            await processStep6();
            break;
        case 7:
            await processStep7();
            break;
        case 8:
            await processStep8();
            break;
        case 9:
            await processStep9();
            break;
    }
}

// =========================
// STEP 1: Photo Classification
// =========================
async function handleStep1Image() {
    const imageInput = document.getElementById('step1-image');
    if (imageInput.files.length > 0) {
        const files = Array.from(imageInput.files).slice(0, 10); // Max 10 photos
        stepData.images = [];
        
        const previewDiv = document.getElementById('step1-image-preview');
        previewDiv.innerHTML = '';
        
        for (const file of files) {
            const base64 = await toBase64(file);
            stepData.images.push(base64);
            
            // Add preview
            const img = document.createElement('img');
            img.src = base64;
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '2px solid #A5D6A7';
            previewDiv.appendChild(img);
        }
        
        const resultDiv = document.getElementById('step1-result');
        resultDiv.innerHTML = `
            <div style="padding: 15px; background: rgba(234, 179, 8, 0.1); border-radius: 8px;">
                <h4>⏳ Загружено ${stepData.images.length} фото</h4>
                <p>Нажмите "Далее" для проверки изображений</p>
                <p>Макс. 10 фото с разных ракурсов</p>
            </div>
        `;
    }
}

function skipPhoto() {
    stepData.images = [];
    nextStep(2);
}

// =========================
// STEP 2: Check Photo Presence
// =========================
async function processStep2() {
    const messageDiv = document.getElementById('step2-message');
    const resultDiv = document.getElementById('step2-result');
    
    if (stepData.images && stepData.images.length > 0) {
        messageDiv.textContent = `Загружено ${stepData.images.length} фото. Переход к анализу физико-химических показателей.`;
        resultDiv.innerHTML = `<div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">✅ ${stepData.images.length} фото пользователя присутствуют</div>`;
    } else {
        messageDiv.textContent = 'Фото не загружено. Будут использованы предположения от AI.';
        resultDiv.innerHTML = `<div style="padding: 15px; background: rgba(234, 179, 8, 0.1); border-radius: 8px;">⚠️ Фото отсутствуют - анализ через AI</div>`;
    }
}

// =========================
// STEP 3: Physical-Chemical Analysis
// =========================
async function processStep3() {
    const ph = document.getElementById('step3-ph').value;
    const moisture = document.getElementById('step3-moisture').value;
    
    stepData.ph = ph ? parseFloat(ph) : null;
    stepData.moisture = moisture ? parseFloat(moisture) : null;
    
    const resultDiv = document.getElementById('step3-result');
    
    if (stepData.ph && stepData.moisture) {
        resultDiv.innerHTML = `
            <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
                <h4>📊 Показатели получены:</h4>
                <p><strong>pH:</strong> ${stepData.ph}</p>
                <p><strong>Влажность:</strong> ${stepData.moisture}%</p>
                <p>Данные будут сопоставлены с базой данных</p>
            </div>
        `;
    } else {
        resultDiv.innerHTML = '';
    }
}

// =========================
// STEP 4: Geolocation
// =========================
async function processStep4() {
    const resultDiv = document.getElementById('step4-result');
    
    if (stepData.lat && stepData.lng) {
        resultDiv.innerHTML = `
            <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
                <h4>📍 Геолокация получена:</h4>
                <p><strong>Широта:</strong> ${stepData.lat}</p>
                <p><strong>Долгота:</strong> ${stepData.lng}</p>
                <p>Данные будут сопоставлены с базой данных</p>
            </div>
        `;
        
        // Update map
        if (map && currentMarker) {
            map.removeLayer(currentMarker);
        }
        if (map) {
            currentMarker = L.marker([stepData.lat, stepData.lng]).addTo(map)
                .bindPopup("Выбранная точка")
                .openPopup();
            map.setView([stepData.lat, stepData.lng], 13);
        }
    }
}

// =========================
// STEP 6: Database Comparison
// =========================
async function processStep6() {
    const resultDiv = document.getElementById('step6-result');
    
    try {
        const res = await fetch('/api/nearby-points?lat=' + stepData.lat + '&lng=' + stepData.lng + '&radius_km=5');
        const nearbyPoints = await res.json();
        
        resultDiv.innerHTML = `
            <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
                <h4>🗄️ Сопоставление с базой данных:</h4>
                <p><strong>Близлежащие точки (радиус 5 км):</strong> ${nearbyPoints.length}</p>
                ${nearbyPoints.length > 0 ? '<p>Найдены похожие точки в базе данных</p>' : '<p>Новых точек в этом районе нет</p>'}
            </div>
        `;
    } catch (error) {
        resultDiv.innerHTML = `<div style="padding: 15px; background: rgba(234, 179, 8, 0.1); border-radius: 8px;">⚠️ Ошибка при проверке базы данных</div>`;
    }
}

// =========================
// STEP 7: Personal Cabinet
// =========================
async function processStep7() {
    const resultDiv = document.getElementById('step7-result');
    
    resultDiv.innerHTML = `
        <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
            <h4>👤 Личный кабинет:</h4>
            <p>✅ Будет создана персональная база данных пользователя</p>
            <p>✅ Точка будет добавлена к вашим записям</p>
            <p>✅ Данные изолированы от других пользователей</p>
        </div>
    `;
}

// =========================
// STEP 8: Annotations
// =========================
async function processStep8() {
    const resultDiv = document.getElementById('step8-result');
    
    resultDiv.innerHTML = `
        <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
            <h4>🏷️ Пометки на карте:</h4>
            <p>✅ Выберите цвет и иконку для точки</p>
            <p>✅ Добавьте теги и заметки</p>
        </div>
    `;
}

// =========================
// STEP 9: Final Actions
// =========================
async function processStep9() {
    const resultDiv = document.getElementById('step9-result');
    const aiSoilTypeDisplay = document.getElementById('ai-soil-type-display');
    const soilTypeSelectionDiv = document.getElementById('soil-type-selection-step9');
    const select = document.getElementById('step9-soil-type');
    
    resultDiv.innerHTML = `
        <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
            <h4>🎯 Финальные действия:</h4>
            <p>✅ Проверьте все данные</p>
            <p>✅ Выберите тип почвы</p>
            <p>✅ Сохраните точку в базу данных</p>
        </div>
    `;
    
    // Показываем AI-определенный тип если есть
    if (stepData.validationResult && stepData.validationResult.identified_soil_type) {
        aiSoilTypeDisplay.innerHTML = `<strong>AI определил:</strong> ${stepData.validationResult.identified_soil_type}`;
        // Предзаполняем селект AI-определенным типом
        select.innerHTML = '<option value="">Выберите тип почвы</option>';
        
        allSoilTypes.forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category.category;
            category.types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                if (type === stepData.validationResult.identified_soil_type) {
                    option.selected = true;
                }
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
    } else {
        aiSoilTypeDisplay.innerHTML = '<em>AI не определил тип почвы</em>';
        // Загружаем типы почв в селект
        select.innerHTML = '<option value="">Выберите тип почвы</option>';
        
        allSoilTypes.forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category.category;
            category.types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
    }
}

// =========================
// COLLECT STEP DATA
// =========================
function collectStepData() {
    const selectedSoilType = document.getElementById('step9-soil-type').value;
    const notes = document.getElementById('step8-notes')?.value || '';
    
    return {
        ph: stepData.ph,
        moisture: stepData.moisture,
        nitrogen: stepData.nitrogen,
        phosphorus: stepData.phosphorus,
        potassium: stepData.potassium,
        lat: stepData.lat,
        lng: stepData.lng,
        tags: stepData.tags,
        notes: notes,
        soil_type: selectedSoilType || stepData.validationResult?.identified_soil_type || ""
    };
}

// =========================
// SAVE FINAL POINT
// =========================
async function saveFinalPoint() {
    if (window.debugLog) debugLog('saveFinalPoint() started');
    
    showLoading('Сохранение точки...', 'Анализ и сохранение данных');
    
    const summaryDiv = document.getElementById('final-summary');
    if (!summaryDiv) {
        if (window.debugLog) debugLog('ERROR: final-summary element not found', 'error');
        hideLoading();
        showErrorToast('Ошибка: не найден элемент для отображения результата');
        return;
    }
    if (window.debugLog) debugLog('summaryDiv found');
    
    // Валидация обязательных полей
    const point = collectStepData();
    
    // Проверка наличия фото
    if (!point.image && (!stepData || !stepData.images || stepData.images.length === 0)) {
        hideLoading();
        showErrorToast('❌ Необходимо загрузить фото почвы для анализа');
        showSection('analysis');
        nextStep(1);
        return;
    }
    
    // Проверка обязательных значений
    if (!point.ph || point.ph === '') {
        hideLoading();
        showErrorToast('❌ Необходимо указать pH почвы для анализа');
        showSection('analysis');
        nextStep(3);
        return;
    }
    
    // Проверка координат
    if (!point.lat || !point.lng) {
        hideLoading();
        showErrorToast('❌ Необходимо указать координаты точки');
        showSection('analysis');
        nextStep(4);
        return;
    }
    
    // Проверка типа почвы (если ИИ не смог определить, пользователь должен выбрать)
    const confirmedType = getConfirmedSoilType();
    if (!confirmedType) {
        hideLoading();
        showErrorToast('❌ Необходимо подтвердить или выбрать тип почвы');
        showSection('analysis');
        nextStep(9);
        return;
    }
    
    // Проверяем авторизацию
    const token = localStorage.getItem('auth_token');
    if (!token) {
        if (window.debugLog) debugLog('ERROR: No auth token', 'error');
        hideLoading();
        showErrorToast('Для сохранения точек необходимо войти в систему');
        showAuthModal();
        return;
    }
    if (window.debugLog) debugLog('Auth token found');
    
    // Build final point data
    const userId = localStorage.getItem('user_id');
    
    if (window.debugLog) debugLog('Point data collected: lat=' + point.lat + ', lng=' + point.lng);
    console.log('Saving point:', point);
    
    if (window.debugLog) debugLog('stepData exists: ' + (typeof stepData !== 'undefined'));
    if (window.debugLog) debugLog('stepData.validationResult: ' + (stepData && stepData.validationResult ? 'exists' : 'missing'));
    
    try {
        if (window.debugLog) debugLog('Entering try block...');
        
        // Определяем тип почвы для отображения
        let soilTypeDisplay = "Не определен";
        try {
            soilTypeDisplay = point.soil_type || (stepData && stepData.validationResult && stepData.validationResult.identified_soil_type) || "Не определен";
            if (window.debugLog) debugLog('Soil type determined: ' + soilTypeDisplay);
        } catch (soilError) {
            if (window.debugLog) debugLog('ERROR getting soil type: ' + soilError.message, 'error');
        }
        
        if (window.debugLog) debugLog('Rendering summary...');
        updateProgress(25);
        
        summaryDiv.innerHTML = `
            <div style="padding: 20px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
                <h4>📋 Итоговые данные:</h4>
                <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; margin: 10px 0;">
                    <p style="margin: 0; font-weight: 600;">🌱 Тип почвы: ${soilTypeDisplay}</p>
                </div>
                <p><strong>Широта:</strong> ${point.lat}</p>
                <p><strong>Долгота:</strong> ${point.lng}</p>
                <p><strong>pH:</strong> ${point.ph || 'Не указано'}</p>
                <p><strong>Влажность:</strong> ${point.moisture || 'Не указано'}%</p>
                <p><strong>Фото:</strong> ${point.images ? point.images.length : 0} шт.</p>
                <p><strong>Теги:</strong> ${point.tags ? point.tags.join(', ') : 'Нет'}</p>
                <p><strong>Заметки:</strong> ${point.notes || 'Нет'}</p>
            </div>
            <p style="margin-top: 10px;">Сохранение точки...</p>
        `;
        
        if (window.debugLog) debugLog('Summary rendered OK');
    } catch (renderError) {
        if (window.debugLog) debugLog('ERROR rendering summary: ' + renderError.message, 'error');
        console.error('Render error:', renderError);
        hideLoading();
        summaryDiv.innerHTML = `
            <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 15px;">
                <h4>❌ Ошибка отображения</h4>
                <p>${renderError.message}</p>
            </div>
        `;
        return;
    }
    
    // Save to backend
    try {
        if (window.debugLog) debugLog('Sending request to /api/block1...');
        updateProgress(50);
        
        const headers = {'Content-Type': 'application/json'};
        headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch('/api/block1', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(point)
        });
        
        if (window.debugLog) debugLog('Response received, status: ' + response.status);
        
        if (response.status === 401) {
            if (window.debugLog) debugLog('ERROR: 401 Unauthorized', 'error');
            hideLoading();
            summaryDiv.innerHTML += `
                <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 15px;">
                    <h4>❌ Требуется авторизация</h4>
                    <p>Ваша сессия истекла. Пожалуйста, войдите снова.</p>
                </div>
            `;
            showErrorToast('Ваша сессия истекла. Пожалуйста, войдите снова.');
            showAuthModal();
            return;
        }
        
        const text = await response.text();
        if (window.debugLog) debugLog('Response text: ' + text.substring(0, 100));
        console.log('Backend response text:', text);
        
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            result = { error: `Backend returned non-JSON: ${text.substring(0, 200)}` };
        }
        
        console.log('Backend response:', result);
        
        if (result.status === 'success' || result.status === 'ok') {
            if (window.debugLog) debugLog('Point saved successfully!', 'info');
            // Mark user as having completed analysis
            localStorage.setItem('hasCompletedAnalysis', 'true');
            
            console.log('Point saved successfully, reloading all points...');
            updateProgress(75);
            
            summaryDiv.innerHTML += `
                <div style="padding: 20px; background: rgba(76, 175, 80, 0.2); border-radius: 8px; margin-top: 15px;">
                    <h4>✅ Точка успешно сохранена!</h4>
                    <p>Перенаправление на карту...</p>
                </div>
            `;
            
            // Перезагрузить все точки (общую карту) и перейти на карту
            await loadPoints(); // Загружаем все точки для общей карты
            await loadUserCabinet(); // Загружаем точки пользователя для личного кабинета
            
            updateProgress(100);
            showSuccessToast('Точка успешно сохранена!');
            
            setTimeout(() => {
                hideLoading();
                showSection('map');
                console.log('Switched to map section');
            }, 1000);
        } else {
            if (window.debugLog) debugLog('ERROR: Save failed - ' + (result.error || 'Unknown error'), 'error');
            hideLoading();
            showErrorToast('Ошибка при сохранении: ' + (result.error || 'Попробуйте снова'));
            summaryDiv.innerHTML += `
                <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 15px;">
                    <h4>❌ Ошибка при сохранении</h4>
                    <p>${result.error || 'Попробуйте снова'}</p>
                </div>
            `;
        }
    } catch (error) {
        if (window.debugLog) debugLog('ERROR: Save failed with exception: ' + error.message, 'error');
        console.error('Save error:', error);
        hideLoading();
        handleAsyncError(error, 'сохранении точки');
        summaryDiv.innerHTML += `
            <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 15px;">
                <h4>❌ Ошибка при сохранении</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function resetForm() {
    currentStep = 1;
    let stepData = {
        images: [],
        ph: null,
        moisture: null,
        nitrogen: null,
        phosphorus: null,
        potassium: null,
        lat: null,
        lng: null,
        tags: [],
        notes: null
    };
    
    updateStepUI();
    
    // Clear input fields
    document.getElementById('step1-image').value = '';
    document.getElementById('step3-ph').value = '';
    document.getElementById('step3-moisture').value = '';
    document.getElementById('step3-nitrogen').value = '';
    document.getElementById('step3-phosphorus').value = '';
    document.getElementById('step3-potassium').value = '';
    document.getElementById('step4-lat').value = '';
    document.getElementById('step4-lng').value = '';
    document.getElementById('step8-tags').value = '';
    document.getElementById('step8-notes').value = '';
    
    // Clear result divs
    document.getElementById('step1-result').innerHTML = '';
    document.getElementById('step1-image-preview').innerHTML = '';
    document.getElementById('step2-result').innerHTML = '';
    document.getElementById('step3-result').innerHTML = '';
    document.getElementById('step4-result').innerHTML = '';
    document.getElementById('step6-result').innerHTML = '';
    document.getElementById('step7-result').innerHTML = '';
    document.getElementById('step8-result').innerHTML = '';
    document.getElementById('step9-result').innerHTML = '';
    document.getElementById('final-summary').innerHTML = '';
    
    showSection('analysis');
}

// =========================
// SOIL TYPES FILTERING
// =========================
let allSoilTypes = [];

async function loadSoilTypes() {
    try {
        const response = await fetch('/api/soil-types');
        const data = await response.json();
        allSoilTypes = data.soil_types || [];
        
        const select = document.getElementById('soil-type-filter');
        select.innerHTML = '<option value="">Все типы почвы</option>';
        
        allSoilTypes.forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category.category;
            category.types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
    } catch (error) {
        console.error('Error loading soil types:', error);
    }
}

function filterPointsBySoilType() {
    const selectedType = document.getElementById('soil-type-filter').value;
    console.log('Filtering by soil type:', selectedType);
    
    if (!selectedType) {
        // Если фильтр не выбран, показываем все точки
        markers.forEach(marker => {
            marker.setOpacity(1);
            marker.setIcon(L.icon({
                iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEM1LjU5NyAwIDAgNS41OTcgMCAxMi41QzAgMjEuMDA0IDguOTk2IDQwIDEyLjUgNDBDMTUuNTA0IDQwIDI1IDIxLjAwNCAyNSAxMi41QzI1IDUuNTk3IDE5LjQwMyAwIDEyLjUgMFoiIGZpbGw9IiMyRTdEMzIiLz4KPGNpcmNsZSBjeD0iMTIuNSIgY3k9IjEyLjUiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            }));
        });
        return;
    }
    
    let foundCount = 0;
    markers.forEach(marker => {
        const point = marker._pointData;
        const soilType = (point.soil_type?.soil_ru || point.ai_analysis?.soil_type || '').toLowerCase();
        
        if (soilType === selectedType.toLowerCase()) {
            marker.setOpacity(1);
            marker.setIcon(L.icon({
                iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEM1LjU5NyAwIDAgNS41OTcgMCAxMi41QzAgMjEuMDA0IDguOTk2IDQwIDEyLjUgNDBDMTUuNTA0IDQwIDI1IDIxLjAwNCAyNSAxMi41QzI1IDUuNTk3IDE5LjQwMyAwIDEyLjUgMFoiIGZpbGw9IiNGRjU3MjIiLz4KPGNpcmNsZSBjeD0iMTIuNSIgY3k9IjEyLjUiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            }));
            foundCount++;
        } else {
            marker.setOpacity(0.3);
        }
    });
    
    if (foundCount > 0) {
        showInfoToast(`Найдено точек: ${foundCount}`);
    } else {
        showInfoToast('Точки с таким типом почвы не найдены');
    }
}

function clearSoilFilter() {
    document.getElementById('soil-type-filter').value = '';
    
    // Восстанавливаем все маркеры
    markers.forEach(marker => {
        marker.setOpacity(1);
        marker.setIcon(L.icon({
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEM1LjU5NyAwIDAgNS41OTcgMCAxMi41QzAgMjEuMDA0IDguOTk2IDQwIDEyLjUgNDBDMTUuNTA0IDQwIDI1IDIxLjAwNCAyNSAxMi41QzI1IDUuNTk3IDE5LjQwMyAwIDEyLjUgMFoiIGZpbGw9IiMyRTdEMzIiLz4KPGNpcmNsZSBjeD0iMTIuNSIgY3k9IjEyLjUiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }));
    });
    
    showInfoToast('Фильтр сброшен');
}

function updateStepUI() {
    if (window.debugLog) debugLog('updateStepUI called for step ' + currentStep);
    
    // Show current step panel
    const allPanels = document.querySelectorAll('.step-panel');
    if (window.debugLog) debugLog('Found ' + allPanels.length + ' step panels');
    
    allPanels.forEach(panel => {
        panel.style.display = 'none';
    });
    
    const currentPanel = document.querySelector(`.step-panel[data-step="${currentStep}"]`);
    if (currentPanel) {
        currentPanel.style.display = 'block';
        if (window.debugLog) debugLog('Showing panel for step ' + currentStep);
    } else {
        if (window.debugLog) debugLog('ERROR: Panel for step ' + currentStep + ' not found', 'error');
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded');
    loadSoilTypes();
    await initUser();
    initMap();
    console.log('Map initialized');
    loadPoints();
    console.log('Points loaded');
    currentStep = 1;
    updateStepUI();
    initializeTestLocation();
    showSection('map'); // Всегда карта по умолчанию
});

// =========================
// HELPER FUNCTIONS
// =========================
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function getMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        document.getElementById('step4-lat').value = lat.toFixed(6);
        document.getElementById('step4-lng').value = lng.toFixed(6);
        stepData.lat = lat;
        stepData.lng = lng;
        
        if (map && currentMarker) {
            map.removeLayer(currentMarker);
        }
        if (map) {
            currentMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("Ваше местоположение")
                .openPopup();
            map.setView([lat, lng], 13);
        }
    }, (error) => {
        alert('Не удалось определить местоположение');
    });
}

function setCurrentPoint(lat, lng) {
    stepData.lat = lat;
    stepData.lng = lng;
    
    if (map && currentMarker) {
        map.removeLayer(currentMarker);
    }
    if (map) {
        currentMarker = L.marker([lat, lng]).addTo(map)
            .bindPopup("Выбранная точка")
            .openPopup();
        map.setView([lat, lng], 13);
    }
}

function addPointToMap(point) {
    if (!map) return;
    
    const colorMap = {
        'green': '#4CAF50',
        'yellow': '#FFC107',
        'red': '#F44336',
        'blue': '#2196F3'
    };
    
    const marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        fillColor: colorMap[point.color] || '#4CAF50',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);
    
    marker.bindPopup(createPopup(point));
    marker.on('click', () => showPointDetails(point));
}

function findMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 13);
            
            if (currentMarker) {
                map.removeLayer(currentMarker);
            }
            
            currentMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("Вы здесь")
                .openPopup();
            
            // Загрузить близлежащие точки
            try {
                const res = await fetch(`/api/nearby-points?lat=${lat}&lng=${lng}&radius_km=5`);
                const nearbyPoints = await res.json();
                
                // Удалить старые маркеры
                if (markers) {
                    markers.forEach(marker => map.removeLayer(marker));
                    markers = [];
                }
                
                // Добавить близлежащие точки на карту
                nearbyPoints.forEach(point => {
                    addPointToMap(point);
                });
                
                if (nearbyPoints.length > 0) {
                    alert(`Найдено ${nearbyPoints.length} близлежащих точек в радиусе 5 км`);
                } else {
                    alert('Близлежащих точек не найдено в радиусе 5 км');
                }
            } catch (error) {
                console.error('Error loading nearby points:', error);
            }
        }, (error) => {
            alert('Не удалось определить местоположение');
        });
    } else {
        alert('Геолокация не поддерживается браузером');
    }
}

function showPointDetails(point) {
    const pointInfoDiv = document.getElementById('point-info');
    const images = point.images || [];
    const firstImage = images.length > 0 ? images[0] : point.image;
    
    // Приоритет: выбор пользователя > ИИ определение > старый формат
    const ai = point.ai_analysis || {};
    const soilTypeObj = point.soil_type || {}; // Новый формат с подтверждением
    const soilType = soilTypeObj.soil_ru || ai.soil_type || point.report?.general?.soil_type || "Не определен";
    
    // Добавляем информацию о том, кто определил тип
    let soilTypeInfo = "";
    if (soilTypeObj.soil_ru && soilTypeObj.confidence === 100) {
        soilTypeInfo = `<small style="color: #4CAF50;">✅ Выбрано пользователем</small>`;
    } else if (soilTypeObj.soil_ru && soilTypeObj.confidence < 100) {
        soilTypeInfo = `<small style="color: #2196F3;">🤖 ИИ (${soilTypeObj.confidence}%)</small>`;
    } else if (ai.soil_type) {
        soilTypeInfo = `<small style="color: #FF9800;">🔬 Старый ИИ анализ</small>`;
    }
    const fertility = ai.fertility_score || 5;
    const fertilityText = ai.fertility_text || "Среднее";
    const summary = ai.summary || "";
    
    // Zc из экологического отчета
    const eco = point.ecological_report || {};
    const zc = eco.zc || 0;
    const zcCat = eco.zc_category || "не определено";
    
    const date = point.timestamp ? new Date(point.timestamp).toLocaleString('ru-RU') : 'Дата не указана';
    
    // Генерируем галерею фото
    let photoGallery = '';
    if (images.length > 0) {
        photoGallery = `
            <div style="margin-bottom: 15px;">
                <div style="position: relative;">
                    <img id="main-photo-${point.id}" src="${firstImage}" style="width:100%; height:150px; object-fit: cover; border-radius:8px; cursor: pointer;" onclick="openPhotoModal('${firstImage}')">
                    ${images.length > 1 ? `<div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">📷 1 / ${images.length}</div>` : ''}
                </div>
                ${images.length > 1 ? `
                    <div style="display: flex; gap: 5px; margin-top: 8px; overflow-x: auto;">
                        ${images.map((img, idx) => `
                            <img src="${img}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; cursor: pointer; border: ${idx === 0 ? '2px solid #2E7D32' : '2px solid transparent'};" onclick="changeMainPhoto('${point.id}', '${img}', ${idx}, ${images.length})">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    pointInfoDiv.innerHTML = `
        <div style="font-family: Arial, sans-serif;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">
                <span style="font-size: 28px;">🌱</span>
                <div>
                    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Анализ почвы</div>
                    <div style="font-size: 11px; color: #999;">${date}</div>
                </div>
            </div>
            
            ${photoGallery}
            
            <div style="padding: 15px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(76, 175, 80, 0.1) 100%); border-radius: 10px; margin: 15px 0; border-left: 4px solid #22c55e;">
                <div style="font-size: 12px; color: #666; margin-bottom: 5px; text-transform: uppercase;">🌱 Тип почвы</div>
                <div style="font-size: 18px; font-weight: 700; color: #2E7D32;">${soilType}</div>
                ${soilTypeInfo ? `<div style="margin-top: 5px;">${soilTypeInfo}</div>` : ''}
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
                <div style="padding: 10px; background: #f5f5f5; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #666;">Широта</div>
                    <div style="font-size: 14px; font-weight: 600;">${point.lat?.toFixed(6) || '—'}</div>
                </div>
                <div style="padding: 10px; background: #f5f5f5; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #666;">Долгота</div>
                    <div style="font-size: 14px; font-weight: 600;">${point.lng?.toFixed(6) || '—'}</div>
                </div>
            </div>
            
            <div style="margin: 15px 0;">
                <h5 style="color: #2E7D32; margin: 0 0 10px 0; font-size: 14px;">📊 Химический анализ</h5>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                    <div style="padding: 8px; background: rgba(33, 150, 243, 0.1); border-radius: 6px; text-align: center;">
                        <div style="font-size: 10px; color: #666;">pH</div>
                        <div style="font-size: 16px; font-weight: 700; color: #2196F3;">${point.report?.chemistry?.ph || point.ph || '—'}</div>
                    </div>
                    <div style="padding: 8px; background: rgba(76, 175, 80, 0.1); border-radius: 6px; text-align: center;">
                        <div style="font-size: 10px; color: #666;">N</div>
                        <div style="font-size: 16px; font-weight: 700; color: #4CAF50;">${point.report?.chemistry?.nitrogen || point.nitrogen || '—'}</div>
                    </div>
                    <div style="padding: 8px; background: rgba(255, 193, 7, 0.1); border-radius: 6px; text-align: center;">
                        <div style="font-size: 10px; color: #666;">P</div>
                        <div style="font-size: 16px; font-weight: 700; color: #FFC107;">${point.report?.chemistry?.phosphorus || point.phosphorus || '—'}</div>
                    </div>
                    <div style="padding: 8px; background: rgba(244, 67, 54, 0.1); border-radius: 6px; text-align: center;">
                        <div style="font-size: 10px; color: #666;">K</div>
                        <div style="font-size: 16px; font-weight: 700; color: #F44336;">${point.report?.chemistry?.potassium || point.potassium || '—'}</div>
                    </div>
                </div>
            </div>
            
            <!-- AI Анализ -->
            <div style="margin: 15px 0; padding: 15px; background: linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(33, 150, 243, 0.1) 100%); border-radius: 10px; border-left: 4px solid #1976D2;">
                <div style="font-size: 12px; color: #1976D2; font-weight: 600; margin-bottom: 10px; text-transform: uppercase;">🤖 AI Анализ почвы</div>
                
                <!-- Плодородие -->
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <span style="font-size: 11px; color: #666;">Плодородие:</span>
                        <span style="font-size: 14px; font-weight: 600; color: ${fertility >= 7 ? '#4CAF50' : fertility >= 5 ? '#FFC107' : '#F44336'};">${fertility}/10 - ${fertilityText}</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${fertility * 10}%; height: 100%; background: ${fertility >= 7 ? '#4CAF50' : fertility >= 5 ? '#FFC107' : '#F44336'}; border-radius: 3px;"></div>
                    </div>
                </div>
                
                <!-- Zc -->
                <div style="padding: 8px; background: rgba(255,255,255,0.5); border-radius: 6px; margin-bottom: 10px;">
                    <span style="font-size: 11px; color: #666;">Zc (загрязнение):</span>
                    <span style="font-size: 13px; font-weight: 600; color: ${zc < 16 ? '#4CAF50' : zc < 32 ? '#FFC107' : '#F44336'};">${zc} (${zcCat})</span>
                </div>
                
                <!-- Рекомендации -->
                ${ai.recommendations?.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 5px;">✅ Рекомендации:</div>
                        <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #333;">
                            ${ai.recommendations.slice(0, 3).map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Риски -->
                ${ai.risks?.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 5px;">⚠️ Риски:</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                            ${ai.risks.slice(0, 3).map(r => `<span style="padding: 3px 8px; background: rgba(244, 67, 54, 0.1); border-radius: 10px; font-size: 11px; color: #F44336;">${r}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Подходящие культуры -->
                ${ai.suitable_crops?.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 5px;">🌾 Рекомендуемые культуры:</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                            ${ai.suitable_crops.slice(0, 5).map(c => `<span style="padding: 3px 8px; background: rgba(76, 175, 80, 0.2); border-radius: 10px; font-size: 11px; color: #2E7D32;">${c}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Сводка -->
                ${summary ? `
                    <div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 6px;">
                        <div style="font-size: 11px; color: #666;">📝 Сводка:</div>
                        <div style="font-size: 12px; color: #333; line-height: 1.4;">${summary}</div>
                    </div>
                ` : ''}
            </div>
            
            ${point.notes ? `
                <div style="margin: 15px 0; padding: 12px; background: #fff3e0; border-radius: 8px; border-left: 3px solid #FF9800;">
                    <div style="font-size: 11px; color: #E65100; margin-bottom: 5px;">📝 Заметки</div>
                    <div style="font-size: 13px; color: #333; line-height: 1.4;">${point.notes}</div>
                </div>
            ` : ''}
            
            ${point.tags && point.tags.length > 0 ? `
                <div style="margin: 15px 0;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 5px;">🏷️ Теги</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${point.tags.map(tag => `<span style="padding: 4px 10px; background: #e0e0e0; border-radius: 15px; font-size: 11px;">${tag}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 8px; margin-top: 20px;">
                <button class="btn btn-primary" onclick="map.setView([${point.lat}, ${point.lng}], 15)" style="flex: 1;">
                    📍 Центрировать
                </button>
                <button class="btn btn-secondary" onclick="showSection('cabinet')" style="flex: 1;">
                    👤 В кабинет
                </button>
            </div>
        </div>
    `;
}

// Функция для смены главного фото в галерее
function changeMainPhoto(pointId, imgSrc, idx, total) {
    const mainPhoto = document.getElementById(`main-photo-${pointId}`);
    if (mainPhoto) {
        mainPhoto.src = imgSrc;
        // Обновляем счетчик
        const counter = mainPhoto.parentElement.querySelector('div');
        if (counter) {
            counter.textContent = `📷 ${idx + 1} / ${total}`;
        }
    }
}

// Функция для открытия фото в модальном окне
function openPhotoModal(imgSrc) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; cursor: pointer;';
    modal.innerHTML = `<img src="${imgSrc}" style="max-width: 90%; max-height: 90%; object-fit: contain;" onclick="event.stopPropagation()">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

// Функция для открытия деталей из popup
function showPointDetailsFromPopup(pointId) {
    // Находим точку в загруженных маркерах
    if (window.lastLoadedPoints) {
        const point = window.lastLoadedPoints.find(p => p.id === pointId);
        if (point) {
            showPointDetails(point);
            // Показываем боковую панель на карте
            const detailsPanel = document.querySelector('.details-panel');
            if (detailsPanel) {
                detailsPanel.style.display = 'block';
            }
        }
    }
}

async function loadMyPoints(soilTypeFilter = '') {
    try {
        const userId = localStorage.getItem('user_id');
        let url = `/api/points`;
        if (soilTypeFilter) {
            url += `?soil_type=${encodeURIComponent(soilTypeFilter)}`;
        }
        console.log('Loading points from:', url);
        const res = await fetch(url);
        const points = await res.json();
        console.log('Loaded points:', points);
        
        // Сохраняем точки для использования в popup
        window.lastLoadedPoints = points;
        
        // Удаляем старые маркеры
        if (markers) {
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];
        }
        
        points.forEach(point => {
            addPointToMap(point);
        });
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

function createPopup(p) {
    const report = p.report;
    const images = p.images || [];
    const firstImage = images.length > 0 ? images[0] : p.image;
    const soilType = report?.general?.soil_type || p.soil_type || "Не определен";
    const pointId = p.id || 'unknown';
    
    return `
        <div style="max-width:280px; font-family: Arial, sans-serif;">
            ${firstImage ? `
                <div style="position: relative; margin-bottom: 10px;">
                    <img src="${firstImage}" style="width:100%; height:120px; object-fit: cover; border-radius:8px;">
                    ${images.length > 1 ? `<div style="position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">📷 ${images.length}</div>` : ""}
                </div>
            ` : `
                <div style="width:100%; height:80px; background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%); border-radius:8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                    <span style="font-size: 40px;">🌱</span>
                </div>
            `}
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">🌱</span>
                <b style="font-size: 14px;">АНАЛИЗ ПОЧВЫ</b>
            </div>
            
            <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #22c55e;">
                <div style="font-size: 12px; color: #666; margin-bottom: 2px;">🌱 Тип почвы</div>
                <div style="font-size: 14px; font-weight: 600; color: #2E7D32;">${soilType}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px; margin-bottom: 10px;">
                <div><b>pH:</b> ${report?.chemistry?.ph || p.ph || "—"}</div>
                <div><b>N:</b> ${report?.chemistry?.nitrogen || p.nitrogen || "—"}</div>
                <div><b>P:</b> ${report?.chemistry?.phosphorus || p.phosphorus || "—"}</div>
                <div><b>K:</b> ${report?.chemistry?.potassium || p.potassium || "—"}</div>
            </div>
            
            ${p.notes ? `<div style="font-size: 11px; color: #666; font-style: italic; margin-bottom: 10px; padding: 5px; background: #f5f5f5; border-radius: 4px;">💬 ${p.notes.substring(0, 60)}${p.notes.length > 60 ? '...' : ''}</div>` : ""}
            
            <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                <button onclick="loadSatellite(${p.lat}, ${p.lng})" style="flex: 1; padding: 8px; background: #1976D2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
                    🛰️ Спутник
                </button>
                <button onclick="loadNDVI(${p.lat}, ${p.lng})" style="flex: 1; padding: 8px; background: #388E3C; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
                    🌿 NDVI
                </button>
            </div>
            
            <button onclick="showPointDetailsFromPopup('${pointId}')" style="width: 100%; padding: 8px; background: #2E7D32; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">
                📋 Подробнее
            </button>
        </div>
    `;
}

// =========================
// SATELLITE IMAGERY FUNCTIONS
// =========================

let currentSatelliteLayer = null;

async function loadSatellite(lat, lng) {
    if (window.debugLog) debugLog('Loading satellite image for: ' + lat + ', ' + lng);
    
    const pointInfoDiv = document.getElementById('point-info');
    pointInfoDiv.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 10px;">🛰️</div>
            <p>Загрузка спутникового снимка...</p>
            <div style="width: 50px; height: 4px; background: #e0e0e0; margin: 10px auto; border-radius: 2px; overflow: hidden;">
                <div style="width: 30%; height: 100%; background: #1976D2; animation: loading 1s infinite;"></div>
            </div>
        </div>
    `;
    
    try {
        const res = await fetch(`/api/satellite?lat=${lat}&lng=${lng}&width=800&height=600`);
        const data = await res.json();
        
        if (window.debugLog) debugLog('Satellite response: ' + (data.success ? 'success' : 'error'));
        
        if (!data.success) {
            const instructions = data.instructions ? data.instructions.map(i => `<li style="margin-bottom: 5px; font-size: 12px;">${i}</li>`).join('') : '';
            const isSetupRequired = data.setup_required;
            
            pointInfoDiv.innerHTML = `
                <div style="padding: 20px; background: ${isSetupRequired ? 'rgba(255, 193, 7, 0.1)' : 'rgba(244, 67, 54, 0.1)'}; border-radius: 8px; border-left: 3px solid ${isSetupRequired ? '#FFC107' : '#F44336'};">
                    <h4 style="color: ${isSetupRequired ? '#F57C00' : '#F44336'}; margin-bottom: 10px;">
                        ${isSetupRequired ? '⚙️ Требуется настройка' : '❌ Ошибка спутника'}
                    </h4>
                    <p style="font-size: 13px; color: #666; margin-bottom: 15px;">${data.error || 'Не удалось загрузить снимок'}</p>
                    
                    ${isSetupRequired ? `
                        <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                            <p style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 10px;">📋 Инструкция по настройке Sentinel Hub:</p>
                            <ol style="color: #666; padding-left: 20px; margin: 0;">${instructions}</ol>
                        </div>
                        <a href="https://apps.sentinel-hub.com/dashboard/" target="_blank" style="display: inline-block; padding: 8px 16px; background: #1976D2; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">
                            🚀 Открыть Sentinel Hub Dashboard
                        </a>
                    ` : ''}
                </div>
            `;
            return;
        }
        
        // Remove previous satellite layer if exists
        if (currentSatelliteLayer) {
            map.removeLayer(currentSatelliteLayer);
        }
        
        // Add satellite image as overlay on map
        const bounds = [[data.bbox[1], data.bbox[0]], [data.bbox[3], data.bbox[2]]];
        currentSatelliteLayer = L.imageOverlay(data.image, bounds, {opacity: 0.8}).addTo(map);
        
        pointInfoDiv.innerHTML = `
            <div style="font-family: Arial, sans-serif;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">
                    <span style="font-size: 32px;">🛰️</span>
                    <div>
                        <div style="font-size: 14px; font-weight: 600;">Спутниковый снимок</div>
                        <div style="font-size: 11px; color: #666;">${data.source} • ${data.date}</div>
                    </div>
                </div>
                
                <img src="${data.image}" style="width: 100%; border-radius: 8px; margin-bottom: 15px; cursor: pointer;" onclick="openPhotoModal('${data.image}')">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <div style="padding: 10px; background: #f5f5f5; border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: #666;">Широта</div>
                        <div style="font-size: 13px; font-weight: 600;">${lat.toFixed(6)}</div>
                    </div>
                    <div style="padding: 10px; background: #f5f5f5; border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: #666;">Долгота</div>
                        <div style="font-size: 13px; font-weight: 600;">${lng.toFixed(6)}</div>
                    </div>
                </div>
                
                <div style="padding: 12px; background: rgba(25, 118, 210, 0.1); border-radius: 8px; margin-bottom: 15px;">
                    <div style="font-size: 12px; color: #1976D2; font-weight: 500;">🚀 ${data.source || 'Спутниковые данные'}</div>
                    <div style="font-size: 11px; color: #666; margin-top: 5px;">
                        ${data.coverage || 'Глобальное покрытие'} • Ежедневные снимки
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button onclick="map.setView([${lat}, ${lng}], 15)" style="flex: 1; padding: 10px; background: #1976D2; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        📍 Центрировать
                    </button>
                    <button onclick="removeSatelliteLayer()" style="flex: 1; padding: 10px; background: #757575; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        🗑️ Скрыть
                    </button>
                </div>
            </div>
        `;
        
        // Center map on satellite image
        map.fitBounds(bounds, {padding: [50, 50]});
        
    } catch (error) {
        if (window.debugLog) debugLog('ERROR loading satellite: ' + error.message, 'error');
        pointInfoDiv.innerHTML = `
            <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px;">
                <h4 style="color: #F44336; margin-bottom: 10px;">❌ Ошибка загрузки</h4>
                <p style="font-size: 13px; color: #666;">${error.message}</p>
            </div>
        `;
    }
}

async function loadNDVI(lat, lng) {
    if (window.debugLog) debugLog('Loading NDVI image for: ' + lat + ', ' + lng);
    
    const pointInfoDiv = document.getElementById('point-info');
    pointInfoDiv.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 10px;">🌿</div>
            <p>Загрузка NDVI (индекс растительности)...</p>
            <div style="width: 50px; height: 4px; background: #e0e0e0; margin: 10px auto; border-radius: 2px; overflow: hidden;">
                <div style="width: 30%; height: 100%; background: #4CAF50; animation: loading 1s infinite;"></div>
            </div>
        </div>
    `;
    
    try {
        const res = await fetch(`/api/satellite/ndvi?lat=${lat}&lng=${lng}&width=800&height=600`);
        const data = await res.json();
        
        if (window.debugLog) debugLog('NDVI response: ' + (data.success ? 'success' : 'error'));
        
        if (!data.success) {
            pointInfoDiv.innerHTML = `
                <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px;">
                    <h4 style="color: #F44336; margin-bottom: 10px;">❌ Ошибка NDVI</h4>
                    <p style="font-size: 13px; color: #666;">${data.error || 'Не удалось загрузить NDVI'}</p>
                </div>
            `;
            return;
        }
        
        // Remove previous satellite layer if exists
        if (currentSatelliteLayer) {
            map.removeLayer(currentSatelliteLayer);
        }
        
        const bounds = [[lat - 0.01, lng - 0.01], [lat + 0.01, lng + 0.01]];
        currentSatelliteLayer = L.imageOverlay(data.image, bounds, {opacity: 0.85}).addTo(map);
        
        // Определяем качество данных
        const isHighRes = data.resolution === '10m';
        const isFallback = data.fallback;
        
        pointInfoDiv.innerHTML = `
            <div style="font-family: Arial, sans-serif;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">
                    <span style="font-size: 32px;">🌿</span>
                    <div>
                        <div style="font-size: 14px; font-weight: 600;">NDVI - Индекс растительности</div>
                        <div style="font-size: 11px; color: #666;">${data.source} • ${data.date}</div>
                    </div>
                </div>
                
                <!-- Индикатор качества -->
                <div style="padding: 10px; background: ${isHighRes ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 193, 7, 0.15)'}; border-radius: 8px; margin-bottom: 15px; border-left: 3px solid ${isHighRes ? '#4CAF50' : '#FFC107'};">
                    <div style="font-size: 12px; color: #333; font-weight: 500;">
                        ${isHighRes ? '✨ Высокое разрешение (10м)' : '📡 Стандартное разрешение (250м)'}
                        ${isFallback ? ' - Fallback режим' : ''}
                    </div>
                    <div style="font-size: 11px; color: #666; margin-top: 4px;">
                        ${isHighRes 
                            ? 'Детальная визуализация растительности от Sentinel-2' 
                            : 'Глобальное покрытие от MODIS (NASA)'}
                    </div>
                </div>
                
                <img src="${data.image}" style="width: 100%; border-radius: 8px; margin-bottom: 15px; cursor: pointer;" onclick="openPhotoModal('${data.image}')">
                
                <div style="padding: 12px; background: rgba(56, 142, 60, 0.1); border-radius: 8px; margin-bottom: 15px;">
                    <div style="font-size: 12px; color: #388E3C; font-weight: 500; margin-bottom: 8px;">📊 Легенда NDVI</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #b71c1c; border-radius: 2px;"></div> Голая почва/город</div>
                        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #f57f17; border-radius: 2px;"></div> Разреженная растительность</div>
                        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #fdd835; border-radius: 2px;"></div> Умеренная растительность</div>
                        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #66bb6a; border-radius: 2px;"></div> Здоровая растительность</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button onclick="map.setView([${lat}, ${lng}], 15)" style="flex: 1; padding: 10px; background: #388E3C; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        📍 Центрировать
                    </button>
                    <button onclick="removeSatelliteLayer()" style="flex: 1; padding: 10px; background: #757575; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        🗑️ Скрыть
                    </button>
                </div>
            </div>
        `;
        
        map.fitBounds(bounds, {padding: [50, 50]});
        
    } catch (error) {
        if (window.debugLog) debugLog('ERROR loading NDVI: ' + error.message, 'error');
        pointInfoDiv.innerHTML = `
            <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px;">
                <h4 style="color: #F44336; margin-bottom: 10px;">❌ Ошибка загрузки</h4>
                <p style="font-size: 13px; color: #666;">${error.message}</p>
            </div>
        `;
    }
}

function removeSatelliteLayer() {
    if (currentSatelliteLayer) {
        map.removeLayer(currentSatelliteLayer);
        currentSatelliteLayer = null;
        if (window.debugLog) debugLog('Satellite layer removed');
    }
}

async function loadTimeline(lat, lng) {
    const res = await fetch(`/api/history?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    console.log("История точки:", data);
}

function formatStructuredReport(report) {
    if (!report) return '<p><i>Нет данных отчёта</i></p>';
    
    return `
        <hr style="margin:10px 0; border-color:#A5D6A7;">
        <div style="margin-top:10px;">
            <strong>📋 Общие характеристики:</strong>
            <p>Тип: ${report.general?.soil_type || '—'}</p>
            <p>Цвет: ${report.general?.color || '—'}</p>
            <p>Структура: ${report.general?.structure || '—'}</p>
            ${report.general?.density ? `<p>Плотность: ${report.general.density}</p>` : ''}
            
            <strong>🧪 Химия:</strong>
            <p>pH: ${report.chemistry?.ph || '—'}</p>
            <p>Азот (N): ${report.chemistry?.nitrogen || '—'} мг/кг</p>
            <p>Фосфор (P): ${report.chemistry?.phosphorus || '—'} мг/кг</p>
            <p>Калий (K): ${report.chemistry?.potassium || '—'} мг/кг</p>
            
            <strong>💧 Физика:</strong>
            <p>Влажность: ${report.physical?.moisture || '—'}%</p>
            ${report.physical?.texture ? `<p>Текстура: ${report.physical.texture}</p>` : ''}
            
            ${report.meta ? `<p style="font-size:12px; color:#666;"><i>Источник: ${report.meta.source}, уверённость: ${report.meta.confidence}</i></p>` : ''}
        </div>
    `;
}

function loadTestLocation() {
    stepData.lat = 55.7558;
    stepData.lng = 37.6173;
    
    if (map && currentMarker) {
        map.removeLayer(currentMarker);
    }
    if (map) {
        currentMarker = L.marker([55.7558, 37.6173]).addTo(map)
            .bindPopup("Тестовое местоположение")
            .openPopup();
        map.setView([55.7558, 37.6173], 13);
    }
    
    alert('Загружено тестовое местоположение (Москва)');
}

// Отобразить результаты анализа
function displayAnalysisResult(result) {
    const analysis = result.analysis;
    let html = `
        <div style="padding: 20px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #22c55e;">✅ Анализ завершён</h3>
            <p><strong>Статус:</strong> ${result.message}</p>
        </div>
    `;
    
    // Проверка фото
    if (analysis.image_check === "soil") {
        html += `
            <div style="padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #3b82f6;">📷 Проверка фото</h4>
                <p>✅ Изображение содержит образец почвы</p>
            </div>
        `;
    } else if (analysis.image_check === "no_image") {
        html += `
            <div style="padding: 15px; background: rgba(234, 179, 8, 0.1); border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #eab308;">📷 Проверка фото</h4>
                <p>⚠️ Фото не загружено — использован анализ через AI</p>
            </div>
        `;
    }
    
    // Физико-химический анализ
    if (analysis.chemistry && typeof analysis.chemistry === "object") {
        html += `
            <div style="padding: 15px; background: rgba(168, 85, 247, 0.1); border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #a855f7;">🧪 Физико-химический анализ</h4>
                <p><strong>pH:</strong> ${analysis.chemistry.ph || "Не определено"}</p>
                <p><strong>Влажность:</strong> ${analysis.chemistry.moisture || "Не определено"}%</p>
            </div>
        `;
    }
    
    // Геолокация
    if (analysis.has_location) {
        html += `
            <div style="padding: 15px; background: rgba(236, 72, 153, 0.1); border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #ec4899;">📍 Геолокация</h4>
                <p>✅ Координаты зафиксированы</p>
                <p><strong>Близлежащие точки:</strong> ${analysis.nearby_points?.length || 0}</p>
            </div>
        `;
    } else {
        html += `
            <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #ef4444;">📍 Геолокация</h4>
                <p>⚠️ Требуется фиксация точки на карте</p>
            </div>
        `;
    }
    
    // Пометки
    if (analysis.annotations) {
        html += `
            <div style="padding: 15px; background: rgba(20, 184, 166, 0.1); border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #14b8a6;">🏷️ Пометки</h4>
                <p><strong>Символ:</strong> ${analysis.annotations.symbol || "Не указан"}</p>
                <p><strong>Цвет:</strong> ${analysis.annotations.color || "Не указан"}</p>
                ${analysis.annotations.tags?.length ? `<p><strong>Теги:</strong> ${analysis.annotations.tags.join(", ")}</p>` : ""}
                ${analysis.annotations.text_notes ? `<p><strong>Заметки:</strong> ${analysis.annotations.text_notes}</p>` : ""}
            </div>
        `;
    }
    
    // Состояние процесса
    if (analysis.state) {
        const completed = analysis.state.completed;
        html += `
            <div style="padding: 15px; background: ${completed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)'}; border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: ${completed ? '#22c55e' : '#eab308'};">📊 Состояние</h4>
                <p><strong>Фото:</strong> ${analysis.state.has_image ? "✅" : "❌"}</p>
                <p><strong>Геолокация:</strong> ${analysis.state.has_geo ? "✅" : "❌"}</p>
                <p><strong>Химия:</strong> ${analysis.state.has_chem ? "✅" : "❌"}</p>
                <p><strong>Пометки:</strong> ${analysis.state.has_annotations ? "✅" : "❌"}</p>
                <p><strong>Завершено:</strong> ${completed ? "✅ Полный анализ" : "⚠️ Требуются дополнительные данные"}</p>
            </div>
        `;
    }
    
    // Создаём или обновляем элемент для отображения результатов
    let resultDiv = document.getElementById("analysis-result");
    if (!resultDiv) {
        resultDiv = document.createElement("div");
        resultDiv.id = "analysis-result";
        resultDiv.style.cssText = "margin-top: 20px;";
        document.querySelector(".panel-body").appendChild(resultDiv);
    }
    resultDiv.innerHTML = html;
}

// Загрузка данных личного кабинета
async function loadUserCabinet() {
    try {
        const token = localStorage.getItem('auth_token');
        const list = document.getElementById("my-points-list");
        
        if (!token) {
            list.innerHTML = '<p>Для просмотра личного кабинета необходимо <a href="#" onclick="showAuthModal(); return false;">войти в систему</a></p>';
            return;
        }
        
        const headers = {'Authorization': `Bearer ${token}`};
        const res = await fetch("/api/user-cabinet", {headers});
        
        if (res.status === 401) {
            list.innerHTML = '<p>Ваша сессия истекла. <a href="#" onclick="showAuthModal(); return false;">Войдите снова</a></p>';
            return;
        }
        
        const data = await res.json();
        list.innerHTML = "";
        
        if (!data.points || data.points.length === 0) {
            list.innerHTML = "<p>У вас пока нет точек</p>";
            return;
        }
        
        // Отображаем точки с фото и AI анализом
        data.points.forEach(point => {
            const images = point.images || [];
            const firstImage = images.length > 0 ? images[0] : point.image;
            const ai = point.ai_analysis || {};
            const fertility = ai.fertility_score || 5;
            
            // Приоритет: выбор пользователя > ИИ определение > старый формат
            const soilTypeObj = point.soil_type || {};
            const soilType = soilTypeObj.soil_ru || ai.soil_type || "Не определен";
            
            // Добавляем информацию о том, кто определил тип
            let soilTypeInfo = "";
            if (soilTypeObj.soil_ru && soilTypeObj.confidence === 100) {
                soilTypeInfo = `<small style="color: #4CAF50;">✅ Выбрано пользователем</small>`;
            } else if (soilTypeObj.soil_ru && soilTypeObj.confidence < 100) {
                soilTypeInfo = `<small style="color: #2196F3;">🤖 ИИ (${soilTypeObj.confidence}%)</small>`;
            } else if (ai.soil_type) {
                soilTypeInfo = `<small style="color: #FF9800;">🔬 Старый ИИ анализ</small>`;
            }
            
            const div = document.createElement("div");
            div.className = "cabinet-point";
            div.style.cssText = "border:1px solid #A5D6A7; padding:15px; margin-bottom:15px; border-radius:10px; background:white;";
            
            // Добавляем информацию о регионе и качестве почвы
            const region = point.region || "Не определен";
            const qualityScore = point.quality_score || 0;
            const reference = point.reference || {};
            
            div.innerHTML = `
                ${firstImage ? `
                    <div style="position: relative; margin-bottom: 10px;">
                        <img src="${firstImage}" style="width:100%; border-radius:8px; max-height:200px; object-fit:cover; cursor: pointer;" 
                             onclick="openPhotoModal('${firstImage}')">
                        ${images.length > 1 ? `
                            <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                                📷 ${images.length} фото
                            </div>
                        ` : ''}
                    </div>
                ` : ""}
                
                <h4 style="color:#2E7D32; margin-bottom:10px;">🌱 ТОЧКА #${point.id.slice(0, 8)}</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 14px;">
                    <div><strong>Координаты:</strong><br>${point.lat?.toFixed(4)}, ${point.lng?.toFixed(4)}</div>
                    <div><strong>Регион:</strong><br>${region}</div>
                    <div><strong>pH:</strong> ${point.ph || "-"}</div>
                    <div><strong>Влажность:</strong> ${point.moisture || "-"}%</div>
                    <div><strong>N:</strong> ${point.nitrogen || "-"}</div>
                    <div><strong>P:</strong> ${point.phosphorus || "-"}</div>
                    <div><strong>K:</strong> ${point.potassium || "-"}</div>
                    <div><strong>Качество:</strong> ${qualityScore}/100</div>
                </div>
                
                ${soilType !== "Не определен" ? `
                    <div style="padding:10px; background:rgba(76,175,80,0.1); border-radius:6px; margin:10px 0;">
                        <p style="margin:0;"><strong>Тип почвы:</strong> ${soilType}</p>
                        ${soilTypeInfo ? `<p style="margin:5px 0 0 0; font-size:12px;">${soilTypeInfo}</p>` : ''}
                        ${reference.ph ? `<p style="margin:5px 0 0 0; font-size:12px;"><em>Эталон pH: ${reference.ph}</em></p>` : ''}
                    </div>
                ` : ""}
                
                ${point.tags?.length ? `<p><strong>Теги:</strong> ${point.tags.join(", ")}</p>` : ""}
                ${point.notes ? `<p><strong>Заметки:</strong> ${point.notes}</p>` : ""}
                
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap: wrap;">
                    <button onclick="map.setView([${point.lat}, ${point.lng}], 15); showSection('map');" 
                        style="flex:1; min-width:100px; padding:8px; background:#1976D2; color:white; border:none; border-radius:6px; cursor:pointer;">
                        📍 На карте
                    </button>
                    <button onclick="openDynamicsModal('${point.id}', 'Точка #${point.id.slice(0, 8)}')" 
                        style="flex:1; min-width:100px; padding:8px; background:#388E3C; color:white; border:none; border-radius:6px; cursor:pointer;">
                        📊 Динамика
                    </button>
                    ${images.length > 1 ? `
                        <button onclick="showPointPhotos('${JSON.stringify(images).replace(/'/g, "\\'")}')" 
                            style="flex:1; min-width:100px; padding:8px; background:#FF9800; color:white; border:none; border-radius:6px; cursor:pointer;">
                            📷 Все фото
                        </button>
                    ` : ''}
                    ${!point.is_test ? `<button onclick="deletePoint('${point.id}')" 
                        style="padding:8px 16px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;">
                        🗑️
                    </button>` : ''}
                </div>
            `;
            list.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error loading cabinet:', error);
        document.getElementById("my-points-list").innerHTML = '<p>Ошибка загрузки данных. <a href="#" onclick="loadUserCabinet(); return false;">Попробовать снова</a></p>';
    }
}

// Загрузка ближайших точек
async function loadNearbyPoints() {
    if (!currentPoint) return;
    
    const res = await fetch(`/api/nearby-points?lat=${currentPoint.lat}&lng=${currentPoint.lng}&radius_km=5`);
    const points = await res.json();
    
    points.forEach(point => {
        addPointToMap(point);
    });
}

// Удаление точки
async function deletePoint(pointId) {
    if (!confirm("Вы уверены, что хотите удалить эту точку?")) {
        return;
    }

    try {
        const res = await fetch(`/api/delete-point?point_id=${pointId}`, {
            method: "DELETE"
        });
        
        if (res.ok) {
            const result = await res.json();
            alert(result.message);
            loadUserCabinet(); // Перезагружаем кабинет
            loadAllPublicPoints(); // Перезагружаем карту
        } else {
            const error = await res.json();
            alert(error.detail || "Ошибка при удалении точки");
        }
    } catch (error) {
        console.error("Error deleting point:", error);
        alert("Ошибка при удалении точки");
    }
}

// Загружать данные кабинета пользователя при инициализации
setTimeout(loadUserCabinet, 1000);

// Загрузка всех публичных точек на карту
async function loadAllPublicPoints() {
    const res = await fetch("/api/points");
    const points = await res.json();
    
    points.forEach(point => {
        addPointToMap(point);
    });
}

// Загружать все публичные точки при инициализации
setTimeout(loadAllPublicPoints, 1500);

// User points layer
let userPointsLayer = null;

async function loadUserPoints() {
    try {
        const response = await fetch(`${API_URL}/points`);
        const points = await response.json();
        
        if (userPointsLayer) {
            map.removeLayer(userPointsLayer);
        }
        
        userPointsLayer = L.geoJSON(points, {
            pointToLayer: function(feature, latlng) {
                return L.marker(latlng);
            },
            onEachFeature: function(feature, layer) {
                const popupContent = `
                    <div class="popup-content">
                        <h3>${feature.properties.title}</h3>
                        ${feature.properties.description ? `<p>${feature.properties.description}</p>` : ''}
                        ${feature.properties.photo_url ? `<img src="${API_URL}${feature.properties.photo_url}" alt="Photo" />` : ''}
                        <small>${new Date(feature.properties.created_at).toLocaleString('ru')}</small>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(map);
        
        console.log('User points loaded:', points.length);
    } catch (error) {
        console.error('Failed to load user points:', error);
    }
}


// Refresh points button
const refreshPointsBtn = document.getElementById('refreshPoints');
if (refreshPointsBtn) {
    refreshPointsBtn.addEventListener('click', () => {
        loadUserPoints();
    });
}

// Add point form handling
const addPointBtn = document.getElementById('addPointBtn');
const pointForm = document.getElementById('point-form');
const cancelPointBtn = document.getElementById('cancelPoint');
const savePointBtn = document.getElementById('savePoint');

if (addPointBtn && pointForm) {
    addPointBtn.addEventListener('click', () => {
        pointForm.classList.remove('hidden');
    });
}

if (cancelPointBtn && pointForm) {
    cancelPointBtn.addEventListener('click', () => {
        pointForm.classList.add('hidden');
    });
}

if (savePointBtn) {
    savePointBtn.addEventListener('click', async () => {
        const pointTitle = document.getElementById('pointTitle');
        const pointDescription = document.getElementById('pointDescription');
        const photoInput = document.getElementById('pointPhoto');
        
        const title = pointTitle ? pointTitle.value : '';
        const description = pointDescription ? pointDescription.value : '';
        
        if (!title) {
            alert('Введите название точки');
            return;
        }
        
        // Get current map center
        const center = map.getCenter();
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('lat', center.lat);
        formData.append('lng', center.lng);
        
        if (photoInput && photoInput.files[0]) {
            formData.append('photo', photoInput.files[0]);
        }
        
        try {
            const response = await fetch(`${API_URL}/points`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                alert('Точка сохранена');
                if (pointForm) pointForm.classList.add('hidden');
                if (pointTitle) pointTitle.value = '';
                if (pointDescription) pointDescription.value = '';
                if (photoInput) photoInput.value = '';
                loadUserPoints();
            } else {
                alert('Ошибка сохранения точки');
            }
        } catch (error) {
            console.error('Failed to save point:', error);
            alert('Ошибка сохранения точки');
        }
    });
}

// Load initial data
loadUserPoints();

// ============================================================
// ПОЧВЕННЫЙ ДИАГНОСТИЧЕСКИЙ КАЛЬКУЛЯТОР (по визуальным признакам)
// На основе: учебник Ковды + Полевой определитель почв России
// ============================================================

const soilDiagnosticRules = {
  surface: {
    salt_crust: {
      visual_signs: ["белая корка", "белые выцветы", "солевые кристаллы", "пухлый слой"],
      horizon: "S (солончаковый)",
      pH: { min: 7.5, max: 9.5, text: "щелочная (>7.5)" },
      salinity: "высокая (>1% легкорастворимых солей)",
      humus: "низкое (0.5-2%)",
      pollution_type: "засоление (хлоридное/сульфатное/содовое)",
      recommendation: "Промывка почвы, гипсование, посадка галофитов"
    },
    
    oil_pollution: {
      visual_signs: ["маслянистые пятна", "чёрные разводы", "блестящая плёнка", "радужные разводы", "запах нефти"],
      horizon: "X (химически загрязнённый)",
      pH: { min: 6.0, max: 8.0, text: "разная (часто нейтральная)" },
      salinity: "низкая",
      humus: "разное",
      pollution_type: "нефтепродукты (углеводороды)",
      recommendation: "Сорбенты, биоремедиация (нефтеокисляющие бактерии)"
    },
    
    heavy_metals: {
      visual_signs: ["ржавые пятна", "охристые разводы", "пятна оранжевого/красного цвета", "угнетённая растительность"],
      horizon: "X (химически загрязнённый)",
      pH: { min: 4.0, max: 6.5, text: "часто кислая (при техногенных выбросах)" },
      salinity: "низкая",
      humus: "разное",
      pollution_type: "тяжёлые металлы (Fe, Cu, Pb, Zn)",
      recommendation: "Фиторемедиация, известкование, внесение гуминовых кислот"
    },
    
    chernozem: {
      visual_signs: ["тёмно-серый", "чёрный цвет", "комковато-зернистая структура", "копролиты"],
      horizon: "AU (темногумусовый)",
      pH: { min: 6.0, max: 7.3, text: "нейтральная или близкая к нейтральной" },
      salinity: "низкая (<0.1%)",
      humus: "высокое (6-10%)",
      pollution_type: "отсутствует",
      recommendation: "Поддерживающие дозы удобрений"
    },
    
    podzol: {
      visual_signs: ["белесый", "белый", "светло-серый слой", "песчаный/супесчаный состав", "бесструктурный"],
      horizon: "E (подзолистый)",
      pH: { min: 3.5, max: 5.0, text: "кислая (pH < 5.0)" },
      salinity: "низкая",
      humus: "низкое (<1.5%)",
      pollution_type: "отсутствует (естественная кислая реакция)",
      recommendation: "Известкование (4-8 т/га), внесение органики"
    },
    
    sod_podzolic: {
      visual_signs: ["серый", "буровато-серый", "комковатая структура", "светлые зерна минералов"],
      horizon: "AY (серогумусовый) + EL (элювиальный)",
      pH: { min: 4.5, max: 5.5, text: "слабокислая (pH 4.5-5.5)" },
      salinity: "низкая",
      humus: "среднее (1.5-2.5%)",
      pollution_type: "отсутствует",
      recommendation: "Умеренное известкование (2-4 т/га), NPK 60-70 кг/га"
    },
    
    peat: {
      visual_signs: ["буро-коричневый", "волокнистый", "остатки растений", "мшистый"],
      horizon: "T (торфяный)",
      pH: { min: 3.5, max: 5.5, text: "кислая (pH 3.5-5.5)" },
      salinity: "низкая",
      humus: "очень высокое (>20%)",
      pollution_type: "отсутствует",
      recommendation: "Известкование (8-12 т/га), калийные и фосфорные удобрения"
    },
    
    chestnut: {
      visual_signs: ["каштановый", "коричневато-бурый", "мелкопризматическая структура"],
      horizon: "AJ (светлогумусовый) + BMK (ксерометаморфический)",
      pH: { min: 7.0, max: 8.0, text: "слабощелочная (pH 7.0-8.0)" },
      salinity: "средняя (возможно засоление)",
      humus: "низкое (2-3%)",
      pollution_type: "часто карбонатное засоление",
      recommendation: "Гипсование (2-4 т/га), снегозадержание"
    },
    
    sierozem: {
      visual_signs: ["светло-серый", "палевый", "слабогумусированный", "бесструктурный"],
      horizon: "AJ (светлогумусовый) + BCA (аккумулятивно-карбонатный)",
      pH: { min: 7.5, max: 8.5, text: "щелочная (pH 7.5-8.5)" },
      salinity: "средняя или высокая",
      humus: "очень низкое (0.5-1.5%)",
      pollution_type: "часто засоление (сульфатное/хлоридное)",
      recommendation: "Гипсование, промывка, внесение органики"
    },
    
    gley: {
      visual_signs: ["сизый", "голубовато-серый", "зеленоватый", "ржавые пятна", "бесструктурный"],
      horizon: "G (глеевый)",
      pH: { min: 5.0, max: 7.0, text: "разная (часто кислая)" },
      salinity: "низкая",
      humus: "разное",
      pollution_type: "нет (естественное оглеение)",
      recommendation: "Дренаж, осушительные мелиорации"
    },
    
    takyr: {
      visual_signs: ["гладкая глинистая корка", "полигональные трещины", "светлая поверхность"],
      horizon: "признак tk (такыровидный)",
      pH: { min: 7.5, max: 9.0, text: "щелочная (pH 7.5-9.0)" },
      salinity: "средняя или высокая",
      humus: "очень низкое (<0.5%)",
      pollution_type: "засоление + осолонцевание",
      recommendation: "Гипсование, глубокое рыхление"
    }
  }
};

// ОПРЕДЕЛЕНИЕ ПОЧВЫ И ЗАГРЯЗНЕНИЯ ПО ПРИЗНАКАМ
function detectSoil(features){
    for(let key in soilDiagnosticRules.surface){
        let rule = soilDiagnosticRules.surface[key]
        for(let sign of rule.visual_signs){
            if(features.some(f => f.toLowerCase().includes(sign.toLowerCase()))){
                return rule
            }
        }
    }
    return null
}

// РАСЧЁТ ЗДОРОВЬЯ ПОЧВЫ НА ОСНОВЕ ХИМИЧЕСКИХ ПАРАМЕТРОВ
function calculateHealth(rule){
    let health = 1.0
    
    // pH отклонение
    let ph_avg = (rule.pH.min + rule.pH.max) / 2
    if(ph_avg < 5) health -= 0.3
    if(ph_avg > 8) health -= 0.3
    
    // соли
    if(rule.salinity.includes("высокая")) health -= 0.4
    
    // гумус
    if(rule.humus.includes("низкое")) health -= 0.3
    
    // загрязнение
    if(rule.pollution_type.includes("нефт")) health -= 0.5
    if(rule.pollution_type.includes("металл")) health -= 0.4
    if(rule.pollution_type.includes("засоление")) health -= 0.3
    
    return Math.max(0, Math.min(1, health))
}

// ОЦЕНКА ВЛАЖНОСТИ ПО ТИПУ ПОЧВЫ
function estimateMoisture(rule){
    if(rule.horizon.includes("G")) return 80
    if(rule.horizon.includes("T")) return 70
    if(rule.salinity.includes("высокая")) return 20
    
    return 40
}

// АНАЛИЗ ПОЧВЫ ПО ПРИЗНАКАМ
function analyzeSoil(features){
    let rule = detectSoil(features)
    
    if(!rule){
        return {
            error: "Не удалось определить тип почвы",
            health: 0.5,
            moisture: 40,
            pollution: "неизвестно"
        }
    }
    
    let health = calculateHealth(rule)
    let moisture = estimateMoisture(rule)
    
    return {
        type: rule.horizon,
        pollution: rule.pollution_type,
        ph: rule.pH.text,
        health: health,
        moisture: moisture,
        recommendation: rule.recommendation
    }
}

function lirenSay(text){
    document.getElementById("liren-help").innerHTML = `
        <div class="liren-box">
            🌱 Лирен: ${text}
        </div>
    `
}

let marker

function updateMap(lat, lon){
    if(marker){
        map.removeLayer(marker)
    }
    marker = L.marker([lat, lon]).addTo(map)
    map.setView([lat, lon], 8)
}

async function send(){
    let analysisType = document.getElementById("analysisType").value
    let f = document.getElementById("file").files[0]

    if (!f && analysisType === "photo") {
        lirenSay("Пожалуйста, выберите файл для анализа 📷")
        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>❌ Ошибка</h2>
    <p>Пожалуйста, выберите файл для анализа по фото</p>
</div>
`
        return
    }

    lirenSay("Анализирую почву... Это займёт немного времени 🔬")

    let form = new FormData()
    if (f) form.append("file", f)
    form.append("lat", document.getElementById("lat").value)
    form.append("lon", document.getElementById("lon").value)
    form.append("analysis_type", analysisType)

    try {
        let res = await fetch("/api/analyze", {
            method:"POST",
            body: form
        })
        const data = await res.json()
        if (data.point) {
            addPointToMap(data.point)
            localStorage.setItem('hasCompletedAnalysis', 'true')
        } else {
            alert('Ошибка')
        }
    } catch (e) {
        console.error(e)
        alert('Ошибка анализа')
    }
}

// Показать историю точек
async function simulateHistory(){
    lirenSay("Запускаю симуляцию истории... 📊")
    let result = await simulateRecovery()
    
    if(result && result.status === "updated"){
        lirenSay("История обновлена! 📊")
        document.getElementById("out").innerHTML = `
        <div class="card">
            <h2>📊 История обновлена</h2>
            <p>Состояние всех точек обновлено</p>
            <p>Влияние погоды применено</p>
        </div>
        `
    }
}

async function buildUserArea(point){
    try {
        let elevation = await loadDEM(point.lat, point.lon)
        
        document.getElementById("out").innerHTML = `
        <div class="card">
            <h2>🌱 Ваш участок</h2>
            <p>Высота: ${Math.round(elevation)} м</p>
            <p>Состояние: ${Math.round(point.health*100)}%</p>
            <p>Влажность: ${point.moisture}%</p>
        </div>
        `
        
        lirenSay(`Высота вашего участка: ${Math.round(elevation)} метров. Состояние почвы: ${Math.round(point.health*100)}% 🌿`)
        updateSoilState()
    } catch (error) {
        console.error("Error building user area:", error)
        lirenSay("Не удалось загрузить данные о участке 😢")
    }
}

// 3D глобальная карта и участок удалены для упрощения системы

function updateSoilState(){
    if(!userPoint) return
    
    let healthPercent = userPoint.health * 100
    let color = getColor(healthPercent)
    let status = "Хорошее"
    
    if(healthPercent < 50){
        status = "Плохое"
    } else if(healthPercent < 70){
        status = "Среднее"
    }
    
    L.circle([userPoint.lat, userPoint.lon], {
        radius: 5000,
        color: color,
        fillColor: color,
        fillOpacity: 0.3
    }).addTo(map)
    
    map.setView([userPoint.lat, userPoint.lon], 10)
}

function recovery(){
    if(!userPoint){
        lirenSay("Сначала найдите ваш участок 📍")
        return
    }
    
    lirenSay("Начинаю восстановление почвы... Это займёт немного времени 🌿")
    
    // Показываем 3D профиль до восстановления
    drawSoil(userPoint)
    
    // Получаем погоду для влияния на восстановление
    let weatherBonus = 0
    getWeather(userPoint.lat, userPoint.lon).then(weather => {
        if(weather && weather.humidity > 50){
            weatherBonus = 0.01 // Бонус за высокую влажность
            lirenSay("Благоприятная погода ускоряет восстановление! 💧")
        }
    })
    
    let interval = setInterval(() => {
        // Логика восстановления (не рандом)
        // pH стремится к 7
        let phChange = (7 - userPoint.ph) * 0.05
        userPoint.ph = Math.max(0, Math.min(14, userPoint.ph + phChange))
        
        // Влажность + погода
        let moistureChange = weatherBonus * 10
        userPoint.moisture = Math.max(0, Math.min(100, userPoint.moisture + moistureChange))
        
        // Здоровье зависит от загрязнения
        let healthChange = userPoint.pollution ? 0.01 : 0.03
        userPoint.health += healthChange
        
        // Пересчитываем здоровье по формуле
        let calculatedHealth = calculateHealth(userPoint.moisture, userPoint.ph, userPoint.humus, userPoint.pollution)
        userPoint.health = calculatedHealth / 100
        
        // Обновляем 3D профиль в реальном времени
        drawSoil(userPoint)
        
        if(userPoint.health >= 1){
            userPoint.health = 1
            clearInterval(interval)
            lirenSay("Почва полностью восстановлена! Ты молодец! 🎉")
            // Финальное обновление 3D модели
            drawSoil(userPoint)
        } else {
            let percent = Math.round(userPoint.health * 100)
            if(percent % 20 === 0){
                if(percent < 40) lirenSay("Почва деградирована, продолжаем восстановление... 😢")
                else if(percent < 70) lirenSay("Почва восстанавливается, это хорошо! 💧")
                else lirenSay("Почва почти здорова! Почти готово 🌿")
            }
        }
        
        updateSoilState()
        buildUserArea(userPoint)
    }, 800)
}

function getLocation(){
    if (navigator.geolocation) {
        lirenSay("Ищу ваше местоположение... 📍")
        navigator.geolocation.getCurrentPosition(
            (position) => {
                let lat = position.coords.latitude
                let lon = position.coords.longitude
                
                userPoint = {
                    lat: lat,
                    lon: lon,
                    health: 0.7,
                    moisture: 30
                }
                
                map.setView([lat, lon], 13)
                
                if(marker){
                    map.removeLayer(marker)
                }
                marker = L.marker([lat, lon]).addTo(map)
                
                buildUserArea(userPoint)
                lirenSay("Нашла ваш участок! 🎉")
            },
            (error) => {
                console.error("Geolocation error:", error)
                lirenSay("Не удалось определить местоположение 😢")
                alert("Ошибка геолокации: " + error.message)
            }
        )
    } else {
        lirenSay("Геолокация не поддерживается браузером 😢")
        alert("Геолокация не поддерживается браузером")
    }
}

function setTestLocation(){
    lirenSay("Устанавливаю тестовое местоположение (Москва) 🧪")
    
    // Используем данные из soil_defaults для чернозёма
    let soilData = soilDefaults["chernozem"]
    
    userPoint = {
        lat: 55.7558,
        lon: 37.6173,
        soil_type: "chernozem",
        health: calculateHealth(soilData.moisture, soilData.ph, soilData.humus) / 100,
        moisture: soilData.moisture,
        ph: soilData.ph,
        humus: soilData.humus,
        pollution: "clean",
        area: 1000
    }
    
    document.getElementById("lat").value = userPoint.lat
    document.getElementById("lon").value = userPoint.lon
    
    map.setView([userPoint.lat, userPoint.lon], 13)
    
    if(marker){
        map.removeLayer(marker)
    }
    marker = L.marker([userPoint.lat, userPoint.lon]).addTo(map)
    
    buildUserArea(userPoint)
    
    // Сохраняем в localStorage
    localStorage.setItem("my_soil", JSON.stringify(userPoint))
    
    // Создать точку с историей
    createPoint({
        lat: userPoint.lat,
        lon: userPoint.lon,
        ph: userPoint.ph,
        moisture: userPoint.moisture,
        area: userPoint.area
    })
    
    let health = calculateHealth(userPoint.moisture, userPoint.ph, userPoint.humus, userPoint.pollution)
    lirenSay(`Тестовое местоположение установлено! ${soilData.name}, Здоровье: ${Math.round(health)}% 🎉`)
}

// Реальная 3D модель почвенного профиля
function drawSoil(point){
    // Получаем параметры из soil_defaults по типу почвы
    let soilType = point.soil_type || "chernozem"
    let soilData = soilDefaults[soilType] || soilDefaults["chernozem"]
    
    // Используем слои из базы данных
    const layers = soilData.layers
    
    // Высота зависит от влажности
    let heightScale = point.moisture * 0.1

    const data = layers.map(layer => ({
        type: 'mesh3d',
        z: [layer.z[0], layer.z[0], layer.z[1], layer.z[1]],
        x: [0, 10 * heightScale, 10 * heightScale, 0],
        y: [0, 0, 10 * heightScale, 10 * heightScale],
        i: [0, 0, 0, 0],
        j: [1, 2, 3, 1],
        k: [2, 3, 0, 3],
        facecolor: [layer.color],
        opacity: point.moisture / 100,
        name: layer.name
    }))

    const health = calculateHealth(point.moisture, point.ph, point.humus, point.pollution)
    const layout = {
        title: `${soilData.name} - pH: ${point.ph}, Влажность: ${point.moisture}%, Гумус: ${point.humus}%, Здоровье: ${Math.round(health)}%`,
        scene: {
            zaxis: {title: 'Глубина (см)', range: [-120, 0]},
            xaxis: {title: 'X (м)'},
            yaxis: {title: 'Y (м)'}
        },
        margin: {l: 0, r: 0, t: 30, b: 0}
    }

    const soil3dEl = document.getElementById('soil3d');
    if (soil3dEl) {
        Plotly.newPlot('soil3d', data, layout);
    }
    lirenSay(`${soilData.name} построен! pH: ${point.ph}, Влажность: ${point.moisture}%, Гумус: ${point.humus}%, Здоровье: ${Math.round(health)}% 🌱`)
}

// Получить цвет зоны по здоровью
function getColor(health){
    if (health < 40) return "red"
    if (health < 70) return "yellow"
    return "green"
}

// Формула живой почвы
function calculateHealth(moisture, ph, humus = 5, pollution = null){
    let pollutionPenalty = 0
    if(pollution === "salt") pollutionPenalty = 20
    else if(pollution === "oil") pollutionPenalty = 30
    else if(pollution === "heavy") pollutionPenalty = 25
    
    let health = (moisture * 0.4) + (7 - Math.abs(ph - 7)) * 15 - pollutionPenalty + humus * 2
    return Math.max(0, Math.min(100, health))
}

// База параметров почв по типам
const soilDefaults = {
    "chernozem": {
        ph: 6.5,
        humus: 8,
        moisture: 45,
        color: "#3E3A39",
        name: "Чернозём",
        layers: [
            {z: [0, -40], color: "#3E3A39", name: "Гумус (AU)"},
            {z: [-40, -80], color: "#5D4E46", name: "Переходный (AB)"},
            {z: [-80, -120], color: "#8B7355", name: "Материнская (C)"}
        ]
    },
    "podzol": {
        ph: 4.5,
        humus: 1.5,
        moisture: 35,
        color: "#F0F0F0",
        name: "Подзол",
        layers: [
            {z: [0, -10], color: "#E8E8E8", name: "Подстилка (O)"},
            {z: [-10, -25], color: "#F0F0F0", name: "Подзолистый (E)"},
            {z: [-25, -50], color: "#A0522D", name: "Иллювиальный (B)"}
        ]
    },
    "gray_forest": {
        ph: 5.5,
        humus: 3,
        moisture: 40,
        color: "#808080",
        name: "Серая лесная",
        layers: [
            {z: [0, -20], color: "#696969", name: "Гумус (AU)"},
            {z: [-20, -45], color: "#A9A9A9", name: "Подзол (E)"},
            {z: [-45, -90], color: "#8B4513", name: "Текстурный (B)"}
        ]
    },
    "tundra_gley": {
        ph: 6.0,
        humus: 2,
        moisture: 70,
        color: "#4682B4",
        name: "Тундровая глеевая",
        layers: [
            {z: [0, -15], color: "#5F9EA0", name: "Торф (T)"},
            {z: [-15, -40], color: "#708090", name: "Глей (G)"},
            {z: [-40, -80], color: "#B0C4DE", name: "Материнская (C)"}
        ]
    },
    "chestnut": {
        ph: 7.2,
        humus: 4,
        moisture: 30,
        color: "#D2691E",
        name: "Каштановая",
        layers: [
            {z: [0, -30], color: "#CD853F", name: "Гумус (AU)"},
            {z: [-30, -60], color: "#DEB887", name: "Карбонатный (Bk)"},
            {z: [-60, -100], color: "#F4A460", name: "Материнская (C)"}
        ]
    }
}

// Показать почвенный профиль
function showSoilProfile(){
    if(userPoint){
        drawSoil(userPoint)
    } else {
        lirenSay("Сначала найдите ваш участок 📍")
    }
}

// Сохранить точку на карте
async function savePointOnMap(){
    let lat = parseFloat(document.getElementById("lat").value)
    let lon = parseFloat(document.getElementById("lon").value)
    
    if(!lat || !lon){
        lirenSay("Введите координаты 📍")
        return
    }
    
    let pointData = {
        lat: lat,
        lon: lon,
        ph: 6.5,
        moisture: 35,
        area: 1000
    }
    
    lirenSay("Сохраняю точку на карте... 💾")
    
    let result = await createPoint(pointData)
    
    if(result && result.status === "ok"){
        // Сохраняем в localStorage как "Моя точка"
        localStorage.setItem("my_point", JSON.stringify(result.point))
        
        lirenSay("Точка сохранена на карте! Теперь она будет отображаться в зонах загрязнения 🎉")
        document.getElementById("out").innerHTML = `
        <div class="card">
            <h2>💾 Точка сохранена</h2>
            <p>Координаты: ${lat}, ${lon}</p>
            <p>Точка теперь отображается в зонах загрязнения как частная (синяя)</p>
        </div>
        `
    }
}

// Загрузить мою точку из localStorage
function loadMyPoint(){
    let saved = localStorage.getItem("my_point")
    if(saved){
        userPoint = JSON.parse(saved)
        document.getElementById("lat").value = userPoint.lat
        document.getElementById("lon").value = userPoint.lon
        
        map.setView([userPoint.lat, userPoint.lon], 13)
        
        if(marker){
            map.removeLayer(marker)
        }
        marker = L.marker([userPoint.lat, userPoint.lon]).addTo(map)
        
        lirenSay("Загружена ваша точка! 📍")
        return true
    }
    return false
}

// Симуляция времени
async function runTimeSimulation(){
    if(!userPoint){
        lirenSay("Сначала найдите ваш участок 📍")
        return
    }
    
    lirenSay("Запускаю симуляцию времени на 10 дней... ⏳")
    
    // Получаем погоду
    let weather = await getWeather(userPoint.lat, userPoint.lon)
    let weatherEffect = weather ? weather.humidity > 50 ? 5 : -3 : 0
    
    let history = []
    let currentMoisture = userPoint.moisture
    let currentPh = userPoint.ph
    let currentHumus = userPoint.humus || 5
    let currentPollution = userPoint.pollution || null
    
    // Симулируем 10 дней
    for(let day = 1; day <= 10; day++){
        // Влияние погоды (дождь + влажность, жара - влажность)
        currentMoisture = Math.max(0, Math.min(100, currentMoisture + weatherEffect))
        
        // pH стремится к 7
        let phChange = (7 - currentPh) * 0.1
        currentPh = Math.max(0, Math.min(14, currentPh + phChange))
        
        // Здоровье с учётом загрязнения и гумуса
        let currentHealth = calculateHealth(currentMoisture, currentPh, currentHumus, currentPollution)
        
        history.push({
            day: day,
            moisture: currentMoisture,
            ph: currentPh,
            health: currentHealth
        })
    }
    
    // Показываем графики
    showHistoryGraphs(history)
    
    // Обновляем userPoint
    userPoint.moisture = currentMoisture
    userPoint.ph = currentPh
    userPoint.humus = currentHumus
    userPoint.pollution = currentPollution
    userPoint.health = currentHealth / 100
    
    lirenSay(`Симуляция завершена! Здоровье: ${Math.round(currentHealth)}% 🎉`)
}

// Показать графики истории
function showHistoryGraphs(history){
    let days = history.map(h => `День ${h.day}`)
    let moisture = history.map(h => h.moisture)
    let ph = history.map(h => h.ph)
    let health = history.map(h => h.health)
    
    const trace1 = {
        x: days,
        y: moisture,
        type: 'scatter',
        name: 'Влажность %',
        line: {color: 'blue'}
    }
    
    const trace2 = {
        x: days,
        y: ph,
        type: 'scatter',
        name: 'pH',
        line: {color: 'green'}
    }
    
    const trace3 = {
        x: days,
        y: health,
        type: 'scatter',
        name: 'Здоровье %',
        line: {color: 'red'}
    }
    
    const layout = {
        title: 'Симуляция времени - Изменение параметров',
        xaxis: {title: 'День'},
        yaxis: {title: 'Значение'}
    }

    const plot3dEl = document.getElementById('plot3d');
    if (plot3dEl) {
        Plotly.newPlot('plot3d', [trace1, trace2, trace3], layout);
    }
}

// BLOCK 1: Soil Analysis with DeepSeek
let userId = localStorage.getItem('user_id')
if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem('user_id', userId)
}

async function runBlock1() {
  const data = {
    lat: selectedLat,
    lng: selectedLng,
    ph: document.getElementById("ph").value,
    moisture: document.getElementById("moisture").value,
    notes: document.getElementById("notes").value,
    tags: ["user"],
    color: "green",
    user_id: userId
  }

  if (!data.lat || !data.lng) {
    alert("Добавь точку на карте")
    return
  }

  if (!data.ph && !data.moisture && !data.image) {
    alert("Нужны хотя бы минимальные данные")
    return
  }

  const token = localStorage.getItem('auth_token');
  const headers = {"Content-Type": "application/json"};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch("/api/block1", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data)
  })
  const result = await res.json()
  if (result.error) {
    alert(result.error)
    return
  }
  if (result.status === "error") {
    alert(result.errors?.join("\n") || "Ошибка сохранения")
    return
  }
  console.log(result)
  // Backend returns result.point, not result.saved_point
  const savedPoint = result.point || result.saved_point
  if (savedPoint) {
    addPointToMap(savedPoint)
  } else {
    console.error("No point in response:", result)
  }
}

// =========================
// AUTH FUNCTIONS
// =========================

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }

    if (password !== passwordConfirm) {
        alert('Пароли не совпадают');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        const data = await response.json();

        if (data.error) {
            alert(data.error);
        } else {
            console.log('Registration successful:', data);
            // Небольшая задержка чтобы пользователь точно сохранился
            setTimeout(async () => {
                await autoLogin(username, password);
            }, 500);
        }
    } catch (error) {
        alert('Ошибка при регистрации: ' + error.message);
    }
}

async function autoLogin(username, password) {
    try {
        console.log('Attempting auto login for:', username);
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Auto login failed:', errorData);
            alert('Ошибка входа: ' + (errorData.detail || 'Неизвестная ошибка'));
            showLoginForm();
            return;
        }
        
        const data = await response.json();
        console.log('Auto login successful:', data);

        if (data.access_token) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('username', data.username);
            updateAuthUI();
            closeAuthModal();
            alert('Вы успешно зарегистрированы и вошли как ' + data.username);
        }
    } catch (error) {
        console.error('Auto login error:', error);
        alert('Ошибка при автоматическом входе: ' + error.message);
        showLoginForm();
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }

    try {
        // Показать индикатор загрузки
        const loginBtn = document.querySelector('#login-form button');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Вход...';
        loginBtn.disabled = true;
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const responseText = await response.text();
        
        // Восстановить кнопку
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                // Если ответ начинается с <!DOCTYPE, это HTML страница
                if (responseText.trim().startsWith('<!DOCTYPE')) {
                    alert('Ошибка входа: Сервер вернул HTML страницу вместо JSON. Возможно, неверный URL.');
                } else {
                    alert('Ошибка входа: ' + responseText);
                }
                return;
            }
            alert('Ошибка входа: ' + (errorData.detail || 'Неизвестная ошибка'));
            return;
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            alert('Ошибка входа: Неверный формат ответа сервера');
            return;
        }

        if (data.access_token) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('username', data.username);
            updateAuthUI();
            closeAuthModal();
            alert('Вы вошли как ' + data.username);
        } else {
            alert('Ошибка входа');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Ошибка входа: ' + error.message);
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    updateAuthUI();
    alert('Вы вышли из системы');
}

function updateAuthUI() {
    const token = localStorage.getItem('auth_token');
    const username = localStorage.getItem('username');
    const authLink = document.getElementById('auth-link');

    if (token && username) {
        authLink.innerHTML = `<a href="#" class="nav-link" onclick="logout()">Выйти (${username})</a>`;
    } else {
        authLink.innerHTML = `<a href="#" class="nav-link" onclick="showAuthModal()">Войти</a>`;
    }
}

// Check auth on page load
// System validation on load
document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
    
    // Check critical functions exist
    const criticalFunctions = [
        'showSection', 'nextStep', 'prevStep', 'validateStep', 'processStep',
        'login', 'register', 'logout', 'loadPoints', 'loadMyPoints',
        'saveFinalPoint', 'filterPointsBySoilType', 'searchPointsBySoilName'
    ];
    
    criticalFunctions.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {
            console.error(`Critical function missing: ${funcName}`);
        }
    });
    
    // Check critical elements exist
    const criticalElements = [
        'analysis', 'map', 'cabinet', 'auth-modal', 'login-form', 'register-form'
    ];
    
    criticalElements.forEach(elementId => {
        if (!document.getElementById(elementId)) {
            console.error(`Critical element missing: ${elementId}`);
        }
    });
});

// =========================
// SOIL DYNAMICS FUNCTIONS
// =========================

let currentDynamicsPointId = null;
let dynamicsChart = null;

function openDynamicsModal(pointId, pointTitle) {
    currentDynamicsPointId = pointId;
    document.getElementById('dynamics-point-info').textContent = `Точка: ${pointTitle || pointId}`;
    document.getElementById('dynamics-modal').style.display = 'flex';
    loadDynamicsData(pointId);
}

function closeDynamicsModal() {
    document.getElementById('dynamics-modal').style.display = 'none';
    currentDynamicsPointId = null;
    if (dynamicsChart) {
        dynamicsChart.destroy();
        dynamicsChart = null;
    }
}

async function loadDynamicsData(pointId) {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            alert('Требуется авторизация');
            return;
        }
        
        // Загружаем данные для графика
        const res = await fetch(`/api/point/${pointId}/dynamics`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        
        // Отображаем график
        renderDynamicsChart(data);
        
        // Загружаем таблицу измерений
        loadMeasurementsTable(pointId);
        
    } catch (error) {
        console.error('Error loading dynamics:', error);
        alert('Ошибка загрузки данных динамики');
    }
}

function renderDynamicsChart(data) {
    const ctx = document.getElementById('dynamics-chart').getContext('2d');
    
    if (dynamicsChart) {
        dynamicsChart.destroy();
    }
    
    const datasets = [];
    const ds = data.datasets;
    
    // Добавляем линии для каждого параметра
    if (ds.ph && ds.ph.data.some(v => v !== null)) {
        datasets.push({
            label: ds.ph.label,
            data: ds.ph.data,
            borderColor: ds.ph.color,
            backgroundColor: ds.ph.color + '20',
            tension: 0.4,
            fill: false
        });
    }
    if (ds.moisture && ds.moisture.data.some(v => v !== null)) {
        datasets.push({
            label: ds.moisture.label,
            data: ds.moisture.data,
            borderColor: ds.moisture.color,
            backgroundColor: ds.moisture.color + '20',
            tension: 0.4,
            fill: false,
            yAxisID: 'y1'
        });
    }
    if (ds.nitrogen && ds.nitrogen.data.some(v => v !== null)) {
        datasets.push({
            label: ds.nitrogen.label,
            data: ds.nitrogen.data,
            borderColor: ds.nitrogen.color,
            backgroundColor: ds.nitrogen.color + '20',
            tension: 0.4,
            fill: false,
            yAxisID: 'y2'
        });
    }
    if (ds.phosphorus && ds.phosphorus.data.some(v => v !== null)) {
        datasets.push({
            label: ds.phosphorus.label,
            data: ds.phosphorus.data,
            borderColor: ds.phosphorus.color,
            backgroundColor: ds.phosphorus.color + '20',
            tension: 0.4,
            fill: false,
            yAxisID: 'y2'
        });
    }
    if (ds.potassium && ds.potassium.data.some(v => v !== null)) {
        datasets.push({
            label: ds.potassium.label,
            data: ds.potassium.data,
            borderColor: ds.potassium.color,
            backgroundColor: ds.potassium.color + '20',
            tension: 0.4,
            fill: false,
            yAxisID: 'y2'
        });
    }
    
    dynamicsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Дата'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'pH'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '% / Влажность'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y2: {
                    type: 'linear',
                    display: false,
                    position: 'right'
                }
            }
        }
    });
}

async function loadMeasurementsTable(pointId) {
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/point/${pointId}/measurements`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const tbody = document.getElementById('measurements-tbody');
        
        if (data.measurements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">Нет данных. Добавьте первое измерение.</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.measurements.map(m => {
            const date = new Date(m.timestamp).toLocaleDateString('ru-RU');
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${date}</td>
                    <td style="padding: 10px; text-align: center; color: #2196F3; font-weight: 500;">${m.ph !== null && m.ph !== undefined ? m.ph.toFixed(1) : '-'}</td>
                    <td style="padding: 10px; text-align: center; color: #4CAF50; font-weight: 500;">${m.moisture !== null && m.moisture !== undefined ? m.moisture.toFixed(1) : '-'}</td>
                    <td style="padding: 10px; text-align: center; color: #9C27B0; font-weight: 500;">${m.nitrogen !== null && m.nitrogen !== undefined ? m.nitrogen.toFixed(1) : '-'}</td>
                    <td style="padding: 10px; text-align: center; color: #FFC107; font-weight: 500;">${m.phosphorus !== null && m.phosphorus !== undefined ? m.phosphorus.toFixed(1) : '-'}</td>
                    <td style="padding: 10px; text-align: center; color: #F44336; font-weight: 500;">${m.potassium !== null && m.potassium !== undefined ? m.potassium.toFixed(1) : '-'}</td>
                    <td style="padding: 10px; color: #666; font-size: 12px;">${m.notes || ''}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading measurements:', error);
        document.getElementById('measurements-tbody').innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">Ошибка загрузки данных</td></tr>';
    }
}

function showAddMeasurementForm() {
    document.getElementById('add-measurement-form').style.display = 'block';
}

function hideAddMeasurementForm() {
    document.getElementById('add-measurement-form').style.display = 'none';
    // Clear inputs
    document.getElementById('new-ph').value = '';
    document.getElementById('new-moisture').value = '';
    document.getElementById('new-nitrogen').value = '';
    document.getElementById('new-phosphorus').value = '';
    document.getElementById('new-potassium').value = '';
    document.getElementById('new-notes').value = '';
}

async function submitNewMeasurement() {
    if (!currentDynamicsPointId) return;
    
    const data = {
        ph: parseFloat(document.getElementById('new-ph').value) || null,
        moisture: parseFloat(document.getElementById('new-moisture').value) || null,
        nitrogen: parseFloat(document.getElementById('new-nitrogen').value) || null,
        phosphorus: parseFloat(document.getElementById('new-phosphorus').value) || null,
        potassium: parseFloat(document.getElementById('new-potassium').value) || null,
        notes: document.getElementById('new-notes').value || ''
    };
    
    // Проверяем что хотя бы одно значение заполнено
    if (!data.ph && !data.moisture && !data.nitrogen && !data.phosphorus && !data.potassium) {
        alert('Заполните хотя бы одно поле');
        return;
    }
    
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/point/${currentDynamicsPointId}/measurements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Ошибка сохранения');
        }
        
        const result = await res.json();
        alert('Измерение добавлено!');
        hideAddMeasurementForm();
        
        // Перезагружаем данные
        loadDynamicsData(currentDynamicsPointId);
        
    } catch (error) {
        console.error('Error adding measurement:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Функции для подтверждения типа почвы
let confirmedSoilType = null;
let aiSoilTypeResult = null;

function confirmSoilType(isCorrect) {
    if (isCorrect) {
        // Пользователь подтвердил ИИ определение
        confirmedSoilType = aiSoilTypeResult;
        document.getElementById('soil-type-confirmation').style.display = 'none';
        document.getElementById('soil-type-selection-step9').style.display = 'none';
        
        // Показываем подтверждение
        const displayDiv = document.getElementById('ai-soil-type-display');
        displayDiv.innerHTML = `
            <div style="background: #e8f5e8; padding: 10px; border-radius: 5px;">
                <strong>✅ Подтверждено:</strong> ${aiSoilTypeResult.soil_ru} (${aiSoilTypeResult.soil_wrb})
                <br><small>Уверенность: ${aiSoilTypeResult.confidence}%</small>
                <br><small>${aiSoilTypeResult.reason}</small>
            </div>
        `;
    } else {
        // Пользователь отклонил ИИ определение
        document.getElementById('soil-type-confirmation').style.display = 'none';
        document.getElementById('soil-type-selection-step9').style.display = 'block';
        
        // Загружаем опции для выбора
        loadSoilTypeOptions();
    }
}

function loadSoilTypeOptions() {
    const select = document.getElementById('step9-soil-type');
    const soilTypes = [
        {ru: 'чернозем', wrb: 'Chernozem'},
        {ru: 'подзол', wrb: 'Podzol'},
        {ru: 'серая лесная', wrb: 'Greyzemic'},
        {ru: 'каштановая', wrb: 'Kastanozem'},
        {ru: 'солонец', wrb: 'Solonetz'},
        {ru: 'болотная', wrb: 'Histosol'},
        {ru: 'дерново-подзолистая', wrb: 'Albeluvisol'},
        {ru: 'аллювиальная', wrb: 'Fluvisol'},
        {ru: 'песчаная', wrb: 'Arenosol'},
        {ru: 'глинистая', wrb: 'Vertisol'}
    ];
    
    // Сохраняем первую опцию
    const firstOption = select.innerHTML;
    
    // Добавляем опции
    soilTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.ru;
        option.textContent = `${type.ru} (${type.wrb})`;
        select.appendChild(option);
    });
}

function displayAISoilType(soilTypeResult) {
    aiSoilTypeResult = soilTypeResult;
    
    if (soilTypeResult && soilTypeResult.soil_ru !== 'не определено') {
        // Показываем ИИ результат с кнопками подтверждения
        document.getElementById('ai-soil-type-text').innerHTML = 
            `<strong>${soilTypeResult.soil_ru}</strong> (${soilTypeResult.soil_wrb})<br>
             <small>${soilTypeResult.reason}</small>`;
        document.getElementById('ai-confidence').textContent = soilTypeResult.confidence;
        document.getElementById('soil-type-confirmation').style.display = 'block';
        document.getElementById('soil-type-selection-step9').style.display = 'none';
    } else {
        // ИИ не смог определить тип - показываем только выбор вручную
        document.getElementById('soil-type-confirmation').style.display = 'none';
        document.getElementById('soil-type-selection-step9').style.display = 'block';
        loadSoilTypeOptions();
    }
}

function getConfirmedSoilType() {
    if (confirmedSoilType) {
        return confirmedSoilType;
    }
    
    // Если пользователь выбрал вручную
    const manualSelection = document.getElementById('step9-soil-type').value;
    if (manualSelection) {
        // Ищем WRB классификацию
        const soilTypes = {
            'чернозем': 'Chernozem',
            'подзол': 'Podzol',
            'серая лесная': 'Greyzemic',
            'каштановая': 'Kastanozem',
            'солонец': 'Solonetz',
            'болотная': 'Histosol',
            'дерново-подзолистая': 'Albeluvisol',
            'аллювиальная': 'Fluvisol',
            'песчаная': 'Arenosol',
            'глинистая': 'Vertisol'
        };
        
        return {
            soil_ru: manualSelection,
            soil_wrb: soilTypes[manualSelection] || '-',
            confidence: 100, // Ручной выбор = 100% уверенность
            reason: 'Выбрано пользователем вручную'
        };
    }
    
    return null;
}

function showPointPhotos(imagesJson) {
    try {
        const images = JSON.parse(imagesJson);
        if (!images || images.length === 0) {
            alert('Нет фотографий для просмотра');
            return;
        }
        
        // Создаем модальное окно для просмотра фото
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 16px; max-width: 90%; max-height: 90%; position: relative;">
                <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; right: 10px; top: 10px; background: #f44336; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">×</button>
                <h3 style="margin: 0 0 20px 0; color: #2E7D32;">📷 Фотографии точки (${images.length})</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; max-height: 70vh; overflow-y: auto;">
                    ${images.map((img, idx) => `
                        <div style="text-align: center;">
                            <img src="${img}" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" 
                                 onclick="openPhotoModal('${img}')">
                            <p style="margin: 5px 0; font-size: 12px; color: #666;">Фото ${idx + 1}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error parsing images:', error);
        alert('Ошибка при загрузке фотографий');
    }
}

function openFeedbackLink() {
    window.open('https://vk.com/topic-238378507_60860089', '_blank');
}

// Points List Functions
let allPointsList = [];
let filteredPointsList = [];

async function loadPointsList() {
    try {
        showLoading('Загрузка точек...', 'Получение данных со всех источников');
        updateProgress(25);
        
        // Load from global storage
        const response = await fetch('/api/points');
        if (!response.ok) throw new Error('Failed to load points');
        
        const points = await response.json();
        allPointsList = points || [];
        filteredPointsList = [...allPointsList];
        
        updateProgress(50);
        
        // Load soil types for filter
        await loadSoilTypesForList();
        
        updateProgress(75);
        
        // Render points list
        renderPointsList();
        
        updateProgress(100);
        hideLoading();
        showSuccessToast(`Загружено ${allPointsList.length} точек`);
        
    } catch (error) {
        handleAsyncError(error, 'загрузке списка точек');
        document.getElementById('points-list-content').innerHTML = '<p>Ошибка загрузки данных</p>';
    }
}

async function loadSoilTypesForList() {
    try {
        const response = await fetch('/api/soil-types');
        if (!response.ok) return;
        
        const data = await response.json();
        const select = document.getElementById('list-soil-filter');
        select.innerHTML = '<option value="">Все типы почвы</option>';
        
        if (data.soil_types) {
            data.soil_types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading soil types for list:', error);
    }
}

function renderPointsList() {
    const container = document.getElementById('points-list-content');
    
    if (filteredPointsList.length === 0) {
        container.innerHTML = '<p>Точки не найдены</p>';
        return;
    }
    
    const pointsHtml = filteredPointsList.map(point => {
        const images = point.images || [];
        const firstImage = images.length > 0 ? images[0] : point.image;
        const ai = point.ai_analysis || {};
        const fertility = ai.fertility_score || 5;
        
        // Приоритет: выбор пользователя > ИИ определение > старый формат
        const soilTypeObj = point.soil_type || {};
        const soilType = soilTypeObj.soil_ru || ai.soil_type || "Не определен";
        
        // Добавляем информацию о том, кто определил тип
        let soilTypeInfo = "";
        if (soilTypeObj.soil_ru && soilTypeObj.confidence === 100) {
            soilTypeInfo = `<small style="color: #4CAF50;">✅ Выбрано пользователем</small>`;
        } else if (soilTypeObj.soil_ru && soilTypeObj.confidence < 100) {
            soilTypeInfo = `<small style="color: #2196F3;">🤖 ИИ (${soilTypeObj.confidence}%)</small>`;
        } else if (ai.soil_type) {
            soilTypeInfo = `<small style="color: #FF9800;">🔬 Старый ИИ анализ</small>`;
        }
        
        const region = point.region || "Не определен";
        const qualityScore = point.quality_score || 0;
        const date = point.created_at || new Date().toISOString();
        const formattedDate = new Date(date).toLocaleDateString('ru-RU');
        
        return `
            <div class="cabinet-point" style="border:1px solid #A5D6A7; padding:15px; margin-bottom:15px; border-radius:10px; background:white;">
                ${firstImage ? `
                    <div style="position: relative; margin-bottom: 10px;">
                        <img src="${firstImage}" style="width:100%; border-radius:8px; max-height:200px; object-fit:cover; cursor: pointer;" 
                             onclick="openPhotoModal('${firstImage}')">
                        ${images.length > 1 ? `
                            <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                                📷 ${images.length} фото
                            </div>
                        ` : ''}
                    </div>
                ` : ""}
                
                <h4 style="color:#2E7D32; margin-bottom:10px;">🌱 ТОЧКА #${point.id.slice(0, 8)}</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 14px;">
                    <div><strong>Дата:</strong> ${formattedDate}</div>
                    <div><strong>Регион:</strong> ${region}</div>
                    <div><strong>Координаты:</strong><br>${point.lat?.toFixed(4)}, ${point.lng?.toFixed(4)}</div>
                    <div><strong>Качество:</strong> ${qualityScore}/100</div>
                    <div><strong>pH:</strong> ${point.ph || "-"}</div>
                    <div><strong>Влажность:</strong> ${point.moisture || "-"}%</div>
                    <div><strong>N:</strong> ${point.nitrogen || "-"}</div>
                    <div><strong>P:</strong> ${point.phosphorus || "-"}</div>
                    <div><strong>K:</strong> ${point.potassium || "-"}</div>
                    <div><strong>Пользователь:</strong> ${point.user_id?.slice(0, 8) || "-"}</div>
                </div>
                
                ${soilType !== "Не определен" ? `
                    <div style="padding:10px; background:rgba(76,175,80,0.1); border-radius:6px; margin:10px 0;">
                        <p style="margin:0;"><strong>Тип почвы:</strong> ${soilType}</p>
                        ${soilTypeInfo ? `<p style="margin:5px 0 0 0; font-size:12px;">${soilTypeInfo}</p>` : ''}
                        <p style="margin:5px 0 0 0; font-size:12px;">Плодородие: ${fertility}/10</p>
                    </div>
                ` : ""}
                
                ${point.tags?.length ? `<p><strong>Теги:</strong> ${point.tags.join(", ")}</p>` : ""}
                ${point.notes ? `<p><strong>Заметки:</strong> ${point.notes}</p>` : ""}
                
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap: wrap;">
                    <button onclick="map.setView([${point.lat}, ${point.lng}], 15); showSection('map');" 
                        style="flex:1; min-width:100px; padding:8px; background:#1976D2; color:white; border:none; border-radius:6px; cursor:pointer;">
                        📍 На карте
                    </button>
                    ${images.length > 1 ? `
                        <button onclick="showPointPhotos('${JSON.stringify(images).replace(/'/g, "\\'")}')" 
                            style="flex:1; min-width:100px; padding:8px; background:#FF9800; color:white; border:none; border-radius:6px; cursor:pointer;">
                            📷 Все фото
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = pointsHtml;
}

function filterPointsList() {
    const selectedType = document.getElementById('list-soil-filter').value;
    
    if (!selectedType) {
        filteredPointsList = [...allPointsList];
    } else {
        filteredPointsList = allPointsList.filter(point => {
            const soilType = (point.soil_type?.soil_ru || point.ai_analysis?.soil_type || '');
            return soilType === selectedType;
        });
    }
    
    renderPointsList();
    showInfoToast(`Отфильтровано: ${filteredPointsList.length} точек`);
}

function clearPointsListFilter() {
    document.getElementById('list-soil-filter').value = '';
    filteredPointsList = [...allPointsList];
    renderPointsList();
    showInfoToast('Фильтр сброшен');
}

function sortPointsList() {
    const sortBy = document.getElementById('list-sort').value;
    
    switch(sortBy) {
        case 'date-desc':
            filteredPointsList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            break;
        case 'date-asc':
            filteredPointsList.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            break;
        case 'ph-desc':
            filteredPointsList.sort((a, b) => (b.ph || 0) - (a.ph || 0));
            break;
        case 'ph-asc':
            filteredPointsList.sort((a, b) => (a.ph || 0) - (b.ph || 0));
            break;
        case 'soil':
            filteredPointsList.sort((a, b) => {
                const soilA = a.soil_type?.soil_ru || a.ai_analysis?.soil_type || '';
                const soilB = b.soil_type?.soil_ru || b.ai_analysis?.soil_type || '';
                return soilA.localeCompare(soilB);
            });
            break;
    }
    
    renderPointsList();
    showInfoToast('Список отсортирован');
}

// Load points list when section is shown
const originalShowSection = showSection;
showSection = function(sectionId) {
    originalShowSection(sectionId);
    
    if (sectionId === 'points-list') {
        loadPointsList();
    }
};

// Loading indicator functions
function showLoading(text = "Анализ данных...", subtext = "Пожалуйста, подождите") {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');
    
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    overlay.style.display = 'flex';
    
    // Reset progress bar
    updateProgress(0);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
}

function updateProgress(percent) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = percent + '%';
}

// Toast notification functions
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    
    document.getElementById('toast-container').appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.style.display = 'block';
    }, 100);
    
    // Hide toast after duration
    setTimeout(() => {
        toast.style.display = 'none';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

function showSuccessToast(message) {
    showToast(message, 'success');
}

function showErrorToast(message) {
    showToast(message, 'error', 5000);
}

function showInfoToast(message) {
    showToast(message, 'info');
}

// Enhanced error handling
function handleAsyncError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    showErrorToast(`Ошибка: ${error.message || 'Произошла непредвиденная ошибка'}`);
    hideLoading();
}

// Progress tracking for multi-step operations
class ProgressTracker {
    constructor(totalSteps) {
        this.totalSteps = totalSteps;
        this.currentStep = 0;
    }
    
    update(step, message) {
        this.currentStep = step;
        const percent = Math.round((step / this.totalSteps) * 100);
        updateProgress(percent);
        
        if (message) {
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
    }
    
    complete() {
        updateProgress(100);
        setTimeout(hideLoading, 500);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Only handle shortcuts when not typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Ctrl/Cmd + combinations
    if (event.ctrlKey || event.metaKey) {
        switch(event.key) {
            case 's':
                event.preventDefault();
                // Save current step if on analysis
                if (currentSection === 'analysis' && currentStep > 0) {
                    const nextBtn = document.querySelector('.btn-primary');
                    if (nextBtn) nextBtn.click();
                }
                break;
            case 'Enter':
                event.preventDefault();
                // Submit current form
                const submitBtn = document.querySelector('.btn-success');
                if (submitBtn) submitBtn.click();
                break;
            case 'Escape':
                event.preventDefault();
                // Close modals
                closeAllModals();
                break;
        }
        return;
    }
    
    // Single key shortcuts
    switch(event.key) {
        case '1':
            showSection('analysis');
            showInfoToast('Переключено на анализ');
            break;
        case '2':
            showSection('map');
            showInfoToast('Переключено на карту');
            break;
        case '3':
            showSection('cabinet');
            showInfoToast('Переключено на личный кабинет');
            break;
        case 'Escape':
            // Close loading overlay
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay && loadingOverlay.style.display === 'flex') {
                hideLoading();
            }
            closeAllModals();
            break;
        case 'ArrowLeft':
            // Previous step in analysis
            if (currentSection === 'analysis' && currentStep > 1) {
                prevStep(currentStep - 1);
            }
            break;
        case 'ArrowRight':
            // Next step in analysis
            if (currentSection === 'analysis' && currentStep < 9) {
                nextStep(currentStep + 1);
            }
            break;
    }
});

function closeAllModals() {
    // Close all modal dialogs
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
    
    // Close any custom modals (like photo gallery)
    const customModals = document.querySelectorAll('[style*="position: fixed"]');
    customModals.forEach(modal => {
        if (modal.style.display === 'flex') {
            modal.remove();
        }
    });
}

// Add help tooltip for keyboard shortcuts
function showKeyboardHelp() {
    const helpText = `
        <h4>🎹 Горячие клавиши:</h4>
        <ul style="text-align: left; font-size: 14px;">
            <li><strong>1</strong> - Анализ</li>
            <li><strong>2</strong> - Карта</li>
            <li><strong>3</strong> - Личный кабинет</li>
            <li><strong>←/→</strong> - Предыдущий/Следующий шаг</li>
            <li><strong>Ctrl+S</strong> - Сохранить шаг</li>
            <li><strong>Ctrl+Enter</strong> - Отправить форму</li>
            <li><strong>Escape</strong> - Закрыть модальное окно</li>
        </ul>
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 16px; max-width: 500px; position: relative;">
            <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; right: 10px; top: 10px; background: #f44336; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">×</button>
            ${helpText}
            <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">Понятно</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Add keyboard help button to navigation
document.addEventListener('DOMContentLoaded', function() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        const helpLi = document.createElement('li');
        helpLi.innerHTML = '<a href="#" class="nav-link" onclick="showKeyboardHelp()">⌨️</a>';
        navMenu.appendChild(helpLi);
    }
});
