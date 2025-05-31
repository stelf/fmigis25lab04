// Инициализиране на картата
const map = L.map('map');
const statusBar = document.getElementById('status-bar');

// Добавяне на основен слой - подложката от OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Извличане на GeoJSON данни от крайната точка /gari
const fetchData = async () => {
    try {
        const response = await fetch('/gari');
        const geojsonData = await response.json();222

        // Добавяне на GeoJSON към картата със събития при щракване
        const geoJsonLayer = L.geoJSON(geojsonData, {
            style: {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.3
            },
            onEachFeature: (feature, layer) => {
                // Добавяне на събитие при щракване за показване на името в статус лентата
                layer.on('click', (e) => {
                    const tradename = feature.properties.tradename || 'Unknown';
                    statusBar.textContent = `Trade Name: ${tradename}`;

                    // Подчертаване на избрания обект
                    geoJsonLayer.resetStyle();
                    layer.setStyle({
                        weight: 3,
                        color: '#ff4500',
                        fillOpacity: 0.5
                    });

                    // Предотвратяване задействането на събитието за щракване върху картата
                    L.DomEvent.stopPropagation(e);
                });

                // // Добавяне на ефект при посочване с мишката
                // layer.on('mouseover', (e) => {
                //     layer.setStyle({
                //         weight: 3,
                //         fillOpacity: 0.4
                //     });
                // });

                // // Връщане на стила при отдалечаване на мишката, ако не е избраният обект
                // layer.on('mouseout', (e) => {
                //     geoJsonLayer.resetStyle(layer);
                // });
            }
        }).addTo(map);

        // Нагласяне на картата към границите на GeoJSON данните
        map.fitBounds(geoJsonLayer.getBounds());

        // Добавяне на събитие за щракване върху картата, за да се нулира статусът и подчертаването
        map.on('click', () => {
            statusBar.textContent = 'Click on a feature to see details';
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
