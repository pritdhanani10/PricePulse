-- ============================================================================
-- IDEMPOTENT POSTGRESQL SCHEMA & MIGRATION SCRIPT
-- Application: PulseTrader / Indian Stock Market Alert & Analysis Platform
-- Compatible with: Supabase CLI, Supabase SQL Editor, AWS RDS, Neon, PgBouncer
-- Safety: Completely idempotent. Existing tables, columns, indexes, and data
--         are preserved without loss.
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

-- 2. INSTRUMENTS TABLE (NSE Equities & Indices)
CREATE TABLE IF NOT EXISTS instruments (
    id VARCHAR(36) PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(20) NOT NULL DEFAULT 'NSE',
    instrument_type VARCHAR(30) NOT NULL DEFAULT 'EQUITY',
    base_price DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    tick_size DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    lot_size INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_instruments_id ON instruments (id);
CREATE INDEX IF NOT EXISTS ix_instruments_symbol ON instruments (symbol);

-- 3. ALERTS TABLE
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instrument_id VARCHAR(36) NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL DEFAULT 'PERCENTAGE',
    reference_type VARCHAR(30) NOT NULL DEFAULT 'CURRENT_PRICE',
    reference_price DOUBLE PRECISION NOT NULL,
    direction VARCHAR(10) NOT NULL,
    threshold_percent DOUBLE PRECISION NOT NULL,
    target_price DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_alerts_id ON alerts (id);
CREATE INDEX IF NOT EXISTS ix_alerts_user_id ON alerts (user_id);
CREATE INDEX IF NOT EXISTS ix_alerts_instrument_id ON alerts (instrument_id);
CREATE INDEX IF NOT EXISTS ix_alerts_direction ON alerts (direction);
CREATE INDEX IF NOT EXISTS ix_alerts_target_price ON alerts (target_price);
CREATE INDEX IF NOT EXISTS ix_alerts_status ON alerts (status);

-- 4. ALERT HISTORY TABLE
CREATE TABLE IF NOT EXISTS alert_history (
    id VARCHAR(36) PRIMARY KEY,
    alert_id VARCHAR(36) NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instrument_id VARCHAR(36) NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    trigger_price DOUBLE PRECISION NOT NULL,
    target_price DOUBLE PRECISION NOT NULL,
    reference_price DOUBLE PRECISION NOT NULL,
    notification_channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
    notification_status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_alert_history_id ON alert_history (id);
CREATE INDEX IF NOT EXISTS ix_alert_history_alert_id ON alert_history (alert_id);
CREATE INDEX IF NOT EXISTS ix_alert_history_user_id ON alert_history (user_id);
CREATE INDEX IF NOT EXISTS ix_alert_history_instrument_id ON alert_history (instrument_id);

-- 5. WATCHLISTS TABLE
CREATE TABLE IF NOT EXISTS watchlists (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Watchlist',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_watchlists_id ON watchlists (id);
CREATE INDEX IF NOT EXISTS ix_watchlists_user_id ON watchlists (user_id);

-- 6. WATCHLIST ITEMS TABLE (Includes column migrations for existing databases)
CREATE TABLE IF NOT EXISTS watchlist_items (
    id VARCHAR(36) PRIMARY KEY,
    watchlist_id VARCHAR(36) NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    instrument_id VARCHAR(36) NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    auto_monitor BOOLEAN NOT NULL DEFAULT TRUE,
    strategy_code VARCHAR(50) NOT NULL DEFAULT 'CANDLE_3_PERCENT_5M',
    buy_percent DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    sell_percent DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_watchlist_instrument UNIQUE (watchlist_id, instrument_id)
);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS auto_monitor BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS strategy_code VARCHAR(50) NOT NULL DEFAULT 'CANDLE_3_PERCENT_5M';
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS buy_percent DOUBLE PRECISION NOT NULL DEFAULT 3.0;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS sell_percent DOUBLE PRECISION NOT NULL DEFAULT 3.0;
CREATE INDEX IF NOT EXISTS ix_watchlist_items_id ON watchlist_items (id);
CREATE INDEX IF NOT EXISTS ix_watchlist_items_watchlist_id ON watchlist_items (watchlist_id);
CREATE INDEX IF NOT EXISTS ix_watchlist_items_instrument_id ON watchlist_items (instrument_id);

-- 7. INDEXES (CATEGORIES) TABLE
CREATE TABLE IF NOT EXISTS indexes (
    id VARCHAR(36) PRIMARY KEY,
    symbol VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_indexes_symbol ON indexes (symbol);
CREATE INDEX IF NOT EXISTS ix_indexes_category ON indexes (category);

-- 8. INDEX CONSTITUENTS TABLE
CREATE TABLE IF NOT EXISTS index_constituents (
    id VARCHAR(36) PRIMARY KEY,
    index_id VARCHAR(36) NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
    instrument_id VARCHAR(36) NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    weightage DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_index_constituents_index_id ON index_constituents (index_id);
CREATE INDEX IF NOT EXISTS ix_index_constituents_instrument_id ON index_constituents (instrument_id);

-- 9. CANDLES 5M TABLE
CREATE TABLE IF NOT EXISTS candles_5m (
    id VARCHAR(36) PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL,
    timeframe VARCHAR(10) NOT NULL DEFAULT '5m',
    open DOUBLE PRECISION NOT NULL,
    high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL,
    close DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    candle_start_time TIMESTAMPTZ NOT NULL,
    candle_end_time TIMESTAMPTZ NOT NULL,
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candle_symbol_start UNIQUE (symbol, candle_start_time)
);
CREATE INDEX IF NOT EXISTS ix_candles_5m_symbol ON candles_5m (symbol);
CREATE INDEX IF NOT EXISTS ix_candles_5m_candle_start_time ON candles_5m (candle_start_time);
CREATE INDEX IF NOT EXISTS ix_candles_5m_is_finalized ON candles_5m (is_finalized);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candle_symbol_start ON candles_5m (symbol, candle_start_time);

-- 10. STRATEGIES TABLE
CREATE TABLE IF NOT EXISTS strategies (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_strategies_code ON strategies (code);

-- 11. STRATEGY TRIGGERS TABLE
CREATE TABLE IF NOT EXISTS strategy_triggers (
    id VARCHAR(36) PRIMARY KEY,
    strategy_id VARCHAR(36) NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    symbol VARCHAR(30) NOT NULL,
    index_id VARCHAR(36) REFERENCES indexes(id) ON DELETE SET NULL,
    reference_candle_id VARCHAR(36) REFERENCES candles_5m(id) ON DELETE SET NULL,
    signal_type VARCHAR(10) NOT NULL,
    reference_price DOUBLE PRECISION NOT NULL,
    percentage DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    trigger_price DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    reference_candle_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    replaced_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_strategy_triggers_strategy_id ON strategy_triggers (strategy_id);
CREATE INDEX IF NOT EXISTS ix_strategy_triggers_symbol ON strategy_triggers (symbol);
CREATE INDEX IF NOT EXISTS ix_strategy_triggers_index_id ON strategy_triggers (index_id);
CREATE INDEX IF NOT EXISTS ix_strategy_triggers_reference_candle_id ON strategy_triggers (reference_candle_id);
CREATE INDEX IF NOT EXISTS ix_strategy_triggers_status ON strategy_triggers (status);
CREATE INDEX IF NOT EXISTS idx_trigger_sym_status ON strategy_triggers (symbol, status);

-- 12. STRATEGY SIGNALS TABLE
CREATE TABLE IF NOT EXISTS strategy_signals (
    id VARCHAR(36) PRIMARY KEY,
    strategy_id VARCHAR(36) NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    trigger_id VARCHAR(36) REFERENCES strategy_triggers(id) ON DELETE SET NULL,
    symbol VARCHAR(30) NOT NULL,
    index_id VARCHAR(36) REFERENCES indexes(id) ON DELETE SET NULL,
    signal_type VARCHAR(10) NOT NULL,
    trigger_price DOUBLE PRECISION NOT NULL,
    actual_market_price DOUBLE PRECISION NOT NULL,
    reference_price DOUBLE PRECISION,
    trigger_percent DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    signal_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_candle_time TIMESTAMPTZ,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_strategy_signals_strategy_id ON strategy_signals (strategy_id);
CREATE INDEX IF NOT EXISTS ix_strategy_signals_trigger_id ON strategy_signals (trigger_id);
CREATE INDEX IF NOT EXISTS ix_strategy_signals_symbol ON strategy_signals (symbol);
CREATE INDEX IF NOT EXISTS ix_strategy_signals_index_id ON strategy_signals (index_id);
CREATE INDEX IF NOT EXISTS ix_strategy_signals_signal_type ON strategy_signals (signal_type);
CREATE INDEX IF NOT EXISTS ix_strategy_signals_signal_time ON strategy_signals (signal_time);
CREATE INDEX IF NOT EXISTS idx_signal_sym_time ON strategy_signals (symbol, signal_time);

-- 13. USER NOTIFICATIONS LEDGER TABLE
CREATE TABLE IF NOT EXISTS user_notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    watchlist_id VARCHAR(36) REFERENCES watchlists(id) ON DELETE SET NULL,
    instrument_id VARCHAR(36) REFERENCES instruments(id) ON DELETE SET NULL,
    symbol VARCHAR(30) NOT NULL,
    signal_id VARCHAR(36) REFERENCES strategy_signals(id) ON DELETE SET NULL,
    notification_type VARCHAR(30) NOT NULL DEFAULT 'WATCHLIST_SIGNAL',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    signal_type VARCHAR(10),
    trigger_price DOUBLE PRECISION,
    market_price DOUBLE PRECISION,
    reference_price DOUBLE PRECISION,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_user_notifications_id ON user_notifications (id);
CREATE INDEX IF NOT EXISTS ix_user_notifications_user_id ON user_notifications (user_id);
CREATE INDEX IF NOT EXISTS ix_user_notifications_watchlist_id ON user_notifications (watchlist_id);
CREATE INDEX IF NOT EXISTS ix_user_notifications_instrument_id ON user_notifications (instrument_id);
CREATE INDEX IF NOT EXISTS ix_user_notifications_symbol ON user_notifications (symbol);
CREATE INDEX IF NOT EXISTS ix_user_notifications_signal_id ON user_notifications (signal_id);
CREATE INDEX IF NOT EXISTS ix_user_notifications_notification_type ON user_notifications (notification_type);
CREATE INDEX IF NOT EXISTS ix_user_notifications_is_read ON user_notifications (is_read);

-- 14. PUSH SUBSCRIPTIONS (DEVICE NOTIFICATIONS) TABLE
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_id ON push_subscriptions (id);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id ON push_subscriptions (user_id);
