// Fixed JavaScript syntax version
// This file contains corrected syntax for the main functions

let map = null;
let markers = [];
let currentStep = 1;
let stepData = {
    images: [],
    ph: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null,
    lat: null,
    lng: null,
    notes: null
};
let baseLayers = {};
let overlayLayers = {};

function initMap() {
    if (map) return;
    map = L.map('leaflet-map').setView([55.75, 37.61], 10);
    
    // Базовый слой - OpenStreetMap
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });
    
    // Быстрый спутниковый слой - MODIS (оптимизированный)
    const satelliteLayer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
        'MODIS_Terra_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        {
            attribution: 'NASA GIBS | MODIS Terra',
            maxZoom: 12,  // Ограничиваем для скорости
            minZoom: 1,
            opacity: 1,
            time: new Date().toISOString().split('T')[0],
            // Оптимизация загрузки
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }
    );
    
    // Быстрый слой Landsat 8 (оптимизированный)
    const landsatLayer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
        'Landsat_8_Surface_Reflectance/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        {
            attribution: 'NASA GIBS | Landsat 8',
            maxZoom: 12,  // Ограничиваем для скорости
            minZoom: 1,
            opacity: 1,
            time: new Date().toISOString().split('T')[0],
            // Оптимизация загрузки
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 2
        }
    );
    
    // Запасной вариант - Esri World Imagery (всегда работает)
    const esriLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 19,
            minZoom: 1,
            opacity: 1
        }
    );
    
    // Слои для переключателя
    baseLayers = {
        "🗺️ Карта (OSM)": osmLayer,
        "🛰️ Спутник (MODIS)": satelliteLayer,
        "🛰️ Спутник (Landsat)": landsatLayer,
        "🛰️ Спутник (Esri)": esriLayer
    };
    
    // Добавляем информацию о слоях
    console.log('[MAP] Satellite layers info:');
    console.log('  MODIS Terra: Ежедневное, оптимизирован до zoom 12, 250м/пиксель');
    console.log('  Landsat 8: 8-16 дней, оптимизирован до zoom 12, 30м/пиксель');
    console.log('  Esri World: Статичные, всегда быстрый, высокое качество');
    
    // Добавляем OSM по умолчанию
    osmLayer.addTo(map);
    
    // Добавляем переключатель слоев
    const layerControl = L.control.layers(baseLayers, overlayLayers, {
        position: 'topleft',
        collapsed: true
    }).addTo(map);
    
    console.log('[MAP] Initialized with OSM and NASA layers');
}

// Load points function with fixed syntax
async function loadPoints() {
    try {
        console.log('Loading all points for general map...');
        const res = await fetch("/api/points");
        const points = await res.json();
        console.log(`Loaded ${points.length} points from backend`);
        
        // Сохраняем точки для использования в popup
        window.lastLoadedPoints = points;
        
        // Очищаем существующие маркеры
        if (markers) {
            markers.forEach(marker => {
                if (marker && map) {
                    map.removeLayer(marker);
                }
            });
        }
        markers = [];
        
        // Добавляем точки на карту
        points.forEach(p => {
            addPointToMap(p);
        });
        
        console.log(`Added ${points.length} points to map`);
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

// Add point to map function with fixed syntax
function addPointToMap(p) {
    const report = p.report;
    const images = p.images || [];
    const firstImage = images.length > 0 ? images[0] : p.image;
    const soilType = report?.general?.soil_type || p.soil_type || "Не определен";
    const pointId = p.id || 'unknown';

    const marker = L.marker([p.lat, p.lng]).addTo(map);
    
    const popupContent = `
        <div style="max-width:280px; font-family: Arial, sans-serif;">
            ${firstImage ? `
                <div style="position: relative; margin-bottom: 10px;">
                    <img src="${firstImage}" style="width:100%; height:120px; object-fit: cover; border-radius:8px;">
                    ${images.length > 1 ? `<div style="position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">📷 ${images.length}</div>` : ""}
                </div>
            ` : `
                <div style="width:100%; height:80px; background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%); border-radius:8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                    <span style="font-size: 40px;">🌱</span>
                </div>
            `}

            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">🌱</span>
                <b style="font-size: 14px;">АНАЛИЗ ПОЧВЫ</b>
            </div>

            <div style="padding: 10px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; margin-bottom: 10px; border-left: 3px solid #22c55e;">
                <div style="font-size: 12px; color: #666; margin-bottom: 2px;">🌱 Тип почвы</div>
                <div style="font-size: 14px; font-weight: 600; color: #2E7D32;">${soilType}</div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <button onclick="showPointDetailsById('${pointId}')" style="background: #4CAF50; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; width: 100%; font-size: 13px;">Подробнее</button>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    markers.push(marker);
}

// Section navigation with fixed syntax
function showSection(section) {
    // Hide all sections
    document.getElementById("analysis").style.display = "none";
    document.getElementById("map").style.display = "none";
    document.getElementById("cabinet").style.display = "none";
    document.getElementById("points-list").style.display = "none";
    document.getElementById("points-filter").style.display = "none";
    
    // Show selected section
    const targetSection = document.getElementById(section);
    if (targetSection) {
        targetSection.style.display = "block";
    } else {
        alert('Ошибка: секция ' + section + ' не найдена');
        return;
    }
    
    if (section === "cabinet") {
        loadUserCabinet();
    }
    
    if (section === "analysis") {
        // Reset to step 1 and show it
        currentStep = 1;
        updateStepUI();
    }
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Fixed syntax version initializing...');
    
    setTimeout(() => {
        initMap();
        loadPoints();
        
        // Override any broken functions
        window.initMap = initMap;
        window.loadPoints = loadPoints;
        window.addPointToMap = addPointToMap;
        window.showSection = showSection;
        
        console.log('Syntax fixes applied successfully');
    }, 1000);
});
