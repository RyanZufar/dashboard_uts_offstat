// Formatter Mata Uang & Angka
const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
const formatNumber = (angka) => new Intl.NumberFormat('id-ID').format(angka);

// Eksekusi Fetch Data saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    
    // Fetch JSON file (Ini akan jalan sempurna di GitHub Pages)
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            const overview = data.page1.overview;
            const charts = data.page1.chart;

            // 1. UPDATE KARTU (CARDS)
            document.getElementById('val-usia-kerja').innerText = formatNumber(overview.penduduk_usia_kerja.jumlah);
            document.getElementById('val-usia-persen').innerText = `${overview.penduduk_usia_kerja.persentase}% dari total populasi`;
            
            document.getElementById('val-ump').innerText = formatRupiah(overview.ump);
            
            document.getElementById('val-formal').innerText = overview.pekerjaan.formal + '%';
            document.getElementById('val-informal').innerText = overview.pekerjaan.informal + '%';
            document.getElementById('bar-formal').style.width = overview.pekerjaan.formal + '%';
            document.getElementById('bar-informal').style.width = overview.pekerjaan.informal + '%';

            document.getElementById('val-umur-kelompok').innerText = overview.kelompok_umur_terbesar.kelompok;
            document.getElementById('val-umur-jumlah').innerText = `${formatNumber(overview.kelompok_umur_terbesar.jumlah)} jiwa`;

            // 2. RENDER CHARTS
            Chart.defaults.font.family = "'Poppins', sans-serif";
            Chart.defaults.color = '#64748b';

            // Chart 1: Pie Pendidikan
            new Chart(document.getElementById('chartPendidikan').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: charts.pengangguran_pendidikan.labels,
                    datasets: [{
                        data: charts.pengangguran_pendidikan.jumlah,
                        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });

            // Chart 2: Pie Komposisi Umur
            new Chart(document.getElementById('chartUmur').getContext('2d'), {
                type: 'pie',
                data: {
                    labels: charts.komposisi_umur.labels,
                    datasets: [{
                        data: charts.komposisi_umur.jumlah,
                        backgroundColor: ['#3b82f6', '#1F3C88', '#94a3b8'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });

            // Chart 3: Bar Top 5 Upah Sektor
            new Chart(document.getElementById('chartTopUpah').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: charts.top_upah_sektor.map(item => item.sektor),
                    datasets: [{
                        label: 'Rata-rata Upah',
                        data: charts.top_upah_sektor.map(item => item.upah),
                        backgroundColor: '#3b82f6',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { tooltip: { callbacks: { label: (context) => formatRupiah(context.raw) } } },
                    scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
                }
            });

            // Chart 4: Bidirectional Bar Gender
            new Chart(document.getElementById('chartGender').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: charts.upah_gender_sektor.map(item => item.sektor),
                    datasets: [
                        { label: 'Laki-Laki', data: charts.upah_gender_sektor.map(item => item.laki_laki), backgroundColor: '#1F3C88', borderRadius: 4 },
                        { label: 'Perempuan', data: charts.upah_gender_sektor.map(item => -Math.abs(item.perempuan)), backgroundColor: '#f97316', borderRadius: 4 }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true, ticks: { callback: value => formatNumber(Math.abs(value)) }, grid: { color: '#f1f5f9' } },
                        y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    return label + formatRupiah(Math.abs(context.raw));
                                }
                            }
                        }
                    }
                }
            });

        })
        .catch(error => {
            console.error('Error fetching data:', error);
            alert("Gagal memuat data.json.");
        });
});