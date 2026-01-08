// ==========================================
// 1. Inisialisasi & Helper Warna
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([2.6, 98.7], 11);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
}).addTo(map);

// Global State
var geoJsonData = null;
var geoJsonLayer = null;
var searchMarker = null;

// Mengambil nilai warna aktual dari CSS Variable
function getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Objek untuk menyimpan warna saat ini (akan diupdate saat toggle tema)
let currentColors = {
    slsFillNonSel: getThemeColor('--map-sls-fill-nonsel'),
    slsBorder: getThemeColor('--map-sls-border'),
    subSlsAccent: getThemeColor('--map-subsls-accent')
};

function updateColorState() {
    currentColors = {
        slsFillNonSel: getThemeColor('--map-sls-fill-nonsel'),
        slsBorder: getThemeColor('--map-sls-border'),
        subSlsAccent: getThemeColor('--map-subsls-accent')
    };
}

// ==========================================
// 2. Logic Theme Toggle & Dynamic Font
// ==========================================
const toggleBtn = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

toggleBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlEl.setAttribute('data-theme', newTheme);
    toggleBtn.innerHTML = newTheme === 'light' ? '🌙' : '☀️';

    // 1. Update State Warna JS
    updateColorState();
    
    // 2. Render Ulang Style Layer yang ada
    if (geoJsonLayer) {
        // Kita perlu menerapkan ulang highlight logic jika ada yang sedang terpilih
        // Namun cara termudah adalah reset ke default lalu user pilih ulang, 
        // atau kita loop resetStyle tapi tetap mempertahankan seleksi. 
        // Untuk kestabilan, kita kembalikan ke default style view dulu.
        resetLayerStyles();
    }
});

// === LOGIC FONT DINAMIS ===
// Mengupdate variabel CSS --dynamic-font-size berdasarkan level zoom
function updateLabelFontSize() {
    const zoom = map.getZoom();
    // Batasan Zoom Peta umumnya 11 (jauh) s.d 18 (dekat)
    // Kita ingin font size:
    // Min: 10px (saat zoom out)
    // Max: 24px (saat zoom in maksimal)
    
    const minFont = 10;
    const maxFont = 24;
    const minZoom = 11;
    const maxZoom = 18;

    // Rumus interpolasi linear
    let newSize = minFont + (zoom - minZoom) * (maxFont - minFont) / (maxZoom - minZoom);

    // Clamp values (jaga agar tidak melampaui batas)
    if (newSize < minFont) newSize = minFont;
    if (newSize > maxFont) newSize = maxFont;

    // Set Variable CSS pada root document
    document.documentElement.style.setProperty('--dynamic-font-size', `${newSize}px`);
}

// Pasang Listener Zoom
map.on('zoomend', updateLabelFontSize);
// Panggil sekali di awal
updateLabelFontSize();


// ==========================================
// 3. Load Data & Render
// ==========================================
fetch('peta_sls_2025.geojson')
    .then(response => response.json())
    .then(data => {
        geoJsonData = data;
        populateFiltersKecamatan(data);
        renderMap(data);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));


function renderMap(data) {
    // Pastikan warna terupdate sebelum render
    updateColorState();

    if (geoJsonLayer) map.removeLayer(geoJsonLayer);

    geoJsonLayer = L.geoJSON(data, {
        style: getDefaultStyle, // Menggunakan fungsi agar dinamis
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const subInfo = props.subsls ? `<b>Sub SLS:</b> ${props.subsls}<br>` : '';
            
            const popupContent = `
                <div style="font-family: 'Roboto', sans-serif;">
                    <h4 style="margin:0 0 5px; color:${currentColors.slsBorder}; border-bottom:1px solid #ddd; padding-bottom:5px;">Info Wilayah</h4>
                    <b>Kecamatan:</b> [${props.kdkec}] ${props.nmkec}<br>
                    <b>Desa:</b> [${props.kddesa}] ${props.nmdesa}<br>
                    <b>SLS:</b> [${props.kdsls}] ${props.nmsls}<br>
                    ${subInfo}
                    <small style="color:#888;">ID: ${props.idsls}</small>
                </div>
            `;
            layer.bindPopup(popupContent);

            layer.on('click', function(e) {
                // Saat klik, trigger highlight spesifik
                highlightSubSlsSpecific(layer);
                L.DomEvent.stopPropagation(e);
            });
        }
    }).addTo(map);

    if (geoJsonLayer.getLayers().length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
    document.getElementById('count-display').innerText = data.features.length;
}

