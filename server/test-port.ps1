$r = Test-NetConnection -ComputerName ac-bj4ewrj-shard-00-00.twjatkb.mongodb.net -Port 27017 -WarningAction SilentlyContinue
Write-Host "TCP OK: $($r.TcpTestSucceeded) IP: $($r.RemoteAddress)"
