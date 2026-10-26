<#
.SYNOPSIS
    Crea la base de SUMMIT y dos usuarios de MySQL con permisos mínimos: uno para la aplicación y otro para las copias.

.DESCRIPTION
    En producción no se usa root. Este script (que sí pide la contraseña de root, una sola vez y sin guardarla):
      - crea la base summit_fitness_db si no existe (utf8mb4);
      - crea o actualiza summit_app@localhost: puede leer y escribir datos y crear o modificar tablas (lo necesita
        Hibernate, que actualiza las tablas al arrancar una versión nueva), solo en esa base. No puede borrar la base,
        ni ver otras, ni crear usuarios;
      - crea o actualiza summit_copias@localhost: solo puede leer (lo justo para mysqldump);
      - genera contraseñas largas al azar. La de summit_app se escribe en app\config\application.properties (DB_USERNAME
        y DB_PASSWORD) y la de summit_copias en config\secretos-copias.dat (cifrado por Windows). Nadie necesita
        conocerlas: si hiciera falta cambiarlas, se vuelve a correr este script.
    Se puede correr de nuevo sin problema: cambia las contraseñas y deja los permisos como corresponde.

.PARAMETER Solo
    App o Copias para crear o actualizar uno solo de los usuarios (por defecto, los dos).

.PARAMETER MostrarClaves
    Muestra las contraseñas en pantalla además de guardarlas (por ejemplo, para configurar algo a mano).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File C:\SUMMIT\scripts\crear-usuarios-mysql.ps1
#>
[CmdletBinding()]
param(
    [string]$Config,
    [ValidatePattern('^[A-Za-z0-9_]{1,32}$')][string]$UsuarioApp = 'summit_app',
    [ValidatePattern('^[A-Za-z0-9_]{1,32}$')][string]$UsuarioCopias = 'summit_copias',
    [ValidateSet('Ambos', 'App', 'Copias')][string]$Solo = 'Ambos',
    # application.properties privado del backend (por defecto, Raiz\app\config\application.properties)
    [string]$ArchivoConfigApp,
    [switch]$MostrarClaves,
    # Usuario administrador de MySQL (root). Si no se da, se pide.
    [Management.Automation.PSCredential]$CredencialAdmin
)

. (Join-Path $PSScriptRoot 'comun.ps1')

