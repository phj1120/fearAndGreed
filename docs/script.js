// Fear & Greed Index Dashboard JavaScript

class FearGreedDashboard {
    constructor() {
        this.stockData = [];
        this.cryptoData = [];
        this.sp500Data = [];
        this.nasdaqData = [];
        this.stockChart = null;
        this.cryptoChart = null;

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.renderMetrics();
            this.renderCharts();
            this.setupEventListeners();
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
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index]?.trim();
            });
            return obj;
        }).filter(row => row.date); // Filter out empty rows
    }

    renderMetrics() {
        // Stock Fear & Greed
        if (this.stockData.length > 0) {
            const latest = this.stockData[this.stockData.length - 1];
            const value = parseInt(latest.fear_greed_value);

            document.getElementById('stock-current').textContent = value;
            document.getElementById('stock-label').textContent = this.getFearGreedLabel(value);
            document.getElementById('stock-date').textContent = latest.date;

            const stockCard = document.querySelector('.metric-card.stock');
            stockCard.style.borderLeftColor = this.getFearGreedColor(value);
        }

        // Crypto Fear & Greed
        if (this.cryptoData.length > 0) {
            const latest = this.cryptoData[this.cryptoData.length - 1];
            const value = parseInt(latest.fear_greed_value);

            document.getElementById('crypto-current').textContent = value;
            document.getElementById('crypto-label').textContent = this.getFearGreedLabel(value);
            document.getElementById('crypto-date').textContent = latest.date;

            const cryptoCard = document.querySelector('.metric-card.crypto');
            cryptoCard.style.borderLeftColor = this.getFearGreedColor(value);
        }
    }

    renderCharts() {
        this.renderStockChart();
        this.renderCryptoChart();
    }

    renderStockChart() {
        const ctx = document.getElementById('stockChart').getContext('2d');

        if (this.stockChart) {
            this.stockChart.destroy();
        }

        const period = document.getElementById('stockPeriod').value;
        const showFearGreed = document.getElementById('showStockFearGreed').checked;
        const showSP500 = document.getElementById('showSP500').checked;
        const showNASDAQ = document.getElementById('showNASDAQ').checked;

        const datasets = [];
        let commonDates = [];

        // Get filtered data based on period
        if (showFearGreed || showSP500 || showNASDAQ) {
            // Find common dates
            const stockDates = new Set(this.stockData.map(d => d.date));
            const sp500Dates = new Set(this.sp500Data.map(d => d.date));
            const nasdaqDates = new Set(this.nasdaqData.map(d => d.date));

            commonDates = [...stockDates].filter(date => {
                let include = true;
                if (showSP500) include = include && sp500Dates.has(date);
                if (showNASDAQ) include = include && nasdaqDates.has(date);
                return include;
            });

            // Apply period filter
            if (period !== 'all') {
                const days = parseInt(period);
                commonDates = commonDates.slice(-days);
            }
        }

        // Add Fear & Greed dataset
        if (showFearGreed) {
            const fearGreedValues = commonDates.map(date => {
                const item = this.stockData.find(d => d.date === date);
                return item ? parseInt(item.fear_greed_value) : null;
            });

            // Create color array for each point based on Fear & Greed value
            const pointColors = fearGreedValues.map(value => {
                if (value === null) return '#3b82f6';
                return this.getFearGreedColor(value);
            });

            datasets.push({
                label: 'Fear & Greed 지수',
                data: fearGreedValues,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: false,
                tension: 0.1,
                yAxisID: 'y',
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        // Add S&P 500 dataset (normalized)
        if (showSP500) {
            const sp500Values = commonDates.map(date => {
                const item = this.sp500Data.find(d => d.date === date);
                return item ? parseFloat(item.close_price) : null;
            });

            // Normalize to 0-100 scale
            const sp500Base = sp500Values.find(v => v !== null);
            const sp500Normalized = sp500Values.map(val => {
                if (!val || !sp500Base) return null;
                const pctChange = ((val - sp500Base) / sp500Base) * 100;
                return Math.max(0, Math.min(100, 50 + pctChange * 1.5));
            });

            datasets.push({
                label: 'S&P 500 (정규화)',
                data: sp500Normalized,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                yAxisID: 'y'
            });
        }

        // Add NASDAQ dataset (normalized)
        if (showNASDAQ) {
            const nasdaqValues = commonDates.map(date => {
                const item = this.nasdaqData.find(d => d.date === date);
                return item ? parseFloat(item.close_price) : null;
            });

            // Normalize to 0-100 scale
            const nasdaqBase = nasdaqValues.find(v => v !== null);
            const nasdaqNormalized = nasdaqValues.map(val => {
                if (!val || !nasdaqBase) return null;
                const pctChange = ((val - nasdaqBase) / nasdaqBase) * 100;
                return Math.max(0, Math.min(100, 50 + pctChange * 1.5));
            });

            datasets.push({
                label: 'NASDAQ (정규화)',
                data: nasdaqNormalized,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                yAxisID: 'y'
            });
        }

        this.stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: commonDates,
                datasets: datasets
            },
            options: this.getChartOptions('주식 관련 지수')
        });
    }

    renderCryptoChart() {
        const ctx = document.getElementById('cryptoChart').getContext('2d');

        if (this.cryptoChart) {
            this.cryptoChart.destroy();
        }

        const period = document.getElementById('cryptoPeriod').value;
        const showFearGreed = document.getElementById('showCryptoFearGreed').checked;

        const datasets = [];
        let data = this.cryptoData;

        // Apply period filter
        if (period !== 'all') {
            const days = parseInt(period);
            data = data.slice(-days);
        }

        // Add Crypto Fear & Greed dataset
        if (showFearGreed) {
            const fearGreedValues = data.map(d => parseInt(d.fear_greed_value));

            // Create color array for each point based on Fear & Greed value
            const pointColors = fearGreedValues.map(value => {
                if (value === null || isNaN(value)) return '#f59e0b';
                return this.getFearGreedColor(value);
            });

            datasets.push({
                label: '암호화폐 Fear & Greed 지수',
                data: fearGreedValues,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.1,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            });
        }

        this.cryptoChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: datasets
            },
            options: this.getChartOptions('암호화폐 Fear & Greed 지수')
        });
    }

    setupEventListeners() {
        // Period selectors
        document.getElementById('stockPeriod').addEventListener('change', () => {
            this.renderStockChart();
        });

        document.getElementById('cryptoPeriod').addEventListener('change', () => {
            this.renderCryptoChart();
        });

        // Toggle switches
        document.getElementById('showStockFearGreed').addEventListener('change', () => {
            this.renderStockChart();
        });

        document.getElementById('showSP500').addEventListener('change', () => {
            this.renderStockChart();
        });

        document.getElementById('showNASDAQ').addEventListener('change', () => {
            this.renderStockChart();
        });

        document.getElementById('showCryptoFearGreed').addEventListener('change', () => {
            this.renderCryptoChart();
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
                },
                tooltip: {
                    callbacks: {
                        afterLabel: (context) => {
                            // Add Fear & Greed interpretation for Fear & Greed datasets
                            if (context.dataset.label.includes('Fear & Greed')) {
                                const value = context.parsed.y;
                                if (value !== null && !isNaN(value)) {
                                    return `해석: ${this.getFearGreedLabel(value)}`;
                                }
                            }
                            return '';
                        }
                    }
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
                        text: '지수 값'
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
        };
    }

    getFearGreedLabel(value) {
        if (value <= 24) return '극도의 공포';
        if (value <= 44) return '공포';
        if (value <= 55) return '중립';
        if (value <= 75) return '탐욕';
        return '극도의 탐욕';
    }

    getFearGreedColor(value) {
        if (value <= 24) return '#dc2626';
        if (value <= 44) return '#ea580c';
        if (value <= 55) return '#ca8a04';
        if (value <= 75) return '#16a34a';
        return '#15803d';
    }

    updateLastUpdateTime() {
        const now = new Date();
        document.getElementById('last-update').textContent = now.toLocaleString('ko-KR');
    }

    showError(message) {
        const container = document.querySelector('.charts-container');
        container.innerHTML = `<div class="error">${message}</div>`;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FearGreedDashboard();
});