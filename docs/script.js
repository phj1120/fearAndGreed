// Fear & Greed Index Dashboard JavaScript

class FearGreedDashboard {
    constructor() {
        this.stockData = [];
        this.cryptoData = [];
        this.sp500Data = [];
        this.nasdaqData = [];
        this.stockChart = null;
        this.cryptoChart = null;
        this.comparisonChart = null;
        this.sp500Chart = null;
        this.nasdaqChart = null;
        this.indicesComparisonChart = null;
        this.fearGreedVsIndicesChart = null;

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.renderMetrics();
            this.renderCharts();
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async loadData() {
        try {
            // Load stock data
            const stockResponse = await fetch('./data/stock_fear_greed.csv');
            const stockText = await stockResponse.text();
            this.stockData = this.parseCSV(stockText);

            // Load crypto data
            const cryptoResponse = await fetch('./data/crypto_fear_greed.csv');
            const cryptoText = await cryptoResponse.text();
            this.cryptoData = this.parseCSV(cryptoText);

            // Load S&P 500 data
            const sp500Response = await fetch('./data/sp500_index.csv');
            const sp500Text = await sp500Response.text();
            this.sp500Data = this.parseCSV(sp500Text);

            // Load NASDAQ data
            const nasdaqResponse = await fetch('./data/nasdaq_index.csv');
            const nasdaqText = await nasdaqResponse.text();
            this.nasdaqData = this.parseCSV(nasdaqText);

            console.log('Data loaded:', {
                stock: this.stockData.length,
                crypto: this.cryptoData.length,
                sp500: this.sp500Data.length,
                nasdaq: this.nasdaqData.length
            });
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');

        return lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index]?.trim();
            });
            return row;
        }).filter(row => row.date && row.fear_greed_value);
    }

    getFearGreedLabel(value) {
        const numValue = parseInt(value);
        if (numValue <= 24) return '극도의 공포';
        if (numValue <= 44) return '공포';
        if (numValue <= 55) return '중립';
        if (numValue <= 75) return '탐욕';
        return '극도의 탐욕';
    }

    getFearGreedColor(value) {
        const numValue = parseInt(value);
        if (numValue <= 24) return '#dc2626'; // red-600
        if (numValue <= 44) return '#ea580c'; // orange-600
        if (numValue <= 55) return '#ca8a04'; // yellow-600
        if (numValue <= 75) return '#16a34a'; // green-600
        return '#15803d'; // green-700
    }

    renderMetrics() {
        // Stock metrics
        if (this.stockData.length > 0) {
            const latest = this.stockData[this.stockData.length - 1];
            document.getElementById('stock-current').textContent = latest.fear_greed_value;
            document.getElementById('stock-label').textContent = this.getFearGreedLabel(latest.fear_greed_value);
            document.getElementById('stock-date').textContent = latest.date;

            const stockCard = document.querySelector('.metric-card.stock');
            stockCard.style.borderLeftColor = this.getFearGreedColor(latest.fear_greed_value);
        }

        // Crypto metrics
        if (this.cryptoData.length > 0) {
            const latest = this.cryptoData[this.cryptoData.length - 1];
            document.getElementById('crypto-current').textContent = latest.fear_greed_value;
            document.getElementById('crypto-label').textContent = latest.classification || this.getFearGreedLabel(latest.fear_greed_value);
            document.getElementById('crypto-date').textContent = latest.date;

            const cryptoCard = document.querySelector('.metric-card.crypto');
            cryptoCard.style.borderLeftColor = this.getFearGreedColor(latest.fear_greed_value);
        }
    }

    renderCharts() {
        this.renderStockChart();
        this.renderCryptoChart();
        this.renderComparisonChart();
        this.renderSP500Chart();
        this.renderNasdaqChart();
        this.renderFearGreedVsIndicesChart();
        this.renderIndicesComparisonChart();
    }

    renderStockChart() {
        const ctx = document.getElementById('stockChart').getContext('2d');

        // Get last 90 days for better visualization
        const data = this.stockData.slice(-90);

        this.stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: '주식 Fear & Greed 지수',
                    data: data.map(d => parseInt(d.fear_greed_value)),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: this.getChartOptions('주식 Fear & Greed 지수')
        });
    }

    renderCryptoChart() {
        const ctx = document.getElementById('cryptoChart').getContext('2d');

        // Get last 90 days for better visualization
        const data = this.cryptoData.slice(-90);

        this.cryptoChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: '암호화폐 Fear & Greed 지수',
                    data: data.map(d => parseInt(d.fear_greed_value)),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: this.getChartOptions('암호화폐 Fear & Greed 지수')
        });
    }

    renderComparisonChart() {
        const ctx = document.getElementById('comparisonChart').getContext('2d');

        // Find common dates and get last 60 days
        const stockDates = new Set(this.stockData.map(d => d.date));
        const cryptoDates = new Set(this.cryptoData.map(d => d.date));
        const commonDates = [...stockDates].filter(date => cryptoDates.has(date)).slice(-60);

        const stockValues = commonDates.map(date => {
            const item = this.stockData.find(d => d.date === date);
            return item ? parseInt(item.fear_greed_value) : null;
        });

        const cryptoValues = commonDates.map(date => {
            const item = this.cryptoData.find(d => d.date === date);
            return item ? parseInt(item.fear_greed_value) : null;
        });

        this.comparisonChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: commonDates,
                datasets: [
                    {
                        label: '주식',
                        data: stockValues,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: '암호화폐',
                        data: cryptoValues,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: this.getChartOptions('주식 vs 암호화폐 비교')
        });
    }

    renderSP500Chart() {
        const ctx = document.getElementById('sp500Chart').getContext('2d');

        // Get last 365 days for better visualization
        const data = this.sp500Data.slice(-365);

        this.sp500Chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'S&P 500 지수',
                    data: data.map(d => parseFloat(d.close_price)),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: this.getStockChartOptions('S&P 500 지수')
        });
    }

    renderNasdaqChart() {
        const ctx = document.getElementById('nasdaqChart').getContext('2d');

        // Get last 365 days for better visualization
        const data = this.nasdaqData.slice(-365);

        this.nasdaqChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'NASDAQ 지수',
                    data: data.map(d => parseFloat(d.close_price)),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: this.getStockChartOptions('NASDAQ 지수')
        });
    }

    renderFearGreedVsIndicesChart() {
        const ctx = document.getElementById('fearGreedVsIndicesChart').getContext('2d');

        // Find common dates between stock Fear & Greed and indices (last 180 days)
        const stockDates = new Set(this.stockData.map(d => d.date));
        const sp500Dates = new Set(this.sp500Data.map(d => d.date));
        const nasdaqDates = new Set(this.nasdaqData.map(d => d.date));

        const commonDates = [...stockDates]
            .filter(date => sp500Dates.has(date) && nasdaqDates.has(date))
            .slice(-180);

        // Get Fear & Greed data for common dates
        const fearGreedValues = commonDates.map(date => {
            const item = this.stockData.find(d => d.date === date);
            return item ? parseInt(item.fear_greed_value) : null;
        });

        // Get normalized stock indices data (percentage change from first value)
        const sp500Values = commonDates.map(date => {
            const item = this.sp500Data.find(d => d.date === date);
            return item ? parseFloat(item.close_price) : null;
        });

        const nasdaqValues = commonDates.map(date => {
            const item = this.nasdaqData.find(d => d.date === date);
            return item ? parseFloat(item.close_price) : null;
        });

        // Normalize indices to 0-100 scale for comparison
        const sp500Base = sp500Values[0];
        const nasdaqBase = nasdaqValues[0];

        // Convert to percentage change and scale to 0-100 range
        const sp500Normalized = sp500Values.map(val => {
            if (!val) return null;
            const pctChange = ((val - sp500Base) / sp500Base) * 100;
            // Scale to roughly 0-100 range (adjust multiplier as needed)
            return Math.max(0, Math.min(100, 50 + pctChange * 2));
        });

        const nasdaqNormalized = nasdaqValues.map(val => {
            if (!val) return null;
            const pctChange = ((val - nasdaqBase) / nasdaqBase) * 100;
            // Scale to roughly 0-100 range (adjust multiplier as needed)
            return Math.max(0, Math.min(100, 50 + pctChange * 2));
        });

        this.fearGreedVsIndicesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: commonDates,
                datasets: [
                    {
                        label: 'Fear & Greed 지수',
                        data: fearGreedValues,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'S&P 500 (정규화)',
                        data: sp500Normalized,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'NASDAQ (정규화)',
                        data: nasdaqNormalized,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value;
                            }
                        },
                        title: {
                            display: true,
                            text: '지수 값 / 정규화된 값'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 8,
                            callback: function(value, index, values) {
                                const date = this.getLabelForValue(value);
                                return new Date(date).toLocaleDateString('ko-KR', {
                                    month: 'short',
                                    day: 'numeric'
                                });
                            }
                        }
                    }
                }
            }
        });
    }

    renderIndicesComparisonChart() {
        const ctx = document.getElementById('indicesComparisonChart').getContext('2d');

        // Find common dates and get last 180 days
        const sp500Dates = new Set(this.sp500Data.map(d => d.date));
        const nasdaqDates = new Set(this.nasdaqData.map(d => d.date));
        const commonDates = [...sp500Dates].filter(date => nasdaqDates.has(date)).slice(-180);

        // Normalize to percentage change from first date
        const sp500Values = commonDates.map(date => {
            const item = this.sp500Data.find(d => d.date === date);
            return item ? parseFloat(item.close_price) : null;
        });

        const nasdaqValues = commonDates.map(date => {
            const item = this.nasdaqData.find(d => d.date === date);
            return item ? parseFloat(item.close_price) : null;
        });

        // Convert to percentage change from first value
        const sp500Base = sp500Values[0];
        const nasdaqBase = nasdaqValues[0];

        const sp500Normalized = sp500Values.map(val => val ? ((val - sp500Base) / sp500Base) * 100 : null);
        const nasdaqNormalized = nasdaqValues.map(val => val ? ((val - nasdaqBase) / nasdaqBase) * 100 : null);

        this.indicesComparisonChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: commonDates,
                datasets: [
                    {
                        label: 'S&P 500 (%)',
                        data: sp500Normalized,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'NASDAQ (%)',
                        data: nasdaqNormalized,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: this.getPercentageChartOptions('주요 지수 비교 (상대적 변화율)')
        });
    }

    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function(value, index, values) {
                            const date = this.getLabelForValue(value);
                            return new Date(date).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric'
                            });
                        }
                    }
                }
            },
            elements: {
                point: {
                    radius: 1,
                    hoverRadius: 4
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        };
    }

    getStockChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function(value, index, values) {
                            const date = this.getLabelForValue(value);
                            return new Date(date).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric'
                            });
                        }
                    }
                }
            },
            elements: {
                point: {
                    radius: 1,
                    hoverRadius: 4
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        };
    }

    getPercentageChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(1) + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function(value, index, values) {
                            const date = this.getLabelForValue(value);
                            return new Date(date).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric'
                            });
                        }
                    }
                }
            },
            elements: {
                point: {
                    radius: 1,
                    hoverRadius: 4
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        };
    }

    updateLastUpdateTime() {
        const now = new Date();
        const formatted = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('last-update').textContent = formatted;
    }

    showError(message) {
        const container = document.querySelector('.dashboard');
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc2626;">
                <h2>⚠️ 오류</h2>
                <p>${message}</p>
            </div>
        `;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FearGreedDashboard();
});