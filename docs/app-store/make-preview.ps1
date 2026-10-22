# Turns an iPhone screen recording into an App Store app preview (6.9" iPhone, portrait).
# Apple requirements: 886x1920, 30 fps, 15-30 s, H.264, with a stereo AAC audio track.
#
# Usage:  .\make-preview.ps1 -In C:\path\ScreenRecording.mov [-Start 00:00:02] [-Duration 30]
param(
  [Parameter(Mandatory = $true)][string]$In,
  [string]$Start = "00:00:00",
  [int]$Duration = 30,
  [string]$Out = "app-preview-886x1920.mp4"
)

if ($Duration -lt 15 -or $Duration -gt 30) { throw "Duration must be between 15 and 30 seconds." }

# Scale to fill 886x1920 and crop the overflow; add silent audio if the recording has none.
ffmpeg -y -ss $Start -t $Duration -i $In `
  -f lavfi -t $Duration -i "anullsrc=channel_layout=stereo:sample_rate=44100" `
  -filter_complex "[0:v]scale=886:1920:force_original_aspect_ratio=increase,crop=886:1920,fps=30,format=yuv420p[v]" `
  -map "[v]" -map 0:a? -map 1:a -shortest `
  -c:v libx264 -profile:v high -level 4.0 -b:v 10M -maxrate 12M -bufsize 20M `
  -c:a aac -b:a 256k -ac 2 -ar 44100 `
  -movflags +faststart $Out

Write-Host "Saved $Out"
