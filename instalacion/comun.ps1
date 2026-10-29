# Funciones compartidas por los scripts de instalación y de copias de SUMMIT.
# No se ejecuta sola: los demás scripts la cargan con  . (Join-Path $PSScriptRoot 'comun.ps1')
# Está pensada para Windows PowerShell 5.1, el que viene con Windows 10 y 11.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$script:SummitVersionScripts = '1.0'
# "Sal" extra para el cifrado de Windows (DPAPI): otro programa no puede descifrar el archivo de secretos por casualidad
$script:SummitEntropia = [Text.Encoding]::UTF8.GetBytes('SUMMIT-secretos-copias-v1')
$script:SummitArchivoRegistro = $null
$script:SummitUtf8SinBom = New-Object System.Text.UTF8Encoding($false)

# Cuentas de Windows por su identificador fijo (los nombres cambian con el idioma: "Administradores", "Usuarios")
$script:SidSistema = 'S-1-5-18'
$script:SidAdministradores = 'S-1-5-32-544'
$script:SidUsuarios = 'S-1-5-32-545'

# ---------------------------------------------------------------------------------------------------------------
# Administrador
# ---------------------------------------------------------------------------------------------------------------

function Test-SummitAdministrador {
    $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
    return ([Security.Principal.WindowsPrincipal]$identidad).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-SummitAdministrador {
    param([string]$Para = 'esto')
    if (-not (Test-SummitAdministrador)) {
        throw "Para $Para hace falta PowerShell como administrador: clic derecho en Windows PowerShell > Ejecutar como administrador."
    }
}

# Vuelve a abrir el script como administrador (Windows pide permiso), con los mismos parámetros más -Pausa (para que
# la ventana nueva no se cierre sola al terminar). El script actual tiene que terminar después de llamarla.
function Start-SummitComoAdministrador {
    param([Parameter(Mandatory)][string]$Script, [Collections.IDictionary]$Parametros = @{})
    $lista = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (ConvertTo-SummitArgumento $Script))
    foreach ($clave in $Parametros.Keys) {
        $valor = $Parametros[$clave]
        if (@('Elevar', 'Pausa') -contains $clave) { continue }
        if ($valor -is [Management.Automation.SwitchParameter]) { if ($valor.IsPresent) { $lista += "-$clave" }; continue }
        if ($valor -is [string] -or $valor -is [int]) { $lista += @("-$clave", (ConvertTo-SummitArgumento ([string]$valor))) }
    }
    $lista += '-Pausa'
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($lista -join ' ') | Out-Null
}

# ---------------------------------------------------------------------------------------------------------------
# Configuración (C:\SUMMIT\config\summit.psd1)
# ---------------------------------------------------------------------------------------------------------------

function New-SummitConfigBase {
    param([string]$Raiz = 'C:\SUMMIT')
    return [ordered]@{
        Raiz                  = $Raiz
        MysqlBin              = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
        MysqlServidor         = '127.0.0.1'
        MysqlPuerto           = 3306
        MysqlServicio         = 'MySQL84'
        Base                  = 'summit_fitness_db'
        CarpetaUploads        = Join-Path $Raiz 'datos\uploads'
        CarpetaCopias         = Join-Path $Raiz 'copias'
        DiasRetencion         = 30
        CopiasMinimas         = 7
        DestinoExterno        = ''
        DiasRetencionExterno  = 30
        SieteZip              = 'C:\Program Files\7-Zip\7z.exe'
        ArchivoSecretos       = Join-Path $Raiz 'config\secretos-copias.dat'
        CarpetaRegistros      = Join-Path $Raiz 'logs'
        CarpetaRestauraciones = Join-Path $Raiz 'restauraciones'
        HorasAvisoCopia       = 30
        EspacioMinimoGB       = 5
        ServicioBackend       = 'SUMMIT-Backend'
        ServicioWeb           = 'SUMMIT-Web'
        UrlBackend            = 'http://127.0.0.1:8080'
        UrlWeb                = 'https://localhost'
        TareaCopia            = 'SUMMIT - Copia de seguridad'
        UrlOllama             = 'http://127.0.0.1:11434'
        ModeloIa              = 'gemma4:12b'
    }
}

function Get-SummitRutaConfig {
    param([string]$Ruta)
    if ($Ruta) { return $Ruta }
    if ($env:SUMMIT_CONFIG) { return $env:SUMMIT_CONFIG }
    # Instalada: C:\SUMMIT\scripts\comun.ps1 -> C:\SUMMIT\config\summit.psd1
    $junto = Join-Path (Split-Path $PSScriptRoot -Parent) 'config\summit.psd1'
    if (Test-Path -LiteralPath $junto) { return $junto }
    return 'C:\SUMMIT\config\summit.psd1'
}

