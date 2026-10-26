<#
.SYNOPSIS
    Guarda la clave con la que se cifran las copias de seguridad de SUMMIT.

.DESCRIPTION
    Por defecto genera una clave al azar fácil de anotar (6 grupos de 4 letras y números, por ejemplo
    K7QF-M2XR-9TWA-...), la muestra UNA vez y pide escribirla de nuevo para confirmar que quedó anotada.
    Queda guardada en config\secretos-copias.dat, cifrada por Windows: la copia diaria la usa sola.

    MUY IMPORTANTE: anotala en papel y guardala FUERA de la PC (en un sobre cerrado en la casa del dueño, o en un
    gestor de contraseñas). Si la PC se rompe o se la roban, el archivo cifrado se pierde con ella, y sin la clave
    ninguna copia se puede abrir: ni vos, ni nadie.

.PARAMETER Escribir
    Elegir la clave a mano (16 caracteres o más, sin ñ ni acentos) en lugar de generarla.

.PARAMETER Cambiar
    Reemplazar una clave ya guardada. Las copias que ya existen siguen abriéndose con la clave anterior.

.PARAMETER Mostrar
    Muestra la clave guardada, para volver a anotarla (solo como administrador).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File C:\SUMMIT\scripts\guardar-clave-copias.ps1
#>
[CmdletBinding()]
param(
    [string]$Config,
    [switch]$Escribir,
    [switch]$Cambiar,
    [switch]$Mostrar,
    # Para automatizar (pruebas): la clave ya dada, sin preguntas
    [Security.SecureString]$ClaveSegura
)

. (Join-Path $PSScriptRoot 'comun.ps1')

$codigo = 1
try {
    $cfg = Read-SummitConfig -Ruta $Config
    if (-not (Test-SummitAdministrador)) {
        Write-Host 'Aviso: PowerShell no está como administrador. El archivo de claves queda accesible también para tu usuario.' -ForegroundColor Yellow
    }
    $secretos = Read-SummitSecretos $cfg.ArchivoSecretos
    $anterior = $secretos['ClaveCifrado']

    if ($Mostrar) {
        if (-not $anterior) { throw 'Todavía no hay una clave guardada.' }
        Write-Host ''
        Write-Host '  Clave de las copias de SUMMIT:' -ForegroundColor Yellow
        Write-Host "      $anterior" -ForegroundColor White
        Write-Host ''
        Write-Host '  Anotala y guardala fuera de la PC. Cerrá esta ventana cuando termines.'
        exit 0
    }

    if ($anterior -and -not $Cambiar) {
        Write-Host 'Ya hay una clave de cifrado guardada. Para verla: -Mostrar. Para reemplazarla: -Cambiar.' -ForegroundColor Yellow
        exit 0
    }
    if ($anterior) {
        Write-Host 'Vas a cambiar la clave. Las copias que YA existen se siguen abriendo con la clave ANTERIOR: no tires esa anotación' -ForegroundColor Yellow
        Write-Host 'hasta que se borren todas las copias viejas (en la PC y en el destino externo).' -ForegroundColor Yellow
    }

    if ($ClaveSegura) {
        $clave = ConvertFrom-SummitClaveSegura $ClaveSegura
        $problema = Test-SummitClaveCifrado $clave
        if ($problema) { throw "La clave $problema." }
    } elseif ($Escribir) {
        while ($true) {
            $clave = ConvertFrom-SummitClaveSegura (Read-Host 'Escribí la clave nueva (16 caracteres o más, sin ñ ni acentos)' -AsSecureString)
            $problema = Test-SummitClaveCifrado $clave
            if ($problema) { Write-Host "La clave $problema. Probá de nuevo." -ForegroundColor Yellow; continue }
            $repetida = ConvertFrom-SummitClaveSegura (Read-Host 'Escribila otra vez' -AsSecureString)
            if ($repetida -cne $clave) { Write-Host 'No coinciden. Probá de nuevo.' -ForegroundColor Yellow; continue }
            break
        }
    } else {
        $clave = New-SummitClaveAnotable
        Write-Host ''
        Write-Host '  Clave de las copias de SUMMIT (anotala tal cual, con los guiones y en mayúsculas):' -ForegroundColor Yellow
        Write-Host ''
        Write-Host "      $clave" -ForegroundColor White
        Write-Host ''
        Write-Host '  Guardá el papel FUERA de esta PC. Sin esta clave, ninguna copia se puede abrir.' -ForegroundColor Yellow
        Write-Host ''
        while ($true) {
            $repetida = (Read-Host 'Para confirmar que la anotaste, escribila acá').Trim()
            if ($repetida -ceq $clave) { break }
            if ($repetida -ieq $clave) { Write-Host 'Casi: va toda en MAYÚSCULAS, como aparece arriba.' -ForegroundColor Yellow; continue }
            Write-Host 'No coincide. Revisá lo que anotaste (0 y O, 1 e I no se usan: no hay forma de confundirlas).' -ForegroundColor Yellow
        }
        Clear-Host
    }

    $secretos['ClaveCifrado'] = $clave
    Save-SummitSecretos -Ruta $cfg.ArchivoSecretos -Secretos $secretos
    Write-Host "Clave guardada (cifrada por Windows) en $($cfg.ArchivoSecretos)." -ForegroundColor Green
    Write-Host 'Recordá: el papel con la clave va fuera de la PC. La próxima copia ya la usa.'
    $codigo = 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
}
exit $codigo
