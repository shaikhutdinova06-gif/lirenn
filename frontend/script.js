// LIRENN MAP v2 - Interactive Map with Russian Soil Zoning & User Points
// Replaces the current LIRENN map

// =========================
// BLOCK 1 MAP LOGIC
// =========================
let currentPoint = null;
let currentMarker = null;

if (!localStorage.getItem("user_id")) {
    localStorage.setItem("user_id", crypto.randomUUID());
}

// =========================
// ORIGINAL MAP CODE
// =========================

// API URL - use relative path for same-origin requests
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://liren-map-backend.onrender.com';

// Initialize map
const map = L.map("map").setView([60, 90], 3);

// Base map
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

// =========================
// BLOCK 1 MAP FUNCTIONS (after map init)
// =========================

// Клик по карте
map.on("click", function(e) {
    setCurrentPoint(e.latlng.lat, e.latlng.lng);
});

// Установка точки
function setCurrentPoint(lat, lng) {
    currentPoint = { lat, lng };
    document.getElementById("lat").value = lat.toFixed(6);
    document.getElementById("lng").value = lng.toFixed(6);
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    currentMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup("Выбранная точка")
        .openPopup();
    map.setView([lat, lng], 13);
}

// Найти участок
function goToLocation() {
    const lat = parseFloat(document.getElementById("lat").value);
    const lng = parseFloat(document.getElementById("lng").value);
    if (isNaN(lat) || isNaN(lng)) {
        alert("Введите координаты");
        return;
    }
    setCurrentPoint(lat, lng);
}

// Моё местоположение
function getMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentPoint(pos.coords.latitude, pos.coords.longitude);
    });
}

// Добавить точку
async function addPoint() {
    if (!currentPoint) {
        alert("Выберите точку");
        return;
    }

    const imageInput = document.getElementById("image");
    let imageData = null;
    if (imageInput.files.length > 0) {
        imageData = await toBase64(imageInput.files[0]);
    }

    const data = {
        lat: currentPoint.lat,
        lng: currentPoint.lng,
        ph: document.getElementById("ph")?.value,
        moisture: document.getElementById("moisture")?.value,
        color: document.getElementById("color")?.value,
        icon: document.getElementById("icon")?.value,
        tags: document.getElementById("tags")?.value.split(",").map(t => t.trim()),
        notes: document.getElementById("notes")?.value,
        user_id: localStorage.getItem("user_id")
    };

    if (imageData) {
        data.image = imageData;
    }

    const res = await fetch("/api/block1", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.error) {
        alert(result.error);
        return;
    }
    addPointToMap(result.point);
}

// Конвертация файла в base64
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Тестовое местоположение
function loadTestLocation() {
    setCurrentPoint(55.7558, 37.6173);
    document.getElementById("ph").value = "7.0";
    document.getElementById("moisture").value = "50";
    document.getElementById("tags").value = "#чернозём, #тест";
    document.getElementById("notes").value = "Тестовая точка для демонстрации";
}

// Отображение точки
function addPointToMap(point) {
    const colorMap = {
        green: "#22c55e",
        yellow: "#eab308",
        red: "#ef4444",
        blue: "#3b82f6"
    };

    const iconMap = {
        sample: "🧪",
        analysis: "📊",
        interest: "⭐",
        control: "🎯"
    };

    const color = colorMap[point.color] || "#22c55e";
    const icon = iconMap[point.icon] || "📍";

    const marker = L.marker([point.lat, point.lng]).addTo(map);
    marker.bindPopup(`
        <div style="min-width: 200px;">
            <strong>${icon} Точка</strong><br>
            pH: ${point.ph || "-"}<br>
            Влажность: ${point.moisture || "-"}%<br>
            ${point.tags ? `Теги: ${point.tags.join(", ")}<br>` : ""}
            ${point.notes ? `Заметки: ${point.notes}` : ""}
        </div>
    `);
}

// Auto-load soil zones immediately
setTimeout(() => {
    try {
        loadSoilZonesVectorTiles();
    } catch (e) {
        console.log('Vector tiles failed, using GeoJSON fallback');
        loadSoilZonesGeoJSON();
    }
}, 1000);

// Soil Zones Vector Tiles Layer
let soilZonesLayer = null;

