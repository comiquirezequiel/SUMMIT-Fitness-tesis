<#
.SYNOPSIS
    Restaura una copia de seguridad de SUMMIT. Por defecto es una PRUEBA: no toca la base ni los archivos en uso.

.DESCRIPTION
    Modo prueba (el normal, para el simulacro de cada mes):
      descifra la copia, la restaura en una base NUEVA (summit_restauracion_AAAAMMDD_HHMMSS) y deja los archivos en
      restauraciones\<esa base>\uploads. Después compara tabla por tabla con el manifiesto de la copia (cantidad de
      filas y huella del contenido) y cuenta los archivos. Con -BorrarAlTerminar borra todo lo de prueba al final.

    Modo real (-ReemplazarBaseReal): para volver atrás o para pasar SUMMIT a otra PC.
      1. Pide escribir REEMPLAZAR.
      2. Detiene el servicio del backend (si está instalado y funcionando).
      3. Hace una copia de resguardo de lo actual (summit-copia-...-antes-de-restaurar.7z).
      4. Restaura en una base temporal y la verifica: si algo no coincide, se detiene sin tocar la base real.
      5. Reemplaza la base real, y la carpeta de archivos: la anterior queda renombrada (uploads-antes-de-restaurar-...),
         no se borra.
      6. Vuelve a arrancar el backend.

    Pide la contraseña de un administrador de MySQL (root): no se guarda. La clave de cifrado sale del archivo de
    secretos de esta PC; en otra PC (o con -PedirClave) se pide la anotada.

.PARAMETER Archivo
    La copia (.7z). Si no se indica, se abre una ventana para elegirla.

.PARAMETER BaseDestino
    Modo prueba: nombre de la base nueva (tiene que empezar con summit_restauracion_).

.PARAMETER BorrarPrueba
    Borra una base de prueba anterior (summit_restauracion_...) y sus archivos, y termina.

.PARAMETER SinCopiaPrevia
    Modo real: no hace la copia de resguardo de lo actual (solo si la base actual está dañada y no se puede copiar).

.EXAMPLE
    restaurar-copia.ps1 -Archivo C:\SUMMIT\copias\summit-copia-2026-10-25_2300.7z -BorrarAlTerminar

.EXAMPLE
    restaurar-copia.ps1 -Archivo E:\SUMMIT-copias\summit-copia-2026-10-25_2300.7z -ReemplazarBaseReal
#>
[CmdletBinding()]
param(
    [string]$Archivo,
    [ValidatePattern('^summit_restauracion_[A-Za-z0-9_]{1,40}$')][string]$BaseDestino,
    [switch]$ReemplazarBaseReal,
    # Para usar sin preguntas: tiene que decir REEMPLAZAR
    [string]$Confirmacion,
    [switch]$BorrarAlTerminar,
    [ValidatePattern('^summit_restauracion_[A-Za-z0-9_]{1,40}$')][string]$BorrarPrueba,
    [switch]$PedirClave,
    [switch]$SinCopiaPrevia,
    # Administrador de MySQL (root). Si no se da, se pide.
    [Management.Automation.PSCredential]$CredencialMysql,
    [string]$Config,
    # Para el acceso directo (probar-restauracion.cmd): pide permiso de administrador y espera Enter al terminar
    [switch]$Elevar,
    [switch]$Pausa
)

. (Join-Path $PSScriptRoot 'comun.ps1')

if ($Elevar -and -not (Test-SummitAdministrador)) {
    Start-SummitComoAdministrador -Script $PSCommandPath -Parametros $PSBoundParameters
    exit 0
}

function Get-SummitCredencialMysql {
    param([Management.Automation.PSCredential]$Credencial)
    if ($Credencial) { return $Credencial }
    Write-Host ''
    Write-Host 'Hace falta un administrador de MySQL (el usuario root que elegiste al instalarlo). No se guarda.'
    $usuario = Read-Host 'Usuario administrador de MySQL [root]'
    if (-not $usuario) { $usuario = 'root' }
    return New-Object Management.Automation.PSCredential($usuario, (Read-Host "Contraseña de $usuario" -AsSecureString))
}

