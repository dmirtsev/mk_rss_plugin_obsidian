$ErrorActionPreference = "Stop"

$pluginId = "mk-import-rss"
$pluginName = "MK Import RSS"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Выберите папку вашего vault Obsidian"
$dialog.UseDescriptionForTitle = $true

if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    exit 1
}

$vaultPath = $dialog.SelectedPath

if ([System.IO.Path]::GetFileName($vaultPath) -eq ".obsidian") {
    $vaultPath = Split-Path -Parent $vaultPath
}

if (-not (Test-Path -LiteralPath $vaultPath -PathType Container)) {
    [System.Windows.Forms.MessageBox]::Show(
        "Выбранная папка не существует.",
        "Папка не найдена",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
    exit 1
}

$obsidianDir = Join-Path $vaultPath ".obsidian"
if (-not (Test-Path -LiteralPath $obsidianDir -PathType Container)) {
    [System.Windows.Forms.MessageBox]::Show(
        "В выбранной папке нет каталога .obsidian.",
        "Это не vault Obsidian",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
    exit 1
}

$targetDir = Join-Path $obsidianDir "plugins\$pluginId"
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $scriptDir "manifest.json") -Destination (Join-Path $targetDir "manifest.json") -Force
Copy-Item -LiteralPath (Join-Path $scriptDir "main.js") -Destination (Join-Path $targetDir "main.js") -Force

$stylesPath = Join-Path $scriptDir "styles.css"
if (Test-Path -LiteralPath $stylesPath -PathType Leaf) {
    Copy-Item -LiteralPath $stylesPath -Destination (Join-Path $targetDir "styles.css") -Force
}

[System.Windows.Forms.MessageBox]::Show(
    "Плагин установлен в:`r`n$targetDir`r`n`r`nОткройте Obsidian -> Settings -> Community plugins и включите $pluginName.",
    "$pluginName установлен",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
