<#
.SYNOPSIS
    Compila SUMMIT (frontend y backend) y deja la versión lista para instalar.

.DESCRIPTION
    1. Frontend: npm ci y npm run build (carpeta summit-frontend\dist).
    2. Backend: mvnw package (un solo archivo summit-backend.jar con todo adentro).
    3. Copia el resultado a <Salida>\app\summit-backend.jar y <Salida>\web, y anota la versión en <Salida>\app\version.txt.

    Para la primera instalación: compilar.ps1 -Salida C:\SUMMIT (no hay nada funcionando todavía).
    Para actualizar no se usa directo: actualizar.ps1 compila en C:\SUMMIT\actualizacion mientras SUMMIT sigue andando,
    hace una copia de seguridad y recién ahí cambia la versión.

    Necesita Java 21 (JDK), Node.js y conexión a internet (descarga las dependencias la primera vez).

.PARAMETER Codigo
    Carpeta del código de SUMMIT (la que tiene summit-backend y summit-frontend). Por defecto, la carpeta de arriba de
    este script, o C:\SUMMIT\codigo.

.PARAMETER Salida
    Dónde dejar app\summit-backend.jar y web\ (por defecto C:\SUMMIT).
#>
[CmdletBinding()]
param(
    [string]$Codigo,
    [string]$Salida = 'C:\SUMMIT',
    [switch]$SoloBackend,
    [switch]$SoloFrontend
)

. (Join-Path $PSScriptRoot 'comun.ps1')

$codigoSalida = 1
$volver = $null
try {
    Update-SummitEntorno
    if (-not $Codigo) {
        $arriba = Split-Path $PSScriptRoot -Parent
        if (Test-Path -LiteralPath (Join-Path $arriba 'summit-backend\pom.xml')) { $Codigo = $arriba } else { $Codigo = 'C:\SUMMIT\codigo' }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $Codigo 'summit-backend\pom.xml'))) {
        throw "No encontré el código de SUMMIT en $Codigo (tiene que tener summit-backend y summit-frontend). Indicalo con -Codigo."
    }
    $Codigo = (Resolve-Path -LiteralPath $Codigo).ProviderPath
    Write-Host "Código: $Codigo" -ForegroundColor Cyan
    $volver = Get-Location

    $carpetaApp = Join-Path $Salida 'app'
    $carpetaWeb = Join-Path $Salida 'web'
    $jarSalida = Join-Path $carpetaApp 'summit-backend.jar'
    if (-not $SoloFrontend -and (Test-Path -LiteralPath $jarSalida)) {
        # Un .jar en uso (el backend funcionando) no se puede reemplazar: mejor avisar antes de compilar
        try { [IO.File]::Open($jarSalida, 'Open', 'ReadWrite', 'None').Dispose() } catch {
            throw "$jarSalida está en uso (el backend está funcionando). Para cambiar de versión usá actualizar.ps1."
        }
    }

    if (-not $SoloBackend) {
        $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if (-not $npm) { throw 'No encontré Node.js (npm). Instalalo con:  winget install --id OpenJS.NodeJS.LTS -e   (y abrí otra ventana de PowerShell).' }
        Write-Host '--- Frontend: instalando dependencias (npm ci)...' -ForegroundColor Cyan
        Set-Location -LiteralPath (Join-Path $Codigo 'summit-frontend')
        & $npm.Source ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci falló (código $LASTEXITCODE)." }
        Write-Host '--- Frontend: compilando (npm run build)...' -ForegroundColor Cyan
        & $npm.Source run build
        if ($LASTEXITCODE -ne 0) { throw "La compilación del frontend falló (código $LASTEXITCODE)." }
        $dist = Join-Path $Codigo 'summit-frontend\dist'
        if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw "No se generó $dist\index.html." }
    }

    if (-not $SoloFrontend) {
        $java = Get-SummitJava
        if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent }
        Write-Host "--- Backend: compilando con Maven (Java: $java)..." -ForegroundColor Cyan
        Set-Location -LiteralPath (Join-Path $Codigo 'summit-backend')
        & (Join-Path $Codigo 'summit-backend\mvnw.cmd') -B -q clean package -DskipTests
        if ($LASTEXITCODE -ne 0) { throw "La compilación del backend falló (código $LASTEXITCODE). El detalle está arriba." }
        $jar = Get-ChildItem -LiteralPath (Join-Path $Codigo 'summit-backend\target') -Filter '*.jar' -File | Sort-Object Length -Descending | Select-Object -First 1
        if (-not $jar) { throw 'Maven no generó el .jar del backend.' }
        # El .jar no puede llevar adentro la configuración privada de la PC donde se compiló (contraseñas)
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($jar.FullName)
        try { $privado = @($zip.Entries | Where-Object { $_.FullName -like '*application-local.properties' }) } finally { $zip.Dispose() }
        if ($privado.Count -gt 0) {
            throw "El .jar quedó con application-local.properties adentro (las contraseñas de la PC donde se compiló). Compilá en una copia del código sin ese archivo, o pedí que el pom.xml lo excluya del .jar (INSTALACION.md, apéndice)."
        }
    }

    Set-Location -LiteralPath $volver
    if (-not $SoloFrontend) {
        if (-not (Test-Path -LiteralPath $carpetaApp)) { New-Item -ItemType Directory -Path $carpetaApp -Force | Out-Null }
        Copy-Item -LiteralPath $jar.FullName -Destination $jarSalida -Force
        Write-Host "Backend listo: $jarSalida ($(Format-SummitTamano (Get-Item -LiteralPath $jarSalida).Length))" -ForegroundColor Green
    }
    if (-not $SoloBackend) {
        Copy-SummitWeb -Origen $dist -Destino $carpetaWeb
        Write-Host "Frontend listo: $carpetaWeb" -ForegroundColor Green
    }

    $version = "Compilado el $(Get-Date -Format 'yyyy-MM-dd HH:mm') en $env:COMPUTERNAME desde $Codigo"
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($git) {
        $commit = (& $git.Source -C $Codigo log -1 --format='%h %ad %s' --date=short 2>$null)
        if ($LASTEXITCODE -eq 0 -and $commit) { $version += "`r`nVersión (commit): $commit" }
    }
    if (-not (Test-Path -LiteralPath $carpetaApp)) { New-Item -ItemType Directory -Path $carpetaApp -Force | Out-Null }
    [IO.File]::WriteAllText((Join-Path $carpetaApp 'version.txt'), $version + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
    Write-Host $version
    $codigoSalida = 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $codigoSalida = 1
} finally {
    if ($volver) { Set-Location -LiteralPath $volver }
}
exit $codigoSalida
