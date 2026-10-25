$ErrorActionPreference='Stop'
$project='E:\Codex\UnrealSports'
Set-Location -LiteralPath $project
# PowerShell 脚本失败以异常中止；只在运行外部 Python 后读取 LASTEXITCODE。
# Start-Process 不设置 LASTEXITCODE，不能用空值把后续验收悄悄跳过。
& .\Scripts\Verify-Upgrade.ps1
python Scripts/check_upgrade.py
$upgradeStatus=$LASTEXITCODE
$upgradeRun=Get-Content -LiteralPath Reports/upgrade-Standalone-run.json -Raw | ConvertFrom-Json
Copy-Item -LiteralPath Reports/upgrade-Standalone.log -Destination (Join-Path $upgradeRun.evidence 'engine.log')
Copy-Item -LiteralPath Reports/upgrade-Standalone-checks.json -Destination (Join-Path $upgradeRun.evidence 'checks.json')
Copy-Item -LiteralPath Reports/upgrade-Standalone-run.json -Destination (Join-Path $upgradeRun.evidence 'run.json')
if($upgradeStatus -ne 0){throw 'Upgrade checks failed; keep fresh evidence and stop here.'}
& .\Scripts\Verify-Standalone.ps1
python Scripts/check_standalone.py
$regressionStatus=$LASTEXITCODE
$regressionRun=Get-Content -LiteralPath Reports/standalone-run.json -Raw | ConvertFrom-Json
$destination=Join-Path $project ('Reports\UpgradeEvidence\Regression-'+([datetime]$regressionRun.started).ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath Reports/StandaloneEvidence -File | Where-Object {$_.LastWriteTime -ge [datetime]$regressionRun.started} | Copy-Item -Destination $destination
Copy-Item -LiteralPath Reports/standalone-qa.log -Destination (Join-Path $destination 'engine.log')
Copy-Item -LiteralPath Reports/standalone-checks.json -Destination (Join-Path $destination 'checks.json')
Copy-Item -LiteralPath Reports/standalone-run.json -Destination (Join-Path $destination 'run.json')
if($regressionStatus -ne 0){throw 'Original control regression failed; keep evidence and stop here.'}
& .\Scripts\Verify-UpgradeRoute.ps1
python Scripts/preview_final_details.py
if($LASTEXITCODE -ne 0){throw 'Packaged detail inspection did not complete; keep evidence.'}
