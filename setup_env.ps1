$toolsDir = "C:\Users\pritd\tools"
if (!(Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
}

# 1. Setup Python 3.11
$pythonDir = "$toolsDir\python311"
$pthFile = "$pythonDir\python311._pth"
if (Test-Path $pthFile) {
    $content = Get-Content $pthFile
    $content = $content -replace '#import site', 'import site'
    Set-Content $pthFile $content
    Write-Host "Uncommented import site in python311._pth"
}

$getPip = "$toolsDir\get-pip.py"
if (!(Test-Path $getPip)) {
    Write-Host "Downloading get-pip.py..."
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
}

Write-Host "Installing pip..."
& "$pythonDir\python.exe" $getPip

# 2. Setup Node.js LTS
$nodeDir = "$toolsDir\nodejs"
if (!(Test-Path "$nodeDir\node.exe")) {
    Write-Host "Downloading Node.js..."
    $nodeZip = "$toolsDir\node.zip"
    if (!(Test-Path $nodeZip)) {
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.17.0/node-v20.17.0-win-x64.zip" -OutFile $nodeZip
    }
    $tempNode = "$toolsDir\node_temp"
    Expand-Archive -Path $nodeZip -DestinationPath $tempNode -Force
    Copy-Item -Path "$tempNode\node-v20.17.0-win-x64\*" -Destination $nodeDir -Recurse -Force
    Remove-Item -Path $tempNode -Recurse -Force
}

# 3. Add to user PATH permanently
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$neededPaths = @($pythonDir, "$pythonDir\Scripts", $nodeDir)
$updatedPath = $userPath
foreach ($p in $neededPaths) {
    if ($updatedPath -notlike "*$p*") {
        $updatedPath = "$p;$updatedPath"
    }
}
[Environment]::SetEnvironmentVariable("Path", $updatedPath, "User")
$env:PATH = "$pythonDir;$pythonDir\Scripts;$nodeDir;$env:PATH"

Write-Host "=== VERIFICATION ==="
& "$pythonDir\python.exe" --version
& "$pythonDir\Scripts\pip.exe" --version
& "$nodeDir\node.exe" -v
& "$nodeDir\npm.cmd" -v
