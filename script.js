// ==========================================
// 1. Logic Theme Toggle
// ==========================================
const toggleBtn = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

// Fungsi helper untuk mengambil variabel CSS
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

toggleBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', newTheme);
    toggleBtn.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
    
    // Refresh map style jika ada layer terpilih agar warna garis berubah
    if(geoJsonLayer) geoJsonLayer.eachLayer(layer => geoJsonLayer.resetStyle(layer));
    // Trigger ulang highlight jika ada yang aktif (bisa ditambahkan logic simpan state)
});

// ==========================================
// 2. Inisialisasi Peta
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([2.6, 98.7], 11);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
}).addTo(map);

// Variabel Global
var geoJsonData = null;
var geoJsonLayer = null;
var searchMarker = null;

// DOM Elements
const selectKecamatan = document.getElementById('filter-kecamatan');
const selectDesa = document.getElementById('filter-desa');
const selectSls = document.getElementById('filter-sls');
const selectSubSls = document.getElementById('filter-subsls'); // Filter Baru
const countDisplay = document.getElementById('count-display');

// Style Default
const defaultStyle = {
    color: "#f79039", // var(--line-primary) manual fallback
    weight: 1.5,
    opacity: 0.9,
    fillOpacity: 0.1,
    fillColor: null,
    dashArray: null // Garis solid
};

// ==========================================
// 3. Load & Process Data
// ==========================================
fetch('peta_sls_2025.geojson')
    .then(response => response.json())
    .then(data => {
        geoJsonData = data;
        populateFiltersKecamatan(data);
        renderMap(data);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));

// ==========================================
// 4. Render Map & Basic Interaction
// ==========================================
function renderMap(data) {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
    }

    geoJsonLayer = L.geoJSON(data, {
        style: defaultStyle,
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            
            // Format Popup
            const subInfo = props.subsls ? `<b>Sub SLS:</b> ${props.subsls}<br>` : '';
            const popupContent = `
                <div style="font-family: 'Roboto', sans-serif;">
                    <h4 style="margin:0 0 5px; color:#f79039; border-bottom:1px solid #ddd; padding-bottom:5px;">Info Wilayah</h4>
                    <b>Kecamatan:</b> [${props.kdkec}] ${props.nmkec}<br>
                    <b>Desa:</b> [${props.kddesa}] ${props.nmdesa}<br>
                    <b>SLS:</b> [${props.kdsls}] ${props.nmsls}<br>
                    ${subInfo}
                    <small style="color:#888;">ID: ${props.idsls}</small>
                </div>
            `;
            layer.bindPopup(popupContent);

            // Interaksi Klik
            layer.on('click', function(e) {
                // Saat klik peta, kita perlu tahu apakah ini bagian dari SLS yg punya sub atau tidak
                // Untuk simplifikasi, kita trigger logika highlight
                highlightSubSlsSpecific(layer);
                L.DomEvent.stopPropagation(e);
            });
        }
    }).addTo(map);

    if (geoJsonLayer.getLayers().length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
    countDisplay.innerText = data.features.length;
}

// ==========================================
// 5. Advanced Highlighting Logic
// ==========================================

// Fungsi RESET Style ke Awal
function resetLayerStyles() {
    geoJsonLayer.eachLayer(layer => {
        geoJsonLayer.resetStyle(layer);
        layer.unbindTooltip(); // Hapus label jika ada
    });
    map.fitBounds(geoJsonLayer.getBounds());
}

