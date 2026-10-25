$ErrorActionPreference='Stop'
$projectAlias='E:\Codex\UnrealSports'
$game=Join-Path $projectAlias 'Delivery\Windows\MemorySports.exe'
$testUser=Join-Path $projectAlias 'Reports\StandaloneUser'
$testSaved=Join-Path $testUser 'Saved'
$archive=$null
if (-not (Test-Path -LiteralPath $game)) {throw '独立包尚未生成。'}
$evidenceSource=Join-Path $projectAlias 'Delivery\Windows\MemorySports\Reports\Evidence'
$previous=@(Get-ChildItem -LiteralPath $evidenceSource -Filter 'standalone-*' -File -ErrorAction SilentlyContinue)
if ($previous.Count -gt 0) {
    $archive=Join-Path $projectAlias ('Reports\Iterations\Standalone-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $archive -Force | Out-Null
    foreach($item in $previous) {Move-Item -LiteralPath $item.FullName -Destination $archive}
}
$oldLog=Join-Path $projectAlias 'Reports\standalone-qa.log'
if(Test-Path -LiteralPath $oldLog) {
    if (-not $archive) {
        $archive=Join-Path $projectAlias ('Reports\Iterations\Standalone-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
        New-Item -ItemType Directory -Path $archive -Force | Out-Null
    }
    Move-Item -LiteralPath $oldLog -Destination (Join-Path $archive 'engine.log')
}
New-Item -ItemType Directory -Path $testSaved -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectAlias 'Reports\standalone-input-sequence.json') -Destination (Join-Path $testSaved 'qa-sequence.json')
# 测试存档独立于正常游玩；不用桌面按键注入，回放在 Unreal 玩家输入系统中执行。
[IO.File]::WriteAllText((Join-Path $testSaved 'ride-progress.json'),'{"distance":0,"gear":7}',(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $testSaved 'motion-loadout.json'),'{"shot":1,"layup":0,"dunk":0}',(New-Object Text.UTF8Encoding($false)))
$arguments=@('/Game/MemorySports/Maps/TrainingHall','-dx11','-windowed','-ForceRes','-ResX=1600','-ResY=900','-SportsQA',"-UserDir=$testUser/","-abslog=$projectAlias\Reports\standalone-qa.log")
$launcher=Start-Process -FilePath $game -ArgumentList $arguments -WorkingDirectory $projectAlias -WindowStyle Normal -PassThru
$started=Get-Date
$returnConfigured=$false
$complete=$false
$modeHistory=@()
while (((Get-Date)-$started).TotalSeconds -lt 480) {
    Start-Sleep -Seconds 2
    $logPath=Join-Path $projectAlias 'Reports\standalone-qa.log'
    if ((Test-Path -LiteralPath $logPath) -and (Select-String -LiteralPath $logPath -Pattern 'Fatal error!' -Quiet)) {throw '独立包出现崩溃，保留日志并停止验收。'}
    $statePath=Join-Path $testSaved 'runtime-state.json'
    if (-not (Test-Path -LiteralPath $statePath)) {continue}
    # 新进程首次写入前不得把上一轮骑行遥测误当作本轮已经切换场景。
    if ((Get-Item -LiteralPath $statePath).LastWriteTime -lt $started) {continue}
    try {$state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json} catch {continue}
    if ($modeHistory.Count -eq 0 -or $modeHistory[-1] -ne $state.mode) {$modeHistory+=@($state.mode)}
    if ($state.mode -eq 'cycling' -and -not $returnConfigured) {
        # 骑行已经把自己的序列读入内存，只替换返回篮球时读取的序列，验证反向切换后正常退出。
        $returnSequence=@{basketball=@(@{at=3;record='standalone-court-return'},@{at=6;key='F10';down=$true});cycling=@()}
        [IO.File]::WriteAllText((Join-Path $testSaved 'qa-sequence.json'),($returnSequence|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
        $returnConfigured=$true
    }
    $returned=Join-Path $projectAlias 'Delivery\Windows\MemorySports\Reports\Evidence\standalone-court-return.json'
    if ($returnConfigured -and ($modeHistory -join '>') -eq 'basketball>cycling>basketball' -and (Test-Path -LiteralPath $returned)) {$complete=$true;break}
}
if (-not $complete) {throw '独立包回放未在时限内完成，请保留现场与日志。'}
$shutdownStarted=Get-Date
do {
    Start-Sleep -Seconds 2
    $runtime=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq (Join-Path $projectAlias 'Delivery\Windows\MemorySports\Binaries\Win64\MemorySports.exe') -and $_.CommandLine -like '*-SportsQA*'})
} while ($runtime.Count -gt 0 -and ((Get-Date)-$shutdownStarted).TotalSeconds -lt 40)
if ($runtime.Count -gt 0) {throw 'F10 后测试程序仍未退出，请检查日志。'}
$evidenceDestination=Join-Path $projectAlias 'Reports\StandaloneEvidence'
New-Item -ItemType Directory -Path $evidenceDestination -Force | Out-Null
Get-ChildItem -LiteralPath $evidenceSource -Filter 'standalone-*' -File | Copy-Item -Destination $evidenceDestination
Get-ChildItem -LiteralPath $evidenceSource -Filter 'ride-20*' -File | Where-Object {$_.LastWriteTime -ge $started} | Copy-Item -Destination $evidenceDestination
$result=@{completed=$true;launchProgram=$game;launcherId=$launcher.Id;userDirectory=$testUser;returnedToCourt=$complete;modeHistory=$modeHistory;automaticExit=$true;started=$started.ToString('o');runtimeSHA256=(Get-FileHash -LiteralPath (Join-Path $projectAlias 'Delivery\Windows\MemorySports\Binaries\Win64\MemorySports.exe') -Algorithm SHA256).Hash;elapsedSeconds=((Get-Date)-$started).TotalSeconds;method='Unreal native player-input events and DX11 viewport capture'}
[IO.File]::WriteAllText((Join-Path $projectAlias 'Reports\standalone-run.json'),($result|ConvertTo-Json -Depth 4),(New-Object Text.UTF8Encoding($false)))
$result|ConvertTo-Json
