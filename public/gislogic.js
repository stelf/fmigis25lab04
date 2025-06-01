// Инициализиране на картата
const map = L.map('map'); // https://leafletjs.com/reference.html#map-factory
const statusBar = document.getElementById('status-bar');

// Define map providers
const mapProviders = {
    osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    esri_natgeo: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC'
    },
    cartodb_dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CartoDB</a>'
    },
    stamen_terrain: {
        url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a>, under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, data by <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
}

let currentBaseLayer; // To keep track of the current base layer

function changeBaseMap(providerKey) {
    if (currentBaseLayer) {
        map.removeLayer(currentBaseLayer); // https://leafletjs.com/reference.html#map-removelayer
    }
    const provider = mapProviders[providerKey];
    currentBaseLayer = L.tileLayer(provider.url, { attribution: provider.attribution }).addTo(map); // https://leafletjs.com/reference.html#tilelayer
}

// Set initial map to OpenStreetMap
changeBaseMap('osm');

const mapProviderSelect = document.getElementById('map-provider');
mapProviderSelect.addEventListener('change', (event) => {
    changeBaseMap(event.target.value);
});

// Dynamically load images, calculate hover icon ratio, and set icon sizes accordingly
const normImg = new Image(); normImg.src = 'normal.png';
const hoveImg = new Image(); hoveImg.src = 'hover.png';

normImg.onload = hoveImg.onload = function () {
    const hoverRatio = hoveImg.naturalHeight / hoveImg.naturalWidth;
    window.normalIcon = L.icon({ // https://leafletjs.com/reference.html#icon
        iconUrl: 'normal.png', 
        iconSize: [16, 16 * hoverRatio ], iconAnchor: [8, 16 * hoverRatio] });
    window.hoverIcon = L.icon({ 
        iconUrl: 'hover.png', 
        iconSize: [32, 32 * hoverRatio], iconAnchor: [16, 32 * hoverRatio] });
};

// Layer group for isolines
const isolays = L.layerGroup().addTo(map); // https://leafletjs.com/reference.html#layergroup

// Помощна функция за извличане и показване на изолинии 
async function fetchIso(lat, lon, mode, range, color) {
    try {
        const url = `/api/isoline?lat=${lat}&lon=${lon}&mode=${mode}&range=${range}`;
        const resp = await fetch(url);

        if (!resp.ok) {
            const errData = await resp.json();
            throw new Error(`Proxy error: ${resp.status} - ${errData.error || resp.statusText}`);
        }

        const geoJson = await resp.json();
        
        L.geoJSON(geoJson, { // https://leafletjs.com/reference.html#geojson
            style: {
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.5,
                fillOpacity: 0.2
            }
        }).addTo(isolays);

    } catch (error) {
        console.error(`Error fetching or displaying ${mode} isolines:`, error);
        statusBar.textContent = `Грешка при зареждане на изолини за ${mode}`;
    }
}

// Извличане на GeoJSON данни от крайната точка /gari
const fetchData = async () => {
    try {
        const response = await fetch('/api/jp_gari');
        const geojsonData = await response.json();

        // Add GeoJSON to the map with marker icons and events
        const geoJsonLayer = L.geoJSON(geojsonData, {
            pointToLayer: (feature, latlng) => {
                const marker = L.marker(latlng, { icon: normalIcon }); // https://leafletjs.com/reference.html#marker
                marker.on({ // https://leafletjs.com/reference.html#evented-on
                    mouseover: () => {
                        marker.setIcon(hoverIcon);

                        const tradename = feature.properties.tradename || 'Unknown';
                        statusBar.textContent = `Trade Name: ${tradename}`;
                    },
                    mouseout: () => {
                        marker.setIcon(normalIcon);

                        statusBar.textContent = `Hover to view details`;
                    },
                    click: async (e) => {
                        isolays.clearLayers();

                        // Fetch and display drive and walk isolines (5minutes)
                        await fetchIso(e.latlng.lat, e.latlng.lng, 'drive', '300', 'blue');
                        await fetchIso(e.latlng.lat, e.latlng.lng, 'walk', '300', 'green');                    
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
                        const tradename = feature.properties.tradename || 'Неизвестен / Unknown';
                        statusBar.textContent = `Trade Name: ${tradename}`;
                        geoJsonLayer.resetStyle();
                        layer.setStyle({
                            weight: 3,
                            color: '#ff4500',
                            fillOpacity: 0.5
                        });
                        L.DomEvent.stopPropagation(e); // https://leafletjs.com/reference.html#domevent-stoppropagation
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
        map.fitBounds(geoJsonLayer.getBounds()); // https://leafletjs.com/reference.html#map-fitbounds

        map.on('click', async (e) => { // https://leafletjs.com/reference.html#evented-on
            statusBar.textContent = 'Click on a feature to see details';
        });

    } catch (error) {
        console.error('Грешка при зареждане на GeoJSON данните:', error);
        statusBar.textContent = 'Грешка при зареждане на данните';
        alert('Неуспешно зареждане на GeoJSON данните. Вижте конзолата за подробности.');
    }
};

// Зареждане на данните при готовност на страницата
fetchData();