function Select-SummitCopia {
    param([Collections.IDictionary]$Cfg)
    if ([Environment]::UserInteractive) {
        $elegida = $null
        $cancelada = $false
        try {
            Add-Type -AssemblyName System.Windows.Forms
            $dialogo = New-Object System.Windows.Forms.OpenFileDialog
            $dialogo.Title = 'Elegí la copia de SUMMIT que querés restaurar'
            $dialogo.Filter = 'Copias de SUMMIT (summit-copia-*.7z)|summit-copia-*.7z|Archivos 7z (*.7z)|*.7z'
            if (Test-Path -LiteralPath $Cfg.CarpetaCopias) { $dialogo.InitialDirectory = $Cfg.CarpetaCopias }
            $ventana = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }
            if ($dialogo.ShowDialog($ventana) -eq [System.Windows.Forms.DialogResult]::OK) { $elegida = $dialogo.FileName } else { $cancelada = $true }
        } catch {
            Write-SummitRegistro "No se pudo abrir la ventana para elegir la copia ($($_.Exception.Message))." 'AVISO'
        }
        if ($cancelada) { throw 'No elegiste ninguna copia: no se hizo nada.' }
        if ($elegida) { return $elegida }
    }
    $copias = @(Get-SummitCopias $Cfg.CarpetaCopias)
    if ($copias.Count -eq 0) { throw "No hay copias en $($Cfg.CarpetaCopias). Indicá cuál con -Archivo." }
    Write-SummitRegistro "Se usa la copia más nueva: $($copias[0].Archivo.FullName)"
    return $copias[0].Archivo.FullName
}

function Import-SummitVolcado {
    param([Collections.IDictionary]$Cfg, [string]$Opciones, [string]$Base, [string]$Sql, $Manifiesto)
    $juego = 'utf8mb4'
    $intercalacion = 'utf8mb4_0900_ai_ci'
    if ($Manifiesto.juegoDeCaracteres -match '^[a-z0-9_]+$') { $juego = $Manifiesto.juegoDeCaracteres }
    if ($Manifiesto.intercalacion -match '^[a-z0-9_]+$') { $intercalacion = $Manifiesto.intercalacion }
    [void](Invoke-SummitMysql -Cfg $Cfg -Opciones $Opciones -Sql "CREATE DATABASE ``$Base`` CHARACTER SET $juego COLLATE $intercalacion")
    Write-SummitRegistro "Cargando el volcado en la base $Base..."
    [void](Invoke-SummitMysql -Cfg $Cfg -Opciones $Opciones -Base $Base -ArchivoEntrada $Sql -TiempoMaximoSegundos 7200)
}

