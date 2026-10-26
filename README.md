# SUMMIT – Gestión de gimnasio

Sistema para administrar un gimnasio: socios, planes y cobros, control de acceso, clases, rutinas y un
asistente de IA local que lee certificados médicos.

| Parte | Tecnología | Puerto |
|---|---|---|
| Backend (`summit-backend`) | Java 21 + Spring Boot 3.2 | 8080 |
| Frontend (`summit-frontend`) | React 18 + Vite 5 | 5173 |
| Base de datos | MySQL 8 (`summit_fitness_db`, la crea el backend sola) | 3306 |
| Asistente de IA (opcional) | Ollama con el modelo `gemma4:12b` | 11434 |

## Requisitos

- **JDK 21** (por ejemplo Eclipse Temurin), con `JAVA_HOME` configurado: lo necesita `mvnw.cmd`.
- **MySQL 8** corriendo en `localhost:3306` (el usuario y la contraseña se cargan en el paso 2).
- **Node.js** 20 o superior.
- **Ollama** con `ollama pull gemma4:12b` (opcional: sin Ollama todo funciona menos los botones de IA).

## Levantar el proyecto

Se usan dos terminales (en el editor: menú *Terminal → New Terminal*), una para cada parte. Los comandos
son para PowerShell y parten de la carpeta `summit`.

**1. Verificá que MySQL esté corriendo.** Normalmente arranca solo con Windows. Para comprobarlo:

```powershell
Get-Service MySQL*
```

Tiene que decir `Running`. Si dice `Stopped`, abrí *Servicios* (`Win + R` → `services.msc`), buscá el de
MySQL y tocá *Iniciar*.

**2. Creá la configuración local (solo la primera vez en cada PC).** Las contraseñas y la clave de las
sesiones no están en el repositorio: van en `summit-backend/src/main/resources/application-local.properties`,
que cada PC tiene por su cuenta (está en `.gitignore`). Se crea copiando el ejemplo:

```powershell
Copy-Item summit-backend\src\main\resources\application-local.properties.example summit-backend\src\main\resources\application-local.properties
```

Abrilo en el editor y completá:

- `DB_USERNAME` y `DB_PASSWORD`: el usuario y la contraseña de MySQL.
- `JWT_SECRET`: la clave con la que el backend firma las sesiones. Generá una al azar con este comando y
  pegá el resultado:

  ```powershell
  $b = [byte[]]::new(64); [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
  ```

- `ADMIN_PASSWORD`: la contraseña del administrador inicial. Solo se usa la primera vez, con la base vacía.
- `MP_ACCESS_TOKEN` (opcional): la credencial de Mercado Pago para el débito automático.
- `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD` y `APP_URL` (opcionales): el correo desde el que sale el mail de
  "¿Olvidaste tu contraseña?" y la dirección pública de la app, que va en el link. Sin ellos, el login no ofrece
  la opción y la contraseña la restablece recepción o el admin. El ejemplo explica cómo hacerlo con Gmail.

**3. Arrancá el backend** (terminal 1):

```powershell
cd summit-backend
.\mvnw.cmd clean spring-boot:run
```

Está listo cuando aparece `Started SummitBackendApplication in ... seconds`. La primera vez tarda más
porque Maven descarga dependencias. `clean` borra lo compilado y lo vuelve a compilar desde cero: suma
unos segundos pero garantiza que no quede ninguna clase vieja.

**4. Arrancá el frontend** (terminal 2):

```powershell
cd summit-frontend
npm.cmd run dev
```

Está listo cuando aparece `Local: http://localhost:5173/`. La primera vez en una PC nueva, antes hay que
correr `npm.cmd install` en esa misma carpeta.

Se escribe `npm.cmd` y no `npm` porque Windows bloquea por defecto los scripts de PowerShell, y en
PowerShell `npm` es un script (`npm.ps1`). Si preferís escribir `npm` a secas, habilitá los scripts una
sola vez con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**5. Entrá a http://localhost:5173** con el administrador inicial: `admin@summit.com` y la contraseña de
`ADMIN_PASSWORD`. El backend lo crea solo la primera vez, con la base vacía: si la base ya existía, vale la
contraseña con la que se creó. En una base nueva, al entrar por primera vez el sistema pide elegir una
contraseña propia. Después se cambia cuando quieras desde el menú de tu nombre, arriba a la derecha.

**Asistente de IA:** si Ollama está abierto (ícono de la llama en la bandeja de Windows), los botones de
IA se habilitan solos. El primer análisis tarda más porque Ollama carga el modelo en memoria.

## Apagar

`Ctrl + C` en cada terminal (si pregunta `¿Desea terminar el trabajo por lotes (S/N)?`, respondé `S`).
MySQL y Ollama pueden quedar corriendo: casi no consumen nada mientras no se usan.

