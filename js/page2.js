/* ================================================================
   page2.js – Dashboard Ketenagakerjaan Jawa Tengah – Analisis Regional
   Major revision: Map sebagai filter wilayah, 2 tren chart terpisah,
   news section, insight template, radar explanation
   ================================================================ */

'use strict';

// ── FORMATTERS ──────────────────────────────────────────────────
const fRupiah = v => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v);
const fNum = v => new Intl.NumberFormat('id-ID').format(v);

// ── CHART.JS DEFAULTS ───────────────────────────────────────────
Chart.defaults.font.family = "'Poppins', sans-serif";
Chart.defaults.color = '#64748b';
Chart.register(ChartDataLabels);

// ── CLUSTER META ────────────────────────────────────────────────
const CLUSTER_META = {
  0: {
    label: 'Klaster 0 – Wilayah Maju',
    shortLabel: 'Wilayah Maju',
    color: '#1F3C88',
    bg: '#eff6ff',
    mapColor: '#1F3C88',
    desc: 'Wilayah dengan IPM tinggi, upah kompetitif, dan infrastruktur ketenagakerjaan matang.',
  },
  1: {
    label: 'Klaster 1 – Wilayah Berkembang',
    shortLabel: 'Wilayah Berkembang',
    color: '#F97316',
    bg: '#fff7ed',
    mapColor: '#F97316',
    desc: 'Wilayah dengan populasi besar, TPT relatif tinggi, dan upah menengah ke bawah.',
  },
  2: {
    label: 'Klaster 2 – Wilayah Produktif',
    shortLabel: 'Wilayah Produktif',
    color: '#3B82F6',
    bg: '#f0f9ff',
    mapColor: '#3B82F6',
    desc: 'Wilayah dengan TPAK tinggi, TPT rendah-sedang, dan pertumbuhan ekonomi positif.',
  },
};


// ── MUTABLE STATE ───────────────────────────────────────────────
const charts = { tpak: null, tpt: null, upah: null, pasar: null, radar: null };
let leafletMap = null;
let globalPage2 = null;
let selectedWilayah = 'Jawa Tengah';
let selectedLayer = null;   // currently highlighted Leaflet layer
let geojsonLayer = null;   // full L.geoJSON layer reference

/* ================================================================
   INIT
   ================================================================ */
function initDashboard() {
  // Hanya ambil data.json karena data klaster sudah ada di dalamnya
  fetch('data.json')
    .then(r => {
      if (!r.ok) throw new Error('Gagal mengambil data.json (HTTP ' + r.status + ')');
      return r.json();
    })
    .then(data => {
      globalPage2 = data.page2;
      buildLayout();
      renderAll(data.page2, 'Jawa Tengah');

      // Ambil data kluster langsung dari data.json untuk peta
      initMap(data.page2.kluster);
    })
    .catch(err => {
      document.getElementById('mainContent').innerHTML = `
      <div style="text-align:center;padding:5rem 2rem;color:#ef4444">
        <p style="font-size:1.2rem;font-weight:700">Gagal Memuat Data</p>
        <p style="margin-top:.6rem;color:#94a3b8;font-size:.88rem">${err.message}</p>
        <p style="margin-top:.4rem;color:#94a3b8;font-size:.8rem">
          Pastikan halaman dibuka melalui server lokal (bukan file://)
        </p>
      </div>`;
    });
}

/* ================================================================
   MAP SELECTION RESET  (called by inline onclick in HTML)
   ================================================================ */
function resetMapSelection() {
  selectedWilayah = 'Jawa Tengah';
  document.getElementById('selectedRegionBadge').textContent = 'Jawa Tengah (Provinsi)';
  document.getElementById('resetMapBtn').style.display = 'none';

  if (geojsonLayer) geojsonLayer.resetStyle();
  selectedLayer = null;

  if (leafletMap) leafletMap.flyTo([-7.15, 110.14], 8, { duration: 0.8 });
  renderAll(globalPage2, 'Jawa Tengah');
}

/* ================================================================
   BUILD LAYOUT
   ================================================================ */
