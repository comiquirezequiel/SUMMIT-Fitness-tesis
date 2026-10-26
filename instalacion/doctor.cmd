@echo off
rem Chequeo rapido de SUMMIT (doble clic). Pide permiso de administrador y espera Enter al terminar.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0doctor.ps1" -Elevar -Pausa %*
