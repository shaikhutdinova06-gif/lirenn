// Emergency fix for non-working buttons
// This script ensures button functionality works

console.log('Button fix loading...');

// Override all button click handlers
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, applying button fixes...');
    
    // Wait for everything to load
    setTimeout(() => {
        // Fix all button clicks
        fixAllButtons();
        
        // Override broken functions
        if (!window.showSection || typeof window.showSection !== 'function') {
            window.showSection = function(section) {
                console.log('Fixed showSection called with:', section);
                
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
                    console.log('Section displayed:', section);
                } else {
                    console.error('Section not found:', section);
                }
            };
        }
        
        // Fix map initialization
        if (!window.initMap || typeof window.initMap !== 'function') {
            window.initMap = function() {
                console.log('Fixed initMap called');
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
            };
        }
        
        // Fix loadPoints
        if (!window.loadPoints || typeof window.loadPoints !== 'function') {
            window.loadPoints = async function() {
                console.log('Fixed loadPoints called');
                try {
                    const response = await fetch('/api/points');
                    const points = await response.json();
                    console.log('Points loaded:', points.length);
                    
                    // Clear existing markers
                    if (window.markers) {
                        window.markers.forEach(marker => {
                            if (marker && window.map) {
                                window.map.removeLayer(marker);
                            }
                        });
                    }
                    window.markers = [];
                    
                    // Add points to map
                    points.forEach(point => {
                        if (window.addPointToMap && typeof window.addPointToMap === 'function') {
                            window.addPointToMap(point);
                        }
                    });
                    
                } catch (error) {
                    console.error('Error loading points:', error);
                }
            };
        }
        
        // Initialize map if it exists
        if (document.getElementById('leaflet-map')) {
            window.initMap();
            setTimeout(() => {
                window.loadPoints();
            }, 1000);
        }
        
        // Add click listeners to all buttons
        const buttons = document.querySelectorAll('button, .btn');
        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                console.log('Button clicked:', this.textContent, this.onclick);
                
                // Ensure onclick handlers work
                if (this.onclick) {
                    this.onclick(e);
                }
            });
        });
        
        console.log('Button fixes applied');
    }, 2000);
});

// Helper function to fix all buttons
function fixAllButtons() {
    const buttons = document.querySelectorAll('button[onclick]');
    buttons.forEach(button => {
        const onclickAttr = button.getAttribute('onclick');
        if (onclickAttr) {
            // Remove and re-add onclick to ensure it works
            button.removeAttribute('onclick');
            
            // Add event listener
            button.addEventListener('click', function(e) {
                console.log('Fixed button clicked:', onclickAttr);
                try {
                    // Execute the original onclick
                    eval(onclickAttr);
                } catch (error) {
                    console.error('Error executing button onclick:', error);
                }
            });
        }
    });
}

// Global click handler for buttons
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('btn')) {
        console.log('Button clicked via global handler:', e.target.textContent);
    }
});