function loadSoilZonesVectorTiles() {
    if (soilZonesLayer) {
        map.removeLayer(soilZonesLayer);
    }
    
    soilZonesLayer = L.vectorGrid.protobuf(
        `${API_URL}/tiles/{z}/{x}/{y}`,
        {
            vectorTileLayerStyles: {
                soil_zones: function(properties, zoom) {
                    return {
                        fillColor: properties.color || '#10b981',
                        fillOpacity: 0.4,
                        weight: 1,
                        color: '#333',
                        opacity: 0.6
                    };
                }
            },
            interactive: true,
            getFeatureId: function(f) {
                return f.properties.id;
            }
        }
    ).addTo(map);
    
    // Add popup on click
    soilZonesLayer.on('click', function(e) {
        const props = e.layer.properties;
        const popupContent = `
            <div class="popup-content">
                <h3>${props.soil_type || props.zone_type || 'Почвенная зона'}</h3>
                ${props.description ? `<p>${props.description}</p>` : ''}
                ${props.soil_name ? `<p><small>Тип: ${props.soil_name}</small></p>` : ''}
            </div>
        `;
        L.popup()
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(map);
    });
    
    console.log('Soil zones vector tiles loaded');
}

// Fallback: Load soil zones as GeoJSON if vector tiles fail
async function loadSoilZonesGeoJSON() {
    try {
        const response = await fetch(`${API_URL}/soil-zones`);
        const zones = await response.json();
        
        if (soilZonesLayer) {
            map.removeLayer(soilZonesLayer);
        }
        
        soilZonesLayer = L.geoJSON(zones, {
            style: function(feature) {
                return {
                    color: feature.properties.color || '#10b981',
                    fillColor: feature.properties.color || '#10b981',
                    fillOpacity: 0.3,
                    weight: 2
                };
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`
                    <div class="popup-content">
                        <h3>${feature.properties.soil_type || feature.properties.zone_type || 'Почвенная зона'}</h3>
                        ${feature.properties.description ? `<p>${feature.properties.description}</p>` : ''}
                    </div>
                `);
            }
        }).addTo(map);
        
        console.log('Soil zones GeoJSON loaded:', zones.length);
    } catch (error) {
        console.error('Failed to load soil zones:', error);
    }
}

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
document.getElementById('refreshPoints').addEventListener('click', () => {
    loadUserPoints();
});

// Add point form handling
document.getElementById('addPointBtn').addEventListener('click', () => {
    document.getElementById('point-form').classList.remove('hidden');
});

document.getElementById('cancelPoint').addEventListener('click', () => {
    document.getElementById('point-form').classList.add('hidden');
});

document.getElementById('savePoint').addEventListener('click', async () => {
    const title = document.getElementById('pointTitle').value;
    const description = document.getElementById('pointDescription').value;
    const photoInput = document.getElementById('pointPhoto');
    
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
    
    if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }
    
    try {
        const response = await fetch(`${API_URL}/points`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('Точка сохранена');
            document.getElementById('point-form').classList.add('hidden');
            document.getElementById('pointTitle').value = '';
            document.getElementById('pointDescription').value = '';
            document.getElementById('pointPhoto').value = '';
            loadUserPoints();
        } else {
            alert('Ошибка сохранения точки');
        }
    } catch (error) {
        console.error('Failed to save point:', error);
        alert('Ошибка сохранения точки');
    }
});

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

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`)
        }

        let d = await res.json()

        if (d.error) {
            lirenSay("Произошла ошибка при анализе 😢")
            document.getElementById("out").innerHTML = `
<div class="card">
    <h2>❌ Ошибка</h2>
    <p>${d.error}</p>
