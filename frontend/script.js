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

    let form = new FormData()
    form.append("file", f)
    form.append("lat", document.getElementById("lat").value)
    form.append("lon", document.getElementById("lon").value)

    let res = await fetch("/api/analyze", {
        method:"POST",
        body: form
    })

    let d = await res.json()

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
}

async function load3D(){
    let res = await fetch("/api/3d")
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
}

async function loadDegradation(){
    let res = await fetch("/api/degradation")
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
}

async function loadRecovery(soil, health){
    let res = await fetch(`/api/recovery?soil=${soil}&health=${health}`)
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
}