function buildLayout() {
  document.getElementById('loadingSpinner').remove();


  document.getElementById('mainContent').innerHTML = `

    <!-- Row 0: Peta (filter) Full Width -->
    <div class="grid-full">
      <div class="card map-card" style="min-height:500px;">
        <div class="card-header" style="justify-content:center;flex-direction:column;gap:.5rem;align-items:center">
          <h3>Peta Klaster Produktivitas Kabupaten/Kota Jawa Tengah</h3>
          <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:center">
            <span id="selectedRegionBadge" class="region-badge">Jawa Tengah (Provinsi)</span>
            <button id="resetMapBtn" class="reset-map-btn" style="display:none"
                    onclick="resetMapSelection()">&#8592; Reset ke Jawa Tengah</button>
          </div>
        </div>
        <div id="mapCluster" style="height: 440px;"></div>
        <div class="map-legend">
          <span class="map-legend-title">Legenda:</span>
          <div class="map-legend-items" id="mapLegendItems"></div>
        </div>
      </div>
    </div>

    <!-- Row 0.5: Insight Full Width -->
    <div class="grid-full">
      <div class="insight-box" id="insightBox" style="margin-bottom: 1.5rem;">
        <div class="insight-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style="flex:1">
          <h3>Insight</h3>
          <p id="insightText" style="line-height:1.8;font-size:.87rem">Memuat insight...</p>
        </div>
      </div>
    </div>

    <!-- Row 1: TPAK + TPT terpisah -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3>Tren TPAK (2017–2025)</h3>
        </div>
        <div class="chart-wrap h-72"><canvas id="chartTPAK"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3>Tren TPT (2017–2025)</h3>
        </div>
        <div class="chart-wrap h-72"><canvas id="chartTPT"></canvas></div>
      </div>
    </div>

    <!-- Row 2: Upah + Pasar Kerja -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3>Perbandingan Upah Formal dan Informal</h3>
        </div>
        <div class="chart-wrap h-72"><canvas id="chartUpah"></canvas></div>
        <div id="upahStatBox" class="pasar-stat-box"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Proporsi Gender Pasar Kerja</h3>
          <div class="radio-group" id="radioGroup">
            <label><input type="radio" name="pasar" value="lowongan" id="r-lowongan" checked>Lowongan Kerja</label>
            <label><input type="radio" name="pasar" value="pencari"  id="r-pencari">Pencari Kerja</label>
          </div>
        </div>
        <div class="chart-wrap h-64"><canvas id="chartPasar"></canvas></div>
        <div id="pasarStatBox" class="pasar-stat-box"></div>
      </div>
    </div>

    <!-- Row 3: Radar Chart & Klaster (Hidden for unsupported regions) -->
    <div id="klasterAndRadarRegion" style="display: none;">
      <div class="grid-full">
        <div class="card">
          <div class="card-header" style="justify-content:center">
            <h3 style="font-size:1.05rem">Analisis Klaster Produktivitas</h3>
          </div>
          <div id="klasterContent">Memuat...</div>
        </div>
      </div>

      <div class="grid-full">
        <div class="card">
          <div class="card-header" style="justify-content:center">
            <h3>Profil Performa Wilayah terhadap Rata-rata Klaster</h3>
          </div>
          <p class="radar-description" style="text-align:justify;">
            Grafik di bawah ini memvisualisasikan performa 8 indikator ketenagakerjaan di wilayah terpilih 
            dibandingkan dengan kondisi rata-rata pada klaster yang sama. Nilai <strong>100%</strong> 
            merepresentasikan titik rata-rata klaster.&nbsp;
            <span style="color:#1F3C88;font-weight:600">&#9650; &ge;100%</span> menandakan performa di atas rata-rata (Biru), sedangkan&nbsp;
            <span style="color:#F97316;font-weight:600">&#9660; &lt;100%</span> menandakan di bawah rata-rata (Oranye).&nbsp;
          </p>
          <div style="display:flex;flex-direction:column;align-items:center;gap:1.5rem;">
            <div class="chart-wrap" style="width:100%; max-width:860px; height:650px;">
              <canvas id="chartRadar"></canvas>
            </div>
            <div id="radarLegend" style="width:100%"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Radio event for pasar chart
  document.querySelectorAll('input[name="pasar"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!globalPage2) return;
      const kab = globalPage2.kabupaten.find(k => k.nama === selectedWilayah);
      if (kab) renderChartPasar(kab, r.value);
    });
  });
}

/* ================================================================
   RENDER ALL
   ================================================================ */
function renderAll(page2, wilayah) {
  const trenItem = page2.tren.find(t => t.kabupaten === wilayah);
  const kabItem = page2.kabupaten.find(k => k.nama === wilayah);
  const klusterItem = page2.kluster.find(k => k.kabupaten === wilayah);

  if (!trenItem) { console.error('Data tren tidak ditemukan untuk:', wilayah); return; }
  if (!kabItem) { console.error('Data kabupaten tidak ditemukan untuk:', wilayah); return; }

  updateInsight(trenItem, kabItem, klusterItem, wilayah);
  renderChartTPAK(trenItem);
  renderChartTPT(trenItem);
  renderChartUpah(kabItem, wilayah, page2);

  const mode = document.querySelector('input[name="pasar"]:checked')?.value || 'lowongan';
  renderChartPasar(kabItem, mode);

  if (klusterItem) {
    document.getElementById('klasterAndRadarRegion').style.display = 'block';
    renderKlasterCard(klusterItem, page2.kluster);
    renderChartRadar(klusterItem, page2.kluster);
  } else {
    document.getElementById('klasterAndRadarRegion').style.display = 'none';
    if (charts.radar) { charts.radar.destroy(); charts.radar = null; }
  }
}

/* ================================================================
   INSIGHT  (template format)
   ================================================================ */
function updateInsight(tren, kab, kluster, wilayah) {
  const latest = tren.data[tren.data.length - 1];
  const earliest = tren.data[0];
  const tpakDelta = +(latest.tpak - earliest.tpak).toFixed(2);
  const tptDelta = +(latest.tpt - earliest.tpt).toFixed(2);
  const gapUpah = kab ? kab.upah.formal - kab.upah.informal : 0;

  const OG = 'color:#fb923c;font-weight:600';

  const tpakDir = tpakDelta >= 0
    ? `meningkat sebesar <strong style="${OG}">${Math.abs(tpakDelta)} persen</strong>`
    : `turun sebesar <strong style="${OG}">${Math.abs(tpakDelta)} persen</strong>`;

  const tptDir = tptDelta < 0
    ? `turun sebesar <strong style="${OG}">${Math.abs(tptDelta)} persen</strong>, yang merupakan tren positif`
    : `meningkat sebesar <strong style="${OG}">${tptDelta} persen</strong>, sehingga perlu mendapatkan perhatian`;

  const klInfo = kluster
    ? ` Berdasarkan analisis klaster, wilayah ini termasuk dalam <strong style="${OG}">${CLUSTER_META[kluster.cluster].label}</strong>, yaitu daerah ${CLUSTER_META[kluster.cluster].shortLabel.toLowerCase()}.`
    : '';

  document.getElementById('insightText').innerHTML =
    `Dalam kurun waktu 2017–2025, TPAK ${tpakDir}, sementara TPT ${tptDir}. ` +
    `Rata-rata upah di sektor formal (<strong style="${OG}">${fRupiah(kab?.upah?.formal || 0)}</strong>) ` +
    `lebih tinggi <strong style="${OG}">${fRupiah(gapUpah)}</strong> ` +
    `dibanding upah di sektor informal (<strong style="${OG}">${fRupiah(kab?.upah?.informal || 0)}</strong>).` +
    klInfo;
}

/* ================================================================
   CHART 1a – TREN TPAK
   ================================================================ */
function renderChartTPAK(trenItem) {
  if (charts.tpak) { charts.tpak.destroy(); charts.tpak = null; }
  const ctx = document.getElementById('chartTPAK').getContext('2d');
  charts.tpak = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trenItem.data.map(d => d.tahun),
      datasets: [{
        label: 'TPAK (%)',
        data: trenItem.data.map(d => d.tpak),
        borderColor: '#1F3C88',
        backgroundColor: 'rgba(31,60,136,.1)',
        pointBackgroundColor: '#1F3C88',
        pointRadius: 4, pointHoverRadius: 7,
        borderWidth: 2.5, fill: true, tension: .35,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        datalabels: { display: false },
        legend: { display: false },
        tooltip: { callbacks: { label: c => `TPAK: ${c.parsed.y}%` } },
      },
      scales: {
        y: {
          title: { display: true, text: 'TPAK (%)', color: '#1F3C88', font: { weight: '600' } },
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => parseFloat(v.toFixed(1)) + '%' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ================================================================
   CHART 1b – TREN TPT
   ================================================================ */
function renderChartTPT(trenItem) {
  if (charts.tpt) { charts.tpt.destroy(); charts.tpt = null; }
  const ctx = document.getElementById('chartTPT').getContext('2d');
  charts.tpt = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trenItem.data.map(d => d.tahun),
      datasets: [{
        label: 'TPT (%)',
        data: trenItem.data.map(d => d.tpt),
        borderColor: '#F97316',
        backgroundColor: 'rgba(249,115,22,.08)',
        pointBackgroundColor: '#F97316',
        pointRadius: 4, pointHoverRadius: 7,
        borderWidth: 2.5, fill: true, tension: .35,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        datalabels: { display: false },
        legend: { display: false },
        tooltip: { callbacks: { label: c => `TPT: ${c.parsed.y}%` } },
      },
      scales: {
        y: {
          title: { display: true, text: 'TPT (%)', color: '#F97316', font: { weight: '600' } },
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => parseFloat(v.toFixed(1)) + '%' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ================================================================
   CHART 2 – UPAH FORMAL vs INFORMAL (BAR)
   ================================================================ */
function renderChartUpah(kabItem, wilayah, page2) {
  if (charts.upah) { charts.upah.destroy(); charts.upah = null; }

  const formal = kabItem?.upah?.formal ?? 0;
  const informal = kabItem?.upah?.informal ?? 0;
  const provData = page2.kabupaten.find(k => k.nama === 'Jawa Tengah');
  const provFormal = provData?.upah?.formal ?? 0;
  const provInformal = provData?.upah?.informal ?? 0;
  const isProvince = (wilayah === 'Jawa Tengah');

  const upahStatBox = document.getElementById('upahStatBox');
  if (upahStatBox) {
    if (formal > 0 || informal > 0) {
      const diff = Math.abs(formal - informal);
      const dom = formal > informal ? 'Sektor Formal' : 'Sektor Informal';
      const domColor = formal > informal ? '#1F3C88' : '#F97316';

      upahStatBox.innerHTML = `
        <div class="pasar-stat-row">
          <span class="pasar-stat-badge" style="background:${domColor}20;color:${domColor}">
            ${dom} Tinggi
          </span>
          <span class="pasar-stat-text">
            Upah <strong style="color:${domColor}">${dom}</strong> lebih tinggi 
            <strong style="color:${domColor}">${fRupiah(diff)}</strong> 
            dibanding sektor lainnya.
          </span>
        </div>`;
    } else {
      upahStatBox.innerHTML = '';
    }
  }

  const radiusTop = { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 };

  const datasets = [
    {
      label: wilayah,
      data: [formal, informal],
      backgroundColor: ['#1F3C88', '#F97316'],
      borderRadius: radiusTop, borderSkipped: false,
    },
  ];
  if (!isProvince) {
    datasets.push({
      label: 'Jawa Tengah (Provinsi)',
      data: [provFormal, provInformal],
      backgroundColor: ['rgba(31,60,136,.28)', 'rgba(249,115,22,.28)'],
      borderRadius: radiusTop, borderSkipped: false,
    });
  }

  const ctx = document.getElementById('chartUpah').getContext('2d');
  charts.upah = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Formal', 'Informal'], datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        datalabels: { display: false },
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true, pointStyle: 'rectRounded',
            boxWidth: 14, boxHeight: 14, padding: 22,
            generateLabels: chart => {
              const ds = chart.data.datasets;
              const entries = [
                { text: `Formal – ${ds[0].label}`, fill: '#1F3C88', ds: 0 },
                { text: `Informal – ${ds[0].label}`, fill: '#F97316', ds: 0 },
              ];
              if (ds[1]) {
                entries.push(
                  { text: `Formal – ${ds[1].label}`, fill: 'rgba(31,60,136,.4)', ds: 1 },
                  { text: `Informal – ${ds[1].label}`, fill: 'rgba(249,115,22,.4)', ds: 1 },
                );
              }
              return entries.map(e => ({
                text: e.text, fillStyle: e.fill,
                strokeStyle: 'transparent', hidden: false, datasetIndex: e.ds,
              }));
            },
          },
        },
        tooltip: {
          callbacks: {
            label: c => {
              const jenis = ['Formal', 'Informal'][c.dataIndex];
              return `${c.dataset.label} – ${jenis}: ${fRupiah(c.raw)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => fRupiah(v) },
          grid: { color: '#f1f5f9' },
        },
        x: { grid: { display: false } },
      },
      layout: { padding: { bottom: 8 } },
    },
  });
}

