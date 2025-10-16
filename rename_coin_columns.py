import pandas as pd
import os

def rename_coin_columns():
    filepath = "docs/data/coin.csv"
    if os.path.exists(filepath):
        df = pd.read_csv(filepath)
        new_columns = {}
        
        # Rename price columns
        if 'price_btc_price' in df.columns:
            new_columns['price_btc_price'] = 'btc'
        if 'price_eth_price' in df.columns:
            new_columns['price_eth_price'] = 'eth'
        if 'price_sol_price' in df.columns:
            new_columns['price_sol_price'] = 'sol'
        if 'price_xrp_price' in df.columns:
            new_columns['price_xrp_price'] = 'xrp'

        # Rename fear_greed_value column
        if 'fear_greed_value' in df.columns:
            new_columns['fear_greed_value'] = 'crypto_fear_greed_value'
        
        if new_columns:
            df = df.rename(columns=new_columns)
            
            # Reorder columns
            desired_order = ['date', 'crypto_fear_greed_value', 'btc', 'eth', 'sol', 'xrp']
            # Filter desired_order to only include columns that actually exist in the DataFrame
            existing_columns = [col for col in desired_order if col in df.columns]
            df = df[existing_columns]

            df.to_csv(filepath, index=False)
            print(f"Columns in {filepath} renamed successfully.")
        else:
            print(f"No columns to rename in {filepath}.")
    else:
        print(f"Error: {filepath} not found.")

if __name__ == "__main__":
    rename_coin_columns()