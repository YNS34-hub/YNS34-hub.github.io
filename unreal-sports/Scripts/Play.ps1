param(
    [ValidateSet('Court','Ride')][string]$Mode='Court',
    [switch]$DryRun
)
$ErrorActionPreference='Stop'
$projectDirectory=Split-Path -Parent $PSScriptRoot
$directoryItem=Get-Item -LiteralPath $projectDirectory
if ($directoryItem.LinkType -eq 'Junction') { $projectDirectory=@($directoryItem.Target)[0] }
$projectDirectory=[IO.Path]::GetFullPath($projectDirectory).TrimEnd('\')
$projectAlias='E:\Codex\UnrealSports'
if (Test-Path -LiteralPath $projectAlias) {
    $aliasItem=Get-Item -LiteralPath $projectAlias
    if ($aliasItem.LinkType -ne 'Junction' -or [IO.Path]::GetFullPath(@($aliasItem.Target)[0]).TrimEnd('\') -ne $projectDirectory) {
        throw '英文工程入口指向其他目录，请保留该目录并检查 Scripts/Play.ps1。'
    }
} else {
    New-Item -ItemType Junction -Path $projectAlias -Target $projectDirectory | Out-Null
}
$editor='C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'
$map=if ($Mode -eq 'Ride') {'LakesideRide'} else {'TrainingHall'}
$nativeGame=Join-Path $projectAlias 'Delivery\Windows\MemorySports.exe'
if (Test-Path -LiteralPath $nativeGame) {
    $program=$nativeGame
    $arguments=@("/Game/MemorySports/Maps/$map",'-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900',"-UserDir=$projectAlias/","-abslog=$projectAlias\Reports\play-$Mode.log")
} else {
    if (-not (Test-Path -LiteralPath $editor)) { throw '未找到已安装的 Unreal Engine 5.8。' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectAlias 'Binaries\Win64\UnrealEditor-MemorySports.dll'))) { throw '原生模块尚未编译，请查看 README.md。' }
    $program=$editor
    $arguments=@((Join-Path $projectAlias 'MemorySports.uproject'),"/Game/MemorySports/Maps/$map",'-game','-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900','-NoSplash',"-abslog=$projectAlias\Reports\play-$Mode.log")
}
if ($DryRun) { [pscustomobject]@{Program=$program;Arguments=$arguments;Project=$projectDirectory} | ConvertTo-Json; return }
# 缓存只在启动的子进程中生效；已有网页、媒体、其他 Unreal 工程和系统配置不受影响。
[Environment]::SetEnvironmentVariable('UE-LocalDataCachePath','E:\Codex\UnrealSportsCache\DerivedData','Process')
Start-Process -FilePath $program -ArgumentList $arguments -WorkingDirectory $projectAlias -WindowStyle Normal | Out-Null
