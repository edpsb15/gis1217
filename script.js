// 1. Inisialisasi Peta
var map = L.map('map').setView([2.6, 98.7], 11);

// 2. Tambahkan Layer Satelit
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
    color: "#ff7800", 
    weight: 2,        
    opacity: 1,
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
                <b>Kecamatan:</b> ${props.nmkec}<br>
                <b>Desa:</b> ${props.nmdesa}<br>
                <b>SLS:</b> ${props.nmsls}<br>
                <b>ID SLS:</b> ${props.idsls}
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
        duration: 1.5
    });

    geoJsonLayer.eachLayer(function(layer) {
        if (layer === targetLayer) {
            layer.setStyle({
                weight: 4,           
                color: '#ff7800',    
                fillOpacity: 0       
            });
            layer.bringToFront();    
            layer.openPopup();       
        } else {
            layer.setStyle({
                weight: 1,           
                color: '#ff7800',
                fillColor: 'gray',   
                fillOpacity: 0.25    
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

// ============================================================
// FITUR PENCARIAN BARU (POINT IN POLYGON)
// ============================================================

document.getElementById('btn-search').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);

    if (isNaN(lat) || isNaN(lng)) {
        alert("Masukkan koordinat yang valid");
        return;
    }

    // 1. Cari apakah titik ini masuk ke dalam salah satu SLS di database
    // Kita cari di RAW data (geoJsonData) agar tidak terpengaruh filter yang sedang aktif
    let foundFeature = findSlsByLocation(lat, lng, geoJsonData);
    
    let popupContent = "";
    let popupOptions = {};

    if (foundFeature) {
        // SKENARIO 1: Lokasi DITEMUKAN (Warna Biru)
        const p = foundFeature.properties;
        popupContent = `
            <div style="color: #0056b3; font-family: sans-serif; text-align: center;">
                <h4 style="margin: 0 0 5px 0; border-bottom: 1px solid #ccc; padding-bottom:5px;">Lokasi Terdeteksi</h4>
                Titik Lokasi berada di:<br>
                <b>Desa ${p.nmdesa}</b><br>
                <b>${p.nmsls}</b>
            </div>
        `;
        // Opsi tambahan jika ingin bubble popupnya berwarna khusus, 
        // tapi styling konten HTML di atas sudah cukup mewakili permintaan.
    } else {
        // SKENARIO 2: Lokasi TIDAK DITEMUKAN (Warna Merah)
        popupContent = `
            <div style="color: #dc3545; font-family: sans-serif; text-align: center; font-weight: bold;">
                <h4 style="margin: 0 0 5px 0; border-bottom: 1px solid #ccc; padding-bottom:5px;">Peringatan</h4>
                Titik Lokasi berada di luar peta Wilkerstat
            </div>
        `;
    }

    // Hapus marker lama
    if (searchMarker) map.removeLayer(searchMarker);

    // Tambah marker baru & Buka Popup
    searchMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup(popupContent)
        .openPopup();

    // Zoom ke lokasi
    map.setView([lat, lng], 18);
    
    // Opsional: Jika ketemu, bisa otomatis highlight SLS-nya juga
    if (foundFeature) {
        // Cari layer Leaflet yang sesuai dengan feature ini untuk di-highlight
        // (Hanya jika layer tersebut sedang dirender/tidak terfilter)
        geoJsonLayer.eachLayer(layer => {
            if (layer.feature.properties.idsls === foundFeature.properties.idsls) {
                highlightAndZoom(layer);
            }
        });
    }
});

/**
 * Fungsi Algoritma Point in Polygon (Ray Casting)
 * Mencari feature mana yang menampung titik (lat, lng)
 */
function findSlsByLocation(lat, lng, data) {
    if (!data) return null;
    const point = [lng, lat]; // GeoJSON formatnya [lng, lat]

    for (const feature of data.features) {
        const geom = feature.geometry;
        if (!geom) continue;

        if (geom.type === 'Polygon') {
            // Polygon: koordinat ada di geom.coordinates
            if (isPointInPolygon(point, geom.coordinates)) return feature;
        } 
        else if (geom.type === 'MultiPolygon') {
            // MultiPolygon: array dari Polygon
            for (const polyCoords of geom.coordinates) {
                if (isPointInPolygon(point, polyCoords)) return feature;
            }
        }
    }
    return null; // Tidak ketemu
}

/**
 * Fungsi Matematika Dasar Cek Titik dalam Polygon
 * Menggunakan Ray-Casting Algorithm
 */
function isPointInPolygon(point, vs) {
    // vs adalah array ring polygon. Ring pertama [0] adalah batas luar (exterior)
    // Ring selanjutnya adalah lubang (holes), tapi untuk kasus ini kita cek batas luar saja cukup.
    
    const x = point[0], y = point[1];
    const ring = vs[0]; 
    
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
    }
    return inside;
}