// A. Highlight SLS (GROUP) - Saat SLS dipilih dari dropdown
function highlightSlsGroup(slsCode, slsName) {
    // 1. Cari semua feature yang termasuk dalam SLS ini
    const relatedLayers = [];
    geoJsonLayer.eachLayer(layer => {
        const p = layer.feature.properties;
        // Cocokkan berdasarkan nmsls dan kdsls (untuk presisi)
        if (p.kdsls === slsCode && p.nmsls === slsName) {
            relatedLayers.push(layer);
        }
    });

    if (relatedLayers.length === 0) return;

    // 2. Hitung Bounds gabungan
    const groupFeatureGroup = L.featureGroup(relatedLayers);
    map.flyToBounds(groupFeatureGroup.getBounds(), { padding: [50, 50], duration: 1.2 });

    // 3. Styling
    const secondaryColor = getCssVar('--line-secondary') || '#007bff';
    const primaryColor = getCssVar('--line-primary') || '#f79039';

    geoJsonLayer.eachLayer(layer => {
        const p = layer.feature.properties;
        const isTarget = (p.kdsls === slsCode && p.nmsls === slsName);

        if (isTarget) {
            // Jika dia punya Sub SLS (artinya ada > 1 feature atau punya kode sub)
            // Cek apakah group ini memiliki multiple sub geometries
            const hasMultipleSubs = relatedLayers.length > 1;

            if (hasMultipleSubs) {
                // c. Geometry ditampilkan semua (sudah via flyToBounds)
                // b. Garis batas subsls putus-putus
                layer.setStyle({
                    weight: 2,
                    color: secondaryColor, // Warna sekunder (beda light/dark)
                    dashArray: '5, 5',     // Garis putus-putus
                    fillOpacity: 0.1,
                    fillColor: secondaryColor
                });

                // a. Munculkan Label (kdsubsls) di tengah opacity 50%
                if (p.subsls) {
                    layer.bindTooltip(p.subsls, {
                        permanent: true,
                        direction: 'center',
                        className: 'subsls-label' // style di CSS
                    }).openTooltip();
                }
            } else {
                // Jika SLS Tunggal (tidak punya sub)
                layer.setStyle({
                    weight: 4,
                    color: '#febd26',
                    dashArray: null, // Solid
                    fillOpacity: 0
                });
                layer.bringToFront();
            }
        } else {
            // Non-Target -> Dimmed
            layer.setStyle({
                weight: 1,
                color: primaryColor,
                fillColor: '#231f20',
                fillOpacity: 0.4,
                dashArray: null
            });
            layer.unbindTooltip();
        }
    });
}

// B. Highlight SubSLS Specific - Saat SubSLS dipilih atau diklik
function highlightSubSlsSpecific(targetLayer) {
    const props = targetLayer.feature.properties;
    
    // Zoom ke feature spesifik
    map.flyToBounds(targetLayer.getBounds(), { padding: [50, 50], duration: 1 });

    const secondaryColor = getCssVar('--line-secondary') || '#007bff';
    
    geoJsonLayer.eachLayer(layer => {
        const p = layer.feature.properties;
        // Cek apakah layer ini saudara (satu SLS induk yang sama)
        const isSibling = (p.kdsls === props.kdsls && p.nmsls === props.nmsls);
        
        if (layer === targetLayer) {
            // 4.b. SubSLS Terpilih: NoFill, Dashed Line
            layer.setStyle({
                weight: 4,
                color: secondaryColor,
                dashArray: '10, 5', // Putus-putus lebih tebal
                fillOpacity: 0      // No Fill
            });
            layer.bringToFront();
            layer.openPopup(); // 4.a Munculkan info
        } else if (isSibling) {
            // 4.b. Tetangga satu SLS: Abu-abu opacity 20%, Dashed Line
            layer.setStyle({
                weight: 2,
                color: secondaryColor,
                dashArray: '5, 5',
                fillColor: 'gray',
                fillOpacity: 0.2
            });
        } else {
            // Wilayah lain: Gelap
            layer.setStyle({
                weight: 1,
                color: '#f79039',
                fillColor: '#231f20',
                fillOpacity: 0.5,
                dashArray: null
            });
        }
    });
}


// ==========================================
// 6. Filter Logic (Dropdowns)
// ==========================================

// Helper: Sort Array of Objects by specific key code
function sortAndUnique(features, codeKey, nameKey) {
    const mapObj = new Map();
    features.forEach(f => {
        const code = f.properties[codeKey];
        const name = f.properties[nameKey];
        if (code && !mapObj.has(code)) {
            mapObj.set(code, { code, name });
        }
    });
    // Convert to array and Sort Ascending by Code
    return Array.from(mapObj.values()).sort((a, b) => a.code.toString().localeCompare(b.code.toString()));
}

