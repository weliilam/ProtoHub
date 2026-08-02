$ProgressPreference='SilentlyContinue'
$env:LARKSUITE_CLI_NO_UPDATE_NOTIFIER='1'
$env:LARKSUITE_CLI_NO_SKILLS_NOTIFIER='1'
$all = @()
$me = "ou_18fd91a544e7ca3251fdd42786e07e90"
$file = "d:\newproject\_sp.json"
$out = "d:\newproject\_result.txt"
$pageToken = ""
$page = 0
do {
    $page++
    if ([string]::IsNullOrEmpty($pageToken)) {
        & lark-cli docs +search --as user --format json --page-size 20 > $file 2>$null
    } else {
        $env:PT = $pageToken
        lark-cli --% docs +search --as user --format json --page-size 20 --page-token %PT% > $file 2>$null
    }
    $txt = Get-Content $file -Raw
    $json = $txt | ConvertFrom-Json
    $all += $json.data.results
    $hasMore = $json.data.has_more
    $pageToken = $json.data.page_token
} while ($hasMore -and $all.Count -lt 400)

$mine = $all | Where-Object { $_.result_meta.owner_id -eq $me }
$sorted = $mine | Sort-Object { [long]$_.result_meta.create_time } -Descending
"=== 卓运康创建的需求文档 (共 $($sorted.Count) 个, 全量搜索) ===" | Out-File -Encoding utf8 $out
$sorted | ForEach-Object {
    $m=$_.result_meta
    "$(($m.create_time_iso)) | $(($_.title_highlighted -replace '<[^>]*>','' -replace '&amp;','&')) | $($m.url)"
} | Out-File -Encoding utf8 -Append $out
Remove-Item $file
"DONE"
