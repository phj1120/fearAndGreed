#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fear & Greed Index Data Collector
Collects daily Fear & Greed index data for stocks and cryptocurrencies
"""

import requests
import pandas as pd
import os
from datetime import datetime, timedelta
import json
import time
import yfinance as yf
import numpy as np
from pandas.tseries.holiday import USFederalHolidayCalendar
from pandas.tseries.offsets import CustomBusinessDay
from bs4 import BeautifulSoup
import re


class FearGreedCollector:
    def __init__(self, daily_mode=False):
        self.data_dir = "data"
        self.stock_csv = os.path.join(self.data_dir, "stock_fear_greed.csv")
        self.crypto_csv = os.path.join(self.data_dir, "crypto_fear_greed.csv")
        self.sp500_csv = os.path.join(self.data_dir, "sp500_index.csv")
        self.nasdaq_csv = os.path.join(self.data_dir, "nasdaq_index.csv")

        # Collection mode: True for daily updates, False for full collection
        self.daily_mode = daily_mode

        # Ensure data directory exists
        os.makedirs(self.data_dir, exist_ok=True)

        # US business day calendar (excluding weekends and federal holidays)
        self.us_bd = CustomBusinessDay(calendar=USFederalHolidayCalendar())

    def fill_missing_business_days_with_real_data(self, df, date_col='date', value_col=None):
        """
        Fill missing business days with REAL data first, then fallback to interpolation
        """
        if df.empty:
            return df

        # Convert date column to datetime
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.sort_values(date_col)

        # Create business day range
        start_date = df[date_col].min()
        end_date = df[date_col].max()
        business_days = pd.bdate_range(start=start_date, end=end_date, freq=self.us_bd)

        # Create complete business day DataFrame
        complete_df = pd.DataFrame({date_col: business_days})

        # Merge with existing data
        merged_df = complete_df.merge(df, on=date_col, how='left')

        # Find missing business days
        if value_col and value_col in merged_df.columns:
            missing_mask = merged_df[value_col].isna()
            missing_dates = merged_df[missing_mask][date_col]

            if len(missing_dates) > 0:
                print(f"Found {len(missing_dates)} missing business days")

                # PRIORITY 1: Try to fetch REAL data for missing dates
                if value_col == 'fear_greed_value':  # Only for Fear & Greed data
                    print("Attempting to fetch REAL Fear & Greed data...")
                    real_data = self.get_missing_fear_greed_data_comprehensive(missing_dates)

                    # Update with real data
                    for item in real_data:
                        mask = merged_df[date_col].dt.date == item['date']
                        merged_df.loc[mask, value_col] = item['fear_greed_value']
                        print(f"Updated {item['date']} with real value: {item['fear_greed_value']}")

                # PRIORITY 2: For remaining missing values, use forward fill as last resort
                still_missing = merged_df[value_col].isna().sum()
                if still_missing > 0:
                    print(f"Forward filling {still_missing} remaining missing values...")
                    merged_df[value_col] = merged_df[value_col].ffill()

        # For multiple columns, try real data then forward fill
        else:
            for col in merged_df.columns:
                if col != date_col:
                    merged_df[col] = merged_df[col].ffill()

        # Convert date back to date format
        merged_df[date_col] = merged_df[date_col].dt.date

        return merged_df

    def get_missing_fear_greed_data_comprehensive(self, missing_dates):
        """
        Comprehensive approach to fetch missing Fear & Greed data using multiple methods
        """
        filled_data = []

        print(f"Attempting to fetch real data for {len(missing_dates)} missing dates...")

        for i, date in enumerate(missing_dates):
            if i % 10 == 0:
                print(f"Progress: {i+1}/{len(missing_dates)}")

            success = False
            date_str = date.strftime('%Y-%m-%d')

            # Method 1: CNN API with specific date
            if not success:
                success, value = self._try_cnn_api_date(date, date_str)
                if success:
                    filled_data.append({
                        'date': date.date(),
                        'fear_greed_value': int(round(float(value), 0))
                    })
                    print(f"[SUCCESS] CNN API: {date_str} = {value}")

            # Method 2: MacroMicro API
            if not success:
                success, value = self._try_macromicro_api(date, date_str)
                if success:
                    filled_data.append({
                        'date': date.date(),
                        'fear_greed_value': int(round(float(value), 0))
                    })
                    print(f"[SUCCESS] MacroMicro: {date_str} = {value}")

            # Method 3: Web scraping CNN archive
            if not success:
                success, value = self._try_cnn_web_scraping(date, date_str)
                if success:
                    filled_data.append({
                        'date': date.date(),
                        'fear_greed_value': int(round(float(value), 0))
                    })
                    print(f"[SUCCESS] Web Scraping: {date_str} = {value}")

            if not success:
                print(f"[FAILED] Could not fetch: {date_str}")

            # Rate limiting
            time.sleep(0.3)

        print(f"Successfully fetched {len(filled_data)}/{len(missing_dates)} missing data points")
        return filled_data

    def _try_cnn_api_date(self, date, date_str):
        """Method 1: Try CNN API with specific date"""
        try:
            # Multiple URL patterns to try
            urls = [
                f"https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{date_str}",
                f"https://production.dataviz.cnn.io/index/fearandgreed/graphdata?date={date_str}",
                "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
            ]

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.cnn.com/'
            }

            for url in urls:
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()

                    # Check current value
                    if 'fear_and_greed' in data:
                        current_value = data['fear_and_greed'].get('score')
                        if current_value:
                            return True, current_value

                    # Check historical data for specific date
                    if 'fear_and_greed_historical' in data:
                        hist_data = data['fear_and_greed_historical'].get('data', [])
                        for item in hist_data:
                            item_date = pd.to_datetime(item['x'], unit='ms').date()
                            if item_date == date.date():
                                return True, item['y']

        except Exception as e:
            print(f"CNN API error for {date_str}: {e}")

        return False, None

    def _try_macromicro_api(self, date, date_str):
        """Method 2: Try MacroMicro API"""
        try:
            url = "https://en.macromicro.me/charts/data/50108"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://en.macromicro.me/charts/50108/cnn-fear-and-greed'
            }

            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()

                # Parse MacroMicro data format
                if 'data' in data:
                    for item in data['data']:
                        # MacroMicro date format parsing
                        if 'date' in item and 'value' in item:
                            item_date = pd.to_datetime(item['date']).date()
                            if item_date == date.date():
                                return True, item['value']

        except Exception as e:
            print(f"MacroMicro API error for {date_str}: {e}")

        return False, None

    def _try_cnn_web_scraping(self, date, date_str):
        """Method 3: Web scraping CNN Fear & Greed page"""
        try:
            # Try to scrape historical data from CNN website
            url = "https://www.cnn.com/markets/fear-and-greed"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }

            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')

                # Look for JSON data in script tags
                scripts = soup.find_all('script')
                for script in scripts:
                    if script.string and 'fearandgreed' in script.string.lower():
                        # Try to extract JSON data
                        json_match = re.search(r'(\{.*fearandgreed.*\})', script.string, re.IGNORECASE | re.DOTALL)
                        if json_match:
                            try:
                                json_data = json.loads(json_match.group(1))
                                # Parse the extracted JSON for our date
                                if 'fear_and_greed_historical' in json_data:
                                    hist_data = json_data['fear_and_greed_historical'].get('data', [])
                                    for item in hist_data:
                                        item_date = pd.to_datetime(item['x'], unit='ms').date()
                                        if item_date == date.date():
                                            return True, item['y']
                            except:
                                continue

        except Exception as e:
            print(f"Web scraping error for {date_str}: {e}")

        return False, None

    def collect_today_stock_fear_greed(self):
        """
        Collect only today's stock Fear & Greed data (for daily updates)
        """
        try:
            today = datetime.now().date()
            print(f"Collecting today's stock Fear & Greed data: {today}")

            # Try to get today's data
            success, value = self._try_cnn_api_date(pd.to_datetime(today), today.strftime('%Y-%m-%d'))

            if success:
                new_data = [{
                    'date': today,
                    'fear_greed_value': int(round(float(value), 0))
                }]

                # Load existing data
                if os.path.exists(self.stock_csv):
                    df_existing = pd.read_csv(self.stock_csv, encoding='utf-8')
                    df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date

                    # Remove today's data if already exists
                    df_existing = df_existing[df_existing['date'] != today]

                    # Add new data
                    df_new = pd.DataFrame(new_data)
                    df_combined = pd.concat([df_existing, df_new], ignore_index=True)
                else:
                    df_combined = pd.DataFrame(new_data)

                # Sort and save
                df_combined = df_combined.sort_values('date')
                df_combined.to_csv(self.stock_csv, index=False, encoding='utf-8')

                print(f"Stock Fear & Greed updated for {today}: {value}")
                return True
            else:
                print(f"Could not fetch stock Fear & Greed data for {today}")
                return False

        except Exception as e:
            print(f"Error collecting today's stock Fear & Greed data: {e}")
            return False

    def collect_today_crypto_fear_greed(self):
        """
        Collect only today's crypto Fear & Greed data (for daily updates)
        """
        try:
            today = datetime.now().date()
            print(f"Collecting today's crypto Fear & Greed data: {today}")

            # Get latest crypto data (Alternative.me always returns recent data)
            url = "https://api.alternative.me/fng/?limit=1&format=json"
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            data = response.json()

            if not data.get('metadata', {}).get('error') and data.get('data'):
                latest_item = data['data'][0]
                item_date = pd.to_datetime(latest_item['timestamp'], unit='s').date()

                # Check if it's today's data
                if item_date == today:
                    new_data = [{
                        'date': today,
                        'fear_greed_value': int(latest_item['value']),
                        'classification': latest_item['value_classification']
                    }]

                    # Load existing data
                    if os.path.exists(self.crypto_csv):
                        df_existing = pd.read_csv(self.crypto_csv, encoding='utf-8')
                        df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date

                        # Remove today's data if already exists
                        df_existing = df_existing[df_existing['date'] != today]

                        # Add new data
                        df_new = pd.DataFrame(new_data)
                        df_combined = pd.concat([df_existing, df_new], ignore_index=True)
                    else:
                        df_combined = pd.DataFrame(new_data)

                    # Sort and save
                    df_combined = df_combined.sort_values('date')
                    df_combined.to_csv(self.crypto_csv, index=False, encoding='utf-8')

                    print(f"Crypto Fear & Greed updated for {today}: {latest_item['value']}")
                    return True
                else:
                    print(f"Latest crypto data is for {item_date}, not today ({today})")
                    return False

        except Exception as e:
            print(f"Error collecting today's crypto Fear & Greed data: {e}")
            return False

    def collect_today_stock_indices(self):
        """
        Collect only today's stock indices data (for daily updates)
        """
        try:
            today = datetime.now().date()
            yesterday = today - timedelta(days=1)

            print(f"Collecting today's stock indices data: {today}")

            # Get recent data (last 5 days to ensure we get latest trading day)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=5)

            # S&P 500
            sp500 = yf.download('^GSPC', start=start_date, end=end_date, progress=False)
            if not sp500.empty:
                latest_sp500 = sp500[['Close']].tail(1).reset_index()
                latest_sp500.columns = ['date', 'close_price']
                latest_sp500['date'] = latest_sp500['date'].dt.date
                latest_sp500['close_price'] = latest_sp500['close_price'].round(0).astype(int)

                # Update existing data
                if os.path.exists(self.sp500_csv):
                    df_existing = pd.read_csv(self.sp500_csv, encoding='utf-8')
                    df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date

                    # Remove recent dates and add new data
                    df_existing = df_existing[df_existing['date'] < yesterday]
                    df_combined = pd.concat([df_existing, latest_sp500], ignore_index=True)
                else:
                    df_combined = latest_sp500

                df_combined = df_combined.sort_values('date')
                df_combined.to_csv(self.sp500_csv, index=False, encoding='utf-8')
                print(f"S&P 500 updated: {latest_sp500.iloc[0]['date']} = {latest_sp500.iloc[0]['close_price']:.2f}")

            time.sleep(1)  # Rate limiting

            # NASDAQ
            nasdaq = yf.download('^IXIC', start=start_date, end=end_date, progress=False)
            if not nasdaq.empty:
                latest_nasdaq = nasdaq[['Close']].tail(1).reset_index()
                latest_nasdaq.columns = ['date', 'close_price']
                latest_nasdaq['date'] = latest_nasdaq['date'].dt.date
                latest_nasdaq['close_price'] = latest_nasdaq['close_price'].round(0).astype(int)

                # Update existing data
                if os.path.exists(self.nasdaq_csv):
                    df_existing = pd.read_csv(self.nasdaq_csv, encoding='utf-8')
                    df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date

                    # Remove recent dates and add new data
                    df_existing = df_existing[df_existing['date'] < yesterday]
                    df_combined = pd.concat([df_existing, latest_nasdaq], ignore_index=True)
                else:
                    df_combined = latest_nasdaq

                df_combined = df_combined.sort_values('date')
                df_combined.to_csv(self.nasdaq_csv, index=False, encoding='utf-8')
                print(f"NASDAQ updated: {latest_nasdaq.iloc[0]['date']} = {latest_nasdaq.iloc[0]['close_price']:.2f}")

            return True

        except Exception as e:
            print(f"Error collecting today's stock indices: {e}")
            return False

    def validate_business_day_data(self, csv_file, data_name):
        """
        Validate that data contains only business days and report statistics
        """
        try:
            if not os.path.exists(csv_file):
                print(f"File {csv_file} does not exist")
                return False

            df = pd.read_csv(csv_file, encoding='utf-8')
            df['date'] = pd.to_datetime(df['date'])

            print(f"\n=== {data_name} Validation ===")
            print(f"Total records: {len(df)}")
            print(f"Date range: {df['date'].min().date()} to {df['date'].max().date()}")

            # Check for weekends
            weekends = df[df['date'].dt.weekday >= 5]
            if len(weekends) > 0:
                print(f"[WARNING] Found {len(weekends)} weekend dates")
            else:
                print("[OK] No weekend dates found")

            # Check for missing business days
            business_days = pd.bdate_range(start=df['date'].min(), end=df['date'].max(), freq=self.us_bd)
            missing_business_days = set(business_days) - set(df['date'])

            if len(missing_business_days) > 0:
                print(f"[WARNING] Missing {len(missing_business_days)} business days ({len(missing_business_days)/len(business_days)*100:.1f}%)")
                # Show first few missing dates
                missing_sorted = sorted(list(missing_business_days))[:5]
                print(f"First few missing dates: {[d.date() for d in missing_sorted]}")
            else:
                print("[OK] All business days present")

            # Check for null values
            null_count = df.isnull().sum().sum()
            if null_count > 0:
                print(f"[WARNING] Found {null_count} null values")
            else:
                print("[OK] No null values found")

            return True

        except Exception as e:
            print(f"Error validating {data_name}: {e}")
            return False

    def collect_historical_stock_fear_greed(self):
        """
        Collect historical stock Fear & Greed data from GitHub repository (2011-2023)
        """
        try:
            print("Collecting historical stock Fear & Greed data from GitHub...")

            # GitHub CSV with historical data
            github_url = "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed-2011-2023.csv"

            response = requests.get(github_url, timeout=15)
            response.raise_for_status()

            # Parse CSV content
            from io import StringIO
            csv_content = StringIO(response.text)
            df_historical = pd.read_csv(csv_content)

            # Ensure proper date format and column names
            if 'Date' in df_historical.columns:
                df_historical.rename(columns={'Date': 'date'}, inplace=True)
            if 'Fear Greed' in df_historical.columns:
                df_historical.rename(columns={'Fear Greed': 'fear_greed_value'}, inplace=True)

            # Convert date column and round values
            df_historical['date'] = pd.to_datetime(df_historical['date']).dt.date
            df_historical['fear_greed_value'] = pd.to_numeric(df_historical['fear_greed_value'], errors='coerce').round(0).astype(int)
            df_historical = df_historical[['date', 'fear_greed_value']].copy()
            df_historical = df_historical.sort_values('date')

            print(f"Historical data collected: {len(df_historical)} records")
            return df_historical

        except Exception as e:
            print(f"Error collecting historical data from GitHub: {e}")
            return None

    def collect_stock_fear_greed(self):
        """
        Collect stock Fear & Greed index from CNN (recent data) and GitHub (historical data)
        """
        try:
            # First, get historical data from GitHub
            df_historical = self.collect_historical_stock_fear_greed()

            # Then get recent data from CNN
            url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://www.cnn.com/'
            }

            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()

            data = response.json()
            print(f"Stock API response keys: {list(data.keys())}")

            # Extract recent data from CNN
            fear_greed_data = None
            possible_keys = ['fear_and_greed_historical', 'fear_greed_historical', 'data', 'historicalData', 'historical']

            for key in possible_keys:
                if key in data:
                    if isinstance(data[key], dict) and 'data' in data[key]:
                        fear_greed_data = data[key]['data']
                        print(f"Found recent data in {key}['data'] with {len(fear_greed_data)} records")
                    elif isinstance(data[key], list):
                        fear_greed_data = data[key]
                        print(f"Found recent data in {key} with {len(fear_greed_data)} records")
                    break

            df_recent = None
            if fear_greed_data:
                # Convert recent data to DataFrame
                df_recent = pd.DataFrame(fear_greed_data)
                df_recent['date'] = pd.to_datetime(df_recent['x'], unit='ms').dt.date
                df_recent['fear_greed_value'] = df_recent['y'].round(0).astype(int)
                df_recent = df_recent[['date', 'fear_greed_value']].copy()
                df_recent = df_recent.sort_values('date')

            # Combine historical and recent data
            dataframes = []

            if df_historical is not None:
                dataframes.append(df_historical)

            if df_recent is not None:
                dataframes.append(df_recent)

            # Load existing data if exists
            if os.path.exists(self.stock_csv):
                df_existing = pd.read_csv(self.stock_csv, encoding='utf-8')
                df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date
                dataframes.append(df_existing)

            if dataframes:
                # Combine all data and remove duplicates
                df_combined = pd.concat(dataframes, ignore_index=True)
                df_combined = df_combined.drop_duplicates(subset=['date'], keep='last')
                df_combined = df_combined.sort_values('date')

                # Round all values to 1 decimal place first
                if 'fear_greed_value' in df_combined.columns:
                    df_combined['fear_greed_value'] = pd.to_numeric(df_combined['fear_greed_value'], errors='coerce').round(0).astype(int)

                # Fill missing business days with REAL data priority
                print("Filling missing business days for stock Fear & Greed data with REAL data...")
                df_filled = self.fill_missing_business_days_with_real_data(df_combined, 'date', 'fear_greed_value')

                # Save combined data with UTF-8 encoding
                df_filled.to_csv(self.stock_csv, index=False, encoding='utf-8')
                print(f"Stock Fear & Greed data updated: {len(df_filled)} records (business days only)")
                return True
            else:
                print("No stock Fear & Greed data could be collected")
                return False

        except Exception as e:
            print(f"Error collecting stock Fear & Greed data: {e}")
            return False

    def collect_crypto_fear_greed(self):
        """
        Collect crypto Fear & Greed index from Alternative.me
        """
        try:
            # Alternative.me provides historical data with limit parameter
            # Get maximum available data (they provide up to ~2 years)
            url = "https://api.alternative.me/fng/?limit=0&format=json"

            response = requests.get(url, timeout=10)
            response.raise_for_status()

            data = response.json()
            print(f"Crypto API response structure: {list(data.keys())}")

            # Check if API returned error
            if data.get('metadata', {}).get('error'):
                print(f"Crypto Fear & Greed API returned error: {data['metadata']['error']}")
                return False

            fear_greed_data = data.get('data', [])

            if not fear_greed_data:
                print("No crypto Fear & Greed data found")
                return False

            # Convert to DataFrame
            df_new = pd.DataFrame(fear_greed_data)
            df_new['date'] = pd.to_datetime(df_new['timestamp'], unit='s').dt.date
            df_new['fear_greed_value'] = df_new['value'].astype(int)
            df_new['classification'] = df_new['value_classification']
            df_new = df_new[['date', 'fear_greed_value', 'classification']].copy()
            df_new = df_new.sort_values('date')

            # Load existing data if exists
            if os.path.exists(self.crypto_csv):
                df_existing = pd.read_csv(self.crypto_csv, encoding='utf-8')
                df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date

                # Merge and remove duplicates
                df_combined = pd.concat([df_existing, df_new])
                df_combined = df_combined.drop_duplicates(subset=['date'], keep='last')
            else:
                df_combined = df_new

            # Sort and save crypto data (keep all days for crypto - 24/7 market)
            df_combined = df_combined.sort_values('date')

            # Save with UTF-8 encoding
            df_combined.to_csv(self.crypto_csv, index=False, encoding='utf-8')

            print(f"Crypto Fear & Greed data updated: {len(df_combined)} records (all days)")
            return True

        except Exception as e:
            print(f"Error collecting crypto Fear & Greed data: {e}")
            # Try alternative endpoint
            try:
                url = "https://api.alternative.me/fng/?limit=2000&format=json"
                response = requests.get(url, timeout=15)
                response.raise_for_status()

                data = response.json()
                print(f"Crypto API response: {data}")

                if not data.get('metadata', {}).get('error'):
                    fear_greed_data = data.get('data', [])

                    if fear_greed_data:
                        # Convert to DataFrame
                        df_new = pd.DataFrame(fear_greed_data)
                        df_new['date'] = pd.to_datetime(df_new['timestamp'], unit='s').dt.date
                        df_new['fear_greed_value'] = df_new['value'].astype(int)
                        df_new['classification'] = df_new['value_classification']
                        df_new = df_new[['date', 'fear_greed_value', 'classification']].copy()
                        df_new = df_new.sort_values('date')

                        # Load existing data if exists
                        if os.path.exists(self.crypto_csv):
                            df_existing = pd.read_csv(self.crypto_csv, encoding='utf-8')
                            df_existing['date'] = pd.to_datetime(df_existing['date']).dt.date

                            # Merge and remove duplicates
                            df_combined = pd.concat([df_existing, df_new])
                            df_combined = df_combined.drop_duplicates(subset=['date'], keep='last')
                        else:
                            df_combined = df_new

                        # Sort and save crypto data (keep all days)
                        df_combined = df_combined.sort_values('date')

                        # Save with UTF-8 encoding
                        df_combined.to_csv(self.crypto_csv, index=False, encoding='utf-8')

                        print(f"Crypto Fear & Greed data updated: {len(df_combined)} records (all days)")
                        return True

            except Exception as e2:
                print(f"Alternative crypto API also failed: {e2}")

            return False

    def collect_stock_indices(self):
        """
        Collect S&P 500 and NASDAQ index data using yfinance
        """
        try:
            # Get data for maximum available period
            end_date = datetime.now()
            start_date = datetime(2000, 1, 1)  # Start from 2000 for long historical data

            print("Collecting S&P 500 index data...")

            # S&P 500
            sp500 = yf.download('^GSPC', start=start_date, end=end_date, progress=False)
            if not sp500.empty:
                sp500_data = sp500[['Close']].reset_index()
                sp500_data.columns = ['date', 'close_price']
                sp500_data['date'] = sp500_data['date'].dt.date
                sp500_data['close_price'] = sp500_data['close_price'].round(0).astype(int)

                # Save S&P 500 data with UTF-8 encoding
                sp500_data.to_csv(self.sp500_csv, index=False, encoding='utf-8')
                print(f"S&P 500 data updated: {len(sp500_data)} records")
            else:
                print("No S&P 500 data found")

            time.sleep(1)  # Rate limiting

            print("Collecting NASDAQ index data...")

            # NASDAQ
            nasdaq = yf.download('^IXIC', start=start_date, end=end_date, progress=False)
            if not nasdaq.empty:
                nasdaq_data = nasdaq[['Close']].reset_index()
                nasdaq_data.columns = ['date', 'close_price']
                nasdaq_data['date'] = nasdaq_data['date'].dt.date
                nasdaq_data['close_price'] = nasdaq_data['close_price'].round(0).astype(int)

                # Save NASDAQ data with UTF-8 encoding
                nasdaq_data.to_csv(self.nasdaq_csv, index=False, encoding='utf-8')
                print(f"NASDAQ data updated: {len(nasdaq_data)} records")
            else:
                print("No NASDAQ data found")

            return True

        except Exception as e:
            print(f"Error collecting stock indices: {e}")
            return False

    def collect_all(self):
        """
        Collect all data: Fear & Greed indices and stock market indices
        Mode-dependent: Full collection or daily updates only
        """
        if self.daily_mode:
            print(f"Starting DAILY data collection at {datetime.now()}")
            print("Mode: Collecting only today's data")

            stock_success = self.collect_today_stock_fear_greed()
            time.sleep(1)  # Rate limiting
            crypto_success = self.collect_today_crypto_fear_greed()
            time.sleep(1)  # Rate limiting
            indices_success = self.collect_today_stock_indices()

            if stock_success and crypto_success and indices_success:
                print("Daily data collection completed successfully")
                return True
            else:
                print("Some daily data collection failed")
                return False

        else:
            print(f"Starting FULL data collection at {datetime.now()}")
            print("Mode: Collecting complete historical data")

            stock_success = self.collect_stock_fear_greed()
            time.sleep(1)  # Rate limiting
            crypto_success = self.collect_crypto_fear_greed()
            time.sleep(1)  # Rate limiting
            indices_success = self.collect_stock_indices()

            if stock_success and crypto_success and indices_success:
                print("All data collection completed successfully")

                # Validate business day data (only for full collection)
                print("\n" + "="*50)
                print("Data Validation Report")
                print("="*50)

                self.validate_business_day_data(self.stock_csv, "Stock Fear & Greed")
                self.validate_business_day_data(self.crypto_csv, "Crypto Fear & Greed (All Days)")
                self.validate_business_day_data(self.sp500_csv, "S&P 500 Index")
                self.validate_business_day_data(self.nasdaq_csv, "NASDAQ Index")

                return True
            else:
                print("Some data collection failed")
                return False


if __name__ == "__main__":
    import sys

    # Check if daily mode is requested
    daily_mode = len(sys.argv) > 1 and sys.argv[1] == "--daily"

    collector = FearGreedCollector(daily_mode=daily_mode)
    success = collector.collect_all()

    if not success:
        exit(1)