/* ================================================================
   CHART 3 – PASAR KERJA (DOUGHNUT) + STAT BOX
   ================================================================ */
function renderChartPasar(kabItem, mode) {
  if (charts.pasar) { charts.pasar.destroy(); charts.pasar = null; }

  const lk = mode === 'lowongan'
    ? kabItem.lowongan_kerja.laki_laki : kabItem.pencari_kerja.laki_laki;
  const pr = mode === 'lowongan'
    ? kabItem.lowongan_kerja.perempuan : kabItem.pencari_kerja.perempuan;

  const total = lk + pr;
  const lkPct = lk / total * 100;
  const prPct = pr / total * 100;
  const diffPct = (Math.abs(lk - pr) / total * 100).toFixed(1);
  const dominant = lk > pr ? 'Laki-laki' : 'Perempuan';
  const minority = lk > pr ? 'Perempuan' : 'Laki-laki';
  const domColor = lk > pr ? '#1F3C88' : '#F97316';
  const modeLabel = mode === 'lowongan' ? 'Lowongan Kerja Terdaftar' : 'Pencari Kerja Terdaftar';

  const statBox = document.getElementById('pasarStatBox');
  if (statBox) {
    statBox.innerHTML = `
      <div class="pasar-stat-row">
        <span class="pasar-stat-badge" style="background:${domColor}20;color:${domColor}">
          ${dominant} Mendominasi
        </span>
        <span class="pasar-stat-text">
          <strong style="color:${domColor}">${dominant}</strong> lebih banyak
          <strong style="color:${domColor}">${diffPct}%</strong>
          dibanding ${minority}
          <span class="pasar-stat-detail">
            (${fNum(lk > pr ? lk : pr)} vs ${fNum(lk > pr ? pr : lk)} orang)
          </span>
        </span>
      </div>`;
  }

  const ctx = document.getElementById('chartPasar').getContext('2d');
  charts.pasar = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Laki-laki', 'Perempuan'],
      datasets: [{
        data: [lk, pr],
        backgroundColor: ['#1F3C88', '#F97316'],
        borderWidth: 0, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '50%',
      plugins: {
        datalabels: {
          color: '#fff', font: { weight: 'bold', size: 12 },
          formatter: v => `${(v / total * 100).toFixed(1)}%`,
        },
        title: {
          display: true, text: modeLabel,
          color: '#1e293b', font: { size: 12, weight: '600' }, padding: { bottom: 6 },
        },
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: c => `${fNum(c.raw)} orang` } },
      },
    },
  });
}

