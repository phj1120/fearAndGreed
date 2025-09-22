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

        // Add Fear & Greed dataset with colored segments
        if (showFearGreed) {
            const fearGreedValues = commonDates.map(date => {
                const item = this.stockData.find(d => d.date === date);
                return item ? parseInt(item.fear_greed_value) : null;
            });

            // Create colored line segments based on Fear & Greed values
            const fearGreedSegments = this.createColoredSegments(fearGreedValues, commonDates);
            datasets.push(...fearGreedSegments);
        }

        // Add S&P 500 dataset (normalized)
        if (showSP500) {
            const sp500Values = commonDates.map(date => {
                const item = this.sp500Data.find(d => d.date === date);
                return item ? parseFloat(item.close_price) : null;
            });

            // Normalize to 0-100 scale using min-max normalization
            const validSP500Values = sp500Values.filter(v => v !== null);
            const sp500Min = Math.min(...validSP500Values);
            const sp500Max = Math.max(...validSP500Values);
            const sp500Range = sp500Max - sp500Min;

            const sp500Normalized = sp500Values.map(val => {
                if (!val) return null;
                // Scale to 10-90 range to stay within chart bounds with some padding
                return 10 + ((val - sp500Min) / sp500Range) * 80;
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

            // Normalize to 0-100 scale using min-max normalization
            const validNasdaqValues = nasdaqValues.filter(v => v !== null);
            const nasdaqMin = Math.min(...validNasdaqValues);
            const nasdaqMax = Math.max(...validNasdaqValues);
            const nasdaqRange = nasdaqMax - nasdaqMin;

            const nasdaqNormalized = nasdaqValues.map(val => {
                if (!val) return null;
                // Scale to 10-90 range to stay within chart bounds with some padding
                return 10 + ((val - nasdaqMin) / nasdaqRange) * 80;
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

        // Add Crypto Fear & Greed dataset with colored segments
        if (showFearGreed) {
            const fearGreedValues = data.map(d => parseInt(d.fear_greed_value));
            const dates = data.map(d => d.date);

            // Create colored line segments based on Fear & Greed values
            const fearGreedSegments = this.createColoredSegments(fearGreedValues, dates, true);
            datasets.push(...fearGreedSegments);
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

    createColoredSegments(values, dates, isCrypto = false) {
        const segments = [];

        // Create segments for consecutive points of the same color category
        let currentSegment = [];
        let currentCategory = null;

        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            if (value === null || isNaN(value)) {
                // End current segment if we hit a null value
                if (currentSegment.length > 0) {
                    segments.push(this.createSegmentDataset(currentSegment, dates, currentCategory, isCrypto));
                    currentSegment = [];
                    currentCategory = null;
                }
                continue;
            }

            const category = this.getFearGreedCategory(value);

            if (currentCategory !== category) {
                // Category changed, end current segment and start new one
                if (currentSegment.length > 0) {
                    segments.push(this.createSegmentDataset(currentSegment, dates, currentCategory, isCrypto));
                }
                currentSegment = [{ index: i, value: value }];
                currentCategory = category;
            } else {
                // Same category, add to current segment
                currentSegment.push({ index: i, value: value });
            }
        }

        // Don't forget the last segment
        if (currentSegment.length > 0) {
            segments.push(this.createSegmentDataset(currentSegment, dates, currentCategory, isCrypto));
        }

        return segments;
    }

    createSegmentDataset(segment, dates, category, isCrypto) {
        const segmentData = new Array(dates.length).fill(null);

        // Fill in the values for this segment
        segment.forEach(point => {
            segmentData[point.index] = point.value;
        });

        const color = this.getFearGreedColor(segment[0].value);
        const label = isCrypto ? '암호화폐 Fear & Greed' : 'Fear & Greed 지수';
        const interpretation = this.getFearGreedLabel(segment[0].value);

        return {
            label: `${label} (${interpretation})`,
            data: segmentData,
            borderColor: color,
            backgroundColor: isCrypto ? this.hexToRgba(color, 0.1) : 'transparent',
            borderWidth: 3,
            fill: isCrypto,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: color,
            spanGaps: false
        };
    }

    getFearGreedCategory(value) {
        if (value <= 24) return 'extreme-fear';
        if (value <= 44) return 'fear';
        if (value <= 55) return 'neutral';
        if (value <= 75) return 'greed';
        return 'extreme-greed';
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
                        title: (context) => {
                            // Show formatted date
                            const date = context[0].label;
                            return new Date(date).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short'
                            });
                        },
                        label: (context) => {
                            const value = context.parsed.y;
                            const datasetLabel = context.dataset.label;

                            if (datasetLabel.includes('Fear & Greed')) {
                                if (value !== null && !isNaN(value)) {
                                    return [
                                        `${datasetLabel}: ${value}`,
                                        `해석: ${this.getFearGreedLabel(value)}`
                                    ];
                                }
                            } else if (datasetLabel.includes('정규화')) {
                                return `${datasetLabel}: ${value ? value.toFixed(1) : 'N/A'}`;
                            }

                            return `${datasetLabel}: ${value}`;
                        },
                        labelColor: (context) => {
                            return {
                                borderColor: context.dataset.borderColor,
                                backgroundColor: context.dataset.borderColor
                            };
                        }
                    },
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8
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