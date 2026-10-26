# Fases del proyecto SUMMIT

Plan de trabajo del sistema. La lista original de fases se perdió junto con el chat donde se armó; esta
versión se rehízo el 19/10/2026: lo **hecho** sale de los commits del repositorio y lo **pendiente**, de un
repaso del código. El orden de lo pendiente es una propuesta: si te acordás de algo de la lista original que
no esté acá, sumalo.

## Hecho

### Etapa 1: poner el sistema en marcha (1 al 7 de octubre)

| Fase | Qué incluyó | Commits |
|---|---|---|
| Fase 1 | Arreglos de seguridad y bugs al levantar el sistema; admin y planes iniciales, planes por frecuencia y alta de personal | `59937ca`, `8db37a8` |
| Control de acceso | Recepción: límite semanal, ficha del socio y Dashboard con datos reales | `129985e` |
| Paso 2 | Pantallas conectadas al backend: socios, certificados (con archivo), caja, clases y reservas | `107b608` |
| Seguridad | Los tokens de cuentas desactivadas dejan de servir, CORS configurable, errores unificados y limitador de pedidos | `108c0a6`, `ac2acb9`, `462664d`, `c6872d8` |
| Paso 3 | Rutinas por día, rutina de hoy, registro de entrenamientos e historial con gráficos | `9ddfcf5`, `d829904` |
| Paso 4 | Portal del socio para el celular: estado, credencial con QR, rutina, clases y cuenta | `418903c`, `5175d96` |
| Asistente de IA | Ollama local: lee certificados médicos y sugiere ejercicios a evitar | `2636880`, `cee3671` |

### Etapa 2: pagos y control (11 de octubre)

| Fase | Qué incluyó | Commits |
|---|---|---|
| Fase 1 | Estado de los pagos presenciales (aprobado, a verificar, rechazado) y quién cobró | `6891ff0` |
| Fase 2 | Débito automático mensual opcional con Mercado Pago | `119aae7`, `9d6dd66` |
| Fase 3 | Métricas reales: Analítica de Socios y Métricas de Planes | `ce0dad4` |
| Fase 4 | Ingreso por excepción, con motivo y registro de quién lo autorizó | `68e25b5` |
| Fase 5 | Rechazar o volver a aprobar certificados médicos | `4092ebd` |

### Después de la etapa 2 (14 al 19 de octubre)

- Aviso de certificados médicos que parecen falsos (`ff16f3a`).
- README con los pasos para levantar el proyecto (`b6a36a3`).
- Contraseñas y clave de las sesiones fuera del repositorio (`73118b1`).

## Pendiente (propuesta, en este orden)

### Etapa 3: app del socio (PWA), suspendida hasta después de la tesis

El plan completo y las decisiones están en [PLAN-APP-SOCIOS.md](PLAN-APP-SOCIOS.md): A0 preparar las pruebas en
el celular, A1 app instalable, A2 sesión larga, A3 entrenamiento sin conexión y catálogo, A4 ingreso con QR y
ubicación, A5 planes, profesores e información del gimnasio (cubre la Fase 11), A6 progreso, A7 notificaciones y
lista de espera, y A8 chat con recepción (cubre el Chat de la Fase 8). Están todas hechas (la última, el
25/10/2026).

El 25/10/2026 se decidió suspenderla hasta después de presentar la tesis, sin borrar nada:
`summit.app-socios.habilitada=false` (application.properties). Así los socios no pueden entrar, el portal y el chat
no responden, no salen notificaciones, y el panel oculta lo que existe solo para la app (Chat, Novedades, perfil
público de los profesores, ingreso con QR, la contraseña del socio). Para volver a usarla se pone en true.

### Etapa 4: terminar el gestor del gimnasio (en curso desde el 25/10/2026)

El foco es el panel, para que el dueño y recepción trabajen más rápido y prolijo. Decisiones del 25/10/2026: la
agenda de clases queda en el panel; las rutinas y el catálogo interactivo quedan para los profesores, que tienen
que poder usarlos desde una tablet o un celular; por ahora no se venden productos en recepción; la factura
electrónica de ARCA (ex AFIP) va al final, después de explicar cómo hacerla.

1. Suspender la app del socio (hecho el 25/10/2026).
2. Cobro rápido desde el tablero y desde el control de acceso, y comprobante de pago imprimible o en PDF (hecho el
   26/10/2026: después de cobrar se muestra el comprobante A5 con los datos del gimnasio, el detalle, el total y
   hasta cuándo quedó paga la membresía; se imprime, se descarga, se comparte o se le avisa al socio por WhatsApp, y
   desde la caja se vuelve a abrir el de cualquier cobro. Dice que no es una factura).
3. Caja completa: gastos y cierre de caja diario por medio de pago (Fase 10, sin productos; hecho el 26/10/2026).
4. Seguimiento de socios: inactividad con datos reales, tareas automáticas y contacto por WhatsApp (Fase 8, hecha el
   26/10/2026).
5. Membresías flexibles: congelar una membresía, descuentos y matrícula de inscripción (hecho el 26/10/2026, ver
   abajo).