/* ================================================================
   KLASTER CARD
   ================================================================ */
function renderKlasterCard(klusterItem, allKluster) {
  const c = klusterItem.cluster;
  const meta = CLUSTER_META[c];
  const cd = klusterItem.cluster_data;
  const peers = allKluster.filter(k => k.cluster === c).map(k => k.kabupaten);

  document.getElementById('klasterContent').innerHTML = `
    <div class="cluster-banner" style="background:${meta.bg}">
      <div class="cluster-badge" style="background:${meta.color}">${c}</div>
      <div class="cluster-info">
        <h4 style="color:${meta.color}">${meta.label}</h4>
        <p>${meta.desc}</p>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-item">
        <div class="kpi-label">Penduduk</div>
        <div class="kpi-value">${fNum(cd.penduduk)}</div>
        <div class="kpi-sub">jiwa</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label" style="font-size: 0.55rem; font-weight: 700; line-height: 1.1;">Penduduk Bukan Angkatan Kerja</div>
        <div class="kpi-value">${fNum(cd.penduduk_bukan_bekerja)}</div>
        <div class="kpi-sub">jiwa</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">TPT</div>
        <div class="kpi-value" style="color:#F97316">${cd.tpt}%</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">TKK</div>
        <div class="kpi-value" style="color:#1F3C88">${cd.tkk}%</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">TPAK</div>
        <div class="kpi-value" style="color:#1F3C88">${cd.tpak}%</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">IPM</div>
        <div class="kpi-value">${cd.ipm}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label" style="font-size: 0.62rem;">Pengeluaran/Kapita</div>
        <div class="kpi-value" style="font-size:.78rem">${fRupiah(cd.pengeluaran_per_kapita)}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">Upah Rata-rata</div>
        <div class="kpi-value" style="font-size:.78rem">${fRupiah(cd.rata_upah)}</div>
      </div>
    </div>
    <p class="peers-title">Anggota Klaster:</p>
    <div class="radar-peers">
      ${peers.map(p =>
    `<span class="peer-chip ${p === klusterItem.kabupaten ? 'active' : ''}">${p}</span>`
  ).join('')}
    </div>`;
}

