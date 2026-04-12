let map = L.map('map').setView([55.7558, 37.6173], 5)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

let userPoint = null

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

        let matchClass = d.match ? "highlight" : "warning"
        let pollutionClass = d.pollution === "clean" ? "highlight" : "danger"

        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>🌱 LIREN Analysis</h2>
    <p><span class="highlight">AI предсказание:</span> ${d.ai}</p>
    <p><span class="highlight">Карта:</span> ${d.map}</p>
    <p><span class="${matchClass}">Совпадение:</span> ${d.match ? "✅ Да" : "❌ Нет"}</p>
    <p><span class="highlight">Уверенность:</span> ${(d.confidence * 100).toFixed(1)}%</p>
    <p><span class="highlight">Здоровье:</span> ${(d.health * 100).toFixed(1)}%</p>
    <p><span class="${pollutionClass}">Загрязнение:</span> ${d.pollution === "clean" ? "✅ Чисто" : "⚠️ " + d.pollution}</p>
    <p><span class="highlight">Поверхность:</span> ${d.surface_diagnosis}</p>
    <p><span class="highlight">Описание:</span> ${d.description}</p>
</div>
`

        updateMap(d.lat || 55.7558, d.lon || 37.6173)
        
        if(d.pollution === "clean" && d.health > 0.7){
            lirenSay("Анализ завершён! Почва в хорошем состоянии 🌿")
        } else if(d.pollution !== "clean"){
            lirenSay("Обнаружено загрязнение! Рекомендую восстановление ⚠️")
        } else {
            lirenSay("Анализ завершён! Рекомендую улучшить состояние почвы 💧")
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
    try {
        let res = await fetch("/api/points")
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        
        let points = await res.json()
        drawZones(points)
    } catch (error) {
        console.error("Error loading zones:", error)
        alert("Ошибка загрузки зон: " + error.message)
    }
}

async function loadDEM(lat, lon){
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
