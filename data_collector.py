#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fear & Greed Index Data Collector
Collects and consolidates daily Fear & Greed index data for stocks and cryptocurrencies.
"""

import requests
import pandas as pd
import os
from datetime import datetime, timedelta
import time
import yfinance as yf
from bs4 import BeautifulSoup
import re
import pyupbit
import ccxt

class DataCollector:
    def __init__(self, daily_mode=False):
        self.data_dir = "data"
        self.premium_dir = os.path.join(self.data_dir, "premium")
        self.stock_csv = os.path.join(self.data_dir, "stock.csv")
        self.coin_csv = os.path.join(self.data_dir, "coin.csv")

        self.gold_csv = os.path.join("docs", "data", "gold.csv")

        self.daily_mode = daily_mode

        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.premium_dir, exist_ok=True)
        os.makedirs(os.path.join("docs", "data"), exist_ok=True)

    def _fetch_yfinance_data(self, ticker, start, end):
        print(f"Fetching {ticker} from yfinance...")
        df = yf.download(ticker, start=start, end=end, progress=False)
        if not df.empty:
            df = df[['Close']].reset_index()
            df.columns = ['date', ticker]
            df['date'] = pd.to_datetime(df['date'])
            return df
        return pd.DataFrame(columns=['date', ticker])

    def _fetch_stock_fear_greed(self):
        print("Fetching stock Fear & Greed index...")
        try:
            url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            data = response.json()['fear_and_greed_historical']['data']
            df = pd.DataFrame(data)
            df.rename(columns={'x': 'date', 'y': 'fear_greed'}, inplace=True)
            df['date'] = pd.to_datetime(df['date'], unit='ms')
            df['fear_greed'] = df['fear_greed'].round(0).astype(int)
            return df
        except Exception as e:
            print(f"Error fetching stock fear & greed: {e}")
            return pd.DataFrame(columns=['date', 'fear_greed'])

    def _fetch_crypto_fear_greed(self):
        print("Fetching crypto Fear & Greed index...")
        try:
            url = "https://api.alternative.me/fng/?limit=0&format=json"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()['data']
            df = pd.DataFrame(data)
            df['date'] = pd.to_datetime(df['timestamp'], unit='s')
            df.rename(columns={'value': 'crypto_fear_greed'}, inplace=True)
            df['crypto_fear_greed'] = df['crypto_fear_greed'].astype(int)
            return df[['date', 'crypto_fear_greed']]
        except Exception as e:
            print(f"Error fetching crypto fear & greed: {e}")
            return pd.DataFrame(columns=['date', 'crypto_fear_greed'])

    def _fetch_crypto_prices(self, coin_id):
        print(f"Fetching {coin_id} prices...")
        try:
            days = 'max' if not self.daily_mode else '2'
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart?vs_currency=usd&days={days}&interval=daily"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            prices = response.json()['prices']
            df = pd.DataFrame(prices, columns=['date', coin_id])
            df['date'] = pd.to_datetime(df['date'], unit='ms')
            df[coin_id] = df[coin_id].round(2)
            return df
        except Exception as e:
            print(f"Error fetching {coin_id} prices: {e}")
            return pd.DataFrame(columns=['date', coin_id])

    def _merge_and_save(self, df_list, output_path, date_col='date'):
        if not df_list:
            return

        merged_df = df_list[0]
        for df in df_list[1:]:
            merged_df = pd.merge(merged_df, df, on=date_col, how='outer')
        
        merged_df[date_col] = pd.to_datetime(merged_df[date_col]).dt.date
        merged_df = merged_df.sort_values(by=date_col).reset_index(drop=True)

        if self.daily_mode and os.path.exists(output_path):
            existing_df = pd.read_csv(output_path)
            existing_df[date_col] = pd.to_datetime(existing_df[date_col]).dt.date
            today = datetime.now().date()
            merged_df = merged_df[merged_df[date_col] == today]
            combined_df = pd.concat([existing_df, merged_df]).drop_duplicates(subset=[date_col], keep='last')
            combined_df.to_csv(output_path, index=False)
            print(f"Updated {output_path} with today's data.")
        else:
            merged_df.to_csv(output_path, index=False)
            print(f"Saved consolidated data to {output_path}")

    def run_stock_collection(self):
        start_date = "2000-01-01"
        end_date = datetime.now()
        
        nasdaq_df = self._fetch_yfinance_data('^IXIC', start_date, end_date).rename(columns={'^IXIC': 'nasdaq'})
        sp500_df = self._fetch_yfinance_data('^GSPC', start_date, end_date).rename(columns={'^GSPC': 'sp500'})
        fear_greed_df = self._fetch_stock_fear_greed()

        self._merge_and_save([nasdaq_df, sp500_df, fear_greed_df], self.stock_csv)

    def run_coin_collection(self):
        fear_greed_df = self._fetch_crypto_fear_greed()
        btc_df = self._fetch_crypto_prices('bitcoin')
        eth_df = self._fetch_crypto_prices('ethereum')
        sol_df = self._fetch_crypto_prices('solana')
        xrp_df = self._fetch_crypto_prices('ripple')

        self._merge_and_save([fear_greed_df, btc_df, eth_df, sol_df, xrp_df], self.coin_csv)

    def _get_usd_krw_rate(self):
        try:
            url = "https://finance.naver.com/marketindex/goldDetail.naver"
            response = requests.get(url, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            rate_element = soup.find('th', string=lambda text: text and '기준 원달러 환율' in text)
            if not rate_element or not rate_element.find_next_sibling('td'):
                return None
            rate_text = rate_element.find_next_sibling('td').text.strip().replace('원', '')
            return float(rate_text.replace(',', ''))
        except Exception as e:
            print(f"Error fetching USD/KRW rate: {e}")
            return None

    def run_premium_collection(self):
        if self.daily_mode:
            self._collect_today_gold_premium()
        else:
            self._collect_historical_gold_premium()

    def _collect_today_gold_premium(self):
        print("Collecting today's Gold premium...")
        try:
            # Fetch domestic price
            krx_gold_url = "https://finance.naver.com/marketindex/goldDetail.naver"
            response = requests.get(krx_gold_url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            price_element_parent = soup.select_one('p.no_today')
            price_text = price_element_parent.text.strip()
            price_match = re.search(r'[\d,.]+', price_text)
            krx_price = float(price_match.group().replace(',', ''))

            # Fetch international price
            gold_usd_ounce = yf.download("GC=F", period="1d")['Close'].iloc[-1]
            
            # Fetch exchange rate
            usd_krw = self._get_usd_krw_rate()

            if krx_price and gold_usd_ounce and usd_krw:
                international_price_gram = (gold_usd_ounce / 31.1035) * usd_krw
                premium = (krx_price / international_price_gram - 1) * 100
                
                df = pd.DataFrame([{
                    'date': datetime.now().date(),
                    'krx': krx_price,
                    'usd': gold_usd_ounce,
                    'usd_krw_rate': usd_krw,
                    'premium_percent': round(premium, 2)
                }])
                self._merge_and_save([df], self.gold_csv)
                print("Successfully collected today's gold premium.")
        except Exception as e:
            print(f"Error collecting today's Gold premium: {e}")

    def _collect_historical_gold_premium(self):
        print("Collecting historical Gold premium...")
        # 1. Fetch all historical data sources
        start_date = "2000-01-01"
        end_date = datetime.now().strftime('%Y-%m-%d')
        
        print("Fetching historical international gold prices (yfinance)...")
        intl_gold_df = self._fetch_yfinance_data("GC=F", start_date, end_date).rename(columns={'GC=F': 'usd'})
        
        print("Fetching historical USD/KRW exchange rates (Naver Finance)...")
        exchange_rate_df = self._fetch_historical_usd_krw(start_date, end_date)

        print("Fetching historical domestic gold prices (KRX)...")
        krx_gold_df = self._fetch_historical_krx_gold(start_date, end_date)

        # 2. Merge dataframes
        if intl_gold_df.empty or exchange_rate_df.empty or krx_gold_df.empty:
            print("Could not fetch all necessary historical data. Aborting.")
            return

        merged_df = pd.merge(krx_gold_df, intl_gold_df, on='date', how='inner')
        merged_df = pd.merge(merged_df, exchange_rate_df, on='date', how='inner')

        # 3. Calculate premium
        merged_df['premium_percent'] = (
            (merged_df['krx'] / ((merged_df['usd'] / 31.1035) * merged_df['usd_krw_rate'])) - 1
        ) * 100
        merged_df['premium_percent'] = merged_df['premium_percent'].round(2)

        # 4. Save data
        self._merge_and_save([merged_df], self.gold_csv)

    def _fetch_historical_usd_krw(self, start_date, end_date):
        print("Fetching historical USD/KRW exchange rates from Naver Finance...")
        all_rates = []
        page = 1
        session = requests.Session()
        while True:
            try:
                url = f"https://finance.naver.com/marketindex/exchangeDailyQuote.naver?marketindexCd=FX_USDKRW&page={page}"
                response = session.get(url, timeout=10)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                
                table = soup.find('table', class_='tbl_exchange')
                if not table:
                    print(f"No table found on page {page}. Assuming end of data.")
                    break

                rows = table.find_all('tr')
                page_data = []
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) >= 2: # Ensure there are enough columns
                        date_str = cols[0].text.strip()
                        rate_str = cols[1].text.strip().replace(',', '')
                        try:
                            date = datetime.strptime(date_str, '%Y.%m.%d').date()
                            rate = float(rate_str)
                            page_data.append({'date': date, 'usd_krw_rate': rate})
                        except ValueError:
                            continue # Skip rows with malformed data
                
                if not page_data: # No data on this page, likely end of history
                    break

                df_page = pd.DataFrame(page_data)
                all_rates.append(df_page)

                # Check if we've reached the start date or if the last page was empty
                if df_page['date'].min() < pd.to_datetime(start_date).date():
                    break
                
                page += 1
                time.sleep(0.5) # Be polite to the server
            except requests.exceptions.RequestException as e:
                print(f"Request error fetching exchange rates on page {page}: {e}")
                break
            except Exception as e:
                print(f"Error parsing exchange rates on page {page}: {e}")
                break
        
        if not all_rates:
            return pd.DataFrame(columns=['date', 'usd_krw_rate'])

        final_df = pd.concat(all_rates, ignore_index=True)
        final_df = final_df.dropna()
        final_df['date'] = pd.to_datetime(final_df['date'])
        final_df = final_df[(final_df['date'] >= pd.to_datetime(start_date)) & (final_df['date'] <= pd.to_datetime(end_date))]
        return final_df

    def _fetch_historical_krx_gold(self, start_date, end_date):
        all_prices = []
        session = requests.Session()
        # Visit the page first to establish a session
        session.get("https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0200020101")

        for date in pd.date_range(start=start_date, end=end_date):
            try:
                date_str = date.strftime('%Y%m%d')
                url = "https://data.krx.co.kr/comm/bld/user/ajax/READ_MDC_GEN_DATA.jspx"
                payload = {
                    'bld': 'MDC/MDI/mdiLoader/MDC0200020101_01',
                    'trdDd': date_str,
                    'money': '1',
                    'csvxls_isNo': 'false'
                }
                headers = {'Referer': 'https://data.krx.co.kr/'}
                response = session.post(url, data=payload, headers=headers, timeout=5)
                
                if response.status_code == 200 and response.text.strip():
                    data = response.json()
                    if data.get('result', {}).get('output'):
                        price_str = data['result']['output'][0]['end_pr']
                        price = float(price_str.replace(',', ''))
                        all_prices.append({'date': date, 'krx': price})
                time.sleep(0.1)
            except (requests.exceptions.ConnectionError, ValueError, IndexError) as e:
                # Ignore days with no data (weekends, holidays)
                continue
            except Exception as e:
                print(f"Error fetching KRX gold for {date.date()}: {e}")
                continue

        if not all_prices:
            return pd.DataFrame(columns=['date', 'krx'])
            
        return pd.DataFrame(all_prices)

    def collect_all(self):
        self.run_stock_collection()
        self.run_coin_collection()
        self.run_premium_collection()

if __name__ == "__main__":
    import sys
    daily_mode = len(sys.argv) > 1 and sys.argv[1] == "--daily"
    collector = DataCollector(daily_mode=daily_mode)
    collector.collect_all()