// Fungsi Style Default (Mengacu pada Point 2.a & 2.b)
function getDefaultStyle() {
    return {
        // b. Batas SLS Tidak Terpilih
        color: currentColors.slsBorder, 
        weight: 1.5,
        opacity: 1,
        
        // a. Fill Geometri SLS Tidak Terpilih (Opacity 50%)
        fillColor: currentColors.slsFillNonSel,
        fillOpacity: 0.5,
        
        dashArray: null
    };
}


// ==========================================
// 4. Highlight Logic (Updated Colors)
// ==========================================

function resetLayerStyles() {
    // Refresh warna variable jaga-jaga user ganti tema saat ada seleksi
    updateColorState();
    
    geoJsonLayer.eachLayer(layer => {
        geoJsonLayer.resetStyle(layer); // Kembali ke getDefaultStyle
        layer.unbindTooltip(); 
    });
    map.fitBounds(geoJsonLayer.getBounds());
}

// A. Highlight SLS GROUP (Induk)
function highlightSlsGroup(slsCode, slsName) {
    updateColorState();

    const relatedLayers = [];
    geoJsonLayer.eachLayer(layer => {
        const p = layer.feature.properties;
        if (p.kdsls === slsCode && p.nmsls === slsName) {
            relatedLayers.push(layer);
        }
    });

    if (relatedLayers.length === 0) return;

    const groupFeatureGroup = L.featureGroup(relatedLayers);
    map.flyToBounds(groupFeatureGroup.getBounds(), { padding: [50, 50], duration: 1.2 });

    const hasMultipleSubs = relatedLayers.length > 1;

    geoJsonLayer.eachLayer(layer => {
        const p = layer.feature.properties;
        const isTarget = (p.kdsls === slsCode && p.nmsls === slsName);

        if (isTarget) {
            if (hasMultipleSubs) {
                // === SLS PUNYA SUB ===
                // e. Batas SUBSLS Tidak Terpilih (tapi dalam group SLS terpilih)
                layer.setStyle({
                    weight: 2,
                    color: currentColors.subSlsAccent, // SubSLS Border Color
                    dashArray: '5, 5', // Dashed
                    
                    // f. Fill SubSLS Sibling/Tidak Terpilih (Opacity 25%)
                    fillColor: currentColors.subSlsAccent,
                    fillOpacity: 0.25
                });

                // Tampilkan Label SubSLS
                if (p.subsls) {
                    layer.bindTooltip(p.subsls, {
                        permanent: true,
                        direction: 'center',
                        className: 'subsls-label' // Style CSS (Buffer & Font Size)
                    }).openTooltip();
                }

            } else {
                // === SLS TUNGGAL (Tidak punya sub) ===
                // c. Batas SLS Terpilih (Tambah ketebalan)
                layer.setStyle({
                    weight: 4, // Lebih tebal
                    color: currentColors.slsBorder,
                    dashArray: null,
                    fillOpacity: 0 // Bolong
                });
                layer.bringToFront();
            }
        } else {
            // === WILAYAH LAIN (BACKGROUND) ===
            // Kembali ke style default (a & b) tapi mungkin didimkan sedikit jika mau fokus
            // Untuk mematuhi request "Batas SLS Tidak Terpilih", kita pakai resetStyle saja untuk non-target
            // Tapi agar fokus, biasanya yang lain dibuat redup. 
            // Sesuai request: "Fill geometri sls tidak terpilih ... opacity 50%" (sudah default)
            
            // Kita biarkan default style (via resetStyle nanti) atau set manual:
            layer.setStyle({
                weight: 1,
                color: currentColors.slsBorder,
                fillColor: currentColors.slsFillNonSel,
                fillOpacity: 0.5,
                dashArray: null
            });
            layer.unbindTooltip();
        }
    });
}