# Lee summit.psd1 como UTF-8 (con o sin BOM: el Bloc de notas lo guarda sin BOM) y solo acepta datos fijos, igual que
# Import-PowerShellDataFile: el archivo no puede ejecutar nada.
function Read-SummitConfig {
    param([string]$Ruta, [switch]$Opcional)
    $Ruta = Get-SummitRutaConfig $Ruta
    if (-not (Test-Path -LiteralPath $Ruta)) {
        if ($Opcional) {
            $cfg = New-SummitConfigBase
            $cfg.RutaConfig = $null
            return $cfg
        }
        throw "No encontré la configuración de SUMMIT ($Ruta). Se crea con preparar-pc.ps1 (ver INSTALACION.md)."
    }
    $texto = [IO.File]::ReadAllText($Ruta, [Text.Encoding]::UTF8)
    $tokens = $null
    $errores = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput($texto, [ref]$tokens, [ref]$errores)
    if ($errores -and $errores.Count -gt 0) {
        throw "La configuración $Ruta tiene un error en la línea $($errores[0].Extent.StartLineNumber): $($errores[0].Message)"
    }
    $tabla = $ast.Find({ param($nodo) $nodo -is [Management.Automation.Language.HashtableAst] }, $false)
    if (-not $tabla) { throw "La configuración $Ruta no tiene el formato esperado: @{ Opcion = 'valor' ... }" }
    try {
        $datos = $tabla.SafeGetValue()
    } catch {
        throw "La configuración $Ruta solo puede tener textos entre comillas y números: $($_.Exception.Message)"
    }
    $raiz = 'C:\SUMMIT'
    if ($datos.ContainsKey('Raiz') -and $datos['Raiz']) { $raiz = [string]$datos['Raiz'] }
    $cfg = New-SummitConfigBase -Raiz $raiz
    foreach ($clave in $datos.Keys) {
        if (-not $cfg.Contains($clave)) {
            Write-Warning "La configuración tiene una opción que no conozco y no se usa: $clave"
            continue
        }
        $cfg[$clave] = $datos[$clave]
    }
    $cfg.RutaConfig = $Ruta
    return $cfg
}

function Assert-SummitNombreBase {
    param([string]$Nombre)
    if ($Nombre -notmatch '^[A-Za-z0-9_]{1,64}$') {
        throw "Nombre de base de datos inválido: '$Nombre' (solo letras sin acentos, números y _)."
    }
    if (@('mysql', 'sys', 'information_schema', 'performance_schema') -contains $Nombre.ToLowerInvariant()) {
        throw "La base '$Nombre' es del sistema de MySQL."
    }
}

# ---------------------------------------------------------------------------------------------------------------
# Permisos de archivos y carpetas
# ---------------------------------------------------------------------------------------------------------------

# Reglas para algo privado: Windows (SYSTEM) y administradores. Si la consola no es de administrador, también el
# usuario actual (si no, el propio script no podría leer lo que guardó). -UsuarioActual lo suma siempre (para
# archivos temporales que lee un programa que corre como este usuario).
function Get-SummitReglasPrivadas {
    param([switch]$UsuarioActual, [string[]]$Extra = @())
    $reglas = @(@($script:SidSistema, 'FullControl'), @($script:SidAdministradores, 'FullControl'))
    if ($UsuarioActual -or -not (Test-SummitAdministrador)) {
        $reglas += , @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'FullControl')
    }
    foreach ($cuenta in $Extra) { $reglas += , @($cuenta, 'Modify') }
    return , $reglas
}

# Reemplaza los permisos de un archivo o carpeta (sin heredar los de arriba). Cada regla: @(cuenta, permiso), donde la
# cuenta es un SID ('S-1-5-18') o un nombre ('NT SERVICE\SUMMIT-Backend') y el permiso FullControl, Modify,
# ReadAndExecute o Read. En una carpeta, las reglas valen también para todo lo que tiene adentro.
function Set-SummitAcl {
    param([Parameter(Mandatory)][string]$Ruta, [Parameter(Mandatory)][object[]]$Reglas)
    $esCarpeta = Test-Path -LiteralPath $Ruta -PathType Container
    if ($esCarpeta) { $acl = New-Object Security.AccessControl.DirectorySecurity } else { $acl = New-Object Security.AccessControl.FileSecurity }
    $acl.SetAccessRuleProtection($true, $false)
    $herencia = [Security.AccessControl.InheritanceFlags]'None'
    if ($esCarpeta) { $herencia = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' }
    foreach ($regla in $Reglas) {
        $cuenta = [string]$regla[0]
        if ($cuenta -match '^S-1-') {
            $id = New-Object Security.Principal.SecurityIdentifier($cuenta)
        } else {
            $id = (New-Object Security.Principal.NTAccount($cuenta)).Translate([Security.Principal.SecurityIdentifier])
        }
        $permiso = [Security.AccessControl.FileSystemRights]([string]$regla[1])
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($id, $permiso, $herencia, [Security.AccessControl.PropagationFlags]'None', [Security.AccessControl.AccessControlType]'Allow')))
    }
    if ($esCarpeta) { [IO.Directory]::SetAccessControl($Ruta, $acl) } else { [IO.File]::SetAccessControl($Ruta, $acl) }
}

function New-SummitCarpetaPrivada {
    param([Parameter(Mandatory)][string]$Ruta, [switch]$UsuarioActual)
    if (-not (Test-Path -LiteralPath $Ruta)) { New-Item -ItemType Directory -Path $Ruta -Force | Out-Null }
    Set-SummitAcl -Ruta $Ruta -Reglas (Get-SummitReglasPrivadas -UsuarioActual:$UsuarioActual)
}

# ---------------------------------------------------------------------------------------------------------------
# Secretos de las copias (usuario y contraseña de MySQL para copiar, y la clave de cifrado), protegidos con el
# cifrado de Windows (DPAPI, alcance "equipo") y con permisos solo para SYSTEM y los administradores. Copiado a otra
# PC, el archivo no sirve: por eso la clave de cifrado también tiene que estar anotada fuera de la PC.
# ---------------------------------------------------------------------------------------------------------------

