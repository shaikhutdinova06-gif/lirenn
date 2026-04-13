let map = L.map('map').setView([55.7558, 37.6173], 5)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

let userPoint = null

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

    let f = document.getElementById("file").files[0]

    if (!f) {
        lirenSay("Пожалуйста, выберите файл для анализа 📷")
        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>❌ Ошибка</h2>
    <p>Пожалуйста, выберите файл</p>
</div>
`
        return
    }

    lirenSay("Анализирую фото почвы... Это займёт немного времени 🔬")

    let form = new FormData()
    form.append("file", f)
    form.append("lat", document.getElementById("lat").value)
    form.append("lon", document.getElementById("lon").value)

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

        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>🌱 LIREN Analysis</h2>
    <p><span class="highlight">AI предсказание:</span> ${d.ai}</p>
    <p><span class="highlight">Карта:</span> ${d.map}</p>
    <p><span class="${matchClass}">Совпадение:</span> ${d.match ? "✅ Да" : "❌ Нет"}</p>
    <p><span class="highlight">Уверенность:</span> ${(d.confidence * 100).toFixed(1)}%</p>
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
        
        if(p.pollution !== "clean" && p.pollution !== null){
            color = "red"
            fillColor = "rgba(255, 0, 0, 0.3)"
        } else if(p.health < 0.6){
            color = "yellow"
            fillColor = "rgba(255, 255, 0, 0.3)"
        }
        
        L.circle([p.lat, p.lon], {
            radius: 5000,
            color: color,
            fillColor: fillColor,
            fillOpacity: 0.5
        }).addTo(map)
    })
}

async function showUserZones(){
    if(userPoint){
        lirenSay("Показываю зоны загрязнения для вашего участка ⭕")
        // Показываем зоны вокруг тестового местоположения
        let points = []
        for(let i = 0; i < 8; i++){
            points.push({
                lat: userPoint.lat + (Math.random() - 0.5) * 0.08,
                lon: userPoint.lon + (Math.random() - 0.5) * 0.08,
                deg: Math.random() * (1 - userPoint.health) * 0.8
            })
        }
        drawZones(points)
        return
    }
    
    try {
        let res = await fetch("/api/points")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let points = await res.json()
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

async function buildUserArea(point){
    try {
        let elevation = await loadDEM(point.lat, point.lon)
        
        document.getElementById("out").innerHTML = `
        <div class="card">
            <h2>🌱 Ваш участок</h2>
            <p>Высота: ${elevation} м</p>
            <p>Состояние: ${Math.round(point.health*100)}%</p>
            <p>Влажность: ${point.moisture}%</p>
        </div>
        `
        
        lirenSay(`Высота вашего участка: ${elevation} метров. Состояние почвы: ${Math.round(point.health*100)}% 🌿`)
        updateSoilState()
    } catch (error) {
        console.error("Error building user area:", error)
        lirenSay("Не удалось загрузить данные о участке 😢")
    }
}

async function buildTerrain(point){
    try {
        let size = 30
        let z = []
        
        let base = await loadDEM(point.lat, point.lon)
        
        for(let i = 0; i < size; i++){
            z[i] = []
            for(let j = 0; j < size; j++){
                let noise = Math.random() * 2
                let h = base + noise + (point.moisture || 30) * 0.2
                z[i][j] = h
            }
        }
        
        let trace = {
            z: z,
            type: 'surface',
            colorscale: 'Earth',
            colorbar: {title: 'Высота (м)'}
        }
        
        let layout = {
            title: '3D Рельеф участка',
            scene: {
                xaxis: {title: 'X'},
                yaxis: {title: 'Y'},
                zaxis: {title: 'Высота'}
            }
        }
        
        Plotly.newPlot('plot3d', [trace], layout)
        lirenSay(`Рельеф участка построен! Высота: ${base} метров 🏔️`)
    } catch (error) {
        console.error("Error building terrain:", error)
        lirenSay("Ошибка построения рельефа 😢")
        alert("Ошибка построения рельефа: " + error.message)
    }
}

async function loadTerrain(){
    let lat = parseFloat(document.getElementById("lat").value)
    let lon = parseFloat(document.getElementById("lon").value)
    await buildTerrain({lat, lon, moisture: 30})
}

async function loadUserPoints(){
    try {
        let res = await fetch("/api/points")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let points = await res.json()
        buildUserSoil3D(points)
    } catch (error) {
        console.error("Error loading user points:", error)
        lirenSay("Ошибка загрузки точек 😢")
        alert("Ошибка загрузки точек: " + error.message)
    }
}

function buildUserSoil3D(points){
    if (!points || points.length === 0) {
        lirenSay("Нет сохранённых точек 😢")
        alert("Нет сохранённых точек")
        return
    }
    
    let x = points.map(p=>p.lat)
    let y = points.map(p=>p.lon)
    let z = points.map(p=>p.health * 100)
    
    let trace = {
        x: x,
        y: y,
        z: z,
        mode: 'markers',
        type: 'scatter3d',
        marker: {
            size: 8,
            color: z,
            colorscale: 'RdYlGn'
        }
    }
    
    let layout = {
        title: '3D Мой участок',
        scene: {
            xaxis: {title: 'Широта'},
            yaxis: {title: 'Долгота'},
            zaxis: {title: 'Здоровье (%)'}
        }
    }
    
    Plotly.newPlot('plot3d', [trace], layout)
    lirenSay(`Ваш участок построен! ${points.length} точек 🏔️`)
}

function updateSoilState(){
    if(!userPoint) return
    
    let color = "#22c55e"
    let status = "Хорошее"
    
    if(userPoint.health < 0.5){
        color = "#ef4444"
        status = "Плохое"
    } else if(userPoint.health < 0.8){
        color = "#fbbf24"
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
    
    let interval = setInterval(() => {
        userPoint.health += 0.02
        
        if(userPoint.health >= 1){
            userPoint.health = 1
            clearInterval(interval)
            lirenSay("Почва полностью восстановлена! Ты молодец! 🎉")
        } else {
            let percent = Math.round(userPoint.health * 100)
            if(percent % 20 === 0){
                if(percent < 50) lirenSay("Почва всё ещё устала, продолжаем... 😢")
                else if(percent < 80) lirenSay("Почва восстанавливается, это хорошо! 💧")
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
    
    userPoint = {
        lat: 55.7558,
        lon: 37.6173,
        health: 0.5,
        moisture: 35
    }
    
    document.getElementById("lat").value = userPoint.lat
    document.getElementById("lon").value = userPoint.lon
    
    map.setView([userPoint.lat, userPoint.lon], 13)
    
    if(marker){
        map.removeLayer(marker)
    }
    marker = L.marker([userPoint.lat, userPoint.lon]).addTo(map)
    
    buildUserArea(userPoint)
    lirenSay("Тестовое местоположение установлено! Здоровье: 50%, Влажность: 35% 🎉")
}
