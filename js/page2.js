/* ================================================================
   page2.js – Dashboard Ketenagakerjaan Jawa Tengah – Analisis Regional
   ================================================================ */

'use strict';

// ── FORMATTERS ──────────────────────────────────────────────────
// Rp1.000 (tanpa spasi setelah Rp)
const fRupiah = v => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v);
const fNum    = v => new Intl.NumberFormat('id-ID').format(v);

// ── CHART.JS DEFAULTS ───────────────────────────────────────────
Chart.defaults.font.family = "'Poppins', sans-serif";
Chart.defaults.color       = '#64748b';
Chart.register(ChartDataLabels);

// ── CLUSTER META ────────────────────────────────────────────────
const CLUSTER_META = {
  0: {
    label:    'Klaster 0 – Kota Maju',
    color:    '#1F3C88',
    bg:       '#eff6ff',
    mapColor: '#1F3C88',
    desc:     'Kota dengan IPM tinggi, upah kompetitif, dan infrastruktur ketenagakerjaan matang.',
  },
  1: {
    label:    'Klaster 1 – Kabupaten Berkembang',
    color:    '#F97316',
    bg:       '#fff7ed',
    mapColor: '#F97316',
    desc:     'Kabupaten dengan populasi besar, TPT relatif tinggi, dan upah menengah ke bawah.',
  },
  2: {
    label:    'Klaster 2 – Kabupaten Produktif',
    color:    '#3B82F6',
    bg:       '#f0f9ff',
    mapColor: '#3B82F6',
    desc:     'Kabupaten dengan TPAK tinggi, TPT rendah-sedang, dan pertumbuhan ekonomi positif.',
  },
};

// ── MUTABLE STATE ───────────────────────────────────────────────
const charts = { tren: null, upah: null, pasar: null, radar: null };
let   leafletMap = null;
let   globalPage2 = null;

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

    populateDropdown(data.page2);
    buildLayout();
    renderAll(data.page2, 'Jawa Tengah');
    
    // Ambil data kluster langsung dari data.json untuk peta
    initMap(data.page2.kluster);

    document.getElementById('filterWilayah').addEventListener('change', function () {
      renderAll(globalPage2, this.value);
    });
  })
  .catch(err => {
    document.getElementById('mainContent').innerHTML = `
      <div style="text-align:center;padding:5rem 2rem;color:#ef4444">
        <p style="font-size:1.2rem;font-weight:700">Gagal Memuat Data</p>
        <p style="margin-top:.6rem;color:#94a3b8;font-size:.88rem">${err.message}</p>
        <p style="margin-top:.4rem;color:#94a3b8;font-size:.8rem">Pastikan halaman dibuka melalui server lokal (bukan file://)</p>
      </div>`;
  });
}

/* ================================================================
   DROPDOWN
   ================================================================ */