function Read-SummitSecretos {
    param([Parameter(Mandatory)][string]$Ruta)
    if (-not (Test-Path -LiteralPath $Ruta)) { return @{} }
    try {
        $lineas = @([IO.File]::ReadAllLines($Ruta) | Where-Object { $_.Trim() })
    } catch [UnauthorizedAccessException] {
        throw "No tengo permiso para leer $Ruta. Abrí PowerShell como administrador."
    }
    if ($lineas.Count -lt 2 -or $lineas[0].Trim() -ne 'SUMMIT-SECRETOS-1') { throw "El archivo de secretos $Ruta no tiene el formato esperado." }
    $cifrado = [Convert]::FromBase64String((($lineas | Select-Object -Skip 1) -join ''))
    try {
        $claro = [Security.Cryptography.ProtectedData]::Unprotect($cifrado, $script:SummitEntropia, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    } catch {
        throw "No pude descifrar ${Ruta}: solo se puede leer en la PC donde se guardó. En otra PC, volvé a cargar las claves (guardar-clave-copias.ps1 y crear-usuarios-mysql.ps1)."
    }
    $json = [Text.Encoding]::UTF8.GetString($claro)
    [Array]::Clear($claro, 0, $claro.Length)
    $secretos = @{}
    foreach ($propiedad in ($json | ConvertFrom-Json).PSObject.Properties) { $secretos[$propiedad.Name] = [string]$propiedad.Value }
    return $secretos
}

function Save-SummitSecretos {
    param([Parameter(Mandatory)][string]$Ruta, [Parameter(Mandatory)][hashtable]$Secretos)
    $carpeta = Split-Path $Ruta -Parent
    if (-not (Test-Path -LiteralPath $carpeta)) { New-SummitCarpetaPrivada -Ruta $carpeta }
    $claro = [Text.Encoding]::UTF8.GetBytes(($Secretos | ConvertTo-Json -Compress))
    $cifrado = [Security.Cryptography.ProtectedData]::Protect($claro, $script:SummitEntropia, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    [Array]::Clear($claro, 0, $claro.Length)
    $texto = "SUMMIT-SECRETOS-1`r`n" + [Convert]::ToBase64String($cifrado, [Base64FormattingOptions]::InsertLineBreaks) + "`r`n"
    $temporal = "$Ruta.nuevo"
    [IO.File]::WriteAllText($temporal, '', $script:SummitUtf8SinBom)
    Set-SummitAcl -Ruta $temporal -Reglas (Get-SummitReglasPrivadas)
    [IO.File]::WriteAllText($temporal, $texto, $script:SummitUtf8SinBom)
    Move-Item -LiteralPath $temporal -Destination $Ruta -Force
    Set-SummitAcl -Ruta $Ruta -Reglas (Get-SummitReglasPrivadas)
}

function ConvertFrom-SummitClaveSegura {
    param([Parameter(Mandatory)][Security.SecureString]$Clave)
    $puntero = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Clave)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($puntero) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($puntero) }
}

# Clave al azar fácil de anotar a mano: grupos de 4 letras y números sin los que se confunden (0/O, 1/I/L).
function New-SummitClaveAnotable {
    param([int]$Grupos = 6)
    $alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    $generador = [Security.Cryptography.RandomNumberGenerator]::Create()
    $byte = New-Object byte[] 1
    # (Ojo: en PowerShell $lista y $Lista son la misma variable; por eso no se llama $grupos, como el parámetro)
    $lista = @()
    for ($g = 0; $g -lt $Grupos; $g++) {
        $grupo = ''
        while ($grupo.Length -lt 4) {
            $generador.GetBytes($byte)
            # Se descartan los valores que harían que unos caracteres salgan más que otros
            if ($byte[0] -lt (256 - (256 % $alfabeto.Length))) { $grupo += $alfabeto[$byte[0] % $alfabeto.Length] }
        }
        $lista += $grupo
    }
    return ($lista -join '-')
}

# Clave al azar para cuentas que no escribe una persona (usuarios de MySQL): letras y números, sin signos raros.
function New-SummitClaveInterna {
    param([int]$Largo = 32)
    $alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $generador = [Security.Cryptography.RandomNumberGenerator]::Create()
    $byte = New-Object byte[] 1
    $clave = ''
    while ($clave.Length -lt $Largo) {
        $generador.GetBytes($byte)
        if ($byte[0] -lt (256 - (256 % $alfabeto.Length))) { $clave += $alfabeto[$byte[0] % $alfabeto.Length] }
    }
    return $clave
}

function Test-SummitClaveCifrado {
    param([string]$Clave)
    if ([string]::IsNullOrEmpty($Clave)) { return 'está vacía' }
    if ($Clave.Length -lt 16) { return 'tiene que tener 16 caracteres o más' }
    if ($Clave -match '[^\x20-\x7E]') { return 'solo puede tener letras sin acentos, números, espacios y signos comunes (sin ñ ni acentos)' }
    if ($Clave -ne $Clave.Trim()) { return 'no puede empezar ni terminar con un espacio' }
    return $null
}

# ---------------------------------------------------------------------------------------------------------------
# Registro (log)
# ---------------------------------------------------------------------------------------------------------------

