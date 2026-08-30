$toolsDir = "C:\Users\pritd\tools"
if (Test-Path "$toolsDir\nodejs") {
    Remove-Item -Path "$toolsDir\nodejs" -Recurse -Force -ErrorAction SilentlyContinue
}
Expand-Archive -Path "$toolsDir\node.zip" -DestinationPath "$toolsDir" -Force
if (Test-Path "$toolsDir\node-v20.17.0-win-x64") {
    Rename-Item -Path "$toolsDir\node-v20.17.0-win-x64" -NewName "nodejs" -Force
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$neededPaths = @("$toolsDir\python311", "$toolsDir\python311\Scripts", "$toolsDir\nodejs")
$updatedPath = $userPath
foreach ($p in $neededPaths) {
    if ($updatedPath -notlike "*$p*") {
        $updatedPath = "$p;$updatedPath"
    }
}
[Environment]::SetEnvironmentVariable("Path", $updatedPath, "User")
$env:PATH = "$toolsDir\python311;$toolsDir\python311\Scripts;$toolsDir\nodejs;$env:PATH"

Write-Host "=== NODE VERIFICATION ==="
& "$toolsDir\nodejs\node.exe" -v
& "$toolsDir\nodejs\npm.cmd" -v
Write-Host "=== PYTHON VERIFICATION ==="
& "$toolsDir\python311\python.exe" --version
& "$toolsDir\python311\Scripts\pip.exe" --version
