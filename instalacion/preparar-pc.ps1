<#
.SYNOPSIS
    Prepara la PC del gimnasio para SUMMIT: carpetas, permisos, scripts y archivos de configuración.

.DESCRIPTION
    Crea esta estructura (por defecto en C:\SUMMIT):
        app\                  el backend (summit-backend.jar) y app\config\application.properties (privado)
        web\                  la app compilada que muestra Caddy
        caddy\                Caddy, su Caddyfile y sus certificados
        herramientas\         Shawl (el programa que corre SUMMIT como servicio de Windows)
        scripts\              estos scripts (copias, restauración, chequeo...)
        config\               summit.psd1 (opciones) y secretos-copias.dat (claves cifradas)
        datos\uploads\        certificados médicos y fotos de los socios
        copias\               copias de seguridad
        logs\                 registros
        restauraciones\       carpeta de trabajo para restaurar copias
        versiones\            la versión anterior, para volver atrás después de una actualización

    Las carpetas con datos personales o claves quedan solo para Windows (SYSTEM) y los administradores. Los servicios
    reciben sus permisos al instalarlos (instalar-servicios.ps1).

    También crea, si no existen: config\summit.psd1, app\config\application.properties (con una clave de sesiones al
    azar y una contraseña inicial para el admin, que se muestra una sola vez) y caddy\Caddyfile.
    Se puede correr de nuevo (por ejemplo, para actualizar los scripts): no pisa la configuración que ya existe ni
    cambia los permisos, que pone solo la primera vez.

.PARAMETER Raiz
    Carpeta de instalación (por defecto C:\SUMMIT).

.PARAMETER RehacerPermisos
    Vuelve a poner los permisos de las carpetas aunque no sea la primera vez. Les saca el acceso a los servicios:
    después hay que correr instalar-servicios.ps1 de nuevo.
#>
[CmdletBinding()]
param([string]$Raiz = 'C:\SUMMIT', [switch]$RehacerPermisos)

. (Join-Path $PSScriptRoot 'comun.ps1')

