$ErrorActionPreference = 'Stop'
$toolchainRoot = 'E:\Codex\UnrealSportsCache\Toolchain'
$sdkRoot = Join-Path $toolchainRoot 'NETFXSDK\4.8'
$payloadRoot = Join-Path $toolchainRoot 'Payloads'
$rawRoot = Join-Path $toolchainRoot 'SdkRaw'
& 'C:\Program Files\7-Zip\7z.exe' x (Join-Path $payloadRoot 'a8') "-o$rawRoot" -y | Out-Null
if ($LASTEXITCODE -gt 1) { throw 'SDK CAB 解压失败' }
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase((Join-Path $payloadRoot 'a3'), 0)
function Read-Table($query, $columns) {
    $view = $database.OpenView($query)
    $null = $view.Execute()
    while ($record = $view.Fetch()) {
        $row = @()
        for ($i=1; $i -le $columns; $i++) { $row += $record.StringData($i) }
        ,$row
    }
    $null = $view.Close()
}
$directories = @{}
Read-Table 'SELECT `Directory`, `Directory_Parent`, `DefaultDir` FROM `Directory`' 3 | ForEach-Object { $directories[$_[0]] = @($_[1], $_[2]) }
$components = @{}
Read-Table 'SELECT `Component`, `Directory_` FROM `Component`' 2 | ForEach-Object { $components[$_[0]] = $_[1] }
# 按 MSI 的真实目录表还原 SDK，不执行安装程序，不改动系统运行时。
function Relative-Directory($id) {
    if (-not $id -or -not $directories.ContainsKey($id)) { return '' }
    $row = $directories[$id]
    $name = ($row[1] -split ':')[0] -split '\|'
    $name = $name[-1]
    $parent = Relative-Directory $row[0]
    if ($name -eq '.' -or $name -eq 'SourceDir') { return $parent }
    if (-not $parent) { return $name }
    return Join-Path $parent $name
}
$copied = 0
Read-Table 'SELECT `File`, `Component_`, `FileName` FROM `File`' 3 | ForEach-Object {
    $relative = Relative-Directory $components[$_[1]]
    $match = [regex]::Match($relative, '(?i)(?:^|\\)NETFXSDK\\4\.8\\(.+)$')
    if ($match.Success) {
        $name = ($_[2] -split '\|')[-1]
        $destination = Join-Path $sdkRoot (Join-Path $match.Groups[1].Value $name)
        New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $rawRoot $_[0]) -Destination $destination
        $copied++
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'Include\um\mscoree.h')) -or -not (Test-Path -LiteralPath (Join-Path $sdkRoot 'Lib\um\x64\mscoree.lib'))) {
    $directories.GetEnumerator() | Sort-Object Key | Format-Table -AutoSize
    throw "未能还原完整 SDK，复制文件数：$copied"
}
$registryPath = 'HKCU:\SOFTWARE\Microsoft\Microsoft SDKs\NETFXSDK\4.8'
$old = Get-ItemProperty -LiteralPath $registryPath -ErrorAction SilentlyContinue
$report = [ordered]@{ sdkRoot=$sdkRoot; files=$copied; registryPath=$registryPath; previousExists=($null -ne $old); previousValue=$old.KitsInstallationFolder; source='Microsoft signed NDP48-DevPack-ENU.exe'; scope='CurrentUser SDK discovery only' }
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\Reports\sdk-registration.json') -Encoding UTF8
New-Item -Path $registryPath -Force | Out-Null
New-ItemProperty -LiteralPath $registryPath -Name KitsInstallationFolder -Value ($sdkRoot+'\') -PropertyType String -Force | Out-Null
Write-Output "SDK restored: $copied files at $sdkRoot"
