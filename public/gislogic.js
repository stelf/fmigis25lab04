// Инициализиране на картата
const map = L.map('map');
const statusBar = document.getElementById('status-bar');

// Добавяне на основен слой - подложката от OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Динамично зареждане на изображения, изчисляване на съотношението за hover и задаване на размери на иконите
const normImg = new Image(); normImg.src = 'normal.png';
const hoveImg = new Image(); hoveImg.src = 'hover.png';

normImg.onload = hoveImg.onload = function () {
    const hoverRatio = hoveImg.naturalHeight / hoveImg.naturalWidth;
    window.normalIcon = L.icon({ 
        iconUrl: 'normal.png', 
        iconSize: [16, 16 * hoverRatio ], iconAnchor: [8, 16 * hoverRatio] });
    window.hoverIcon = L.icon({ 
        iconUrl: 'hover.png', 
        iconSize: [32, 32 * hoverRatio], iconAnchor: [16, 32 * hoverRatio] });
};

// Извличане на GeoJSON данни от крайната точка /gari
const fetchData = async () => {
    try {
        const response = await fetch('/gari');
        const geojsonData = await response.json();

        // Add GeoJSON to the map with marker icons and events
        const geoJsonLayer = L.geoJSON(geojsonData, {
            pointToLayer: (feature, latlng) => {
                const marker = L.marker(latlng, { icon: normalIcon });
                marker.on({
                    mouseover: () => {
                        marker.setIcon(hoverIcon);

                        const tradename = feature.properties.tradename || 'Unknown';
                        statusBar.textContent = `Trade Name: ${tradename}`;
                        L.DomEvent.stopPropagation(e);                    },
                    mouseout: () => {
                        marker.setIcon(normalIcon);

                        statusBar.textContent = `Hover to view details`;
                    },
                    click: (e) => {
                        alert('no clickin yet');
                    }
                });
                return marker;
            },
            style: {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
                if (!(layer instanceof L.Marker)) {
                    // Polygon/line logic
                    layer.on('click', (e) => {
                        const tradename = feature.properties.tradename || 'Unknown';
                        statusBar.textContent = `Trade Name: ${tradename}`;
                        geoJsonLayer.resetStyle();
                        layer.setStyle({
                            weight: 3,
                            color: '#ff4500',
                            fillOpacity: 0.5
                        });
                        L.DomEvent.stopPropagation(e);
                    });
                    layer.on('mouseover', (e) => {
                        layer.setStyle({
                            weight: 3,
                            fillOpacity: 0.4
                        });
                    });
                }
            }
        }).addTo(map);

        // Нагласяне на картата към границите на GeoJSON данните
        map.fitBounds(geoJsonLayer.getBounds());

        // Добавяне на събитие за щракване върху картата, за да се нулира статусът и подчертаването
        map.on('click', () => {
            statusBar.textContent = 'Hover on a feature to see details. Click to set first/last';
            geoJsonLayer.resetStyle();
        });

    } catch (error) {
        console.error('Грешка при зареждане на GeoJSON данните:', error);
        statusBar.textContent = 'Грешка при зареждане на данните';
        alert('Неуспешно зареждане на GeoJSON данните. Вижте конзолата за подробности.');
    }
};

// Зареждане на данните при готовност на страницата
fetchData();