/* ================================================================
   CHART 4 – RADAR (enhanced explanation sidebar)
   ================================================================ */
function renderChartRadar(klusterItem, allKluster) {
  if (charts.radar) { charts.radar.destroy(); charts.radar = null; }

  const cd = klusterItem.cluster_data;
  const peers = allKluster.filter(k => k.cluster === klusterItem.cluster);

  const avg = {
    tpak: peers.reduce((s, k) => s + k.cluster_data.tpak, 0) / peers.length,
    tpt: peers.reduce((s, k) => s + k.cluster_data.tpt, 0) / peers.length,
    ipm: peers.reduce((s, k) => s + k.cluster_data.ipm, 0) / peers.length,
    pengeluaran: peers.reduce((s, k) => s + k.cluster_data.pengeluaran_per_kapita, 0) / peers.length,
    upah: peers.reduce((s, k) => s + k.cluster_data.rata_upah, 0) / peers.length,
    penduduk: peers.reduce((s, k) => s + k.cluster_data.penduduk, 0) / peers.length,
    pbb: peers.reduce((s, k) => s + k.cluster_data.penduduk_bukan_bekerja, 0) / peers.length,
    tkk: peers.reduce((s, k) => s + k.cluster_data.tkk, 0) / peers.length,
  };

  const norm = (val, a) => Math.min(Math.round(val / a * 100), 150);

  const values = [
    norm(cd.penduduk, avg.penduduk),
    norm(cd.penduduk_bukan_bekerja, avg.pbb),
    norm(cd.tpt, avg.tpt),
    norm(cd.tkk, avg.tkk),
    norm(cd.tpak, avg.tpak),
    norm(cd.ipm, avg.ipm),
    norm(cd.pengeluaran_per_kapita, avg.pengeluaran),
    norm(cd.rata_upah, avg.upah),
  ];

  const ctx = document.getElementById('chartRadar').getContext('2d');
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: [
        'Penduduk\n(Populasi)',
        'Bukan Angkatan\nKerja',
        'TPT\n(Pengangguran)',
        'TKK\n(Kesempatan\nKerja)',
        'TPAK\n(Partisipasi\nAngkatan Kerja)',
        'IPM\n(Indeks\nPembangunan)',
        'Pengeluaran\nPer Kapita',
        'Upah\nRata-rata'
      ],
      datasets: [
        {
          label: ' ' + klusterItem.kabupaten,
          data: values,
          borderColor: '#1F3C88',
          backgroundColor: 'rgba(31,60,136,.15)',
          pointBackgroundColor: '#1F3C88',
          borderWidth: 2.5, pointRadius: 5,
        },
        {
          label: ' Rata-rata Klaster (100%)',
          data: [100, 100, 100, 100, 100, 100, 100, 100],
          borderColor: '#94A3B8',
          backgroundColor: 'rgba(148,163,184,.08)',
          pointBackgroundColor: '#94A3B8',
          borderWidth: 1.5, borderDash: [5, 4], pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10, padding: 25 } },
        tooltip: {
          callbacks: {
            label: c => {
              const label = c.dataset.label;
              const score = c.raw;
              const status = score >= 100 ? '▲ di atas rata-rata klaster' : '▼ di bawah rata-rata klaster';
              return `${label}: ${score}% (${status})`;
            },
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 150,
          ticks: { stepSize: 50, callback: v => v + '%' },
          pointLabels: { font: { size: 10, weight: '600' }, color: '#475569' },
          grid: { color: '#e2e8f0' },
          angleLines: { color: '#e2e8f0' },
        },
      },
    },
  });

  // ── Enhanced sidebar ──
  const RADAR_DIMS = [
    {
      label: 'Penduduk',
      fullLabel: 'Jumlah Penduduk',
      value: (cd.penduduk >= 1000000 ? parseFloat((cd.penduduk / 1000000).toFixed(2)) + ' Juta' : fNum(cd.penduduk)),
      avg: (avg.penduduk >= 1000000 ? parseFloat((avg.penduduk / 1000000).toFixed(2)) + ' Juta' : fNum(Math.round(avg.penduduk))),
      score: values[0],
      color: '#1F3C88',
      desc: 'Total populasi penduduk di wilayah ini.',
      invertGoodBad: false,
    },
    {
      label: 'Bukan Angkatan Kerja',
      fullLabel: 'Penduduk Bukan Angkatan Kerja',
      value: (cd.penduduk_bukan_bekerja >= 1000000 ? parseFloat((cd.penduduk_bukan_bekerja / 1000000).toFixed(2)) + ' Juta' : fNum(cd.penduduk_bukan_bekerja)),
      avg: (avg.pbb >= 1000000 ? parseFloat((avg.pbb / 1000000).toFixed(2)) + ' Juta' : fNum(Math.round(avg.pbb))),
      score: values[1],
      color: '#475569',
      desc: 'Jumlah penduduk usia kerja yang tidak masuk dalam angkatan kerja.',
      invertGoodBad: true,
    },
    {
      label: 'TPT',
      fullLabel: 'Tingkat Pengangguran Terbuka',
      value: cd.tpt + '%',
      avg: avg.tpt.toFixed(2) + '%',
      score: values[2],
      color: '#F97316',
      desc: 'Persentase pengangguran murni terhadap total angkatan kerja.',
      invertGoodBad: true,
    },
    {
      label: 'TKK',
      fullLabel: 'Tingkat Kesempatan Kerja',
      value: cd.tkk + '%',
      avg: avg.tkk.toFixed(2) + '%',
      score: values[3],
      color: '#1F3C88',
      desc: 'Persentase angkatan kerja yang terserap di pasar kerja.',
      invertGoodBad: false,
    },
    {
      label: 'TPAK',
      fullLabel: 'Partisipasi Angkatan Kerja',
      value: cd.tpak + '%',
      avg: avg.tpak.toFixed(2) + '%',
      score: values[4],
      color: '#1F3C88',
      desc: 'Persen penduduk usia kerja yang aktif bekerja atau mencari kerja.',
      invertGoodBad: false,
    },
    {
      label: 'IPM',
      fullLabel: 'Indeks Pembangunan Manusia',
      value: String(cd.ipm),
      avg: avg.ipm.toFixed(2),
      score: values[5],
      color: '#3B82F6',
      desc: 'Indeks komposit: harapan hidup, pendidikan, dan standar hidup.',
      invertGoodBad: false,
    },
    {
      label: 'Pengeluaran/Kapita',
      fullLabel: 'Daya Beli Masyarakat',
      value: fRupiah(cd.pengeluaran_per_kapita),
      avg: fRupiah(Math.round(avg.pengeluaran)),
      score: values[6],
      color: '#1F3C88',
      desc: 'Rata-rata pengeluaran per kapita per tahun – proksi daya beli.',
      invertGoodBad: false,
    },
    {
      label: 'Upah Rata-rata',
      fullLabel: 'Tingkat Upah Wilayah',
      value: fRupiah(cd.rata_upah),
      avg: fRupiah(Math.round(avg.upah)),
      score: values[7],
      color: '#F97316',
      desc: 'Rata-rata upah seluruh sektor (formal + informal) di wilayah ini.',
      invertGoodBad: false,
    },
  ];

  document.getElementById('radarLegend').innerHTML = `
    <p style="font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;
              letter-spacing:.08em;margin-bottom:1rem;text-align:center;">
      Detail Performa – ${klusterItem.kabupaten}
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1rem;">
      ${RADAR_DIMS.map(d => {
    const above = d.score >= 100;
    let badgeColor, badgeBg, badgeText;
    if (above) {
      badgeText = '▲ Di atas rata-rata';
      badgeColor = '#1F3C88';
      badgeBg = '#eff6ff';
    } else {
      badgeText = '▼ Di bawah rata-rata';
      badgeColor = '#F97316';
      badgeBg = '#fff7ed';
    }

    const badge = `<span style="background:${badgeBg};color:${badgeColor};font-size:.67rem;padding:.12rem .4rem;border-radius:99px;font-weight:700;white-space:nowrap">${badgeText}</span>`;
    const bar = `
          <div style="margin:.3rem 0;background:#e2e8f0;border-radius:4px;height:5px;overflow:hidden">
            <div style="height:100%;width:${Math.min(d.score, 150) / 1.5}%;
                        background:${badgeColor};border-radius:4px;
                        transition:width .5s ease"></div>
          </div>`;
    return `
          <div style="padding:.7rem .9rem;border-radius:.65rem;margin-bottom:0;
                      background:#f8fafc;border:1px solid #e2e8f0;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.4rem">
                <div>
                  <div style="font-size:.82rem;color:#1e293b;font-weight:700">${d.label}</div>
                  <div style="font-size:.72rem;color:#94a3b8">${d.fullLabel}</div>
                </div>
                <span style="font-size:.9rem;font-weight:700;color:${d.color};white-space:nowrap">${d.value}</span>
              </div>
              ${bar}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.25rem">
                <span style="font-size:.7rem;color:#94a3b8">Rata-rata: ${d.avg} &nbsp;|&nbsp; Skor: ${d.score}%</span>
                ${badge}
              </div>
            </div>
            <div style="font-size:.7rem;color:#94a3b8;margin-top:.6rem;line-height:1.4;font-style:italic">${d.desc}</div>
          </div>`;
  }).join('')}
    </div>`;
}

