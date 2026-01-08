// ==========================================
// 1. Logic Theme Toggle (Light/Dark Mode)
// ==========================================
const toggleBtn = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

toggleBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    htmlEl.setAttribute('data-theme', newTheme);
    toggleBtn.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
});

// ==========================================
// 2. Inisialisasi Peta
// ==========================================
var map = L.map('map', {
    zoomControl: false // Kita pindahkan zoom control agar tidak tertutup
}).setView([2.6, 98.7], 11);

// Pindahkan Zoom Control ke Kanan Bawah
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Tambahkan Layer Satelit
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri'
}).addTo(map);

// Variabel Global
var geoJsonData = null;
var geoJsonLayer = null;
var searchMarker = null;

// Elemen DOM
const selectKecamatan = document.getElementById('filter-kecamatan');
const selectDesa = document.getElementById('filter-desa');
const selectSls = document.getElementById('filter-sls');
const countDisplay = document.getElementById('count-display');

// Style Default
const defaultStyle = {
    color: "#f79039", // Menggunakan warna Orange dari tema
    weight: 1.5,        
    opacity: 0.8,
    fillOpacity: 0.1, 
    fillColor: null   
};

// 3. Load GeoJSON
fetch('peta_sls_2025.geojson')
    .then(response => response.json())
    .then(data => {
        geoJsonData = data;
        populateFilters(data);
        renderMap(data);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));

// 4. Fungsi Render Peta
function renderMap(data) {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
    }

    geoJsonLayer = L.geoJSON(data, {
        style: defaultStyle,
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const popupContent = `
                <div style="font-family: 'Roboto', sans-serif;">
                    <h4 style="margin:0 0 5px; color:#f79039; border-bottom:1px solid #ddd; padding-bottom:5px;">Info Wilayah</h4>
                    <b>Kecamatan:</b> ${props.nmkec}<br>
                    <b>Desa:</b> ${props.nmdesa}<br>
                    <b>SLS:</b> ${props.nmsls}<br>
                    <small style="color:#888;">ID: ${props.idsls}</small>
                </div>
            `;
            layer.bindPopup(popupContent);

            layer.on('click', function(e) {
                if (!selectSls.disabled) {
                    selectSls.value = props.nmsls;
                }
                highlightAndZoom(layer);
                L.DomEvent.stopPropagation(e);
            });
        }
    }).addTo(map);

    if (geoJsonLayer.getLayers().length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
    
    countDisplay.innerText = data.features.length;
}

// 5. Highlight & Zoom
function highlightAndZoom(targetLayer) {
    map.flyToBounds(targetLayer.getBounds(), {
        padding: [50, 50],
        duration: 1.2
    });

    geoJsonLayer.eachLayer(function(layer) {
        if (layer === targetLayer) {
            layer.setStyle({
                weight: 4,           
                color: '#febd26',  // Warna Kuning saat terpilih  
                fillOpacity: 0       
            });
            layer.bringToFront();    
            layer.openPopup();       
        } else {
            layer.setStyle({
                weight: 1,           
                color: '#f79039',
                fillColor: '#231f20', // Warna gelap
                fillOpacity: 0.4    // Opacity background digelapkan agar fokus
            });
        }
    });
}

// Reset Style
function resetLayerStyles() {
    geoJsonLayer.eachLayer(function(layer) {
        geoJsonLayer.resetStyle(layer); 
    });
    map.fitBounds(geoJsonLayer.getBounds());
}

// 6. Logika Filter Dropdown
function populateFilters(data) {
    const features = data.features;
    const kecamatans = new Set();
    features.forEach(f => { if(f.properties.nmkec) kecamatans.add(f.properties.nmkec); });
    
    Array.from(kecamatans).sort().forEach(kec => {
        const option = document.createElement('option');
        option.value = kec;
        option.textContent = kec;
        selectKecamatan.appendChild(option);
    });
}

selectKecamatan.addEventListener('change', function() {
    const selectedKec = this.value;
    selectDesa.innerHTML = '<option value="">Semua Desa</option>';
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectDesa.disabled = !selectedKec;
    selectSls.disabled = true;

    if (!selectedKec) { applyFilterData(); return; }

    const filteredFeatures = geoJsonData.features.filter(f => f.properties.nmkec === selectedKec);
    const desas = new Set(filteredFeatures.map(f => f.properties.nmdesa));
    Array.from(desas).sort().forEach(desa => {
        const option = document.createElement('option');
        option.value = desa;
        option.textContent = desa;
        selectDesa.appendChild(option);
    });
    applyFilterData();
});

