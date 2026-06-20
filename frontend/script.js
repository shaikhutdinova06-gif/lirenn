const API_BASE = window.location.port === "8000" ? window.location.origin : "http://localhost:8000"

async function send(){

    let f = file.files[0]

    let form = new FormData()
    form.append("file", f)
    form.append("lat", lat.value)
    form.append("lon", lon.value)

    let res = await fetch(`${API_BASE}/analyze`, {
        method:"POST",
        body:form
    })

    let d = await res.json()

    out.innerText = JSON.stringify(d,null,2)
}

let map = L.map('map').setView([55,37],5)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

map.on('click', e=>{
    lat.value = e.latlng.lat
    lon.value = e.latlng.lng
})

async function load(){

    let res = await fetch(`${API_BASE}/map`)
    let data = await res.json()

    data.forEach(p=>{
        let c = p.result=="загрязнение"?"red":"green"
        L.circleMarker([p.lat,p.lon],{color:c}).addTo(map)
    })
}

load()
