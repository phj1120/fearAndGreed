# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an investment-focused application called "fearAndGreed" (공포와 탐욕). The project is designed to contain investment-related content and analysis tools.

## Current Status

**Technology Stack**: Python-based data collection system
**Implementation**: Automated Fear & Greed index data collection with GitHub Actions

## Development Commands

### Setup
```bash
pip install -r requirements.txt
```

### Data Collection
```bash
# Manual data collection
python data_collector.py

# Check collected data
ls data/
```

### GitHub Actions
- **Automatic**: Runs daily at 9:00 AM KST (00:00 UTC)
- **Manual**: Can be triggered via GitHub Actions tab > "Run workflow"

### Project Structure
```
fearAndGreed/
├── data/
│   ├── stock_fear_greed.csv      # CNN Fear & Greed Index data
│   └── crypto_fear_greed.csv     # Alternative.me Fear & Greed data
├── data_collector.py             # Main data collection script
├── requirements.txt              # Python dependencies
└── .github/workflows/
    └── daily-data-collection.yml # GitHub Actions workflow
```

## Architecture Considerations

### Investment Application Components
When implementing this investment-focused application, consider these typical components:

1. **Data Layer**
   - Market data APIs integration
   - Historical price data storage
   - Economic indicators tracking

2. **Analysis Engine**
   - Fear and Greed Index calculation
   - Sentiment analysis algorithms
   - Technical indicator computations

3. **Visualization Layer**
   - Charts and graphs for market data
   - Dashboard for key metrics
   - Historical trend visualization

4. **User Interface**
   - Investment portfolio tracking
   - Market sentiment display
   - Educational content presentation

### Current Data Sources
- **Stock Fear & Greed**: CNN Fear & Greed Index API
  - URL: `https://production.dataviz.cnn.io/index/fearandgreed/graphdata`
  - Data: Historical daily values with timestamps
  - Format: JSON with timestamp (ms) and value

- **Crypto Fear & Greed**: Alternative.me API
  - URL: `https://api.alternative.me/fng/?limit=0&format=json`
  - Data: Up to ~2 years of historical data
  - Format: JSON with timestamp, value (0-100), and classification

### Additional Data Sources to Consider
- Financial market APIs (Alpha Vantage, Yahoo Finance, etc.)
- News sentiment data
- Social media sentiment indicators
- Economic calendar data

## Development Workflow

### Git Workflow
- Use feature branches for new functionality
- Create meaningful commit messages in Korean or English
- Test thoroughly before merging to main

### Testing Strategy
- Unit tests for calculation logic
- Integration tests for API connections
- End-to-end tests for user workflows

### Documentation
- Document API integrations and data sources
- Maintain clear README for setup instructions
- Document investment calculation methodologies

## Technology Stack Recommendations

Consider these options based on project requirements:

### Web Application
- **Frontend**: React/Vue.js + Chart.js/D3.js for visualizations
- **Backend**: Node.js/Express or Python/FastAPI
- **Database**: PostgreSQL for time-series data

### Desktop Application
- **Cross-platform**: Electron + React or Tauri + React
- **Native**: Python + tkinter/PyQt

### Data Analysis Focus
- **Python**: pandas, numpy, matplotlib for analysis
- **R**: For statistical analysis and visualization

## Notes for Future Development

- Ensure compliance with financial data usage terms
- Implement proper error handling for API failures
- Consider rate limiting for external API calls
- Plan for real-time data updates if needed
- Implement proper data validation for financial calculations