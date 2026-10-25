param([switch]$Editor,[switch]$TraceInput)
$ErrorActionPreference='Stop'
$project='E:\Codex\UnrealSports'
$kind=if($Editor){'Editor'}else{'Standalone'}
$testUser=Join-Path $project "Reports\UpgradeUser-$kind"
$testSaved=Join-Path $testUser 'Saved'
New-Item -ItemType Directory -Path $testSaved -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'Reports\upgrade-input-sequence.json') -Destination (Join-Path $testSaved 'qa-sequence.json')
[IO.File]::WriteAllText((Join-Path $testSaved 'ride-progress.json'),'{"distance":0,"gear":7}',(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $testSaved 'motion-loadout.json'),'{"shot":1,"layup":0,"dunk":0}',(New-Object Text.UTF8Encoding($false)))
$log=Join-Path $project "Reports\upgrade-$kind.log"
$argsList=@('/Game/MemorySports/Maps/TrainingHall','-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900','-SportsQA',"-UserDir=$testUser/","-abslog=$log")
if($TraceInput){$argsList+=@('-LogCmds="LogPlayerInput VeryVerbose"')}
if($Editor){
    $program='C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'
    $argsList=@((Join-Path $project 'MemorySports.uproject'))+$argsList+@('-game','-NoSplash')
    $evidenceSource=Join-Path $project 'Reports\Evidence'
}else{
    $program=Join-Path $project 'Delivery\Windows\MemorySports.exe'
    $evidenceSource=Join-Path $project 'Delivery\Windows\MemorySports\Reports\Evidence'
}
[Environment]::SetEnvironmentVariable('UE-LocalDataCachePath','E:\Codex\UnrealSportsCache\DDC','Process')
$started=Get-Date
$launcher=Start-Process -FilePath $program -ArgumentList $argsList -WorkingDirectory $project -WindowStyle Normal -PassThru
$history=@()
$seen=$false
while(((Get-Date)-$started).TotalSeconds -lt 600){
    Start-Sleep -Seconds 2
    if((Test-Path -LiteralPath $log) -and (Select-String -LiteralPath $log -Pattern 'Fatal error!' -Quiet)){throw 'Native upgrade render crashed; preserve log.'}
    $statePath=Join-Path $testSaved 'runtime-state.json'
    if((Test-Path -LiteralPath $statePath) -and (Get-Item -LiteralPath $statePath).LastWriteTime -ge $started){
        try{$state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json}catch{continue}
        if($history.Count -eq 0 -or $history[-1] -ne $state.mode){$history+=@($state.mode)}
        $seen=$true
    }
    $running=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('MemorySports.exe','UnrealEditor.exe') -and $_.CommandLine -like "*-UserDir=$testUser/*"})
    if($seen -and $running.Count -eq 0){break}
}
if(-not $seen){throw 'No fresh native telemetry; do not use old evidence.'}
$runtime=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('MemorySports.exe','UnrealEditor.exe') -and $_.CommandLine -like "*-UserDir=$testUser/*"})
if($runtime.Count -gt 0){throw 'QA runtime still open; preserve process and investigate.'}
$destination=Join-Path $project ('Reports\UpgradeEvidence\'+$kind+'-'+$started.ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$files=@(Get-ChildItem -LiteralPath $evidenceSource -Filter 'upgrade-*' -File | Where-Object {$_.LastWriteTime -ge $started})
$files | Copy-Item -Destination $destination
$runtimeBinary=if($Editor){Join-Path $project 'Binaries\Win64\UnrealEditor-MemorySports.dll'}else{Join-Path $project 'Delivery\Windows\MemorySports\Binaries\Win64\MemorySports.exe'}
$result=@{completed=$true;kind=$kind;modeHistory=$history;automaticExit=$true;evidence=$destination;fileCount=$files.Count;elapsedSeconds=((Get-Date)-$started).TotalSeconds;started=$started.ToString('o');runtimeSHA256=(Get-FileHash -LiteralPath $runtimeBinary -Algorithm SHA256).Hash.ToLowerInvariant();method='Native player input; observation cameras are marked separately'}
[IO.File]::WriteAllText((Join-Path $project "Reports\upgrade-$kind-run.json"),($result|ConvertTo-Json -Depth 4),(New-Object Text.UTF8Encoding($false)))
$result|ConvertTo-Json
