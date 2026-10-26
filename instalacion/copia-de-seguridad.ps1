<#
.SYNOPSIS
    Copia de seguridad de SUMMIT: la base de datos y los archivos subidos, en un solo archivo 7z cifrado (AES-256).

.DESCRIPTION
    1. Vuelca la base con mysqldump (en una transacción: SUMMIT puede seguir usándose mientras tanto).
    2. Arma summit-copia-AAAA-MM-DD_HHMM.7z con el volcado, la carpeta de archivos subidos (certificados médicos y
       fotos), un manifiesto (tablas, filas y huellas para verificar una restauración) y un LEEME.txt. El archivo va
       cifrado con AES-256 y con los nombres ocultos: sin la clave no se puede ver ni qué tiene.
    3. Prueba la copia con 7-Zip, la copia al destino externo si hay uno configurado (OneDrive, Google Drive o un
       disco USB) y borra las copias viejas de las dos carpetas.

    Las claves salen de config\secretos-copias.dat (cifrado por Windows); no se escriben en ningún otro lado.
    Registro: logs\copias.log. Estado de la última copia: copias\estado-copias.json (lo lee doctor.ps1).

    Códigos de salida: 0 = copia hecha; 2 = copia hecha, con avisos (por ejemplo, el disco USB no estaba
    conectado); 1 = no se pudo hacer la copia.

.PARAMETER Config
    Archivo de configuración (por defecto C:\SUMMIT\config\summit.psd1).

.PARAMETER Etiqueta
    Texto que se agrega al nombre del archivo, por ejemplo "antes-de-actualizar".

.PARAMETER SinDestinoExterno
    No copia al destino externo (la usan restaurar-copia.ps1 y actualizar.ps1 para su copia de resguardo).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File C:\SUMMIT\scripts\copia-de-seguridad.ps1
#>
[CmdletBinding()]
param(
    [string]$Config,
    [ValidatePattern('^[a-z0-9-]{0,40}$')][string]$Etiqueta = '',
    [switch]$SinDestinoExterno,
    # Para los accesos directos (.cmd): pide permiso de administrador y espera Enter al terminar
    [switch]$Elevar,
    [switch]$Pausa
)

. (Join-Path $PSScriptRoot 'comun.ps1')

if ($Elevar -and -not (Test-SummitAdministrador)) {
    Start-SummitComoAdministrador -Script $PSCommandPath -Parametros $PSBoundParameters
    exit 0
}

function Copy-SummitAlDestinoExterno {
    param([string]$Archivo, [string]$Hash, [string]$Carpeta)
    $unidad = [IO.Path]::GetPathRoot($Carpeta)
    if (-not $unidad -or -not (Test-Path -LiteralPath $unidad)) {
        throw "la unidad $unidad no está disponible (¿está conectado el disco?)"
    }
    if (-not (Test-Path -LiteralPath $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null }
    $final = Join-Path $Carpeta (Split-Path $Archivo -Leaf)
    $parcial = "$final.parcial"
    Copy-Item -LiteralPath $Archivo -Destination $parcial -Force
    if ((Get-SummitHash $parcial) -ne $Hash) {
        Remove-Item -LiteralPath $parcial -Force -ErrorAction SilentlyContinue
        throw 'el archivo copiado quedó distinto del original'
    }
    Move-Item -LiteralPath $parcial -Destination $final -Force
    return $final
}

# Borra las copias con más de $Dias días, pero deja siempre las $Minimas más nuevas. Solo toca archivos con el nombre
# de una copia de SUMMIT (summit-copia-AAAA-MM-DD_HHMM*.7z) y restos de copias que se cortaron.
function Remove-SummitCopiasViejas {
    param([string]$Carpeta, [int]$Dias, [int]$Minimas)
    if ($Dias -le 0 -or -not (Test-Path -LiteralPath $Carpeta)) { return }
    $limite = (Get-Date).AddDays(-$Dias)
    $orden = 0
    foreach ($copia in (Get-SummitCopias $Carpeta)) {
        $orden++
        if ($orden -le $Minimas -or $copia.Fecha -ge $limite) { continue }
        Remove-Item -LiteralPath $copia.Archivo.FullName -Force
        Write-SummitRegistro "Borrada por tener más de $Dias días: $($copia.Archivo.FullName)"
    }
    $ayer = (Get-Date).AddDays(-1)
    Get-ChildItem -LiteralPath $Carpeta -Filter 'summit-copia-*.parcial' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $ayer } | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $Carpeta -Filter '.preparando-*' -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $ayer } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

