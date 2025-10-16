// Fear & Greed Index Dashboard JavaScript

class FearGreedDashboard {
    constructor() {
        this.stockCombinedData = [];
        this.cryptoCombinedData = [];
        this.btcPremiumData = [];
        this.goldPremiumData = [];
        this.stockChart = null;
        this.cryptoChart = null;
        this.premiumChart = null;

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
        const dataFiles = [
            { name: 'stock.csv', path: './data/stock.csv', target: 'stockCombinedData' },
            { name: 'coin.csv', path: './data/coin.csv', target: 'cryptoCombinedData' },
            { name: 'btc_premium.csv', path: './data/as-is/btc_premium.csv', target: 'btcPremiumData' },
            { name: 'gold_premium.csv', path: './data/gold.csv', target: 'goldPremiumData' },
        ];

        for (const file of dataFiles) {
            try {
                const response = await fetch(file.path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${file.name}`);
                }
                const text = await response.text();
                this[file.target] = this.parseCSV(text);
            } catch (error) {
                console.error(`Error loading or parsing ${file.name}:`, error);
                throw new Error(`데이터 파일 로드 중 오류 발생: ${file.name}. 자세한 내용은 콘솔을 확인하세요.`);
            }
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
        if (this.stockCombinedData.length > 0) {
            const latest = this.stockCombinedData[this.stockCombinedData.length - 1];
            const value = parseInt(latest.fear_greed);
            document.getElementById('stock-current').textContent = value;
            document.getElementById('stock-label').textContent = this.getFearGreedLabel(value);
            document.getElementById('stock-date').textContent = latest.date;
            document.querySelector('.metric-card.stock').style.borderLeftColor = this.getFearGreedColor(value);
        }

        if (this.cryptoCombinedData.length > 0) {
            const latest = this.cryptoCombinedData[this.cryptoCombinedData.length - 1];
            const value = parseInt(latest.crypto_fear_greed);
            document.getElementById('crypto-current').textContent = value;
            document.getElementById('crypto-label').textContent = this.getFearGreedLabel(value);
            document.getElementById('crypto-date').textContent = latest.date;
            document.querySelector('.metric-card.crypto').style.borderLeftColor = this.getFearGreedColor(value);
        }
    }

    renderCharts() {
        this.renderStockChart();
        this.renderCryptoChart();
        this.renderPremiumChart();
    }

    renderStockChart() {
        const period = document.getElementById('stockPeriod').value;
        const showFearGreed = document.getElementById('showStockFearGreed').checked;
        const showSP500 = document.getElementById('showSP500').checked;
        const showNASDAQ = document.getElementById('showNASDAQ').checked;

        const series = [];

        const fearGreedData = this.stockCombinedData.map(d => [new Date(d.date).getTime(), parseInt(d.fear_greed)]);
        const sp500Data = this.stockCombinedData.map(d => [new Date(d.date).getTime(), parseFloat(d.sp500)]);
        const nasdaqData = this.stockCombinedData.map(d => [new Date(d.date).getTime(), parseFloat(d.nasdaq)]);

        if (showFearGreed) {
            series.push({
                name: 'Fear & Greed 지수',
                data: fearGreedData,
                yAxis: 0,
                tooltip: { valueDecimals: 0 },
                color: '#4CAF50',
                connectNulls: true
            });
        }
        if (showSP500) {
            series.push({
                name: 'S&P 500',
                data: sp500Data,
                yAxis: 1,
                tooltip: { valueDecimals: 2 },
                color: '#10b981',
                connectNulls: true
            });
        }
        if (showNASDAQ) {
            series.push({
                name: 'NASDAQ',
                data: nasdaqData,
                yAxis: 2,
                tooltip: { valueDecimals: 2 },
                color: '#8b5cf6',
                connectNulls: true
            });
        }

        this.stockChart = Highcharts.stockChart('stockChart', this.getChartOptions('주식 관련 지수', series, period));
    }

    renderCryptoChart() {
        const period = document.getElementById('cryptoPeriod').value;
        const showFearGreed = document.getElementById('showCryptoFearGreed').checked;
        const showBTC = document.getElementById('showBTC').checked;
        const showETH = document.getElementById('showETH').checked;
        const showSOL = document.getElementById('showSOL').checked;
        const showXRP = document.getElementById('showXRP').checked;

        const series = [];

        const fearGreedData = this.cryptoCombinedData.map(d => [new Date(d.date).getTime(), parseInt(d.crypto_fear_greed)]);
        const btcData = this.cryptoCombinedData.map(d => [new Date(d.date).getTime(), parseFloat(d.btc)]);
        const ethData = this.cryptoCombinedData.map(d => [new Date(d.date).getTime(), parseFloat(d.eth)]);
        const solData = this.cryptoCombinedData.map(d => [new Date(d.date).getTime(), parseFloat(d.sol)]);
        const xrpData = this.cryptoCombinedData.map(d => [new Date(d.date).getTime(), parseFloat(d.xrp)]);

        if (showFearGreed) {
            series.push({
                name: '암호화폐 Fear & Greed',
                data: fearGreedData,
                yAxis: 0,
                tooltip: { valueDecimals: 0 },
                color: '#FFC107',
                connectNulls: true
            });
        }
        if (showBTC) {
            series.push({ name: 'Bitcoin', data: btcData, yAxis: 1, tooltip: { valuePrefix: '$' }, color: '#f7931a', connectNulls: true });
        }
        if (showETH) {
            series.push({ name: 'Ethereum', data: ethData, yAxis: 1, tooltip: { valuePrefix: '$' }, color: '#627eea', connectNulls: true });
        }
        if (showSOL) {
            series.push({ name: 'Solana', data: solData, yAxis: 1, tooltip: { valuePrefix: '$' }, color: '#9945ff', connectNulls: true });
        }
        if (showXRP) {
            series.push({ name: 'Ripple', data: xrpData, yAxis: 1, tooltip: { valuePrefix: '$' }, color: '#23292f', connectNulls: true });
        }

        this.cryptoChart = Highcharts.stockChart('cryptoChart', this.getChartOptions('암호화폐 관련 지수', series, period));
    }

    renderPremiumChart() {
        const period = document.getElementById('premiumPeriod').value;
        const showBtcPremium = document.getElementById('showBtcPremium').checked;
        const showGoldPremium = document.getElementById('showGoldPremium').checked;

        const series = [];

        const btcPremiumData = this.btcPremiumData.map(d => [new Date(d.date).getTime(), parseFloat(d.premium_percent)]);
        const goldPremiumData = this.goldPremiumData.map(d => [new Date(d.date).getTime(), parseFloat(d.premium_percent)]);

        if (showBtcPremium) {
            series.push({
                name: '비트코인 김치 프리미엄',
                data: btcPremiumData,
                yAxis: 0,
                tooltip: { valueSuffix: ' %' },
                color: '#f7931a',
                connectNulls: true
            });
        }
        if (showGoldPremium) {
            series.push({
                name: '금 프리미엄',
                data: goldPremiumData,
                yAxis: 0,
                tooltip: { valueSuffix: ' %' },
                color: '#ffd700',
                connectNulls: true
            });
        }

        this.premiumChart = Highcharts.stockChart('premiumChart', this.getPremiumChartOptions('프리미엄 지수', series, period));
    }

    getPremiumChartOptions(title, series, period) {
        let range = {};
        if (period !== 'all') {
            const days = parseInt(period);
            range = {
                xAxis: {
                    min: new Date().setDate(new Date().getDate() - days),
                    max: new Date().getTime()
                }
            };
        }

        return {
            chart: {
                zoomType: 'x'
            },
            title: {
                text: title
            },
            xAxis: {
                type: 'datetime'
            },
            yAxis: [{
                labels: {
                    format: '{value}% ',
                    style: {
                        color: Highcharts.getOptions().colors[1]
                    }
                },
                title: {
                    text: 'Premium (%)',
                    style: {
                        color: Highcharts.getOptions().colors[1]
                    }
                }
            }],
            tooltip: {
                shared: true,
                pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y:.2f}%</b><br/>'
            },
            legend: {
                enabled: true
            },
            series: series,
            ...range
        };
    }

    getChartOptions(title, series, period) {
        let range = {};
        if (period !== 'all') {
            const days = parseInt(period);
            range = {
                rangeSelector: {
                    selected: 0 // will be overridden by button click
                },
                xAxis: {
                    min: new Date().setDate(new Date().getDate() - days),
                    max: new Date().getTime()
                }
            };
        }


        return {
            chart: {
                zoomType: 'x'
            },
            title: {
                text: title
            },
            xAxis: {
                type: 'datetime'
            },
            yAxis: [{
                labels: {
                    format: '{value}',
                    style: {
                        color: '#4CAF50'
                    }
                },
                title: {
                    text: 'Fear & Greed',
                    style: {
                        color: '#4CAF50'
                    }
                },
                opposite: false,
                min: 0,
                max: 100
            }, {
                title: {
                    text: null
                },
                labels: {
                    format: '{value:,.0f}',
                    style: {
                        color: '#10b981'
                    }
                },
                opposite: true
            }, {
                title: {
                    text: null
                },
                labels: {
                    format: '{value:,.0f}',
                    style: {
                        color: '#8b5cf6'
                    }
                },
                opposite: true
            }],
            tooltip: {
                shared: true
            },
            legend: {
                enabled: true
            },
            series: series,
            ...range
        };
    }

    setupEventListeners() {
        document.getElementById('stockPeriod').addEventListener('change', () => this.renderStockChart());
        document.getElementById('cryptoPeriod').addEventListener('change', () => this.renderCryptoChart());
        document.getElementById('showStockFearGreed').addEventListener('change', () => this.renderStockChart());
        document.getElementById('showSP500').addEventListener('change', () => this.renderStockChart());
        document.getElementById('showNASDAQ').addEventListener('change', () => this.renderStockChart());
        document.getElementById('showCryptoFearGreed').addEventListener('change', () => this.renderCryptoChart());
        document.getElementById('showBTC').addEventListener('change', () => this.renderCryptoChart());
        document.getElementById('showETH').addEventListener('change', () => this.renderCryptoChart());
        document.getElementById('showSOL').addEventListener('change', () => this.renderCryptoChart());
        document.getElementById('showXRP').addEventListener('change', () => this.renderCryptoChart());

        // Premium chart listeners
        document.getElementById('premiumPeriod').addEventListener('change', () => this.renderPremiumChart());
        document.getElementById('showBtcPremium').addEventListener('change', () => this.renderPremiumChart());
        document.getElementById('showGoldPremium').addEventListener('change', () => this.renderPremiumChart());
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

document.addEventListener('DOMContentLoaded', () => {
    new FearGreedDashboard();
});