$codigo = 1
$trabajo = $null
$opciones = $null
try {
    $cfg = Read-SummitConfig -Ruta $Config
    Assert-SummitNombreBase $cfg.Base
    if (-not $ArchivoConfigApp) { $ArchivoConfigApp = Join-Path $cfg.Raiz 'app\config\application.properties' }
    if (-not (Test-SummitAdministrador)) {
        Write-Host 'Aviso: PowerShell no está como administrador. Los archivos con claves quedan accesibles también para tu usuario.' -ForegroundColor Yellow
    }
    $mysql = Join-Path $cfg.MysqlBin 'mysql.exe'
    if (-not (Test-Path -LiteralPath $mysql)) { throw "No encontré mysql.exe en $($cfg.MysqlBin) (revisá MysqlBin en $($cfg.RutaConfig))." }

    if (-not $CredencialAdmin) {
        Write-Host ''
        Write-Host 'Hace falta el usuario administrador de MySQL (el que elegiste al instalarlo). No se guarda en ningún lado.'
        $usuario = Read-Host 'Usuario administrador de MySQL [root]'
        if (-not $usuario) { $usuario = 'root' }
        $claveSegura = Read-Host "Contraseña de $usuario" -AsSecureString
        $CredencialAdmin = New-Object Management.Automation.PSCredential($usuario, $claveSegura)
    }
    $claveAdmin = ConvertFrom-SummitClaveSegura $CredencialAdmin.Password

    $trabajo = Join-Path ([IO.Path]::GetTempPath()) ('summit-usuarios-' + [guid]::NewGuid().ToString('N'))
    New-SummitCarpetaPrivada -Ruta $trabajo -UsuarioActual
    $opciones = New-SummitOpcionesMysql -Carpeta $trabajo -Usuario $CredencialAdmin.UserName -Clave $claveAdmin -Servidor $cfg.MysqlServidor -Puerto $cfg.MysqlPuerto
    $claveAdmin = $null

    $quien = @(Get-SummitLineas (Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -Sql 'SELECT CURRENT_USER(), VERSION()'))[0] -split "`t"
    Write-Host "Conectado a MySQL $($quien[1]) como $($quien[0])."

    $base = $cfg.Base
    $sentencias = New-Object System.Collections.Generic.List[string]
    $sentencias.Add("CREATE DATABASE IF NOT EXISTS ``$base`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;")
    $claveApp = $null
    $claveCopias = $null
    if ($Solo -ne 'Copias') {
        $claveApp = New-SummitClaveInterna -Largo 32
        $sentencias.Add("CREATE USER IF NOT EXISTS '$UsuarioApp'@'localhost' IDENTIFIED BY '$claveApp';")
        $sentencias.Add("ALTER USER '$UsuarioApp'@'localhost' IDENTIFIED BY '$claveApp';")
        # Datos (SELECT, INSERT, UPDATE, DELETE) y estructura que crea o amplía Hibernate al arrancar (CREATE, ALTER,
        # INDEX, REFERENCES). Sin DROP: la aplicación no puede borrar tablas ni la base
        $sentencias.Add("GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON ``$base``.* TO '$UsuarioApp'@'localhost';")
    }
    if ($Solo -ne 'App') {
        $claveCopias = New-SummitClaveInterna -Largo 32
        $sentencias.Add("CREATE USER IF NOT EXISTS '$UsuarioCopias'@'localhost' IDENTIFIED BY '$claveCopias';")
        $sentencias.Add("ALTER USER '$UsuarioCopias'@'localhost' IDENTIFIED BY '$claveCopias';")
        # Solo lectura: lo que usa mysqldump --single-transaction --routines --events --triggers --no-tablespaces
        $sentencias.Add("GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON ``$base``.* TO '$UsuarioCopias'@'localhost';")
        $sentencias.Add("GRANT SHOW_ROUTINE ON *.* TO '$UsuarioCopias'@'localhost';")
    }
    # Por la entrada estándar: las contraseñas nuevas no quedan en la línea de comandos
    [void](Invoke-SummitMysql -Cfg $cfg -Opciones $opciones -SqlPorEntrada (($sentencias -join "`n") + "`n"))
    Write-Host "Base $base lista." -ForegroundColor Green

    if ($claveApp) {
        $adminNueva = Initialize-SummitConfigApp -Ruta $ArchivoConfigApp -Raiz $cfg.Raiz
        Set-SummitPropiedad -Ruta $ArchivoConfigApp -Nombre 'DB_USERNAME' -Valor $UsuarioApp
        Set-SummitPropiedad -Ruta $ArchivoConfigApp -Nombre 'DB_PASSWORD' -Valor $claveApp
        Write-Host "Usuario $UsuarioApp listo; su contraseña quedó en $ArchivoConfigApp." -ForegroundColor Green
        if ($adminNueva) { Write-Host "Se creó $ArchivoConfigApp con una contraseña inicial para el admin: $adminNueva (la vas a cambiar al entrar)." -ForegroundColor Yellow }
        Write-Host 'Si el backend ya estaba funcionando, reinicialo para que use el usuario nuevo (services.msc > SUMMIT-Backend > Reiniciar).'
    }
    if ($claveCopias) {
        $secretos = Read-SummitSecretos $cfg.ArchivoSecretos
        $secretos['MysqlUsuario'] = $UsuarioCopias
        $secretos['MysqlClave'] = $claveCopias
        Save-SummitSecretos -Ruta $cfg.ArchivoSecretos -Secretos $secretos
        Write-Host "Usuario $UsuarioCopias listo; su contraseña quedó cifrada en $($cfg.ArchivoSecretos)." -ForegroundColor Green
    }
    if ($MostrarClaves) {
        if ($claveApp) { Write-Host "  $UsuarioApp : $claveApp" }
        if ($claveCopias) { Write-Host "  $UsuarioCopias : $claveCopias" }
    }
    $codigo = 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
} finally {
    Remove-SummitArchivo $opciones
    if ($trabajo -and (Test-Path -LiteralPath $trabajo)) { Remove-Item -LiteralPath $trabajo -Recurse -Force -ErrorAction SilentlyContinue }
}
exit $codigo
