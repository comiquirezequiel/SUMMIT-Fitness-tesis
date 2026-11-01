@echo off
rem Regenera los datos de demostracion (doble clic): borra los socios y su movimiento, carga 6 meses simulados que
rem terminan hoy y deja el backend andando. Antes hay que cerrar el backend si esta abierto.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0regenerar-demo.ps1" %*
pause
