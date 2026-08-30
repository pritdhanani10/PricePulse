# PricePulse — Real-Time Market Alert & Technical Analysis Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14+-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**PricePulse** is an institutional-grade, full-stack Indian Stock Market (NSE/BSE) Alert Trigger Engine and Technical Analysis Platform. It features real-time live market tick streaming, concurrency-safe percentage target evaluation, technical indicator overlays, custom multi-watchlists, and WebSocket broadcasting.

---

## ⚡ Key Highlights

- **🔴 Free Real-Time Live Indian Market Data**:
  - Live tick streaming for **NIFTY 50**, **BANK NIFTY**, **FIN NIFTY**, and top NSE equities (**RELIANCE**, **TCS**, **HDFCBANK**, **INFY**, **ICICIBANK**, etc.) with zero paid subscriptions.
  - Pluggable provider architecture supporting **Real Live NSE Feeds**, **Free Broker WebSockets (Angel One SmartAPI, DhanHQ)**, and **Brownian Motion Simulation**.
- **📅 Official NSE Trading Hours & Holiday Enforcement**:
  - Built-in Indian Stock Market trading session engine (**09:15 AM – 03:30 PM IST**, Monday–Friday).
  - Full **NSE Trading Holiday Calendar (2024–2026)** integration with automatic price freezing on weekends and national holidays (Holi, Diwali, Independence Day, Republic Day, Gandhi Jayanti, etc.).
- **🎯 Concurrency-Safe Alert Trigger Engine**:
  - Automatically computes precise UP target (`Reference Price * (1 + Threshold% / 100)`) and DOWN target (`Reference Price * (1 - Threshold% / 100)`).
  - Atomic state transitions (`ACTIVE` → `TRIGGERED`) with row locking to eliminate duplicate triggers during high-volatility spikes.
  - Automatic persistence to `AlertHistory` with instant WebSocket notification events.
