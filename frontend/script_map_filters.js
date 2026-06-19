// Map Filter Functions
async function loadMapFilters() {
    try {
        // Load soil types for map filter
        const response = await fetch('/api/soil-types');
        if (!response.ok) return;
        
        const data = await response.json();
        const soilSelect = document.getElementById('soil-type-filter');
        soilSelect.innerHTML = '<option value="">Все типы почвы</option>';
        
        if (data.soil_types) {
            data.soil_types.forEach(category => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category.category;
                category.types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    optgroup.appendChild(option);
                });
                soilSelect.appendChild(optgroup);
            });
        }
        
        // Load users for map filter
        const usersResponse = await fetch('/api/points');
        if (usersResponse.ok) {
            const points = await usersResponse.json();
            const userSelect = document.getElementById('user-filter');
            userSelect.innerHTML = '<option value="">Все пользователи</option>';
            
            // Get unique users
            const uniqueUsers = [...new Set(points.map(p => p.user_id).filter(Boolean))];
            uniqueUsers.forEach(userId => {
                const option = document.createElement('option');
                option.value = userId;
                option.textContent = userId;
                userSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading map filters:', error);
    }
}

function applyMapFilters() {
    const soilType = document.getElementById('soil-type-filter').value;
    const user = document.getElementById('user-filter').value;
    
    const allPoints = window.lastLoadedPoints || [];
    let filteredPoints = [...allPoints];
    
    // Filter by soil type
    if (soilType) {
        filteredPoints = filteredPoints.filter(point => {
            const pointSoilType = point.soil_type || point.ai_analysis?.soil_type || '';
            return pointSoilType === soilType;
        });
    }
    
    // Filter by user
    if (user) {
        filteredPoints = filteredPoints.filter(point => {
            return point.user_id === user;
        });
    }
    
    // Update map markers
    clearAllMarkers();
    filteredPoints.forEach(point => {
        addPointToMap(point);
    });
    
    // Show filter info
    const filterInfo = document.getElementById('filter-info');
    filterInfo.style.display = 'block';
    document.getElementById('filter-count').textContent = `${filteredPoints.length} из ${allPoints.length}`;
    
    showInfoToast(`Найдено точек: ${filteredPoints.length} из ${allPoints.length}`);
}

function resetMapFilters() {
    document.getElementById('soil-type-filter').value = '';
    document.getElementById('user-filter').value = '';
    
    const allPoints = window.lastLoadedPoints || [];
    
    // Update map markers
    clearAllMarkers();
    allPoints.forEach(point => {
        addPointToMap(point);
    });
    
    // Hide filter info
    const filterInfo = document.getElementById('filter-info');
    filterInfo.style.display = 'none';
    
    showInfoToast(`Показаны все точки: ${allPoints.length}`);
}

// Clear all markers from map
function clearAllMarkers() {
    if (window.markers) {
        window.markers.forEach(marker => {
            if (marker && window.map) {
                window.map.removeLayer(marker);
            }
        });
        window.markers = [];
    }
}

// Initialize map filters when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(loadMapFilters, 2000);
});
