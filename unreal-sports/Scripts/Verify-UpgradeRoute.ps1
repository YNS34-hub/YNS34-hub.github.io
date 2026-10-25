$ErrorActionPreference='Stop'
$project='E:\Codex\UnrealSports'
$testUser=Join-Path $project 'Reports\UpgradeUser-Route'
$saved=Join-Path $testUser 'Saved'
New-Item -ItemType Directory -Path $saved -Force | Out-Null
$sequence=@{basketball=@();cycling=@(@{at=2;viewAtM=0},@{at=3;capture='upgrade-route-start'},@{at=5;autoDrive=$true})}
[IO.File]::WriteAllText((Join-Path $saved 'qa-sequence.json'),($sequence|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $saved 'ride-progress.json'),'{"distance":0,"gear":7}',(New-Object Text.UTF8Encoding($false)))
$program=Join-Path $project 'Delivery\Windows\MemorySports.exe'
$log=Join-Path $project 'Reports\upgrade-route.log'
$argsList=@('/Game/MemorySports/Maps/LakesideRide','-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900','-SportsQA','-SportsQARouteOnly',"-UserDir=$testUser/","-abslog=$log")
$started=Get-Date
Start-Process -FilePath $program -ArgumentList $argsList -WorkingDirectory $project -WindowStyle Normal | Out-Null
$reportPath=Join-Path $project 'Delivery\Windows\MemorySports\Reports\ride-full-route-result.json'
$fresh=$false
while(((Get-Date)-$started).TotalSeconds -lt 900){
    Start-Sleep -Seconds 5
    if((Test-Path -LiteralPath $log) -and (Select-String -LiteralPath $log -Pattern 'Fatal error!' -Quiet)){throw 'Route run crashed; preserve log.'}
    if((Test-Path -LiteralPath $reportPath) -and (Get-Item -LiteralPath $reportPath).LastWriteTime -ge $started){$fresh=$true}
    $running=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'MemorySports.exe' -and $_.CommandLine -like "*-UserDir=$testUser/*"})
    if($fresh -and $running.Count -eq 0){break}
}
if(-not $fresh -or $running.Count -gt 0){throw 'Continuous route did not finish and exit in time; do not mark accepted.'}
$result=Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
if(-not $result.completed -or $result.routeMeters -lt 3520 -or $result.recoveries -ne 0 -or $result.maximumCenterOffsetCm -gt 335){throw 'Route continuity, paved road offset or recovery gate failed.'}
$destination=Join-Path $project ('Reports\UpgradeEvidence\Route-'+$started.ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath $reportPath -Destination (Join-Path $destination 'route-result.json')
Copy-Item -LiteralPath $log -Destination (Join-Path $destination 'engine.log')
$source=Join-Path $project 'Delivery\Windows\MemorySports\Reports\Evidence'
Get-ChildItem -LiteralPath $source -File | Where-Object {$_.LastWriteTime -ge $started -and ($_.Name -like 'ride-lap-*' -or $_.Name -like 'ride-full-route*' -or $_.Name -like 'upgrade-route-*')} | Copy-Item -Destination $destination
$runtimeBinary=Join-Path $project 'Delivery\Windows\MemorySports\Binaries\Win64\MemorySports.exe'
$run=@{completed=$true;automaticExit=$true;route=$result;evidence=$destination;elapsedSeconds=((Get-Date)-$started).TotalSeconds;started=$started.ToString('o');runtimeSHA256=(Get-FileHash -LiteralPath $runtimeBinary -Algorithm SHA256).Hash.ToLowerInvariant();method='Native player input through complete 3.53km; no in-lap position or velocity assignment'}
[IO.File]::WriteAllText((Join-Path $project 'Reports\upgrade-route-run.json'),($run|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
$run|ConvertTo-Json -Depth 5
