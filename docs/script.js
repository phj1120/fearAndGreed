// Fear & Greed Index Dashboard JavaScript

class FearGreedDashboard {
    constructor() {
        this.stockCombinedData = [];
        this.cryptoCombinedData = [];
        this.vixData = [];
        this.btcPremiumData = [];
        this.goldPremiumData = [];
        this.stockChart = null;
        this.cryptoChart = null;
        this.premiumChart = null;

        this.init();
    }

    async init() {
        this.showLoadingState();
        await this.loadData();
        this.renderMetrics();
        this.renderCharts();
        this.setupEventListeners();
        this.updateLastUpdateTime();
    }

    showLoadingState() {
        document.getElementById('stock-current').textContent = '...';
        document.getElementById('crypto-current').textContent = '...';
        document.getElementById('stock-label').textContent = '데이터 로딩 중';
        document.getElementById('crypto-label').textContent = '데이터 로딩 중';
    }

    async loadData() {
        const dataFiles = [
            { name: 'stock.csv',     path: './data/stock.csv',     target: 'stockCombinedData' },
            { name: 'coin.csv',      path: './data/coin.csv',      target: 'cryptoCombinedData' },
            { name: 'vix_index.csv', path: './data/vix_index.csv', target: 'vixData' },
            { name: 'btc_premium.csv', path: './data/btc_premium.csv', target: 'btcPremiumData' },
            { name: 'gold.csv',      path: './data/gold.csv',      target: 'goldPremiumData' },
        ];

        const results = await Promise.allSettled(
            dataFiles.map(async (file) => {
                const response = await fetch(file.path);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const text = await response.text();
                const parsed = this.parseCSV(text);
                if (parsed.length === 0) throw new Error('empty file');
                this[file.target] = parsed;
                console.log(`Loaded ${file.name}: ${parsed.length} rows`);
            })
        );

        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.warn(`Failed to load ${dataFiles[i].name}:`, result.reason.message);
            }
        });
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] !== undefined ? values[index].trim() : '';
            });
            return obj;
        }).filter(row => row.date);
    }

    renderMetrics() {
        if (this.stockCombinedData.length > 0) {
            const stockWithValue = [...this.stockCombinedData].reverse().find(d => d.fear_greed && !isNaN(parseInt(d.fear_greed)));
            if (stockWithValue) {
                const value = parseInt(stockWithValue.fear_greed);
                document.getElementById('stock-current').textContent = value;
                document.getElementById('stock-label').textContent = this.getFearGreedLabel(value);
                document.getElementById('stock-date').textContent = stockWithValue.date;
                document.querySelector('.metric-card.stock').style.borderLeftColor = this.getFearGreedColor(value);
            }
        } else {
            document.getElementById('stock-current').textContent = '-';
            document.getElementById('stock-label').textContent = '데이터 없음';
        }

        if (this.cryptoCombinedData.length > 0) {
            const cryptoWithValue = [...this.cryptoCombinedData].reverse().find(d => d.crypto_fear_greed && !isNaN(parseInt(d.crypto_fear_greed)));
            if (cryptoWithValue) {
                const value = parseInt(cryptoWithValue.crypto_fear_greed);
                document.getElementById('crypto-current').textContent = value;
                document.getElementById('crypto-label').textContent = this.getFearGreedLabel(value);
                document.getElementById('crypto-date').textContent = cryptoWithValue.date;
                document.querySelector('.metric-card.crypto').style.borderLeftColor = this.getFearGreedColor(value);
            }
        } else {
            document.getElementById('crypto-current').textContent = '-';
            document.getElementById('crypto-label').textContent = '데이터 없음';
        }
    }

    renderCharts() {
        this.renderStockChart();
        this.renderCryptoChart();
        this.renderPremiumChart();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    toTimeSeries(data, dateKey, valueKey) {
        return data
            .map(d => [new Date(d[dateKey]).getTime(), parseFloat(d[valueKey])])
            .filter(([, v]) => !isNaN(v));
    }

    getDateRange(period) {
        if (period === 'all') return {};
        const days = parseInt(period);
        return {
            xAxis: {
                min: Date.now() - days * 86400000,
                max: Date.now(),
            },
        };
    }

    showChartError(containerId, message) {
        const el = document.getElementById(containerId);
        if (el) {
            el.innerHTML = `<div class="chart-error">${message}</div>`;
        }
    }

    // ── Stock Chart ───────────────────────────────────────────────────────────

    renderStockChart() {
        const period      = document.getElementById('stockPeriod').value;
        const showFG      = document.getElementById('showStockFearGreed').checked;
        const showSP500   = document.getElementById('showSP500').checked;
        const showNASDAQ  = document.getElementById('showNASDAQ').checked;
        const showVIX     = document.getElementById('showVIX').checked;

        if (this.stockCombinedData.length === 0 && this.vixData.length === 0) {
            this.showChartError('stockChart', '주식 데이터를 불러올 수 없습니다.');
            return;
        }

        const series = [];

        if (showFG && this.stockCombinedData.length > 0) {
            series.push({
                name: 'Fear & Greed 지수',
                data: this.toTimeSeries(this.stockCombinedData, 'date', 'fear_greed'),
                yAxis: 0,
                tooltip: { valueDecimals: 0 },
                color: '#4CAF50',
                connectNulls: false,
            });
        }
        if (showSP500 && this.stockCombinedData.length > 0) {
            series.push({
                name: 'S&P 500',
                data: this.toTimeSeries(this.stockCombinedData, 'date', 'sp500'),
                yAxis: 1,
                tooltip: { valueDecimals: 2 },
                color: '#10b981',
                connectNulls: false,
            });
        }
        if (showNASDAQ && this.stockCombinedData.length > 0) {
            series.push({
                name: 'NASDAQ',
                data: this.toTimeSeries(this.stockCombinedData, 'date', 'nasdaq'),
                yAxis: 2,
                tooltip: { valueDecimals: 2 },
                color: '#8b5cf6',
                connectNulls: false,
            });
        }
        if (showVIX && this.vixData.length > 0) {
            series.push({
                name: 'VIX (공포지수)',
                data: this.toTimeSeries(this.vixData, 'date', 'close_price'),
                yAxis: 3,
                tooltip: { valueDecimals: 2 },
                color: '#ef4444',
                connectNulls: false,
            });
        }

        if (this.stockChart) this.stockChart.destroy();
        this.stockChart = Highcharts.stockChart('stockChart', {
            ...this.getBaseChartOptions('주식 관련 지수', period),
            yAxis: [
                {
                    labels: { format: '{value}', style: { color: '#4CAF50' } },
                    title: { text: 'Fear & Greed', style: { color: '#4CAF50' } },
                    opposite: false,
                    min: 0, max: 100,
                },
                {
                    title: { text: null },
                    labels: { format: '{value:,.0f}', style: { color: '#10b981' } },
                    opposite: true,
                },
                {
                    title: { text: null },
                    labels: { format: '{value:,.0f}', style: { color: '#8b5cf6' } },
                    opposite: true,
                    linkedTo: 1,
                    visible: false,
                },
                {
                    title: { text: 'VIX', style: { color: '#ef4444' } },
                    labels: { format: '{value:.0f}', style: { color: '#ef4444' } },
                    opposite: true,
                    min: 0,
                },
            ],
            series,
        });
    }

    // ── Crypto Chart ──────────────────────────────────────────────────────────

    renderCryptoChart() {
        const period  = document.getElementById('cryptoPeriod').value;
        const showFG  = document.getElementById('showCryptoFearGreed').checked;
        const showBTC = document.getElementById('showBTC').checked;
        const showETH = document.getElementById('showETH').checked;
        const showSOL = document.getElementById('showSOL').checked;
        const showXRP = document.getElementById('showXRP').checked;

        if (this.cryptoCombinedData.length === 0) {
            this.showChartError('cryptoChart', '암호화폐 데이터를 불러올 수 없습니다.');
            return;
        }

        const series = [];

        if (showFG) {
            series.push({
                name: '암호화폐 Fear & Greed',
                data: this.toTimeSeries(this.cryptoCombinedData, 'date', 'crypto_fear_greed'),
                yAxis: 0,
                tooltip: { valueDecimals: 0 },
                color: '#FFC107',
                connectNulls: false,
            });
        }
        if (showBTC) {
            series.push({
                name: 'Bitcoin',
                data: this.toTimeSeries(this.cryptoCombinedData, 'date', 'bitcoin'),
                yAxis: 1,
                tooltip: { valuePrefix: '$', valueDecimals: 2 },
                color: '#f7931a',
                connectNulls: false,
            });
        }
        if (showETH) {
            series.push({
                name: 'Ethereum',
                data: this.toTimeSeries(this.cryptoCombinedData, 'date', 'ethereum'),
                yAxis: 1,
                tooltip: { valuePrefix: '$', valueDecimals: 2 },
                color: '#627eea',
                connectNulls: false,
            });
        }
        if (showSOL) {
            series.push({
                name: 'Solana',
                data: this.toTimeSeries(this.cryptoCombinedData, 'date', 'solana'),
                yAxis: 1,
                tooltip: { valuePrefix: '$', valueDecimals: 2 },
                color: '#9945ff',
                connectNulls: false,
            });
        }
        if (showXRP) {
            series.push({
                name: 'Ripple',
                data: this.toTimeSeries(this.cryptoCombinedData, 'date', 'ripple'),
                yAxis: 1,
                tooltip: { valuePrefix: '$', valueDecimals: 4 },
                color: '#23292f',
                connectNulls: false,
            });
        }

        if (this.cryptoChart) this.cryptoChart.destroy();
        this.cryptoChart = Highcharts.stockChart('cryptoChart', {
            ...this.getBaseChartOptions('암호화폐 관련 지수', period),
            yAxis: [
                {
                    labels: { format: '{value}', style: { color: '#FFC107' } },
                    title: { text: 'Fear & Greed', style: { color: '#FFC107' } },
                    opposite: false,
                    min: 0, max: 100,
                },
                {
                    title: { text: 'Price (USD)' },
                    labels: { format: '${value:,.0f}', style: { color: '#f7931a' } },
                    opposite: true,
                },
            ],
            series,
        });
    }

    // ── Premium Chart ─────────────────────────────────────────────────────────

    renderPremiumChart() {
        const period         = document.getElementById('premiumPeriod').value;
        const showBtcPremium = document.getElementById('showBtcPremium').checked;
        const showGoldPremium = document.getElementById('showGoldPremium').checked;

        if (this.btcPremiumData.length === 0 && this.goldPremiumData.length === 0) {
            this.showChartError('premiumChart', '프리미엄 데이터를 불러올 수 없습니다.');
            return;
        }

        const series = [];

        if (showBtcPremium && this.btcPremiumData.length > 0) {
            series.push({
                name: '비트코인 김치 프리미엄',
                data: this.toTimeSeries(this.btcPremiumData, 'date', 'premium_percent'),
                yAxis: 0,
                tooltip: { valueSuffix: ' %', valueDecimals: 2 },
                color: '#f7931a',
                connectNulls: false,
            });
        }
        if (showGoldPremium && this.goldPremiumData.length > 0) {
            series.push({
                name: '금 프리미엄',
                data: this.toTimeSeries(this.goldPremiumData, 'date', 'premium_percent'),
                yAxis: 0,
                tooltip: { valueSuffix: ' %', valueDecimals: 2 },
                color: '#ffd700',
                connectNulls: false,
            });
        }

        if (this.premiumChart) this.premiumChart.destroy();
        this.premiumChart = Highcharts.stockChart('premiumChart', {
            ...this.getBaseChartOptions('프리미엄 지수', period),
            yAxis: [{
                labels: { format: '{value}%', style: { color: '#f7931a' } },
                title: { text: 'Premium (%)' },
                plotLines: [{
                    value: 0,
                    color: '#999',
                    dashStyle: 'Dash',
                    width: 1,
                }],
            }],
            tooltip: {
                shared: true,
                pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y:.2f}%</b><br/>',
            },
            series,
        });
    }

    // ── Chart Base Options ────────────────────────────────────────────────────

    getBaseChartOptions(title, period) {
        const range = this.getDateRange(period);
        return {
            chart: { zoomType: 'x' },
            title: { text: title },
            xAxis: { type: 'datetime', ...(range.xAxis || {}) },
            tooltip: { shared: true },
            legend: { enabled: true },
            rangeSelector: { enabled: false },
            navigator: { enabled: true },
            scrollbar: { enabled: false },
        };
    }

    // ── Event Listeners ───────────────────────────────────────────────────────

    setupEventListeners() {
        const stockControls = ['stockPeriod', 'showStockFearGreed', 'showSP500', 'showNASDAQ', 'showVIX'];
        stockControls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderStockChart());
        });

        const cryptoControls = ['cryptoPeriod', 'showCryptoFearGreed', 'showBTC', 'showETH', 'showSOL', 'showXRP'];
        cryptoControls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderCryptoChart());
        });

        const premiumControls = ['premiumPeriod', 'showBtcPremium', 'showGoldPremium'];
        premiumControls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderPremiumChart());
        });
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

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
        const el = document.getElementById('last-update');
        if (el) el.textContent = new Date().toLocaleString('ko-KR');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FearGreedDashboard();
});
