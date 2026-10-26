@echo off
rem Simulacro de restauracion (doble clic): elegir una copia, restaurarla en una base de PRUEBA,
rem verificarla y borrar lo de prueba. No toca la base ni los archivos en uso.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0restaurar-copia.ps1" -BorrarAlTerminar -Elevar -Pausa %*