## Si algo falla

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `No se puede cargar el archivo ...npm.ps1 porque la ejecución de scripts está deshabilitada` | Windows bloquea los scripts de PowerShell | Usá `npm.cmd` en lugar de `npm` (ver paso 4) |
| `.\mvnw.cmd : El término ... no se reconoce` | La terminal no está parada en `summit-backend` | `cd summit-backend` y volvé a intentar |
| El backend se corta con `[ERROR] ...\Archivo.java:[42,25] ...` | Hay un error de compilación en ese archivo, línea 42, columna 25 | Corregilo y volvé a arrancar |
| `Communications link failure` o `Connection refused` al arrancar el backend | MySQL no está corriendo | Paso 1 |
| `Could not resolve placeholder 'JWT_SECRET'` (o `DB_USERNAME`, `DB_PASSWORD`) al arrancar el backend | Falta `application-local.properties` | Paso 2 |
| `JWT_SECRET falta o es muy corta` al arrancar el backend | `JWT_SECRET` vacía o de menos de 48 caracteres | Generala con el comando del paso 2 |
| `Access denied for user 'root'@'localhost'` al arrancar el backend | `DB_USERNAME` o `DB_PASSWORD` no coinciden con los de MySQL | Corregilos en `application-local.properties` |
| En una base nueva no se puede entrar como admin y el backend dijo `No se creó el admin inicial: falta ADMIN_PASSWORD` | `ADMIN_PASSWORD` vacía | Completala y volvé a arrancar el backend |
| Después de cambiar `JWT_SECRET`, el sistema vuelve al login | Las sesiones firmadas con la clave anterior dejan de valer | Volvé a entrar (es normal) |
| Te olvidaste la contraseña del admin | — | Otro admin te la restablece desde *Ajustes > Equipo*. Si sos el único, configurá el correo (paso 2) y usá "¿Olvidaste tu contraseña?" en el login |
| No llega el mail de "¿Olvidaste tu contraseña?" | Correo mal configurado, o el mail quedó en spam | Revisá spam y los `MAIL_*`; si el backend no pudo mandarlo, su consola dice `No se pudo mandar el mail de recuperación` |
| `Port 8080 was already in use` | Ya hay un backend abierto en otra terminal | Cerrá esa terminal (o `Ctrl + C` en ella) |
| Vite dice `Port 5173 is in use` y abre otro puerto | Ya hay un frontend abierto | Cerrá el otro: el backend solo acepta pedidos desde el puerto 5173 |
| Error 500 que menciona `ClassFormatError` | Clases compiladas por otra herramienta (por ejemplo el editor) | Arrancá con `clean`, como en el paso 3 |
| Botones de IA deshabilitados ("Ollama no está corriendo") | Ollama cerrado | Abrí *Ollama* desde el menú Inicio y recargá la página |
| `JAVA_HOME not found` | La terminal se abrió antes de instalar Java | Cerrá y abrí la terminal (o el editor) |

Para revisar si todo el backend compila sin arrancarlo: `.\mvnw.cmd compile` dentro de `summit-backend`
(`BUILD SUCCESS` = sin errores).

## Tests automáticos

- **Backend:** `.\mvnw.cmd test` dentro de `summit-backend`. Necesita MySQL corriendo y el
  `application-local.properties` (usa el mismo usuario). Los tests trabajan en una base aparte, `summit_test`, que se
  crea y se vacía sola: nunca tocan la de desarrollo. Revisan el control de acceso, los cobros, el congelamiento, la
  caja, el seguimiento, los certificados, la importación, los permisos por rol y las reglas del asistente de IA.
  Termina con `BUILD SUCCESS` si todo anda.
- **Frontend:** `npm.cmd run lint` dentro de `summit-frontend` revisa el código (sin errores = no muestra nada).

## Notas

- Para instalar SUMMIT en la PC del gimnasio (servicios que arrancan solos, acceso desde otras PC y copias de
  seguridad cifradas), seguí [INSTALACION.md](INSTALACION.md).
- Para el backend usá siempre Maven (`mvnw.cmd`) y no los botones *Run/Debug* del editor: algunas versiones
  de la extensión de Java del editor compilan mal las clases de Lombok.
- Para ver la base de datos: MySQL Workbench, conexión `127.0.0.1`, puerto `3306`, con el usuario y la
  contraseña de `application-local.properties`.
- Débito automático con Mercado Pago (opcional): se activa con `MP_ACCESS_TOKEN` en
  `application-local.properties`.
- La app del socio está suspendida hasta después de la tesis (`summit.app-socios.habilitada=false` en
  `application.properties`): los socios no pueden entrar y el panel oculta lo que es solo para la app. Para volver a
  usarla, se pone en `true` y se reinicia el backend.
- Notificaciones de la app del socio: funcionan con la app servida por HTTPS (en el iPhone, además, agregada a la
  pantalla de inicio). Las claves se generan solas la primera vez y quedan en la base: no hay que configurar nada.
  Conviene cargar el email del gimnasio en *Ajustes > Datos del gimnasio*, porque va como contacto en cada aviso.
- Ninguna contraseña va en `application.properties`, porque ese archivo se sube al repositorio. Los valores
  privados van en `application-local.properties`. En un servidor también se pueden dar como variables de
  entorno con el mismo nombre (`DB_PASSWORD`, `JWT_SECRET`, etc.), que tienen prioridad sobre el archivo.
