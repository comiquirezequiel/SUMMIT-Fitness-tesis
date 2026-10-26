<#
.SYNOPSIS
    Actualiza SUMMIT a una versión nueva sin perder datos (y permite volver a la anterior).

.DESCRIPTION
    1. Compila la versión nueva en C:\SUMMIT\actualizacion mientras la actual sigue funcionando (compilar.ps1).
    2. Hace una copia de seguridad (summit-copia-...-antes-de-actualizar.7z). Si falla, no sigue.
    3. Guarda la versión actual en C:\SUMMIT\versiones\anterior (para volver atrás).
    4. Detiene el backend, pone la versión nueva y lo vuelve a arrancar. Al arrancar, la versión nueva agrega sola
       las tablas o columnas que necesite (los datos no se tocan).
    5. Espera a que responda y corre el chequeo (doctor.ps1).

    Antes de correrlo, traé el código nuevo a C:\SUMMIT\codigo (por ejemplo, con "git pull" en esa carpeta).

.PARAMETER Codigo
    Carpeta del código nuevo (por defecto C:\SUMMIT\codigo).

.PARAMETER VolverAtras
    Vuelve a la versión que había antes de la última actualización (la base queda como está).

.PARAMETER Simular
    Compila y hace la copia de seguridad, pero no toca el servicio ni la versión instalada (para probar).
#>
[CmdletBinding()]
param(
    [string]$Config,
    [string]$Codigo,
    [switch]$VolverAtras,
    [switch]$Simular
)

. (Join-Path $PSScriptRoot 'comun.ps1')

