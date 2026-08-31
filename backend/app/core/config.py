import json
import os
from typing import Any, List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Market Alert & Analysis Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & JWT
    SECRET_KEY: str = "supersecretjwtkey_indian_market_stock_alerts_change_in_production_998877"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    # Default to sqlite+aiosqlite for zero-config out-of-the-box operation, can be overridden by POSTGRES_URL
    DATABASE_URL: str = "sqlite+aiosqlite:///./market_platform.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False

    # CORS
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, set, tuple)):
            return [str(i).strip() for i in v if str(i).strip()]
        return v

    # Market Data & Trading Hours
    TICK_INTERVAL_SECONDS: float = 1.0
    MARKET_DATA_PROVIDER: str = "live"  # "live" (Real NSE Live Feed)
    RESPECT_MARKET_HOURS: bool = True  # Stream ticks during 09:15-15:30 IST Mon-Fri


    # Notification settings
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = "alerts@stockmarketplatform.in"

    # Web Push (VAPID) Settings for Windows & Mobile Phone Device Notifications
    VAPID_PUBLIC_KEY: str = "BFQmiNC80uKLO0wGPxNmYAmCOzuCOhW4EK5dSQ5gSuc8V0FYzfYYRpoZ27lXPeTxzaBbQDY1yrOlt3KyTfdAAME"
    VAPID_PRIVATE_KEY: str = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgPzRhMxiSBQ9W9vre\nPswu8cnLRbz9DalHYL1Cw5qFBuuhRANCAARUJojQvNLiiztMBj8TZmAJgjs7gjoV\nuBCuXUkOYErnPFdBWM32GEaaGdu5Vz3k8c2gW0A2Ncqzpbdysk33QADB\n-----END PRIVATE KEY-----"
    VAPID_CLAIM_EMAIL: str = "mailto:alerts@pricepulse.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