// 6.1 Populate Kecamatan
function populateFiltersKecamatan(data) {
    const sortedKec = sortAndUnique(data.features, 'kdkec', 'nmkec');
    selectKecamatan.innerHTML = '<option value="">Semua Kecamatan</option>';
    
    sortedKec.forEach(item => {
        const option = document.createElement('option');
        option.value = item.code; // Simpan Kode sebagai value
        // Format: [080] - PANGURURAN
        option.textContent = `[${item.code}] - ${item.name}`; 
        selectKecamatan.appendChild(option);
    });
}

// Event Kecamatan
selectKecamatan.addEventListener('change', function() {
    const kdkec = this.value; // Ambil Kode
    
    // Reset Child Filters
    resetDropdown(selectDesa, 'Desa');
    resetDropdown(selectSls, 'SLS');
    resetDropdown(selectSubSls, 'Sub SLS');

    if (!kdkec) {
        applyMainFilter(); 
        return;
    }

    // Filter features untuk dropdown Desa
    const filteredFeatures = geoJsonData.features.filter(f => f.properties.kdkec === kdkec);
    const sortedDesa = sortAndUnique(filteredFeatures, 'kddesa', 'nmdesa');
    
    sortedDesa.forEach(item => {
        const option = document.createElement('option');
        option.value = item.code;
        option.textContent = `[${item.code}] - ${item.name}`;
        selectDesa.appendChild(option);
    });
    selectDesa.disabled = false;
    
    applyMainFilter();
});

// Event Desa
selectDesa.addEventListener('change', function() {
    const kddesa = this.value;
    const kdkec = selectKecamatan.value;

    resetDropdown(selectSls, 'SLS');
    resetDropdown(selectSubSls, 'Sub SLS');

    if (!kddesa) {
        applyMainFilter();
        return;
    }

    const filteredFeatures = geoJsonData.features.filter(f => 
        f.properties.kdkec === kdkec && f.properties.kddesa === kddesa
    );
    const sortedSls = sortAndUnique(filteredFeatures, 'kdsls', 'nmsls');

    sortedSls.forEach(item => {
        const option = document.createElement('option');
        option.value = item.code; // Gunakan Kode SLS
        option.textContent = `[${item.code}] - ${item.name}`;
        // Simpan nama SLS di attribute agar mudah diambil nanti
        option.setAttribute('data-name', item.name); 
        selectSls.appendChild(option);
    });
    selectSls.disabled = false;

    applyMainFilter();
});

// Event SLS
selectSls.addEventListener('change', function() {
    const kdsls = this.value;
    const nmsls = this.options[this.selectedIndex].getAttribute('data-name');
    const kdkec = selectKecamatan.value;
    const kddesa = selectDesa.value;

    resetDropdown(selectSubSls, 'Sub SLS');

    if (!kdsls) {
        resetLayerStyles();
        return;
    }

    // 1. Cari Sub SLS yang tersedia untuk SLS ini
    const slsFeatures = geoJsonData.features.filter(f => 
        f.properties.kdkec === kdkec && 
        f.properties.kddesa === kddesa &&
        f.properties.kdsls === kdsls
    );

    // Cek apakah punya sub (lebih dari 1 geometri atau punya properti subsls yang valid)
    // Filter SubSLS memuat atribut 'subsls' (misal: 01, 02)
    // Jika hanya ada 1 feature dan subsls kosong/00, maka disable
    const hasSub = slsFeatures.length > 1;

    if (hasSub) {
        // Populate SubSLS Dropdown
        // Urutkan berdasarkan subsls
        const sortedSubs = slsFeatures
            .map(f => f.properties.subsls)
            .sort()
            .filter((v, i, a) => a.indexOf(v) === i); // Unique

        sortedSubs.forEach(subCode => {
            const option = document.createElement('option');
            option.value = subCode;
            option.textContent = `Sub: ${subCode}`;
            selectSubSls.appendChild(option);
        });
        selectSubSls.disabled = false;
    }

    // Trigger Highlight SLS Group
    highlightSlsGroup(kdsls, nmsls);
});

