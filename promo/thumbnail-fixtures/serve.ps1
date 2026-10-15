# Serves the local thumbnail-capture fixtures over plain HTTP (offline, no dependencies).
#
#   Hobby page:    http://127.0.0.1:4173/
#   Business page: http://127.0.0.1:4174/
#
# Runs until Ctrl+C. Uses only built-in .NET HttpListener — no npm install needed.

$ErrorActionPreference = "Stop"

$HobbyRoot    = Join-Path $PSScriptRoot "hobby"
$BusinessRoot = Join-Path $PSScriptRoot "business"

$ContentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".htm"  = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".woff" = "font/woff"
  ".woff2"= "font/woff2"
}

function Send-FileResponse($context, $rootDir) {
  $request  = $context.Request
  $response = $context.Response
  try {
    $relPath = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrEmpty($relPath)) { $relPath = "index.html" }
    $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootDir, $relPath))

    # Block directory traversal outside the fixture root.
    $rootFull = [System.IO.Path]::GetFullPath($rootDir)
    if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      return
    }
    if ([System.IO.Directory]::Exists($fullPath)) {
      $fullPath = [System.IO.Path]::Combine($fullPath, "index.html")
    }
    if (-not [System.IO.File]::Exists($fullPath)) {
      $response.StatusCode = 404
      return
    }

    $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    if ($ContentTypes.ContainsKey($ext)) {
      $response.ContentType = $ContentTypes[$ext]
    } else {
      $response.ContentType = "application/octet-stream"
    }
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } finally {
    $response.OutputStream.Close()
  }
}

$hobbyListener = New-Object System.Net.HttpListener
$hobbyListener.Prefixes.Add("http://127.0.0.1:4173/")
$hobbyListener.Prefixes.Add("http://localhost:4173/")

$businessListener = New-Object System.Net.HttpListener
$businessListener.Prefixes.Add("http://127.0.0.1:4174/")
$businessListener.Prefixes.Add("http://localhost:4174/")

try {
  $hobbyListener.Start()
  $businessListener.Start()
} catch {
  Write-Host ""
  Write-Host "Could not start the local servers. $_" -ForegroundColor Red
  Write-Host "If this is an access-denied error, run PowerShell once as Administrator, or reserve the URLs with:"
  Write-Host '  netsh http add urlacl url=http://127.0.0.1:4173/ user="$env:USERNAME"'
  Write-Host '  netsh http add urlacl url=http://127.0.0.1:4174/ user="$env:USERNAME"'
  exit 1
}

try {
  Write-Host ""
  Write-Host "  Thumbnail fixtures are live:" -ForegroundColor Green
  Write-Host ""
  Write-Host "    Hobby (Moss & Sprocket) :  http://127.0.0.1:4173/" -ForegroundColor Cyan
  Write-Host "    Business (Northline)    :  http://127.0.0.1:4174/" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Bookmark each URL, then capture dial thumbnails. Press Ctrl+C to stop." -ForegroundColor Yellow
  Write-Host ""

  # NOTE: HttpListener.Pending() exists on .NET Framework only — PowerShell 7
  # (.NET Core) has no such method. Wait on GetContextAsync() tasks instead.
  $hobbyTask = $hobbyListener.GetContextAsync()
  $businessTask = $businessListener.GetContextAsync()
  $tasks = @($hobbyTask, $businessTask)

  while ($hobbyListener.IsListening -or $businessListener.IsListening) {
    try {
      $ready = [System.Threading.Tasks.Task]::WaitAny($tasks, 250)
    } catch [System.ObjectDisposedException] {
      break
    }
    if ($ready -eq -1) { continue }  # timeout tick: re-check listeners, stay Ctrl+C-responsive

    $task = $tasks[$ready]
    try {
      $context = $task.GetAwaiter().GetResult()
    } catch {
      # Listener stopped/closed while waiting — exit if so, else re-arm and carry on.
      if (-not $hobbyListener.IsListening -and -not $businessListener.IsListening) { break }
      try {
        if ($ready -eq 0) { $tasks[0] = $hobbyListener.GetContextAsync() }
        else { $tasks[1] = $businessListener.GetContextAsync() }
      } catch { break }
      continue
    }

    try {
      if ($ready -eq 0) {
        $rootDir = $HobbyRoot
        $tasks[0] = $hobbyListener.GetContextAsync()
      } else {
        $rootDir = $BusinessRoot
        $tasks[1] = $businessListener.GetContextAsync()
      }
    } catch {
      Send-FileResponse $context $rootDir
      break
    }
    Send-FileResponse $context $rootDir
  }
} finally {
  $hobbyListener.Stop()
  $hobbyListener.Close()
  $businessListener.Stop()
  $businessListener.Close()
  Write-Host ""
  Write-Host "Servers stopped." -ForegroundColor Green
}
