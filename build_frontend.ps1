$tools = "C:\Users\pritd\tools\nodejs"
$env:PATH = "$tools;$env:PATH"
Set-Location "d:\Code\Stock Market\frontend"
& "$tools\npm.cmd" run build