</div>
`
            return
        }

        // Извлекаем визуальные признаки из AI ответа
        let features = []
        if(d.surface_diagnosis) features.push(d.surface_diagnosis)
        if(d.description) features.push(d.description)
        
        // Связываем AI предсказание с soil_defaults
        let aiType = d.ai || "chernozem"
        let soilData = soilDefaults[aiType] || soilDefaults["chernozem"]
        
        // Определяем загрязнение по визуальным признакам
        let pollution = "clean"
        if(d.surface_diagnosis && d.surface_diagnosis.includes("white crust")) {
            pollution = "salt"
        } else if(d.surface_diagnosis && d.surface_diagnosis.includes("oil")) {
            pollution = "oil"
        } else if(d.pollution && d.pollution !== "clean") {
            pollution = d.pollution
        }
        
        // Создаём userPoint с данными из soil_defaults
        userPoint = {
            lat: parseFloat(document.getElementById("lat").value),
            lon: parseFloat(document.getElementById("lon").value),
            soil_type: aiType,
            ph: soilData.ph,
            humus: soilData.humus,
            moisture: soilData.moisture,
            pollution: pollution,
            health: calculateHealth(soilData.moisture, soilData.ph, soilData.humus, pollution) / 100
        }
        
        // Сохраняем в localStorage
        localStorage.setItem("my_soil", JSON.stringify(userPoint))
        
        // Сообщение Лирен с анализом
        lirenSay(`По данным я определила: ${soilData.name} 🌱`)
        
        // Применяем диагностическую систему
        let diagnostic = analyzeSoil(features)
        
        // Обновляем health на основе диагностики
        let health = diagnostic.health || d.health
        let moisture = diagnostic.moisture || 30
        
        let matchClass = d.match ? "highlight" : "warning"
        let pollutionClass = d.pollution === "clean" ? "highlight" : "danger"
        
        let diagnosticHTML = ""
        if(diagnostic.type && !diagnostic.error){
            diagnosticHTML = `
                <div style="margin-top: 20px; padding: 15px; background: rgba(74, 222, 128, 0.1); border-radius: 8px; border: 1px solid rgba(74, 222, 128, 0.3);">
                    <h3 style="margin: 0 0 10px 0; color: #4ade80;">🔬 Диагностика по признакам</h3>
                    <p><span class="highlight">Горизонт:</span> ${diagnostic.type}</p>
                    <p><span class="highlight">pH:</span> ${diagnostic.ph}</p>
                    <p><span class="highlight">Загрязнение:</span> ${diagnostic.pollution}</p>
                    <p><span class="highlight">Рекомендация:</span> ${diagnostic.recommendation}</p>
                </div>
            `
        }

        // Переводим названия почв на русский
        let aiName = translateSoilName(d.ai)
        let mapName = translateSoilName(d.map)

        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>🌱 LIREN Analysis</h2>
    <p><span class="highlight">Тип анализа:</span> ${analysisType === "photo" ? "📷 По фото" : analysisType === "visual" ? "👁️ Визуальный" : "🧪 Химический"}</p>
    <p><span class="highlight">AI предсказание:</span> ${aiName}</p>
    <p><span class="highlight">Карта:</span> ${mapName}</p>
    <p><span class="${matchClass}">Совпадение:</span> ${d.match ? "✅ Да" : "❌ Нет"}</p>
    <p><span class="highlight">Уверенность:</span> ${(d.confidence * 100).toFixed(1)}%</p>
    <p><span class="highlight">pH почвы:</span> ${diagnostic.ph || soilData.ph || "Не определено"}</p>
    <p><span class="highlight">Здоровье:</span> ${(health * 100).toFixed(1)}%</p>
    <p><span class="highlight">Влажность:</span> ${moisture}%</p>
    <p><span class="${pollutionClass}">Загрязнение:</span> ${d.pollution === "clean" ? "✅ Чисто" : "⚠️ " + d.pollution}</p>
    <p><span class="highlight">Поверхность:</span> ${d.surface_diagnosis}</p>
    <p><span class="highlight">Описание:</span> ${d.description}</p>
    ${diagnosticHTML}
</div>
`

        updateMap(d.lat || 55.7558, d.lon || 37.6173)
        
        // Обновляем userPoint
        userPoint = {
            lat: d.lat || 55.7558,
            lon: d.lon || 37.6173,
            health: health,
            moisture: moisture
        }
        
        updateSoilState()
        
        if(diagnostic.health < 0.4){
            lirenSay("Почва сильно повреждена 😢 " + (diagnostic.recommendation || ""))
        } else if(diagnostic.health < 0.7){
            lirenSay("Почва ослаблена ⚠️ " + (diagnostic.recommendation || ""))
        } else {
            lirenSay("Почва здорова 🌿")
        }
        
        if(diagnostic.pollution && !diagnostic.pollution.includes("отсутствует")){
            lirenSay("Обнаружено загрязнение: " + diagnostic.pollution)
        }
        
        // Сохраняем точку пользователя
        savePoint(d)
    } catch (error) {
        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>❌ Ошибка</h2>
    <p>${error.message}</p>
    <p>Проверьте консоль браузера для деталей</p>
</div>
`
        console.error("Error:", error)
    }
}

function savePoint(d){
    let userId = localStorage.getItem("userId") || "default"
    
    let data = {
        lat: d.lat || 55.7558,
        lon: d.lon || 37.6173,
        soil_type: d.ai,
        health: d.health,
        pollution: d.pollution,
        user_id: userId
    }
    
    fetch("/api/save_point", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(data)
    }).then(r=>r.json()).then(res=>{
        console.log("Point saved:", res)
    }).catch(e=>{
        console.error("Error saving point:", e)
    })
}

async function load3D(){
    try {
        let res = await fetch("/api/3d")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let d = await res.json()

        let trace = {
            x: d.x,
            y: d.y,
            z: d.z,
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                size: 8,
                color: d.z,
                colorscale: 'Viridis'
            }
        }

        let layout = {
            title: '3D Модель здоровья почвы',
            scene: {
                xaxis: { title: 'Долгота' },
                yaxis: { title: 'Широта' },
                zaxis: { title: 'Индекс здоровья' }
            }
        }

        Plotly.newPlot('plot3d', [trace], layout)
    } catch (error) {
        console.error("Error loading 3D:", error)
        alert("Ошибка загрузки 3D карты: " + error.message)
    }
}

async function loadDegradation(){
    if(userPoint){
        lirenSay("Показываю деградацию для вашего участка 🗺️")
        // Показываем деградацию вокруг тестового местоположения
        let points = []
        for(let i = 0; i < 10; i++){
            points.push({
                lat: userPoint.lat + (Math.random() - 0.5) * 0.1,
                lon: userPoint.lon + (Math.random() - 0.5) * 0.1,
                deg: Math.random() * 0.5 + (1 - userPoint.health) * 0.5
            })
        }
        drawZones(points)
        return
    }
    
    try {
        let res = await fetch("/api/degradation")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let d = await res.json()

        let x = d.map(p=>p.lat)
        let y = d.map(p=>p.lon)
        let z = d.map(p=>p.deg)

        let trace = {
            x: x,
            y: y,
            z: z,
            mode: 'markers',
            type: 'scatter3d',
            marker: {
                size: 8,
                color: z,
                colorscale: 'Reds'
            }
        }

        let layout = {
            title: '3D Карта деградации почв',
            scene: {
                xaxis: { title: 'Долгота' },
                yaxis: { title: 'Широта' },
                zaxis: { title: 'Деградация' }
            }
        }

        Plotly.newPlot('plot3d', [trace], layout)
        
        // Добавляем круги на карту
        d.forEach(p=>{
            L.circle([p.lat, p.lon], {
                radius: 5000,
                color: `rgb(${p.deg*255},0,0)`,
                fillColor: `rgba(${p.deg*255},0,0,0.3)`,
                fillOpacity: 0.5
            }).addTo(map)
        })
    } catch (error) {
        console.error("Error loading degradation:", error)
        alert("Ошибка загрузки деградации: " + error.message)
    }
}

async function loadRecovery(soil, health){
    try {
        let res = await fetch(`/api/recovery?soil=${soil}&health=${health}`)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let d = await res.json()

        let trace = {
            y: d.forecast,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Прогноз восстановления'
        }

        let layout = {
            title: 'Прогноз восстановления почвы',
            xaxis: { title: 'Период' },
            yaxis: { title: 'Индекс здоровья' }
        }

        Plotly.newPlot('plot3d', [trace], layout)
    } catch (error) {
        console.error("Error loading recovery:", error)
        alert("Ошибка загрузки восстановления: " + error.message)
    }
}

async function loadUserPoints(){
    try {
        let res = await fetch("/api/points")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let points = await res.json()
        buildUserSoil3D(points)
    } catch (error) {
        console.error("Error loading user points:", error)
        alert("Ошибка загрузки точек: " + error.message)
    }
}

function buildUserSoil3D(points){
    if (!points || points.length === 0) {
        alert("Нет сохранённых точек")
        return
    }
    
    let x = points.map(p=>p.lat)
    let y = points.map(p=>p.lon)
    let z = points.map(p=>p.health)
    
    let trace = {
        x: x,
        y: y,
        z: z,
        mode: 'markers',
        type: 'scatter3d',
        marker: {
            size: 8,
            color: z,
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: 'Здоровье'
            }
        },
        text: points.map(p=>`Тип: ${p.soil_type}<br>Здоровье: ${(p.health*100).toFixed(1)}%`),
        hoverinfo: 'text+x+y+z'
    }
    
    let layout = {
        title: '3D Модель участка пользователя',
        scene: {
            xaxis: { title: 'Широта' },
            yaxis: { title: 'Долгота' },
            zaxis: { title: 'Здоровье' }
        }
    }
    
    Plotly.newPlot('plot3d', [trace], layout)
}

function drawZones(points){
    // Очищаем предыдущие круги
    map.eachLayer(layer => {
        if (layer instanceof L.Circle) {
            map.removeLayer(layer)
        }
    })
    
    points.forEach(p=>{
        let color = "green"
        let fillColor = "rgba(0, 255, 0, 0.3)"
        let radius = 5000
        
        // Частные зоны отображаем по-другому
        if(p.is_private){
            color = "blue"
            fillColor = "rgba(0, 0, 255, 0.3)"
            radius = 3000 // Частные зоны меньше
        } else if(p.pollution !== "clean" && p.pollution !== null){
            color = "red"
            fillColor = "rgba(255, 0, 0, 0.3)"
        } else if(p.health < 60){
            color = "yellow"
            fillColor = "rgba(255, 255, 0, 0.3)"
        }
        
        L.circle([p.lat, p.lon], {
            radius: radius,
            color: color,
            fillColor: fillColor,
            fillOpacity: 0.5
        }).addTo(map)
    })
    
    lirenSay(`Показано ${points.length} зон загрязнения (синие - ваши, остальные - общие) 🗺️`)
}

async function showUserZones(){
    lirenSay("Показываю зоны загрязнения (общие + частные) ⭕")
    
    // Показываем зоны из API (общие + частные)
    try {
        let res = await fetch("/api/history/points")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let points = await res.json()
        
        // Если есть userPoint, добавляем его как частную зону
        if(userPoint){
            points.push({
                lat: userPoint.lat,
                lon: userPoint.lon,
                ph: userPoint.ph,
                moisture: userPoint.moisture,
                health: userPoint.health * 100,
                is_private: true
            })
        }
        
        drawZones(points)
    } catch (error) {
        console.error("Error loading zones:", error)
        lirenSay("Ошибка загрузки зон 😢")
        alert("Ошибка загрузки зон: " + error.message)
    }
}

async function loadDEM(lat, lon){
    try {
        // Сначала пробуем через backend API
        let res = await fetch(`/api/dem/elevation?lat=${lat}&lon=${lon}`)
        if(res.ok){
            let d = await res.json()
            return d.elevation
        }
    } catch (error) {
        console.error("Backend DEM error:", error)
    }
    
    // Fallback на прямой API
    try {
        let res = await fetch(
            `https://api.opentopodata.org/v1/srtm90m?locations=${lat},${lon}`
        )
        let d = await res.json()
        return d.results[0].elevation
    } catch (error) {
        console.error("Error loading DEM:", error)
        return 100 // fallback elevation
    }
}