function Wait-SummitBackend {
    param([Collections.IDictionary]$Cfg, [int]$Segundos = 180)
    $limite = (Get-Date).AddSeconds($Segundos)
    while ((Get-Date) -lt $limite) {
        $r = Get-SummitRespuestaHttp -Url ($Cfg.UrlBackend.TrimEnd('/') + '/api/planes') -Segundos 5
        if ($r.Responde -and @(200, 401, 403) -contains $r.Estado) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Switch-SummitVersion {
    param([Collections.IDictionary]$Cfg, [string]$Origen, [string]$Titulo)
    $servicio = $Cfg.ServicioBackend
    if (-not (Get-Service -Name $servicio -ErrorAction SilentlyContinue)) { throw "No existe el servicio ${servicio}: instalalo con instalar-servicios.ps1." }
    Write-SummitRegistro "Deteniendo $servicio..."
    Stop-Service -Name $servicio -Force
    (Get-Service -Name $servicio).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(90))
    $carpetaApp = Join-Path $Cfg.Raiz 'app'
    Copy-Item -LiteralPath (Join-Path $Origen 'app\summit-backend.jar') -Destination (Join-Path $carpetaApp 'summit-backend.jar') -Force
    if (Test-Path -LiteralPath (Join-Path $Origen 'app\version.txt')) { Copy-Item -LiteralPath (Join-Path $Origen 'app\version.txt') -Destination (Join-Path $carpetaApp 'version.txt') -Force }
    Copy-SummitWeb -Origen (Join-Path $Origen 'web') -Destino (Join-Path $Cfg.Raiz 'web')
    Write-SummitRegistro "Arrancando $servicio con $Titulo..."
    Start-Service -Name $servicio
}

$codigoSalida = 1
try {
    $cfg = Read-SummitConfig -Ruta $Config
    if (-not $Simular) { Assert-SummitAdministrador -Para 'actualizar SUMMIT' }
    Start-SummitRegistro -Carpeta $cfg.CarpetaRegistros -Nombre 'actualizaciones.log'
    $raiz = $cfg.Raiz
    $anterior = Join-Path $raiz 'versiones\anterior'

    if ($VolverAtras) {
        Write-SummitRegistro '=== Volver a la versión anterior'
        if (-not (Test-Path -LiteralPath (Join-Path $anterior 'app\summit-backend.jar'))) { throw "No hay una versión anterior guardada en $anterior." }
        if ($Simular) { Write-SummitRegistro "[simulación] volvería a la versión de $anterior" 'AVISO'; $codigoSalida = 0; exit 0 }
        Switch-SummitVersion -Cfg $cfg -Origen $anterior -Titulo 'la versión anterior'
        if (-not (Wait-SummitBackend -Cfg $cfg)) { throw "El backend no respondió. Mirá $($cfg.CarpetaRegistros)\summit-backend_rCURRENT.log." }
        Write-SummitRegistro 'Volvió la versión anterior y el backend responde.' 'OK'
    } else {
        Write-SummitRegistro '=== Actualización de SUMMIT'
        if (-not $Codigo) { $Codigo = Join-Path $raiz 'codigo' }
        $nueva = Join-Path $raiz 'actualizacion'
        if (Test-Path -LiteralPath $nueva) { Remove-Item -LiteralPath $nueva -Recurse -Force }

        Write-SummitRegistro "1/4 Compilando la versión nueva desde $Codigo (SUMMIT sigue funcionando)..."
        & (Join-Path $PSScriptRoot 'compilar.ps1') -Codigo $Codigo -Salida $nueva
        if ($LASTEXITCODE -ne 0) { throw 'La compilación falló: no se cambió nada.' }
        Start-SummitRegistro -Carpeta $cfg.CarpetaRegistros -Nombre 'actualizaciones.log'

        Write-SummitRegistro '2/4 Copia de seguridad antes de actualizar...'
        $parametros = @{ Etiqueta = 'antes-de-actualizar' }
        if ($cfg.RutaConfig) { $parametros.Config = $cfg.RutaConfig }
        & (Join-Path $PSScriptRoot 'copia-de-seguridad.ps1') @parametros
        if ($LASTEXITCODE -eq 1) { throw 'La copia de seguridad falló: no se actualizó nada.' }
        Start-SummitRegistro -Carpeta $cfg.CarpetaRegistros -Nombre 'actualizaciones.log'

        if ($Simular) {
            Write-SummitRegistro "[simulación] guardaría la versión actual en $anterior, detendría $($cfg.ServicioBackend), pondría la de $nueva y lo arrancaría." 'AVISO'
            $codigoSalida = 0
            exit 0
        }

        Write-SummitRegistro "3/4 Guardando la versión actual en $anterior..."
        if (Test-Path -LiteralPath $anterior) { Remove-Item -LiteralPath $anterior -Recurse -Force }
        New-Item -ItemType Directory -Path (Join-Path $anterior 'app') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $raiz 'app\summit-backend.jar') -Destination (Join-Path $anterior 'app') -Force
        if (Test-Path -LiteralPath (Join-Path $raiz 'app\version.txt')) { Copy-Item -LiteralPath (Join-Path $raiz 'app\version.txt') -Destination (Join-Path $anterior 'app') -Force }
        Copy-Item -LiteralPath (Join-Path $raiz 'web') -Destination (Join-Path $anterior 'web') -Recurse -Force

        Write-SummitRegistro '4/4 Cambiando de versión...'
        Switch-SummitVersion -Cfg $cfg -Origen $nueva -Titulo 'la versión nueva'
        if (-not (Wait-SummitBackend -Cfg $cfg)) {
            throw "La versión nueva no respondió en 3 minutos. Para volver a la anterior: actualizar.ps1 -VolverAtras. El motivo suele estar al final de $($cfg.CarpetaRegistros)\summit-backend_rCURRENT.log."
        }
        Remove-Item -LiteralPath $nueva -Recurse -Force -ErrorAction SilentlyContinue
        Write-SummitRegistro 'Versión nueva funcionando.' 'OK'
        $version = Join-Path $raiz 'app\version.txt'
        if (Test-Path -LiteralPath $version) { Get-Content -LiteralPath $version -Encoding UTF8 | ForEach-Object { Write-SummitRegistro "  $_" } }
    }
    & (Join-Path $PSScriptRoot 'doctor.ps1') -Config $cfg.RutaConfig
    $codigoSalida = 0
} catch {
    Write-SummitRegistro "ERROR: $($_.Exception.Message)" 'ERROR'
    $codigoSalida = 1
}
exit $codigoSalida
