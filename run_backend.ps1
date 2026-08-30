$env:PATH = "C:\Users\pritd\tools\python311;C:\Users\pritd\tools\python311\Scripts;$env:PATH"
Set-Location "d:\Code\Stock Market\backend"
& "C:\Users\pritd\tools\python311\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
