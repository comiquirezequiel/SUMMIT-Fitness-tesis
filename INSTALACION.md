# Instalar SUMMIT en la PC del gimnasio

Esta guía deja SUMMIT funcionando en una PC de Windows del gimnasio: arranca solo al prender la PC, las otras PC de
recepción entran por la red, y todas las noches se hace una copia de seguridad cifrada de la base de datos y de los
archivos (certificados médicos y fotos). Está escrita para seguirla paso a paso, copiando y pegando los comandos. Al
final hay un [apéndice técnico](#apéndice-técnico) con el detalle de cada decisión.

Para trabajar en el código (desarrollo) se sigue usando el [README](README.md); esta guía es para la PC donde SUMMIT
queda en uso.

## Cómo queda armado

| Parte | Qué hace | ¿Arranca sola? |
|---|---|---|
| MySQL 8.4 (servicio `MySQL84`) | Guarda los datos | Sí |
| SUMMIT-Backend (servicio) | El programa de SUMMIT (Java) | Sí, después de MySQL |
| SUMMIT-Web (servicio, programa Caddy) | Muestra la app a las PC de la red y le pasa los pedidos al backend | Sí |
| Copia de seguridad (Programador de tareas) | Todos los días a las 23:00, cifrada; una copia queda fuera de la PC | Sí |
| Ollama (opcional) | El asistente de IA que lee certificados | Al iniciar sesión |

```
PC de recepción ──> https://IP-DE-LA-PC ──> SUMMIT-Web (Caddy, puerto 443) ──/api──> SUMMIT-Backend (solo en esta PC)
                                                    │                                    ├──> MySQL (solo en esta PC)
                                                    └── la app (C:\SUMMIT\web)           └──> C:\SUMMIT\datos\uploads
```

Todo queda en la carpeta `C:\SUMMIT`. Los datos de salud no salen de la PC sin cifrar (Ley 25.326), y entre las PC de
recepción y SUMMIT todo viaja con **https**: nadie conectado a la red del gimnasio (por ejemplo, al WiFi) puede leer
las contraseñas, las sesiones ni los datos de los socios.

## Antes de empezar

- **La PC.** Windows 10 u 11 de 64 bits, con disco SSD y 50 GB libres. 8 GB de RAM alcanzan sin el asistente de IA;
  con IA hacen falta 16 GB. Ideal: una PC dedicada que quede prendida todo el día, con una UPS para los cortes de luz.
- **Una IP fija en la red.** Las otras PC van a entrar escribiendo la dirección de esta (por ejemplo
  `https://192.168.1.50`), así que no tiene que cambiar (el certificado de https se hace para esa IP). Se configura en el router como "reserva de DHCP" (o "IP
  estática"): si no sabés hacerlo, pedíselo a quien instaló internet. Para ver la IP actual: `ipconfig`, línea
  "Dirección IPv4".
- **Un usuario de Windows administrador** y conexión a internet (para descargar los programas).
- **Papel y lapicera.** Vas a anotar tres cosas: la contraseña de root de MySQL, la contraseña inicial del
  administrador de SUMMIT y la clave de las copias de seguridad. La clave de las copias se guarda **fuera de la PC**.

**Cómo abrir PowerShell como administrador:** menú Inicio, escribí `PowerShell`, clic derecho en *Windows
PowerShell* > *Ejecutar como administrador* > *Sí*. Cada vez que abras una ventana para esta guía, pegá primero esta
línea (permite correr los scripts de SUMMIT solo en esa ventana, sin cambiar nada de Windows):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
```

## Paso 1: instalar los programas

En PowerShell como administrador, pegá estas líneas (de a una o todas juntas). Cada programa se descarga de su
página oficial; si Windows pregunta, aceptá.

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK -e --accept-source-agreements --accept-package-agreements
winget install --id Oracle.MySQL -e --accept-package-agreements
winget install --id 7zip.7zip -e --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements
winget install --id Git.Git -e --accept-package-agreements
```

Son: Java 21 (lo usa SUMMIT), MySQL 8.4 (la base de datos), 7-Zip (cifra y abre las copias), Node.js (para compilar
la app) y Git (para traer el código). En Windows 10, si dice que `winget` no existe, instalá *Instalador de
aplicación* desde Microsoft Store.

**Configurar MySQL.** Abrí *MySQL Configurator* desde el menú Inicio y seguí el asistente (los nombres de las
pantallas pueden variar un poco según la versión):

1. *Type and Networking*: dejá el puerto 3306 y **destildá** *Open Windows Firewall ports for network access* (nadie
   de afuera tiene que entrar a la base).
2. *Accounts and Roles*: elegí la contraseña de **root** y anotala. Es la llave maestra de la base: se usa para
   instalar y para restaurar copias, nunca en el uso diario.
3. *Windows Service*: dejá el nombre `MySQL84`, tildado *Start the MySQL Server at System Startup* y *Standard System
   Account*.
4. Terminá con *Execute* / *Finish*.

**Que MySQL atienda solo a esta PC.** Abrí el Bloc de notas como administrador, abrí
`C:\ProgramData\MySQL\MySQL Server 8.4\my.ini` (la carpeta `ProgramData` está oculta: escribí la ruta completa), y
debajo de la línea `[mysqld]` agregá:

```ini
bind-address=127.0.0.1
mysqlx-bind-address=127.0.0.1
```

Guardá y reiniciá MySQL: `Restart-Service MySQL84`.

**Cerrá PowerShell y abrí uno nuevo** (como administrador, con la línea de `Set-ExecutionPolicy`): así ve los
programas recién instalados.

## Paso 2: traer el código de SUMMIT

```powershell
git clone https://github.com/comiquirezequiel/SUMMIT-Fitness-tesis.git C:\SUMMIT\codigo
```

El repositorio es privado: Git abre el navegador para que entres con la cuenta de GitHub que tiene acceso. Otra forma
es copiar la carpeta `summit` desde un pendrive a `C:\SUMMIT\codigo`; en ese caso, **no copies**
`summit-backend\src\main\resources\application-local.properties` (tiene las contraseñas de la PC de desarrollo), ni las
carpetas `node_modules` y `target`.

## Paso 3: preparar la PC

```powershell
cd C:\SUMMIT\codigo\instalacion
.\preparar-pc.ps1
```

Crea las carpetas de `C:\SUMMIT` (las que tienen datos o claves quedan solo para Windows y los administradores), copia
los scripts a `C:\SUMMIT\scripts` y crea los archivos de configuración. **Anotá la contraseña inicial del
administrador** que muestra al final: es para el primer ingreso a SUMMIT.

## Paso 4: la base de datos y sus usuarios

```powershell
cd C:\SUMMIT\scripts
.\crear-usuarios-mysql.ps1
```

Pide la contraseña de root (no se guarda) y crea la base `summit_fitness_db` con dos usuarios propios: `summit_app`,
que usa SUMMIT y solo puede tocar su base, y `summit_copias`, que solo puede leer. Sus contraseñas se generan al azar y
quedan guardadas donde corresponde: nadie necesita saberlas.

## Paso 5: configuración privada (opcional)

Lo indispensable ya está completo. Si querés activar algo opcional, abrí con el Bloc de notas (como administrador)
`C:\SUMMIT\app\config\application.properties` y completá lo que corresponda; cada opción tiene su explicación:

- el mail de "¿Olvidaste tu contraseña?" (`MAIL_...` y `APP_URL`);
- el débito automático de Mercado Pago (`MP_ACCESS_TOKEN`);
- apagar el asistente de IA si la PC tiene menos de 16 GB de RAM (`summit.ia.habilitada=false`).

## Paso 6: compilar SUMMIT

```powershell
.\compilar.ps1 -Codigo C:\SUMMIT\codigo -Salida C:\SUMMIT
```

La primera vez tarda unos minutos porque descarga lo que necesita. Termina con `Backend listo` y `Frontend listo`.

## Paso 7: instalar los servicios

```powershell
.\instalar-servicios.ps1
```

Descarga Shawl y Caddy (versiones fijas, verificadas), crea los servicios SUMMIT-Backend y SUMMIT-Web, los arranca y
espera a que respondan. También instala en esta PC el certificado de https que crea Caddy y deja una copia en
`C:\SUMMIT\certificado-summit.crt`, para las PC de recepción. Al final muestra las direcciones para entrar.

Abrí **https://localhost** en el navegador de esta PC y entrá con `admin@summit.com` y la contraseña inicial del paso
3. SUMMIT te pide elegir una contraseña propia: anotala en un lugar seguro. Desde ahora, SUMMIT arranca solo cada vez
que se prende la PC (tarda un minuto más que Windows).

## Paso 8: entrar desde las otras PC de recepción

1. **Red privada.** En esta PC: *Configuración > Red e Internet > Ethernet* (o *Wi-Fi*) > *Tipo de perfil de red*:
   **Privada**.
2. **Abrir la puerta de la app en el firewall** (solo para la red del gimnasio, no para internet). En PowerShell como
   administrador:

   ```powershell
   New-NetFirewallRule -DisplayName 'SUMMIT - app (red del gimnasio)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80,443 -Profile Private -RemoteAddress LocalSubnet
   ```

   Es la única que hace falta (el 443 es https; el 80 solo pasa a https a quien entre por http): MySQL (3306) y el
   backend (8080) no se abren nunca.
3. **En cada PC de recepción, instalar el certificado de SUMMIT** (una sola vez). Llevá `C:\SUMMIT\certificado-summit.crt`
   en un pendrive (es público: no tiene ninguna clave) y, en PowerShell como administrador de esa PC, parado en la
   carpeta del pendrive:

   ```powershell
   certutil -addstore -f Root certificado-summit.crt
   ```

   Así el navegador confía en el https de SUMMIT. Sin este paso, muestra "La conexión no es privada".
4. **En cada PC de recepción**, abrí el navegador en `https://IP-DE-LA-PC` (la IP fija del paso "Antes de empezar",
   por ejemplo `https://192.168.1.50`) y guardala en favoritos. También sirve el nombre de la PC
   (`https://nombre-de-la-pc`), si la red lo reconoce.

No hay que tocar `summit.cors.origins`: la app y la API llegan por la misma dirección (la de Caddy). Con https también
funcionan la cámara (la foto del socio) y el cobro con tarjeta de Mercado Pago, que los navegadores solo permiten con
https. Más detalles en el apéndice [https en la red local](#h-https-en-la-red-local).

## Paso 9: copias de seguridad automáticas

**9.1. La clave de las copias.**

```powershell
.\guardar-clave-copias.ps1
```

Genera una clave al azar (6 grupos de 4 letras y números), la muestra una vez y te pide escribirla de nuevo para
confirmar que la anotaste. **Guardá el papel fuera de la PC**, por ejemplo en un sobre cerrado en la casa del dueño
(o en un gestor de contraseñas). La PC la guarda cifrada para hacer las copias sola, pero si la PC se rompe o se la
roban, esa copia de la clave se pierde con ella: sin el papel, ninguna copia se puede abrir.

**9.2. Una copia fuera de la PC.** Si la PC se roba o se quema, las copias que están adentro se pierden con ella. Abrí
con el Bloc de notas (como administrador) `C:\SUMMIT\config\summit.psd1` y completá `DestinoExterno` con una de estas
opciones (las copias ya van cifradas, así que pueden ir a la nube):

- **OneDrive:** una carpeta dentro de OneDrive, por ejemplo
  `DestinoExterno = 'C:\Users\Recepcion\OneDrive\SUMMIT-copias'` (con el usuario de Windows que usa OneDrive en esta
  PC).
- **Google Drive:** `DestinoExterno = 'C:\SUMMIT\copias-nube'`, y en *Google Drive para computadoras* >
  *Preferencias* > *Mi computadora* > *Agregar carpeta* elegí `C:\SUMMIT\copias-nube` con *Sincronizar con Google
  Drive*. (La unidad `G:` de Google Drive no sirve: la copia corre como Windows, no como tu usuario.)
- **Un disco USB:** `DestinoExterno = 'S:\SUMMIT-copias'`. Para que el disco tenga siempre la misma letra, asignásela
  en *Administración de discos* (Win + X > Administración de discos > clic derecho en el disco > *Cambiar la letra*).
  Lo mejor son dos discos que se turnan cada semana, con uno guardado fuera del gimnasio. Si el disco no está
  conectado, la copia se hace igual en la PC y el chequeo lo avisa.

Cuánto ocupa: cada copia pesa un poco más que los certificados y fotos subidos, y se guardan 30 días (se cambia con
`DiasRetencion` y `DiasRetencionExterno`). La cuenta gratis de Google Drive tiene 15 GB.

**9.3. Programar la copia diaria y probarla.**

```powershell
.\programar-copia.ps1 -Hora 23:00 -ProbarAhora
```

Crea la tarea en el Programador de tareas de Windows (corre como Windows, aunque nadie haya iniciado sesión; si a esa
hora la PC estaba apagada, la hace apenas se prende) y hace una copia en ese momento. Tiene que terminar con
`Resultado: copia hecha`.

Las copias quedan en `C:\SUMMIT\copias`, con nombres como `summit-copia-2026-10-25_2300.7z`. Para hacer una en
cualquier momento (por ejemplo, antes de algo importante): doble clic en `C:\SUMMIT\scripts\copia-ahora.cmd`.

## Paso 10: probar que las copias se pueden restaurar

Una copia que nunca se probó no es una copia. Hacé este simulacro ahora y **una vez por mes**:

1. Doble clic en `C:\SUMMIT\scripts\probar-restauracion.cmd` (pide permiso de administrador).
2. Elegí una copia, escribí la contraseña de root de MySQL y esperá.
3. Tiene que decir `Resultado: la copia se puede restaurar sin problemas.`

Restaura la copia en una base de **prueba**, la compara tabla por tabla con lo que había al hacer la copia, cuenta los
archivos y después borra todo lo de prueba. No toca nada de lo que está en uso.

Además, la primera vez, **probá la clave anotada**: hacé clic derecho en una copia de `C:\SUMMIT\copias` > *7-Zip* >
*Abrir archivo*, y escribí la clave del papel. Si se abre (y ves `LEEME.txt`, `manifiesto.json` y las carpetas),
el papel está bien. Cerrá sin extraer nada.

## Paso 11: el chequeo

Doble clic en `C:\SUMMIT\scripts\doctor.cmd`. Revisa si están funcionando MySQL, el backend y la app, cuándo fue la
última copia (y la del destino externo), si la tarea está programada, el espacio en disco y la IA. Cada problema viene
con lo que hay que hacer. Conviene mirarlo **una vez por semana**.

## El asistente de IA (opcional)

El asistente lee los certificados médicos con el modelo `gemma4:12b`, que ocupa unos 10 GB de RAM mientras trabaja.
Con menos de 16 GB de RAM, mejor no instalarlo y apagarlo en la configuración (paso 5). Para instalarlo, en una
ventana de PowerShell **normal** (no como administrador):

```powershell
winget install --id Ollama.Ollama -e
ollama pull gemma4:12b
```

Ollama se instala para el usuario de Windows que lo instaló y arranca cuando ese usuario inicia sesión (ícono de la
llama en la bandeja). SUMMIT funciona igual sin él: solo se desactivan los botones de IA. Para que esté siempre
disponible, configurá esa PC para que inicie sesión sola con ese usuario. El primer análisis después de prender la PC
tarda más (carga el modelo). Ollama atiende solo a esta PC (`127.0.0.1:11434`): no lo abras a la red.

## Uso de todos los días

No hay que hacer nada: SUMMIT arranca solo y la copia se hace sola. Lo único:

- **Cada semana:** `doctor.cmd`. Si usás discos USB, cambiá el disco.
- **Cada mes:** `probar-restauracion.cmd`.
- **Siempre:** la PC prendida (con UPS) y el papel con la clave de las copias guardado fuera del gimnasio.

## Actualizar SUMMIT a una versión nueva

Antes de cambiar de versión, el script hace una copia de seguridad; si la copia falla, no sigue. En PowerShell como
administrador:

```powershell
cd C:\SUMMIT\codigo
git pull
cd instalacion
.\preparar-pc.ps1
cd C:\SUMMIT\scripts
.\actualizar.ps1
```

`git pull` trae el código nuevo; `preparar-pc.ps1` actualiza los scripts (no toca la configuración, las claves ni los
permisos); y
`actualizar.ps1` compila la versión nueva mientras SUMMIT sigue andando, hace la copia, cambia de versión, espera a que
responda y corre el chequeo. SUMMIT queda fuera de servicio menos de un minuto. La versión nueva agrega sola las
tablas o columnas que necesite: los datos no se tocan.

**Si la versión nueva no anda:** `.\actualizar.ps1 -VolverAtras` vuelve a la anterior. Si además hiciera falta volver
los datos al momento de antes de actualizar, restaurá la copia `summit-copia-...-antes-de-actualizar.7z` (próxima
sección).

## Restaurar una copia de verdad (volver atrás o pasar a otra PC)

Reemplaza la base y los archivos en uso por los de una copia: lo que se cargó después de esa copia se pierde. En
PowerShell como administrador:

```powershell
cd C:\SUMMIT\scripts
.\restaurar-copia.ps1 -ReemplazarBaseReal
```

Elegí la copia en la ventana que se abre, escribí la contraseña de root y, cuando lo pida, escribí `REEMPLAZAR`. El
script detiene el backend, hace antes una copia de lo actual (`...-antes-de-restaurar.7z`, por si te equivocaste de
copia), restaura primero en una base temporal y la verifica, y recién ahí reemplaza la base real. La carpeta de
archivos anterior queda renombrada (`uploads-antes-de-restaurar-...`), no se borra. Al final vuelve a arrancar el
backend: entrá a SUMMIT, revisá que esté todo y corré `doctor.cmd`.

## Si la PC se rompe

Con el papel de la clave y una copia del destino externo (OneDrive, Google Drive o el disco USB), SUMMIT se recupera
en otra PC:

1. En la PC nueva, hacé los **pasos 1 a 8** de esta guía.
2. Guardá en la PC nueva **la misma clave** de antes (la del papel), así las copias viejas y las nuevas se abren con
   el mismo papel: `.\guardar-clave-copias.ps1 -Escribir`.
3. Copiá la última copia (`summit-copia-....7z`) del destino externo a la PC nueva, por ejemplo al Escritorio.
4. Restaurala: `.\restaurar-copia.ps1 -ReemplazarBaseReal` (sección anterior).
5. Hacé el resto del **paso 9** (destino externo y tarea programada) y corré `doctor.cmd`.

El administrador y los usuarios de SUMMIT vuelven con la copia, con sus contraseñas de siempre.

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| `doctor.cmd` dice que MySQL está detenido | `services.msc` > `MySQL84` > *Iniciar*. Si no arranca, *Visor de eventos* > *Registros de Windows* > *Aplicación* dice por qué |
| El backend no responde | Mirá el final de `C:\SUMMIT\logs\summit-backend_rCURRENT.log`. Si dice `Access denied for user 'summit_app'`, corré `.\crear-usuarios-mysql.ps1 -Solo App` y reiniciá el servicio SUMMIT-Backend |
| Las otras PC no entran | Revisá que la red sea *Privada* y que exista la regla del firewall (paso 8). Si cambió la IP de la PC, falta la reserva en el router |
| `instalar-servicios.ps1` dice que el puerto 443 o el 80 está en uso | Otro programa usa ese puerto (por ejemplo IIS, Skype viejo u otro servidor web): cerralo o desinstalalo y volvé a correr el script |
| Las PC de recepción muestran "La conexión no es privada" | Falta instalar el certificado de SUMMIT en esa PC (paso 8.3), o se entró por una dirección que no está en el `Caddyfile` (apéndice H) |
| Se actualizó Java y SUMMIT no arranca | Corré de nuevo `.\instalar-servicios.ps1` (toma el Java nuevo) |
| La copia dice que el destino externo no está disponible | Conectá el disco USB (o abrí OneDrive / Google Drive). La copia de la PC se hizo igual |
| La copia falla con "no tengo permiso para leer" | Corrélo como administrador (o con `copia-ahora.cmd`) |
| Al restaurar: "la clave de cifrado no es la correcta" | Si la copia es de antes de un cambio de clave, agregá `-PedirClave` y escribí la clave anterior |
| `No se puede cargar el archivo ... porque la ejecución de scripts está deshabilitada` | Te faltó la línea `Set-ExecutionPolicy -Scope Process ...` al abrir PowerShell |
| `winget` o `git` "no se reconoce" justo después de instalar | Cerrá PowerShell y abrí uno nuevo |

---

## Apéndice técnico

### A. Componentes, puertos y cuentas

| Componente | Dónde escucha | Corre como | Registro |
|---|---|---|---|
| MySQL 8.4 | `127.0.0.1:3306` (`bind-address`) | `NT AUTHORITY\NetworkService` (instalador) | Visor de eventos |
| SUMMIT-Backend | `127.0.0.1:8080` (`server.address`) | `NT SERVICE\SUMMIT-Backend` (cuenta virtual) | `logs\summit-backend_rCURRENT.log` (diario, 30 días) |
| SUMMIT-Web (Caddy 2.11.7) | `:443` (https) y `:80` (solo redirige a https) en todas las interfaces | `NT SERVICE\SUMMIT-Web` (cuenta virtual) | `logs\summit-web_rCURRENT.log` |
| Copia diaria | — | `SYSTEM` (tarea `\SUMMIT\SUMMIT - Copia de seguridad`) | `logs\copias.log`, `copias\estado-copias.json` |
| Ollama (opcional) | `127.0.0.1:11434` | el usuario que inició sesión | — |

Solo los puertos 443 y 80 se abren en el firewall, y solo para la subred local con perfil
privado. El backend no es accesible desde la red: todo pasa por Caddy, que además es el único proxy en el que confía el
backend para tomar la IP real del cliente (`X-Forwarded-For`, que usa el limitador de pedidos).

### B. Carpetas y permisos

```
C:\SUMMIT\              SYSTEM y Administradores: control total; Usuarios: lectura
  app\                  summit-backend.jar, version.txt; tmp\ (temporales de Java)
  app\config\           application.properties                         privada (+ lectura del servicio)
  web\                  frontend compilado (lo lee SUMMIT-Web)
  caddy\                caddy.exe, Caddyfile; datos\ (certificados)    datos\ privada (+ servicio web)
  herramientas\         shawl.exe
  scripts\              scripts y plantillas
  config\               summit.psd1, secretos-copias.dat               privada
  datos\uploads\        certificados y fotos                           privada (+ modificación del backend)
  copias\               .7z y estado-copias.json                       privada
  logs\                 registros                                      privada (+ servicios)
  restauraciones\       trabajo temporal de restaurar-copia.ps1        privada
  versiones\anterior\   la versión anterior (actualizar.ps1)           privada
  codigo\               el repositorio (git clone)
```

"Privada" = sin herencia, solo `SYSTEM` (S-1-5-18) y `Administradores` (S-1-5-32-544); los permisos se dan por SID,
así funcionan en Windows en cualquier idioma. Las cuentas virtuales de los servicios reciben solo lo que necesitan
(`instalar-servicios.ps1`).

La configuración privada del backend no está en el `.jar`: Spring Boot lee `config\application.properties` de la
carpeta de trabajo (`app\`) además del `application.properties` interno, y sus valores tienen prioridad. Ahí van
`DB_USERNAME`/`DB_PASSWORD` (usuario `summit_app`), `JWT_SECRET` (64 bytes al azar), `ADMIN_PASSWORD`,
`server.address=127.0.0.1`, `summit.uploads.dir` absoluto, `spring.jpa.show-sql=false` y apagado prolijo
(`server.shutdown=graceful`).

### C. Las copias de seguridad

**Contenido de cada `.7z`:** `base\summit_fitness_db.sql` (volcado), la carpeta de archivos subidos (`uploads\`),
`manifiesto.json` y `LEEME.txt`. El manifiesto tiene, por tabla, la cantidad exacta de filas (`COUNT(*)`) y la huella
`CHECKSUM TABLE`, tomadas antes y después del volcado: si una tabla cambió durante la copia (alguien estaba usando
SUMMIT) se marca, y la restauración la acepta con un aviso. También guarda el SHA-256 del `.sql`, la versión de MySQL,
el juego de caracteres de la base y la cantidad y el tamaño de los archivos.

**mysqldump**, con el usuario de solo lectura y la contraseña en un archivo de opciones temporal (`--defaults-file`,
permisos privados, se pisa y se borra al terminar; nunca en la línea de comandos):

| Opción | Por qué |
|---|---|
| `--single-transaction` | Foto coherente de todas las tablas InnoDB sin bloquear a SUMMIT |
| `--skip-lock-tables` | No hace falta (y no se pide) el permiso LOCK TABLES |
| `--routines --events --triggers` | Copia todo lo que pudiera haber además de las tablas (hoy no hay nada de eso) |
| `--hex-blob` | Columnas binarias en hexadecimal: el volcado es texto puro |
| `--default-character-set=utf8mb4` | Acentos y eñes intactos |
| `--set-gtid-purged=OFF` | El volcado se puede cargar en cualquier servidor |
| `--no-tablespaces` | Desde MySQL 8.0.21 volcar tablespaces exige el permiso PROCESS ([bug #100219](https://bugs.mysql.com/bug.php?id=100219)) |
| `--result-file` | Escribe el archivo directo: una redirección `>` de PowerShell 5.1 lo pasaría a UTF-16 |
| sin `--databases` | El volcado no tiene `USE`/`CREATE DATABASE`: se puede cargar en una base de prueba sin riesgo de pisar la real |

Se verifica que el volcado termine con `-- Dump completed`. El orden es volcado y después archivos: un archivo subido
en ese medio queda en la copia sin estar en la base (inofensivo), y nunca al revés.

**Cifrado:** 7-Zip, formato 7z con AES-256 y nombres cifrados (`-mhe=on`): sin la clave no se ve ni la lista de
archivos. 7-Zip deriva la clave con 2^19 rondas de SHA-256 (`7zAES:19`); por eso la clave es larga y al azar (24
caracteres de un alfabeto de 31: unos 119 bits). Después de crearla, la copia se prueba (`7z t`) y recién ahí se
renombra de `.7z.parcial` a `.7z`; al destino externo también se copia como `.parcial`, se compara el SHA-256 y se
renombra.

La clave se le pasa a 7-Zip por la entrada estándar, no en la línea de comandos. Detalle encontrado al probarlo:
Windows PowerShell 5.1 antepone un BOM UTF-8 a lo que manda por la entrada estándar de otro programa cuando la consola
está en UTF-8 (`Console.InputEncoding` con preámbulo), y 7-Zip lo toma como parte de la clave: la copia queda cifrada
con una clave que el script puede abrir, pero una persona no. `comun.ps1` cambia a UTF-8 sin BOM antes de lanzar el
proceso y escribe bytes ASCII crudos; además, al abrir una copia no se pasa `-p` (con `-p` vacío 7-Zip usa una clave
vacía en vez de preguntar). Por eso las claves solo admiten ASCII imprimible. Se verificó abriendo las copias con la
clave escrita a mano (`7z t -p<clave>`).

**Alternativas evaluadas para cifrar:** GnuPG simétrico (AES-256, bien establecido, pero pide un paso de `tar` y abrir
la copia sin el script es más difícil); [age](https://age-encryption.org) (moderno, sin interfaz gráfica en Windows);
restic, Kopia o Duplicati (copias incrementales y deduplicadas con nube integrada: convienen si los archivos llegan a
muchos GB, pero restaurar exige la herramienta y su formato); ZIP con AES (mismo cifrado, pero los nombres de los
archivos quedan a la vista y el Explorador de Windows no lo abre); BitLocker To Go (Windows 11 Home no puede cifrar
discos USB). 7-Zip es gratis, se abre con doble clic, y cada copia es un archivo completo e independiente.

**Retención:** se borran las copias con más de `DiasRetencion` días (y en el destino externo, `DiasRetencionExterno`;
0 = nunca), pero siempre quedan las `CopiasMinimas` más nuevas. Solo se borran archivos con el nombre
`summit-copia-AAAA-MM-DD_HHMM*.7z`. Códigos de salida de `copia-de-seguridad.ps1`: 0 = bien, 2 = con avisos (por
ejemplo, destino externo no disponible), 1 = falló.

### D. Dónde quedan las claves

| Clave | Dónde | Quién la necesita |
|---|---|---|
| root de MySQL | Solo en el papel | Una persona, para instalar y restaurar (se pide cada vez) |
| `summit_app` | `app\config\application.properties` (privado + servicio) | El backend |
| `summit_copias` y clave de cifrado | `config\secretos-copias.dat` | La tarea de copia (SYSTEM) y la restauración en esta PC |
| Clave de cifrado | Además, en papel fuera de la PC | Para abrir copias en otra PC |
| `JWT_SECRET` | `app\config\application.properties` | El backend (si se pierde, se genera otra y todos vuelven a entrar) |

`secretos-copias.dat` está cifrado con DPAPI de Windows en alcance de **equipo** (`ProtectedData`, `LocalMachine`, con
entropía propia) y con permisos solo para `SYSTEM` y `Administradores`. Copiado a otra PC no sirve. Se eligió así
porque la tarea corre como `SYSTEM`: con DPAPI de **usuario** (`Export-Clixml` o el Administrador de credenciales) la
clave queda atada a una cuenta, lo que obliga a correr la tarea con ese usuario y su contraseña guardada en el
Programador de tareas (se rompe al cambiarla, y con cuentas Microsoft es frágil) o con "no guardar contraseña" (S4U),
que no puede abrir DPAPI de usuario. `mysql_config_editor` (`.mylogin.cnf`) solo ofusca, no cifra.

### E. Usuarios de MySQL

| Usuario | Permisos | Para qué |
|---|---|---|
| `summit_app@localhost` | `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES` en `summit_fitness_db.*` | Datos, y las tablas, columnas, índices y claves foráneas que Hibernate (`ddl-auto=update`) agrega al arrancar una versión nueva. Sin `DROP`: no puede borrar tablas ni la base. `CREATE` en la base también cubre el `createDatabaseIfNotExist=true` de la URL |
| `summit_copias@localhost` | `SELECT, SHOW VIEW, TRIGGER, EVENT` en `summit_fitness_db.*` + `SHOW_ROUTINE` global | Solo lectura para mysqldump. Sin `PROCESS` (por `--no-tablespaces`), ni `LOCK TABLES`, ni `RELOAD` |

Probado: con solo esos permisos, Hibernate recreó una tabla borrada (con su clave foránea) y una columna borrada al
arrancar, y mysqldump hizo la copia completa. `@localhost` alcanza porque MySQL resuelve las conexiones TCP de
`127.0.0.1` como `localhost` (`skip_name_resolve=OFF`, el valor por defecto). El archivo
`instalacion\usuarios-mysql.sql` tiene lo mismo para hacerlo a mano.

### F. Servicios de Windows: por qué Shawl

`java -jar` no sabe hablar con el administrador de servicios de Windows, así que hace falta un programa intermedio.
Situación a octubre de 2026:

| Opción | Estado | Comentario |
|---|---|---|
| **[Shawl](https://github.com/mtkennerly/shawl)** (elegida) | Mantenida: v1.9.0 del 3/5/2026, v1.8.0 de 12/2025 | Un `.exe` chico (Rust, MIT), en winget. Reinicia el programa si se cae, registro con rotación diaria, directorio de trabajo, dependencias y apagado con Ctrl+C (Spring Boot cierra prolijo). El servicio se crea con `sc.exe`/`New-Service`, así que se ve y se maneja como cualquier otro en `services.msc` |
| [WinSW](https://github.com/winsw/winsw) | Sin versiones nuevas desde enero de 2023 (v2.12.0 estable; v3 sigue en alfa) | La que nombra la [documentación de Spring Boot](https://docs.spring.io/spring-boot/how-to/deployment/installing.html), pero el proyecto está casi quieto |
| [NSSM](https://nssm.cc/download) | Última versión 2.24 (2014); prelanzamiento de 2017 | Muy usado, abandonado |
| [Servy](https://github.com/aelassas/servy) | Muy activo (v10.6 del 21/10/2026) | Tiene interfaz gráfica; proyecto joven y con versiones casi semanales, más cambios de los que conviene para algo que tiene que andar años sin tocarse |
| [Apache procrun](https://commons.apache.org/proper/commons-daemon/procrun.html) | Mantenido (Commons Daemon 1.6) | Pensado para Java (lo usa Tomcat), pero se configura con muchos parámetros en el registro |

Cada servicio corre con su **cuenta virtual** (`NT SERVICE\<nombre>`: sin contraseña, la crea Windows) y no como
`SYSTEM`, como recomienda el propio Shawl. Shawl reinicia el programa 10 s (backend) o 5 s (Caddy) después de una
caída; si se cayera Shawl, Windows reinicia el servicio al minuto (`sc failure`). `--pass 0,130`: 130 es el código con
el que termina Java al recibir Ctrl+C, así una detención normal no figura como error. Java: `-Xmx1g` (cambiable con
`-MemoriaMaxima`), temporales y caché de fuentes de PDFBox en `app\tmp`, salida en UTF-8. La ruta de `java.exe` queda
fija en el servicio: si se actualiza Java, `doctor.ps1` lo detecta y `instalar-servicios.ps1` lo corrige.

Shawl y Caddy se descargan de GitHub en versiones fijas y se verifica su SHA-256 contra el publicado (constantes al
principio de `instalar-servicios.ps1`).

### G. Cómo se sirve la app: por qué Caddy (opción B)

| | A. Que la sirva Spring Boot | B. Caddy adelante (elegida) |
|---|---|---|
| Cambios en la aplicación | Sí: copiar `dist` al `.jar`, permitir `/`, `/assets/**` y las rutas de la app en `SecurityConfig` (hoy todo lo que no es `/api/auth` pide sesión), redirigir las rutas de React a `index.html` y poner bien los encabezados de caché | Ninguno |
| Programas y servicios | Uno | Dos (Caddy es un solo `.exe`) |
| https en la red local | A mano (keystore con `keytool`, renovarlo, instalarlo en cada PC) | `tls internal`: Caddy crea y renueva solo sus certificados |
| Compresión y caché | Hay que configurarlas en Spring | `encode zstd gzip`; `/assets` un año (`immutable`), el resto `no-cache` |
| Exposición del backend | El backend queda abierto a la red | El backend escucha solo en `127.0.0.1` |
| Igual que en desarrollo | — | Sí: es lo que hace el proxy de Vite (`/api` en la misma dirección), para lo que se armó la app |

El `Caddyfile` (`caddy\Caddyfile`, plantilla en `instalacion\plantillas`): `/api/*` va al backend con
`header_up X-Forwarded-Port {http.request.port}`, para que el backend reconozca los pedidos de la propia app como del
mismo origen aunque Caddy no esté en el puerto 80 (sin eso responde 403 por CORS; probado); un archivo de `/assets`
que no existe da 404; cualquier otra ruta devuelve `index.html`. `trusted_proxies` solo para `127.0.0.1`/`::1`, así
nadie de la red puede inventar su IP. Sin panel de administración (`admin off`) ni copia de la configuración
(`persist_config off`). Encabezados: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, sin `Server`. Las
respuestas de `/api` conservan el `Cache-Control: no-store` de Spring Security.

### H. https en la red local

SUMMIT se instala **con https por defecto**. Sin https, la contraseña de quien entra y el token de su sesión viajan
sin cifrar por la red: cualquiera conectado a ella (por ejemplo, al WiFi del gimnasio) podría leerlos con un programa
como Wireshark y entrar al panel con esa sesión. Además, los navegadores solo permiten la cámara y el formulario de
tarjeta de Mercado Pago en `localhost` o con https.

Cómo queda armado:

- **Certificados.** El sitio del `Caddyfile` usa `tls internal`: Caddy crea su propia autoridad de certificados (la
  raíz y su clave privada quedan en `C:\SUMMIT\caddy\datos\pki`, carpeta privada) y firma con ella un certificado para
  cada dirección de la lista, que renueva solo. `preparar-pc.ps1` arma la lista con `localhost`, el nombre de la PC y
  sus IP. Si la IP cambia, agregala en `C:\SUMMIT\caddy\Caddyfile` (`https://localhost, https://nombre-pc, https://IP-NUEVA`)
  y reiniciá SUMMIT-Web.
- **Confianza.** `instalar-servicios.ps1` instala el certificado raíz (`root.crt`, el público) en *Entidades de
  certificación raíz de confianza* de esta PC y lo copia a `C:\SUMMIT\certificado-summit.crt`; en cada PC de recepción
  se instala con `certutil` (paso 8).
- **http.** Caddy escucha en el puerto 80 solo para mandar a `https://` a quien entre por `http://`.

**Una instalación hecha antes, sin https**, se pasa así: en `C:\SUMMIT\caddy\Caddyfile` reemplazá el bloque
`{$SUMMIT_SITIO::80} { import summit }` por el de la plantilla (`instalacion\plantillas\Caddyfile`), con las
direcciones de la PC; en `C:\SUMMIT\config\summit.psd1` poné `UrlWeb = 'https://localhost'`; corré
`instalar-servicios.ps1` de nuevo y sumá el 443 a la regla del firewall:

```powershell
Set-NetFirewallRule -DisplayName 'SUMMIT - app (red del gimnasio)' -LocalPort 80,443
```

Después, el paso 8.3 en cada PC de recepción.

**Sin https** (no recomendado): en el `Caddyfile`, usá el bloque comentado del final en lugar del de https, y en
`summit.psd1` poné `UrlWeb = 'http://localhost'`.

Navegadores: Chrome y Edge usan el almacén de Windows; Firefox también, en Windows, mientras `security.enterprise_roots.enabled`
esté activo. La raíz dura 10 años; los certificados que firma los renueva Caddy solo. Probado con OpenSSL: con la raíz
de Caddy instalada, la cadena verifica sin advertencias.

### I. Compilar en otra PC

Se puede compilar en la PC de desarrollo (`compilar.ps1 -Salida <carpeta>`) y llevar `app\summit-backend.jar` y `web\`
a `C:\SUMMIT`. Ojo: si esa PC tiene `summit-backend\src\main\resources\application-local.properties`, Maven lo mete
adentro del `.jar` con sus contraseñas. `compilar.ps1` lo detecta y se niega a seguir; la solución de fondo es que el
`pom.xml` lo excluya del `.jar` (`maven-jar-plugin`, `<excludes>`), que no cambia nada en desarrollo.

### J. Desinstalar

Hacé antes una última copia y guardala. Después, como administrador: `.\programar-copia.ps1 -Quitar`,
`.\instalar-servicios.ps1 -Quitar`, borrar la regla del firewall (`Remove-NetFirewallRule -DisplayName 'SUMMIT - app
(red del gimnasio)'`), los usuarios de MySQL (`DROP USER 'summit_app'@'localhost', 'summit_copias'@'localhost';`) y la
carpeta `C:\SUMMIT`.

### L. Scripts

| Script | Qué hace |
|---|---|
| `preparar-pc.ps1` | Carpetas, permisos, copia de scripts y configuración inicial |
| `crear-usuarios-mysql.ps1` | Base y usuarios de MySQL (`-Solo App` / `-Solo Copias`, `-MostrarClaves`) |
| `guardar-clave-copias.ps1` | Clave de cifrado (`-Escribir`, `-Cambiar`, `-Mostrar`) |
| `compilar.ps1` | Compila frontend y backend (`-Codigo`, `-Salida`) |
| `instalar-servicios.ps1` | Servicios SUMMIT-Backend y SUMMIT-Web (`-Quitar`, `-Simular`, `-Java`, `-MemoriaMaxima`, `-Cuenta`) |
| `programar-copia.ps1` | Tarea diaria (`-Hora`, `-ProbarAhora`, `-Quitar`) |
| `copia-de-seguridad.ps1` | Una copia (`-Etiqueta`, `-SinDestinoExterno`) |
| `restaurar-copia.ps1` | Prueba (por defecto, `-BorrarAlTerminar`, `-BorrarPrueba`) o real (`-ReemplazarBaseReal`, `-PedirClave`, `-SinCopiaPrevia`) |
| `doctor.ps1` | Chequeo (0 = bien, 2 = avisos, 1 = problemas) |
| `actualizar.ps1` | Versión nueva con copia previa (`-VolverAtras`, `-Simular`) |
| `doctor.cmd`, `copia-ahora.cmd`, `probar-restauracion.cmd` | Accesos directos de doble clic (piden administrador) |
| `comun.ps1` | Funciones compartidas |

Todos usan `C:\SUMMIT\config\summit.psd1` (o el que se indique con `-Config`), están escritos para Windows PowerShell
5.1 y se guardan en UTF-8 con BOM (sin BOM, PowerShell 5.1 lee mal los acentos).

### M. Fuentes

- Shawl: [repositorio y versiones](https://github.com/mtkennerly/shawl/releases), [opciones](https://github.com/mtkennerly/shawl/blob/master/docs/cli.md)
- WinSW: [versiones](https://github.com/winsw/winsw/releases) · NSSM: [descargas](https://nssm.cc/download) · Servy: [repositorio](https://github.com/aelassas/servy)
- Spring Boot como servicio de Windows: [documentación](https://docs.spring.io/spring-boot/how-to/deployment/installing.html)
- Caddy: [como servicio de Windows](https://caddyserver.com/docs/running), [versiones](https://github.com/caddyserver/caddy/releases) (2.11.7, 3/10/2026)
- 7-Zip: [sitio oficial](https://www.7-zip.org/) (26.05, 21/10/2026)
- mysqldump y el permiso PROCESS: [MySQL bug #100219](https://bugs.mysql.com/bug.php?id=100219), [#100229](https://bugs.mysql.com/bug.php?id=100229)
- Ollama en Windows: [documentación](https://docs.ollama.com/windows)