$inicio = Get-Date
$codigoSalida = 1
$avisos = New-Object System.Collections.Generic.List[string]
$estado = [ordered]@{
    fecha               = $inicio.ToString('o')
    resultado           = 'error'
    archivo             = $null
    carpeta             = $null
    bytes               = $null
    sha256              = $null
    destinoExterno      = 'no configurado'
    mensaje             = ''
    duracionSegundos    = $null
    ultimaCopiaCorrecta = $null
}
$cfg = $null
$preparacion = $null
$opciones = $null
$parcial = $null

try {
    $cfg = Read-SummitConfig -Ruta $Config
    Start-SummitRegistro -Carpeta $cfg.CarpetaRegistros -Nombre 'copias.log'
    Write-SummitRegistro "=== Copia de seguridad de SUMMIT (PC $env:COMPUTERNAME, usuario $env:USERNAME, scripts $script:SummitVersionScripts)"
    Assert-SummitNombreBase $cfg.Base

    $rutaEstado = Join-Path $cfg.CarpetaCopias 'estado-copias.json'
    if (Test-Path -LiteralPath $rutaEstado) {
        try { $estado.ultimaCopiaCorrecta = (Read-SummitJson $rutaEstado).ultimaCopiaCorrecta } catch { }
    }

    $sieteZip = Get-Summit7Zip $cfg
    $mysqldump = Join-Path $cfg.MysqlBin 'mysqldump.exe'
    if (-not (Test-Path -LiteralPath $mysqldump)) { throw "No encontré mysqldump.exe en $($cfg.MysqlBin) (revisá MysqlBin en $($cfg.RutaConfig))." }

    $secretos = Read-SummitSecretos $cfg.ArchivoSecretos
    if (-not $secretos['MysqlUsuario'] -or -not $secretos['MysqlClave']) {
        throw "Falta el usuario de MySQL para las copias en $($cfg.ArchivoSecretos): corré crear-usuarios-mysql.ps1."
    }
    if (-not $secretos['ClaveCifrado']) { throw "Falta la clave de cifrado en $($cfg.ArchivoSecretos): corré guardar-clave-copias.ps1." }
    $problema = Test-SummitClaveCifrado $secretos['ClaveCifrado']
    if ($problema) { throw "La clave de cifrado guardada $problema." }

    if (-not (Test-Path -LiteralPath $cfg.CarpetaCopias)) { New-SummitCarpetaPrivada -Ruta $cfg.CarpetaCopias }
    $sufijo = ''
    if ($Etiqueta) { $sufijo = "-$Etiqueta" }
    $nombre = 'summit-copia-' + $inicio.ToString('yyyy-MM-dd_HHmm') + $sufijo + '.7z'
    # Si ya hubo otra copia en este mismo minuto, el nombre lleva también los segundos
    if (Test-Path -LiteralPath (Join-Path $cfg.CarpetaCopias $nombre)) { $nombre = 'summit-copia-' + $inicio.ToString('yyyy-MM-dd_HHmmss') + $sufijo + '.7z' }
    $destino = Join-Path $cfg.CarpetaCopias $nombre
    if (Test-Path -LiteralPath $destino) { throw "Ya hay una copia con el nombre $nombre." }

    # Carpeta de trabajo privada: el volcado tiene datos personales y se borra al terminar, salga bien o mal
    $preparacion = Join-Path $cfg.CarpetaCopias ('.preparando-' + $inicio.ToString('yyyyMMdd-HHmmss'))
    New-SummitCarpetaPrivada -Ruta $preparacion -UsuarioActual
    $contenido = Join-Path $preparacion 'contenido'
    New-Item -ItemType Directory -Path (Join-Path $contenido 'base') -Force | Out-Null
    $opciones = New-SummitOpcionesMysql -Carpeta $preparacion -Usuario $secretos['MysqlUsuario'] -Clave $secretos['MysqlClave'] -Servidor $cfg.MysqlServidor -Puerto $cfg.MysqlPuerto

    $consulta = "SELECT VERSION(), " +
        "(SELECT default_character_set_name FROM information_schema.schemata WHERE schema_name = '$($cfg.Base)'), " +
        "(SELECT default_collation_name FROM information_schema.schemata WHERE schema_name = '$($cfg.Base)'), " +
        "(SELECT IFNULL(SUM(data_length + index_length), 0) FROM information_schema.tables WHERE table_schema = '$($cfg.Base)')"
    $datosServidor = @(Get-SummitLineas (Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql $consulta))[0] -split "`t"
    $versionMysql = $datosServidor[0]
    if ($datosServidor[1] -eq 'NULL' -or -not $datosServidor[1]) {
        throw "MySQL no muestra la base $($cfg.Base): no existe o el usuario $($secretos['MysqlUsuario']) no tiene permiso para leerla."
    }
    $juegoCaracteres = $datosServidor[1]
    $intercalacion = $datosServidor[2]
    $bytesBase = [long]$datosServidor[3]

    $carpetaUploads = ([string]$cfg.CarpetaUploads).TrimEnd('\')
    $hayUploads = Test-Path -LiteralPath $carpetaUploads -PathType Container
    $cantidadUploads = 0
    $bytesUploads = [long]0
    if ($hayUploads) {
        $archivosUploads = @(Get-ChildItem -LiteralPath $carpetaUploads -Recurse -File -Force)
        $cantidadUploads = $archivosUploads.Count
        if ($cantidadUploads -gt 0) { $bytesUploads = [long]($archivosUploads | Measure-Object -Property Length -Sum).Sum }
    } else {
        $avisos.Add("No existe la carpeta de archivos subidos ($carpetaUploads): la copia va solo con la base.")
        Write-SummitRegistro $avisos[$avisos.Count - 1] 'AVISO'
    }

    $necesario = [long]($bytesBase * 3 + $bytesUploads * 1.1 + 200MB)
    $libre = Get-SummitEspacioLibre $cfg.CarpetaCopias
    if ($null -ne $libre -and $libre -lt $necesario) {
        throw "No hay lugar en el disco de $($cfg.CarpetaCopias): quedan $(Format-SummitTamano $libre) y la copia necesita unos $(Format-SummitTamano $necesario)."
    }

    # Filas y huellas antes y después del volcado: si una tabla cambió mientras tanto (alguien cargó algo), se anota
    # para que la restauración no lo tome como un error
    $tablas = @(Get-SummitTablas -Cfg $cfg -Opciones $opciones -Base $cfg.Base)
    $conteosAntes = Get-SummitConteos -Cfg $cfg -Opciones $opciones -Base $cfg.Base -Tablas $tablas
    $huellasAntes = Get-SummitChecksums -Cfg $cfg -Opciones $opciones -Base $cfg.Base -Tablas $tablas

    $archivoSql = Join-Path $contenido "base\$($cfg.Base).sql"
    Write-SummitRegistro "Volcando la base $($cfg.Base) ($($tablas.Count) tablas, MySQL $versionMysql)..."
    $argumentos = @(
        "--defaults-file=$opciones",
        '--single-transaction',          # foto coherente de la base sin frenar a SUMMIT (tablas InnoDB)
        '--skip-lock-tables',
        '--routines', '--events', '--triggers',
        '--hex-blob',                    # datos binarios en hexadecimal: el archivo queda en texto puro
        '--default-character-set=utf8mb4',
        '--set-gtid-purged=OFF',         # se puede restaurar en cualquier servidor
        '--no-tablespaces',              # no necesita el permiso PROCESS
        "--result-file=$archivoSql",     # escribe el archivo directo (sin pasar por PowerShell, que cambiaría la codificación)
        $cfg.Base
    )
    $resultado = Invoke-SummitPrograma -Programa $mysqldump -Argumentos $argumentos -TiempoMaximoSegundos 7200
    if ($resultado.Codigo -ne 0) { throw "mysqldump falló (código $($resultado.Codigo)): $($resultado.Errores.Trim())" }
    foreach ($linea in (Get-SummitLineas $resultado.Errores)) { Write-SummitRegistro "mysqldump: $linea" 'AVISO' }
    if (-not (Test-SummitVolcadoCompleto $archivoSql)) { throw 'El volcado quedó incompleto (no termina con "Dump completed").' }

    $conteosDespues = Get-SummitConteos -Cfg $cfg -Opciones $opciones -Base $cfg.Base -Tablas $tablas
    $huellasDespues = Get-SummitChecksums -Cfg $cfg -Opciones $opciones -Base $cfg.Base -Tablas $tablas
    $detalleTablas = @(foreach ($tabla in $tablas) {
        $cambio = ($conteosAntes[$tabla] -ne $conteosDespues[$tabla]) -or ($huellasAntes[$tabla] -ne $huellasDespues[$tabla])
        if ($cambio) { Write-SummitRegistro "La tabla $tabla cambió durante la copia (es normal si alguien estaba usando SUMMIT)." }
        [ordered]@{
            nombre               = $tabla
            filas                = $conteosAntes[$tabla]
            filasDespues         = $conteosDespues[$tabla]
            checksum             = $huellasAntes[$tabla]
            cambioDuranteLaCopia = [bool]$cambio
        }
    })
    $totalFilas = [long]0
    foreach ($valor in $conteosAntes.Values) { $totalFilas += $valor }

    $versionMysqldump = (Invoke-SummitPrograma -Programa $mysqldump -Argumentos @('--version')).Salida.Trim()
    $manifiesto = [ordered]@{
        formato           = 'summit-copia-1'
        fecha             = $inicio.ToString('o')
        equipo            = $env:COMPUTERNAME
        base              = $cfg.Base
        juegoDeCaracteres = $juegoCaracteres
        intercalacion     = $intercalacion
        versionMysql      = $versionMysql
        versionMysqldump  = $versionMysqldump
        archivoSql        = "base/$($cfg.Base).sql"
        bytesSql          = (Get-Item -LiteralPath $archivoSql).Length
        sha256Sql         = Get-SummitHash $archivoSql
        tablas            = $detalleTablas
        uploads           = [ordered]@{
            incluidos        = [bool]$hayUploads
            carpetaOriginal  = $carpetaUploads
            carpetaEnLaCopia = (Split-Path $carpetaUploads -Leaf)
            archivos         = $cantidadUploads
            bytes            = $bytesUploads
        }
        versionScripts    = $script:SummitVersionScripts
    }
    Write-SummitJson -Ruta (Join-Path $contenido 'manifiesto.json') -Objeto $manifiesto

    $leeme = @"
SUMMIT - Copia de seguridad
===========================

Fecha: $($inicio.ToString('dd/MM/yyyy HH:mm'))      PC: $env:COMPUTERNAME

Esta copia tiene la base de datos de SUMMIT y los archivos subidos (certificados médicos y fotos de los socios).
Son datos personales y de salud (Ley 25.326): no la compartas y guardala solo en lugares seguros.

Contenido:
  base\$($cfg.Base).sql    la base de datos ($($tablas.Count) tablas, $totalFilas filas), volcada con mysqldump
  $(Split-Path $carpetaUploads -Leaf)\    los archivos subidos ($cantidadUploads archivos)
  manifiesto.json           detalle técnico para verificar una restauración (filas y huellas de cada tabla)

Cómo restaurarla: con restaurar-copia.ps1 de SUMMIT (INSTALACION.md, "Restaurar una copia"). Primero se prueba en
una base nueva; la base real se reemplaza solo si lo confirmás escribiendo REEMPLAZAR.
"@
    [IO.File]::WriteAllText((Join-Path $contenido 'LEEME.txt'), $leeme, (New-Object System.Text.UTF8Encoding($true)))

    Write-SummitRegistro "Comprimiendo y cifrando: base ($(Format-SummitTamano $manifiesto.bytesSql)) y $cantidadUploads archivos ($(Format-SummitTamano $bytesUploads))..."
    $parcial = "$destino.parcial"
    $entradas = @('manifiesto.json', 'LEEME.txt', 'base')
    if ($hayUploads) { $entradas += $carpetaUploads }
    $resultado = Invoke-Summit7Zip -SieteZip $sieteZip -Clave $secretos['ClaveCifrado'] -Directorio $contenido `
        -Argumentos (@('a', '-t7z', '-mx=5', '-mhe=on', '-mmt=on', '-ssw', '-p', $parcial) + $entradas)
    if ($resultado.Codigo -eq 1) {
        $avisos.Add("7-Zip avisó: $(Get-SummitMensaje7Zip $resultado)")
        Write-SummitRegistro $avisos[$avisos.Count - 1] 'AVISO'
    } elseif ($resultado.Codigo -ne 0) {
        throw "7-Zip no pudo armar la copia: $(Get-SummitMensaje7Zip $resultado)"
    }

    $resultado = Invoke-Summit7Zip -SieteZip $sieteZip -Clave $secretos['ClaveCifrado'] -Argumentos @('t', $parcial)
    if ($resultado.Codigo -ne 0) { throw "La copia no pasó la prueba de 7-Zip: $(Get-SummitMensaje7Zip $resultado)" }
    Move-Item -LiteralPath $parcial -Destination $destino
    $parcial = $null
    $hash = Get-SummitHash $destino
    $bytes = (Get-Item -LiteralPath $destino).Length
    $estado.archivo = $nombre
    $estado.carpeta = $cfg.CarpetaCopias
    $estado.bytes = $bytes
    $estado.sha256 = $hash
    Write-SummitRegistro "Copia lista y probada: $destino ($(Format-SummitTamano $bytes), SHA-256 $hash)" 'OK'

    if ($cfg.DestinoExterno -and -not $SinDestinoExterno) {
        try {
            $copiaExterna = Copy-SummitAlDestinoExterno -Archivo $destino -Hash $hash -Carpeta $cfg.DestinoExterno
            $estado.destinoExterno = 'ok'
            Write-SummitRegistro "Copiada al destino externo: $copiaExterna" 'OK'
            Remove-SummitCopiasViejas -Carpeta $cfg.DestinoExterno -Dias $cfg.DiasRetencionExterno -Minimas $cfg.CopiasMinimas
        } catch {
            $estado.destinoExterno = "error: $($_.Exception.Message)"
            $avisos.Add("No se pudo copiar al destino externo ($($cfg.DestinoExterno)): $($_.Exception.Message)")
            Write-SummitRegistro $avisos[$avisos.Count - 1] 'AVISO'
        }
    } elseif ($SinDestinoExterno) {
        $estado.destinoExterno = 'no se usó en esta copia'
    }

    Remove-SummitCopiasViejas -Carpeta $cfg.CarpetaCopias -Dias $cfg.DiasRetencion -Minimas $cfg.CopiasMinimas

    $estado.ultimaCopiaCorrecta = (Get-Date).ToString('o')
    if ($avisos.Count -gt 0) { $estado.resultado = 'con avisos'; $codigoSalida = 2 } else { $estado.resultado = 'ok'; $codigoSalida = 0 }
} catch {
    $estado.mensaje = $_.Exception.Message
    Write-SummitRegistro "La copia NO se pudo hacer: $($_.Exception.Message)" 'ERROR'
    $codigoSalida = 1
} finally {
    Remove-SummitArchivo $opciones
    if ($parcial -and (Test-Path -LiteralPath $parcial)) { Remove-Item -LiteralPath $parcial -Force -ErrorAction SilentlyContinue }
    if ($preparacion -and (Test-Path -LiteralPath $preparacion)) { Remove-Item -LiteralPath $preparacion -Recurse -Force -ErrorAction SilentlyContinue }
    $estado.duracionSegundos = [int]((Get-Date) - $inicio).TotalSeconds
    if ($codigoSalida -ne 1 -and $avisos.Count -gt 0) { $estado.mensaje = ($avisos -join ' | ') }
    if ($cfg -and (Test-Path -LiteralPath $cfg.CarpetaCopias)) {
        try { Write-SummitJson -Ruta (Join-Path $cfg.CarpetaCopias 'estado-copias.json') -Objeto $estado } catch { }
    }
    $nivel = 'OK'
    if ($codigoSalida -eq 2) { $nivel = 'AVISO' } elseif ($codigoSalida -eq 1) { $nivel = 'ERROR' }
    Write-SummitRegistro "=== Fin (código $codigoSalida, $($estado.duracionSegundos) s)" $nivel
}

if ($Pausa) { [void](Read-Host 'Apretá Enter para cerrar') }
exit $codigoSalida
