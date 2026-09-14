$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$file = Join-Path $root 'data/search-catalog.json'
$catalog = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
foreach ($table in ($catalog | Where-Object kind -eq 'education')) {
  $reply = Invoke-WebRequest -Uri $table.url -UseBasicParsing
  $meta = $reply.Content | ConvertFrom-Json
  $table | Add-Member -NotePropertyName metadata -NotePropertyValue $meta -Force
  Write-Output $table.title
  $meta.variables | ForEach-Object { [pscustomobject]@{code=$_.code;first=($_.values | Select-Object -First 3);last=($_.values | Select-Object -Last 2)} } | ConvertTo-Json -Depth 4
  $query = @($meta.variables | ForEach-Object { @{code=$_.code;selection=@{filter='item';values=@($_.values[0])}} })
  $body = @{query=$query;response=@{format='json'}} | ConvertTo-Json -Depth 8
  $data = Invoke-WebRequest -Uri $table.url -Method Post -ContentType 'text/plain;charset=UTF-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing
  $data.Content | Set-Content -LiteralPath (Join-Path $root ('data/verified-education-'+$table.id+'.json')) -Encoding utf8
  Write-Output $data.Content
}
$catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $file -Encoding utf8
$external = $catalog | Where-Object { -not $_.kind } | Select-Object -First 1
$page = Invoke-WebRequest -Uri $external.webUrl -UseBasicParsing
Write-Output ('External table page: '+$page.StatusCode+' '+$external.webUrl)