/* ================================================================
   MAP – CHOROPLETH + CLICK FILTER (Leaflet.js)
   ================================================================ */
function initMap(klusterData) {
  const clusterLookup = {};
  klusterData.forEach(k => {
    clusterLookup[k.kabupaten.toLowerCase()] = k;
  });

  leafletMap = L.map('mapCluster', {
    center: [-7.15, 110.14], zoom: 8,
    zoomControl: true, scrollWheelZoom: false, maxZoom: 12,
  });

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
        ' &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 12,
    }
  ).addTo(leafletMap);

  fetch('jateng.geojson')
    .then(r => { if (!r.ok) throw new Error('GeoJSON tidak tersedia'); return r.json(); })
    .then(geojson => renderChoropleth(geojson, klusterData, clusterLookup))
    .catch(() => showMapPlaceholder());

  renderMapLegend();
}

/* ── Name matching helpers ──────────────────────────────── */
function normName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/^kab\.\s*/i, '').replace(/^kabupaten\s*/i, '').trim();
}

function canonicalName(feature) {
  const raw = feature.properties.NAME_2 || feature.properties.KABKOT ||
    feature.properties.NAMOBJ || feature.properties.name ||
    feature.properties.NAME || '';
  const type = (feature.properties.TYPE_2 || '').toLowerCase();
  return (type === 'kota' && !raw.toLowerCase().startsWith('kota ')) ? 'Kota ' + raw : raw;
}

