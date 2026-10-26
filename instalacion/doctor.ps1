<#
.SYNOPSIS
    Chequeo rápido de SUMMIT: ¿están funcionando MySQL, el backend y la app?, ¿cuándo fue la última copia?, ¿hay lugar
    en el disco?

.DESCRIPTION
    No cambia nada: solo mira y explica qué hacer si algo está mal. Conviene correrlo como administrador (doctor.cmd lo
    pide solo), porque sin eso no puede leer la carpeta de copias ni el archivo de claves.

    Códigos de salida: 0 = todo bien; 2 = hay avisos; 1 = hay problemas.
#>
[CmdletBinding()]
param(
    [string]$Config,
    # Para el acceso directo (doctor.cmd): pide permiso de administrador y espera Enter al terminar
    [switch]$Elevar,
    [switch]$Pausa
)

. (Join-Path $PSScriptRoot 'comun.ps1')
$ErrorActionPreference = 'Continue'

if ($Elevar -and -not (Test-SummitAdministrador)) {
    Start-SummitComoAdministrador -Script $PSCommandPath -Parametros $PSBoundParameters
    exit 0
}

$script:Resultados = New-Object System.Collections.Generic.List[object]
function Add-Resultado {
    param([ValidateSet('OK', 'AVISO', 'ERROR', 'INFO')][string]$Nivel, [string]$Tema, [string]$Texto, [string]$QueHacer = '')
    $script:Resultados.Add([pscustomobject]@{ Nivel = $Nivel; Tema = $Tema; Texto = $Texto; QueHacer = $QueHacer })
    $color = @{ OK = 'Green'; AVISO = 'Yellow'; ERROR = 'Red'; INFO = 'Gray' }[$Nivel]
    Write-Host ('[{0,-5}] {1}: {2}' -f $Nivel, $Tema, $Texto) -ForegroundColor $color
    if ($QueHacer) { Write-Host "        -> $QueHacer" -ForegroundColor $color }
}

function Test-SummitPuerto {
    param([string]$Servidor, [int]$Puerto, [int]$Milisegundos = 2000)
    $cliente = New-Object System.Net.Sockets.TcpClient
    try {
        $intento = $cliente.BeginConnect($Servidor, $Puerto, $null, $null)
        if (-not $intento.AsyncWaitHandle.WaitOne($Milisegundos)) { return $false }
        $cliente.EndConnect($intento)
        return $true
    } catch { return $false } finally { $cliente.Close() }
}

function Get-SummitEdad {
    param([datetime]$Fecha)
    $horas = ((Get-Date) - $Fecha).TotalHours
    if ($horas -lt 1) { return 'hace menos de una hora' }
    if ($horas -lt 48) { return ('hace {0:N0} horas' -f $horas) }
    return ('hace {0:N0} días' -f ($horas / 24))
}

$cfg = Read-SummitConfig -Ruta $Config -Opcional
Write-Host ''
Write-Host "Chequeo de SUMMIT - $(Get-Date -Format 'dd/MM/yyyy HH:mm') - PC $env:COMPUTERNAME" -ForegroundColor Cyan
if (-not $cfg.RutaConfig) { Add-Resultado 'AVISO' 'Configuración' 'no encontré config\summit.psd1: uso los valores por defecto (C:\SUMMIT)' 'Corré preparar-pc.ps1 (INSTALACION.md, paso 3).' }
if (-not (Test-SummitAdministrador)) { Add-Resultado 'INFO' 'Permisos' 'sin administrador: algunas cosas (copias, claves) pueden no verse' 'Usá doctor.cmd, que pide permiso solo.' }

