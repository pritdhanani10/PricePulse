"""
Core Indian Market Platform Constants and Baseline Instruments.
"""

DEFAULT_MARKET_INSTRUMENTS = {
    # Benchmark Indices
    "NIFTY50": {"name": "NIFTY 50", "price": 25150.0, "type": "INDEX", "volatility": 0.0012},
    "BANKNIFTY": {"name": "NIFTY BANK", "price": 51400.0, "type": "INDEX", "volatility": 0.0018},
    "FINNIFTY": {"name": "NIFTY FINANCIAL SERVICES", "price": 23650.0, "type": "INDEX", "volatility": 0.0015},
    "NIFTY_MIDCAP_100": {"name": "NIFTY Midcap 100", "price": 58240.0, "type": "INDEX", "volatility": 0.0022},
    "NIFTY_SMALLCAP_100": {"name": "NIFTY Smallcap 100", "price": 18450.0, "type": "INDEX", "volatility": 0.0028},
    "NIFTY_MICROCAP_250": {"name": "NIFTY Microcap 250", "price": 21890.0, "type": "INDEX", "volatility": 0.0035},

    # Large Cap Equities
    "RELIANCE": {"name": "Reliance Industries Ltd", "price": 2985.50, "type": "EQUITY", "volatility": 0.0020},
    "TCS": {"name": "Tata Consultancy Services Ltd", "price": 4180.25, "type": "EQUITY", "volatility": 0.0016},
    "HDFCBANK": {"name": "HDFC Bank Ltd", "price": 1645.80, "type": "EQUITY", "volatility": 0.0019},
    "INFY": {"name": "Infosys Ltd", "price": 1785.40, "type": "EQUITY", "volatility": 0.0022},
    "ICICIBANK": {"name": "ICICI Bank Ltd", "price": 1215.30, "type": "EQUITY", "volatility": 0.0021},
    "TATAMOTORS": {"name": "Tata Motors Ltd", "price": 1045.60, "type": "EQUITY", "volatility": 0.0028},
    "SBIN": {"name": "State Bank of India", "price": 815.20, "type": "EQUITY", "volatility": 0.0024},
    "BHARTIARTL": {"name": "Bharti Airtel Ltd", "price": 1560.75, "type": "EQUITY", "volatility": 0.0018},
    "ITC": {"name": "ITC Ltd", "price": 495.30, "type": "EQUITY", "volatility": 0.0014},
    "ZOMATO": {"name": "Zomato Ltd", "price": 250.0, "type": "EQUITY", "volatility": 0.0032},

    # NIFTY MIDCAP Constituents
    "DIXON": {"name": "Dixon Technologies (India) Ltd", "price": 12450.0, "type": "EQUITY", "volatility": 0.0035},
    "TATAELXSI": {"name": "Tata Elxsi Ltd", "price": 7120.0, "type": "EQUITY", "volatility": 0.0030},
    "POLYCAB": {"name": "Polycab India Ltd", "price": 6450.0, "type": "EQUITY", "volatility": 0.0029},
    "PERSISTENT": {"name": "Persistent Systems Ltd", "price": 4890.0, "type": "EQUITY", "volatility": 0.0032},
    "COFORGE": {"name": "Coforge Ltd", "price": 6240.0, "type": "EQUITY", "volatility": 0.0031},
    "MPHASIS": {"name": "Mphasis Ltd", "price": 2980.0, "type": "EQUITY", "volatility": 0.0028},
    "FEDERALBNK": {"name": "The Federal Bank Ltd", "price": 188.50, "type": "EQUITY", "volatility": 0.0025},
    "ASTRAL": {"name": "Astral Ltd", "price": 1875.0, "type": "EQUITY", "volatility": 0.0027},
    "VOLTAS": {"name": "Voltas Ltd", "price": 1680.0, "type": "EQUITY", "volatility": 0.0030},
    "ASHOKLEY": {"name": "Ashok Leyland Ltd", "price": 245.0, "type": "EQUITY", "volatility": 0.0028},

    # NIFTY SMALLCAP Constituents
    "TEJASNET": {"name": "Tejas Networks Ltd", "price": 1180.0, "type": "EQUITY", "volatility": 0.0042},
    "CDSL": {"name": "Central Depository Services (India) Ltd", "price": 1480.0, "type": "EQUITY", "volatility": 0.0038},
    "ANGELONE": {"name": "Angel One Ltd", "price": 2620.0, "type": "EQUITY", "volatility": 0.0040},
    "BSE": {"name": "BSE Ltd", "price": 2450.0, "type": "EQUITY", "volatility": 0.0039},
    "CENTURYPLY": {"name": "Century Plyboards (India) Ltd", "price": 760.0, "type": "EQUITY", "volatility": 0.0032},
    "RADICO": {"name": "Radico Khaitan Ltd", "price": 1920.0, "type": "EQUITY", "volatility": 0.0035},
    "KAYNES": {"name": "Kaynes Technology India Ltd", "price": 4650.0, "type": "EQUITY", "volatility": 0.0045},
    "CYIENT": {"name": "Cyient Ltd", "price": 1890.0, "type": "EQUITY", "volatility": 0.0036},
    "CAMS": {"name": "Computer Age Management Services Ltd", "price": 4150.0, "type": "EQUITY", "volatility": 0.0034},
    "SONATSOFTW": {"name": "Sonata Software Ltd", "price": 620.0, "type": "EQUITY", "volatility": 0.0037},

    # NIFTY MICROCAP Constituents
    "MARKSANS": {"name": "Marksans Pharma Ltd", "price": 245.0, "type": "EQUITY", "volatility": 0.0048},
    "SUBEX": {"name": "Subex Ltd", "price": 38.50, "type": "EQUITY", "volatility": 0.0055},
    "INFIBEAM": {"name": "Infibeam Avenues Ltd", "price": 32.40, "type": "EQUITY", "volatility": 0.0052},
    "DCMSHRIRAM": {"name": "DCM Shriram Ltd", "price": 1080.0, "type": "EQUITY", "volatility": 0.0040},
    "RANEHOLDIN": {"name": "Rane Holdings Ltd", "price": 1650.0, "type": "EQUITY", "volatility": 0.0044},
    "GEOJITFSL": {"name": "Geojit Financial Services Ltd", "price": 135.0, "type": "EQUITY", "volatility": 0.0050},
    "SAKSOFT": {"name": "Saksoft Ltd", "price": 265.0, "type": "EQUITY", "volatility": 0.0046},
    "NELCO": {"name": "Nelco Ltd", "price": 890.0, "type": "EQUITY", "volatility": 0.0045},
    "HGINFRA": {"name": "H.G. Infra Engineering Ltd", "price": 1420.0, "type": "EQUITY", "volatility": 0.0042},
    "ORIENTCEM": {"name": "Orient Cement Ltd", "price": 310.0, "type": "EQUITY", "volatility": 0.0047},
}
