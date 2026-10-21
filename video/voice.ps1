# Generates one WAV per narration line (voice\<id>.wav) with a built-in Windows voice.
# Runs locally; nothing is sent to an online service.
#   powershell -ExecutionPolicy Bypass -File voice.ps1
param([string]$Narration = "$PSScriptRoot\narration.json", [string]$OutDir = "$PSScriptRoot\voice")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$config = Get-Content $Narration -Raw | ConvertFrom-Json
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$($config.voice)*" } | Select-Object -First 1
if (-not $voice) { throw "Voice '$($config.voice)' is not installed." }
$synth.Voice = $voice
$synth.Options.SpeakingRate = [double]$config.rate
New-Item -ItemType Directory -Force $OutDir | Out-Null

foreach ($line in $config.lines) {
  $stream = Await ($synth.SynthesizeTextToStreamAsync($line.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $size = [uint32]$stream.Size
  Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
  $bytes = New-Object byte[] $size
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes("$OutDir\$($line.id).wav", $bytes)
  $reader.Dispose(); $stream.Dispose()
  "voice\$($line.id).wav  $($line.text)"
}
"Voice: $($voice.DisplayName)"