6. Asistencia del personal (Fase 9, hecha el 26/10/2026).
7. Rutinas desde tablet o celular, e impresas o en PDF bien diseñado (hecho el 26/10/2026: las pantallas del profesor
   tienen botones y campos para el dedo en tablet y celular, el constructor busca ejercicios por palabra, por grupo o
   tocando el cuerpo, y la rutina se imprime, se descarga o se comparte por WhatsApp como un PDF A4 con los datos del
   gimnasio. La base de PDF, en `summit-frontend/src/components/pdf/`, queda para los comprobantes).
8. Terminaciones: logo del gimnasio (Fase 11), importar socios desde Excel, los botones decorativos de arriba y
   las limpiezas chicas (hecho el 26/10/2026). La importación (botón *Importar* de la lista de socios, solo admin) lee
   un .xlsx o el CSV que guarda Excel, reconoce las columnas por su título, muestra una vista previa con lo que está
   mal y después el resultado de cada fila; un DNI que ya estaba no se toca, y con Plan y Vence el socio queda con su
   membresía hasta esa fecha.
9. Dejarlo listo para el gimnasio: instalación, copias de seguridad cifradas (Fase 12) y tests automáticos
   (Fase 7).
10. Factura electrónica de ARCA.

#### Membresías flexibles (hecha el 26/10/2026)

- *Membresías > Descuentos y reglas* (solo admin): la matrícula de inscripción (monto, y después de cuántos días sin
  cuota se vuelve a cobrar), los límites del congelamiento (mínimo por vez y máximo por año) y el catálogo de
  descuentos (porcentaje o monto fijo sobre el precio del plan).
- Cada socio puede tener un descuento habitual (se elige en el alta o al editarlo). Al cobrar se propone el habitual;
  se puede elegir otro, hacer uno especial con motivo o bonificar la matrícula. El total lo calcula el backend y se
  muestra antes de confirmar: si mientras tanto cambió un precio, el cobro no se registra y se muestra el total nuevo.
- Cada cobro guarda su detalle (precio de lista, descuento y matrícula), que se ve en la caja y va a ir en el
  comprobante.
- Congelamiento desde la ficha del socio: corre el vencimiento esos días y, mientras dura, el control de acceso no lo
  deja pasar. Si vuelve antes, recepción lo termina desde la ficha o desde el mismo control de acceso, y se le
  descuentan los días que no usó. *Estado de Membresías* tiene una pestaña *Congeladas*.

La numeración de las fases siguientes sigue la de la etapa 2.

### Fase 6: contraseñas (hecha el 24/10/2026, con lo opcional)

- Cada uno cambia la suya pidiendo la actual: en el panel, desde el menú de su nombre (arriba a la derecha); en la
  app del socio, desde *Perfil*. Al cambiarla se cierran sus sesiones en los otros dispositivos.
- Recepción (a los socios, desde la ficha) y el admin (también al personal, desde *Ajustes > Equipo*) restablecen
  una contraseña con una temporal de 10 caracteres, para darla en persona.
- Con una contraseña temporal no se puede usar nada hasta elegir una propia: al entrar aparece la pantalla para
  hacerlo. Lo mismo pasa con la contraseña inicial de una cuenta nueva y con la de `ADMIN_PASSWORD`.
- "¿Olvidaste tu contraseña?" por email, con un link de un solo uso que vence a los 30 minutos. Se activa
  configurando un correo saliente (`MAIL_HOST` y compañía) y la dirección pública de la app (`APP_URL`); sin eso,
  el login dice que la contraseña la restablece el gimnasio.
- Reglas: 8 caracteres o más, con letras y números. Cambiarla, pedir el mail y usar el link: hasta 5 intentos por
  minuto.

### Fase 7: tests automáticos (prioridad alta)

No hay ningún test: `summit-backend/src/test` no existe y el frontend no tiene script de pruebas. Las pruebas
por API que se hicieron en cada fase quedaron solo descriptas en los commits.

- Tests de integración del backend, con una base aparte, para las reglas críticas: control de acceso (límite
  semanal, cuota, apto, excepción), cobros (solo los aprobados extienden la membresía), certificados (365
  días, rechazo), permisos por rol y portal (cada socio ve solo lo suyo).
- Tests de las reglas exactas del asistente de IA (`advertencias`).
- Que se corran con `.\mvnw.cmd test`.

### Fase 8: seguimiento de socios (hecha el 26/10/2026)

- **Inactividad** con datos reales: socios con la cuota al día (o vencida hace hasta 30 días), sin los congelados,
  que hace 7 días o más que no vienen, con su último ingreso, el promedio semanal de los últimos 90 días y un nivel
  (leve de 7 a 14 días, media de 15 a 29, alta de 30 o más; si nunca vino, desde el alta). Resumen de cuántos socios
  al día vinieron en la semana y exportación a Excel.
- **Tareas de seguimiento** que se generan solas cada hora (y al entrar a la pantalla): cuota por vencer en 5 días
  (sin débito automático), cuota vencida hace hasta 15 días, apto por vencer en 15 días (si el gimnasio lo exige) y
  socio al día que hace 15 días o más que no viene. La misma situación no genera dos tareas, y una pendiente se
  resuelve sola cuando el socio renueva, trae el apto o vuelve. Recepción también carga tareas a mano, las marca como
  hechas (por qué canal y qué dijo el socio) o las descarta. El menú y la campanita muestran cuántas hay pendientes.
