$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -m venv .venv }
    elseif (Get-Command python -ErrorAction SilentlyContinue) { & python -m venv .venv }
    else { throw 'Install Python 3.12 or newer from python.org, then run Start.ps1 again.' }
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python virtual environment.' }
    & $taskPython -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Could not install requirements. Check the network and run pip install -r requirements.txt.' }
}
& $taskPython server.py --open
