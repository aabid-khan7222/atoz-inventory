# PowerShell script for migrating local PostgreSQL database to Render PostgreSQL
# SAFETY: Only reads from local DB, writes to Render DB

Write-Host "🚀 Starting Migration: Local DB -> Render DB" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify credentials
Write-Host "📋 Step 1: Verifying database credentials..." -ForegroundColor Yellow
node server/scripts/verify-db-credentials.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Credential verification failed. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Credentials verified" -ForegroundColor Green
Write-Host ""

# Step 2: Create tables on Render DB
Write-Host "📋 Step 2: Creating tables on Render DB..." -ForegroundColor Yellow
Write-Host "   Option A: Use API endpoint (recommended)" -ForegroundColor White
Write-Host "     1. Set NODE_ENV=production" -ForegroundColor Gray
Write-Host "     2. Set DATABASE_URL_PROD in .env" -ForegroundColor Gray
Write-Host "     3. Start server: cd server; npm start" -ForegroundColor Gray
Write-Host "     4. Call: POST http://localhost:4000/api/init" -ForegroundColor Gray
Write-Host ""
Write-Host "   Option B: Run migration script" -ForegroundColor White
Write-Host "     cd server" -ForegroundColor Gray
Write-Host "     `$env:NODE_ENV='production'" -ForegroundColor Gray
Write-Host "     npm run migrate" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Press ENTER after tables are created, or 'q' to quit"
if ($confirm -eq 'q') {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}
Write-Host ""

# Step 3: Export data from local DB
Write-Host "📋 Step 3: Exporting data from local database..." -ForegroundColor Yellow
Write-Host "   ⚠️  This will prompt for PostgreSQL password (default: 007222)" -ForegroundColor White
Write-Host ""

$dumpFile = "local_db_data_dump.sql"
$localDbUrl = "postgres://postgres:007222@localhost:5432/inventory_db"

# Extract connection details
$localDbUrlObj = [System.Uri]::new($localDbUrl)
$dbHost = $localDbUrlObj.Host
$dbPort = if ($localDbUrlObj.Port -ne -1) { $localDbUrlObj.Port } else { 5432 }
$dbName = $localDbUrlObj.AbsolutePath.TrimStart('/')
$dbUser = $localDbUrlObj.UserInfo.Split(':')[0]
$dbPassword = $localDbUrlObj.UserInfo.Split(':')[1]

# Set password as environment variable
$env:PGPASSWORD = $dbPassword

Write-Host "   Exporting from: $dbHost`:$dbPort/$dbName..." -ForegroundColor Gray

try {
    # Export data only (safe - no schema changes)
    pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName `
        --data-only `
        --column-inserts `
        --no-owner `
        --no-privileges `
        -f $dumpFile
    
    if (Test-Path $dumpFile) {
        $fileSize = (Get-Item $dumpFile).Length / 1KB
        Write-Host "✅ Data exported successfully ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green
    } else {
        throw "Dump file was not created"
    }
} catch {
    Write-Host "❌ Export failed: $_" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Host ""

# Step 4: Restore data to Render DB
Write-Host "📋 Step 4: Restoring data to Render database..." -ForegroundColor Yellow
Write-Host "   ⚠️  This will INSERT data into Render DB only" -ForegroundColor White
Write-Host ""

$renderDbUrl = "postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory"

# Extract password for Render DB
$renderDbUrlObj = [System.Uri]::new($renderDbUrl)
$renderPassword = $renderDbUrlObj.UserInfo.Split(':')[1]

# Set password as environment variable
$env:PGPASSWORD = $renderPassword

Write-Host "   Restoring to: $($renderDbUrlObj.Host)/$($renderDbUrlObj.AbsolutePath.TrimStart('/'))..." -ForegroundColor Gray

try {
    # Restore data
    psql $renderDbUrl -f $dumpFile --set ON_ERROR_STOP=on
    
    Write-Host "✅ Data restored successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Restore failed: $_" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Host ""

# Step 5: Verify migration
Write-Host "📋 Step 5: Verifying migration..." -ForegroundColor Yellow

$env:PGPASSWORD = $renderPassword

try {
    # Check table count
    $tableCountResult = psql $renderDbUrl -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
    $tableCount = [int]($tableCountResult.Trim())
    Write-Host "   ✓ Found $tableCount tables in Render DB" -ForegroundColor Green
    
    # Check row counts for key tables
    Write-Host ""
    Write-Host "   Row counts:" -ForegroundColor White
    $keyTables = @('users', 'products', 'purchases', 'sales_item')
    
    foreach ($table in $keyTables) {
        try {
            $countResult = psql $renderDbUrl -t -c "SELECT COUNT(*) FROM $table;"
            $count = [int]($countResult.Trim())
            Write-Host "     - $table`: $count rows" -ForegroundColor Gray
        } catch {
            Write-Host "     - $table`: Table not found or error" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Verification failed: $_" -ForegroundColor Red
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify data in Render database" -ForegroundColor White
Write-Host "   2. Update backend .env to use DATABASE_URL_PROD" -ForegroundColor White
Write-Host "   3. Restart backend server on Render" -ForegroundColor White
Write-Host "   4. Test application with Render database" -ForegroundColor White
Write-Host ""
Write-Host "💾 Dump file saved at: $dumpFile" -ForegroundColor Gray
Write-Host "   You can delete it after verifying migration." -ForegroundColor Gray
Write-Host ""