# Compara una base restaurada con el manifiesto de la copia: cada tabla tiene que estar, con la misma cantidad de filas
# y (si el MySQL es de la misma versión) la misma huella. Las tablas que cambiaron mientras se hacía la copia pueden
# diferir sin que sea un error.
function Test-SummitContraManifiesto {
    param([Collections.IDictionary]$Cfg, [string]$Opciones, [string]$Base, $Manifiesto, [string]$VersionMysql)
    $tablas = @(Get-SummitTablas -Cfg $Cfg -Opciones $Opciones -Base $Base)
    $conteos = Get-SummitConteos -Cfg $Cfg -Opciones $Opciones -Base $Base -Tablas $tablas
    $mismaVersion = ($Manifiesto.versionMysql -eq $VersionMysql)
    $huellas = @{}
    if ($mismaVersion) { $huellas = Get-SummitChecksums -Cfg $Cfg -Opciones $Opciones -Base $Base -Tablas $tablas }
    $problemas = 0
    $avisos = 0
    $filasTotales = [long]0
    foreach ($tabla in @($Manifiesto.tablas)) {
        if ($tablas -notcontains $tabla.nombre) {
            $problemas++
            Write-SummitRegistro "  Falta la tabla $($tabla.nombre)." 'ERROR'
            continue
        }
        $filas = [long]$conteos[$tabla.nombre]
        $filasTotales += $filas
        $filasBien = ($filas -eq [long]$tabla.filas) -or ($tabla.cambioDuranteLaCopia -and $filas -eq [long]$tabla.filasDespues)
        $huellaBien = (-not $mismaVersion) -or $tabla.cambioDuranteLaCopia -or ($huellas[$tabla.nombre] -eq [string]$tabla.checksum)
        if ($filasBien -and $huellaBien) { continue }
        if ($tabla.cambioDuranteLaCopia) {
            $avisos++
            Write-SummitRegistro "  $($tabla.nombre): $filas filas (la copia registró $($tabla.filas) a $($tabla.filasDespues): cambió mientras se hacía)." 'AVISO'
        } elseif (-not $filasBien) {
            $problemas++
            Write-SummitRegistro "  $($tabla.nombre): $filas filas, y la copia tenía $($tabla.filas)." 'ERROR'
        } else {
            $problemas++
            Write-SummitRegistro "  $($tabla.nombre): mismas filas ($filas) pero el contenido no coincide con la copia." 'ERROR'
        }
    }
    $nombresManifiesto = @($Manifiesto.tablas | ForEach-Object { $_.nombre })
    foreach ($extra in ($tablas | Where-Object { $nombresManifiesto -notcontains $_ })) {
        $avisos++
        Write-SummitRegistro "  La tabla $extra no figura en el manifiesto." 'AVISO'
    }
    $detalle = "$($tablas.Count) tablas y $filasTotales filas"
    if ($mismaVersion) { $detalle += ', con la huella de cada tabla' } else { $detalle += " (sin comparar huellas: la copia es de MySQL $($Manifiesto.versionMysql) y este es $VersionMysql)" }
    return [pscustomobject]@{ Problemas = $problemas; Avisos = $avisos; Detalle = $detalle }
}

