param (
    [Parameter(Mandatory = $true)]
    [string]$Name
)
if ($Name) {
    foreach ($file in (Get-ChildItem '.\template\*')) {
        if ($file.Name -ne 'node_modules' -and $file.Name -ne 'package.json' -and $file.Name -ne 'package-lock.json') {
            if ($file -is [System.IO.DirectoryInfo]) {
                Robocopy.exe $file "MODs\$($Name)\$($file.Name)\" /e
            }
            else {
                New-Item -ItemType File -Path "MODs\$($Name)\$($file.Name)" -Force
                Copy-Item $file.FullName "MODs\$($Name)\$($file.Name)";
            }
        }
    }
    $json = Get-Content -Raw -Path '.\template\package.json' | ConvertFrom-Json
    $json.name = $Name
    $json | ConvertTo-Json | Out-File -encoding utf8 "MODs\$($Name)\package.json"
}
