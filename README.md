# Fear & Greed Index Data Collector

투자 지표 개발을 위한 Fear & Greed 지수 및 주요 지수 자동 수집 시스템

## 📊 수집 데이터

- **주식 Fear & Greed 지수**: CNN + GitHub 히스토리컬 데이터 (2011-현재, ~3,700개 레코드, **거래일만**)
- **암호화폐 Fear & Greed 지수**: Alternative.me (2018-현재, ~2,800개 레코드, **전체 날짜**)
- **S&P 500 지수**: Yahoo Finance (2000-현재, ~6,500개 레코드, **거래일만**)
- **NASDAQ 지수**: Yahoo Finance (2000-현재, ~6,500개 레코드, **거래일만**)

## 🚀 사용법

### 1. 설정
```bash
pip install -r requirements.txt
```

### 2. 수동 데이터 수집
```bash
# 전체 히스토리컬 데이터 수집 (초기 설정)
python data_collector.py

# 당일 데이터만 수집 (일일 업데이트)
python data_collector.py --daily
```

### 3. 자동 수집 (GitHub Actions)
- **매일 오전 9시(KST)** 자동 실행 (daily 모드)
- **당일 데이터만** 빠르게 수집
- 새로운 데이터가 있으면 자동으로 커밋 & 푸시
- 약 1-2분 내 완료 (기존 10분+ → 1-2분으로 단축)

### 4. 웹 대시보드
- GitHub Pages를 통한 실시간 차트 대시보드
- 라인 차트로 모든 지수 시각화
- 반응형 디자인
- 거래일 기준 데이터 정규화

### 5. 데이터 품질
- **주식 데이터**: 거래일 기준, 빈 날짜 자동 채움 (forward fill)
- **암호화폐 데이터**: 24/7 시장 특성 반영, 전체 날짜 포함
- **자동 검증**: 주말/공휴일, 빈 데이터, 이상값 체크

## 📁 데이터 구조

### `data/stock_fear_greed.csv`
```csv
date,fear_greed_value
2011-01-03,68.0
2024-01-01,45.2
```

### `data/crypto_fear_greed.csv`
```csv
date,fear_greed_value,classification
2018-02-01,30,Fear
2024-01-01,25,Fear
```

### `data/sp500_index.csv`
```csv
date,close_price
2000-01-03,1455.22
2024-01-01,4769.83
```

### `data/nasdaq_index.csv`
```csv
date,close_price
2000-01-03,4186.69
2024-01-01,15011.35
```

## 📈 Fear & Greed 지수 해석

### 범위: 0-100
- **0-24**: 극도의 공포 (Extreme Fear)
- **25-44**: 공포 (Fear)
- **45-55**: 중립 (Neutral)
- **56-75**: 탐욕 (Greed)
- **76-100**: 극도의 탐욕 (Extreme Greed)

## 🔧 개발

새로운 기능 추가나 분석 도구 개발 시 [CLAUDE.md](CLAUDE.md) 참고