function findCluster(feature, lookup) {
  const canon = canonicalName(feature);
  const lo = canon.toLowerCase();
  if (lookup[lo]) return lookup[lo];
  const n = normName(canon);
  for (const [key, val] of Object.entries(lookup)) {
    if (normName(key) === n) return val;
  }
  for (const [key, val] of Object.entries(lookup)) {
    const k = normName(key);
    if (k === n || k.includes(n) || n.includes(k)) return val;
  }
  return null;
}

/* ── Render choropleth with click interactivity ────────── */
function renderChoropleth(geojson, klusterData, clusterLookup) {
  geojsonLayer = L.geoJSON(geojson, {
    style: feature => {
      const item = findCluster(feature, clusterLookup);
      const color = item != null ? CLUSTER_META[item.cluster].mapColor : '#d1d5db';
      return { fillColor: color, fillOpacity: 0.72, color: '#ffffff', weight: 1.5, opacity: 1 };
    },

    onEachFeature: (feature, layer) => {
      const displayName = canonicalName(feature);
      const item = findCluster(feature, clusterLookup);
      const cd = item?.cluster_data;
      const meta = item ? CLUSTER_META[item.cluster] : null;

      const tip = `
        <div style="font-family:'Poppins',sans-serif;min-width:260px;padding:2px">
          <div style="font-weight:700;color:#1F3C88;font-size:.9rem;margin-bottom:2px">${displayName}</div>
          ${meta
          ? `<div style="font-size:.72rem;color:${meta.color};font-weight:600;margin-bottom:6px">${meta.label}</div>
               <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:0.73rem;color:#475569">
                 <div>Penduduk: <strong style="color:#1e293b">${cd.penduduk >= 1000000 ? parseFloat((cd.penduduk / 1000000).toFixed(2)) + 'jt' : fNum(cd.penduduk)}</strong></div>
                 <div>Pn. Bkn Bekerja: <strong style="color:#1e293b">${cd.penduduk_bukan_bekerja >= 1000000 ? parseFloat((cd.penduduk_bukan_bekerja / 1000000).toFixed(2)) + 'jt' : fNum(cd.penduduk_bukan_bekerja)}</strong></div>
                 <div>TPT: <strong style="color:#F97316">${cd.tpt}%</strong></div>
                 <div>TKK: <strong style="color:#1F3C88">${cd.tkk}%</strong></div>
                 <div>TPAK: <strong style="color:#1F3C88">${cd.tpak}%</strong></div>
                 <div>IPM: <strong style="color:#1e293b">${cd.ipm}</strong></div>
                 <div>Pengeluaran: <strong style="color:#1e293b">Rp${parseFloat((cd.pengeluaran_per_kapita / 1000000).toFixed(1))}jt</strong></div>
                 <div>Upah: <strong style="color:#1e293b">Rp${parseFloat((cd.rata_upah / 1000000).toFixed(2))}jt</strong></div>
               </div>
               <hr style="margin:8px 0;border:0;border-top:1px solid #e2e8f0;">`
          : `<div style="font-size:.75rem;color:#94a3b8">Tidak terklasifikasi</div>`}
          <div style="font-size:0.7rem;color:#94a3b8;font-style:italic">
             &#128070; Klik untuk analisis detail
          </div>
        </div>`;

      layer.bindTooltip(tip, { sticky: true, direction: 'top', opacity: 1 });

      layer.on({
        mouseover: e => {
          if (e.target !== selectedLayer) e.target.setStyle({ weight: 2.5, fillOpacity: 0.92 });
        },
        mouseout: e => {
          if (e.target !== selectedLayer) geojsonLayer.resetStyle(e.target);
        },
        click: e => {
          if (!item) return;   // skip water bodies

          // Reset previous selection
          if (selectedLayer && selectedLayer !== e.target) geojsonLayer.resetStyle(selectedLayer);

          // Highlight selected polygon
          e.target.setStyle({ weight: 3.5, color: '#1e293b', fillOpacity: 0.95 });
          e.target.bringToFront();
          selectedLayer = e.target;
          selectedWilayah = displayName;

          // Update badge & reset button
          document.getElementById('selectedRegionBadge').textContent = displayName;
          document.getElementById('resetMapBtn').style.display = 'inline-flex';

          // Fly to region
          leafletMap.flyToBounds(layer.getBounds(), { maxZoom: 11, padding: [36, 36], duration: 0.9 });

          // Update all charts
          renderAll(globalPage2, displayName);
        },
      });
    },
  }).addTo(leafletMap);

  leafletMap.fitBounds(geojsonLayer.getBounds(), { padding: [16, 16] });
}

