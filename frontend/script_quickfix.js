// Quick fix for broken interface
// This file provides essential functions to make interface work

// Initialize map with basic functionality
function quickInitMap() {
    try {
        if (window.map) return;
        
        window.map = L.map('leaflet-map').setView([55.75, 37.61], 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(window.map);
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Load points with error handling
async function quickLoadPoints() {
    try {
        const response = await fetch('/api/points');
        const points = await response.json();
        
        console.log(`Loaded ${points.length} points`);
        
        points.forEach(point => {
            quickAddPointToMap(point);
        });
        
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

// Add point to map with basic functionality
function quickAddPointToMap(point) {
    try {
        const lat = point.lat;
        const lng = point.lng;
        const soilType = point.soil_type || point.ai_analysis?.soil_type || 'Не определен';
        
        const marker = L.marker([lat, lng]).addTo(window.map);
        
        const popupContent = `
            <div style="max-width:280px; font-family: Arial, sans-serif;">
                <h4 style="margin: 0 0 10px 0; color: #2E7D32;">🌱 ${soilType}</h4>
                <p style="margin: 5px 0;"><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                <p style="margin: 5px 0;"><strong>pH:</strong> ${point.ph || 'Не указано'}</p>
                <p style="margin: 5px 0;"><strong>Влажность:</strong> ${point.moisture || 'Не указано'}%</p>
                ${point.user_id ? `<p style="margin: 5px 0;"><strong>Пользователь:</strong> ${point.user_id}</p>` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        if (!window.markers) window.markers = [];
        window.markers.push(marker);
        
    } catch (error) {
        console.error('Error adding point to map:', error);
    }
}

// Section navigation with error handling
function quickShowSection(section) {
    try {
        // Hide all sections
        const sections = ['map', 'analysis', 'cabinet', 'points-list', 'points-filter'];
        sections.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = 'none';
        });
        
        // Show selected section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
        
        console.log('Showing section:', section);
    } catch (error) {
        console.error('Error showing section:', error);
    }
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Quick fix initializing...');
    
    setTimeout(() => {
        quickInitMap();
        quickLoadPoints();
        
        // Override broken functions if they exist
        window.showSection = quickShowSection;
        window.loadPoints = quickLoadPoints;
        
        console.log('Quick fix applied successfully');
    }, 1000);
});