# --- MySQL
$servicioMysql = Get-Service -Name $cfg.MysqlServicio -ErrorAction SilentlyContinue
if (-not $servicioMysql) {
    Add-Resultado 'ERROR' 'MySQL' "no existe el servicio $($cfg.MysqlServicio)" 'Revisá MysqlServicio en config\summit.psd1 (el nombre está en services.msc) o instalá MySQL.'
} elseif ($servicioMysql.Status -ne 'Running') {
    Add-Resultado 'ERROR' 'MySQL' "el servicio $($cfg.MysqlServicio) está $($servicioMysql.Status)" 'services.msc > MySQL84 > Iniciar. Si no arranca, mirá el Visor de eventos > Registros de Windows > Aplicación.'
} elseif (-not (Test-SummitPuerto $cfg.MysqlServidor $cfg.MysqlPuerto)) {
    Add-Resultado 'ERROR' 'MySQL' "el servicio corre pero no atiende en $($cfg.MysqlServidor):$($cfg.MysqlPuerto)" 'Reiniciá el servicio de MySQL.'
} else {
    Add-Resultado 'OK' 'MySQL' "funcionando (servicio $($cfg.MysqlServicio), puerto $($cfg.MysqlPuerto))"
}
$escuchando = @(netstat -ano 2>$null | Select-String -Pattern "^\s*TCP\s+(\S+):$($cfg.MysqlPuerto)\s+\S+\s+(LISTENING|ESCUCHANDO)" | ForEach-Object { $_.Matches[0].Groups[1].Value })
if ($escuchando | Where-Object { $_ -eq '0.0.0.0' -or $_ -eq '[::]' }) {
    Add-Resultado 'AVISO' 'MySQL' 'acepta conexiones desde la red, no solo desde esta PC' 'Agregá bind-address=127.0.0.1 en la sección [mysqld] de my.ini y reiniciá MySQL (INSTALACION.md, paso 1).'
}

# --- Backend
$servicioBackend = Get-Service -Name $cfg.ServicioBackend -ErrorAction SilentlyContinue
$respuestaBackend = Get-SummitRespuestaHttp -Url ($cfg.UrlBackend.TrimEnd('/') + '/api/planes') -Segundos 5
if ($respuestaBackend.Responde) {
    $detalle = "responde en $($cfg.UrlBackend)"
    if ($servicioBackend) { $detalle += " (servicio $($cfg.ServicioBackend))" } else { $detalle += ' (no está instalado como servicio)' }
    Add-Resultado 'OK' 'Backend' $detalle
} elseif ($servicioBackend -and $servicioBackend.Status -eq 'Running') {
    Add-Resultado 'AVISO' 'Backend' 'el servicio corre pero todavía no responde (tarda unos 30 segundos en arrancar)' "Esperá un minuto y volvé a chequear. Si sigue así, mirá $($cfg.CarpetaRegistros)\summit-backend_rCURRENT.log."
} elseif ($servicioBackend) {
    Add-Resultado 'ERROR' 'Backend' "el servicio $($cfg.ServicioBackend) está $($servicioBackend.Status)" "services.msc > $($cfg.ServicioBackend) > Iniciar. El motivo de una falla queda en $($cfg.CarpetaRegistros)\summit-backend_rCURRENT.log."
} else {
    Add-Resultado 'ERROR' 'Backend' "no está instalado como servicio ni responde en $($cfg.UrlBackend)" 'Instalalo con instalar-servicios.ps1 (INSTALACION.md, paso 7).'
}
if ($servicioBackend) {
    # Si se actualizó Java, la ruta que usa el servicio puede no existir más
    $ruta = (Get-CimInstance -ClassName Win32_Service -Filter "Name='$($cfg.ServicioBackend)'" -ErrorAction SilentlyContinue).PathName
    if ($ruta -match '\s--\s+(?:"([^"]+java\.exe)"|(\S+java\.exe))') {
        $javaServicio = $Matches[1]
        if (-not $javaServicio) { $javaServicio = $Matches[2] }
        if (-not (Test-Path -LiteralPath $javaServicio)) {
            Add-Resultado 'ERROR' 'Java' "el servicio usa $javaServicio, que ya no existe (¿se actualizó Java?)" 'Corré de nuevo instalar-servicios.ps1: toma el Java instalado ahora.'
        }
    }
}

