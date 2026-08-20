# 巧答 · Android 工具链安装（JDK 17 + Android SDK，国内镜像优先，自动回退官方源）
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$toolchain = Join-Path $root '.toolchain'
$sdk = "$env:LOCALAPPDATA/Android/Sdk"
New-Item -ItemType Directory -Force -Path $toolchain | Out-Null
New-Item -ItemType Directory -Force -Path $sdk | Out-Null

function Get-FileMirror {
  param([string[]]$Urls, [string]$Out)
  foreach ($u in $Urls) {
    try {
      Write-Output "downloading: $u"
      Invoke-WebRequest -Uri $u -OutFile $Out -UseBasicParsing -TimeoutSec 600
      if ((Get-Item $Out).Length -gt 1000000) { Write-Output "ok: $Out ($((Get-Item $Out).Length) bytes)"; return $true }
    } catch { Write-Output "failed: $u -> $($_.Exception.Message)" }
  }
  return $false
}

# ---------- JDK 17 ----------
$jdkDir = Join-Path $toolchain 'jdk-17'
if (-not (Test-Path "$jdkDir/bin/java.exe")) {
  $jdkZip = Join-Path $toolchain 'jdk17.zip'
  if (Get-FileMirror @(
      'https://mirrors.huaweicloud.com/openjdk/17.0.2/openjdk-17.0.2_windows-x64_bin.zip',
      'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'
    ) $jdkZip) {
    Write-Output 'extracting jdk...'
    $tmp = Join-Path $toolchain '_jdk'
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Path $jdkZip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    Move-Item $inner.FullName $jdkDir
    Remove-Item -Recurse -Force $tmp
    Remove-Item $jdkZip
  }
} else { Write-Output 'jdk exists' }

# ---------- Android SDK ----------
function Get-SdkComponent {
  param([string[]]$Urls, [string]$DestDir)
  if (Test-Path $DestDir) { Write-Output "sdk exists: $DestDir"; return }
  $zip = Join-Path $toolchain ([System.IO.Path]::GetFileName($Urls[0]))
  if (Get-FileMirror $Urls $zip) {
    Write-Output "extracting sdk: $DestDir"
    $tmp = Join-Path $toolchain '_sdk_tmp'
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path (Split-Path $DestDir -Parent) | Out-Null
    if (Test-Path $DestDir) { Remove-Item -Recurse -Force $DestDir }
    Move-Item $inner.FullName $DestDir
    Remove-Item -Recurse -Force $tmp
    Remove-Item $zip
  }
}

Get-SdkComponent @(
  'https://mirrors.cloud.tencent.com/AndroidSDK/build-tools_r34-windows.zip',
  'https://dl.google.com/android/repository/build-tools_r34-windows.zip'
) "$sdk/build-tools/34.0.0"

Get-SdkComponent @(
  'https://mirrors.cloud.tencent.com/AndroidSDK/android-14_r04.zip',
  'https://dl.google.com/android/repository/android-14_r04.zip'
) "$sdk/platforms/android-34"

Get-SdkComponent @(
  'https://mirrors.cloud.tencent.com/AndroidSDK/platform-tools_r34.0.5-windows.zip',
  'https://dl.google.com/android/repository/platform-tools_r34.0.5-windows.zip'
) "$sdk/platform-tools"

# ---------- licenses ----------
$lic = Join-Path $sdk 'licenses'
New-Item -ItemType Directory -Force -Path $lic | Out-Null
@'
24333f8a63b6825ea9c5514f83c2829b004d1fee
d56f5187479451eabf01fb78af6dfcb131a6481e
8933bad161af4178b1185d1a37fbf41ea5269c55
'@ | Set-Content -Path (Join-Path $lic 'android-sdk-license') -Encoding ascii
@'
84831b9409646a918e30573bab4c9c91346d8abd
'@ | Set-Content -Path (Join-Path $lic 'android-sdk-preview-license') -Encoding ascii

Write-Output '=== toolchain summary ==='
& "$jdkDir/bin/java.exe" -version 2>&1 | Select-Object -First 2
Get-ChildItem "$sdk/build-tools/34.0.0" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'aapt|apksigner|zipalign' } | Select-Object Name
Write-Output '=== done ==='
