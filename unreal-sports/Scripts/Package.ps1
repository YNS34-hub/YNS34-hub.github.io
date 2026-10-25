$ErrorActionPreference='Stop'
$projectAlias='E:\Codex\UnrealSports'
$automation='C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat'
if (-not (Test-Path -LiteralPath (Join-Path $projectAlias 'Content\MemorySports\Maps\LakesideRide.umap'))) {throw '两张地图尚未生成。'}
# 仅打包到本工程 Delivery；不部署、不上传，也不访问原网页目录。
[Environment]::SetEnvironmentVariable('UE-LocalDataCachePath','E:\Codex\UnrealSportsCache\DerivedData','Process')
& $automation BuildCookRun "-project=$projectAlias\MemorySports.uproject" -noP4 -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive "-archivedirectory=$projectAlias\Delivery" -unattended -utf8output -nocompileeditor '-UbtArgs=-NoUBA -MaxParallelActions=1'
if ($LASTEXITCODE -ne 0) {throw '打包未通过，请保留 AutomationTool 和 Cook 日志。'}