# --- App (Caddy)
$servicioWeb = Get-Service -Name $cfg.ServicioWeb -ErrorAction SilentlyContinue
$respuestaWeb = Get-SummitRespuestaHttp -Url ($cfg.UrlWeb.TrimEnd('/') + '/') -Segundos 5
if ($respuestaWeb.Responde -and $respuestaWeb.Estado -eq 200 -and $respuestaWeb.Contenido -match 'id="root"') {
    Add-Resultado 'OK' 'App' "se ve en $($cfg.UrlWeb)"
    $proxy = Get-SummitRespuestaHttp -Url ($cfg.UrlWeb.TrimEnd('/') + '/api/planes') -Segundos 5
    if ($proxy.Responde -and @(401, 403, 200) -contains $proxy.Estado) {
        Add-Resultado 'OK' 'App' 'llega al backend por /api'
    } else {
        Add-Resultado 'ERROR' 'App' 'se ve, pero /api no llega al backend' 'Revisá que el backend esté funcionando (arriba).'
    }
} elseif ($servicioWeb -and $servicioWeb.Status -ne 'Running') {
    Add-Resultado 'ERROR' 'App' "el servicio $($cfg.ServicioWeb) está $($servicioWeb.Status)" "services.msc > $($cfg.ServicioWeb) > Iniciar. El motivo queda en $($cfg.CarpetaRegistros)\summit-web_rCURRENT.log."
} elseif (-not $servicioWeb) {
    Add-Resultado 'ERROR' 'App' "no responde en $($cfg.UrlWeb) y no está instalado el servicio $($cfg.ServicioWeb)" 'Instalalo con instalar-servicios.ps1 (INSTALACION.md, paso 7).'
} else {
    Add-Resultado 'ERROR' 'App' "no responde bien en $($cfg.UrlWeb)" "Mirá $($cfg.CarpetaRegistros)\summit-web_rCURRENT.log."
}

