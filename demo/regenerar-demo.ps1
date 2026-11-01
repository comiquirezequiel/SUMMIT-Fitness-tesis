<#
Regenera los datos de demostración de SUMMIT: 6 meses simulados de gimnasio que terminan hoy (80 socios, 7 empleados,
cobros, ingresos, gastos y cierres de caja). Sirve para mostrar las métricas con fechas actuales, por ejemplo el día de
la defensa. Es para una PC de prueba: BORRA a todos los socios.

Qué hace:
  1. Guarda una copia de la base en demo\respaldos\<fecha> y mueve ahí los certificados y las fotos de los socios.
  2. Borra los socios, el personal (menos los administradores) y todo su movimiento: cobros, ingresos, turnos, caja,
     gastos, rutinas... Quedan los administradores, los planes, los ejercicios, los descuentos, las reglas y los datos
     del gimnasio (con su horario: la demo lo respeta).
  3. Arranca el backend con DEMO=true: al iniciar carga la demo y después sigue funcionando como siempre. Se cierra con
     Ctrl + C, como de costumbre.

Antes: cerrá el backend si está abierto (Ctrl + C en su terminal). Hace falta DEMO_PASSWORD en
summit-backend\src\main\resources\application-local.properties: es la contraseña de todos los usuarios de la demo.

Uso, desde la carpeta del proyecto (o doble clic en demo\regenerar-demo.cmd):
  powershell -ExecutionPolicy Bypass -File .\demo\regenerar-demo.ps1
Opciones:
  -Semilla 7      otros datos al azar (la misma semilla da siempre los mismos)
  -Puerto 8081    arranca el backend en otro puerto (por defecto 8080)
  -SinConfirmar   no pregunta antes de borrar
#>
param(
    [int]$Semilla = 2026,
    [int]$Puerto = 8080,
    [switch]$SinConfirmar
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $raiz 'summit-backend'
$configuracion = Join-Path $backend 'src\main\resources\application-local.properties'
$base = 'summit_fitness_db'
# La encargada que crea la demo es administradora: es la única administradora que se borra
$emailEncargadaDemo = 'valeria.paredes@summit.com'

# Un valor de application-local.properties (o de la variable de entorno con el mismo nombre, que tiene prioridad)
function Get-Propiedad([string]$Nombre) {
    $valor = [Environment]::GetEnvironmentVariable($Nombre)
    if ($valor) { return $valor }
    if (-not (Test-Path -LiteralPath $configuracion)) { return '' }
    $linea = Get-Content -LiteralPath $configuracion -Encoding UTF8 | Where-Object { $_ -match "^\s*$Nombre\s*=" } | Select-Object -Last 1
    if (-not $linea) { return '' }
    return ($linea -replace "^\s*$Nombre\s*=", '').Trim()
}

function Find-MysqlBin {
    $comando = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($comando) { return Split-Path $comando.Source -Parent }
    $encontrado = Get-ChildItem 'C:\Program Files\MySQL\*\bin\mysql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($encontrado) { return $encontrado.DirectoryName }
    throw 'No se encontró MySQL (mysql.exe). ¿Está instalado MySQL 8?'
}

function Invoke-Mysql([string]$Sql) {
    $salida = & $mysql -u $usuario --default-character-set=utf8mb4 -N -B -e $Sql $base
    if ($LASTEXITCODE -ne 0) { throw "MySQL devolvió un error (código $LASTEXITCODE)" }
    return $salida
}

Write-Host ''
Write-Host 'SUMMIT - Regenerar los datos de demostración' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path -LiteralPath $configuracion)) {
    throw "Falta $configuracion (ver el paso 2 del README)."
}
$usuario = Get-Propiedad 'DB_USERNAME'
if (-not $usuario) { throw 'Falta DB_USERNAME en application-local.properties.' }
if (-not (Get-Propiedad 'DEMO_PASSWORD')) {
    throw 'Falta DEMO_PASSWORD en application-local.properties: es la contraseña de los usuarios de la demo.'
}
if (Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue) {
    throw "Hay un programa usando el puerto $Puerto (¿el backend abierto?). Cerralo con Ctrl + C en su terminal y volvé a correr este script."
}

$bin = Find-MysqlBin
$mysql = Join-Path $bin 'mysql.exe'
$mysqldump = Join-Path $bin 'mysqldump.exe'
# La contraseña va por variable de entorno, no en la línea de comandos (ahí la ve cualquier programa)
$env:MYSQL_PWD = Get-Propiedad 'DB_PASSWORD'

