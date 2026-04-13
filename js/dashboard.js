// FETCH DATA
fetch("data.json")
  .then(res => res.json())
  .then(data => {
    const overview = data.page1.overview;
    const chart = data.page1.chart;

    renderCards(overview);
    renderCharts(chart);
  });

/* ===================== */
/* HERO SLIDER */
/* ===================== */
let current = 1;
setInterval(() => {
  const img1 = document.getElementById("img1");
  const img2 = document.getElementById("img2");

  if (current === 1) {
    img1.classList.remove("active");
    img2.classList.add("active");
    current = 2;
  } else {
    img2.classList.remove("active");
    img1.classList.add("active");
    current = 1;
  }
}, 5000);

/* ===================== */
/* CARDS */
/* ===================== */
function renderCards(o) {
  const el = document.getElementById("cards");

  el.innerHTML = `
    <div class="card">
      <h3>Penduduk Usia Kerja</h3>
      <h1>${formatNumber(o.penduduk_usia_kerja.jumlah)}</h1>
      <p>${o.penduduk_usia_kerja.persentase}% dari total</p>
    </div>

    <div class="card">
      <h3>UMP Jateng</h3>
      <h1>Rp ${formatNumber(o.ump)}</h1>
    </div>

    <div class="card">
      <h3>Pekerjaan</h3>
      <p>Formal: ${o.pekerjaan.formal}%</p>
      <p>Informal: ${o.pekerjaan.informal}%</p>
    </div>

    <div class="card">
      <h3>Kelompok Umur Terbesar</h3>
      <h1>${o.kelompok_umur_terbesar.kelompok}</h1>
      <p>${formatNumber(o.kelompok_umur_terbesar.jumlah)}</p>
    </div>
  `;
}

/* ===================== */
/* CHARTS */
/* ===================== */
function renderCharts(c) {

  // PIE PENGANGGURAN
  new Chart(document.getElementById("chartPengangguran"), {
    type: "pie",
    data: {
      labels: c.pengangguran_pendidikan.labels,
      datasets: [{
        data: c.pengangguran_pendidikan.jumlah
      }]
    }
  });

  // PIE UMUR
  new Chart(document.getElementById("chartUmur"), {
    type: "pie",
    data: {
      labels: c.komposisi_umur.labels,
      datasets: [{
        data: c.komposisi_umur.jumlah
      }]
    }
  });

  // BAR TOP UPAH
  new Chart(document.getElementById("chartUpah"), {
    type: "bar",
    data: {
      labels: c.top_upah_sektor.map(s => s.sektor),
      datasets: [{
        label: "Upah",
        data: c.top_upah_sektor.map(s => s.upah)
      }]
    }
  });

  // BIDIRECTIONAL BAR
  new Chart(document.getElementById("chartGender"), {
    type: "bar",
    data: {
      labels: c.upah_gender_sektor.map(s => s.sektor),
      datasets: [
        {
          label: "Laki-laki",
          data: c.upah_gender_sektor.map(s => s.laki_laki)
        },
        {
          label: "Perempuan",
          data: c.upah_gender_sektor.map(s => s.perempuan)
        }
      ]
    }
  });
}

/* ===================== */
/* HELPER */
/* ===================== */
function formatNumber(num) {
  return num.toLocaleString("id-ID");
}