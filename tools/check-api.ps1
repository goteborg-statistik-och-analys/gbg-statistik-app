$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$skillText = Get-Content -LiteralPath 'C:\Users\robnor2002\.codex\skills\gbg-api\SKILL.md' -Raw
New-Item -ItemType Directory -Force -Path (Join-Path $root 'data') | Out-Null
$catalog = @()
foreach ($entry in @(@{id='kommun'; suffix='GBG'; level='Kommun'}, @{id='primar'; suffix='PRI'; level='Primärområde'}, @{id='mellan'; suffix='MO21'; level='Mellanområde'})) {
  $apiUrl = [regex]::Match($skillText, ('https://[^`\s]+/10_FolkmHelar_' + $entry.suffix + '.px')).Value
  $reply = Invoke-WebRequest -Uri $apiUrl -Headers @{Origin='http://localhost:4173'} -UseBasicParsing
  $meta = $reply.Content | ConvertFrom-Json
  $catalog += @{id=$entry.id; level=$entry.level; url=$apiUrl; metadata=$meta; checkedAt=(Get-Date -Format 'yyyy-MM-dd')}
  Write-Output ($entry.id + ': ' + $meta.title + '; CORS=' + $reply.Headers['Access-Control-Allow-Origin'])
}
$catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $root 'data/catalog.json') -Encoding utf8
$primary = $catalog | Where-Object id -eq 'primar'
$query = @()
foreach ($variable in $primary.metadata.variables) {
  $values = @($variable.values)
  if ($variable.code -eq 'Område') { $values = @('103 Majorna') }
  if ($variable.code -eq 'År') { $values = @(2010..2025 | ForEach-Object {"$_"}) }
  $query += @{code=$variable.code; selection=@{filter='item'; values=$values}}
}
$body = @{query=$query; response=@{format='json'}} | ConvertTo-Json -Depth 10
$result = Invoke-WebRequest -Uri $primary.url -Method Post -ContentType 'text/plain; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -Headers @{Origin='http://localhost:4173'} -UseBasicParsing
$result.Content | Set-Content -LiteralPath (Join-Path $root 'data/verified-majorna.json') -Encoding utf8
$parsed = $result.Content | ConvertFrom-Json
Write-Output ('POST CORS=' + $result.Headers['Access-Control-Allow-Origin'])
$parsed.columns | ConvertTo-Json -Compress
Write-Output ('Rows: ' + $parsed.data.Count)
$parsed.data | Select-Object -First 2 | ConvertTo-Json -Depth 5
