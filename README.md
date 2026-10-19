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
- **MySQL 8** corriendo en `localhost:3306`, con usuario `root` y contraseña `root` (es lo que espera
  `summit-backend/src/main/resources/application.properties`).
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

**2. Arrancá el backend** (terminal 1):

```powershell
cd summit-backend
.\mvnw.cmd clean spring-boot:run
```

Está listo cuando aparece `Started SummitBackendApplication in ... seconds`. La primera vez tarda más
porque Maven descarga dependencias. `clean` borra lo compilado y lo vuelve a compilar desde cero: suma
unos segundos pero garantiza que no quede ninguna clase vieja.

**3. Arrancá el frontend** (terminal 2):

```powershell
cd summit-frontend
npm.cmd run dev
```

Está listo cuando aparece `Local: http://localhost:5173/`. La primera vez en una PC nueva, antes hay que
correr `npm.cmd install` en esa misma carpeta.

Se escribe `npm.cmd` y no `npm` porque Windows bloquea por defecto los scripts de PowerShell, y en
PowerShell `npm` es un script (`npm.ps1`). Si preferís escribir `npm` a secas, habilitá los scripts una
sola vez con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**4. Entrá a http://localhost:5173** con el administrador inicial: `admin@summit.com` / `QUITADO-DEL-HISTORIAL`
(lo crea el backend en una base vacía; cambiá la contraseña después del primer ingreso).

**Asistente de IA:** si Ollama está abierto (ícono de la llama en la bandeja de Windows), los botones de
IA se habilitan solos. El primer análisis tarda más porque Ollama carga el modelo en memoria.

## Apagar

`Ctrl + C` en cada terminal (si pregunta `¿Desea terminar el trabajo por lotes (S/N)?`, respondé `S`).
MySQL y Ollama pueden quedar corriendo: casi no consumen nada mientras no se usan.

## Si algo falla

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `No se puede cargar el archivo ...npm.ps1 porque la ejecución de scripts está deshabilitada` | Windows bloquea los scripts de PowerShell | Usá `npm.cmd` en lugar de `npm` (ver paso 3) |
| `.\mvnw.cmd : El término ... no se reconoce` | La terminal no está parada en `summit-backend` | `cd summit-backend` y volvé a intentar |
| El backend se corta con `[ERROR] ...\Archivo.java:[42,25] ...` | Hay un error de compilación en ese archivo, línea 42, columna 25 | Corregilo y volvé a arrancar |
| `Communications link failure` o `Connection refused` al arrancar el backend | MySQL no está corriendo | Paso 1 |
| `Port 8080 was already in use` | Ya hay un backend abierto en otra terminal | Cerrá esa terminal (o `Ctrl + C` en ella) |
| Vite dice `Port 5173 is in use` y abre otro puerto | Ya hay un frontend abierto | Cerrá el otro: el backend solo acepta pedidos desde el puerto 5173 |
| Error 500 que menciona `ClassFormatError` | Clases compiladas por otra herramienta (por ejemplo el editor) | Arrancá con `clean`, como en el paso 2 |
| Botones de IA deshabilitados ("Ollama no está corriendo") | Ollama cerrado | Abrí *Ollama* desde el menú Inicio y recargá la página |
| `JAVA_HOME not found` | La terminal se abrió antes de instalar Java | Cerrá y abrí la terminal (o el editor) |

Para revisar si todo el backend compila sin arrancarlo: `.\mvnw.cmd compile` dentro de `summit-backend`
(`BUILD SUCCESS` = sin errores).

## Notas

- Para el backend usá siempre Maven (`mvnw.cmd`) y no los botones *Run/Debug* del editor: algunas versiones
  de la extensión de Java del editor compilan mal las clases de Lombok.
- Para ver la base de datos: MySQL Workbench, conexión `127.0.0.1`, puerto `3306`, usuario `root`.
- Débito automático con Mercado Pago (opcional): se activa con la variable de entorno `MP_ACCESS_TOKEN`.
