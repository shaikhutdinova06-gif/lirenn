// LIRENN MAP v2 - Interactive Map with Soil Zoning & User Points
// This replaces the current LIRENN map

// API URL - change this to your deployed backend
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://liren-map-backend.onrender.com';

// Initialize map
const map = L.map("map").setView([40.0, 12.0], 6);

// Base map
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Soil zones layer (vector tiles)
let soilZonesLayer = null;
let soilZonesVisible = true;

// User points markers
let pointsMarkers = [];
let selectedLocation = null;

// Load soil zones
async function loadSoilZones() {
    try {
        const response = await fetch(`${API_URL}/soil-zones`);
        const data = await response.json();
        
        if (soilZonesLayer) {
            map.removeLayer(soilZonesLayer);
        }
        
        soilZonesLayer = L.geoJSON(data, {
            style: function(feature) {
                return {
                    fillColor: feature.properties.color || '#10b981',
                    fillOpacity: 0.4,
                    weight: 2,
                    color: '#333',
                    dashArray: '5, 5'
                };
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`
                    <div class="popup-content">
                        <h3>${feature.properties.zone_type}</h3>
                        <p>${feature.properties.description || 'Нет описания'}</p>
                    </div>
                `);
            }
        }).addTo(map);
        
        console.log('Soil zones loaded');
    } catch (error) {
        console.error('Error loading soil zones:', error);
    }
}

// Load user points
async function loadPoints() {
    try {
        const response = await fetch(`${API_URL}/points`);
        const points = await response.json();
        
        // Clear existing markers
        pointsMarkers.forEach(marker => map.removeLayer(marker));
        pointsMarkers = [];
        
        // Add markers for each point
        points.forEach(point => {
            const marker = L.marker([point.lat, point.lng]).addTo(map);
            
            const popupContent = `
                <div class="popup-content">
                    <h3>${point.title}</h3>
                    <p>${point.description || 'Нет описания'}</p>
                    ${point.photo_url ? `<img src="${API_URL}${point.photo_url}" alt="Photo" style="max-width: 200px; border-radius: 8px;"/>` : ''}
                    <small>Создано: ${new Date(point.created_at).toLocaleString('ru')}</small>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            pointsMarkers.push(marker);
        });
        
        console.log(`Loaded ${points.length} points`);
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

// Add point on map click
map.on('click', function(e) {
    selectedLocation = e.latlng;
    showPointForm();
});

// Show point form
function showPointForm() {
    document.getElementById('point-form').classList.remove('hidden');
    document.getElementById('pointTitle').focus();
}

// Hide point form
function hidePointForm() {
    document.getElementById('point-form').classList.add('hidden');
    document.getElementById('pointTitle').value = '';
    document.getElementById('pointDescription').value = '';
    document.getElementById('pointPhoto').value = '';
    selectedLocation = null;
}

// Save point
async function savePoint() {
    const title = document.getElementById('pointTitle').value.trim();
    const description = document.getElementById('pointDescription').value.trim();
    const photoFile = document.getElementById('pointPhoto').files[0];
    
    if (!title) {
        alert('Пожалуйста, введите название точки');
        return;
    }
    
    if (!selectedLocation) {
        alert('Пожалуйста, выберите местоположение на карте');
        return;
    }
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('lat', selectedLocation.lat);
    formData.append('lng', selectedLocation.lng);
    formData.append('user_id', 'anon');
    
    if (photoFile) {
        formData.append('photo', photoFile);
    }
    
    try {
        const response = await fetch(`${API_URL}/points`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('Точка успешно сохранена!');
            hidePointForm();
            loadPoints(); // Reload points
        } else {
            alert('Ошибка при сохранении точки');
        }
    } catch (error) {
        console.error('Error saving point:', error);
        alert('Ошибка при сохранении точки');
    }
}

// Toggle soil zones
function toggleSoilZones() {
    soilZonesVisible = !soilZonesVisible;
    
    if (soilZonesLayer) {
        if (soilZonesVisible) {
            map.addLayer(soilZonesLayer);
            document.getElementById('toggleSoilZones').classList.add('active');
        } else {
            map.removeLayer(soilZonesLayer);
            document.getElementById('toggleSoilZones').classList.remove('active');
        }
    }
}

// Event listeners
document.getElementById('addPointBtn').addEventListener('click', () => {
    alert('Кликните на карту, чтобы выбрать местоположение для новой точки');
});

document.getElementById('toggleSoilZones').addEventListener('click', toggleSoilZones);

document.getElementById('refreshPoints').addEventListener('click', loadPoints);

document.getElementById('savePoint').addEventListener('click', savePoint);

document.getElementById('cancelPoint').addEventListener('click', hidePointForm);

// Initialize
loadSoilZones();
loadPoints();

// Set initial button state
document.getElementById('toggleSoilZones').classList.add('active');
