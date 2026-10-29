<#
.SYNOPSIS
    Instala (o quita) los dos servicios de Windows de SUMMIT, que arrancan solos al prender la PC.

.DESCRIPTION
    SUMMIT-Backend  el backend (java -jar app\summit-backend.jar). Arranca después de MySQL.
    SUMMIT-Web      Caddy: muestra la app (carpeta web) y le pasa /api al backend. Es lo que abren las PC de recepción.

    Los dos corren con Shawl, un programa chico que convierte cualquier comando en un servicio de Windows: si el
    programa se cae, lo vuelve a arrancar a los pocos segundos, y guarda lo que escribe en logs\ (un archivo por día,
    30 días). Cada servicio corre con su propia cuenta virtual de Windows (NT SERVICE\SUMMIT-Backend y
    NT SERVICE\SUMMIT-Web), con permiso solo sobre sus carpetas: no como SYSTEM.

    Shawl y Caddy se descargan de sus páginas oficiales de GitHub, en versiones fijas, y se verifica su huella SHA-256
    antes de usarlos. Para actualizarlos hay que cambiar la versión y la huella acá abajo.

    Se puede correr de nuevo (por ejemplo, después de actualizar Java): reinstala los servicios con la configuración
    actual. Necesita PowerShell como administrador.

.PARAMETER Quitar
    Detiene y borra los dos servicios (no borra ningún archivo).

.PARAMETER Java
    java.exe a usar (por defecto, el de JAVA_HOME).

.PARAMETER MemoriaMaxima
    Memoria máxima para el backend (por defecto 1g).

.PARAMETER Cuenta
    Virtual (por defecto) o LocalSystem (solo si algo falla con las cuentas virtuales).

.PARAMETER Simular
    Hace las verificaciones y descargas, y muestra lo que haría, sin crear ni cambiar servicios.
#>
[CmdletBinding()]
param(
    [string]$Config,
    [switch]$Quitar,
    [string]$Java,
    [ValidatePattern('^\d+[mg]$')][string]$MemoriaMaxima = '1g',
    [ValidateSet('Virtual', 'LocalSystem')][string]$Cuenta = 'Virtual',
    [switch]$Simular
)

. (Join-Path $PSScriptRoot 'comun.ps1')

# Versiones fijas, con la huella SHA-256 publicada en GitHub (verificada el 26/10/2026)
$script:Herramientas = @{
    Shawl = @{
        Version = '1.9.0'
        Url     = 'https://github.com/mtkennerly/shawl/releases/download/v1.9.0/shawl-v1.9.0-win64.zip'
        Sha256  = 'f883c5d09c9beae2efaeabd8513e7d3f57cd1d0864cec3df4f4a7b6ee904351c'
        Exe     = 'shawl.exe'
        Prueba  = @('--version')
        Espera  = 'shawl 1.9.0'
    }
    Caddy = @{
        Version = '2.11.7'
        Url     = 'https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_windows_amd64.zip'
        Sha256  = '0a1edc0b799512051c57071ce0e798d3f2cf67dc98171366f1d2b326072e3b06'
        Exe     = 'caddy.exe'
        Prueba  = @('version')
        Espera  = 'v2.11.7'
    }
}

