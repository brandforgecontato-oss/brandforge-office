<#
.SYNOPSIS
  Instala os hooks do Claude Office SO no projeto do escritorio (.claude\settings.json de la).

.DESCRIPTION
  Nada global: nao usa 'uv tool install' e nao toca em ~\.claude\settings.json.
  O executavel do hook fica no .venv da pasta hooks\ deste repositorio, e o comando gravado
  no settings.json usa o caminho absoluto (com aspas, porque a pasta tem espaco).
  Tambem grava CLAUDE_OFFICE_STRIP_PREFIXES para o painel mostrar o projeto como
  "escritorio-marketingBF" em vez do caminho codificado inteiro.

.EXAMPLE
  .\instalar-hooks-escritorio.ps1
  .\instalar-hooks-escritorio.ps1 -Remover
#>
[CmdletBinding()]
param(
    [string]$EscritorioDir,
    [switch]$Remover
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
if (-not $EscritorioDir) { $EscritorioDir = Join-Path (Split-Path $raiz -Parent) 'escritorio_marketingBF' }
if (-not (Test-Path $EscritorioDir)) { throw "Pasta do escritorio nao encontrada: $EscritorioDir" }
$EscritorioDir = (Resolve-Path $EscritorioDir).Path
$settings = Join-Path $EscritorioDir '.claude\settings.json'

Push-Location (Join-Path $raiz 'hooks')
try {
    & uv sync
    $exe = (Resolve-Path '.venv\Scripts\claude-office-hook.exe').Path.Replace([string][char]92, '/')
    # O Claude Code roda o comando num shell POSIX no Windows: barras normais. O manage_hooks.py
    # poe as aspas, porque a pasta tem espaco.
    $comando = $exe

    if ($Remover) {
        & uv run python manage_hooks.py uninstall --hook-cmd $comando --settings $settings
        return
    }

    # O Claude nomeia a pasta de transcricoes trocando \ : espaco e _ por '-'.
    # A letra do drive pode vir minuscula ou maiuscula, entao os dois prefixos.
    $pai = (Split-Path $EscritorioDir -Parent)
    $codificado = ($pai -replace '[\x5c:\s_/]', '-') + '-'
    $variantes = @($codificado, ($codificado.Substring(0, 1).ToLower() + $codificado.Substring(1)),
        ($codificado.Substring(0, 1).ToUpper() + $codificado.Substring(1))) | Select-Object -Unique
    $prefixos = $variantes -join ','

    & uv run python manage_hooks.py install --hook-cmd $comando --settings $settings `
        --set-env "CLAUDE_OFFICE_STRIP_PREFIXES=$prefixos"
} finally {
    Pop-Location
}
Write-Host ''
Write-Host 'Pronto. Reinicie o Claude Code no escritorio (claude --agent orquestrador) para os hooks valerem.'
