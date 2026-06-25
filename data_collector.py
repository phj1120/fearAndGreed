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

CNN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://edition.cnn.com/markets/fear-and-greed',
    'Origin': 'https://edition.cnn.com',
}


class DataCollector:
    def __init__(self, daily_mode=False):
        self.data_dir = "data"
        self.stock_csv = os.path.join(self.data_dir, "stock.csv")
        self.coin_csv = os.path.join(self.data_dir, "coin.csv")
        self.vix_csv = os.path.join(self.data_dir, "vix_index.csv")
        self.btc_premium_csv = os.path.join(self.data_dir, "btc_premium.csv")
        self.gold_csv = os.path.join("docs", "data", "gold.csv")

        self.daily_mode = daily_mode

        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join("docs", "data"), exist_ok=True)

    # ── yfinance ──────────────────────────────────────────────────────────────

    def _fetch_yfinance_data(self, ticker, start, end):
        print(f"Fetching {ticker} from yfinance...")
        try:
            df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
            if df.empty:
                return pd.DataFrame(columns=['date', ticker])
            df = df[['Close']].reset_index()
            df.columns = ['date', ticker]
            df['date'] = pd.to_datetime(df['date'])
            return df
        except Exception as e:
            print(f"Error fetching {ticker} from yfinance: {e}")
            return pd.DataFrame(columns=['date', ticker])

    # ── Fear & Greed APIs ─────────────────────────────────────────────────────

    def _fetch_stock_fear_greed(self):
        print("Fetching stock Fear & Greed index...")
        urls = [
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/",
        ]
        for url in urls:
            try:
                response = requests.get(url, headers=CNN_HEADERS, timeout=15)
                response.raise_for_status()
                data = response.json()['fear_and_greed_historical']['data']
                df = pd.DataFrame(data)
                df.rename(columns={'x': 'date', 'y': 'fear_greed'}, inplace=True)
                df['date'] = pd.to_datetime(df['date'], unit='ms')
                df['fear_greed'] = df['fear_greed'].round(0).astype(int)
                print(f"Stock F&G: {len(df)} rows fetched.")
                return df
            except Exception as e:
                print(f"Error fetching stock F&G from {url}: {e}")
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
            print(f"Error fetching crypto F&G: {e}")
            return pd.DataFrame(columns=['date', 'crypto_fear_greed'])

    # ── Crypto Price APIs ─────────────────────────────────────────────────────

    def _fetch_binance_ohlcv(self, symbol, col_name):
        """Fetch full historical daily closing prices from Binance public API."""
        print(f"Fetching {col_name} from Binance ({symbol})...")
        all_data = []
        end_time = int(datetime.now().timestamp() * 1000)
        limit = 1000 if not self.daily_mode else 2

        while True:
            try:
                url = (
                    f"https://api.binance.com/api/v3/klines"
                    f"?symbol={symbol}&interval=1d&limit={limit}&endTime={end_time}"
                )
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                candles = response.json()
                if not candles:
                    break
                for c in candles:
                    all_data.append({
                        'date': pd.to_datetime(c[0], unit='ms').normalize(),
                        col_name: round(float(c[4]), 4),
                    })
                if len(candles) < limit or self.daily_mode:
                    break
                end_time = int(candles[0][0]) - 1
                time.sleep(0.1)
            except Exception as e:
                print(f"Error fetching {col_name} from Binance: {e}")
                break

        if not all_data:
            return pd.DataFrame(columns=['date', col_name])
        df = pd.DataFrame(all_data)
        df = df.sort_values('date').drop_duplicates('date').reset_index(drop=True)
        return df

    def _fetch_crypto_prices(self, coin_id, col_name=None):
        """Fetch crypto prices — Binance primary, CoinGecko fallback."""
        col_name = col_name or coin_id
        binance_symbols = {
            'bitcoin': 'BTCUSDT',
            'ethereum': 'ETHUSDT',
            'solana': 'SOLUSDT',
            'ripple': 'XRPUSDT',
        }
        symbol = binance_symbols.get(coin_id)
        if symbol:
            df = self._fetch_binance_ohlcv(symbol, col_name)
            if not df.empty:
                return df

        # CoinGecko fallback
        print(f"Binance failed, trying CoinGecko for {coin_id}...")
        try:
            days = 'max' if not self.daily_mode else '2'
            url = (
                f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
                f"?vs_currency=usd&days={days}&interval=daily"
            )
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            prices = response.json()['prices']
            df = pd.DataFrame(prices, columns=['date', col_name])
            df['date'] = pd.to_datetime(df['date'], unit='ms').dt.normalize()
            df[col_name] = df[col_name].round(4)
            return df
        except Exception as e:
            print(f"Error fetching {coin_id} from CoinGecko: {e}")
            return pd.DataFrame(columns=['date', col_name])

    # ── VIX ───────────────────────────────────────────────────────────────────

    def _fetch_vix_data(self):
        print("Fetching VIX index...")
        if self.daily_mode and os.path.exists(self.vix_csv):
            start = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        else:
            start = "2000-01-01"

        df = self._fetch_yfinance_data('^VIX', start, datetime.now())
        if df.empty:
            print("Warning: Could not fetch VIX data.")
            return

        df = df.rename(columns={'^VIX': 'close_price'})
        df['date'] = pd.to_datetime(df['date']).dt.date
        df['close_price'] = pd.to_numeric(df['close_price'], errors='coerce').round(2)
        df = df.dropna()

        if self.daily_mode and os.path.exists(self.vix_csv):
            existing = pd.read_csv(self.vix_csv)
            existing['date'] = pd.to_datetime(existing['date']).dt.date
            combined = pd.concat([existing, df]).drop_duplicates('date', keep='last')
            combined = combined.sort_values('date').reset_index(drop=True)
            combined.to_csv(self.vix_csv, index=False)
        else:
            df = df.sort_values('date').reset_index(drop=True)
            df.to_csv(self.vix_csv, index=False)
        print(f"VIX saved: {self.vix_csv}")

    # ── Merge & Save ──────────────────────────────────────────────────────────

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
            combined_df = (
                pd.concat([existing_df, merged_df])
                .drop_duplicates(subset=[date_col], keep='last')
                .sort_values(by=date_col)
                .reset_index(drop=True)
            )
            combined_df.to_csv(output_path, index=False)
            print(f"Updated {output_path} with today's data.")
        else:
            merged_df.to_csv(output_path, index=False)
            print(f"Saved {output_path}")

    # ── Stock Collection ──────────────────────────────────────────────────────

    def run_stock_collection(self):
        start_date = "2000-01-01"
        end_date = datetime.now()

        nasdaq_df = self._fetch_yfinance_data('^IXIC', start_date, end_date).rename(columns={'^IXIC': 'nasdaq'})
        sp500_df = self._fetch_yfinance_data('^GSPC', start_date, end_date).rename(columns={'^GSPC': 'sp500'})
        fear_greed_df = self._fetch_stock_fear_greed()

        self._merge_and_save([nasdaq_df, sp500_df, fear_greed_df], self.stock_csv)

    # ── Coin Collection ───────────────────────────────────────────────────────

    def run_coin_collection(self):
        fear_greed_df = self._fetch_crypto_fear_greed()
        btc_df = self._fetch_crypto_prices('bitcoin')
        eth_df = self._fetch_crypto_prices('ethereum')
        sol_df = self._fetch_crypto_prices('solana')
        xrp_df = self._fetch_crypto_prices('ripple')

        self._merge_and_save([fear_greed_df, btc_df, eth_df, sol_df, xrp_df], self.coin_csv)

    # ── USD/KRW Rate ──────────────────────────────────────────────────────────

    def _get_usd_krw_rate(self):
        """Get current USD/KRW rate — Naver Finance primary, yfinance fallback."""
        try:
            url = "https://finance.naver.com/marketindex/goldDetail.naver"
            response = requests.get(url, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            rate_element = soup.find('th', string=lambda t: t and '기준 원달러 환율' in t)
            if rate_element and rate_element.find_next_sibling('td'):
                rate_text = rate_element.find_next_sibling('td').text.strip().replace('원', '')
                return float(rate_text.replace(',', ''))
        except Exception as e:
            print(f"Naver Finance USD/KRW failed: {e}")

        # yfinance fallback
        try:
            df = yf.download('KRW=X', period='5d', progress=False, auto_adjust=True)
            if not df.empty:
                return float(df['Close'].iloc[-1])
        except Exception as e:
            print(f"yfinance KRW=X also failed: {e}")
        return None

    # ── BTC Premium ───────────────────────────────────────────────────────────

    def _collect_btc_premium_daily(self):
        print("Collecting BTC Kimchi Premium...")
        try:
            upbit_res = requests.get(
                "https://api.upbit.com/v1/ticker?markets=KRW-BTC",
                headers={"Accept": "application/json"},
                timeout=10
            )
            upbit_res.raise_for_status()
            upbit_price = float(upbit_res.json()[0]['trade_price'])

            binance_res = requests.get(
                "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
                timeout=10
            )
            binance_res.raise_for_status()
            binance_price = float(binance_res.json()['price'])

            usd_krw = self._get_usd_krw_rate()
            if not usd_krw:
                print("Could not get USD/KRW rate. Skipping BTC premium.")
                return

            premium = (upbit_price / (binance_price * usd_krw) - 1) * 100

            new_row = pd.DataFrame([{
                'date': datetime.now().date(),
                'upbit_price_krw': upbit_price,
                'binance_price_usd': round(binance_price, 2),
                'usd_krw_rate': round(usd_krw, 2),
                'premium_percent': round(premium, 2),
            }])

            if os.path.exists(self.btc_premium_csv):
                existing = pd.read_csv(self.btc_premium_csv)
                existing['date'] = pd.to_datetime(existing['date']).dt.date
                new_row['date'] = pd.to_datetime(new_row['date']).dt.date
                combined = (
                    pd.concat([existing, new_row])
                    .drop_duplicates('date', keep='last')
                    .sort_values('date')
                    .reset_index(drop=True)
                )
                combined.to_csv(self.btc_premium_csv, index=False)
            else:
                new_row.to_csv(self.btc_premium_csv, index=False)

            print(f"BTC premium: {round(premium, 2)}% (Upbit: {upbit_price:,.0f} KRW, Binance: ${binance_price:,.2f})")
        except Exception as e:
            print(f"Error collecting BTC premium: {e}")

    def _collect_btc_premium_historical(self):
        print("Collecting historical BTC Kimchi Premium...")
        try:
            # Upbit history (200 days max per request)
            upbit_data = []
            url = "https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=200"
            res = requests.get(url, headers={"Accept": "application/json"}, timeout=15)
            res.raise_for_status()
            for c in res.json():
                upbit_data.append({
                    'date': pd.to_datetime(c['candle_date_time_utc']).date(),
                    'upbit_price_krw': float(c['trade_price']),
                })
            upbit_df = pd.DataFrame(upbit_data)
            upbit_df['date'] = pd.to_datetime(upbit_df['date'])

            # Binance BTC/USDT history
            binance_df = self._fetch_binance_ohlcv('BTCUSDT', 'binance_price_usd')
            min_date = upbit_df['date'].min()
            binance_df = binance_df[binance_df['date'] >= min_date]

            # USD/KRW rate from yfinance
            usd_krw_df = self._fetch_yfinance_data('KRW=X', str(min_date.date()), datetime.now())
            usd_krw_df = usd_krw_df.rename(columns={'KRW=X': 'usd_krw_rate'})

            merged = pd.merge(upbit_df, binance_df, on='date', how='inner')
            merged = pd.merge(merged, usd_krw_df, on='date', how='inner')

            merged['premium_percent'] = (
                merged['upbit_price_krw'] / (merged['binance_price_usd'] * merged['usd_krw_rate']) - 1
            ) * 100
            merged['premium_percent'] = merged['premium_percent'].round(2)
            merged[['date', 'upbit_price_krw', 'binance_price_usd', 'usd_krw_rate', 'premium_percent']].to_csv(
                self.btc_premium_csv, index=False
            )
            print(f"Historical BTC premium saved: {len(merged)} rows")
        except Exception as e:
            print(f"Error collecting historical BTC premium: {e}")

    # ── Gold Premium ──────────────────────────────────────────────────────────

    def run_premium_collection(self):
        if self.daily_mode:
            self._collect_today_gold_premium()
            self._collect_btc_premium_daily()
        else:
            self._collect_historical_gold_premium()
            self._collect_btc_premium_historical()

    def _collect_today_gold_premium(self):
        print("Collecting today's Gold premium...")
        try:
            krx_gold_url = "https://finance.naver.com/marketindex/goldDetail.naver"
            response = requests.get(krx_gold_url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            price_element_parent = soup.select_one('p.no_today')
            price_text = price_element_parent.text.strip()
            price_match = re.search(r'[\d,.]+', price_text)
            krx_price = float(price_match.group().replace(',', ''))

            gold_data = yf.download("GC=F", period="1d", progress=False, auto_adjust=True)
            if gold_data.empty:
                raise ValueError("No gold price data from yfinance")
            gold_usd_ounce = float(gold_data['Close'].iloc[-1])

            usd_krw = self._get_usd_krw_rate()
            if not usd_krw:
                raise ValueError("Could not get USD/KRW rate")

            international_price_gram = (gold_usd_ounce / 31.1035) * usd_krw
            premium = (krx_price / international_price_gram - 1) * 100

            df = pd.DataFrame([{
                'date': datetime.now().date(),
                'krx': krx_price,
                'usd': gold_usd_ounce,
                'usd_krw_rate': usd_krw,
                'premium_percent': round(premium, 2),
            }])
            self._merge_and_save([df], self.gold_csv)
            print(f"Gold premium: {round(premium, 2)}%")
        except Exception as e:
            print(f"Error collecting Gold premium: {e}")

    def _collect_historical_gold_premium(self):
        print("Collecting historical Gold premium...")
        start_date = "2000-01-01"
        end_date = datetime.now().strftime('%Y-%m-%d')

        intl_gold_df = self._fetch_yfinance_data("GC=F", start_date, end_date).rename(columns={'GC=F': 'usd'})
        exchange_rate_df = self._fetch_historical_usd_krw(start_date, end_date)
        krx_gold_df = self._fetch_historical_krx_gold(start_date, end_date)

        if intl_gold_df.empty or exchange_rate_df.empty or krx_gold_df.empty:
            print("Could not fetch all necessary historical data. Aborting.")
            return

        merged_df = pd.merge(krx_gold_df, intl_gold_df, on='date', how='inner')
        merged_df = pd.merge(merged_df, exchange_rate_df, on='date', how='inner')
        merged_df['premium_percent'] = (
            (merged_df['krx'] / ((merged_df['usd'] / 31.1035) * merged_df['usd_krw_rate'])) - 1
        ) * 100
        merged_df['premium_percent'] = merged_df['premium_percent'].round(2)
        self._merge_and_save([merged_df], self.gold_csv)

    def _fetch_historical_usd_krw(self, start_date, end_date):
        print("Fetching historical USD/KRW exchange rates from Naver Finance...")
        all_rates = []
        page = 1
        session = requests.Session()
        while True:
            try:
                url = (
                    f"https://finance.naver.com/marketindex/exchangeDailyQuote.naver"
                    f"?marketindexCd=FX_USDKRW&page={page}"
                )
                response = session.get(url, timeout=10)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                table = soup.find('table', class_='tbl_exchange')
                if not table:
                    break
                rows = table.find_all('tr')
                page_data = []
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) >= 2:
                        try:
                            date = datetime.strptime(cols[0].text.strip(), '%Y.%m.%d').date()
                            rate = float(cols[1].text.strip().replace(',', ''))
                            page_data.append({'date': date, 'usd_krw_rate': rate})
                        except ValueError:
                            continue
                if not page_data:
                    break
                df_page = pd.DataFrame(page_data)
                all_rates.append(df_page)
                if df_page['date'].min() < pd.to_datetime(start_date).date():
                    break
                page += 1
                time.sleep(0.5)
            except Exception as e:
                print(f"Error fetching exchange rates page {page}: {e}")
                break

        if not all_rates:
            return pd.DataFrame(columns=['date', 'usd_krw_rate'])
        final_df = pd.concat(all_rates, ignore_index=True).dropna()
        final_df['date'] = pd.to_datetime(final_df['date'])
        final_df = final_df[
            (final_df['date'] >= pd.to_datetime(start_date)) &
            (final_df['date'] <= pd.to_datetime(end_date))
        ]
        return final_df

    def _fetch_historical_krx_gold(self, start_date, end_date):
        all_prices = []
        session = requests.Session()
        session.get("https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0200020101")
        for date in pd.date_range(start=start_date, end=end_date):
            try:
                date_str = date.strftime('%Y%m%d')
                url = "https://data.krx.co.kr/comm/bld/user/ajax/READ_MDC_GEN_DATA.jspx"
                payload = {
                    'bld': 'MDC/MDI/mdiLoader/MDC0200020101_01',
                    'trdDd': date_str,
                    'money': '1',
                    'csvxls_isNo': 'false',
                }
                headers = {'Referer': 'https://data.krx.co.kr/'}
                response = session.post(url, data=payload, headers=headers, timeout=5)
                if response.status_code == 200 and response.text.strip():
                    data = response.json()
                    if data.get('result', {}).get('output'):
                        price = float(data['result']['output'][0]['end_pr'].replace(',', ''))
                        all_prices.append({'date': date, 'krx': price})
                time.sleep(0.1)
            except Exception:
                continue
        if not all_prices:
            return pd.DataFrame(columns=['date', 'krx'])
        return pd.DataFrame(all_prices)

    # ── Entry Point ───────────────────────────────────────────────────────────

    def collect_all(self):
        self.run_stock_collection()
        self.run_coin_collection()
        self._fetch_vix_data()
        self.run_premium_collection()


if __name__ == "__main__":
    import sys
    daily_mode = len(sys.argv) > 1 and sys.argv[1] == "--daily"
    collector = DataCollector(daily_mode=daily_mode)
    collector.collect_all()
