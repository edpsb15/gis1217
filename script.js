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

// Style Default (Saat belum ada yang dipilih)
const defaultStyle = {
    color: "#ff7800", // Warna garis oranye
    weight: 2,        // Tebal garis normal
    opacity: 1,
    fillOpacity: 0.1, // Transparansi isi (agar satelit terlihat dikit)
    fillColor: null   // Ikuti default atau kosong
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
            // Popup info
            const props = feature.properties;
            const popupContent = `
                <b>Kecamatan:</b> ${props.nmkec}<br>
                <b>Desa:</b> ${props.nmdesa}<br>
                <b>SLS:</b> ${props.nmsls}<br>
                <b>ID SLS:</b> ${props.idsls}
            `;
            layer.bindPopup(popupContent);

            // Event Klik pada Wilayah
            layer.on('click', function(e) {
                // 1. Update Dropdown SLS agar sesuai dengan yg diklik
                // Pastikan dropdown Desa/Kecamatan sudah sesuai konteks (ini otomatis jika filter aktif)
                // Jika user klik bebas tanpa filter, kita set dropdown value jika ada opsinya
                
                if (!selectSls.disabled) {
                    selectSls.value = props.nmsls;
                }
                
                // 2. Jalankan Logika Highlight & Zoom
                highlightAndZoom(layer);
                
                // Hentikan peta dari zoom double-click jika ada
                L.DomEvent.stopPropagation(e);
            });
        }
    }).addTo(map);

    // Zoom fit ke seluruh data yang ada
    if (geoJsonLayer.getLayers().length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
    
    countDisplay.innerText = data.features.length;
}

// 5. Fungsi Logika Highlight & Zoom (Inti Permintaan Anda)
function highlightAndZoom(targetLayer) {
    // A. Animasi Zoom (Fly To)
    map.flyToBounds(targetLayer.getBounds(), {
        padding: [50, 50],
        duration: 1.5 // Durasi animasi dalam detik
    });

    // B. Styling (Loop semua layer yang sedang tampil)
    geoJsonLayer.eachLayer(function(layer) {
        if (layer === targetLayer) {
            // === SLS TERPILIH ===
            layer.setStyle({
                weight: 4,           // Garis dipertebal
                color: '#ff7800',    // Tetap oranye (atau warna lain jika mau)
                fillOpacity: 0       // Tidak ada fill (transparan total)
            });
            layer.bringToFront();    // Pastikan garisnya di atas layer lain
            layer.openPopup();       // Buka popup info
        } else {
            // === SLS TIDAK TERPILIH ===
            layer.setStyle({
                weight: 1,           // Garis tipis
                color: '#ff7800',
                fillColor: 'gray',   // Isi warna abu-abu
                fillOpacity: 0.25    // Opacity 25%
            });
        }
    });
}

// Fungsi Reset Style (Kembali ke awal)
function resetLayerStyles() {
    geoJsonLayer.eachLayer(function(layer) {
        geoJsonLayer.resetStyle(layer); // Kembali ke defaultStyle
    });
    // Kembalikan view ke seluruh wilayah
    map.fitBounds(geoJsonLayer.getBounds());
}


// 6. Logika Filter
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

// Event Listener: Kecamatan
selectKecamatan.addEventListener('change', function() {
    const selectedKec = this.value;
    
    // Reset bawahannya
    selectDesa.innerHTML = '<option value="">Semua Desa</option>';
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectDesa.disabled = !selectedKec;
    selectSls.disabled = true;

    if (!selectedKec) {
        applyFilterData(); 
        return;
    }

    // Isi Dropdown Desa
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

// Event Listener: Desa
selectDesa.addEventListener('change', function() {
    const selectedDesa = this.value;
    
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectSls.disabled = !selectedDesa;

    if (!selectedDesa) {
        applyFilterData();
        return;
    }

    // Isi Dropdown SLS
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

// Event Listener: SLS (Saat user memilih SLS dari dropdown)
selectSls.addEventListener('change', function() {
    const selectedSlsName = this.value;

    if (!selectedSlsName) {
        // Jika pilih "Semua SLS", reset style dan zoom out
        resetLayerStyles();
    } else {
        // Cari layer yang sesuai dengan nama SLS yang dipilih
        let foundLayer = null;
        geoJsonLayer.eachLayer(layer => {
            if (layer.feature.properties.nmsls === selectedSlsName) {
                foundLayer = layer;
            }
        });

        if (foundLayer) {
            highlightAndZoom(foundLayer);
        }
    }
});

// Fungsi Utama Filter Data (Hanya Filter Wilayah Besar: Kec/Desa)
// CATATAN: Kita TIDAK memfilter SLS di sini agar "Sisa SLS" tetap terlihat (untuk didimkan)
function applyFilterData() {
    const kecVal = selectKecamatan.value;
    const desaVal = selectDesa.value;

    // Filter GeoJSON hanya sampai level DESA
    // Agar saat memilih SLS, teman-teman satu desanya masih ada (untuk jadi background abu-abu)
    const filteredFeatures = geoJsonData.features.filter(f => {
        const p = f.properties;
        return (!kecVal || p.nmkec === kecVal) &&
               (!desaVal || p.nmdesa === desaVal);
    });

    const filteredData = {
        type: "FeatureCollection",
        features: filteredFeatures
    };

    renderMap(filteredData);
}

// Reset Button
document.getElementById('btn-reset').addEventListener('click', () => {
    selectKecamatan.value = "";
    selectDesa.innerHTML = '<option value="">Semua Desa</option>';
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectDesa.disabled = true;
    selectSls.disabled = true;
    
    // Render ulang semua data
    renderMap(geoJsonData);
});

// Search Lat Long (Sama seperti sebelumnya)
document.getElementById('btn-search').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);

    if (isNaN(lat) || isNaN(lng)) return;

    if (searchMarker) map.removeLayer(searchMarker);
    searchMarker = L.marker([lat, lng]).addTo(map).bindPopup(`Lokasi: ${lat}, ${lng}`).openPopup();
    map.flyTo([lat, lng], 18);
});