function Start-SummitRegistro {
    param([Parameter(Mandatory)][string]$Carpeta, [Parameter(Mandatory)][string]$Nombre)
    if (-not (Test-Path -LiteralPath $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null }
    $script:SummitArchivoRegistro = Join-Path $Carpeta $Nombre
    if ((Test-Path -LiteralPath $script:SummitArchivoRegistro) -and (Get-Item -LiteralPath $script:SummitArchivoRegistro).Length -gt 5MB) {
        Move-Item -LiteralPath $script:SummitArchivoRegistro -Destination "$($script:SummitArchivoRegistro).anterior" -Force
    }
}

function Write-SummitRegistro {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Mensaje, [ValidateSet('INFO', 'OK', 'AVISO', 'ERROR')][string]$Nivel = 'INFO')
    $linea = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Nivel, $Mensaje
    if ($script:SummitArchivoRegistro) {
        try { [IO.File]::AppendAllText($script:SummitArchivoRegistro, $linea + "`r`n", $script:SummitUtf8SinBom) } catch { }
    }
    $color = 'Gray'
    switch ($Nivel) { 'OK' { $color = 'Green' } 'AVISO' { $color = 'Yellow' } 'ERROR' { $color = 'Red' } }
    Write-Host $linea -ForegroundColor $color
}

# ---------------------------------------------------------------------------------------------------------------
# Programas externos (mysql, mysqldump, 7-Zip)
# ---------------------------------------------------------------------------------------------------------------