// B. Highlight SubSLS Specific (Saat diklik atau dipilih dari Sub Filter)
function highlightSubSlsSpecific(targetLayer) {
    updateColorState();
    const props = targetLayer.feature.properties;
    
    map.flyToBounds(targetLayer.getBounds(), { padding: [50, 50], duration: 1 });
    
    geoJsonLayer.eachLayer(layer => {
        const p = layer.feature.properties;
        const isSibling = (p.kdsls === props.kdsls && p.nmsls === props.nmsls);
        
        if (layer === targetLayer) {
            // === d. Batas SUBSLS Terpilih ===
            layer.setStyle({
                weight: 4, // Tambah ketebalan
                color: currentColors.subSlsAccent,
                dashArray: '10, 5', // Dashed Line (lebih jelas)
                fillOpacity: 0 // No Fill
            });
            layer.bringToFront();
            layer.openPopup(); 
            
            // Label tetap muncul di yang dipilih
            if (p.subsls) {
                layer.bindTooltip(p.subsls, {
                    permanent: true, direction: 'center', className: 'subsls-label'
                }).openTooltip();
            }

        } else if (isSibling) {
            // === e & f. SubSLS Tetangga (Satu SLS Induk) ===
            layer.setStyle({
                weight: 2,
                color: currentColors.subSlsAccent, // Dashed Color
                dashArray: '5, 5',
                fillColor: currentColors.subSlsAccent, // Fill Color Sama
                fillOpacity: 0.25 // Opacity 25%
            });
            
            // Label juga muncul di tetangga agar terlihat konteksnya
            if (p.subsls) {
                layer.bindTooltip(p.subsls, {
                    permanent: true, direction: 'center', className: 'subsls-label'
                }).openTooltip();
            }

        } else {
            // Wilayah Lain -> Default Style
            layer.setStyle(getDefaultStyle());
            layer.unbindTooltip();
        }
    });
}

// ==========================================
// 5. DOM Elements & Filters (Tidak Berubah Banyak)
// ==========================================
const selectKecamatan = document.getElementById('filter-kecamatan');
const selectDesa = document.getElementById('filter-desa');
const selectSls = document.getElementById('filter-sls');
const selectSubSls = document.getElementById('filter-subsls');

function sortAndUnique(features, codeKey, nameKey) {
    const mapObj = new Map();
    features.forEach(f => {
        const code = f.properties[codeKey];
        const name = f.properties[nameKey];
        if (code && !mapObj.has(code)) mapObj.set(code, { code, name });
    });
    return Array.from(mapObj.values()).sort((a, b) => a.code.toString().localeCompare(b.code.toString()));
}

function populateFiltersKecamatan(data) {
    const sortedKec = sortAndUnique(data.features, 'kdkec', 'nmkec');
    selectKecamatan.innerHTML = '<option value="">Semua Kecamatan</option>';
    sortedKec.forEach(item => {
        const option = document.createElement('option');
        option.value = item.code;
        option.textContent = `[${item.code}] - ${item.name}`; 
        selectKecamatan.appendChild(option);
    });
}

selectKecamatan.addEventListener('change', function() {
    const kdkec = this.value;
    resetDropdown(selectDesa, 'Desa'); resetDropdown(selectSls, 'SLS'); resetDropdown(selectSubSls, 'Sub SLS');
    if (!kdkec) { applyMainFilter(); return; }
    const filtered = geoJsonData.features.filter(f => f.properties.kdkec === kdkec);
    const sorted = sortAndUnique(filtered, 'kddesa', 'nmdesa');
    sorted.forEach(item => {
        const opt = document.createElement('option'); opt.value = item.code; opt.textContent = `[${item.code}] - ${item.name}`; selectDesa.appendChild(opt);
    });
    selectDesa.disabled = false;
    applyMainFilter();
});

selectDesa.addEventListener('change', function() {
    const kddesa = this.value; const kdkec = selectKecamatan.value;
    resetDropdown(selectSls, 'SLS'); resetDropdown(selectSubSls, 'Sub SLS');
    if (!kddesa) { applyMainFilter(); return; }
    const filtered = geoJsonData.features.filter(f => f.properties.kdkec === kdkec && f.properties.kddesa === kddesa);
    const sorted = sortAndUnique(filtered, 'kdsls', 'nmsls');
    sorted.forEach(item => {
        const opt = document.createElement('option'); opt.value = item.code; opt.textContent = `[${item.code}] - ${item.name}`; opt.setAttribute('data-name', item.name); selectSls.appendChild(opt);
    });
    selectSls.disabled = false;
    applyMainFilter();
});

