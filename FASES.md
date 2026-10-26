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
2. Cobro rápido desde el tablero y desde el control de acceso, y comprobante de pago imprimible o en PDF.
3. Caja completa: gastos y cierre de caja diario por medio de pago (Fase 10, sin productos).
4. Seguimiento de socios: inactividad con datos reales, tareas automáticas y contacto por WhatsApp (Fase 8).
5. Membresías flexibles: congelar una membresía, descuentos y matrícula de inscripción (hecho el 26/10/2026, ver
   abajo).
6. Asistencia del personal (Fase 9).
7. Rutinas desde tablet o celular, e impresas o en PDF bien diseñado.
8. Terminaciones: logo del gimnasio (Fase 11), importar socios desde Excel, los botones decorativos de arriba y
   las limpiezas chicas.
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

### Fase 8: seguimiento de socios

Dos pantallas "Demo" de Socios (Inactividad y Tareas CRM) muestran datos de ejemplo.

- **Inactividad** con datos reales: los ingresos ya se registran, así que se pueden calcular los días sin
  venir, el promedio semanal de los últimos 90 días y un nivel de riesgo.
- **Tareas CRM** que se generan solas: cuota por vencer, apto por vencer, socio inactivo, débito rechazado.
  Recepción las marca como hechas.
- Contacto por WhatsApp con un enlace que abre el mensaje ya escrito (sin servicios pagos).
- **Chat**: hecho en la A8 de la app (bandeja de recepción en el panel y pestaña Mensajes en la app).

### Fase 9: asistencia del personal

"Asistencia Staff" es demo. El ingreso del personal por recepción ya queda registrado como presentismo;
falta la salida.

- Registrar la salida, calcular las horas trabajadas por día y por mes, y exportarlas a CSV.

### Fase 10: caja completa

"Tablas del Sistema" anuncia Métodos de pago, Gastos y Productos como "en desarrollo".

- Gastos (egresos) en la caja y cierre de caja diario por medio de pago.
- Venta de productos en recepción (agua, suplementos) con un stock simple: el 25/10/2026 se decidió no hacerla por
  ahora.

### Fase 11: datos del gimnasio (hecha en la A5 de la app, salvo el logo y los comprobantes)

"Ajustes > General" ofrecía formatos de fecha, moneda y zona horaria de varios países, pero el sistema es para
Argentina. El 20/10/2026 se reemplazó por *Ajustes > Datos del gimnasio* (nombre, dirección, contacto, horarios,
capacidad y reglamento), que ya usa la app del socio. Quedan el logo (todavía no está decidido) y usar estos
datos en los comprobantes.

### Fase 12: puesta en producción

- Elegir dónde corre (PC del gimnasio o servidor), compilar el frontend y servirlo con HTTPS.
- Poner la dirección real en `summit.cors.origins` y los valores privados como variables de entorno.
- Copias de seguridad automáticas de la base y de `uploads/` (certificados: datos de salud, Ley 25.326).
- Tener en cuenta la RAM para la IA: `gemma4:12b` ocupa unos 10 GB.

## Limpiezas chicas (en cualquier momento)

- `summit-frontend/src/pages/Membresias.jsx` no se usa (la ruta usa `EstadoMembresias.jsx`).
- Avisos al arrancar el backend: `MySQL8Dialect` está deprecado y conviene definir `spring.jpa.open-in-view`.
- `spring.jpa.show-sql=true` llena la consola de SQL: apagarlo fuera de desarrollo.
- La rama `pagos-debito-metricas` ya está incluida en `main`: se puede borrar.
- `npm run lint` falla porque el frontend no tiene archivo de configuración de ESLint.