# Un argumento con las reglas de comillas de Windows (las que usan casi todos los programas de consola).
function ConvertTo-SummitArgumento {
    param([AllowEmptyString()][string]$Texto)
    if ($Texto.Length -gt 0 -and $Texto -notmatch '[\s"]') { return $Texto }
    $resultado = New-Object System.Text.StringBuilder
    [void]$resultado.Append('"')
    $barras = 0
    foreach ($caracter in $Texto.ToCharArray()) {
        if ($caracter -eq '\') { $barras++; continue }
        if ($caracter -eq '"') {
            [void]$resultado.Append('\' * ($barras * 2 + 1)).Append('"')
        } else {
            [void]$resultado.Append('\' * $barras).Append($caracter)
        }
        $barras = 0
    }
    [void]$resultado.Append('\' * ($barras * 2)).Append('"')
    return $resultado.ToString()
}

# Lo que se manda por la entrada estándar de otro programa tiene que llegar sin la marca invisible del comienzo
# (BOM). Windows PowerShell la agrega cuando la consola está en UTF-8, y 7-Zip la tomaría como parte de la clave: la
# copia quedaría con una clave distinta de la anotada. Devuelve la codificación anterior para restaurarla, o $null.
function Set-SummitEntradaSinBom {
    $anterior = [Console]::InputEncoding
    if ($anterior.GetPreamble().Length -eq 0) { return $null }
    try { [Console]::InputEncoding = $script:SummitUtf8SinBom } catch { }
    if ([Console]::InputEncoding.GetPreamble().Length -ne 0) { throw 'SUMMIT_ENTRADA_CON_BOM' }
    return $anterior
}

# Ejecuta un programa y devuelve su código de salida, lo que escribió y sus errores. -Entrada manda un texto (solo
# ASCII) y -ArchivoEntrada un archivo tal cual (por ejemplo, un volcado SQL para mysql).
function Invoke-SummitPrograma {
    param(
        [Parameter(Mandatory)][string]$Programa,
        [string[]]$Argumentos = @(),
        [string]$Entrada,
        [string]$ArchivoEntrada,
        [string]$Directorio,
        [int]$TiempoMaximoSegundos = 0
    )
    $usaEntrada = $PSBoundParameters.ContainsKey('Entrada') -or [bool]$ArchivoEntrada
    if ($PSBoundParameters.ContainsKey('Entrada') -and $Entrada -match '[^\x00-\x7F]') { throw 'La entrada para el programa solo puede tener caracteres ASCII.' }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $Programa
    $info.Arguments = (@($Argumentos | ForEach-Object { ConvertTo-SummitArgumento $_ })) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = $script:SummitUtf8SinBom
    $info.StandardErrorEncoding = $script:SummitUtf8SinBom
    $info.RedirectStandardInput = $usaEntrada
    if ($Directorio) { $info.WorkingDirectory = $Directorio }
    $anterior = $null
    if ($usaEntrada) { $anterior = Set-SummitEntradaSinBom }
    try {
        $proceso = [System.Diagnostics.Process]::Start($info)
    } finally {
        if ($anterior) { try { [Console]::InputEncoding = $anterior } catch { } }
    }
    $salida = $proceso.StandardOutput.ReadToEndAsync()
    $errores = $proceso.StandardError.ReadToEndAsync()
    if ($usaEntrada) {
        $destino = $proceso.StandardInput.BaseStream
        try {
            if ($ArchivoEntrada) {
                $origen = [IO.File]::OpenRead($ArchivoEntrada)
                try { $origen.CopyTo($destino, 1MB) } finally { $origen.Dispose() }
            } else {
                $bytes = [Text.Encoding]::ASCII.GetBytes($Entrada)
                $destino.Write($bytes, 0, $bytes.Length)
                [Array]::Clear($bytes, 0, $bytes.Length)
            }
            $destino.Flush()
        } catch [IO.IOException] {
            # El programa terminó antes de leer todo (por ejemplo, por un error): el motivo queda en sus errores
        } finally {
            try { $proceso.StandardInput.Close() } catch { }
        }
    }
    if ($TiempoMaximoSegundos -gt 0) {
        if (-not $proceso.WaitForExit($TiempoMaximoSegundos * 1000)) {
            try { $proceso.Kill() } catch { }
            throw "$([IO.Path]::GetFileName($Programa)) no terminó en $TiempoMaximoSegundos segundos y se cortó."
        }
    }
    $proceso.WaitForExit()
    return [pscustomobject]@{ Codigo = $proceso.ExitCode; Salida = $salida.Result; Errores = $errores.Result }
}

# Archivo temporal con el usuario y la contraseña para mysql/mysqldump (así no van en la línea de comandos, donde
# otros programas los podrían ver). Queda con permisos privados y hay que borrarlo al terminar (Remove-SummitArchivo).
function New-SummitOpcionesMysql {
    param(
        [Parameter(Mandatory)][string]$Carpeta,
        [Parameter(Mandatory)][string]$Usuario,
        [Parameter(Mandatory)][string]$Clave,
        [string]$Servidor = '127.0.0.1',
        [int]$Puerto = 3306
    )
    $entreComillas = { param($valor) '"' + (($valor -replace '\\', '\\') -replace '"', '\"') + '"' }
    $ruta = Join-Path $Carpeta ('mysql-' + [guid]::NewGuid().ToString('N') + '.cnf')
    [IO.File]::WriteAllText($ruta, '', $script:SummitUtf8SinBom)
    Set-SummitAcl -Ruta $ruta -Reglas (Get-SummitReglasPrivadas -UsuarioActual)
    $texto = "[client]`r`nuser=$(& $entreComillas $Usuario)`r`npassword=$(& $entreComillas $Clave)`r`nhost=$Servidor`r`nport=$Puerto`r`n"
    [IO.File]::WriteAllText($ruta, $texto, $script:SummitUtf8SinBom)
    return $ruta
}

function Remove-SummitArchivo {
    param([string]$Ruta)
    if ($Ruta -and (Test-Path -LiteralPath $Ruta)) {
        try {
            # Se pisa antes de borrar: es un archivo chico con una contraseña
            $largo = (Get-Item -LiteralPath $Ruta).Length
            [IO.File]::WriteAllBytes($Ruta, (New-Object byte[] $largo))
        } catch { }
        Remove-Item -LiteralPath $Ruta -Force -ErrorAction SilentlyContinue
    }
}

# -Sql va en la línea de comandos (consultas sin datos privados); -SqlPorEntrada va por la entrada estándar (por
# ejemplo, sentencias con contraseñas); -ArchivoEntrada manda un archivo .sql entero.
function Invoke-SummitMysql {
    param(
        [Parameter(Mandatory)][Collections.IDictionary]$Cfg,
        [Parameter(Mandatory)][string]$Opciones,
        [string]$Sql,
        [string]$SqlPorEntrada,
        [string]$Base,
        [string]$ArchivoEntrada,
        [int]$TiempoMaximoSegundos = 0
    )
    $argumentos = @("--defaults-file=$Opciones", '--default-character-set=utf8mb4', '--batch', '--skip-column-names')
    if ($Sql) { $argumentos += @('--execute', $Sql) }
    if ($Base) { $argumentos += $Base }
    $parametros = @{ Programa = (Join-Path $Cfg.MysqlBin 'mysql.exe'); Argumentos = $argumentos; TiempoMaximoSegundos = $TiempoMaximoSegundos }
    if ($ArchivoEntrada) { $parametros.ArchivoEntrada = $ArchivoEntrada }
    if ($SqlPorEntrada) { $parametros.Entrada = $SqlPorEntrada }
    $r = Invoke-SummitPrograma @parametros
    if ($r.Codigo -ne 0) {
        $detalle = ($r.Errores + ' ' + $r.Salida).Trim()
        throw "MySQL devolvió un error: $detalle"
    }
    return $r.Salida
}

function Get-SummitLineas {
    param([AllowEmptyString()][string]$Texto)
    return @($Texto -split "`r?`n" | Where-Object { $_ -ne '' })
}

function Get-SummitTablas {
    param([Collections.IDictionary]$Cfg, [string]$Opciones, [string]$Base)
    Assert-SummitNombreBase $Base
    $sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = '$Base' AND table_type = 'BASE TABLE' ORDER BY table_name"
    return @(Get-SummitLineas (Invoke-SummitMysql -Cfg $Cfg -Opciones $Opciones -Sql $sql))
}

function Test-SummitBaseExiste {
    param([Collections.IDictionary]$Cfg, [string]$Opciones, [string]$Base)
    Assert-SummitNombreBase $Base
    $sql = "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$Base'"
    return (@(Get-SummitLineas (Invoke-SummitMysql -Cfg $Cfg -Opciones $Opciones -Sql $sql))[0] -eq '1')
}

# Cantidad exacta de filas de cada tabla (COUNT(*), no el número aproximado de information_schema).
function Get-SummitConteos {
    param([Collections.IDictionary]$Cfg, [string]$Opciones, [string]$Base, [string[]]$Tablas)
    $resultado = [ordered]@{}
    if (-not $Tablas -or $Tablas.Count -eq 0) { return $resultado }
    $partes = foreach ($tabla in $Tablas) {
        'SELECT ''{0}'', COUNT(*) FROM `{1}`.`{2}`' -f ($tabla -replace "'", "''"), $Base, ($tabla -replace '`', '``')
    }
    foreach ($linea in (Get-SummitLineas (Invoke-SummitMysql -Cfg $Cfg -Opciones $Opciones -Sql ($partes -join ' UNION ALL ')))) {
        $columnas = $linea -split "`t"
        $resultado[$columnas[0]] = [long]$columnas[1]
    }
    return $resultado
}

# Huella del contenido de cada tabla (CHECKSUM TABLE). Sirve para comparar una base restaurada con la copia, en la
# misma versión de MySQL.
function Get-SummitChecksums {
    param([Collections.IDictionary]$Cfg, [string]$Opciones, [string]$Base, [string[]]$Tablas)
    $resultado = [ordered]@{}
    if (-not $Tablas -or $Tablas.Count -eq 0) { return $resultado }
    $lista = ($Tablas | ForEach-Object { '`{0}`.`{1}`' -f $Base, ($_ -replace '`', '``') }) -join ', '
    foreach ($linea in (Get-SummitLineas (Invoke-SummitMysql -Cfg $Cfg -Opciones $Opciones -Sql "CHECKSUM TABLE $lista"))) {
        $columnas = $linea -split "`t"
        $nombre = $columnas[0]
        if ($nombre.StartsWith("$Base.")) { $nombre = $nombre.Substring($Base.Length + 1) }
        $resultado[$nombre] = $columnas[1]
    }
    return $resultado
}

# ---------------------------------------------------------------------------------------------------------------
# 7-Zip
# ---------------------------------------------------------------------------------------------------------------

function Get-Summit7Zip {
    param([Collections.IDictionary]$Cfg)
    $candidatos = @($Cfg.SieteZip, 'C:\Program Files\7-Zip\7z.exe', 'C:\Program Files (x86)\7-Zip\7z.exe') | Where-Object { $_ }
    foreach ($ruta in $candidatos) { if (Test-Path -LiteralPath $ruta) { return $ruta } }
    throw "No encontré 7-Zip. Instalalo con:  winget install --id 7zip.7zip -e   (o desde https://www.7-zip.org)"
}

# Ejecuta 7-Zip pasándole la clave por la entrada estándar: así no queda escrita en la línea de comandos. Para crear
# una copia, $Argumentos lleva "-p" sin valor (7-Zip pide la clave); para abrirla, no lleva -p (7-Zip la pide sola al
# ver que está cifrada). Si Windows no deja mandar la clave así, se pasa con -p como último recurso.
function Invoke-Summit7Zip {
    param(
        [Parameter(Mandatory)][string]$SieteZip,
        [Parameter(Mandatory)][string[]]$Argumentos,
        [Parameter(Mandatory)][string]$Clave,
        [string]$Directorio
    )
    $completos = @($Argumentos[0], '-sccUTF-8', '-bd', '-y') + @($Argumentos | Select-Object -Skip 1)
    try {
        return Invoke-SummitPrograma -Programa $SieteZip -Argumentos $completos -Entrada ($Clave + "`n") -Directorio $Directorio
    } catch {
        if ($_.Exception.Message -ne 'SUMMIT_ENTRADA_CON_BOM') { throw }
        Write-SummitRegistro 'No se pudo pasar la clave a 7-Zip por la entrada estándar: se pasa en la línea de comandos.' 'AVISO'
        $conClave = @($completos | Where-Object { $_ -ne '-p' }) + @("-p$Clave")
        return Invoke-SummitPrograma -Programa $SieteZip -Argumentos $conClave -Directorio $Directorio
    }
}

function Get-SummitMensaje7Zip {
    param($Resultado)
    $texto = ($Resultado.Errores + "`n" + $Resultado.Salida)
    if ($texto -match 'Wrong password') { return 'la clave de cifrado no es la correcta' }
    $lineas = @(Get-SummitLineas $texto | Where-Object { $_ -match 'ERROR|WARNING|Cannot|Can not|No files' } | ForEach-Object { $_.Trim() })
    if ($lineas.Count -gt 0) { return ($lineas | Select-Object -First 5) -join ' | ' }
    return "7-Zip terminó con el código $($Resultado.Codigo)"
}

# ---------------------------------------------------------------------------------------------------------------
# Varios
# ---------------------------------------------------------------------------------------------------------------

function Format-SummitTamano {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N1} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N0} KB' -f ($Bytes / 1KB)) }
    return ('{0:N0} bytes' -f $Bytes)
}

function Get-SummitEspacioLibre {
    param([string]$Ruta)
    $raiz = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Ruta))
    if (-not $raiz -or -not (Test-Path -LiteralPath $raiz)) { return $null }
    try { return (New-Object IO.DriveInfo($raiz)).AvailableFreeSpace } catch { return $null }
}

