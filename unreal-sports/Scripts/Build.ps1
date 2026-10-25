param([ValidateSet('Editor','Game')][string]$Target='Editor')
$ErrorActionPreference='Stop'
$build='C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat'
$projectAlias='E:\Codex\UnrealSports'
if (-not (Test-Path -LiteralPath (Join-Path $projectAlias 'MemorySports.uproject'))) {throw '请先运行 Scripts/Play.ps1 -DryRun 核对工程入口。'}
$name=if ($Target -eq 'Editor') {'MemorySportsEditor'} else {'MemorySports'}
& $build $name Win64 Development "-Project=$projectAlias\MemorySports.uproject" -WaitMutex -MaxParallelActions=2 -NoHotReloadFromIDE -NoUBA
if ($LASTEXITCODE -ne 0) {throw '原生编译未通过，请保留完整编译日志。'}
