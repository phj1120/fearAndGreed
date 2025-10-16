import pandas as pd
import os

def remove_coin_classification():
    filepath = "docs/data/coin.csv"
    if os.path.exists(filepath):
        df = pd.read_csv(filepath)
        if 'classification' in df.columns:
            df = df.drop(columns=['classification'])
            df.to_csv(filepath, index=False)
            print(f"'classification' column removed from {filepath} successfully.")
        else:
            print(f"'classification' column not found in {filepath}.")
    else:
        print(f"Error: {filepath} not found.")

if __name__ == "__main__":
    remove_coin_classification()
