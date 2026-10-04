param([string[]]$Ids = @('1654913944','1708920257','1582915184','907995386'), [switch]$InventoryOnly)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
$roots = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
if($steam){ [void]$roots.Add([IO.Path]::GetFullPath($steam)) }
foreach($base in @($steam, 'C:\Program Files (x86)\Steam', 'C:\Program Files\Steam')) {
  if(!$base){continue}
  $vdf=Join-Path $base 'steamapps\libraryfolders.vdf'
  if(Test-Path -LiteralPath $vdf) {
    foreach($match in [regex]::Matches((Get-Content -LiteralPath $vdf -Raw),'"path"\s+"([^"]+)"')) { [void]$roots.Add([IO.Path]::GetFullPath($match.Groups[1].Value.Replace('\\','\'))) }
  }
}
$inventory=@()
$dest=Join-Path $repo 'personal-media\wallpapers'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$metadata=@{}
$metaPath=Join-Path $dest 'collection.json'
if(Test-Path -LiteralPath $metaPath){$metadata=Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json -AsHashtable}
foreach($library in $roots) {
  $workshop=Join-Path $library 'steamapps\workshop\content\431960'
  if(!(Test-Path -LiteralPath $workshop)){continue}
  foreach($dir in Get-ChildItem -LiteralPath $workshop -Directory) {
    $project=Join-Path $dir.FullName 'project.json'
    if(!(Test-Path -LiteralPath $project)){continue}
    try{$data=Get-Content -LiteralPath $project -Raw | ConvertFrom-Json}catch{continue}
    $inventory += @{id=$dir.Name;title=$data.title;type=$data.type;library=$library;preview=$data.preview}
    if($InventoryOnly -or $dir.Name -notin $Ids){continue}
    if($data.preview -notmatch '\.(jpg|jpeg|png|webp)$'){continue}
    $preview=[IO.Path]::GetFullPath((Join-Path $dir.FullName $data.preview))
    if(!$preview.StartsWith($dir.FullName+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){continue}
    if(!(Test-Path -LiteralPath $preview)){continue}
    $name='workshop-'+$dir.Name+[IO.Path]::GetExtension($preview)
    if(!(Test-Path -LiteralPath (Join-Path $dest $name))) { Copy-Item -LiteralPath $preview -Destination (Join-Path $dest $name) }
    $metadata[$name]=@{title=$data.title;category='Wallpaper Engine';year='Collected';origin='https://steamcommunity.com/sharedfiles/filedetails/?id='+$dir.Name;description='A collected Workshop preview. Original authorship belongs to its creator.';favorite=$true}
  }
}
if(!$InventoryOnly){$metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metaPath -Encoding utf8}
New-Item -ItemType Directory -Force -Path (Join-Path $repo 'local-inventory') | Out-Null
$inventory | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $repo 'local-inventory\steam.json') -Encoding utf8
Write-Output ('Libraries checked: '+$roots.Count+'; Workshop records: '+$inventory.Count+'; selected previews: '+$metadata.Count)
