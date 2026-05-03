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

function initMap() {
    if (map) return
    map = L.map('leaflet-map').setView([55.75, 37.61], 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
}

const user_id = localStorage.getItem('user_id') || crypto.randomUUID()
localStorage.setItem('user_id', user_id)
async function loadPoints() {
    try {
        console.log('Loading all points for general map...');
        const res = await fetch("/api/points");
        const points = await res.json();
        console.log(`Loaded ${points.length} points from backend`);
        
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
function addPointToMap(p) {
    const marker = L.marker([p.lat, p.lng]).addTo(map);
    const image = p.image 
        ? `<img src="${p.image}" style="width:100%;max-height:120px;object-fit:cover;">` 
        : "";
    const popup = `
        ${image}
        <b>pH:</b> ${p.ph || "-"}
        <br>
        <b>Влажность:</b> ${p.moisture || "-"}
        <br>
        <b>Confidence:</b> ${p.confidence}%
        <br>
        <b>Тип:</b> ${p.passport?.type || "-"}
        <br>
        <p>${p.notes || ""}</p>
    `;
    marker.bindPopup(popup);
}

// =========================
// SECTION NAVIGATION
// =========================
function showSection(section) {
    // Hide all sections
    document.getElementById("analysis").style.display = "none";
    document.getElementById("map").style.display = "none";
    document.getElementById("cabinet").style.display = "none";
    
    // Show selected section
    document.getElementById(section).style.display = "block";
    
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
}

// =========================
// STEP NAVIGATION
// =========================
async function nextStep(step) {
    console.log(`nextStep called with step: ${step}, currentStep: ${currentStep}`);
    
    if (step > currentStep) {
        // Validate current step before proceeding
        const isValid = await validateStep(currentStep);
        console.log(`Validation result for step ${currentStep}: ${isValid}`);
        if (!isValid) {
            console.log('Validation failed, stopping navigation');
            return;
        }
        
        const oldStep = currentStep;
        currentStep = step;
        console.log(`Moving from step ${oldStep} to step ${step}`);
        
        // Update layers
        updateLayers(oldStep, currentStep);
        processStep(step);
    } else {
        const oldStep = currentStep;
        currentStep = step;
        console.log(`Moving backwards from step ${oldStep} to step ${step}`);
        updateLayers(oldStep, currentStep);
        processStep(step);
    }
}

function prevStep(step) {
    const oldStep = currentStep;
    currentStep = step;
    updateLayers(oldStep, currentStep);
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
            // Validate photos if present - simple validation without API call
            if (stepData.images && stepData.images.length > 0) {
                try {
                    // Simple client-side validation
                    if (stepData.images.length > 10) {
                        alert('Слишком много фото. Максимум 10 фото.');
                        return false;
                    }
                    console.log(`Validated ${stepData.images.length} photos`);
                } catch (error) {
                    console.error('Validation error:', error);
                }
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
        images: stepData.images,
        ph: stepData.ph,
        moisture: stepData.moisture,
        nitrogen: stepData.nitrogen,
        phosphorus: stepData.phosphorus,
        potassium: stepData.potassium,
        lat: stepData.lat,
        lng: stepData.lng,
        color: stepData.color,
        icon: stepData.icon,
        tags: stepData.tags,
        notes: notes,
        soil_type: selectedSoilType || stepData.validationResult?.identified_soil_type || ""
    };
}

// =========================
// SAVE FINAL POINT
// =========================
async function saveFinalPoint() {
    const summaryDiv = document.getElementById('final-summary');
    
    // Проверяем авторизацию
    const token = localStorage.getItem('auth_token');
    if (!token) {
        alert('Для сохранения точек необходимо войти в систему');
        showAuthModal();
        return;
    }
    
    // Build final point data
    const userId = localStorage.getItem('user_id');
    const point = collectStepData();
    
    console.log('Saving point:', point);
    
    // Определяем тип почвы для отображения
    let soilTypeDisplay = point.soil_type || stepData.validationResult?.identified_soil_type || "Не определен";
    
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
            <p><strong>Фото:</strong> ${point.images.length} шт.</p>
            <p><strong>Цвет:</strong> ${point.color}</p>
            <p><strong>Иконка:</strong> ${point.icon}</p>
            <p><strong>Теги:</strong> ${point.tags.join(', ') || 'Нет'}</p>
            <p><strong>Заметки:</strong> ${point.notes || 'Нет'}</p>
        </div>
        <p style="margin-top: 10px;">Сохранение точки...</p>
    `;
    
    // Save to backend
    try {
        const headers = {'Content-Type': 'application/json'};
        headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch('/api/block1', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(point)
        });
        
        if (response.status === 401) {
            summaryDiv.innerHTML += `
                <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 15px;">
                    <h4>❌ Требуется авторизация</h4>
                    <p>Ваша сессия истекла. Пожалуйста, войдите снова.</p>
                </div>
            `;
            showAuthModal();
            return;
        }
        
        const text = await response.text();
        console.log('Backend response text:', text);
        
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            result = { error: `Backend returned non-JSON: ${text.substring(0, 200)}` };
        }
        
        console.log('Backend response:', result);
        
        if (result.status === 'ok') {
            // Mark user as having completed analysis
            localStorage.setItem('hasCompletedAnalysis', 'true');
            
            console.log('Point saved successfully, reloading all points...');
            
            summaryDiv.innerHTML += `
                <div style="padding: 20px; background: rgba(76, 175, 80, 0.2); border-radius: 8px; margin-top: 15px;">
                    <h4>✅ Точка успешно сохранена!</h4>
                    <p>Перенаправление на карту...</p>
                </div>
            `;
            
            // Перезагрузить все точки (общую карту) и перейти на карту
            loadPoints(); // Загружаем все точки для общей карты
            loadMyPoints(); // Загружаем точки пользователя для личного кабинета
            
            setTimeout(() => {
                showSection('map');
                console.log('Switched to map section');
            }, 1000);
        } else {
            summaryDiv.innerHTML += `
                <div style="padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; margin-top: 15px;">
                    <h4>❌ Ошибка при сохранении</h4>
                    <p>${result.error || 'Попробуйте снова'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Save error:', error);
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
    stepData = {
        images: [],
        ph: null,
        moisture: null,
        nitrogen: null,
        phosphorus: null,
        potassium: null,
        lat: null,
        lng: null,
        color: 'green',
        icon: 'sample',
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
    document.getElementById('step7-color').value = 'green';
    document.getElementById('step7-icon').value = 'sample';
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
    
    // Очищаем старые маркеры
    markers.forEach(marker => {
        if (marker._soilType !== selectedType) {
            marker.setOpacity(0.3);
        } else {
            marker.setOpacity(1);
        }
    });
}

function searchPointsBySoilName() {
    const searchTerm = document.getElementById('soil-search-input').value.toLowerCase().trim();
    console.log('Searching by soil name:', searchTerm);
    
    if (!searchTerm) {
        alert('Введите название почвы для поиска');
        return;
    }
    
    let foundCount = 0;
    markers.forEach(marker => {
        const soilType = (marker._soilType || '').toLowerCase();
        if (soilType.includes(searchTerm)) {
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
            marker.setOpacity(0.2);
        }
    });
    
    // Показываем результат поиска
    if (foundCount > 0) {
        // Центрируем карту на первой найденной точке
        const firstFound = markers.find(m => m.getOpacity() === 1);
        if (firstFound) {
            map.setView(firstFound.getLatLng(), 10);
        }
        alert(`Найдено точек: ${foundCount}`);
    } else {
        alert('Точки с таким типом почвы не найдены');
    }
}

function clearSoilSearch() {
    document.getElementById('soil-search-input').value = '';
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
}

function updateStepUI() {
    // Show current step panel
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    const currentPanel = document.querySelector(`[data-step="${currentStep}"]`);
    if (currentPanel) {
        currentPanel.style.display = 'block';
    }
    
    // Update sidebar step indicators
    document.querySelectorAll('.sidebar .step-indicator').forEach(indicator => {
        indicator.classList.remove('active', 'completed');
        const step = parseInt(indicator.dataset.step);
        if (step === currentStep) {
            indicator.classList.add('active');
        } else if (step < currentStep) {
            indicator.classList.add('completed');
        }
    });
    
    console.log(`Updated UI for step ${currentStep}`);
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
    const soilType = point.report?.general?.soil_type || "Не определен";
    
    pointInfoDiv.innerHTML = `
        ${firstImage ? `<img src="${firstImage}" style="width:100%; border-radius:8px; margin-bottom:10px;">` : ""}
        ${images.length > 1 ? `<small style="color:#666;">${images.length} фото</small>` : ""}
        <h4 style="color:#2E7D32;">${point.type === 'professional' ? '🎓 ПРОФЕССИОНАЛЬНАЯ' : '🔬 ЛЮБИТЕЛЬСКАЯ'} ТОЧКА</h4>
        
        <div style="padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; margin: 15px 0;">
            <h5 style="color: #22c55e; margin: 0 0 8px 0;">🌱 Тип почвы</h5>
            <p style="margin: 0; font-size: 16px; font-weight: 600;">${soilType}</p>
        </div>
        
        <p><strong>Координаты:</strong> ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</p>
        <hr style="margin:10px 0; border-color:#A5D6A7;">
        ${formatStructuredReport(point.report)}
        ${point.notes ? `<p><strong>Заметки:</strong> ${point.notes}</p>` : ''}
        ${point.tags && point.tags.length > 0 ? `<p><strong>Теги:</strong> ${point.tags.join(', ')}</p>` : ''}
        <button class="btn btn-primary" onclick="map.setView([${point.lat}, ${point.lng}], 13)">📍 Центрировать</button>
    `;
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
    const soilType = report?.general?.soil_type || "Не определен";
    
    return `
        <div style="max-width:300px">
            ${firstImage ? `<img src="${firstImage}" style="width:100%; border-radius:8px; margin-bottom:10px;">` : ""}
            <b>${p.type === 'professional' ? '🎓 ПРОФ' : '🔬 ЛЮБ'}</b>
            ${images.length > 1 ? `<br><small>${images.length} фото</small>` : ""}
            <br><br>
            <div style="padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; margin-bottom: 10px;">
                <b style="color: #22c55e; font-size: 14px;">🌱 Тип почвы:</b><br>
                <span style="font-size: 13px; font-weight: 600;">${soilType}</span>
            </div>
            <b>pH:</b> ${report?.chemistry?.ph || p.ph || "—"}
            <br>
            <b>N:</b> ${report?.chemistry?.nitrogen || p.nitrogen || "—"}
            <br>
            <b>P:</b> ${report?.chemistry?.phosphorus || p.phosphorus || "—"}
            <br>
            <b>K:</b> ${report?.chemistry?.potassium || p.potassium || "—"}
            <br>
            ${p.notes ? `<i>${p.notes}</i>` : ""}
        </div>
    `;
}

async function loadUserCabinet() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            document.getElementById('my-points-list').innerHTML = '<p>Для просмотра личного кабинета необходимо войти в систему</p>';
            showAuthModal();
            return;
        }
        
        const headers = {'Authorization': `Bearer ${token}`};
        const res = await fetch(`/api/user-cabinet`, {
            headers: headers
        });
        
        if (res.status === 401) {
            document.getElementById('my-points-list').innerHTML = '<p>Ваша сессия истекла. Пожалуйста, войдите снова.</p>';
            showAuthModal();
            return;
        }
        
        const data = await res.json();
        
        const cabinetDiv = document.getElementById('my-points-list');
        if (data.points && data.points.length > 0) {
            cabinetDiv.innerHTML = data.points.map(point => {
                const images = point.images || [];
                const firstImage = images.length > 0 ? images[0] : point.image;
                
                return `
                <div class="cabinet-point" style="border:1px solid #A5D6A7; padding:15px; margin-bottom:15px; border-radius:10px; background:white;">
                    ${firstImage ? `<img src="${firstImage}" style="width:100%; border-radius:8px; margin-bottom:10px;">` : ""}
                    ${images.length > 1 ? `<small style="color:#666;">${images.length} фото</small>` : ""}
                    <h4 style="color:#2E7D32; margin-bottom:10px;">${point.type === 'professional' ? '🎓 ПРОФЕССИОНАЛЬНАЯ' : '🔬 ЛЮБИТЕЛЬСКАЯ'} ТОЧКА #${point.id.slice(0, 8)}</h4>
                    <p><strong>Координаты:</strong> ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</p>
                    ${formatStructuredReport(point.report)}
                    ${point.notes ? `<p><strong>Заметки:</strong> ${point.notes}</p>` : ''}
                    ${point.tags && point.tags.length > 0 ? `<p><strong>Теги:</strong> ${point.tags.join(', ')}</p>` : ''}
                </div>
            `}).join('');
        } else {
            cabinetDiv.innerHTML = '<p>У вас пока нет сохранённых точек</p>';
        }
    } catch (error) {
        console.error('Error loading cabinet:', error);
        document.getElementById('my-points-list').innerHTML = '<p>Ошибка загрузки данных</p>';
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
    const token = localStorage.getItem('auth_token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch("/api/user-cabinet", {
        headers: headers
    });
    const data = await res.json();
    
    const list = document.getElementById("my-points-list");
    list.innerHTML = "";
    
    if (data.points.length === 0) {
        list.innerHTML = "<p>У вас пока нет точек</p>";
        return;
    }
    
    // Отображаем точки
    data.points.forEach(point => {
        const div = document.createElement("div");
        div.className = "cabinet-point";
        div.innerHTML = `
            <h4>Точка #${point.id.slice(0, 8)}</h4>
            <p>Координаты: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</p>
            <p>pH: ${point.ph || "-"} | Влажность: ${point.moisture || "-"}%</p>
            ${point.tags ? `<p>Теги: ${point.tags.join(", ")}</p>` : ""}
            ${point.notes ? `<p>${point.notes}</p>` : ""}
            ${point.is_test ? '<span style="color: #eab308;">🧪 Тестовая точка</span>' : ''}
            ${!point.is_test ? `<button class="btn-delete" onclick="deletePoint('${point.id}')" style="margin-top: 10px; padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer;">🗑️ Удалить</button>` : ''}
        `;
        list.appendChild(div);
    });
    
    // Отображаем пометки
    if (data.annotations && data.annotations.length > 0) {
        const annotationsDiv = document.createElement("div");
        annotationsDiv.style.cssText = "margin-top: 20px; padding: 15px; background: rgba(20, 184, 166, 0.1); border-radius: 8px;";
        annotationsDiv.innerHTML = `
            <h4 style="color: #14b8a6;">🏷️ Мои пометки (${data.annotations.length})</h4>
        `;
        data.annotations.forEach(annotation => {
            const annDiv = document.createElement("div");
            annDiv.style.cssText = "padding: 10px; margin-top: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 4px;";
            annDiv.innerHTML = `
                <p><strong>ID:</strong> ${annotation.id.slice(0, 8)}</p>
                ${annotation.notes ? `<p>${annotation.notes}</p>` : ""}
                ${annotation.tags?.length ? `<p>Теги: ${annotation.tags.join(", ")}</p>` : ""}
            `;
            annotationsDiv.appendChild(annDiv);
        });
        list.appendChild(annotationsDiv);
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
    alert(result.errors.join("\n"))
    return
  }
  console.log(result)
  addPointToMap(result.saved_point)
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
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert('Ошибка входа: ' + (errorData.detail || 'Неизвестная ошибка'));
            return;
        }
        
        const data = await response.json();

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
        alert('Ошибка при входе: ' + error.message);
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
document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
});
