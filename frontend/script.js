let map = L.map('map').setView([55.75, 37.61], 10)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
const user_id = localStorage.getItem('user_id') || crypto.randomUUID()
localStorage.setItem('user_id', user_id)
async function loadPoints() {
    const res = await fetch('/api/points')
    const data = await res.json()
    data.forEach(addPointToMap)
}
function addPointToMap(p) {
    const popup = \
        <b>Zc:</b> \
        <img src=\
\\ width=\150\/>
    \
    L.marker([p.lat, p.lng]).addTo(map).bindPopup(popup)
}
async function addPoint() {
    const lat = document.getElementById('lat').value
    const lng = document.getElementById('lng').value
    const res = await fetch('/api/block1', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            lat,
            lng,
            user_id
        })
    })
    const data = await res.json()
    if (data.point) {
        addPointToMap(data.point)
        localStorage.setItem('hasCompletedAnalysis', 'true')
    } else {
        alert('Ошибка')
    }
}
loadPoints()
