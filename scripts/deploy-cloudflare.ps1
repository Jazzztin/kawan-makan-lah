$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$databaseName = "kawan-makan-lah-db"
$configPath = Join-Path $projectRoot "dist\server\wrangler.json"
$baseMigrationPath = Join-Path $projectRoot "drizzle\0000_quiet_ronan.sql"
$orderLimitMigrationPath = Join-Path $projectRoot "drizzle\0001_overconfident_naoko.sql"
$sellerAuthMigrationPath = Join-Path $projectRoot "drizzle\0002_seller_password_auth.sql"
$wrangler = Join-Path $projectRoot "node_modules\.bin\wrangler.cmd"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Test-RemoteSchema {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Sql
    )

    $resultJson = & $wrangler d1 execute DB `
        --remote `
        --config $configPath `
        --command $Sql `
        --json
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect the remote D1 schema."
    }
    $result = ($resultJson -join [Environment]::NewLine) | ConvertFrom-Json
    return @($result)[0].results.Count -gt 0
}

function ConvertFrom-SecureStringPlainText {
    param(
        [Parameter(Mandatory = $true)]
        [Security.SecureString]$Value
    )

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

Push-Location $projectRoot
try {
    Invoke-Checked { npm.cmd run build } "The production build failed."

    $databaseJson = & $wrangler d1 list --json
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list Cloudflare D1 databases."
    }
    $databases = ($databaseJson -join [Environment]::NewLine) | ConvertFrom-Json
    $database = @($databases) |
        Where-Object { $_.name -eq $databaseName } |
        Select-Object -First 1

    if (-not $database) {
        Invoke-Checked {
            & $wrangler d1 create $databaseName --location apac
        } "Could not create the Cloudflare D1 database."

        $databaseJson = & $wrangler d1 list --json
        if ($LASTEXITCODE -ne 0) {
            throw "The database was created, but could not be listed."
        }
        $databases = ($databaseJson -join [Environment]::NewLine) | ConvertFrom-Json
        $database = @($databases) |
            Where-Object { $_.name -eq $databaseName } |
            Select-Object -First 1
    }

    if (-not $database.uuid) {
        throw "Could not resolve the D1 database ID for $databaseName."
    }

    $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
    $binding = @($config.d1_databases) |
        Where-Object { $_.binding -eq "DB" } |
        Select-Object -First 1
    if (-not $binding) {
        throw "The generated Wrangler configuration has no DB binding."
    }

    $binding.database_name = $databaseName
    $binding.database_id = $database.uuid
    $config.vars = [pscustomobject]@{}
    $configJson = $config | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText(
        $configPath,
        $configJson,
        [System.Text.UTF8Encoding]::new($false)
    )

    if (-not (Test-RemoteSchema "SELECT name FROM sqlite_master WHERE type='table' AND name='menu_items';")) {
        Invoke-Checked {
            & $wrangler d1 execute DB `
                --remote `
                --config $configPath `
                --file $baseMigrationPath `
                --yes
        } "Could not apply the D1 schema."
    }

    if (-not (Test-RemoteSchema "SELECT sql FROM sqlite_master WHERE type='table' AND name='order_rate_limits' AND sql LIKE '%order_rate_limit_4%';")) {
        Invoke-Checked {
            & $wrangler d1 execute DB `
                --remote `
                --config $configPath `
                --file $orderLimitMigrationPath `
                --yes
        } "Could not apply the order-rate-limit migration."
    }

    if (-not (Test-RemoteSchema "SELECT name FROM sqlite_master WHERE type='table' AND name='seller_login_attempts';")) {
        Invoke-Checked {
            & $wrangler d1 execute DB `
                --remote `
                --config $configPath `
                --file $sellerAuthMigrationPath `
                --yes
        } "Could not apply the seller-authentication migration."
    }

    $secretJson = & $wrangler secret list --config $configPath --format json
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list Worker secrets."
    }
    $secrets = ($secretJson -join [Environment]::NewLine) | ConvertFrom-Json
    $secretNames = @($secrets) | ForEach-Object { $_.name }

    if ($secretNames -notcontains "SELLER_PASSWORD") {
        $firstPassword = ConvertFrom-SecureStringPlainText (Read-Host "Choose a seller password (at least 12 characters)" -AsSecureString)
        $secondPassword = ConvertFrom-SecureStringPlainText (Read-Host "Confirm the seller password" -AsSecureString)
        if ($firstPassword.Length -lt 12) {
            throw "The seller password must contain at least 12 characters."
        }
        if ($firstPassword -cne $secondPassword) {
            throw "The seller passwords did not match."
        }
        Invoke-Checked {
            $firstPassword | & $wrangler secret put SELLER_PASSWORD --config $configPath
        } "Could not store the seller password."
        $firstPassword = $null
        $secondPassword = $null
    }

    if ($secretNames -notcontains "SELLER_SESSION_SECRET") {
        $secretBytes = New-Object byte[] 32
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $random.GetBytes($secretBytes)
        } finally {
            $random.Dispose()
        }
        $sessionSecret = [Convert]::ToBase64String($secretBytes)
        Invoke-Checked {
            $sessionSecret | & $wrangler secret put SELLER_SESSION_SECRET --config $configPath
        } "Could not store the seller session signing key."
        $sessionSecret = $null
    }

    Invoke-Checked {
        & $wrangler deploy --config $configPath
    } "Cloudflare Worker deployment failed."

    Write-Host "Seller password authentication is enabled for seller@example.com."
} finally {
    Pop-Location
}