# Fecha de una copia según su nombre: summit-copia-2026-10-25_2300.7z, con segundos si hubo dos en el mismo minuto
# (..._230015.7z) y quizás con una etiqueta (..._2300-antes-de-actualizar.7z)
function Get-SummitFechaCopia {
    param([string]$Nombre)
    if ($Nombre -match '^summit-copia-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})?(?:-[a-z0-9-]+)?\.7z$') {
        $segundos = 0
        if ($Matches[6]) { $segundos = [int]$Matches[6] }
        try { return [datetime]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3], [int]$Matches[4], [int]$Matches[5], $segundos) } catch { return $null }
    }
    return $null
}

function Get-SummitCopias {
    param([string]$Carpeta)
    if (-not $Carpeta -or -not (Test-Path -LiteralPath $Carpeta)) { return @() }
    $copias = foreach ($archivo in (Get-ChildItem -LiteralPath $Carpeta -Filter 'summit-copia-*.7z' -File -ErrorAction SilentlyContinue)) {
        $fecha = Get-SummitFechaCopia $archivo.Name
        if ($fecha) { [pscustomobject]@{ Archivo = $archivo; Fecha = $fecha } }
    }
    return @($copias | Sort-Object Fecha -Descending)
}

function Get-SummitHash {
    param([string]$Ruta)
    return (Get-FileHash -LiteralPath $Ruta -Algorithm SHA256).Hash.ToLowerInvariant()
}

