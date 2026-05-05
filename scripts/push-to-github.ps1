# Push gym-solo to https://github.com/Alool266/solo-app (run from repo root or anywhere).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "Repo: $root"

if (-not (Test-Path .git)) {
  git init
}

git remote remove origin 2>$null
git remote add origin "https://github.com/Alool266/solo-app.git"
git remote -v

git branch -M main

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git commit -m "Deploy: GitHub Pages workflow, app.config baseUrl, solo-app slug"
} elseif ($LASTEXITCODE -eq 0) {
  Write-Host "Nothing to commit."
} else {
  Write-Warning "Unexpected git diff exit code: $LASTEXITCODE"
}

git push -u origin main
exit $LASTEXITCODE