# --- Copias de seguridad
$copias = @()
$sinPermiso = $false
try {
    [void][IO.Directory]::GetFiles([string]$cfg.CarpetaCopias, 'summit-copia-*.7z')
    $copias = @(Get-SummitCopias $cfg.CarpetaCopias)
} catch [UnauthorizedAccessException] {
    $sinPermiso = $true
} catch { }
$estado = $null
$rutaEstado = Join-Path $cfg.CarpetaCopias 'estado-copias.json'
try { if (Test-Path -LiteralPath $rutaEstado) { $estado = Read-SummitJson $rutaEstado } } catch { }
if ($sinPermiso) {
    Add-Resultado 'AVISO' 'Copias' "no tengo permiso para ver $($cfg.CarpetaCopias)" 'Corré doctor.cmd, que pide permiso de administrador.'
} elseif (-not (Test-Path -LiteralPath $cfg.CarpetaCopias)) {
    Add-Resultado 'ERROR' 'Copias' "no existe la carpeta $($cfg.CarpetaCopias): todavía no se hizo ninguna copia" 'INSTALACION.md, paso 9.'
} elseif ($copias.Count -eq 0) {
    Add-Resultado 'ERROR' 'Copias' "no hay ninguna copia en $($cfg.CarpetaCopias)" 'Hacé una ahora con copia-ahora.cmd y revisá que la tarea esté programada (INSTALACION.md, paso 9).'
} else {
    $ultima = $copias[0]
    $total = [long]0
    foreach ($c in $copias) { $total += $c.Archivo.Length }
    $texto = "la última es de $(Get-SummitEdad $ultima.Fecha) ($($ultima.Archivo.Name), $(Format-SummitTamano $ultima.Archivo.Length)); hay $($copias.Count) en la PC ($(Format-SummitTamano $total))"
    if (((Get-Date) - $ultima.Fecha).TotalHours -gt $cfg.HorasAvisoCopia) {
        Add-Resultado 'ERROR' 'Copias' $texto "Hace más de $($cfg.HorasAvisoCopia) horas que no se hace una copia: mirá $($cfg.CarpetaRegistros)\copias.log y la tarea programada."
    } else {
        Add-Resultado 'OK' 'Copias' $texto
    }
}
if ($estado) {
    if ($estado.resultado -eq 'error') {
        Add-Resultado 'ERROR' 'Copias' "la última vez que corrió ($([datetime]::Parse($estado.fecha).ToString('dd/MM HH:mm'))) falló: $($estado.mensaje)" "Detalle en $($cfg.CarpetaRegistros)\copias.log."
    } elseif ($estado.resultado -eq 'con avisos') {
        Add-Resultado 'AVISO' 'Copias' "la última copia salió con avisos: $($estado.mensaje)"
    }
}
if ($cfg.DestinoExterno) {
    $unidad = [IO.Path]::GetPathRoot([string]$cfg.DestinoExterno)
    if (-not (Test-Path -LiteralPath $unidad)) {
        Add-Resultado 'AVISO' 'Copia externa' "la unidad $unidad no está conectada ($($cfg.DestinoExterno))" 'Conectá el disco: la próxima copia se guarda también ahí.'
    } else {
        $externas = @(Get-SummitCopias $cfg.DestinoExterno)
        if ($externas.Count -eq 0) {
            Add-Resultado 'AVISO' 'Copia externa' "todavía no hay copias en $($cfg.DestinoExterno)"
        } elseif (((Get-Date) - $externas[0].Fecha).TotalHours -gt $cfg.HorasAvisoCopia) {
            Add-Resultado 'AVISO' 'Copia externa' "la última en $($cfg.DestinoExterno) es de $(Get-SummitEdad $externas[0].Fecha)" '¿Estuvo desconectado el disco o cerrado OneDrive/Google Drive?'
        } else {
            Add-Resultado 'OK' 'Copia externa' "la última en $($cfg.DestinoExterno) es de $(Get-SummitEdad $externas[0].Fecha)"
        }
    }
} else {
    Add-Resultado 'AVISO' 'Copia externa' 'no hay destino externo: si la PC se rompe o se la roban, se pierden también las copias' 'Configurá DestinoExterno en config\summit.psd1 (OneDrive, Google Drive o un disco USB).'
}
try {
    $secretos = Read-SummitSecretos $cfg.ArchivoSecretos
    if (-not $secretos['ClaveCifrado'] -or -not $secretos['MysqlClave']) {
        Add-Resultado 'ERROR' 'Claves' "faltan claves en $($cfg.ArchivoSecretos)" 'Corré crear-usuarios-mysql.ps1 y guardar-clave-copias.ps1.'
    }
} catch {
    Add-Resultado 'INFO' 'Claves' "no pude leer $($cfg.ArchivoSecretos): $($_.Exception.Message)"
}

# --- Tarea programada
$tarea = Get-ScheduledTask -TaskPath '\SUMMIT\' -TaskName $cfg.TareaCopia -ErrorAction SilentlyContinue
if (-not $tarea) {
    Add-Resultado 'ERROR' 'Tarea' 'la copia automática no está programada' 'Programala con programar-copia.ps1 (INSTALACION.md, paso 9).'
} else {
    $info = Get-ScheduledTaskInfo -TaskPath '\SUMMIT\' -TaskName $cfg.TareaCopia
    $proxima = 'sin próxima ejecución'
    if ($info.NextRunTime) { $proxima = 'próxima: ' + $info.NextRunTime.ToString('dd/MM HH:mm') }
    if ($tarea.State -eq 'Disabled') {
        Add-Resultado 'ERROR' 'Tarea' 'la copia automática está deshabilitada' 'Programador de tareas > SUMMIT > clic derecho > Habilitar.'
    } elseif ($info.LastRunTime -and $info.LastRunTime.Year -gt 2000 -and @(0, 2) -notcontains $info.LastTaskResult) {
        Add-Resultado 'AVISO' 'Tarea' "la última ejecución ($($info.LastRunTime.ToString('dd/MM HH:mm'))) terminó con código $($info.LastTaskResult); $proxima" "Detalle en $($cfg.CarpetaRegistros)\copias.log."
    } else {
        Add-Resultado 'OK' 'Tarea' "programada ($proxima)"
    }
}

