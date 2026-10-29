# Fases del proyecto SUMMIT

Plan de trabajo del sistema. La lista original de fases se perdió junto con el chat donde se armó; esta
versión se rehízo el 19/10/2026: lo **hecho** sale de los commits del repositorio y lo **pendiente**, de un
repaso del código. El orden de lo pendiente es una propuesta: si te acordás de algo de la lista original que
no esté acá, sumalo.

## Hecho

### Etapa 1: poner el sistema en marcha (1 al 7 de octubre)

| Fase | Qué incluyó | Commits |
|---|---|---|
| Fase 1 | Arreglos de seguridad y bugs al levantar el sistema; admin y planes iniciales, planes por frecuencia y alta de personal | `0d83f30`, `a547b07` |
| Control de acceso | Recepción: límite semanal, ficha del socio y Dashboard con datos reales | `6b96885` |
| Paso 2 | Pantallas conectadas al backend: socios, certificados (con archivo), caja, clases y reservas | `75f761f` |
| Seguridad | Los tokens de cuentas desactivadas dejan de servir, CORS configurable, errores unificados y limitador de pedidos | `d451dfc`, `14a37ce`, `d74fe15`, `b15c0c5` |
| Paso 3 | Rutinas organizadas por día | `f486431`, `c86d9cd` |
| Asistente de IA | Ollama local: lee certificados médicos y sugiere ejercicios a evitar | `e4d17de`, `ed08401` |

### Etapa 2: pagos y control (11 de octubre)

| Fase | Qué incluyó | Commits |
|---|---|---|
| Fase 1 | Estado de los pagos presenciales (aprobado, a verificar, rechazado) y quién cobró | `4764856` |
| Fase 2 | Débito automático mensual opcional con Mercado Pago | `e721299`, `1781841` |
| Fase 3 | Métricas reales: Analítica de Socios y Métricas de Planes | `a2f791d` |
| Fase 4 | Ingreso por excepción, con motivo y registro de quién lo autorizó | `969e283` |
| Fase 5 | Rechazar o volver a aprobar certificados médicos | `6d6e2d6` |

### Después de la etapa 2 (14 al 19 de octubre)

- Aviso de certificados médicos que parecen falsos (`652e830`).
- README con los pasos para levantar el proyecto (`fe04efc`).
- Contraseñas y clave de las sesiones fuera del repositorio (`26cb0d8`).

## Pendiente (propuesta, en este orden)

### Etapa 3: terminar el gestor del gimnasio (desde el 25/10/2026)

El foco es el panel, para que el dueño y recepción trabajen más rápido y prolijo. Decisiones del 25/10/2026: la
agenda de clases queda en el panel; las rutinas y el catálogo interactivo quedan para los profesores, que tienen
que poder usarlos desde una tablet o un celular; por ahora no se venden productos en recepción; la factura
electrónica de ARCA (ex AFIP) va al final, después de explicar cómo hacerla.

1. Cobro rápido desde el tablero y desde el control de acceso, y comprobante de pago imprimible o en PDF (hecho el
   26/10/2026: después de cobrar se muestra el comprobante A5 con los datos del gimnasio, el detalle, el total y
   hasta cuándo quedó paga la membresía; se imprime, se descarga, se comparte o se le avisa al socio por WhatsApp, y
   desde la caja se vuelve a abrir el de cualquier cobro. Dice que no es una factura).
2. Caja completa: gastos y cierre de caja diario por medio de pago (Fase 10, sin productos; hecho el 26/10/2026).
3. Seguimiento de socios: inactividad con datos reales, tareas automáticas y contacto por WhatsApp (Fase 8, hecha el
   26/10/2026).
4. Membresías flexibles: congelar una membresía, descuentos y matrícula de inscripción (hecho el 26/10/2026, ver
   abajo).
5. Asistencia del personal (Fase 9, hecha el 26/10/2026).
6. Rutinas desde tablet o celular, e impresas o en PDF bien diseñado (hecho el 26/10/2026: las pantallas del profesor
   tienen botones y campos para el dedo en tablet y celular, el constructor busca ejercicios por palabra, por grupo o
   tocando el cuerpo, y la rutina se imprime, se descarga o se comparte por WhatsApp como un PDF A4 con los datos del
   gimnasio. La base de PDF, en `summit-frontend/src/components/pdf/`, queda para los comprobantes).
7. Terminaciones: logo del gimnasio (Fase 11), importar socios desde Excel, los botones decorativos de arriba y
   las limpiezas chicas (hecho el 26/10/2026). La importación (botón *Importar* de la lista de socios, solo admin) lee
   un .xlsx o el CSV que guarda Excel, reconoce las columnas por su título, muestra una vista previa con lo que está
   mal y después el resultado de cada fila; un DNI que ya estaba no se toca, y con Plan y Vence el socio queda con su
   membresía hasta esa fecha.
8. Dejarlo listo para el gimnasio: instalación, copias de seguridad cifradas (Fase 12) y tests automáticos
   (Fase 7). Hecho el 26/10/2026; falta solo lo que se hace en la PC del gimnasio (ver Fase 12).
