<#
.SYNOPSIS
    Programa (o quita) la copia de seguridad diaria de SUMMIT en el Programador de tareas de Windows.

.DESCRIPTION
    Crea la tarea \SUMMIT\"SUMMIT - Copia de seguridad", que corre copia-de-seguridad.ps1 todos los días a la hora
    indicada (por defecto, 23:00) como SYSTEM: no hace falta que haya alguien con la sesión iniciada. Si a esa hora la
    PC estaba apagada, la copia se hace apenas se prende; si estaba suspendida, la despierta.

    Para verla: Programador de tareas (Win + R, taskschd.msc) > Biblioteca > SUMMIT.

.PARAMETER Hora
    Hora de la copia, en formato 24 h (por ejemplo 23:00 o 13:30).

.PARAMETER Quitar
    Borra la tarea (las copias ya hechas no se tocan).

.PARAMETER ProbarAhora
    Corre la tarea en este momento y muestra el resultado. Si la tarea ya existe y no se indica -Hora, no la cambia.

.PARAMETER ComoUsuarioActual
    La tarea corre con tu usuario en lugar de SYSTEM (no necesita administrador, pero solo funciona con tu sesión
    iniciada y tu usuario tiene que poder leer el archivo de secretos). Pensado para pruebas.

.EXAMPLE
    programar-copia.ps1 -Hora 23:00 -ProbarAhora
#>
[CmdletBinding()]
param(
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$Hora = '23:00',
    [switch]$Quitar,
    [switch]$ProbarAhora,
    [switch]$ComoUsuarioActual,
    [string]$Config
)

. (Join-Path $PSScriptRoot 'comun.ps1')

$codigo = 1
try {
    $cfg = Read-SummitConfig -Ruta $Config
    $carpeta = '\SUMMIT\'
    $nombre = $cfg.TareaCopia
    $existente = Get-ScheduledTask -TaskPath $carpeta -TaskName $nombre -ErrorAction SilentlyContinue

    if ($Quitar) {
        if (-not $existente) {
            Write-Host "No hay ninguna tarea $carpeta$nombre para quitar."
        } else {
            if ($existente.Principal.UserId -match 'SYSTEM') { Assert-SummitAdministrador -Para 'quitar la tarea de SYSTEM' }
            Unregister-ScheduledTask -TaskPath $carpeta -TaskName $nombre -Confirm:$false
            # Si la carpeta SUMMIT del Programador de tareas quedó vacía, también se borra
            try {
                $programador = New-Object -ComObject Schedule.Service
                $programador.Connect()
                if ($programador.GetFolder('\SUMMIT').GetTasks(1).Count -eq 0) { $programador.GetFolder('\').DeleteFolder('SUMMIT', 0) }
            } catch { }
            Write-Host "Tarea $carpeta$nombre quitada. Las copias ya hechas siguen en $($cfg.CarpetaCopias)." -ForegroundColor Green
        }
        exit 0
    }

    $registrar = -not ($ProbarAhora -and $existente -and -not $PSBoundParameters.ContainsKey('Hora'))
    if ($registrar) {
        if (-not $ComoUsuarioActual) { Assert-SummitAdministrador -Para 'programar la copia como SYSTEM' }
        $script = Join-Path $PSScriptRoot 'copia-de-seguridad.ps1'
        $argumentos = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $script
        if ($cfg.RutaConfig) { $argumentos += ' -Config "{0}"' -f $cfg.RutaConfig }
        $accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos -WorkingDirectory $PSScriptRoot
        $disparador = New-ScheduledTaskTrigger -Daily -At $Hora
        # Si estaba apagada a la hora de la copia, la hace al prender; despierta a la PC suspendida; nunca dos a la vez
        $ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
        if ($ComoUsuarioActual) {
            $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
        } else {
            $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        }
        $tarea = New-ScheduledTask -Action $accion -Trigger $disparador -Settings $ajustes -Principal $principal `
            -Description 'Copia de seguridad cifrada de SUMMIT (base de datos y archivos subidos). Ver C:\SUMMIT\logs\copias.log.'
        Register-ScheduledTask -TaskPath $carpeta -TaskName $nombre -InputObject $tarea -Force | Out-Null
        $quien = 'SYSTEM'
        if ($ComoUsuarioActual) { $quien = [Security.Principal.WindowsIdentity]::GetCurrent().Name }
        Write-Host "Copia programada todos los días a las $Hora (tarea $carpeta$nombre, corre como $quien)." -ForegroundColor Green
    }

    if ($ProbarAhora) {
        Write-Host 'Corriendo la copia ahora (puede tardar unos minutos)...'
        Start-ScheduledTask -TaskPath $carpeta -TaskName $nombre
        $limite = (Get-Date).AddMinutes(30)
        Start-Sleep -Seconds 3
        while ((Get-ScheduledTask -TaskPath $carpeta -TaskName $nombre).State -eq 'Running' -and (Get-Date) -lt $limite) { Start-Sleep -Seconds 2 }
        $info = Get-ScheduledTaskInfo -TaskPath $carpeta -TaskName $nombre
        switch ($info.LastTaskResult) {
            0 { Write-Host 'Resultado: copia hecha.' -ForegroundColor Green; $codigo = 0 }
            2 { Write-Host 'Resultado: copia hecha, con avisos (ver el registro abajo).' -ForegroundColor Yellow; $codigo = 2 }
            267009 { Write-Host 'La copia sigue corriendo: mirá el registro en unos minutos.' -ForegroundColor Yellow; $codigo = 2 }
            default { Write-Host "Resultado: la copia FALLÓ (código $($info.LastTaskResult)). Detalle en el registro:" -ForegroundColor Red; $codigo = 1 }
        }
        $registro = Join-Path $cfg.CarpetaRegistros 'copias.log'
        if (Test-Path -LiteralPath $registro) {
            Write-Host "--- Últimas líneas de $registro"
            Get-Content -LiteralPath $registro -Tail 12 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
        }
    } else {
        $codigo = 0
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
}
exit $codigo
