// Utilitas Formatter
const toRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
const toNum = (val) => new Intl.NumberFormat('id-ID').format(val);

// Fungsi Utama
async function initDashboard() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        renderCards(data.page1.overview);
        renderCharts(data.page1.chart);
    } catch (err) {
        console.error("Gagal load data:", err);
    }
}

function renderCards(ov) {
    document.getElementById('val-usia-kerja').innerText = toNum(ov.penduduk_usia_kerja.jumlah);
    document.getElementById('val-usia-persen').innerText = `${ov.penduduk_usia_kerja.persentase}% dari total penduduk`;
    document.getElementById('val-ump').innerText = toRupiah(ov.ump);
    document.getElementById('val-formal').innerText = ov.pekerjaan.formal + '%';
    document.getElementById('val-informal').innerText = ov.pekerjaan.informal + '%';
    document.getElementById('bar-formal').style.width = ov.pekerjaan.formal + '%';
    document.getElementById('val-umur-kelompok').innerText = ov.kelompok_umur_terbesar.kelompok + " Thn";
    document.getElementById('val-umur-jumlah').innerText = `${toNum(ov.kelompok_umur_terbesar.jumlah)} jiwa`;
}

function renderCharts(ch) {
    // 1. Chart Pendidikan
    new Chart(document.getElementById('chartPendidikan'), {
        type: 'doughnut',
        data: {
            labels: ch.pengangguran_pendidikan.labels,
            datasets: [{
                data: ch.pengangguran_pendidikan.jumlah,
                backgroundColor: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']
            }]
        }
    });

    // 2. Chart Komposisi Umur
    new Chart(document.getElementById('chartUmur'), {
        type: 'pie',
        data: {
            labels: ch.komposisi_umur.labels,
            datasets: [{
                data: ch.komposisi_umur.jumlah,
                backgroundColor: ['#94a3b8', '#3b82f6', '#1e1b4b']
            }]
        }
    });

    // 3. Top Upah Sektor (Horizontal Bar)
    new Chart(document.getElementById('chartTopUpah'), {
        type: 'bar',
        data: {
            labels: ch.top_upah_sektor.map(i => i.sektor),
            datasets: [{
                label: 'Rata-rata Gaji',
                data: ch.top_upah_sektor.map(i => i.upah),
                backgroundColor: '#1F3C88'
            }]
        },
        options: { indexAxis: 'y' }
    });

    // 4. Bidirectional Gender (Tornado)
    new Chart(document.getElementById('chartGender'), {
        type: 'bar',
        data: {
            labels: ch.upah_gender_sektor.map(i => i.sektor),
            datasets: [
                {
                    label: 'Laki-laki',
                    data: ch.upah_gender_sektor.map(i => i.laki_laki),
                    backgroundColor: '#1F3C88'
                },
                {
                    label: 'Perempuan',
                    data: ch.upah_gender_sektor.map(i => -i.perempuan),
                    backgroundColor: '#fb923c'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { 
                    stacked: true,
                    ticks: { callback: v => toNum(Math.abs(v)) } 
                },
                y: { stacked: true }
            }
        }
    });
}

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', initDashboard);