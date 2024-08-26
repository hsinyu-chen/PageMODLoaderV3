$ErrorActionPreference = "Stop"
Push-Location .\gui
npm i
npm run build
Pop-Location
Push-Location .\extension
npm i
npm run build
Pop-Location
$json = Get-Content -Raw -Path '.\extension_dist\manifest.json' | ConvertFrom-Json
$json.version = if ($value = Read-Host "input version ($($json.version))") { $value } else { $json.version }
$json | ConvertTo-Json | Out-File '.\extension_dist\manifest.json'
Compress-Archive '.\extension_dist\*' -DestinationPath ".\extension_dist.$($json.version).zip" -Force