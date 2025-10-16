import pandas as pd
import os

def consolidate_data():
    # Correct path for input data files
    input_data_path = "data"
    docs_data_path = "docs/data"

    # Crypto files
    crypto_files = {
        "btc_price": "btc_price.csv",
        "crypto_fear_greed": "crypto_fear_greed.csv",
        "eth_price": "eth_price.csv",
        "sol_price": "sol_price.csv",
        "xrp_price": "xrp_price.csv",
    }

    # Stock files
    stock_files = {
        "nasdaq_index": "nasdaq_index.csv",
        "sp500_index": "sp500_index.csv",
        "stock_fear_greed": "stock_fear_greed.csv",
    }

    # Consolidate Crypto Data
    crypto_df = pd.DataFrame()
    for key, filename in crypto_files.items():
        filepath = os.path.join(input_data_path, filename) # Changed to input_data_path
        if os.path.exists(filepath):
            df = pd.read_csv(filepath)
            df['date'] = pd.to_datetime(df['date'])
            if key == "btc_price":
                df = df.rename(columns={'price': 'btc'}) # Renamed to 'btc'
            elif key == "eth_price":
                df = df.rename(columns={'price': 'eth'}) # Renamed to 'eth'
            elif key == "sol_price":
                df = df.rename(columns={'price': 'sol'}) # Renamed to 'sol'
            elif key == "xrp_price":
                df = df.rename(columns={'price': 'xrp'}) # Renamed to 'xrp'
            elif key == "crypto_fear_greed":
                df = df.rename(columns={'fear_greed_value': 'crypto_fear_greed'}) # Renamed to 'crypto_fear_greed'

            if crypto_df.empty:
                crypto_df = df
            else:
                crypto_df = pd.merge(crypto_df, df, on='date', how='outer')
        else:
            print(f"Warning: {filepath} not found.")

    # Consolidate Stock Data
    stock_df = pd.DataFrame()
    for key, filename in stock_files.items():
        filepath = os.path.join(input_data_path, filename) # Changed to input_data_path
        if os.path.exists(filepath):
            df = pd.read_csv(filepath)
            df['date'] = pd.to_datetime(df['date'])
            if key == "nasdaq_index":
                df = df.rename(columns={'close_price': 'nasdaq'})
            elif key == "sp500_index":
                df = df.rename(columns={'close_price': 'sp500'})
            elif key == "stock_fear_greed":
                df = df.rename(columns={'fear_greed_value': 'fear_greed'})

            if stock_df.empty:
                stock_df = df
            else:
                stock_df = pd.merge(stock_df, df, on='date', how='outer')
        else:
            print(f"Warning: {filepath} not found.")

    # Sort by date
    crypto_df = crypto_df.sort_values(by='date').reset_index(drop=True)
    stock_df = stock_df.sort_values(by='date').reset_index(drop=True)

    # Save consolidated data
    crypto_df.to_csv(os.path.join(docs_data_path, "coin.csv"), index=False)
    stock_df.to_csv(os.path.join(docs_data_path, "stock.csv"), index=False)
    
    print("Data consolidation complete: coin.csv and stock.csv created in docs/data.")

if __name__ == "__main__":
    consolidate_data()