9. Factura electrónica de ARCA (hecha el 28/10/2026 contra el simulador, ver abajo y [FACTURACION.md](FACTURACION.md)).
    Falta probarla en homologación con un certificado de prueba y, para usarla de verdad, los trámites del dueño con su
    contador.
10. Cobro más simple (hecho el 28/10/2026, pedido después de probar el panel): en la lista de socios el botón de cobro
    aparece solo si el socio tiene algo para pagar (*Cobrar* sin membresía o vencida, *Renovar* si vence en 7 días o
    menos; un cobro a verificar queda marcado y no se ofrece cobrarle de nuevo). El cobro propone el plan que ya tiene, y
    el plan y el medio de pago se eligen con un toque. En el alta de socio el cobro es el último paso: un solo botón
    registra y cobra, y al terminar queda el comprobante (o la factura) para imprimir o mandar por WhatsApp.
11. Caja sin efectivo negativo (hecho el 28/10/2026, pedido después de probar el cierre): un gasto en efectivo no puede
    superar lo que hay en la caja (el formulario muestra cuánto hay); si lo pagó el dueño con su plata se marca "No salió
    de la caja" y cuenta como gasto del mes pero no en el arqueo. En el cierre, un contado negativo o un retiro mayor a lo
    contado se avisan en el momento, y una caja que ya venía en negativo explica por qué y lleva a revisar los gastos.
12. Entrenamiento sin seguimiento (hecho el 28/10/2026, decisión del dueño): el gimnasio no sigue lo que entrena cada
    socio, la rutina le llega impresa o digital. Se sacaron del panel *Rutina de hoy*, *Historial* y, en *Rutinas*, lo
    que dependía de los entrenamientos anotados (último entrenamiento, entrenaron esta semana, sin entrenar).
13. Versiones al día (hecho el 28/10/2026): backend en Spring Boot 4.1 (Spring Framework 7, Spring Security 7,
    Hibernate 7, Jackson 3) y frontend en React 19, Vite 8, Tailwind CSS 4, React Router 8 y ESLint 10. El panel se ve
    igual que antes (comparado pantalla por pantalla).
14. Modo oscuro (hecho el 28/10/2026): botón sol/luna en la barra de arriba; la primera vez sigue al sistema.
15. Cobro con tarjeta por Mercado Pago (hecho el 29/10/2026, ver abajo).
16. Menos código (hecho el 28/10/2026): fuera el código que ya no se usaba (consultas de los repositorios, pantallas y
    archivos sueltos) y 8 DTOs que pasan a record, sin perder funciones.

#### Cobro con tarjeta por Mercado Pago (hecho el 29/10/2026)

- Medio *Tarjeta MP* al cobrar (cobro, cobro rápido y alta de socio). La tarjeta se carga en el formulario de Mercado
  Pago (Card Payment Brick, con su SDK oficial para React), que la devuelve como un token: los datos de la tarjeta nunca
  pasan por SUMMIT. El backend cobra con el SDK oficial de Java, siempre el total que calculó él.
- Primero se controla el total contra el que vio recepción (si cambió un precio, no se llega a cobrar); después se cobra
  y recién ahí se registra, con el número de Mercado Pago (no se repite). Una clave por intento evita cobrar dos veces si
  el pedido se repite por un corte de conexión.
- Aprobado: entra como cualquier cobro (débito o crédito según la tarjeta), con comprobante y factura. Rechazado: se
  avisa el motivo (sin fondos, código incorrecto...) y no se registra nada. En proceso: queda a verificar y una tarea se
  lo pregunta a Mercado Pago cada 5 minutos hasta que se acredita (no hace falta publicar el sistema en internet).
- Simulador adentro del backend (`MP_TARJETA=SIMULADOR`) para probar y mostrar sin cuenta, con los mismos titulares que
  las tarjetas de prueba de Mercado Pago. 5 tests del backend y una prueba en el navegador de punta a punta.

#### Factura electrónica (hecha el 28/10/2026)

- Integración propia con ARCA (WSAA y WSFEv1), sin servicios de terceros: la clave del certificado y los datos de los
  socios no salen de la PC del gimnasio. Apagada por defecto (`ARCA_HABILITADA`); ambientes simulador, homologación y
  producción (`ARCA_AMBIENTE`).
- Cada cobro aprobado deja su factura en la misma transacción y una cola la manda a ARCA enseguida: Factura C si el dueño
  es monotributista, B con el IVA contenido si es responsable inscripto, a consumidor final o con el DNI del socio.
  Reintentos cada vez más espaciados; si se corta la conexión al pedir el CAE, se le pregunta a ARCA antes de usar otro
  número (nunca se duplica ni se saltea). Un rechazo no gasta el número.
- Nota de crédito de la misma letra para anular, y volver a facturar el cobro (por ejemplo, con el DNI). Ya manda la
  condición frente al IVA del receptor, obligatoria desde el 1/12/2026.