// Создать точку с историей
async function createPoint(pointData){
    try {
        let res = await fetch("/api/history/point", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(pointData)
        })
        let d = await res.json()
        lirenSay("Точка создана и сохранена! 📍")
        return d
    } catch (error) {
        console.error("Error creating point:", error)
        lirenSay("Ошибка создания точки 😢")
    }
}

// Симуляция восстановления
async function simulateRecovery(){
    try {
        let res = await fetch("/api/history/simulate", {
            method: "POST"
        })
        let d = await res.json()
        lirenSay("Симуляция восстановления завершена! 🔄")
        return d
    } catch (error) {
        console.error("Error simulating:", error)
        lirenSay("Ошибка симуляции 😢")
    }
}

// Получить погоду
async function getWeather(lat, lon){
    try {
        let res = await fetch(`/api/weather/weather?lat=${lat}&lon=${lon}`)
        if(res.ok){
            let d = await res.json()
            lirenSay(`Погода: ${d.temp}°C, влажность: ${d.humidity}% 🌤️`)
            return d
        }
    } catch (error) {
        console.error("Error loading weather:", error)
    }
    return null
}

// Показать погоду для текущего местоположения
async function showWeather(){
    let lat, lon
    
    if(userPoint){
        lat = userPoint.lat
        lon = userPoint.lon
    } else {
        lat = parseFloat(document.getElementById("lat").value)
        lon = parseFloat(document.getElementById("lon").value)
    }
    
    lirenSay("Загружаю погоду... 🌤️")
    let weather = await getWeather(lat, lon)
    
    if(weather){
        document.getElementById("out").innerHTML = `
        <div class="card">
            <h2>🌤️ Погода</h2>
            <p>Температура: ${weather.temp}°C</p>
            <p>Влажность: ${weather.humidity}%</p>
        </div>
        `
    } else {
        document.getElementById("out").innerHTML = `
        <div class="card">
            <h2>❌ Ошибка</h2>
            <p>Не удалось загрузить погоду</p>
            <p>Убедитесь, что API ключ настроен</p>
        </div>
        `
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

    Plotly.newPlot('soil3d', data, layout)
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

    Plotly.newPlot('plot3d', [trace1, trace2, trace3], layout)
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

  const res = await fetch("/api/block1", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
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

function addPointToMap(point) {
  const marker = L.marker([point.lat, point.lng]).addTo(map)
  marker.bindPopup(`
    <b>Точка</b>
    pH: ${point.ph || "-"}
    Влажность: ${point.moisture || "-"}
    Заметки: ${point.notes || ""}
  `)
}