function populateDropdown(page2) {
  const sel = document.getElementById('filterWilayah');
  page2.tren.forEach(t => {
    const opt       = document.createElement('option');
    opt.value       = t.kabupaten;
    opt.textContent = t.kabupaten;
    if (t.kabupaten === 'Jawa Tengah') opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ================================================================
   LAYOUT SCAFFOLD
   ================================================================ */
function buildLayout() {
  document.getElementById('loadingSpinner').remove();

  document.getElementById('mainContent').innerHTML = `

    <!-- Insight -->
    <div class="insight-box" id="insightBox">
      <div class="insight-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div><h3>Insight Otomatis</h3><p id="insightText">Memuat insight...</p></div>
    </div>

    <!-- Row 1: Tren (radio TPAK/TPT) + Upah -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>Tren Ketenagakerjaan (2017–2025)</h3>
          <div class="radio-group" id="trenRadioGroup">
            <label><input type="radio" name="tren" value="tpak" id="r-tpak" checked>TPAK</label>
            <label><input type="radio" name="tren" value="tpt"  id="r-tpt">TPT</label>
          </div>
        </div>
        <div class="chart-wrap h-72"><canvas id="chartTren"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3>Perbandingan Upah Formal dan Informal</h3>
        </div>
        <div class="chart-wrap h-72"><canvas id="chartUpah"></canvas></div>
      </div>
    </div>

    <!-- Row 2: Pasar Kerja + Klaster -->
    <div class="grid-2">
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

      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3 style="font-size:1.05rem">Analisis Klaster Produktivitas</h3>
        </div>
        <div id="klasterContent">Memuat...</div>
      </div>
    </div>

    <!-- Row 3: Radar -->
    <div class="grid-full">
      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3>Profil Performa Wilayah terhadap Rata-rata Klaster</h3>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:2rem;align-items:stretch">
          <div class="chart-wrap h-96" style="flex:1;min-width:260px"><canvas id="chartRadar"></canvas></div>
          <div id="radarLegend" style="flex:0 0 300px;display:flex;flex-direction:column;justify-content:center"></div>
        </div>
      </div>
    </div>

    <!-- Row 4: Peta Choropleth -->
    <div class="grid-full">
      <div class="card">
        <div class="card-header" style="justify-content:center">
          <h3>Peta Klaster Produktivitas Kabupaten/Kota Jawa Tengah</h3>
        </div>
        <div id="mapCluster"></div>
        <div class="map-legend">
          <span class="map-legend-title">Legenda:</span>
          <div class="map-legend-items" id="mapLegendItems"></div>
        </div>
      </div>
    </div>
  `;

  // Radio: TPAK/TPT toggle for tren chart
  document.querySelectorAll('input[name="tren"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!globalPage2) return;
      const wilayah  = document.getElementById('filterWilayah').value;
      const trenItem = globalPage2.tren.find(t => t.kabupaten === wilayah);
      if (trenItem) renderChartTren(trenItem, r.value);
    });
  });

  // Radio: Lowongan/Pencari for pasar chart
  document.querySelectorAll('input[name="pasar"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!globalPage2) return;
      const wilayah = document.getElementById('filterWilayah').value;
      const kab     = globalPage2.kabupaten.find(k => k.nama === wilayah);
      if (kab) renderChartPasar(kab, r.value);
    });
  });
}

/* ================================================================
   RENDER ALL  (called on dropdown change)
   ================================================================ */
function renderAll(page2, wilayah) {
  const trenItem    = page2.tren.find(t => t.kabupaten === wilayah);
  const kabItem     = page2.kabupaten.find(k => k.nama  === wilayah);
  const klusterItem = page2.kluster.find(k => k.kabupaten === wilayah);

  if (!trenItem) { console.error('Data tren tidak ditemukan untuk:', wilayah); return; }
  if (!kabItem)  { console.error('Data kabupaten tidak ditemukan untuk:', wilayah); return; }

  updateInsight(trenItem, kabItem, klusterItem, wilayah);
  const trenRadio = document.querySelector('input[name="tren"]:checked');
  renderChartTren(trenItem, trenRadio?.value || 'tpak');
  renderChartUpah(kabItem, wilayah, page2);

  const mode = document.querySelector('input[name="pasar"]:checked')?.value || 'lowongan';
  renderChartPasar(kabItem, mode);

  if (klusterItem) {
    renderKlasterCard(klusterItem, page2.kluster);
    renderChartRadar(klusterItem, page2.kluster);
  } else {
    document.getElementById('klasterContent').innerHTML =
      `<p style="color:var(--grey);margin-top:1rem;font-size:.88rem">Data klaster tidak tersedia untuk ${wilayah}.</p>`;
  }
}

/* ================================================================
   INSIGHT
   ================================================================ */
function updateInsight(tren, kab, kluster, wilayah) {
  const latest    = tren.data[tren.data.length - 1];
  const earliest  = tren.data[0];
  const tptDelta  = +(latest.tpt  - earliest.tpt).toFixed(2);
  const tpakDelta = +(latest.tpak - earliest.tpak).toFixed(2);
  const gapUpah   = kab ? kab.upah.formal - kab.upah.informal : 0;

  const OG = 'color:#fb923c';   // orange accent for dark insight bg

  const tptDir  = tptDelta < 0
    ? `turun <strong style="${OG}">${Math.abs(tptDelta)} poin persentase</strong> (membaik)`
    : `naik <strong style="${OG}">${tptDelta} poin persentase</strong> (perlu perhatian)`;

  const tpakDir = tpakDelta >= 0
    ? `meningkat <strong style="${OG}">${tpakDelta} poin</strong>`
    : `turun <strong style="${OG}">${Math.abs(tpakDelta)} poin</strong>`;

  const klInfo = kluster
    ? ` Berdasarkan analisis klaster, wilayah ini masuk dalam <strong style="${OG}">${CLUSTER_META[kluster.cluster].label}</strong>.`
    : '';

  document.getElementById('insightText').innerHTML =
    `<strong>${wilayah}</strong>: Dalam kurun 2017–2025, TPT ${tptDir}, sementara TPAK ${tpakDir}. ` +
    `Rata-rata upah formal (<strong style="${OG}">${fRupiah(kab?.upah?.formal || 0)}</strong>) lebih tinggi ` +
    `<strong style="${OG}">${fRupiah(gapUpah)}</strong> dibanding upah informal (<strong style="${OG}">${fRupiah(kab?.upah?.informal || 0)}</strong>).${klInfo}`;
}

