@echo off
rem Copia de seguridad de SUMMIT en este momento (doble clic). Pide permiso de administrador.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0copia-de-seguridad.ps1" -Elevar -Pausa %*
