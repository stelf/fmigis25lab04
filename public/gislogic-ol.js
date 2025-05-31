// Инициализиране на картата
const statusBar = document.getElementById('status-bar');

// Създаване на изглед на картата
const view = new ol.View({
    center: ol.proj.fromLonLat([25.0, 42.0]), // Приблизителен център на България
    zoom: 7
});

// Създаване на картата
const map = new ol.Map({
    target: 'map',
    layers: [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        })
    ],
    view: view
});

// Създаване на векторни слоеве за GeoJSON данните
const vectorSource = new ol.source.Vector();
const vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#3388ff',
            width: 2
        }),
        fill: new ol.style.Fill({
            color: 'rgba(51, 136, 255, 0.3)'
        })
    })
});
map.addLayer(vectorLayer);

// Извличане на GeoJSON данни от крайната точка /gari
const fetchData = async () => {
    try {
        const response = await fetch('/gari');
        const geojsonData = await response.json();

        // Проектиране на GeoJSON данните към EPSG:3857 (Web Mercator)
        const features = new ol.format.GeoJSON().readFeatures(geojsonData, {
            featureProjection: 'EPSG:3857'
        });
        vectorSource.addFeatures(features);

        // Нагласяне на картата към границите на GeoJSON данните
        view.fit(vectorSource.getExtent(), {
            padding: [50, 50, 50, 50], // Добавяне на отстъп
            constrainResolution: false
        });

        // Добавяне на събитие за щракване върху картата
        map.on('click', (event) => {
            let featureFound = false;
            map.forEachFeatureAtPixel(event.pixel, (feature) => {
                console.log('Clicked feature properties:', feature.getProperties());
                let featureDetails = '';
                const properties = feature.getProperties();
                for (const key in properties) {
                    if (properties.hasOwnProperty(key) && key !== 'geometry') { // Exclude geometry
                        featureDetails += `${key}: ${properties[key]}<br>`;
                    }
                }
                statusBar.innerHTML = featureDetails || 'No details available';

                // Store the clicked feature to highlight it
                const clickedFeature = feature; 
                featureFound = true;

                // Style update logic needs to be outside forEachFeatureAtPixel to correctly apply to all features
                // We will reset all styles first, then highlight the clicked one.
                // This also simplifies the hover effect logic.
                return true; // Stop iterating once the first feature is found and processed
            });

            // Reset styles for all features first
            vectorSource.getFeatures().forEach(f => {
                f.setStyle(new ol.style.Style({ // Default style
                    stroke: new ol.style.Stroke({
                        color: '#3388ff',
                        width: 2
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(51, 136, 255, 0.3)'
                    })
                }));
            });

            if (featureFound) {
                // Highlight the clicked feature (we need to find it again in the source)
                // A more robust way would be to use feature IDs if available.
                // For now, we'll re-iterate or use the stored reference if possible.
                // The `map.forEachFeatureAtPixel` already gives us the feature.
                // We need to ensure its style is set *after* resetting others.
                map.forEachFeatureAtPixel(event.pixel, (featToHighlight) => {
                     featToHighlight.setStyle(new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: '#ff4500', // Highlight color
                            width: 3
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 69, 0, 0.5)' // Highlight fill
                        })
                    }));
                    return true; // Stop after highlighting the first one found at pixel
                });

            } else {
                statusBar.textContent = 'Click on a feature to see details';
                // Styles are already reset above if no feature was found
            }
        });

        // Добавяне на ефект при посочване с мишката
        map.on('pointermove', (event) => {
            if (event.dragging) {
                return;
            }
            const pixel = map.getEventPixel(event.originalEvent);
            const hit = map.hasFeatureAtPixel(pixel);
            map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        
            vectorSource.getFeatures().forEach(f => {
                const currentStyle = f.getStyle();
                if (currentStyle && currentStyle.getStroke().getColor() === '#ff4500') {
                } else {
                    f.setStyle(new ol.style.Style({ // Default style
                        stroke: new ol.style.Stroke({
                            color: '#3388ff',
                            width: 2
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(51, 136, 255, 0.3)'
                        })
                    }));
                }
            });
        
            // Highlight hovered feature if it's not the selected one
            map.forEachFeatureAtPixel(pixel, (feature) => {
                const currentStyle = feature.getStyle();
                if (currentStyle && currentStyle.getStroke().getColor() === '#ff4500') {
                    // This is the selected feature, already highlighted, do nothing more for hover
                } else {
                    feature.setStyle(new ol.style.Style({ // Hover style
                        stroke: new ol.style.Stroke({
                            color: '#3388ff', // Or a different hover color e.g. '#0056b3'
                            width: 3
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(51, 136, 255, 0.4)' // Slightly darker/different fill for hover
                        })
                    }));
                }
                return true; // Stop iterating
            });
        });


    } catch (error) {
        console.error('Грешка при зареждане на GeoJSON данните:', error);
        statusBar.textContent = 'Грешка при зареждане на данните';
        alert('Неуспешно зареждане на GeoJSON данните. Вижте конзолата за подробности.');
    }
};

// Зареждане на данните при готовност на страницата
fetchData();