try {
    $socios = Invoke-Mysql "SELECT COUNT(*) FROM usuarios WHERE rol = 'SOCIO'"
    Write-Host "Se van a BORRAR los $socios socios de la base $base, el personal (menos los administradores) y todo su"
    Write-Host 'movimiento. Antes se guarda una copia en demo\respaldos.'
    if (-not $SinConfirmar) {
        $respuesta = Read-Host 'Escribí BORRAR para seguir'
        if ($respuesta -cne 'BORRAR') {
            Write-Host 'No se borró nada.'
            return
        }
    }

    # 1. Copia de la base y de los archivos de los socios
    $respaldo = Join-Path $PSScriptRoot ('respaldos\' + (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'))
    New-Item -ItemType Directory -Force -Path $respaldo | Out-Null
    $archivoBase = Join-Path $respaldo "$base.sql"
    & $mysqldump -u $usuario --single-transaction --routines --default-character-set=utf8mb4 "--result-file=$archivoBase" $base
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo hacer la copia de la base: no se borró nada.' }
    Write-Host "Copia de la base: $archivoBase" -ForegroundColor Green

    $uploads = Join-Path $backend 'uploads'
    foreach ($carpeta in 'certificados', 'fotos') {
        $origen = Join-Path $uploads $carpeta
        if (Test-Path -LiteralPath $origen) {
            Move-Item -LiteralPath $origen -Destination (Join-Path $respaldo $carpeta)
        }
    }

    # 2. Borrado: solo las tablas que existen en esta base (según la versión pueden faltar algunas)
    $tablas = @(Invoke-Mysql "SELECT table_name FROM information_schema.tables WHERE table_schema = '$base'")
    $vaciar = 'comprobantes_fiscales', 'cierres_caja_metodos', 'cierres_caja', 'gastos', 'pago_historial',
        'debitos_automaticos', 'congelamientos', 'suscripciones', 'certificados_medicos', 'correcciones_turno',
        'turnos_personal', 'logs_asistencia', 'tareas_seguimiento', 'lista_espera', 'reservas_clases',
        'logs_entrenamiento', 'rutina_ejercicios', 'rutinas', 'mensajes', 'conversaciones', 'perfiles_socio',
        'perfiles_profesor', 'recuperaciones_password', 'notificaciones_enviadas'
    $quedan = "SELECT id_usuario FROM usuarios WHERE rol = 'ADMIN' AND email <> '$emailEncargadaDemo'"
    $sql = @('SET FOREIGN_KEY_CHECKS = 0')
    $sql += $vaciar | Where-Object { $tablas -contains $_ } | ForEach-Object { "TRUNCATE TABLE $_" }
    # Lo demás que es de cada usuario (sesiones, avisos...): se borra lo de los que se van
    $deUsuario = @(Invoke-Mysql ("SELECT table_name FROM information_schema.columns WHERE table_schema = '$base' " +
        "AND column_name = 'usuario_id' AND table_name <> 'usuarios'"))
    $sql += $deUsuario | Where-Object { $vaciar -notcontains $_ } | ForEach-Object { "DELETE FROM $_ WHERE usuario_id NOT IN ($quedan)" }
    if ($tablas -contains 'clases') {
        $sql += "UPDATE clases SET profesor_id = NULL WHERE profesor_id NOT IN ($quedan)"
    }
    $sql += "DELETE FROM usuarios WHERE rol <> 'ADMIN' OR email = '$emailEncargadaDemo'"
    $sql += 'SET FOREIGN_KEY_CHECKS = 1'
    Invoke-Mysql (($sql -join ";`n") + ';') | Out-Null
    Write-Host 'Socios, personal y movimientos borrados.' -ForegroundColor Green
}
finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

# 3. El backend carga la demo al arrancar y sigue andando
Write-Host ''
Write-Host "Arrancando el backend con la demo (puerto $Puerto). Cuando diga 'Datos de demostración cargados' ya está;"
Write-Host 'después sigue funcionando normal. Para cerrarlo: Ctrl + C.'
Write-Host ''
$env:DEMO = 'true'
$env:DEMO_SEMILLA = "$Semilla"
Push-Location $backend
try {
    & .\mvnw.cmd spring-boot:run "-Dspring-boot.run.arguments=--server.port=$Puerto"
}
finally {
    Pop-Location
    Remove-Item Env:DEMO, Env:DEMO_SEMILLA -ErrorAction SilentlyContinue
}