selectDesa.addEventListener('change', function() {
    const selectedDesa = this.value;
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectSls.disabled = !selectedDesa;

    if (!selectedDesa) { applyFilterData(); return; }

    const currentKec = selectKecamatan.value;
    const filteredFeatures = geoJsonData.features.filter(f => 
        f.properties.nmkec === currentKec && 
        f.properties.nmdesa === selectedDesa
    );
    const slsList = new Set(filteredFeatures.map(f => f.properties.nmsls));
    Array.from(slsList).sort().forEach(sls => {
        const option = document.createElement('option');
        option.value = sls;
        option.textContent = sls;
        selectSls.appendChild(option);
    });
    applyFilterData();
});

selectSls.addEventListener('change', function() {
    const selectedSlsName = this.value;
    if (!selectedSlsName) {
        resetLayerStyles();
    } else {
        let foundLayer = null;
        geoJsonLayer.eachLayer(layer => {
            if (layer.feature.properties.nmsls === selectedSlsName) {
                foundLayer = layer;
            }
        });
        if (foundLayer) highlightAndZoom(foundLayer);
    }
});

function applyFilterData() {
    const kecVal = selectKecamatan.value;
    const desaVal = selectDesa.value;
    const filteredFeatures = geoJsonData.features.filter(f => {
        const p = f.properties;
        return (!kecVal || p.nmkec === kecVal) &&
               (!desaVal || p.nmdesa === desaVal);
    });
    renderMap({ type: "FeatureCollection", features: filteredFeatures });
}

document.getElementById('btn-reset').addEventListener('click', () => {
    selectKecamatan.value = "";
    selectDesa.innerHTML = '<option value="">Semua Desa</option>';
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectDesa.disabled = true;
    selectSls.disabled = true;
    renderMap(geoJsonData);
});

// Search Location & Point in Polygon
document.getElementById('btn-search').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);

    if (isNaN(lat) || isNaN(lng)) {
        alert("Masukkan koordinat yang valid");
        return;
    }

    let foundFeature = findSlsByLocation(lat, lng, geoJsonData);
    let popupContent = "";

    if (foundFeature) {
        const p = foundFeature.properties;
        popupContent = `
            <div style="color: #231f20; font-family: 'Roboto', sans-serif; text-align: center;">
                <h4 style="margin: 0 0 5px 0; border-bottom: 2px solid #f79039; padding-bottom:5px; color:#f79039;">Lokasi Terdeteksi</h4>
                Titik Lokasi berada di:<br>
                <b>Desa ${p.nmdesa}</b><br>
                <b>${p.nmsls}</b>
            </div>
        `;
    } else {
        popupContent = `
            <div style="color: #231f20; font-family: 'Roboto', sans-serif; text-align: center;">
                <h4 style="margin: 0 0 5px 0; border-bottom: 2px solid #dc3545; padding-bottom:5px; color:#dc3545;">Peringatan</h4>
                Titik Lokasi berada di luar peta Wilkerstat
            </div>
        `;
    }

    if (searchMarker) map.removeLayer(searchMarker);

    searchMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup(popupContent)
        .openPopup();

    map.setView([lat, lng], 18);
    
    if (foundFeature) {
        geoJsonLayer.eachLayer(layer => {
            if (layer.feature.properties.idsls === foundFeature.properties.idsls) {
                highlightAndZoom(layer);
            }
        });
    }
});

function findSlsByLocation(lat, lng, data) {
    if (!data) return null;
    const point = [lng, lat]; 

    for (const feature of data.features) {
        const geom = feature.geometry;
        if (!geom) continue;

        if (geom.type === 'Polygon') {
            if (isPointInPolygon(point, geom.coordinates)) return feature;
        } 
        else if (geom.type === 'MultiPolygon') {
            for (const polyCoords of geom.coordinates) {
                if (isPointInPolygon(point, polyCoords)) return feature;
            }
        }
    }
    return null; 
}

function isPointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    const ring = vs[0]; 
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