$codigo = 1
try {
    $Raiz = [IO.Path]::GetFullPath($Raiz).TrimEnd('\')
    $esAdmin = Test-SummitAdministrador
    if (-not $esAdmin) {
        Write-Host 'Aviso: PowerShell no está como administrador. Funciona igual, pero tu usuario queda con acceso a las carpetas privadas.' -ForegroundColor Yellow
        Write-Host '       En la PC del gimnasio conviene correrlo como administrador.' -ForegroundColor Yellow
    }

    # Primera vez = todavía no existe config\summit.psd1. Después, los permisos no se tocan: instalar-servicios.ps1
    # les agrega a las cuentas de los servicios los que necesitan, y volver a ponerlos se los sacaría
    $primeraVez = -not (Test-Path -LiteralPath (Join-Path $Raiz 'config\summit.psd1'))
    $carpetas = 'app', 'app\config', 'app\tmp', 'web', 'caddy', 'caddy\datos', 'herramientas', 'scripts', 'config', 'datos', 'datos\uploads', 'copias', 'logs', 'restauraciones', 'versiones'
    foreach ($carpeta in $carpetas) {
        $ruta = Join-Path $Raiz $carpeta
        if (-not (Test-Path -LiteralPath $ruta)) { New-Item -ItemType Directory -Path $ruta -Force | Out-Null }
    }

    if ($primeraVez -or $RehacerPermisos) {
        # La raíz la pueden leer los usuarios de la PC (programas y scripts); lo privado, solo SYSTEM y administradores
        $reglasRaiz = @(@($script:SidSistema, 'FullControl'), @($script:SidAdministradores, 'FullControl'), @($script:SidUsuarios, 'ReadAndExecute'))
        if (-not $esAdmin) { $reglasRaiz += , @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'FullControl') }
        Set-SummitAcl -Ruta $Raiz -Reglas $reglasRaiz
        # (caddy\datos guarda la clave privada de los certificados si se usa https en la red local)
        foreach ($privada in 'app\config', 'caddy\datos', 'config', 'datos', 'copias', 'logs', 'restauraciones', 'versiones') {
            Set-SummitAcl -Ruta (Join-Path $Raiz $privada) -Reglas (Get-SummitReglasPrivadas)
        }
        Write-Host "Carpetas listas en $Raiz (las privadas, solo para SYSTEM y administradores)." -ForegroundColor Green
        if ($RehacerPermisos -and -not $primeraVez) { Write-Host 'Permisos rehechos: corré instalar-servicios.ps1 para devolverles el acceso a los servicios.' -ForegroundColor Yellow }
    } else {
        Write-Host "Carpetas de $Raiz al día (los permisos no se tocaron)." -ForegroundColor Green
    }

    # Scripts (si este script no está corriendo ya desde la carpeta instalada)
    $destinoScripts = Join-Path $Raiz 'scripts'
    if ([IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') -ne $destinoScripts) {
        Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object { @('.ps1', '.cmd', '.sql') -contains $_.Extension } | Copy-Item -Destination $destinoScripts -Force
        $plantillas = Join-Path $destinoScripts 'plantillas'
        if (-not (Test-Path -LiteralPath $plantillas)) { New-Item -ItemType Directory -Path $plantillas -Force | Out-Null }
        Copy-Item -Path (Join-Path $PSScriptRoot 'plantillas\*') -Destination $plantillas -Force
        # Si vinieron en un .zip bajado de internet, Windows los marca como "bloqueados"
        Get-ChildItem -LiteralPath $destinoScripts -Recurse -File | Unblock-File
        Write-Host "Scripts copiados a $destinoScripts." -ForegroundColor Green
    }

    # Opciones de los scripts
    $rutaConfig = Join-Path $Raiz 'config\summit.psd1'
    if (-not (Test-Path -LiteralPath $rutaConfig)) {
        $texto = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'plantillas\summit.psd1'), [Text.Encoding]::UTF8)
        $texto = $texto.Replace('C:\SUMMIT', $Raiz)
        [IO.File]::WriteAllText($rutaConfig, $texto, (New-Object System.Text.UTF8Encoding($true)))
        Write-Host "Creado $rutaConfig." -ForegroundColor Green
    } else {
        Write-Host "Ya existía $rutaConfig (no se tocó)."
    }

    # Configuración privada del backend
    $rutaApp = Join-Path $Raiz 'app\config\application.properties'
    $existia = Test-Path -LiteralPath $rutaApp
    $adminNueva = Initialize-SummitConfigApp -Ruta $rutaApp -Raiz $Raiz
    if ($existia) { Write-Host "Ya existía $rutaApp (se completó lo que faltaba)." } else { Write-Host "Creado $rutaApp (privado)." -ForegroundColor Green }
    if ($adminNueva) {
        Write-Host ''
        Write-Host '  Contraseña inicial del administrador de SUMMIT (admin@summit.com):' -ForegroundColor Yellow
        Write-Host "      $adminNueva" -ForegroundColor White
        Write-Host '  Sirve para el primer ingreso; ahí el sistema pide elegir una propia. Anotala hasta entonces.' -ForegroundColor Yellow
        Write-Host ''
    }

    # Caddyfile
    $rutaCaddyfile = Join-Path $Raiz 'caddy\Caddyfile'
    if (-not (Test-Path -LiteralPath $rutaCaddyfile)) {
        $texto = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'plantillas\Caddyfile'), [Text.Encoding]::UTF8)
        $texto = $texto.Replace('C:/SUMMIT', $Raiz.Replace('\', '/'))
        [IO.File]::WriteAllText($rutaCaddyfile, $texto, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Creado $rutaCaddyfile." -ForegroundColor Green
    } else {
        Write-Host "Ya existía $rutaCaddyfile (no se tocó)."
    }

    Write-Host ''
    Write-Host 'Siguiente paso: crear la base y los usuarios de MySQL con' -ForegroundColor Cyan
    Write-Host "    powershell -ExecutionPolicy Bypass -File $destinoScripts\crear-usuarios-mysql.ps1" -ForegroundColor Cyan
    $codigo = 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
}
exit $codigo
