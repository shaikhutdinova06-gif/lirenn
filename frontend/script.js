let map = L.map('map').setView([55.7558, 37.6173], 5)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

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
        document.getElementById("out").innerHTML = `
<div class="card">
    <h2>❌ Ошибка</h2>
    <p>Пожалуйста, выберите файл</p>
</div>
`
        return
    }

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
    } catch (error) {
        console.error("Error building terrain:", error)
        alert("Ошибка построения рельефа: " + error.message)
    }
}

function buildVoxelSoil(point){
    try {
        // Очищаем предыдущий canvas
        let container = document.getElementById("plot3d")
        container.innerHTML = ""
        
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
        const renderer = new THREE.WebGLRenderer()
        
        renderer.setSize(400, 400)
        container.appendChild(renderer.domElement)
        
        // Цвета горизонтов
        const horizonColors = {
            "AU": 0x2e1c0b,
            "AY": 0x5a4a3f,
            "E": 0xffffff,
            "BT": 0x7b4f2c,
            "BCA": 0x8b7355,
            "G": 0x6d7f8f,
            "C": 0x999999
        }
        
        // Создаём блоки
        for(let x = 0; x < 10; x++){
            for(let y = 0; y < 10; y++){
                for(let z = 0; z < 5; z++){
                    
                    let color = 0x8B4513
                    
                    if(z === 4) color = horizonColors["AU"] // гумус
                    if(z === 2) color = horizonColors["BT"] // средний слой
                    if(z === 0) color = horizonColors["C"] // порода
                    
                    // Влияние влажности
                    if(point.moisture > 40){
                        color = 0x2f4f4f // мокрая почва
                    }
                    
                    // Влияние загрязнения
                    if(point.pollution && point.pollution !== "clean"){
                        color = 0xff0000 // загрязнённая почва
                    }
                    
                    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9)
                    const material = new THREE.MeshBasicMaterial({color})
                    
                    const cube = new THREE.Mesh(geometry, material)
                    
                    cube.position.set(x - 5, y - 5, z)
                    scene.add(cube)
                }
            }
        }
        
        camera.position.z = 20
        camera.position.y = 5
        camera.lookAt(0, 0, 0)
        
        function animate(){
            requestAnimationFrame(animate)
            renderer.render(scene, camera)
        }
        
        animate()
    } catch (error) {
        console.error("Error building voxel soil:", error)
        alert("Ошибка построения voxel модели: " + error.message)
    }
}

async function buildScientificSoil(point){
    try {
        // Получаем горизонты с сервера
        let res = await fetch(`/api/horizons?soil_type=${point.soil_type}`)
        let d = await res.json()
        
        let layers = d.horizons || ["AU", "BT", "C"]
        
        // Очищаем предыдущий canvas
        let container = document.getElementById("plot3d")
        container.innerHTML = ""
        
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
        const renderer = new THREE.WebGLRenderer()
        
        renderer.setSize(400, 400)
        container.appendChild(renderer.domElement)
        
        // Цвета горизонтов
        const horizonColors = {
            "AU": 0x2e1c0b,
            "AY": 0x5a4a3f,
            "E": 0xffffff,
            "BT": 0x7b4f2c,
            "BCA": 0x8b7355,
            "G": 0x6d7f8f,
            "C": 0x999999
        }
        
        // Создаём слои по горизонтам
        layers.forEach((layer, i) => {
            for(let x = 0; x < 10; x++){
                for(let y = 0; y < 10; y++){
                    
                    let color = horizonColors[layer] || 0x8B4513
                    
                    // Влияние влажности
                    if(point.moisture > 40){
                        color = 0x2f4f4f
                    }
                    
                    // Влияние загрязнения
                    if(point.pollution && point.pollution !== "clean"){
                        color = 0xff0000
                    }
                    
                    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9)
                    const material = new THREE.MeshBasicMaterial({color})
                    
                    const cube = new THREE.Mesh(geometry, material)
                    
                    cube.position.set(x - 5, y - 5, i)
                    scene.add(cube)
                }
            }
        })
        
        camera.position.z = 20
        camera.position.y = 5
        camera.lookAt(0, 0, 0)
        
        function animate(){
            requestAnimationFrame(animate)
            renderer.render(scene, camera)
        }
        
        animate()
    } catch (error) {
        console.error("Error building scientific soil:", error)
        alert("Ошибка построения научной модели: " + error.message)
    }
}

async function loadTerrain(){
    let lat = parseFloat(document.getElementById("lat").value)
    let lon = parseFloat(document.getElementById("lon").value)
    await buildTerrain({lat, lon, moisture: 30})
}

async function loadVoxelSoil(){
    let point = {
        moisture: 30,
        pollution: "clean"
    }
    buildVoxelSoil(point)
}

async function loadScientificSoil(){
    let point = {
        soil_type: "chernozem",
        moisture: 30,
        pollution: "clean"
    }
    await buildScientificSoil(point)
}