- Contacto por WhatsApp con un enlace que abre el mensaje ya escrito para cada caso (sin servicios pagos), y registro
  de cada contacto.
- El "débito rechazado" no se hizo: Mercado Pago no informa los cobros rechazados de una suscripción como un estado.
- **Chat**: hecho en la A8 de la app (bandeja de recepción en el panel y pestaña Mensajes en la app).

### Fase 9: asistencia del personal (hecha el 26/10/2026)

- El equipo (recepción, profesores y admin) marca la entrada y la salida pasando el DNI por el *Control de acceso* del
  Dashboard, igual que los socios: si tiene un turno en curso, su paso es la salida; si no, una entrada. La ficha dice
  "Entrada" o "Salida" con la hora y, en la salida, cuánto trabajó. Para los socios no cambia nada.
- Casos raros: turno partido (dos turnos el mismo día), turnos que pasan la medianoche (cuentan en el día en que
  empezaron) y salidas olvidadas (a las 16 horas el turno queda "sin salida" y no suma hasta que se corrige; nunca se
  inventa una hora). Si el sistema toma un paso al revés, recepción lo corrige en el momento ("Es una entrada" / "Es una
  salida"). El mismo DNI dos veces seguidas no registra nada.
- *Ajustes > Asistencia del personal* (solo el admin): quién está trabajando ahora, los turnos sin salida y las horas de
  cada persona por día, semana o mes, con filtro por persona y exportación a CSV (resumen y detalle por turno). Ahí se
  cargan turnos olvidados, se corrigen horas y se anulan turnos: queda quién, cuándo, por qué y las horas de antes.

### Fase 10: caja completa (hecha el 26/10/2026, sin productos)

- Gastos (egresos) con rubro, medio de pago y comprobante. Uno cargado por error se anula con motivo (queda tachado),
  solo mientras su turno sigue abierto.
- Turno de caja: desde el último cierre (o desde el comienzo del día, si nunca se cerró). La pantalla de Caja muestra
  cuánto efectivo tendría que haber: el fondo que dejó el cierre anterior, más los cobros en efectivo, menos los
  gastos en efectivo.
- Cierre de caja (arqueo): muestra lo que se movió por cada medio de pago; recepción escribe el efectivo que contó y
  ve al instante si coincide, falta o sobra (con diferencia, la observación es obligatoria). Lo que no se retira
  queda de fondo para el turno siguiente. Los cierres quedan en un historial con su detalle.
- Venta de productos en recepción (agua, suplementos) con un stock simple: el 25/10/2026 se decidió no hacerla por
  ahora.

### Fase 11: datos del gimnasio (hecha)

"Ajustes > General" ofrecía formatos de fecha, moneda y zona horaria de varios países, pero el sistema es para
Argentina. El 20/10/2026 se reemplazó por *Ajustes > Datos del gimnasio* (nombre, dirección, contacto, horarios,
capacidad y reglamento), que ya usa la app del socio. Desde el 26/10/2026 también van en el encabezado de los PDF
(rutinas y comprobantes de pago), con el logo del gimnasio: se sube ahí mismo (PNG o JPG; queda como PNG de hasta
512 px, con transparencia).

### Fase 12: puesta en producción

- Elegir dónde corre (PC del gimnasio o servidor), compilar el frontend y servirlo con HTTPS.
- Poner la dirección real en `summit.cors.origins` y los valores privados como variables de entorno.
- Copias de seguridad automáticas de la base y de `uploads/` (certificados: datos de salud, Ley 25.326).
- Tener en cuenta la RAM para la IA: `gemma4:12b` ocupa unos 10 GB.
- Hecho el 26/10/2026: [INSTALACION.md](INSTALACION.md) e `instalacion/` (servicios: backend y Caddy adelante; copias
  diarias cifradas con restauración probada; usuarios de MySQL con permisos mínimos; chequeo). Falta el dominio y el
  HTTPS público (túnel), y poner esa dirección en `summit.cors.origins` y `APP_URL`. La primera corrida de lo que pide
  administrador (servicios, tarea como SYSTEM, firewall) se hace en la PC del gimnasio.

## Limpiezas chicas (hechas el 26/10/2026)

- Se borraron `Membresias.jsx` (no se usaba) y la pantalla de ejemplo *Tablas del Sistema*.
- El backend ya no avisa al arrancar: sin `MySQL8Dialect` (lo detecta Hibernate) y con `spring.jpa.open-in-view`
  explícito. `spring.jpa.show-sql` quedó en false.
- Se borró la rama `pagos-debito-metricas`, que ya estaba incluida en `main` (era el commit 5183acf).
- `npm run lint` pasa: el frontend tiene `.eslintrc.cjs` y se corrigieron los imports sin usar.
- La barra de arriba ya no tiene los botones de ejemplo (idioma, modo oscuro y la flecha).
