# Configure Microsoft SQL Server 2022 Express for Auto-Start & Port 1433
Write-Host "[*] Checking and configuring Microsoft SQL Server for Auto-Start..." -ForegroundColor Cyan

# 1. Configure Services to Automatic Startup
$sqlServices = @("MSSQL`$SQLEXPRESS", "MSSQLSERVER", "SQLBrowser")
foreach ($svcName in $sqlServices) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Host "  -> Setting service '$svcName' StartupType to Automatic..." -ForegroundColor Gray
        Set-Service -Name $svcName -StartupType Automatic -ErrorAction SilentlyContinue
        if ($svc.Status -ne 'Running') {
            Write-Host "  -> Starting service '$svcName'..." -ForegroundColor Gray
            Start-Service -Name $svcName -ErrorAction SilentlyContinue
        }
    }
}

# 2. Configure TCP/IP and static Port 1433 in Windows Registry for all SQL Server instances
$sqlBaseReg = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server"
if (Test-Path $sqlBaseReg) {
    $instances = Get-ChildItem -Path $sqlBaseReg -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "MSSQL*" }
    foreach ($inst in $instances) {
        $tcpPath = Join-Path $inst.PSPath "MSSQLServer\SuperSocketNetLib\Tcp"
        if (Test-Path $tcpPath) {
            Write-Host "  -> Enabling TCP/IP for $($inst.PSChildName)..." -ForegroundColor Gray
            Set-ItemProperty -Path $tcpPath -Name "Enabled" -Value 1 -Type DWord -ErrorAction SilentlyContinue

            $ipAllPath = Join-Path $tcpPath "IPAll"
            if (Test-Path $ipAllPath) {
                Write-Host "  -> Configuring TCP Port 1433 for $($inst.PSChildName)..." -ForegroundColor Gray
                Set-ItemProperty -Path $ipAllPath -Name "TcpPort" -Value "1433" -Type String -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $ipAllPath -Name "TcpDynamicPorts" -Value "" -Type String -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "[OK] SQL Server auto-start and TCP port 1433 configured." -ForegroundColor Green