# Un volcado de mysqldump completo termina con la línea "-- Dump completed on ...": si falta, se cortó a la mitad.
function Test-SummitVolcadoCompleto {
    param([string]$Ruta)
    $archivo = [IO.File]::OpenRead($Ruta)
    try {
        $largo = [Math]::Min([long]400, $archivo.Length)
        if ($largo -le 0) { return $false }
        [void]$archivo.Seek(-$largo, [IO.SeekOrigin]::End)
        $bytes = New-Object byte[] $largo
        [void]$archivo.Read($bytes, 0, $largo)
        return ([Text.Encoding]::ASCII.GetString($bytes) -match '-- Dump completed')
    } finally {
        $archivo.Dispose()
    }
}

# ---------------------------------------------------------------------------------------------------------------
# Configuración privada del backend (app\config\application.properties)
# ---------------------------------------------------------------------------------------------------------------

function Get-SummitPropiedad {
    param([Parameter(Mandatory)][string]$Ruta, [Parameter(Mandatory)][string]$Nombre)
    if (-not (Test-Path -LiteralPath $Ruta)) { return $null }
    foreach ($linea in [IO.File]::ReadAllLines($Ruta, [Text.Encoding]::UTF8)) {
        if ($linea -match ('^\s*' + [regex]::Escape($Nombre) + '\s*[=:]\s*(.*)$')) { return $Matches[1].Trim() }
    }
    return $null
}

# Cambia (o agrega al final) la línea "Nombre=valor" sin tocar el resto del archivo. Se guarda en UTF-8 sin BOM: con
# BOM, Spring Boot tomaría la marca como parte de la primera línea.
function Set-SummitPropiedad {
    param([Parameter(Mandatory)][string]$Ruta, [Parameter(Mandatory)][string]$Nombre, [Parameter(Mandatory)][AllowEmptyString()][string]$Valor)
    $lineas = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $Ruta) { $lineas.AddRange([string[]][IO.File]::ReadAllLines($Ruta, [Text.Encoding]::UTF8)) }
    $patron = '^\s*' + [regex]::Escape($Nombre) + '\s*[=:]'
    $cambiada = $false
    for ($i = 0; $i -lt $lineas.Count; $i++) {
        if ($lineas[$i] -match $patron) { $lineas[$i] = "$Nombre=$Valor"; $cambiada = $true; break }
    }
    if (-not $cambiada) { $lineas.Add("$Nombre=$Valor") }
    [IO.File]::WriteAllText($Ruta, (($lineas -join "`r`n") + "`r`n"), $script:SummitUtf8SinBom)
}

# Crea application.properties desde la plantilla si no existe, con una clave de sesiones al azar y una contraseña
# inicial para el admin. Devuelve la contraseña del admin si la acaba de generar (para mostrarla una vez).
function Initialize-SummitConfigApp {
    param([Parameter(Mandatory)][string]$Ruta, [Parameter(Mandatory)][string]$Raiz)
    $adminNueva = $null
    $carpeta = Split-Path $Ruta -Parent
    if (-not (Test-Path -LiteralPath $carpeta)) { New-SummitCarpetaPrivada -Ruta $carpeta }
    if (-not (Test-Path -LiteralPath $Ruta)) {
        $plantilla = Join-Path $PSScriptRoot 'plantillas\application.properties'
        if (-not (Test-Path -LiteralPath $plantilla)) { throw "No encontré la plantilla $plantilla." }
        $texto = [IO.File]::ReadAllText($plantilla, [Text.Encoding]::UTF8)
        $raizBarras = $Raiz.TrimEnd('\').Replace('\', '/')
        $texto = $texto.Replace('C:/SUMMIT', $raizBarras)
        [IO.File]::WriteAllText($Ruta, '', $script:SummitUtf8SinBom)
        Set-SummitAcl -Ruta $Ruta -Reglas (Get-SummitReglasPrivadas)
        [IO.File]::WriteAllText($Ruta, $texto, $script:SummitUtf8SinBom)
    }
    if (-not (Get-SummitPropiedad -Ruta $Ruta -Nombre 'JWT_SECRET')) {
        $bytes = New-Object byte[] 64
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        Set-SummitPropiedad -Ruta $Ruta -Nombre 'JWT_SECRET' -Valor ([Convert]::ToBase64String($bytes))
    }
    if (-not (Get-SummitPropiedad -Ruta $Ruta -Nombre 'ADMIN_PASSWORD')) {
        $adminNueva = New-SummitClaveInterna -Largo 12
        Set-SummitPropiedad -Ruta $Ruta -Nombre 'ADMIN_PASSWORD' -Valor $adminNueva
    }
    return $adminNueva
}

# ---------------------------------------------------------------------------------------------------------------
# Programas de la PC (Java) y versiones de SUMMIT
# ---------------------------------------------------------------------------------------------------------------

# Toma el PATH y JAVA_HOME guardados en Windows: una ventana abierta antes de instalar algo con winget no los ve.
function Update-SummitEntorno {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $env:JAVA_HOME) {
        $javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
        if (-not $javaHome) { $javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User') }
        if ($javaHome) { $env:JAVA_HOME = $javaHome }
    }
}

# java.exe de Java 21 o más nuevo (primero el de JAVA_HOME, después el del PATH).
function Get-SummitJava {
    param([string]$Ruta)
    $candidatos = @()
    if ($Ruta) { $candidatos += $Ruta }
    foreach ($ambito in 'Process', 'Machine', 'User') {
        $javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', $ambito)
        if ($javaHome) { $candidatos += (Join-Path $javaHome 'bin\java.exe') }
    }
    $comando = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($comando) { $candidatos += $comando.Source }
    foreach ($candidato in ($candidatos | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidato)) { continue }
        $r = Invoke-SummitPrograma -Programa $candidato -Argumentos @('-version')
        if (($r.Errores + $r.Salida) -match 'version "(\d+)' -and [int]$Matches[1] -ge 21) { return (Resolve-Path -LiteralPath $candidato).ProviderPath }
    }
    throw 'No encontré Java 21 o más nuevo. Instalalo con:  winget install --id EclipseAdoptium.Temurin.21.JDK -e   (y abrí otra ventana de PowerShell).'
}