selectSls.addEventListener('change', function() {
    const kdsls = this.value; 
    const nmsls = this.options[this.selectedIndex].getAttribute('data-name');
    const kdkec = selectKecamatan.value; const kddesa = selectDesa.value;
    resetDropdown(selectSubSls, 'Sub SLS');
    
    if (!kdsls) { resetLayerStyles(); return; }

    const slsFeatures = geoJsonData.features.filter(f => f.properties.kdkec === kdkec && f.properties.kddesa === kddesa && f.properties.kdsls === kdsls);
    if (slsFeatures.length > 1) {
        const sortedSubs = slsFeatures.map(f => f.properties.subsls).sort().filter((v, i, a) => a.indexOf(v) === i);
        sortedSubs.forEach(subCode => {
            const opt = document.createElement('option'); opt.value = subCode; opt.textContent = `Sub: ${subCode}`; selectSubSls.appendChild(opt);
        });
        selectSubSls.disabled = false;
    }
    highlightSlsGroup(kdsls, nmsls);
});

selectSubSls.addEventListener('change', function() {
    const subCode = this.value;
    const kdsls = selectSls.value;
    const nmsls = selectSls.options[selectSls.selectedIndex].getAttribute('data-name');
    if(!subCode) { highlightSlsGroup(kdsls, nmsls); return; }
    const target = geoJsonLayer.getLayers().find(l => {
        const p = l.feature.properties; return p.kdsls === kdsls && p.nmsls === nmsls && p.subsls === subCode;
    });
    if (target) highlightSubSlsSpecific(target);
});

function resetDropdown(el, txt) { el.innerHTML = `<option value="">Semua ${txt}</option>`; el.disabled = true; }

function applyMainFilter() {
    const kdkec = selectKecamatan.value; const kddesa = selectDesa.value;
    const filtered = geoJsonData.features.filter(f => {
        const p = f.properties; return (!kdkec || p.kdkec === kdkec) && (!kddesa || p.kddesa === kddesa);
    });
    renderMap({ type: "FeatureCollection", features: filtered });
}

document.getElementById('btn-reset').addEventListener('click', () => {
    selectKecamatan.value = ""; resetDropdown(selectDesa, 'Desa'); resetDropdown(selectSls, 'SLS'); resetDropdown(selectSubSls, 'Sub SLS');
    renderMap(geoJsonData); resetLayerStyles();
});

document.getElementById('btn-search').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);
    if (isNaN(lat) || isNaN(lng)) { alert("Koordinat tidak valid"); return; }
    const found = findSlsByLocation(lat, lng, geoJsonData);
    if (searchMarker) map.removeLayer(searchMarker);
    
    let content = `<div style="color:red; font-weight:bold;">Lokasi Luar Wilayah</div>`;
    if (found) {
        const p = found.properties;
        content = `<div style="text-align:center; color:${currentColors.slsBorder}"><b>Desa ${p.nmdesa}</b><br>${p.nmsls} (Sub: ${p.subsls||'-'})</div>`;
        geoJsonLayer.eachLayer(l => {
            if (l.feature.properties.idsls === p.idsls && l.feature.properties.subsls === p.subsls) highlightSubSlsSpecific(l);
        });
    }
    searchMarker = L.marker([lat, lng]).addTo(map).bindPopup(content).openPopup();
    map.flyTo([lat, lng], 18);
});

function findSlsByLocation(lat, lng, data) {
    if (!data) return null; const pt = [lng, lat];
    for (const f of data.features) {
        const geom = f.geometry; if (!geom) continue;
        if (geom.type === 'Polygon' && isPtInPoly(pt, geom.coordinates)) return f;
        if (geom.type === 'MultiPolygon') { for (const p of geom.coordinates) if (isPtInPoly(pt, p)) return f; }
    }
    return null;
}
function isPtInPoly(pt, vs) {
    const x = pt[0], y = pt[1]; const ring = vs[0]; let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1]; const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