function renderMapLegend() {
  const c = document.getElementById('mapLegendItems');
  if (!c) return;
  c.innerHTML = Object.values(CLUSTER_META).map(m => `
    <div class="map-legend-item">
      <span class="map-legend-dot" style="background:${m.mapColor}"></span>
      <span>${m.label}</span>
    </div>`).join('') + `
    <div class="map-legend-item">
      <span class="map-legend-dot" style="background:#d1d5db"></span>
      <span>Tidak terklasifikasi</span>
    </div>`;
}

function showMapPlaceholder() {
  document.getElementById('mapCluster').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:350px;color:#94a3b8;text-align:center;padding:2rem">
      <svg width="52" height="52" fill="none" stroke="#cbd5e1" stroke-width="1.4"
           viewBox="0 0 24 24" style="margin-bottom:1rem">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m6 3l-5.447-2.724A1 1 0 0115 3.618v10.764a1 1 0 01-.553.894L9 18m6-14v13"/>
      </svg>
      <p style="font-weight:600;color:#475569;margin-bottom:.4rem">GeoJSON Belum Tersedia</p>
      <p style="font-size:.82rem">Pastikan <code>jateng.geojson</code> ada di root proyek.</p>
    </div>`;
}

/* ================================================================
   AUTO-START
   ================================================================ */
document.addEventListener('DOMContentLoaded', initDashboard);