# --- Disco
$unidades = @($cfg.Raiz, $cfg.CarpetaCopias, $env:ProgramData) | Where-Object { $_ } | ForEach-Object { [IO.Path]::GetPathRoot([string]$_) } | Where-Object { $_ } | Select-Object -Unique
foreach ($unidad in $unidades) {
    $libre = Get-SummitEspacioLibre $unidad
    if ($null -eq $libre) { continue }
    $totalDisco = (New-Object IO.DriveInfo($unidad)).TotalSize
    $texto = "$unidad tiene $(Format-SummitTamano $libre) libres de $(Format-SummitTamano $totalDisco)"
    if ($libre -lt 1GB) {
        Add-Resultado 'ERROR' 'Disco' $texto 'Liberá espacio ya: sin lugar, MySQL y las copias dejan de funcionar.'
    } elseif ($libre -lt [double]$cfg.EspacioMinimoGB * 1GB) {
        Add-Resultado 'AVISO' 'Disco' $texto 'Liberá espacio o bajá DiasRetencion en config\summit.psd1.'
    } else {
        Add-Resultado 'OK' 'Disco' $texto
    }
}

# --- Memoria y asistente de IA (opcional)
$memoriaTotal = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue).TotalPhysicalMemory
$memoriaLibre = (Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue).FreePhysicalMemory * 1KB
$ia = Get-SummitRespuestaHttp -Url ($cfg.UrlOllama.TrimEnd('/') + '/api/tags') -Segundos 3
if ($ia.Responde -and $ia.Estado -eq 200) {
    $modelos = @()
    try { $modelos = @(($ia.Contenido | ConvertFrom-Json).models | ForEach-Object { $_.name }) } catch { }
    if ($modelos -contains $cfg.ModeloIa) {
        Add-Resultado 'OK' 'IA' "Ollama funcionando, con el modelo $($cfg.ModeloIa)"
    } else {
        Add-Resultado 'AVISO' 'IA' "Ollama funciona pero no tiene el modelo $($cfg.ModeloIa)" "Descargalo con:  ollama pull $($cfg.ModeloIa)"
    }
    if ($memoriaTotal -and $memoriaTotal -lt 15GB) {
        Add-Resultado 'AVISO' 'Memoria' "la PC tiene $(Format-SummitTamano $memoriaTotal) de RAM y el modelo de IA usa unos 10 GB" 'Con menos de 16 GB conviene apagar la IA (summit.ia.habilitada=false en app\config\application.properties).'
    }
} else {
    Add-Resultado 'INFO' 'IA' 'Ollama no está funcionando: SUMMIT anda igual, sin los botones de IA (es opcional)'
}
if ($memoriaTotal) { Add-Resultado 'INFO' 'Memoria' "$(Format-SummitTamano $memoriaTotal) de RAM, $(Format-SummitTamano $memoriaLibre) libres ahora" }

# --- Resumen
$errores = @($script:Resultados | Where-Object { $_.Nivel -eq 'ERROR' }).Count
$avisos = @($script:Resultados | Where-Object { $_.Nivel -eq 'AVISO' }).Count
Write-Host ''
if ($errores -gt 0) {
    Write-Host "Resultado: $errores problema(s) y $avisos aviso(s). Seguí las indicaciones de cada uno (->)." -ForegroundColor Red
    $codigo = 1
} elseif ($avisos -gt 0) {
    Write-Host "Resultado: funciona, con $avisos aviso(s)." -ForegroundColor Yellow
    $codigo = 2
} else {
    Write-Host 'Resultado: todo bien.' -ForegroundColor Green
    $codigo = 0
}
if ($Pausa) { [void](Read-Host 'Apretá Enter para cerrar') }
exit $codigo
