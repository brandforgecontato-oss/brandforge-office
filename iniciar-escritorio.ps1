<#
.SYNOPSIS
  Sobe o Escritorio BrandForge (backend :8000 + frontend :3000) no Windows, sem make nem tmux.

.DESCRIPTION
  - Resumos com IA desligados (SUMMARY_BACKEND=disabled): o escritorio nao gasta a assinatura.
  - Backend e frontend escutam so em 127.0.0.1.
  - Os logs ficam em .escritorio\logs\ (backend.log, frontend.log).
  - O navegador abre com o ?token= que o backend gera a cada subida; sem ele o chat
    com o Orquestrador e recusado.

.EXAMPLE
  .\iniciar-escritorio.ps1            # sobe tudo e abre o navegador
  .\iniciar-escritorio.ps1 -Parar     # derruba backend e frontend
#>
[CmdletBinding()]
param(
    [switch]$Parar,
    [switch]$SemNavegador,
    [string]$EscritorioDir
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$logs = Join-Path $raiz '.escritorio\logs'
$portaBackend = 8000
$portaFrontend = 3000

function Parar-Porta([int]$porta) {
    $conexoes = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conexoes) {
        # /T derruba tambem os processos filhos (uvicorn --reload, next dev).
        & taskkill /PID $c.OwningProcess /T /F | Out-Null
        Write-Host "Porta $porta liberada (processo $($c.OwningProcess))."
    }
}

if ($Parar) {
    Parar-Porta $portaBackend
    Parar-Porta $portaFrontend
    return
}

foreach ($ferramenta in 'uv', 'npm') {
    if (-not (Get-Command $ferramenta -ErrorAction SilentlyContinue)) {
        throw "'$ferramenta' nao esta instalado ou nao esta no PATH."
    }
}

foreach ($porta in $portaBackend, $portaFrontend) {
    if (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue) {
        throw "A porta $porta ja esta em uso. Rode .\iniciar-escritorio.ps1 -Parar e tente de novo."
    }
}

# Dependencias so dentro do projeto (.venv e node_modules), nunca globais.
if (-not (Test-Path (Join-Path $raiz 'backend\.venv'))) {
    Write-Host 'Instalando dependencias do backend...'
    Push-Location (Join-Path $raiz 'backend'); try { & uv sync } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $raiz 'frontend\node_modules'))) {
    Write-Host 'Instalando dependencias do frontend...'
    Push-Location (Join-Path $raiz 'frontend'); try { & npm install } finally { Pop-Location }
}

New-Item -ItemType Directory -Force $logs | Out-Null
$logBackend = Join-Path $logs 'backend.log'
$logBackendErr = Join-Path $logs 'backend.err.log'
$logFrontend = Join-Path $logs 'frontend.log'
$logFrontendErr = Join-Path $logs 'frontend.err.log'
foreach ($arquivo in $logBackend, $logBackendErr, $logFrontend, $logFrontendErr) {
    Set-Content -Path $arquivo -Value '' -Encoding utf8
}

# Configuracao herdada pelos processos filhos.
$env:SUMMARY_BACKEND = 'disabled'
$env:COLUMNS = '400'   # evita que o log quebre o token em varias linhas
if ($EscritorioDir) { $env:BRANDFORGE_OFFICE_DIR = (Resolve-Path $EscritorioDir).Path }

Write-Host "Subindo o backend em http://127.0.0.1:$portaBackend ..."
Start-Process -FilePath 'uv' -WindowStyle Hidden `
    -WorkingDirectory (Join-Path $raiz 'backend') `
    -ArgumentList 'run', 'uvicorn', 'app.main:app', '--reload', '--reload-dir', 'app', '--host', '127.0.0.1', '--port', $portaBackend `
    -RedirectStandardOutput $logBackend -RedirectStandardError $logBackendErr | Out-Null

Write-Host "Subindo o frontend em http://localhost:$portaFrontend ..."
Start-Process -FilePath 'npm.cmd' -WindowStyle Hidden `
    -WorkingDirectory (Join-Path $raiz 'frontend') `
    -ArgumentList 'run', 'dev', '--', '--hostname', '127.0.0.1', '--port', $portaFrontend `
    -RedirectStandardOutput $logFrontend -RedirectStandardError $logFrontendErr | Out-Null

# Espera o backend responder e le o token da sessao nos logs.
$token = $null
$pronto = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (-not $pronto) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$portaBackend/health" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $pronto = $true }
        } catch { }
    }
    if ($pronto -and -not $token) {
        # O rich quebra a linha do token no log: junta tudo sem espacos antes de procurar.
        $texto = (Get-Content $logBackend, $logBackendErr -Raw -ErrorAction SilentlyContinue) -join ''
        $texto = $texto -replace '\s', ''
        if ($texto -match '3000/\?token=([A-Za-z0-9_\-]+)\(dev\)') { $token = $Matches[1] }
    }
    if ($pronto -and $token) { break }
}
if (-not $pronto) { throw "O backend nao respondeu em 90 s. Veja $logBackendErr" }

$url = "http://localhost:$portaFrontend/"
if ($token) { $url += "?token=$token" }
Write-Host ''
Write-Host "Escritorio no ar: $url"
Write-Host 'Para desligar: .\iniciar-escritorio.ps1 -Parar'
if (-not $SemNavegador) { Start-Process $url }