- Panel: *Caja & Pagos > Facturas* (estado de cada una, mandar ahora, detalle, reintentar y anular), *Ajustes >
  Facturación* (datos fiscales, certificado y prueba de conexión), la factura de cada cobro en la caja y en el paso final
  del cobro. PDF A4 con los datos que pide ARCA, el CAE y el QR (verificado: se lee y trae los datos del comprobante); sin
  validez fiscal fuera de producción, con marca de agua.
- Simulador de ARCA adentro del backend (mismos mensajes SOAP, valida numeración, fechas, IVA y notas de crédito) para
  probar y mostrar sin certificado. 16 tests contra el simulador.
- Quedan para el contador: Factura A, CAEA de contingencia y duplicados electrónicos (RG 3685).

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

- Cada uno cambia la suya pidiendo la actual, desde el menú de su nombre (arriba a la derecha). Al cambiarla se
  cierran sus sesiones en los otros dispositivos.
- El admin restablece la contraseña de otro miembro del equipo (*Ajustes > Equipo*) con una temporal de 10
  caracteres, para darla en persona. Los socios no entran al sistema: no tienen contraseña.
- Con una contraseña temporal no se puede usar nada hasta elegir una propia: al entrar aparece la pantalla para
  hacerlo. Lo mismo pasa con la contraseña inicial de una cuenta nueva y con la de `ADMIN_PASSWORD`.
- "¿Olvidaste tu contraseña?" por email, con un link de un solo uso que vence a los 30 minutos. Se activa
  configurando un correo saliente (`MAIL_HOST` y compañía) y la dirección del panel (`APP_URL`); sin eso, el login
  dice que la contraseña la restablece el admin.
- Reglas: 8 caracteres o más, con letras y números. Cambiarla, pedir el mail y usar el link: hasta 5 intentos por
  minuto.

### Fase 7: tests automáticos (hecha el 26/10/2026)

Tests del backend que se corren con `.\mvnw.cmd test`, en una base aparte (`summit_test`, se crea y se vacía
sola) y cada uno deshace lo que hizo:

- Control de acceso: límite semanal (volver el mismo día no cuenta otro), cuota vencida con y sin días de gracia,
  apto médico vencido o rechazado, excepción de recepción, congelamiento y cuenta dada de baja.
- Cobros: el total lo calcula el backend (descuentos y matrícula, que se puede bonificar o vuelve a cobrarse), solo
  los aprobados extienden la membresía y un total que cambió no se cobra.
- Congelamiento (mínimo, máximo por año, sin superponerse, terminarlo antes), caja (efectivo esperado, gastos
  anulados, diferencia con observación, fondo para el turno siguiente), seguimiento (tareas automáticas que no se
  repiten y se resuelven solas), certificados (365 días, rechazo) e importación de socios.
- Permisos por rol y por estado de la cuenta (contraseña temporal, cuenta dada de baja; un socio no puede entrar).
- Las reglas exactas del asistente de IA (`advertencias`).

Los tests encontraron un error real, ya corregido: un cobro o un gasto hecho en el mismo segundo que el cierre de
caja podía quedar afuera de los dos turnos. Ahora los horarios se guardan con la precisión de la base.

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
Argentina. El 20/10/2026 se reemplazó por *Ajustes > Datos del gimnasio* (nombre, dirección y contacto). Desde el
26/10/2026 van en el encabezado de los PDF
(rutinas y comprobantes de pago), con el logo del gimnasio: se sube ahí mismo (PNG o JPG; queda como PNG de hasta
512 px, con transparencia).

### Fase 12: puesta en producción

- Elegir dónde corre (PC del gimnasio o servidor), compilar el frontend y servirlo con HTTPS.
- Poner la dirección real en `summit.cors.origins` y los valores privados como variables de entorno.
- Copias de seguridad automáticas de la base y de `uploads/` (certificados: datos de salud, Ley 25.326).
- Tener en cuenta la RAM para la IA: `gemma4:12b` ocupa unos 10 GB.
- Hecho el 26/10/2026: [INSTALACION.md](INSTALACION.md) e `instalacion/` (servicios: backend y Caddy adelante; copias
  diarias cifradas con restauración probada; usuarios de MySQL con permisos mínimos; chequeo). El sistema se usa solo
  dentro de la red del gimnasio: no hace falta publicarlo en internet. La primera corrida de lo que pide administrador
  (servicios, tarea como SYSTEM, firewall) se hace en la PC del gimnasio.

## Limpiezas chicas (hechas el 26/10/2026)

- Se borraron `Membresias.jsx` (no se usaba) y la pantalla de ejemplo *Tablas del Sistema*.
- El backend ya no avisa al arrancar: sin `MySQL8Dialect` (lo detecta Hibernate) y con `spring.jpa.open-in-view`
  explícito. `spring.jpa.show-sql` quedó en false.
- Se borró la rama `pagos-debito-metricas`, que ya estaba incluida en `main` (era el commit 9e27221).
- `npm run lint` pasa: el frontend tiene `.eslintrc.cjs` y se corrigieron los imports sin usar.
- La barra de arriba ya no tiene los botones de ejemplo (idioma, modo oscuro y la flecha).
