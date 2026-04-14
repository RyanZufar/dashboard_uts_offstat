const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
const formatNumber = (angka) => new Intl.NumberFormat('id-ID').format(angka);
function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    if (slides.length > 1) {
        setInterval(() => {
            slides[currentSlide].classList.remove('opacity-80');
            slides[currentSlide].classList.add('opacity-0');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.remove('opacity-0');
            slides[currentSlide].classList.add('opacity-80');
        }, 5000); 
    }
}
initHeroSlider();

document.addEventListener('DOMContentLoaded', () => {
    
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            const overview = data.page1.overview;
            const charts = data.page1.chart;

            document.getElementById('val-usia-kerja').innerText = formatNumber(overview.penduduk_usia_kerja.jumlah);
            document.getElementById('val-usia-persen').innerText = `${overview.penduduk_usia_kerja.persentase}% jiwa dari total populasi`;
            
            document.getElementById('val-ump').innerText = formatRupiah(overview.ump);
            
            document.getElementById('val-formal').innerText = overview.pekerjaan.formal + '%';
            document.getElementById('val-informal').innerText = overview.pekerjaan.informal + '%';
            document.getElementById('bar-formal').style.width = overview.pekerjaan.formal + '%';
            document.getElementById('bar-informal').style.width = overview.pekerjaan.informal + '%';

            document.getElementById('val-umur-kelompok').innerText = overview.kelompok_umur_terbesar.kelompok;
            document.getElementById('val-umur-jumlah').innerText = `Sejumlah ${formatNumber(overview.kelompok_umur_terbesar.jumlah)} jiwa`;

            Chart.defaults.font.family = "'Poppins', sans-serif";
            Chart.defaults.color = '#64748b';
            Chart.register(ChartDataLabels);
            
            // Chart 1
            const dataPengangguran = charts.pengangguran_pendidikan;
            const dataBekerja = charts.bekerja_pendidikan;
            const ctxPendidikan = document.getElementById('chartPendidikan').getContext('2d');
            let chartPendidikanInstance = new Chart(ctxPendidikan, {
                type: 'doughnut',
                data: {
                    labels: ['Bekerja', 'Pengangguran'],
                    datasets: [{
                        data: [dataBekerja.persentase[0], dataPengangguran.persentase[0]],
                        backgroundColor: ['#1F3C88', '#94a3b8'],
                        borderWidth: 0,
                        hoverBorderWidth: 0,
                        hoverOffset: 6
                    }]
                },
                options: { 
                    layout: { padding: 15 },
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'right' },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 14 },
                            formatter: (value) => {
                                return value + '%';
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const dropdown = document.getElementById('filterPendidikan');
                                    const selectedIndex = parseInt(dropdown.value);
                                    
                                    let jumlahAsli = 0;
                                    if (context.dataIndex === 0) {
                                        jumlahAsli = dataBekerja.jumlah[selectedIndex];
                                    } else {
                                        jumlahAsli = dataPengangguran.jumlah[selectedIndex];
                                    }
                                    
                                    return formatNumber(jumlahAsli) + ' jiwa';
                                }
                            }
                        }
                    } 
                }
            });

            document.getElementById('filterPendidikan').addEventListener('change', function(e) {
                const index = parseInt(e.target.value);
                chartPendidikanInstance.data.datasets[0].data = [
                    dataBekerja.persentase[index], 
                    dataPengangguran.persentase[index]
                ];
                
                chartPendidikanInstance.update();
            });

            // Chart 2:
            new Chart(document.getElementById('chartUmur').getContext('2d'), {
                type: 'pie',
                data: {
                    labels: charts.komposisi_umur.labels,
                    datasets: [{
                        data: charts.komposisi_umur.persentase, 
                        backgroundColor: ['#3b82f6', '#1F3C88', '#94a3b8'],
                        borderWidth: 0,
                        hoverBorderWidth: 0,
                        hoverOffset: 6
                    }]
                },
                options: { 
                    layout: { padding: 15 },
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'right' },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 14 },
                            formatter: (value) => {
                                return value + '%';
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const dataIndex = context.dataIndex;
                                    const jumlahAsli = charts.komposisi_umur.jumlah[dataIndex];
                                    return formatNumber(jumlahAsli) + ' jiwa';
                                }
                            }
                        }
                    } 
                }
            });

            // Chart 3
            const keteranganContainer = document.getElementById('keteranganLabelUpah');
            keteranganContainer.innerHTML = ''; 

            charts.top_upah_sektor.forEach(item => {
                keteranganContainer.innerHTML += `
                    <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span class="font-bold text-white bg-[#1F3C88] w-8 h-8 flex items-center justify-center rounded-lg shrink-0">${item.label}</span>
                        <span class="text-sm text-slate-600 font-medium leading-tight">${item.sektor}</span>
                    </div>
                `;
            });

            new Chart(document.getElementById('chartTopUpah').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: charts.top_upah_sektor.map(item => item.label),
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
                    plugins: { 
                        datalabels: { display: false },
                        tooltip: { 
                            callbacks: { 
                                title: (context) => charts.top_upah_sektor[context[0].dataIndex].sektor,
                                label: (context) => formatRupiah(context.raw) 
                            } 
                        } 
                    },
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            grid: { display: false },
                            ticks: {
                                callback: function(value) {
                                    return 'Rp' + formatNumber(value);
                                }
                            }
                        }, 
                        x: { grid: { display: false } } 
                    }
                }
            });

            // Chart 4
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
                        x: { 
                            stacked: true, 
                            ticks: {
                                callback: value => 'Rp' + formatNumber(Math.abs(value)) 
                            }, 
                            grid: { color: '#f1f5f9' } 
                        },
                        y: { 
                            stacked: true, 
                            grid: { display: false }, 
                            ticks: { autoSkip: false } 
                        }
                    },
                    plugins: {
                        datalabels: { display: false },
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