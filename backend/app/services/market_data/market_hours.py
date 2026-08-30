from datetime import datetime, time, timedelta, timezone
from typing import Optional, Tuple
from app.schemas.market import MarketStatus

# Official NSE / BSE Indian Stock Market Trading Holidays
NSE_HOLIDAYS = {
    # 2024
    "2024-01-22": "Special Holiday (Ayodhya Ram Mandir Pran Pratishtha)",
    "2024-01-26": "Republic Day",
    "2024-03-08": "Mahashivratri",
    "2024-03-25": "Holi",
    "2024-03-29": "Good Friday",
    "2024-04-11": "Id-Ul-Fitr (Ramzan Id)",
    "2024-04-17": "Ram Navami",
    "2024-05-01": "Maharashtra Day",
    "2024-05-20": "General Parliamentary Elections",
    "2024-06-17": "Bakri Id / Eid-ul-Adha",
    "2024-07-17": "Muharram",
    "2024-08-15": "Independence Day",
    "2024-10-02": "Mahatma Gandhi Jayanti",
    "2024-11-01": "Diwali Laxmi Pujan (Muhurat Trading)",
    "2024-11-15": "Guru Nanak Jayanti",
    "2024-11-20": "Maharashtra Assembly Elections",
    "2024-12-25": "Christmas",

    # 2025
    "2025-01-26": "Republic Day",
    "2025-02-26": "Mahashivratri",
    "2025-03-14": "Holi",
    "2025-03-31": "Id-Ul-Fitr",
    "2025-04-10": "Mahavir Jayanti",
    "2025-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
    "2025-04-18": "Good Friday",
    "2025-05-01": "Maharashtra Day",
    "2025-06-07": "Bakri Id",
    "2025-07-06": "Muharram",
    "2025-08-15": "Independence Day",
    "2025-08-27": "Ganesh Chaturthi",
    "2025-10-02": "Mahatma Gandhi Jayanti",
    "2025-10-21": "Diwali Laxmi Pujan",
    "2025-10-22": "Diwali Balipratipada",
    "2025-11-05": "Guru Nanak Jayanti",
    "2025-12-25": "Christmas",

    # 2026
    "2026-01-26": "Republic Day",
    "2026-02-16": "Mahashivratri",
    "2026-03-03": "Holi",
    "2026-03-20": "Id-Ul-Fitr",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
    "2026-05-01": "Maharashtra Day",
    "2026-05-27": "Bakri Id",
    "2026-06-25": "Muharram",
    "2026-08-15": "Independence Day",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Mahatma Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-08": "Diwali Laxmi Pujan",
    "2026-11-09": "Diwali Balipratipada",
    "2026-11-24": "Guru Nanak Jayanti",
    "2026-12-25": "Christmas",
}


def get_indian_market_status() -> MarketStatus:
    """
    Computes precise Indian Stock Market (NSE/BSE) trading session status.
    Market Hours:
      - Pre-Open: 09:00 - 09:15 IST
      - Regular Trading: 09:15 - 15:30 IST (Mon-Fri)
      - Closed: After Hours, Weekends, and Official NSE Holidays
    """
    # IST is UTC + 5 hours 30 minutes
    ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    date_str = ist_now.strftime("%Y-%m-%d")
    weekday = ist_now.weekday()  # 0=Monday, 4=Friday, 5=Saturday, 6=Sunday
    current_time = ist_now.time()

    open_time = time(9, 15)
    close_time = time(15, 30)
    pre_open_time = time(9, 0)

    is_weekend = weekday >= 5
    is_holiday = date_str in NSE_HOLIDAYS
    holiday_name = NSE_HOLIDAYS.get(date_str)

    is_trading_day = (not is_weekend) and (not is_holiday)
    is_open = is_trading_day and (open_time <= current_time <= close_time)

    if is_holiday:
        session = "CLOSED"
        status_text = f"Market Closed (Holiday: {holiday_name})"
    elif is_weekend:
        session = "CLOSED"
        status_text = "Market Closed (Weekend)"
    elif pre_open_time <= current_time < open_time:
        session = "PRE_OPEN"
        status_text = "Pre-Market Session (09:00 - 09:15 IST)"
    elif open_time <= current_time <= close_time:
        session = "REGULAR"
        status_text = "Market Open (NSE/BSE Live)"
    else:
        session = "CLOSED"
        status_text = "Market Closed (After Hours)"

    return MarketStatus(
        is_open=is_open,
        status_text=status_text,
        market_time=ist_now.strftime("%Y-%m-%d %H:%M:%S IST"),
        session=session,
        next_open="09:15 IST",
        next_close="15:30 IST",
    )
