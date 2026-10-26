-- =================================================================================================================
-- SUMMIT: base de datos y usuarios de MySQL con permisos mínimos (versión para hacerlo a mano)
-- =================================================================================================================
-- Lo normal es usar crear-usuarios-mysql.ps1, que hace esto mismo, genera las contraseñas y las guarda donde van.
-- Este archivo es para quien prefiera hacerlo a mano en MySQL Workbench (conectado como root):
--   1. Reemplazá CLAVE_APP y CLAVE_COPIAS por dos contraseñas largas al azar (solo letras y números).
--   2. Ejecutá todo (el rayo de Workbench).
--   3. Poné CLAVE_APP en DB_PASSWORD de C:\SUMMIT\app\config\application.properties (DB_USERNAME=summit_app), y
--      guardá la de copias con:  crear-usuarios-mysql.ps1 -Solo Copias  (o dejá que el script la regenere).
-- No uses root para SUMMIT ni para las copias.

CREATE DATABASE IF NOT EXISTS `summit_fitness_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Usuario de la aplicación: datos (SELECT, INSERT, UPDATE, DELETE) y estructura que Hibernate crea o amplía al
-- arrancar una versión nueva (CREATE, ALTER, INDEX, REFERENCES), solo en esta base. Sin DROP: no puede borrar tablas
-- ni la base, ni ver otras bases, ni crear usuarios.
CREATE USER IF NOT EXISTS 'summit_app'@'localhost' IDENTIFIED BY 'CLAVE_APP';
ALTER USER 'summit_app'@'localhost' IDENTIFIED BY 'CLAVE_APP';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON `summit_fitness_db`.* TO 'summit_app'@'localhost';

-- Usuario de las copias de seguridad: solo lectura, lo justo para
--   mysqldump --single-transaction --skip-lock-tables --routines --events --triggers --no-tablespaces
-- (SHOW_ROUTINE solo existe a nivel global: deja leer la definición de procedimientos, no ejecutarlos.)
CREATE USER IF NOT EXISTS 'summit_copias'@'localhost' IDENTIFIED BY 'CLAVE_COPIAS';
ALTER USER 'summit_copias'@'localhost' IDENTIFIED BY 'CLAVE_COPIAS';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON `summit_fitness_db`.* TO 'summit_copias'@'localhost';
GRANT SHOW_ROUTINE ON *.* TO 'summit_copias'@'localhost';

-- Para revisar:
--   SHOW GRANTS FOR 'summit_app'@'localhost';
--   SHOW GRANTS FOR 'summit_copias'@'localhost';
