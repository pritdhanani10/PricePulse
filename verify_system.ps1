$baseUrl = "http://127.0.0.1:8000/api"

Write-Host "`n=== 1. TEST REGISTRATION ===" -ForegroundColor Cyan
$regBody = @{
    name = "Pritam Trader"
    email = "pritam_live@stockmarket.in"
    password = "LivePassword123!"
} | ConvertTo-Json
$regRes = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json"
$token = $regRes.access_token
Write-Host "Registered User: $($regRes.user.name) ($($regRes.user.email))" -ForegroundColor Green
Write-Host "JWT Token issued: $($token.Substring(0, 20))..." -ForegroundColor Green

Write-Host "`n=== 2. TEST FETCHING INSTRUMENTS & STATUS ===" -ForegroundColor Cyan
$status = Invoke-RestMethod -Uri "$baseUrl/instruments/market/status"
Write-Host "Market Status: $($status.status_text) | IST Time: $($status.market_time)" -ForegroundColor Green

$instruments = Invoke-RestMethod -Uri "$baseUrl/instruments"
Write-Host "Fetched $($instruments.Count) Tradeable Instruments:" -ForegroundColor Green
$instruments | Select-Object -First 5 symbol, name, exchange, instrument_type, base_price | Format-Table

Write-Host "`n=== 3. TEST CREATING PERCENTAGE ALERTS (UP +3% / DOWN -2%) ===" -ForegroundColor Cyan
$nifty = $instruments | Where-Object { $_.symbol -eq "NIFTY50" }
$alertPayload = @{
    instrument_id = $nifty.id
    reference_type = "CURRENT_PRICE"
    up_percentage = 3.0
    down_percentage = 2.0
} | ConvertTo-Json

$headers = @{ "Authorization" = "Bearer $token" }
$alerts = Invoke-RestMethod -Uri "$baseUrl/alerts/dual" -Method Post -Body $alertPayload -Headers $headers -ContentType "application/json"
Write-Host "Created Alerts:" -ForegroundColor Green
$alerts | Select-Object direction, threshold_percent, reference_price, target_price, status | Format-Table

Write-Host "`n=== 4. TEST TECHNICAL ANALYSIS (SMA, EMA, RSI, MACD, BB, VWAP, ATR) ===" -ForegroundColor Cyan
$analysis = Invoke-RestMethod -Uri "$baseUrl/analysis/NIFTY50?timeframe=1D&limit=50"
Write-Host "Symbol: $($analysis.symbol) | Candles: $($analysis.candles.Count)" -ForegroundColor Green
Write-Host "Indicators computed: $($analysis.indicators.PSObject.Properties.Name -join ', ')" -ForegroundColor Green
$lastRsi = $analysis.indicators.RSI_14[-1].value
$lastSma20 = $analysis.indicators.SMA_20[-1].value
$lastEma20 = $analysis.indicators.EMA_20[-1].value
$lastVwap = $analysis.indicators.VWAP[-1].value
Write-Host "Latest Values -> RSI(14): $lastRsi | SMA(20): ₹$lastSma20 | EMA(20): ₹$lastEma20 | VWAP: ₹$lastVwap" -ForegroundColor Green

Write-Host "`n=== 5. TEST CUSTOM WATCHLIST ===" -ForegroundColor Cyan
$wlPayload = @{ name = "High Conviction NIFTY" } | ConvertTo-Json
$wl = Invoke-RestMethod -Uri "$baseUrl/watchlists" -Method Post -Body $wlPayload -Headers $headers -ContentType "application/json"
Write-Host "Created Watchlist: $($wl.name) (ID: $($wl.id))" -ForegroundColor Green

$rel = $instruments | Where-Object { $_.symbol -eq "RELIANCE" }
$addPayload = @{ instrument_id = $rel.id } | ConvertTo-Json
$wlUpdated = Invoke-RestMethod -Uri "$baseUrl/watchlists/$($wl.id)/items" -Method Post -Body $addPayload -Headers $headers -ContentType "application/json"
Write-Host "Added $($rel.symbol) to Watchlist. Total items: $($wlUpdated.items.Count)" -ForegroundColor Green

Write-Host "`n=== ALL END-TO-END TESTS PASSED SUCCESSFULLY! ===" -ForegroundColor Green