/* ================================================================
   CHART 1 – TREN KETENAGAKERJAAN (LINE, SINGLE AXIS)
   - variabel: 'tpak' (default) atau 'tpt'
   - Warna dan label menyesuaikan pilihan radio
   ================================================================ */
function renderChartTren(trenItem, variabel = 'tpak') {
  if (charts.tren) { charts.tren.destroy(); charts.tren = null; }

  const isTpak = variabel === 'tpak';
  const color   = isTpak ? '#1F3C88' : '#F97316';
  const bgColor = isTpak ? 'rgba(31,60,136,.1)' : 'rgba(249,115,22,.08)';
  const label   = isTpak ? 'TPAK (%)' : 'TPT (%)';
  const data    = trenItem.data.map(d => isTpak ? d.tpak : d.tpt);

  const ctx = document.getElementById('chartTren').getContext('2d');

  charts.tren = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trenItem.data.map(d => d.tahun),
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: bgColor,
        pointBackgroundColor: color,
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
        tooltip: { callbacks: { label: c => `${label}: ${c.parsed.y}%` } },
      },
      scales: {
        y: {
          title: { display: true, text: label, color, font: { weight: '600' } },
          grid:  { color: '#f1f5f9' },
          ticks: { callback: v => v + '%' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ================================================================
   CHART 2 – UPAH FORMAL vs INFORMAL (BAR)
   - Destroy + recreate → label selalu benar
   - beginAtZero: true  → skala adil dari 0
   - borderRadius: atas rounded, bawah kotak
   - 4-entry custom legend: Formal (navy) + Informal (orange) × 2 wilayah
   ================================================================ */
function renderChartUpah(kabItem, wilayah, page2) {
  if (charts.upah) { charts.upah.destroy(); charts.upah = null; }

  const formal       = kabItem?.upah?.formal   ?? 0;
  const informal     = kabItem?.upah?.informal ?? 0;
  const provData     = page2.kabupaten.find(k => k.nama === 'Jawa Tengah');
  const provFormal   = provData?.upah?.formal   ?? 0;
  const provInformal = provData?.upah?.informal ?? 0;
  const isProvince   = (wilayah === 'Jawa Tengah');

  // borderRadius: hanya sudut atas yang rounded
  const radiusTop = { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 };

  const datasets = [
    {
      label: wilayah,
      data: [formal, informal],
      backgroundColor: ['#1F3C88', '#F97316'],   // Formal=navy, Informal=orange
      borderRadius: radiusTop,
      borderSkipped: false,
    },
  ];

  if (!isProvince) {
    datasets.push({
      label: 'Jawa Tengah (Provinsi)',
      data: [provFormal, provInformal],
      backgroundColor: ['rgba(31,60,136,.28)', 'rgba(249,115,22,.28)'],
      borderRadius: radiusTop,
      borderSkipped: false,
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
          position: 'bottom',   // legend di bawah chart
          labels: {
            usePointStyle: true,
            pointStyle:    'rectRounded',
            boxWidth:      14,
            boxHeight:     14,
            padding:       22,   // breathing room between legend and chart
            // 4 entri legend: Formal-solid, Informal-solid, Formal-pudar, Informal-pudar
            generateLabels: chart => {
              const ds       = chart.data.datasets;
              const entries  = [
                { text: `Formal – ${ds[0].label}`,   fill: '#1F3C88',             ds: 0 },
                { text: `Informal – ${ds[0].label}`, fill: '#F97316',             ds: 0 },
              ];
              if (ds[1]) {
                entries.push(
                  { text: `Formal – ${ds[1].label}`,   fill: 'rgba(31,60,136,.4)',  ds: 1 },
                  { text: `Informal – ${ds[1].label}`, fill: 'rgba(249,115,22,.4)', ds: 1 },
                );
              }
              return entries.map(e => ({
                text:         e.text,
                fillStyle:    e.fill,
                strokeStyle:  'transparent',
                hidden:       false,
                datasetIndex: e.ds,
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
          grid:  { color: '#f1f5f9' },
        },
        x: { grid: { display: false } },
      },
      layout: { padding: { bottom: 8 } },   // breathing room above bottom legend
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

  const total     = lk + pr;
  const lkPct     = lk / total * 100;
  const prPct     = pr / total * 100;
  const diffPct   = Math.abs(lkPct - prPct).toFixed(1);
  const dominant  = lk > pr ? 'Laki-laki' : 'Perempuan';
  const minority  = lk > pr ? 'Perempuan' : 'Laki-laki';
  const domColor  = lk > pr ? '#1F3C88'   : '#F97316';
  const modeLabel = mode === 'lowongan' ? 'Lowongan Kerja Terdaftar' : 'Pencari Kerja Terdaftar';

  // ── Stat box ──
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
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 12 },
          formatter: v => `${(v / total * 100).toFixed(1)}%`,
        },
        title: {
          display: true,
          text: modeLabel,
          color: '#1e293b',
          font: { size: 12, weight: '600' },
          padding: { bottom: 6 },
        },
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            // Ringkas: hanya jumlah orang, label sudah tampil di header tooltip
            label: c => `${fNum(c.raw)} orang`,
          },
        },
      },
    },
  });
}

/* ================================================================
   KLASTER CARD
   ================================================================ */
function renderKlasterCard(klusterItem, allKluster) {
  const c    = klusterItem.cluster;
  const meta = CLUSTER_META[c];
  const cd   = klusterItem.cluster_data;
  const peers= allKluster.filter(k => k.cluster === c).map(k => k.kabupaten);

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
        <div class="kpi-label">TPT 2024</div>
        <div class="kpi-value" style="color:#F97316">${cd.tpt}%</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">TPAK 2024</div>
        <div class="kpi-value" style="color:#1F3C88">${cd.tpak}%</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">IPM</div>
        <div class="kpi-value">${cd.ipm}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">Pengeluaran/Kapita</div>
        <div class="kpi-value" style="font-size:.78rem">${fRupiah(cd.pengeluaran_per_kapita)}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">Rata-rata Upah</div>
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
   CHART 4 – RADAR
   ================================================================ */
function renderChartRadar(klusterItem, allKluster) {
  if (charts.radar) { charts.radar.destroy(); charts.radar = null; }

  const cd    = klusterItem.cluster_data;
  const peers = allKluster.filter(k => k.cluster === klusterItem.cluster);

  const avg = {
    tpak:        peers.reduce((s, k) => s + k.cluster_data.tpak,                   0) / peers.length,
    tpt:         peers.reduce((s, k) => s + k.cluster_data.tpt,                    0) / peers.length,
    ipm:         peers.reduce((s, k) => s + k.cluster_data.ipm,                    0) / peers.length,
    pengeluaran: peers.reduce((s, k) => s + k.cluster_data.pengeluaran_per_kapita, 0) / peers.length,
    upah:        peers.reduce((s, k) => s + k.cluster_data.rata_upah,              0) / peers.length,
  };

  const norm = (val, a) => Math.min(Math.round(val / a * 100), 150);

  const labels = [
    'TPAK',
    'IPM',
    'Pengeluaran\nPer Kapita',
    'Upah Rata-rata',
    'Efisiensi\nKetenagakerjaan',
  ];
  const values = [
    norm(cd.tpak,                    avg.tpak),
    norm(cd.ipm,                     avg.ipm),
    norm(cd.pengeluaran_per_kapita,  avg.pengeluaran),
    norm(cd.rata_upah,               avg.upah),
    norm(100 - cd.tpt,               100 - avg.tpt),
  ];

  const ctx = document.getElementById('chartRadar').getContext('2d');

  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: klusterItem.kabupaten,
          data: values,
          borderColor: '#1F3C88',
          backgroundColor: 'rgba(31,60,136,.15)',
          pointBackgroundColor: '#1F3C88',
          borderWidth: 2.5, pointRadius: 5,
        },
        {
          label: 'Rata-rata Klaster',
          data: [100, 100, 100, 100, 100],
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
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: c => `${c.dataset.label}: ${c.raw}% dari rata-rata klaster`,
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 150,
          ticks: { stepSize: 50, callback: v => v + '%' },
          pointLabels: { font: { size: 11, weight: '600' }, color: '#475569' },
          grid: { color: '#e2e8f0' },
          angleLines: { color: '#e2e8f0' },
        },
      },
    },
  });

  // Sidebar legend — diperbesar
  document.getElementById('radarLegend').innerHTML = `
    <p style="font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;
              letter-spacing:.08em;margin-bottom:1rem">
      Nilai Aktual – ${klusterItem.kabupaten}
    </p>
    ${[
      ['TPAK',              cd.tpak + '%',                    '#1F3C88'],
      ['TPT',               cd.tpt  + '%',                    '#F97316'],
      ['IPM',               String(cd.ipm),                   '#3B82F6'],
      ['Pengeluaran/Kapita',fRupiah(cd.pengeluaran_per_kapita),'#1F3C88'],
      ['Rata-rata Upah',    fRupiah(cd.rata_upah),            '#F97316'],
      ['Penduduk',          fNum(cd.penduduk) + ' jiwa',      '#94A3B8'],
    ].map(([l, v, c]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:.75rem 1rem;border-radius:.65rem;margin-bottom:.5rem;
                  background:#f8fafc;border:1px solid #e2e8f0">
        <span style="font-size:.84rem;color:#475569;font-weight:500">${l}</span>
        <span style="font-size:.92rem;font-weight:700;color:${c};margin-left:.75rem">${v}</span>
      </div>`).join('')}
  `;
}

/* ================================================================
   MAP – CHOROPLETH (Leaflet.js)
   ================================================================ */
function initMap(klusterData) {
  // Build lookup: kabupaten-name (lowercase) → cluster item
  const clusterLookup = {};
  klusterData.forEach(k => {
    clusterLookup[k.kabupaten.toLowerCase()] = k;
  });

  // Init Leaflet centred on Jawa Tengah
  leafletMap = L.map('mapCluster', {
    center:            [-7.15, 110.14],
    zoom:              8,
    zoomControl:       true,
    scrollWheelZoom:   false,
    maxZoom:           12,
  });

  // Muted CartoDB base tiles
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
        ' &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom:    12,
    }
  ).addTo(leafletMap);

  // Attempt to load GeoJSON (root level — GitHub Pages friendly)
  fetch('jateng.geojson')
    .then(r => {
      if (!r.ok) throw new Error('GeoJSON belum tersedia');
      return r.json();
    })
    .then(geojson => {
      renderChoropleth(geojson, klusterData, clusterLookup);
    })
    .catch(() => {
      showMapPlaceholder();
    });

  renderMapLegend();
}

/* ── Name matching helpers ──────────────────────────────────────
 *
 * GADM NAME_2 examples  →  data.json kabupaten
 *  'Salatiga'   (Kota)  →  'Kota Salatiga'
 *  'Surakarta'  (Kota)  →  'Kota Surakarta'
 *  'Kota Magelang'      →  'Kota Magelang'   (already matches)
 *  'Banjarnegara'       →  'Banjarnegara'    (already matches)
 * ────────────────────────────────────────────────────────────── */

/** Normalise: strip leading 'Kab.'/'Kabupaten ' and lowercase */
function normName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^kab\.\s*/i, '')
    .replace(/^kabupaten\s*/i, '')
    .trim();
}

/**
 * Build canonical name from GeoJSON feature:
 *   If TYPE_2 === 'Kota' and name doesn't start with 'kota', prepend it.
 *   This converts 'Salatiga' (Kota) → 'Kota Salatiga'.
 */
function canonicalName(feature) {
  const raw  = feature.properties.NAME_2  ||
                feature.properties.KABKOT  ||
                feature.properties.NAMOBJ  ||
                feature.properties.name    ||
                feature.properties.NAME    || '';
  const type = (feature.properties.TYPE_2 || '').toLowerCase();
  const lo   = raw.toLowerCase();
  if (type === 'kota' && !lo.startsWith('kota ')) {
    return 'Kota ' + raw;
  }
  return raw;
}

/** Find cluster item by feature name (with GADM normalisation) */
function findCluster(feature, lookup) {
  const canon = canonicalName(feature);    // e.g. 'Kota Salatiga'
  const lo    = canon.toLowerCase();

  // 1. Direct lowercase match
  if (lookup[lo]) return lookup[lo];

  // 2. Normalised (strip Kabupaten) match
  const n = normName(canon);
  for (const [key, val] of Object.entries(lookup)) {
    if (normName(key) === n) return val;
  }

  // 3. Partial contains
  for (const [key, val] of Object.entries(lookup)) {
    const k = normName(key);
    if (k === n || k.includes(n) || n.includes(k)) return val;
  }
  return null;
}

function renderChoropleth(geojson, klusterData, clusterLookup) {
  const layer = L.geoJSON(geojson, {
    style: feature => {
      const item  = findCluster(feature, clusterLookup);
      const color = item != null ? CLUSTER_META[item.cluster].mapColor : '#d1d5db';
      return {
        fillColor:   color,
        fillOpacity: 0.78,
        color:       '#ffffff',
        weight:      1.5,
        opacity:     1,
      };
    },

    onEachFeature: (feature, layer) => {
      const displayName = canonicalName(feature);
      const item = findCluster(feature, clusterLookup);
      const cd   = item?.cluster_data;
      const meta = item != null ? CLUSTER_META[item.cluster] : null;

      const tooltipHtml = `
        <div style="font-family:'Poppins',sans-serif;min-width:190px">
          <div style="font-weight:700;color:#1F3C88;font-size:.85rem;margin-bottom:3px">
            ${displayName}
          </div>
          ${meta
            ? `<div style="font-size:.75rem;color:${meta.color};font-weight:600">
                 ${meta.label}
               </div>
               <hr style="margin:5px 0;border-color:#e2e8f0">
               <div style="font-size:.73rem;color:#64748b">
                 TPT: <strong>${cd.tpt}%</strong> &nbsp;|&nbsp; TPAK: <strong>${cd.tpak}%</strong>
               </div>
               <div style="font-size:.73rem;color:#64748b">
                 IPM: <strong>${cd.ipm}</strong>
               </div>`
            : `<div style="font-size:.75rem;color:#94a3b8">Data klaster tidak ditemukan</div>`}
        </div>`;

      layer.bindTooltip(tooltipHtml, { sticky: true, direction: 'top', opacity: 1 });

      layer.on({
        mouseover: e => { e.target.setStyle({ weight: 2.5, fillOpacity: 0.95 }); },
        mouseout:  e => { layer.resetStyle ? layer.resetStyle() : e.target.setStyle({ weight: 1.5, fillOpacity: 0.78 }); },
      });
    },
  }).addTo(leafletMap);

  leafletMap.fitBounds(layer.getBounds(), { padding: [16, 16] });
}

function showMapPlaceholder() {
  const mapDiv = document.getElementById('mapCluster');
  mapDiv.style.position = 'relative';

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute;inset:0;z-index:999;
    background:rgba(248,250,252,.93);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    border-radius:.75rem;text-align:center;padding:2.5rem;
  `;
  overlay.innerHTML = `
    <svg width="52" height="52" fill="none" stroke="#94a3b8" stroke-width="1.4"
         viewBox="0 0 24 24" style="margin-bottom:1rem">
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7
               m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618
               a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
    </svg>
    <p style="font-weight:700;color:#475569;margin-bottom:.5rem;font-size:.95rem">
      File GeoJSON Belum Tersedia
    </p>
    <p style="font-size:.82rem;color:#94a3b8;max-width:400px;line-height:1.65">
      Letakkan file hasil konversi SHP ke dalam folder
      <code style="background:#f1f5f9;padding:.1rem .4rem;border-radius:.3rem">data/jateng.geojson</code>.<br>
      Properti GeoJSON harus memiliki kolom nama kabupaten seperti
      <code>KABKOT</code>, <code>NAME_2</code>, atau <code>NAMOBJ</code>.
    </p>`;

  mapDiv.appendChild(overlay);
}

function renderMapLegend() {
  const el = document.getElementById('mapLegendItems');
  if (!el) return;
  el.innerHTML =
    Object.entries(CLUSTER_META).map(([, v]) => `
      <div class="map-legend-item">
        <span class="map-legend-dot" style="background:${v.mapColor}"></span>
        <span>${v.label}</span>
      </div>`).join('') +
    `<div class="map-legend-item">
       <span class="map-legend-dot" style="background:#cccccc"></span>
       <span>Data tidak tersedia</span>
     </div>`;
}

/* ================================================================
   BOOT
   ================================================================ */
document.addEventListener('DOMContentLoaded', initDashboard);