- **📈 Advanced Technical Analysis Terminal**:
  - In-memory mathematical computation for **SMA (20, 50)**, **EMA (20)**, **RSI (14 Wilder's)**, **MACD (12, 26, 9)**, **Bollinger Bands (20, 2)**, **VWAP**, and **ATR (14)**.
  - High-DPI interactive HTML5 canvas candlestick chart with indicator toggles and sub-charts.
- **💼 Multi-Watchlists & Live Ticker**:
  - Curate custom stock baskets with real-time green/red price flash animations and instant toast popups.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     NEXT.JS 14 FRONTEND                     │
│                                                             │
│  • Live Benchmark Indices (NIFTY 50 / BANK NIFTY / FIN)    │
│  • Dynamic Percentage Alert Modal (UP / DOWN Targets)       │
│  • Active Alerts & Trigger History Feed                     │
│  • Interactive Canvas Candlestick & Technical Analysis      │
│  • Custom User Watchlists & Search Bar                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API (JWT) / WebSocket (/ws/market)
┌──────────────────────────────▼──────────────────────────────┐
│                     FASTAPI BACKEND                         │
│                                                             │
│  • Auth & Security (JWT, bcrypt password hashing)           │
│  • Market Data Abstraction Layer (Live NSE / Mock)          │
│  • High-Frequency Trigger Evaluation Engine                 │
│  • Technical Indicator Calculation Service (Pandas/NumPy)   │
│  • Bidirectional WebSocket Subscription Manager             │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────┐  ┌────────────────────────────┐
│   PostgreSQL / SQLite 3     │  │      Redis Pub/Sub         │
│   (Users, Alerts, History,  │  │  (Real-Time Market Ticks,  │
│    Instruments, Watchlists) │  │   User Alert Channels)     │
└─────────────────────────────┘  └────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI, Python 3.11+, Pydantic v2, Pydantic-Settings |
| **Database** | SQLAlchemy 2.0 (Async), SQLite (`aiosqlite`) / PostgreSQL (`asyncpg`) |
| **Real-Time** | WebSockets (`websockets`), Redis Pub/Sub, `httpx` async connection pooling |
| **Data & Math** | Pandas, NumPy (Technical Analysis calculations) |
| **Testing** | Pytest, Pytest-Asyncio, HTTPX AsyncClient |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** & **npm** installed
- *(Optional)* **Docker Desktop**

---

### Option 1: Run Locally via PowerShell (Windows)

#### 1. Clone the Repository
```bash
git clone https://github.com/pritdhanani10/PricePulse.git
cd PricePulse
```

#### 2. Start the Backend (Terminal 1)
```powershell
powershell -ExecutionPolicy Bypass -File .\run_backend.ps1
```
* Backend API runs on: `http://127.0.0.1:8000`
* Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

#### 3. Start the Frontend (Terminal 2)
```powershell
powershell -ExecutionPolicy Bypass -File .\run_frontend.ps1
```
* Web Dashboard opens at: `http://localhost:3000`

---

### Option 2: Run with Docker Compose

To launch the complete containerized stack (PostgreSQL + Redis + FastAPI Backend + Next.js Frontend):

```bash
docker-compose up --build
```
- **Web App**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000/docs`

---

## ⚙️ Environment Configuration

Configuration is managed via `backend/.env`. A complete template is provided in `backend/.env.example`.

```env
# =====================================================================
# PricePulse - Environment Configuration
# =====================================================================

# 1. Market Data Provider
# 'live' = Real-Time Live Indian Market (NSE) quotes
# 'mock' = Simulated price movement
MARKET_DATA_PROVIDER=live
TICK_INTERVAL_SECONDS=1.0

# 2. Trading Hours & NSE Holiday Enforcement
RESPECT_MARKET_HOURS=True
SIMULATE_WHEN_CLOSED=False

# 3. Database Configuration
DATABASE_URL=sqlite+aiosqlite:///./market_platform.db
# For PostgreSQL in production:
# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/market_platform

# 4. Security & JWT
SECRET_KEY=dev_secret_key_change_in_production_market_platform_9988
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# 5. Redis (Set True if running Redis instance)
REDIS_ENABLED=False
REDIS_URL=redis://localhost:6379/0

# 6. CORS Origins
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000
```

---

## 📡 REST API Documentation

FastAPI provides automatic interactive Swagger documentation at `/docs`.

### Key Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT access token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `GET` | `/api/instruments` | List tradeable instruments (Indices & Equities) |
| `POST` | `/api/instruments` | Register a new tradeable instrument |
| `GET` | `/api/instruments/quotes` | Get real-time quote snapshots for all active instruments |
| `GET` | `/api/instruments/{symbol}/price` | Get live quote snapshot for a specific symbol |
| `GET` | `/api/instruments/{symbol}/history` | Get historical OHLCV candlestick series |
| `GET` | `/api/instruments/market/status` | Check Indian Market session status (Open/Closed/Holiday) |
| `GET` | `/api/alerts` | List active, triggered, or disabled alerts |
| `POST` | `/api/alerts` | Create percentage-based UP/DOWN price alert |
| `POST` | `/api/alerts/dual` | Create dual upper & lower threshold bracket alerts |
| `PUT` | `/api/alerts/{id}` | Update alert threshold or status |
| `DELETE` | `/api/alerts/{id}` | Delete an alert |
| `GET` | `/api/analysis/{symbol}` | Compute technical indicators (SMA, EMA, RSI, MACD, BB, VWAP, ATR) |
| `GET` | `/api/watchlists` | Get user custom watchlists |
| `POST` | `/api/watchlists/{id}/items` | Add stock to watchlist |

---

## 🔌 WebSocket Streaming (`/ws/market`)

Connect to the bidirectional WebSocket endpoint at `ws://127.0.0.1:8000/ws/market`.

### Subscribe to Live Ticks:
```json
{
  "action": "subscribe",
  "symbols": ["NIFTY50", "BANKNIFTY", "RELIANCE", "TCS"]
}
```

### Live Tick Event Payload:
```json
{
  "symbol": "RELIANCE",
  "price": 1287.50,
  "open": 1282.20,
  "high": 1294.00,
  "low": 1279.00,
  "close": 1282.20,
  "change": 5.30,
  "change_percent": 0.41,
  "volume": 845200,
  "timestamp": "2026-08-30T10:00:00Z",
  "source": "LIVE"
}
```

### Alert Triggered Event:
```json
{
  "type": "ALERT_TRIGGERED",
  "data": {
    "alert_id": "9e0e05d1-c3e7-4506-8410-10fcd5803af0",
    "symbol": "RELIANCE",
    "direction": "UP",
    "reference_price": 1250.00,
    "target_price": 1287.50,
    "trigger_price": 1287.50,
    "triggered_at": "2026-08-30T10:05:22Z"
  }
}
```

---

## 🧪 Testing

Run the full backend automated test suite:

```powershell
cd backend
pytest -v
```

Run the complete end-to-end system verification script:
```powershell
powershell -ExecutionPolicy Bypass -File .\verify_system.ps1
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👤 Author

**Prit Dhanani**
* GitHub: [@pritdhanani10](https://github.com/pritdhanani10)
* Repository: [PricePulse](https://github.com/pritdhanani10/PricePulse)
