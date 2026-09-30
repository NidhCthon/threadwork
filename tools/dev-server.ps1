# Starts the local Foundry dev copy described in SPEC.md section 8.
#
# Killing the server leaves Config/options.json.lock behind, and the next start
# then refuses with "already locked by another process". The lock is cleared
# only when no Foundry is running on this data folder.
param(
  [string]$Root = "K:\foundry-dev",
  [int]$Port = 30001
)

$data = Join-Path $Root "data"
$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*--dataPath=$data*" }
if ($running) {
  Write-Host "Foundry is already running on $data (pid $($running.ProcessId))."
  exit 0
}

$lock = Join-Path $data "Config\options.json.lock"
if (Test-Path $lock) {
  Remove-Item -Recurse -Force $lock
  Write-Host "Removed a stale lock left by a killed server."
}

node (Join-Path $Root "app\main.js") "--dataPath=$data" "--port=$Port" --noupnp