$codigo = 1
$trabajo = $null
$opciones = $null
$servicioDetenido = $null
$baseCreada = $null
$cfg = $null
try {
    $cfg = Read-SummitConfig -Ruta $Config -Opcional
    Start-SummitRegistro -Carpeta $cfg.CarpetaRegistros -Nombre 'restauraciones.log'
    Write-SummitRegistro "=== Restauración de SUMMIT (PC $env:COMPUTERNAME, usuario $env:USERNAME)"
    Assert-SummitNombreBase $cfg.Base
    if (-not (Test-Path -LiteralPath (Join-Path $cfg.MysqlBin 'mysql.exe'))) { throw "No encontré mysql.exe en $($cfg.MysqlBin)." }
    if (-not (Test-Path -LiteralPath $cfg.CarpetaRestauraciones)) { New-SummitCarpetaPrivada -Ruta $cfg.CarpetaRestauraciones }

    if ($BorrarPrueba) {
        $CredencialMysql = Get-SummitCredencialMysql $CredencialMysql
        $trabajo = Join-Path $cfg.CarpetaRestauraciones ('borrar-' + [guid]::NewGuid().ToString('N'))
        New-SummitCarpetaPrivada -Ruta $trabajo -UsuarioActual
        $opciones = New-SummitOpcionesMysql -Carpeta $trabajo -Usuario $CredencialMysql.UserName -Clave (ConvertFrom-SummitClaveSegura $CredencialMysql.Password) -Servidor $cfg.MysqlServidor -Puerto $cfg.MysqlPuerto
        [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql "DROP DATABASE IF EXISTS ``$BorrarPrueba``")
        $carpetaPrueba = Join-Path $cfg.CarpetaRestauraciones $BorrarPrueba
        if (Test-Path -LiteralPath $carpetaPrueba) { Remove-Item -LiteralPath $carpetaPrueba -Recurse -Force }
        Write-SummitRegistro "Borradas la base de prueba $BorrarPrueba y sus archivos." 'OK'
        $codigo = 0
        exit 0
    }

    # --- 1. La copia y su clave
    if (-not $Archivo) { $Archivo = Select-SummitCopia $cfg }
    if (-not (Test-Path -LiteralPath $Archivo -PathType Leaf)) { throw "No existe el archivo $Archivo." }
    $Archivo = (Resolve-Path -LiteralPath $Archivo).ProviderPath
    Write-SummitRegistro "Copia: $Archivo ($(Format-SummitTamano (Get-Item -LiteralPath $Archivo).Length))"
    $sieteZip = Get-Summit7Zip $cfg
    $clave = $null
    $claveGuardada = $false
    if (-not $PedirClave) {
        try {
            $clave = (Read-SummitSecretos $cfg.ArchivoSecretos)['ClaveCifrado']
            $claveGuardada = [bool]$clave
        } catch {
            Write-SummitRegistro "No se pudo usar la clave guardada en esta PC: $($_.Exception.Message)" 'AVISO'
        }
    }
    if (-not $clave) { $clave = ConvertFrom-SummitClaveSegura (Read-Host 'Clave de cifrado de las copias (la que está anotada)' -AsSecureString) }

    # --- 2. Descifrar en una carpeta privada
    $marca = Get-Date -Format 'yyyyMMdd_HHmmss'
    if ($ReemplazarBaseReal) {
        $trabajo = Join-Path $cfg.CarpetaRestauraciones "reemplazo_$marca"
    } else {
        if (-not $BaseDestino) { $BaseDestino = "summit_restauracion_$marca" }
        $trabajo = Join-Path $cfg.CarpetaRestauraciones $BaseDestino
        if (Test-Path -LiteralPath $trabajo) { throw "Ya existe ${trabajo}: elegí otro -BaseDestino o borrá la prueba anterior con -BorrarPrueba $BaseDestino." }
    }
    New-SummitCarpetaPrivada -Ruta $trabajo -UsuarioActual
    Write-SummitRegistro 'Descifrando la copia...'
    $resultado = Invoke-Summit7Zip -SieteZip $sieteZip -Clave $clave -Argumentos @('x', "-o$trabajo", $Archivo)
    if ($resultado.Codigo -ne 0) {
        $motivo = Get-SummitMensaje7Zip $resultado
        if ($claveGuardada -and $motivo -match 'clave') { $motivo += ' (si la copia es de antes de un cambio de clave, probá con -PedirClave y la clave anterior)' }
        throw "No se pudo abrir la copia: $motivo."
    }

    # --- 3. Revisar lo descifrado
    $rutaManifiesto = Join-Path $trabajo 'manifiesto.json'
    if (-not (Test-Path -LiteralPath $rutaManifiesto)) { throw 'La copia no tiene manifiesto.json: no parece una copia de SUMMIT.' }
    $manifiesto = Read-SummitJson $rutaManifiesto
    if ($manifiesto.formato -ne 'summit-copia-1') { throw "Formato de copia desconocido: $($manifiesto.formato)." }
    $sql = Join-Path $trabajo ($manifiesto.archivoSql -replace '/', '\')
    if (-not (Test-Path -LiteralPath $sql)) { throw "Falta el volcado de la base ($($manifiesto.archivoSql))." }
    if ((Get-SummitHash $sql) -ne $manifiesto.sha256Sql) { throw 'El volcado de la base no coincide con su huella: la copia está dañada.' }
    if (-not (Test-SummitVolcadoCompleto $sql)) { throw 'El volcado de la base está incompleto.' }
    $uploadsExtraidos = $null
    if ($manifiesto.uploads.incluidos) {
        $uploadsExtraidos = Join-Path $trabajo $manifiesto.uploads.carpetaEnLaCopia
        $archivos = @()
        if (Test-Path -LiteralPath $uploadsExtraidos) { $archivos = @(Get-ChildItem -LiteralPath $uploadsExtraidos -Recurse -File -Force) }
        $bytesArchivos = [long]0
        if ($archivos.Count -gt 0) { $bytesArchivos = [long]($archivos | Measure-Object -Property Length -Sum).Sum }
        if ($archivos.Count -ne [int]$manifiesto.uploads.archivos -or $bytesArchivos -ne [long]$manifiesto.uploads.bytes) {
            throw "Los archivos subidos no coinciden con el manifiesto: hay $($archivos.Count) ($bytesArchivos bytes) y la copia registró $($manifiesto.uploads.archivos) ($($manifiesto.uploads.bytes) bytes)."
        }
    }
    $fechaCopia = [datetime]::Parse($manifiesto.fecha)
    $filasCopia = [long]0
    $cambiaron = 0
    foreach ($tabla in @($manifiesto.tablas)) {
        $filasCopia += [long]$tabla.filas
        if ($tabla.cambioDuranteLaCopia) { $cambiaron++ }
    }
    $nota = ''
    if ($cambiaron -gt 0) { $nota = " ($cambiaron tabla(s) cambiaron mientras se hacía la copia: sus filas pueden variar un poco)" }
    Write-SummitRegistro ("La copia es del {0:dd/MM/yyyy HH:mm} (PC {1}): base {2} con {3} tablas y unas {4} filas{5}, y {6} archivos subidos." -f $fechaCopia, $manifiesto.equipo, $manifiesto.base, @($manifiesto.tablas).Count, $filasCopia, $nota, $manifiesto.uploads.archivos) 'OK'

    # --- 4. MySQL
    $CredencialMysql = Get-SummitCredencialMysql $CredencialMysql
    $opciones = New-SummitOpcionesMysql -Carpeta $trabajo -Usuario $CredencialMysql.UserName -Clave (ConvertFrom-SummitClaveSegura $CredencialMysql.Password) -Servidor $cfg.MysqlServidor -Puerto $cfg.MysqlPuerto
    $versionMysql = @(Get-SummitLineas (Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql 'SELECT VERSION()'))[0]

    if (-not $ReemplazarBaseReal) {
        # ===================== MODO PRUEBA =====================
        if (Test-SummitBaseExiste -Cfg $cfg -Opciones $opciones -Base $BaseDestino) {
            throw "Ya existe la base ${BaseDestino}: elegí otro -BaseDestino o borrala con -BorrarPrueba $BaseDestino."
        }
        $baseCreada = $BaseDestino
        Import-SummitVolcado -Cfg $cfg -Opciones $opciones -Base $BaseDestino -Sql $sql -Manifiesto $manifiesto
        $verificacion = Test-SummitContraManifiesto -Cfg $cfg -Opciones $opciones -Base $BaseDestino -Manifiesto $manifiesto -VersionMysql $versionMysql
        if ($verificacion.Problemas -gt 0) { throw "La base restaurada NO coincide con la copia en $($verificacion.Problemas) tabla(s) (detalle arriba)." }
        Write-SummitRegistro "Base de prueba $BaseDestino restaurada y verificada: $($verificacion.Detalle)." 'OK'
        if ($uploadsExtraidos) { Write-SummitRegistro "Archivos subidos restaurados y contados: $($manifiesto.uploads.archivos) en $uploadsExtraidos." 'OK' }
        Remove-Item -LiteralPath (Split-Path $sql -Parent) -Recurse -Force
        if ($BorrarAlTerminar) {
            [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql "DROP DATABASE ``$BaseDestino``")
            Remove-SummitArchivo $opciones
            $opciones = $null
            Remove-Item -LiteralPath $trabajo -Recurse -Force
            $trabajo = $null
            Write-SummitRegistro 'Se borraron la base y los archivos de prueba.' 'OK'
        } else {
            Write-SummitRegistro "La base $BaseDestino y la carpeta $trabajo quedan para que las revises. Tienen datos personales: cuando termines, borralas con:" 'AVISO'
            Write-SummitRegistro "  restaurar-copia.ps1 -BorrarPrueba $BaseDestino" 'AVISO'
        }
        $baseCreada = $null
        if ($verificacion.Avisos -gt 0) { Write-SummitRegistro "Resultado: la copia se puede restaurar ($($verificacion.Avisos) aviso(s), ver arriba)." 'AVISO' } else { Write-SummitRegistro 'Resultado: la copia se puede restaurar sin problemas.' 'OK' }
        $codigo = 0
    } else {
        # ===================== MODO REAL =====================
        $real = $cfg.Base
        $carpetaReal = ([string]$cfg.CarpetaUploads).TrimEnd('\')
        Write-Host ''
        Write-Host '  ATENCIÓN: vas a REEMPLAZAR los datos en uso de SUMMIT por los de esta copia.' -ForegroundColor Yellow
        Write-Host "    Base de datos: $real"
        Write-Host "    Archivos:      $carpetaReal (la carpeta actual queda renombrada, no se borra)"
        Write-Host ("    Copia del:     {0:dd/MM/yyyy HH:mm}. Lo que se cargó después de esa hora se pierde." -f $fechaCopia)
        Write-Host '  Antes se hace una copia de resguardo de lo actual, para poder volver atrás.'
        Write-Host ''
        if ($Confirmacion -cne 'REEMPLAZAR') {
            $respuesta = Read-Host 'Para seguir, escribí REEMPLAZAR (en mayúsculas). Cualquier otra cosa cancela'
            if ($respuesta -cne 'REEMPLAZAR') { throw 'Cancelado: no se tocó nada.' }
        }

        $servicio = Get-Service -Name $cfg.ServicioBackend -ErrorAction SilentlyContinue
        if ($servicio -and $servicio.Status -ne 'Stopped') {
            Assert-SummitAdministrador -Para 'detener el servicio del backend'
            Write-SummitRegistro "Deteniendo el servicio $($cfg.ServicioBackend)..."
            Stop-Service -Name $cfg.ServicioBackend -Force
            (Get-Service -Name $cfg.ServicioBackend).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(90))
            $servicioDetenido = $cfg.ServicioBackend
        } elseif (-not $servicio -and (Get-SummitRespuestaHttp -Url $cfg.UrlBackend -Segundos 3).Responde) {
            throw "El backend está funcionando ($($cfg.UrlBackend)) fuera de un servicio: cerralo y volvé a intentar."
        }

        if ((Test-SummitBaseExiste -Cfg $cfg -Opciones $opciones -Base $real) -and -not $SinCopiaPrevia) {
            Write-SummitRegistro 'Copia de resguardo de lo actual...'
            $parametros = @{ Etiqueta = 'antes-de-restaurar'; SinDestinoExterno = $true }
            if ($cfg.RutaConfig) { $parametros.Config = $cfg.RutaConfig }
            & (Join-Path $PSScriptRoot 'copia-de-seguridad.ps1') @parametros
            if ($LASTEXITCODE -eq 1) { throw 'No se pudo hacer la copia de resguardo de lo actual: no se restauró nada. (Si la base actual está dañada y no se puede copiar, usá -SinCopiaPrevia.)' }
            Start-SummitRegistro -Carpeta $cfg.CarpetaRegistros -Nombre 'restauraciones.log'
        }

        $temporal = "$($real)_restaurando"
        Assert-SummitNombreBase $temporal
        [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql "DROP DATABASE IF EXISTS ``$temporal``")
        $baseCreada = $temporal
        Import-SummitVolcado -Cfg $cfg -Opciones $opciones -Base $temporal -Sql $sql -Manifiesto $manifiesto
        $verificacion = Test-SummitContraManifiesto -Cfg $cfg -Opciones $opciones -Base $temporal -Manifiesto $manifiesto -VersionMysql $versionMysql
        if ($verificacion.Problemas -gt 0) { throw "La copia NO se restauró bien en la base temporal ($($verificacion.Problemas) problema(s)): la base real no se tocó." }
        Write-SummitRegistro "Verificada en la base temporal: $($verificacion.Detalle)." 'OK'

        # La base temporal queda hasta que la real esté verificada: si algo fallara en el medio, los datos siguen ahí
        Write-SummitRegistro "Reemplazando la base $real..."
        [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql "DROP DATABASE IF EXISTS ``$real``")
        Import-SummitVolcado -Cfg $cfg -Opciones $opciones -Base $real -Sql $sql -Manifiesto $manifiesto
        $verificacion = Test-SummitContraManifiesto -Cfg $cfg -Opciones $opciones -Base $real -Manifiesto $manifiesto -VersionMysql $versionMysql
        if ($verificacion.Problemas -gt 0) { throw "La base $real quedó distinta de la copia; la base $temporal tiene los datos verificados. Volvé a correr la restauración." }
        [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql "DROP DATABASE ``$temporal``")
        $baseCreada = $null
        Write-SummitRegistro "Base $real restaurada y verificada." 'OK'

        if ($uploadsExtraidos) {
            if (Test-Path -LiteralPath $carpetaReal) {
                $anterior = "$carpetaReal-antes-de-restaurar-$marca"
                Move-Item -LiteralPath $carpetaReal -Destination $anterior
                Write-SummitRegistro "La carpeta de archivos anterior quedó en $anterior."
            }
            $padre = Split-Path $carpetaReal -Parent
            if (-not (Test-Path -LiteralPath $padre)) { New-Item -ItemType Directory -Path $padre -Force | Out-Null }
            if ([IO.Path]::GetPathRoot($uploadsExtraidos) -eq [IO.Path]::GetPathRoot($carpetaReal)) {
                Move-Item -LiteralPath $uploadsExtraidos -Destination $carpetaReal
            } else {
                # Windows PowerShell no mueve carpetas entre discos distintos: se copia y después se borra
                Copy-Item -LiteralPath $uploadsExtraidos -Destination $carpetaReal -Recurse
                Remove-Item -LiteralPath $uploadsExtraidos -Recurse -Force
            }
            # Los archivos toman los permisos de la carpeta de arriba (la del servicio), no los de la carpeta de trabajo
            $permisos = Invoke-SummitPrograma -Programa 'icacls.exe' -Argumentos @($carpetaReal, '/reset', '/T', '/Q')
            if ($permisos.Codigo -ne 0) { Write-SummitRegistro "No se pudieron ajustar los permisos de $carpetaReal ($($permisos.Salida.Trim()))." 'AVISO' }
            Write-SummitRegistro "Archivos subidos restaurados en $carpetaReal ($($manifiesto.uploads.archivos) archivos)." 'OK'
        }

        if ($servicioDetenido) {
            Start-Service -Name $servicioDetenido
            Write-SummitRegistro "Servicio $servicioDetenido arrancado de nuevo."
            $servicioDetenido = $null
        }
        Write-SummitRegistro 'Restauración terminada. Entrá a SUMMIT y revisá que esté todo; después corré doctor.ps1.' 'OK'
        $codigo = 0
    }
} catch {
    Write-SummitRegistro "ERROR: $($_.Exception.Message)" 'ERROR'
    $codigo = 1
} finally {
    if ($baseCreada -and $opciones -and -not $ReemplazarBaseReal) {
        # Una base de prueba a medio cargar no sirve: se borra
        try { [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql "DROP DATABASE IF EXISTS ``$baseCreada``") } catch { }
    }
    Remove-SummitArchivo $opciones
    if ($trabajo -and (Test-Path -LiteralPath $trabajo) -and ($ReemplazarBaseReal -or $BorrarPrueba -or $codigo -ne 0)) {
        Remove-Item -LiteralPath $trabajo -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($servicioDetenido) {
        try { Start-Service -Name $servicioDetenido; Write-SummitRegistro "Servicio $servicioDetenido arrancado de nuevo." } catch { Write-SummitRegistro "No se pudo arrancar ${servicioDetenido}: arrancalo a mano (services.msc)." 'ERROR' }
    }
}
if ($Pausa) { [void](Read-Host 'Apretá Enter para cerrar') }
exit $codigo
