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

    document.getElementById("out").innerHTML = `
<h3>Результат:</h3>
<p>AI: ${d.ai}</p>
<p>Карта: ${d.map}</p>
<p>Совпадение: ${d.match}</p>
<p>Здоровье: ${d.health}</p>
<p>Загрязнение: ${d.pollution}</p>
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