function Install-SummitHerramienta {
    param([string]$Nombre, [string]$Carpeta)
    $datos = $script:Herramientas[$Nombre]
    $exe = Join-Path $Carpeta $datos.Exe
    if (Test-Path -LiteralPath $exe) {
        $actual = (Invoke-SummitPrograma -Programa $exe -Argumentos $datos.Prueba).Salida
        if ($actual -match [regex]::Escape($datos.Espera)) { Write-Host "$Nombre $($datos.Version) ya está en $exe."; return $exe }
    }
    Write-Host "Descargando $Nombre $($datos.Version)..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $temporal = Join-Path ([IO.Path]::GetTempPath()) ('summit-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporal -Force | Out-Null
    try {
        $zip = Join-Path $temporal 'descarga.zip'
        $anterior = $ProgressPreference
        $ProgressPreference = 'SilentlyContinue'
        try { Invoke-WebRequest -Uri $datos.Url -OutFile $zip -UseBasicParsing } finally { $ProgressPreference = $anterior }
        $huella = Get-SummitHash $zip
        if ($huella -ne $datos.Sha256) { throw "La descarga de $Nombre no tiene la huella esperada (puede estar dañada o adulterada): no se usa." }
        Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $temporal 'zip') -Force
        $encontrado = Get-ChildItem -LiteralPath (Join-Path $temporal 'zip') -Recurse -Filter $datos.Exe -File | Select-Object -First 1
        if (-not $encontrado) { throw "El .zip de $Nombre no tiene $($datos.Exe)." }
        if (-not (Test-Path -LiteralPath $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null }
        Copy-Item -LiteralPath $encontrado.FullName -Destination $exe -Force
        Write-Host "$Nombre $($datos.Version) instalado en $exe (huella verificada)." -ForegroundColor Green
        return $exe
    } finally {
        Remove-Item -LiteralPath $temporal -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Remove-SummitServicio {
    param([string]$Nombre)
    $servicio = Get-Service -Name $Nombre -ErrorAction SilentlyContinue
    if (-not $servicio) { return $false }
    if ($servicio.Status -ne 'Stopped') {
        Stop-Service -Name $Nombre -Force -ErrorAction SilentlyContinue
        try { $servicio.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60)) } catch { }
    }
    $r = Invoke-SummitPrograma -Programa 'sc.exe' -Argumentos @('delete', $Nombre)
    if ($r.Codigo -ne 0) { throw "No se pudo borrar el servicio ${Nombre}: $($r.Salida.Trim())" }
    # Windows termina de borrarlo cuando nadie lo está mirando (por ejemplo, la ventana de Servicios)
    for ($i = 0; $i -lt 20 -and (Get-Service -Name $Nombre -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
    return $true
}

function Invoke-SummitSc {
    param([string[]]$Argumentos)
    if ($Simular) { Write-Host "  [simulación] sc.exe $($Argumentos -join ' ')"; return }
    $r = Invoke-SummitPrograma -Programa 'sc.exe' -Argumentos $Argumentos
    if ($r.Codigo -ne 0) { throw "sc.exe $($Argumentos[0]) falló: $($r.Salida.Trim())" }
}

function Grant-SummitPermiso {
    param([string]$Ruta, [string]$Cuenta, [string]$Permiso)
    if ($Cuenta -eq 'LocalSystem') { return }
    $herencia = ''
    if (Test-Path -LiteralPath $Ruta -PathType Container) { $herencia = '(OI)(CI)' }
    $regla = "${Cuenta}:$herencia$Permiso"
    if ($Simular) { Write-Host "  [simulación] icacls `"$Ruta`" /grant `"$regla`""; return }
    $r = Invoke-SummitPrograma -Programa 'icacls.exe' -Argumentos @($Ruta, '/grant', $regla, '/Q')
    if ($r.Codigo -ne 0) { throw "No se pudo dar permiso a $Cuenta sobre ${Ruta}: $($r.Salida.Trim())" }
}

function Wait-SummitUrl {
    param([string]$Url, [int]$Segundos, [int[]]$Estados)
    $limite = (Get-Date).AddSeconds($Segundos)
    while ((Get-Date) -lt $limite) {
        $r = Get-SummitRespuestaHttp -Url $Url -Segundos 5
        if ($r.Responde -and $Estados -contains $r.Estado) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

$codigo = 1
try {
    if (-not $Simular) { Assert-SummitAdministrador -Para 'instalar servicios de Windows' }
    $cfg = Read-SummitConfig -Ruta $Config
    $raiz = $cfg.Raiz
    $carpetaApp = Join-Path $raiz 'app'
    $carpetaWeb = Join-Path $raiz 'web'
    $carpetaCaddy = Join-Path $raiz 'caddy'
    $carpetaHerramientas = Join-Path $raiz 'herramientas'
    $carpetaLogs = $cfg.CarpetaRegistros
    $nombreBackend = $cfg.ServicioBackend
    $nombreWeb = $cfg.ServicioWeb

    if ($Quitar) {
        foreach ($nombre in $nombreWeb, $nombreBackend) {
            if ($Simular) { Write-Host "  [simulación] detendría y borraría el servicio $nombre"; continue }
            if (Remove-SummitServicio $nombre) { Write-Host "Servicio $nombre borrado." -ForegroundColor Green } else { Write-Host "No había servicio $nombre." }
        }
        $codigo = 0
        exit 0
    }

    # --- Lo que tiene que estar antes
    $jar = Join-Path $carpetaApp 'summit-backend.jar'
    $configApp = Join-Path $carpetaApp 'config\application.properties'
    $caddyfile = Join-Path $carpetaCaddy 'Caddyfile'
    if (-not (Test-Path -LiteralPath $jar)) { throw "Falta ${jar}: compilá SUMMIT primero (compilar.ps1 -Salida $raiz)." }
    if (-not (Test-Path -LiteralPath (Join-Path $carpetaWeb 'index.html'))) { throw "Falta la app compilada en $carpetaWeb (compilar.ps1 -Salida $raiz)." }
    if (-not (Test-Path -LiteralPath $configApp)) { throw "Falta $configApp (preparar-pc.ps1)." }
    foreach ($obligatoria in 'DB_USERNAME', 'DB_PASSWORD', 'JWT_SECRET') {
        if (-not (Get-SummitPropiedad -Ruta $configApp -Nombre $obligatoria)) { throw "Falta $obligatoria en $configApp (crear-usuarios-mysql.ps1 y preparar-pc.ps1 la completan)." }
    }
    if (-not (Test-Path -LiteralPath $caddyfile)) { throw "Falta $caddyfile (preparar-pc.ps1)." }
    if (-not (Get-Service -Name $cfg.MysqlServicio -ErrorAction SilentlyContinue)) { throw "No existe el servicio de MySQL $($cfg.MysqlServicio) (revisá MysqlServicio en $($cfg.RutaConfig))." }
    $java = Get-SummitJava -Ruta $Java
    Write-Host "Java: $java"
    $shawl = Install-SummitHerramienta -Nombre 'Shawl' -Carpeta $carpetaHerramientas
    $caddy = Install-SummitHerramienta -Nombre 'Caddy' -Carpeta $carpetaCaddy
    $validacion = Invoke-SummitPrograma -Programa $caddy -Argumentos @('validate', '--config', $caddyfile, '--adapter', 'caddyfile')
    if ($validacion.Codigo -ne 0) { throw "El Caddyfile tiene un error: $((Get-SummitLineas $validacion.Errores | Select-Object -Last 2) -join ' ')" }
    Write-Host 'Caddyfile válido.'

    # El puerto de la app tiene que estar libre (o ser del propio SUMMIT-Web, si se está reinstalando)
    $puertoWeb = 80
    if ($cfg.UrlWeb -match ':(\d+)/?$') { $puertoWeb = [int]$Matches[1] }
    $ocupado = @(netstat -ano 2>$null | Select-String -Pattern "^\s*TCP\s+\S+:$puertoWeb\s+\S+\s+(LISTENING|ESCUCHANDO)\s+(\d+)" | ForEach-Object { [int]$_.Matches[0].Groups[2].Value }) | Select-Object -Unique
    $servicioWebActual = Get-CimInstance -ClassName Win32_Service -Filter "Name='$nombreWeb'" -ErrorAction SilentlyContinue
    $ocupado = @($ocupado | Where-Object { -not $servicioWebActual -or $_ -ne $servicioWebActual.ProcessId })
    if ($ocupado.Count -gt 0) {
        $quien = (Get-Process -Id $ocupado[0] -ErrorAction SilentlyContinue).ProcessName
        if ($ocupado[0] -eq 4) { $quien = 'Windows (IIS u otro servicio web de Windows)' }
        throw "El puerto $puertoWeb ya lo usa otro programa ($quien). Cambiá el puerto en $caddyfile ({`$SUMMIT_SITIO::$puertoWeb} -> {`$SUMMIT_SITIO::8000}, por ejemplo) y UrlWeb en $($cfg.RutaConfig)."
    }

    # --- Servicios (si ya existían, se reinstalan con la configuración actual)
    foreach ($nombre in $nombreWeb, $nombreBackend) {
        if (Get-Service -Name $nombre -ErrorAction SilentlyContinue) {
            if ($Simular) { Write-Host "  [simulación] borraría el servicio $nombre existente" } else { [void](Remove-SummitServicio $nombre); Write-Host "Servicio $nombre anterior borrado." }
        }
    }
    $carpetaTmp = Join-Path $carpetaApp 'tmp'
    if (-not (Test-Path -LiteralPath $carpetaTmp)) { New-Item -ItemType Directory -Path $carpetaTmp -Force | Out-Null }
    if (-not (Test-Path -LiteralPath $carpetaLogs)) { New-Item -ItemType Directory -Path $carpetaLogs -Force | Out-Null }
    $comunShawl = @('--log-dir', $carpetaLogs, '--log-rotate', 'daily', '--log-retain', '30', '--kill-process-tree')

    # Backend: Java guarda sus temporales en app\tmp; 130 es el código con el que Java termina cuando se lo detiene (Ctrl+C)
    $argumentosBackend = @('run', '--name', $nombreBackend, '--cwd', $carpetaApp, '--stop-timeout', '30000', '--restart-delay', '10000', '--pass', '0,130',
        '--log-as', 'summit-backend-servicio', '--log-cmd-as', 'summit-backend') + $comunShawl + @('--',
        $java, "-Xms256m", "-Xmx$MemoriaMaxima", '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8',
        "-Djava.io.tmpdir=$carpetaTmp", "-Dpdfbox.fontcache=$carpetaTmp", '-jar', $jar)
    $binBackend = (ConvertTo-SummitArgumento $shawl) + ' ' + (($argumentosBackend | ForEach-Object { ConvertTo-SummitArgumento $_ }) -join ' ')
    $argumentosWeb = @('run', '--name', $nombreWeb, '--cwd', $carpetaCaddy, '--stop-timeout', '15000', '--restart-delay', '5000',
        '--log-as', 'summit-web-servicio', '--log-cmd-as', 'summit-web') + $comunShawl + @('--',
        $caddy, 'run', '--config', $caddyfile, '--adapter', 'caddyfile')
    $binWeb = (ConvertTo-SummitArgumento $shawl) + ' ' + (($argumentosWeb | ForEach-Object { ConvertTo-SummitArgumento $_ }) -join ' ')

    $servicios = @(
        @{ Nombre = $nombreBackend; Bin = $binBackend; Visible = 'SUMMIT - Backend'; Descripcion = 'Backend de SUMMIT (Java). Registro: ' + (Join-Path $carpetaLogs 'summit-backend_rCURRENT.log'); Depende = @($cfg.MysqlServicio) },
        @{ Nombre = $nombreWeb; Bin = $binWeb; Visible = 'SUMMIT - Web (Caddy)'; Descripcion = 'Muestra la app de SUMMIT y le pasa /api al backend. Registro: ' + (Join-Path $carpetaLogs 'summit-web_rCURRENT.log'); Depende = @() }
    )
    foreach ($s in $servicios) {
        if ($Simular) {
            Write-Host "  [simulación] crearía el servicio $($s.Nombre) (automático, depende de: $($s.Depende -join ', ')):"
            Write-Host "      $($s.Bin)"
        } else {
            $parametros = @{ Name = $s.Nombre; BinaryPathName = $s.Bin; DisplayName = $s.Visible; Description = $s.Descripcion; StartupType = 'Automatic' }
            if ($s.Depende.Count -gt 0) { $parametros.DependsOn = $s.Depende }
            New-Service @parametros | Out-Null
            Write-Host "Servicio $($s.Nombre) creado." -ForegroundColor Green
        }
        if ($Cuenta -eq 'Virtual') { Invoke-SummitSc @('config', $s.Nombre, 'obj=', "NT SERVICE\$($s.Nombre)") }
        # Si Shawl mismo se cayera, Windows vuelve a arrancar el servicio al minuto
        Invoke-SummitSc @('failure', $s.Nombre, 'reset=', '86400', 'actions=', 'restart/60000/restart/60000/restart/60000')
    }

    # --- Permisos de las cuentas de los servicios (solo lo que cada uno necesita)
    $cuentaBackend = 'LocalSystem'
    $cuentaWeb = 'LocalSystem'
    if ($Cuenta -eq 'Virtual') { $cuentaBackend = "NT SERVICE\$nombreBackend"; $cuentaWeb = "NT SERVICE\$nombreWeb" }
    Grant-SummitPermiso -Ruta $carpetaHerramientas -Cuenta $cuentaBackend -Permiso 'RX'
    Grant-SummitPermiso -Ruta $carpetaApp -Cuenta $cuentaBackend -Permiso 'RX'
    Grant-SummitPermiso -Ruta (Join-Path $carpetaApp 'config') -Cuenta $cuentaBackend -Permiso 'RX'
    Grant-SummitPermiso -Ruta $carpetaTmp -Cuenta $cuentaBackend -Permiso 'M'
    Grant-SummitPermiso -Ruta (Split-Path ([string]$cfg.CarpetaUploads).TrimEnd('\') -Parent) -Cuenta $cuentaBackend -Permiso 'M'
    Grant-SummitPermiso -Ruta $carpetaLogs -Cuenta $cuentaBackend -Permiso 'M'
    Grant-SummitPermiso -Ruta $carpetaHerramientas -Cuenta $cuentaWeb -Permiso 'RX'
    Grant-SummitPermiso -Ruta $carpetaCaddy -Cuenta $cuentaWeb -Permiso 'RX'
    Grant-SummitPermiso -Ruta (Join-Path $carpetaCaddy 'datos') -Cuenta $cuentaWeb -Permiso 'M'
    Grant-SummitPermiso -Ruta $carpetaWeb -Cuenta $cuentaWeb -Permiso 'RX'
    Grant-SummitPermiso -Ruta $carpetaLogs -Cuenta $cuentaWeb -Permiso 'M'

    if ($Simular) {
        Write-Host 'Simulación terminada: no se creó ni cambió ningún servicio.' -ForegroundColor Yellow
        $codigo = 0
        exit 0
    }

    # --- Arrancar y comprobar
    Start-Service -Name $nombreBackend
    Start-Service -Name $nombreWeb
    Write-Host 'Esperando que el backend termine de arrancar (hasta 3 minutos)...'
    $backendBien = Wait-SummitUrl -Url ($cfg.UrlBackend.TrimEnd('/') + '/api/planes') -Segundos 180 -Estados @(200, 401, 403)
    $webBien = Wait-SummitUrl -Url ($cfg.UrlWeb.TrimEnd('/') + '/') -Segundos 30 -Estados @(200)
    if (-not $backendBien) { throw "El backend no respondió. Mirá $carpetaLogs\summit-backend_rCURRENT.log (las últimas líneas dicen por qué)." }
    if (-not $webBien) { throw "La app no respondió en $($cfg.UrlWeb). Mirá $carpetaLogs\summit-web_rCURRENT.log." }
    Write-Host 'SUMMIT está funcionando.' -ForegroundColor Green
    Write-Host "  En esta PC:          $($cfg.UrlWeb)"
    $direcciones = @([Net.Dns]::GetHostAddresses($env:COMPUTERNAME) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not $_.ToString().StartsWith('127.') -and -not $_.ToString().StartsWith('169.254.') } | ForEach-Object { $_.ToString() })
    $sufijo = ''
    if ($puertoWeb -ne 80) { $sufijo = ":$puertoWeb" }
    foreach ($ip in $direcciones) { Write-Host "  Desde otras PC:      http://$ip$sufijo   (o http://$($env:COMPUTERNAME.ToLowerInvariant())$sufijo)" }
    Write-Host '  Para que las otras PC entren hace falta la regla del firewall (INSTALACION.md, paso 8).'
    $codigo = 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
}
exit $codigo
