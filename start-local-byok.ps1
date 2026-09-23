<#
  TP2-5 로컬 OpenAI BYOK 실행기입니다.
  .env 파일은 읽기만 하며, AI_RUNTIME_MODE는 이 실행기와 자식 프로세스에만 주입합니다.
#>

[CmdletBinding()]
param(
  [switch]$Bootstrap
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot

# Windows PowerShell 5.1은 파일 BOM과 콘솔 인코딩이 없으면 한글을 ANSI로 해석할 수 있습니다.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

# 호출한 PowerShell 세션의 환경변수가 남지 않도록 별도 bootstrap 프로세스에서 실행합니다.
if (-not $Bootstrap) {
  Start-Process powershell.exe -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Bootstrap'
  ) | Out-Null
  exit 0
}

Set-Location -LiteralPath $projectRoot
$pythonPath = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
$backendPort = 8200
$aiPort = 8212
$frontendPort = 5177
$projectTreePort = 8501

function Import-ProjectEnv([string]$envPath) {
  if (-not (Test-Path -LiteralPath $envPath)) { return }
  foreach ($line in Get-Content -LiteralPath $envPath -Encoding UTF8) {
    if ($line -match '^\s*([^#=\s]+)\s*=\s*(.*?)\s*$') {
      $key = $matches[1]
      $value = $matches[2]
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
          ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
  }
}

function Test-DevPortListening([int]$port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.ConnectAsync('127.0.0.1', $port)
    if (-not $connect.Wait(500)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Start-DevTerminal([string]$title, [string]$workingDirectory, [string]$command) {
  Start-Process powershell.exe -ArgumentList @(
    '-NoExit', '-Command',
    "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$workingDirectory'; $command"
  ) | Out-Null
}

function Start-DevTerminalIfAvailable(
  [string]$title, [string]$workingDirectory, [string]$command, [int]$port
) {
  if (Test-DevPortListening $port) {
    Write-Host "$title is already listening on port $port; duplicate start skipped."
    return $false
  }
  Start-DevTerminal $title $workingDirectory $command
  return $true
}

function Wait-HttpEndpoint([string]$uri, [string]$label, [int]$timeoutSeconds = 45) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "$label readiness confirmed."
        return $true
      }
    } catch {
      # 서버가 import/DB 초기화를 진행하는 동안의 연결 거부는 다음 시도에서 확인합니다.
    }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)
  Write-Error "$label readiness timeout after ${timeoutSeconds}s: $uri" -ErrorAction Continue
  return $false
}

function Wait-AiByokCapability([string]$uri, [int]$timeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  $lastRuntimeMode = ''
  do {
    try {
      $capability = Invoke-RestMethod -Uri $uri -TimeoutSec 3
      if ($capability.runtime_mode -eq 'openai_byok' -and $capability.requires_user_api_key -eq $true) {
        Write-Host 'AI Server BYOK capability readiness confirmed.'
        return $true
      }
      if ($null -ne $capability.runtime_mode) {
        $lastRuntimeMode = [string]$capability.runtime_mode
        if ($lastRuntimeMode -ne 'openai_byok') {
          Write-Error "AI Server responded in '$lastRuntimeMode' mode; stop that process and rerun BYOK launcher." `
            -ErrorAction Continue
          return $false
        }
      }
    } catch {
      # 포트가 열리기 전 또는 FastAPI startup 중에는 다음 시도에서 확인합니다.
    }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)
  if ($lastRuntimeMode) {
    Write-Error "AI Server BYOK readiness timeout after ${timeoutSeconds}s: $uri (last runtime mode: $lastRuntimeMode)" `
      -ErrorAction Continue
  } else {
    Write-Error "AI Server BYOK readiness timeout after ${timeoutSeconds}s: $uri" -ErrorAction Continue
  }
  return $false
}

Import-ProjectEnv (Join-Path $projectRoot '.env')
# 반드시 .env보다 나중에 주입해 기존 local_ollama 값을 덮어씁니다.
$env:AI_RUNTIME_MODE = 'openai_byok'
if ([string]::IsNullOrWhiteSpace([string]$env:BYOK_SESSION_TTL_SECONDS)) {
  $env:BYOK_SESSION_TTL_SECONDS = '7200'
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'TP2-5 Local OpenAI BYOK Mode' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'AI_RUNTIME_MODE = openai_byok'
Write-Host 'OpenAI Key       = 브라우저에서 직접 입력'
Write-Host 'Ollama           = 사용하지 않음'
Write-Host 'Dashboard        = Free'
Write-Host ''
Write-Host 'Starting services...' -ForegroundColor Green

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "Python virtual environment was not found: $pythonPath"
}

# BYOK에서는 Ollama 연결을 확인하지 않습니다. AI Router가 OpenAI만 사용합니다.
$backendStarted = Start-DevTerminalIfAvailable `
  "TOUR Backend $backendPort" (Join-Path $projectRoot 'backend') `
  "& '$pythonPath' -m uvicorn app.main:app --reload --host 0.0.0.0 --port $backendPort" $backendPort
if (-not (Wait-HttpEndpoint "http://127.0.0.1:$backendPort/health" 'Backend')) {
  throw 'Backend가 준비되지 않아 AI Server와 Frontend를 시작하지 않았습니다.'
}

$aiStarted = Start-DevTerminalIfAvailable `
  "TOUR AI BYOK $aiPort" $projectRoot `
  "& '$pythonPath' -m uvicorn ai_server.app.main:app --reload --host 0.0.0.0 --port $aiPort" $aiPort
if (-not (Wait-AiByokCapability "http://127.0.0.1:$aiPort/ai/v1/byok/capability")) {
  throw 'AI Server BYOK readiness가 확인되지 않아 Frontend를 시작하지 않았습니다.'
}

$frontendCommand = "`$env:VITE_BACKEND_PROXY_TARGET='http://127.0.0.1:$backendPort'; `$env:VITE_AI_PROXY_TARGET='http://127.0.0.1:$aiPort'; npm run dev -- --host 0.0.0.0 --port $frontendPort --strictPort"
$frontendStarted = Start-DevTerminalIfAvailable `
  "TOUR Frontend BYOK $frontendPort" (Join-Path $projectRoot 'frontend') $frontendCommand $frontendPort

$streamlitAvailable = $false
try {
  & $pythonPath -c 'import streamlit' 2>$null
  $streamlitAvailable = ($LASTEXITCODE -eq 0)
} catch {
  $streamlitAvailable = $false
}
if ($streamlitAvailable) {
  $projectTreeCommand = "& '$pythonPath' -m streamlit run project_tree_explorer/app.py --server.address 0.0.0.0 --server.port $projectTreePort --server.headless true --browser.gatherUsageStats false"
  Start-DevTerminalIfAvailable `
    "TOUR Project Tree $projectTreePort" $projectRoot $projectTreeCommand $projectTreePort | Out-Null
} else {
  Write-Warning 'Project Tree was not started because Streamlit is missing.'
}

Write-Host ''
Write-Host "Frontend: http://localhost:$frontendPort" -ForegroundColor Green
Write-Host "BYOK Test: http://localhost:$frontendPort/planning" -ForegroundColor Green
Write-Host "Capability: http://localhost:$frontendPort/ai/v1/byok/capability" -ForegroundColor Green
