// 1. Inisialisasi Peta
// Koordinat awal diset ke area Samosir (berdasarkan data Anda)
var map = L.map('map').setView([2.6, 98.7], 11);

// 2. Tambahkan Layer Satelit (Esri World Imagery)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}).addTo(map);

// Variabel Global untuk menyimpan data
var geoJsonData = null;
var geoJsonLayer = null;
var searchMarker = null;

// Elemen DOM
const selectKecamatan = document.getElementById('filter-kecamatan');
const selectDesa = document.getElementById('filter-desa');
const selectSls = document.getElementById('filter-sls');
const countDisplay = document.getElementById('count-display');

// 3. Fungsi Load GeoJSON
fetch('peta_sls_2025.geojson')
    .then(response => response.json())
    .then(data => {
        geoJsonData = data;
        populateFilters(data); // Isi dropdown filter
        renderMap(data);       // Tampilkan peta awal
    })
    .catch(error => console.error('Error loading GeoJSON:', error));

// 4. Fungsi Render Peta
function renderMap(data) {
    // Hapus layer lama jika ada
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
    }

    // Buat layer baru dari data yang sudah difilter
    geoJsonLayer = L.geoJSON(data, {
        style: function(feature) {
            return {
                color: "#ff7800", // Warna garis batas
                weight: 2,
                opacity: 1,
                fillOpacity: 0.1  // Transparansi isi (agar satelit terlihat)
            };
        },
        onEachFeature: function(feature, layer) {
            // Popup info saat wilayah diklik
            const props = feature.properties;
            const popupContent = `
                <b>Kecamatan:</b> ${props.nmkec}<br>
                <b>Desa:</b> ${props.nmdesa}<br>
                <b>SLS:</b> ${props.nmsls}<br>
                <b>ID SLS:</b> ${props.idsls}
            `;
            layer.bindPopup(popupContent);
        }
    }).addTo(map);

    // Zoom peta agar pas dengan seluruh wilayah yang ditampilkan
    if (geoJsonLayer.getLayers().length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
    
    // Update jumlah data
    countDisplay.innerText = data.features.length;
}

// 5. Logika Filter (Populasi Dropdown)
function populateFilters(data) {
    const features = data.features;
    const kecamatans = new Set();

    features.forEach(f => {
        if(f.properties.nmkec) kecamatans.add(f.properties.nmkec);
    });

    // Urutkan dan masukkan ke dropdown Kecamatan
    Array.from(kecamatans).sort().forEach(kec => {
        const option = document.createElement('option');
        option.value = kec;
        option.textContent = kec;
        selectKecamatan.appendChild(option);
    });
}

// Event Listener: Saat Kecamatan Berubah
selectKecamatan.addEventListener('change', function() {
    const selectedKec = this.value;
    
    // Reset dropdown Desa dan SLS
    selectDesa.innerHTML = '<option value="">Semua Desa</option>';
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectDesa.disabled = !selectedKec;
    selectSls.disabled = true;

    if (!selectedKec) {
        renderMap(geoJsonData); // Tampilkan semua jika reset
        return;
    }

    // Filter data untuk Desa
    const filteredFeatures = geoJsonData.features.filter(f => f.properties.nmkec === selectedKec);
    const desas = new Set(filteredFeatures.map(f => f.properties.nmdesa));

    Array.from(desas).sort().forEach(desa => {
        const option = document.createElement('option');
        option.value = desa;
        option.textContent = desa;
        selectDesa.appendChild(option);
    });

    applyFilter();
});

// Event Listener: Saat Desa Berubah
selectDesa.addEventListener('change', function() {
    const selectedDesa = this.value;
    
    // Reset SLS
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectSls.disabled = !selectedDesa;

    if (!selectedDesa) {
        applyFilter();
        return;
    }

    // Filter data untuk SLS
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

    applyFilter();
});

// Event Listener: Saat SLS Berubah
selectSls.addEventListener('change', applyFilter);

// Fungsi Utama Filter
function applyFilter() {
    const kecVal = selectKecamatan.value;
    const desaVal = selectDesa.value;
    const slsVal = selectSls.value;

    const filteredFeatures = geoJsonData.features.filter(f => {
        const p = f.properties;
        return (!kecVal || p.nmkec === kecVal) &&
               (!desaVal || p.nmdesa === desaVal) &&
               (!slsVal || p.nmsls === slsVal);
    });

    const filteredData = {
        type: "FeatureCollection",
        features: filteredFeatures
    };

    renderMap(filteredData);
}

// Tombol Reset
document.getElementById('btn-reset').addEventListener('click', () => {
    selectKecamatan.value = "";
    selectDesa.innerHTML = '<option value="">Semua Desa</option>';
    selectSls.innerHTML = '<option value="">Semua SLS</option>';
    selectDesa.disabled = true;
    selectSls.disabled = true;
    renderMap(geoJsonData);
});

// 6. Fitur Pencarian Latitude & Longitude
document.getElementById('btn-search').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);

    if (isNaN(lat) || isNaN(lng)) {
        alert("Masukkan koordinat Latitude dan Longitude yang valid.");
        return;
    }

    // Hapus marker pencarian sebelumnya
    if (searchMarker) {
        map.removeLayer(searchMarker);
    }

    // Tambah marker baru
    searchMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>Lokasi Dicari</b><br>Lat: ${lat}<br>Lng: ${lng}`)
        .openPopup();

    // Pan & Zoom ke lokasi
    map.setView([lat, lng], 18); // Zoom level 18 (sangat dekat)
});