# Copia el frontend compilado a la carpeta que muestra Caddy. Los archivos de /assets de la versión anterior quedan
# unos días: una pestaña que quedó abierta desde antes de actualizar todavía los puede pedir.
function Copy-SummitWeb {
    param([Parameter(Mandatory)][string]$Origen, [Parameter(Mandatory)][string]$Destino, [int]$DiasAssetsViejos = 30)
    $Origen = (Resolve-Path -LiteralPath $Origen).ProviderPath.TrimEnd('\')
    if (-not (Test-Path -LiteralPath (Join-Path $Origen 'index.html'))) { throw "No hay un frontend compilado en $Origen." }
    if (-not (Test-Path -LiteralPath $Destino)) { New-Item -ItemType Directory -Path $Destino -Force | Out-Null }
    $Destino = (Resolve-Path -LiteralPath $Destino).ProviderPath.TrimEnd('\')
    $r = Invoke-SummitPrograma -Programa 'robocopy.exe' -Argumentos @($Origen, $Destino, '/E', '/R:2', '/W:2', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    if ($r.Codigo -ge 8) { throw "robocopy no pudo copiar el frontend (código $($r.Codigo)): $($r.Salida.Trim())" }
    $nuevos = @{}
    foreach ($archivo in (Get-ChildItem -LiteralPath $Origen -Recurse -File)) { $nuevos[$archivo.FullName.Substring($Origen.Length + 1).ToLowerInvariant()] = $true }
    $limite = (Get-Date).AddDays(-$DiasAssetsViejos)
    foreach ($archivo in (Get-ChildItem -LiteralPath $Destino -Recurse -File)) {
        $relativo = $archivo.FullName.Substring($Destino.Length + 1).ToLowerInvariant()
        if ($nuevos.ContainsKey($relativo)) { continue }
        if ($relativo.StartsWith('assets\') -and $archivo.LastWriteTime -gt $limite) { continue }
        Remove-Item -LiteralPath $archivo.FullName -Force
    }
}

# ¿Responde una dirección? Cualquier respuesta HTTP (también 401 o 404) quiere decir que el programa está andando.
# IPv4 de esta PC en la red (sin la de loopback ni la que Windows se pone sola cuando no hay red)
function Get-SummitIps {
    return @([Net.Dns]::GetHostAddresses($env:COMPUTERNAME) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not $_.ToString().StartsWith('127.') -and -not $_.ToString().StartsWith('169.254.') } | ForEach-Object { $_.ToString() })
}

function Get-SummitRespuestaHttp {
    param([Parameter(Mandatory)][string]$Url, [int]$Segundos = 5)
    # Caddy pide TLS 1.2 o más nuevo: en Windows PowerShell 5.1 hay que habilitarlo por si la PC no lo tiene por defecto
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $Segundos -MaximumRedirection 0
        return [pscustomobject]@{ Responde = $true; Estado = [int]$r.StatusCode; Contenido = [string]$r.Content; Encabezados = $r.Headers; Error = $null }
    } catch [System.Net.WebException] {
        $respuesta = $_.Exception.Response
        if ($respuesta) { return [pscustomobject]@{ Responde = $true; Estado = [int]$respuesta.StatusCode; Contenido = ''; Encabezados = $respuesta.Headers; Error = $null } }
        return [pscustomobject]@{ Responde = $false; Estado = $null; Contenido = ''; Encabezados = $null; Error = $_.Exception.Message }
    } catch {
        return [pscustomobject]@{ Responde = $false; Estado = $null; Contenido = ''; Encabezados = $null; Error = $_.Exception.Message }
    }
}

function Write-SummitJson {
    param([Parameter(Mandatory)][string]$Ruta, [Parameter(Mandatory)]$Objeto)
    [IO.File]::WriteAllText($Ruta, ($Objeto | ConvertTo-Json -Depth 8), $script:SummitUtf8SinBom)
}

function Read-SummitJson {
    param([Parameter(Mandatory)][string]$Ruta)
    return ([IO.File]::ReadAllText($Ruta, [Text.Encoding]::UTF8) | ConvertFrom-Json)
}