// Event Sub SLS
selectSubSls.addEventListener('change', function() {
    const subCode = this.value;
    const kdsls = selectSls.value;
    const nmsls = selectSls.options[selectSls.selectedIndex].getAttribute('data-name');

    if(!subCode) {
        // Jika kembali ke "Semua Sub", trigger group view lagi
        highlightSlsGroup(kdsls, nmsls);
        return;
    }

    // Cari feature spesifik
    const targetLayer = geoJsonLayer.getLayers().find(layer => {
        const p = layer.feature.properties;
        return p.kdsls === kdsls && p.nmsls === nmsls && p.subsls === subCode;
    });

    if (targetLayer) {
        highlightSubSlsSpecific(targetLayer);
    }
});


// Helper Reset Dropdown
function resetDropdown(element, defaultText) {
    element.innerHTML = `<option value="">Semua ${defaultText}</option>`;
    element.disabled = true;
}

// Fungsi Main Filter (Hanya untuk render ulang data dasar jika diperlukan)
function applyMainFilter() {
    const kdkec = selectKecamatan.value;
    const kddesa = selectDesa.value;

    // Kita filter data hanya sampai level Desa agar SLS lain tetap ada di memori untuk ditampilkan (hanya di-dimkan)
    const filteredFeatures = geoJsonData.features.filter(f => {
        const p = f.properties;
        return (!kdkec || p.kdkec === kdkec) &&
               (!kddesa || p.kddesa === kddesa);
    });

    renderMap({ type: "FeatureCollection", features: filteredFeatures });
}

// Reset Button
document.getElementById('btn-reset').addEventListener('click', () => {
    selectKecamatan.value = "";
    resetDropdown(selectDesa, 'Desa');
    resetDropdown(selectSls, 'SLS');
    resetDropdown(selectSubSls, 'Sub SLS');
    
    // Render ulang semua
    renderMap(geoJsonData);
    resetLayerStyles();
});

// Search Location & Point in Polygon (Sama seperti sebelumnya)
document.getElementById('btn-search').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);

    if (isNaN(lat) || isNaN(lng)) { alert("Koordinat tidak valid"); return; }

    const foundFeature = findSlsByLocation(lat, lng, geoJsonData);
    let popupContent = "";

    if (searchMarker) map.removeLayer(searchMarker);

    if (foundFeature) {
        const p = foundFeature.properties;
        const subTxt = p.subsls ? `(Sub: ${p.subsls})` : '';
        popupContent = `
            <div style="color: #231f20; font-family: 'Roboto', sans-serif; text-align: center;">
                <h4 style="margin: 0 0 5px 0; border-bottom: 2px solid #f79039; padding-bottom:5px; color:#f79039;">Lokasi Terdeteksi</h4>
                Desa ${p.nmdesa}<br>
                <b>${p.nmsls}</b> ${subTxt}
            </div>
        `;
        // Auto Highlight Feature Tersebut
        geoJsonLayer.eachLayer(layer => {
            if (layer.feature.properties.idsls === p.idsls && layer.feature.properties.subsls === p.subsls) {
                highlightSubSlsSpecific(layer);
            }
        });
    } else {
        popupContent = `<div style="color: red; font-weight:bold;">Lokasi di luar wilayah.</div>`;
    }

    searchMarker = L.marker([lat, lng]).addTo(map).bindPopup(popupContent).openPopup();
    map.flyTo([lat, lng], 18);
});

function findSlsByLocation(lat, lng, data) {
    if (!data) return null;
    const point = [lng, lat];
    for (const feature of data.features) {
        const geom = feature.geometry;
        if (!geom) continue;
        if (geom.type === 'Polygon' && isPointInPolygon(point, geom.coordinates)) return feature;
        if (geom.type === 'MultiPolygon') {
            for (const poly of geom.coordinates) if (isPointInPolygon(point, poly)) return feature;
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
