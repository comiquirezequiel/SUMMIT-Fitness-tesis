# SUMMIT · Modelo Lógico (Relacional) y Diccionario de Datos

Sistema de gestión de gimnasio (Panel Administrativo y Operativo) · MySQL 8.x · base `summit_fitness_db` · **30 tablas relacionales**.

Segunda etapa del diseño de persistencia de datos. Se deriva del [Modelo Entidad-Relación (DER)](01-modelo-entidad-relacion.md) y se implementa con el [Script DDL de Creación](03-creacion-summit.sql). Las 30 tablas son las 28 entidades JPA del backend (`com.summit.backend.model`) más las 2 colecciones `@ElementCollection` (`cierres_caja_metodos` y `datos_gimnasio_horarios`).

> **Alcance:**
> El modelo documenta la persistencia del **sistema de gestión del gimnasio**, que usa solo el personal (dueño/administración, recepción y profesores). Los socios se registran en `usuarios` con rol `SOCIO` pero no inician sesión: son fichas que maneja el personal. La app móvil de socios, el chat, las notificaciones push, las novedades, la lista de espera de clases y el registro de entrenamientos ya no forman parte del sistema y sus tablas se eliminaron del modelo. Se incorporó la **facturación electrónica de ARCA** y el **seguimiento de socios (CRM)**.

## Convenciones de Nomenclatura e Integridad

| Elemento | Convención Técnica |
|---|---|
| Tablas y campos | `snake_case` en español. Tablas en plural (`usuarios`, `planes`, `gastos`), salvo las de configuración (`configuracion_acceso`, `datos_gimnasio`). |
| Clave Primaria (PK) | `id_<entidad>`, tipo `BIGINT AUTO_INCREMENT`. Las tablas de configuración de registro único usan un id fijo (`1`) asignado por el backend; las colecciones usan clave compuesta. |
| Clave Foránea (FK) | `<rol>_id` o `<tabla>_id` (`usuario_id`, `plan_id`, `profesor_id`, `registrado_por_id`). En el script, restricción explícita `fk_<tabla>_<rol>`. |
| Dominios / Enums | `VARCHAR` con restricción `CHECK ... IN (...)`, en correspondencia 1:1 con las enumeraciones Java (`@Enumerated(EnumType.STRING)` + `@JdbcTypeCode(SqlTypes.VARCHAR)`: texto y no `ENUM` de MySQL, para que agregar un valor no rompa la base). |
| Tipos booleanos | `BOOLEAN` en el script (`TINYINT(1)` en InnoDB). Hibernate, al crear la base solo, usa `BIT(1)`; ambos se leen igual desde Java. |
| Fechas y horas | `DATE` para días, `DATETIME(6)` para instantes (precisión de microsegundos: los cobros y gastos se comparan exactamente con los turnos de caja) y `TIME(6)` para horarios. |
| Importes | `DECIMAL(10,2)` en cobros y planes; `DECIMAL(12,2)` en caja, gastos y comprobantes fiscales. Nunca `FLOAT`/`DOUBLE` para dinero. |
| Integridad histórica | Los registros con valor contable o legal no se borran: se anulan con marca y motivo (`gastos.anulado`, `turnos_personal.anulado`, `congelamientos.anulado`) o se compensan (una factura autorizada se anula con una nota de crédito). |
| Notación | `PK` = Clave Primaria · `FK` = Clave Foránea · `UK` = Clave Única (Unique Key) |

---

## Esquema Relacional (Notación Compacta)

Notación estándar: <ins>subrayado</ins> = Clave Primaria (PK) · `#campo` = Clave Foránea (FK) · `<ins>#campo</ins>` = PK y FK simultáneamente.

- **usuarios** ( <ins>id_usuario</ins>, dni, nombre_completo, email, password, telefono, rol, estado, fecha_creacion, debe_cambiar_password, password_cambiada )
- **perfiles_socio** ( <ins>id_perfil</ins>, #usuario_id, fecha_nacimiento, genero, domicilio, ciudad, objetivo, observaciones, foto_url, foto_actualizada, #descuento_id )
- **recuperaciones_password** ( <ins>id_recuperacion</ins>, #usuario_id, hash_token, creada, vence, usada )
- **certificados_medicos** ( <ins>id_certificado</ins>, #usuario_id, archivo_url, fecha_emision, fecha_vencimiento, estado_legal, observaciones_patologias, resumen_ia, motivo_rechazo, #revisado_por_id, fecha_revision )
- **planes** ( <ins>id_plan</ins>, nombre_plan, descripcion, precio_base, duracion_dias, veces_por_semana, activo )
- **descuentos** ( <ins>id_descuento</ins>, nombre, tipo, valor, activo )
- **suscripciones** ( <ins>id_suscripcion</ins>, #usuario_id, #plan_id, fecha_inicio, fecha_vencimiento, activa )
- **congelamientos** ( <ins>id_congelamiento</ins>, #usuario_id, #suscripcion_id, desde, hasta, motivo, observacion, dias_aplicados, terminado_antes, anulado, #registrado_por_id, fecha_registro )
- **reglas_membresia** ( <ins>id_reglas</ins>, matricula_monto, matricula_reinscripcion_dias, congelamiento_min_dias, congelamiento_max_dias_anio )
- **pago_historial** ( <ins>id_pago</ins>, #usuario_id, #plan_id, monto_abonado, fecha_pago, metodo_pago, comprobante_nro, estado_pago, mp_payment_id, #registrado_por_id, #verificado_por_id, fecha_verificacion, precio_lista, descuento_nombre, descuento_monto, matricula_monto, vence_membresia )
- **debitos_automaticos** ( <ins>id_debito</ins>, #usuario_id, #plan_id, monto, estado, mp_preapproval_id, link_autorizacion, email_pagador, medio_pago, fecha_alta, #creado_por_id, proximo_cobro, ultimo_cobro, ultimo_rechazo, detalle_rechazo, ultima_sincronizacion, fecha_baja, #baja_por_id )
- **gastos** ( <ins>id_gasto</ins>, fecha, monto, categoria, descripcion, metodo_pago, fuera_de_caja, comprobante_nro, #registrado_por_id, anulado, #anulado_por_id, fecha_anulacion, motivo_anulacion )
- **cierres_caja** ( <ins>id_cierre</ins>, desde, hasta, fondo_inicial, ingresos_efectivo, egresos_efectivo, efectivo_esperado, efectivo_contado, diferencia, retiro, fondo_siguiente, total_ingresos, total_egresos, cantidad_cobros, cantidad_gastos, observacion, #cerrado_por_id )
- **cierres_caja_metodos** ( <ins>#cierre_id</ins>, <ins>metodo_pago</ins>, ingresos, egresos )
- **datos_fiscales** ( <ins>id_datos</ins>, cuit, razon_social, condicion_iva, ingresos_brutos, inicio_actividades, domicilio_comercial, punto_venta, identificar_socio )
- **comprobantes_fiscales** ( <ins>id_comprobante</ins>, #pago_id, #comprobante_asociado_id, ambiente, estado, nota_credito, tipo, punto_venta, numero, fecha, cuit_emisor, emisor_razon_social, emisor_domicilio, emisor_condicion_iva, emisor_ingresos_brutos, emisor_inicio_actividades, identificar_receptor, doc_tipo, doc_nro, condicion_iva_receptor, receptor_nombre, imp_total, imp_neto, imp_iva, servicio_desde, servicio_hasta, vencimiento_pago, motivo, cae, cae_vencimiento, observaciones, intentos, proximo_intento, ultimo_error, #solicitado_por_id, creado, autorizado, ultimo_pedido, ultima_respuesta, version )
- **tickets_acceso_arca** ( <ins>id_ticket</ins>, ambiente, huella_certificado, token, firma, vence )
- **configuracion_acceso** ( <ins>id_configuracion</ins>, requerir_membresia_activa, requerir_certificado_medico, permitir_override_manual, dias_gracia_membresia, dias_gracia_certificado )
- **logs_asistencia** ( <ins>id_log</ins>, #usuario_id, fecha_hora, tipo_evento, resultado, #autorizado_por_id, motivo_excepcion )
- **turnos_personal** ( <ins>id_turno</ins>, #usuario_id, entrada, salida, origen, anulado, #log_entrada_id, #log_salida_id )
- **correcciones_turno** ( <ins>id_correccion</ins>, #turno_id, accion, entrada_anterior, salida_anterior, entrada_nueva, salida_nueva, motivo, #autor_id, fecha )
- **clases** ( <ins>id_clase</ins>, nombre, descripcion, capacidad_maxima, #profesor_id, activa )
- **clase_horarios** ( <ins>id_horario</ins>, #clase_id, dia_semana, hora_inicio, hora_fin )
- **reservas_clases** ( <ins>id_reserva</ins>, #usuario_id, #horario_id, fecha_clase, fecha_reserva, estado )
- **ejercicios** ( <ins>id_ejercicio</ins>, nombre, descripcion, grupo_muscular, url_media, svg_target_id, patologias_contraindicadas )
- **rutinas** ( <ins>id_rutina</ins>, nombre, objetivo, #socio_id, #profesor_id, fecha_creacion, activa )
- **rutina_ejercicios** ( <ins>id_rutina_ejercicio</ins>, #rutina_id, #ejercicio_id, dia_numero, orden, series, repeticiones, peso_sugerido_kg, descanso_segundos, observaciones )
- **tareas_seguimiento** ( <ins>id_tarea</ins>, #usuario_id, tipo, descripcion, vence, fecha_referencia, clave, estado, canal, nota, #creada_por_id, fecha_creacion, #resuelta_por_id, fecha_resolucion )
- **datos_gimnasio** ( <ins>id_datos</ins>, nombre, direccion, ciudad, telefono, whatsapp, email, instagram, logo_url, logo_actualizado )
- **datos_gimnasio_horarios** ( <ins>#id_datos</ins>, <ins>orden</ins>, dia, abre, cierra )

**Claves únicas compuestas:** `comprobantes_fiscales (ambiente, cuit_emisor, tipo, punto_venta, numero)` y `tickets_acceso_arca (ambiente, huella_certificado)`.

---

## Matriz de Integridad Referencial (Claves Foráneas)

44 claves foráneas. Todas usan la regla por defecto `RESTRICT` (no se puede borrar un padre con hijos), salvo las de las colecciones (`cierres_caja_metodos`, `datos_gimnasio_horarios`) y `rutina_ejercicios`, que se borran en cascada con su dueño.

| Tabla hija | Campo (FK) | Tabla padre | Campo (PK) |
|---|---|---|---|
| `certificados_medicos` | `revisado_por_id` | `usuarios` | `id_usuario` |
| `certificados_medicos` | `usuario_id` | `usuarios` | `id_usuario` |
| `cierres_caja` | `cerrado_por_id` | `usuarios` | `id_usuario` |
| `cierres_caja_metodos` | `cierre_id` | `cierres_caja` | `id_cierre` |
| `clase_horarios` | `clase_id` | `clases` | `id_clase` |
| `clases` | `profesor_id` | `usuarios` | `id_usuario` |
| `comprobantes_fiscales` | `comprobante_asociado_id` | `comprobantes_fiscales` | `id_comprobante` |
| `comprobantes_fiscales` | `pago_id` | `pago_historial` | `id_pago` |
| `comprobantes_fiscales` | `solicitado_por_id` | `usuarios` | `id_usuario` |
| `congelamientos` | `registrado_por_id` | `usuarios` | `id_usuario` |
| `congelamientos` | `suscripcion_id` | `suscripciones` | `id_suscripcion` |
| `congelamientos` | `usuario_id` | `usuarios` | `id_usuario` |
| `correcciones_turno` | `autor_id` | `usuarios` | `id_usuario` |
| `correcciones_turno` | `turno_id` | `turnos_personal` | `id_turno` |
| `datos_gimnasio_horarios` | `id_datos` | `datos_gimnasio` | `id_datos` |
| `debitos_automaticos` | `baja_por_id` | `usuarios` | `id_usuario` |
| `debitos_automaticos` | `creado_por_id` | `usuarios` | `id_usuario` |
| `debitos_automaticos` | `plan_id` | `planes` | `id_plan` |
| `debitos_automaticos` | `usuario_id` | `usuarios` | `id_usuario` |
| `gastos` | `anulado_por_id` | `usuarios` | `id_usuario` |
| `gastos` | `registrado_por_id` | `usuarios` | `id_usuario` |
| `logs_asistencia` | `autorizado_por_id` | `usuarios` | `id_usuario` |
| `logs_asistencia` | `usuario_id` | `usuarios` | `id_usuario` |
| `pago_historial` | `plan_id` | `planes` | `id_plan` |
| `pago_historial` | `registrado_por_id` | `usuarios` | `id_usuario` |
| `pago_historial` | `usuario_id` | `usuarios` | `id_usuario` |
| `pago_historial` | `verificado_por_id` | `usuarios` | `id_usuario` |
| `perfiles_socio` | `descuento_id` | `descuentos` | `id_descuento` |
| `perfiles_socio` | `usuario_id` | `usuarios` | `id_usuario` |
| `recuperaciones_password` | `usuario_id` | `usuarios` | `id_usuario` |
| `reservas_clases` | `horario_id` | `clase_horarios` | `id_horario` |
| `reservas_clases` | `usuario_id` | `usuarios` | `id_usuario` |
| `rutina_ejercicios` | `ejercicio_id` | `ejercicios` | `id_ejercicio` |
| `rutina_ejercicios` | `rutina_id` | `rutinas` | `id_rutina` |
| `rutinas` | `profesor_id` | `usuarios` | `id_usuario` |
| `rutinas` | `socio_id` | `usuarios` | `id_usuario` |
| `suscripciones` | `plan_id` | `planes` | `id_plan` |
| `suscripciones` | `usuario_id` | `usuarios` | `id_usuario` |
| `tareas_seguimiento` | `creada_por_id` | `usuarios` | `id_usuario` |
| `tareas_seguimiento` | `resuelta_por_id` | `usuarios` | `id_usuario` |
| `tareas_seguimiento` | `usuario_id` | `usuarios` | `id_usuario` |
| `turnos_personal` | `log_entrada_id` | `logs_asistencia` | `id_log` |
| `turnos_personal` | `log_salida_id` | `logs_asistencia` | `id_log` |
| `turnos_personal` | `usuario_id` | `usuarios` | `id_usuario` |

---

# Diccionario de Datos

## 1. Personas y seguridad

### Tabla `usuarios`

**Descripción:** Personal del gimnasio y socios registrados.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_usuario` | BIGINT | PK | No | Identificador único (autoincremental) |
| `dni` | VARCHAR(15) | UK | No | Documento de identidad (único). Recepción busca a la persona por DNI en el control de acceso |
| `nombre_completo` | VARCHAR(100) |  | No | Apellido y nombre |
| `email` | VARCHAR(100) | UK | No | Correo electrónico (único); el personal lo usa para iniciar sesión |
| `password` | VARCHAR(255) |  | No | Hash BCrypt; en los socios es un valor aleatorio que no sirve para entrar |
| `telefono` | VARCHAR(25) |  | Sí | Teléfono de contacto (se usa para el link de WhatsApp) |
| `rol` | VARCHAR(20) |  | No | Rol que define qué puede hacer en el sistema; SOCIO no inicia sesión. Valores: `ADMIN`, `RECEPCION`, `PROFESOR`, `SOCIO` |
| `estado` | VARCHAR(20) |  | No | Estado de la cuenta (solo ACTIVO puede ingresar al gimnasio o al panel). Valores: `ACTIVO`, `INACTIVO`, `PENDIENTE`, `SUSPENDIDO`, `CANCELADO`. Por defecto: `ACTIVO` |
| `fecha_creacion` | DATETIME(6) |  | Sí | Fecha y hora de alta. Por defecto: fecha y hora actual |
| `debe_cambiar_password` | BOOLEAN |  | No | TRUE con contraseña temporal: obliga a definir una contraseña propia al ingresar. Por defecto: `FALSE` |
| `password_cambiada` | DATETIME(6) |  | Sí | Último cambio de contraseña: invalida los tokens emitidos antes |

### Tabla `perfiles_socio`

**Descripción:** Ficha personal del socio (1:1 con usuarios).

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_perfil` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK, UK | No | Socio dueño de la ficha → `usuarios.id_usuario` |
| `fecha_nacimiento` | DATE |  | Sí | Fecha de nacimiento |
| `genero` | VARCHAR(20) |  | Sí | Género |
| `domicilio` | VARCHAR(150) |  | Sí | Domicilio |
| `ciudad` | VARCHAR(80) |  | Sí | Ciudad |
| `objetivo` | VARCHAR(150) |  | Sí | Ej.: bajar de peso, hipertrofia, rehabilitación |
| `observaciones` | VARCHAR(500) |  | Sí | Observaciones internas del personal |
| `foto_url` | VARCHAR(255) |  | Sí | Ruta de la foto que saca recepción para reconocerlo en cada ingreso |
| `foto_actualizada` | DATETIME(6) |  | Sí | Versión de la foto (evita que el navegador muestre una vieja) |
| `descuento_id` | BIGINT | FK | Sí | Descuento habitual que se le propone en cada cobro → `descuentos.id_descuento` |

### Tabla `recuperaciones_password`

**Descripción:** Pedidos de recuperación de contraseña del personal.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_recuperacion` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Persona que pidió el link → `usuarios.id_usuario` |
| `hash_token` | VARCHAR(64) | UK | No | SHA-256 en hexadecimal: quien lea la base no puede usar los links |
| `creada` | DATETIME(6) |  | No | Fecha y hora del pedido |
| `vence` | DATETIME(6) |  | No | Vencimiento del link (summit.recuperacion.minutos, 30 por defecto) |
| `usada` | DATETIME(6) |  | Sí | NULL = todavía sirve; fecha de uso o de anulación por un pedido nuevo |

## 2. Control médico

### Tabla `certificados_medicos`

**Descripción:** Certificados médicos y control de apto físico.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_certificado` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio titular del certificado → `usuarios.id_usuario` |
| `archivo_url` | VARCHAR(255) |  | No | Ruta interna del archivo (PDF o imagen); se descarga por la API con permisos |
| `fecha_emision` | DATE |  | No | Fecha en que lo firmó el médico |
| `fecha_vencimiento` | DATE |  | No | Consultada en cada ingreso del socio |
| `estado_legal` | VARCHAR(20) |  | No | Estado del apto. Valores: `VIGENTE`, `VENCIDO`, `RECHAZADO`, `PENDIENTE_REVISION` |
| `observaciones_patologias` | VARCHAR(500) |  | Sí | Patologías y restricciones informadas (las cruza el constructor de rutinas) |
| `resumen_ia` | VARCHAR(1000) |  | Sí | Lectura del asistente de IA local (Ollama) confirmada por una persona |
| `motivo_rechazo` | VARCHAR(200) |  | Sí | Ilegible, no es del socio, sospecha de adulteración |
| `revisado_por_id` | BIGINT | FK | Sí | Empleado que lo rechazó o lo volvió a aprobar → `usuarios.id_usuario` |
| `fecha_revision` | DATETIME(6) |  | Sí | Fecha y hora de la revisión manual |

## 3. Planes, membresías y descuentos

### Tabla `planes`

**Descripción:** Catálogo de planes y tarifas.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_plan` | BIGINT | PK | No | Identificador único (autoincremental) |
| `nombre_plan` | VARCHAR(50) | UK | No | Nombre comercial (único), ej. "3 veces por semana" |
| `descripcion` | VARCHAR(255) |  | Sí | Detalle de lo que incluye |
| `precio_base` | DECIMAL(10,2) |  | No | Precio de lista de cada período |
| `duracion_dias` | INT |  | No | Días de vigencia que da cada cobro. Por defecto: `30` |
| `veces_por_semana` | INT |  | Sí | Días de acceso por semana (1 a 7). NULL = pase libre |
| `activo` | BOOLEAN |  | No | Baja lógica: uno inactivo no se ofrece para cobrar. Por defecto: `TRUE` |

### Tabla `descuentos`

**Descripción:** Catálogo de descuentos comerciales.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_descuento` | BIGINT | PK | No | Identificador único (autoincremental) |
| `nombre` | VARCHAR(60) | UK | No | Nombre del descuento (único), ej. "Familiar 10 %" |
| `tipo` | VARCHAR(20) |  | No | PORCENTAJE (% del precio del plan) o MONTO_FIJO (pesos que se restan). Valores: `PORCENTAJE`, `MONTO_FIJO` |
| `valor` | DECIMAL(10,2) |  | No | Porcentaje (hasta 100) o pesos, según el tipo |
| `activo` | BOOLEAN |  | No | Uno desactivado no se ofrece al cobrar ni se aplica como habitual. Por defecto: `TRUE` |

### Tabla `suscripciones`

**Descripción:** Suscripciones y vigencia de membresías.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_suscripcion` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio → `usuarios.id_usuario` |
| `plan_id` | BIGINT | FK | No | Plan → `planes.id_plan` |
| `fecha_inicio` | DATE |  | No | Comienzo de la vigencia |
| `fecha_vencimiento` | DATE |  | No | Último día pago (se corre con cada cobro y cada congelamiento) |
| `activa` | BOOLEAN |  | No | Membresía vigente del socio (hay una sola activa por socio). Por defecto: `TRUE` |

### Tabla `congelamientos`

**Descripción:** Congelamientos temporales de membresías.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_congelamiento` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio → `usuarios.id_usuario` |
| `suscripcion_id` | BIGINT | FK | No | Membresía a la que se le corrió el vencimiento → `suscripciones.id_suscripcion` |
| `desde` | DATE |  | No | Primer día congelado (incluido) |
| `hasta` | DATE |  | No | Último día congelado (incluido) |
| `motivo` | VARCHAR(20) |  | No | Motivo del congelamiento. Valores: `VACACIONES`, `SALUD`, `OTRO` |
| `observacion` | VARCHAR(200) |  | Sí | Detalle del motivo |
| `dias_aplicados` | INT |  | No | Días sumados al vencimiento (0 si se anuló antes de empezar) |
| `terminado_antes` | BOOLEAN |  | No | Volvió antes: hasta pasó a ser el día anterior a su vuelta. Por defecto: `FALSE` |
| `anulado` | BOOLEAN |  | No | Se anuló antes de empezar: no corrió el vencimiento. Por defecto: `FALSE` |
| `registrado_por_id` | BIGINT | FK | Sí | Empleado que lo registró → `usuarios.id_usuario` |
| `fecha_registro` | DATETIME(6) |  | No | Fecha y hora de carga |

### Tabla `reglas_membresia`

**Descripción:** Matrícula y límites de congelamiento (registro único).

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_reglas` | BIGINT | PK | No | Identificador fijo del registro único (siempre 1) |
| `matricula_monto` | DECIMAL(10,2) |  | No | Matrícula de inscripción. 0 = no se cobra |
| `matricula_reinscripcion_dias` | INT |  | No | Se vuelve a cobrar tras más de estos días sin cuota. 0 = solo la primera vez |
| `congelamiento_min_dias` | INT |  | No | Días mínimos de cada congelamiento |
| `congelamiento_max_dias_anio` | INT |  | No | Días máximos por año calendario. 0 = el gimnasio no congela |

## 4. Cobros, débito automático y caja

### Tabla `pago_historial`

**Descripción:** Registro de cobros de membresías.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_pago` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio que paga → `usuarios.id_usuario` |
| `plan_id` | BIGINT | FK | No | Plan → `planes.id_plan` |
| `monto_abonado` | DECIMAL(10,2) |  | No | precio_lista - descuento_monto + matricula_monto |
| `fecha_pago` | DATETIME(6) |  | No | Fecha y hora del cobro (precisión de microsegundos para los turnos de caja) |
| `metodo_pago` | VARCHAR(30) |  | No | Medio de pago (MERCADO_PAGO = QR o billetera). Valores: `EFECTIVO`, `TRANSFERENCIA`, `MERCADO_PAGO`, `TARJETA_DEBITO`, `TARJETA_CREDITO`, `DEBITO_AUTOMATICO` |
| `comprobante_nro` | VARCHAR(50) |  | Sí | Número de operación de la transferencia o del QR |
| `estado_pago` | VARCHAR(20) |  | No | Solo APROBADO extiende la membresía y suma en la caja. Valores: `PENDIENTE`, `APROBADO`, `RECHAZADO`. Por defecto: `APROBADO` |
| `mp_payment_id` | VARCHAR(40) | UK | Sí | Id del cobro en Mercado Pago (débito o tarjeta): nunca se registra dos veces |
| `registrado_por_id` | BIGINT | FK | Sí | Empleado que cobró (NULL en los cobros automáticos) → `usuarios.id_usuario` |
| `verificado_por_id` | BIGINT | FK | Sí | Quién confirmó o rechazó un pago "a verificar" → `usuarios.id_usuario` |
| `fecha_verificacion` | DATETIME(6) |  | Sí | Fecha y hora de la verificación |
| `precio_lista` | DECIMAL(10,2) |  | Sí | Precio del plan al momento del cobro |
| `descuento_nombre` | VARCHAR(120) |  | Sí | Nombre del descuento o "Especial: <motivo>" |
| `descuento_monto` | DECIMAL(10,2) |  | Sí | Pesos descontados |
| `matricula_monto` | DECIMAL(10,2) |  | Sí | NULL = no correspondía; 0 = se bonificó; > 0 = se cobró |
| `vence_membresia` | DATE |  | Sí | Hasta cuándo quedó paga la membresía con este cobro |

### Tabla `debitos_automaticos`

**Descripción:** Adhesiones al débito automático con Mercado Pago.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_debito` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio adherido → `usuarios.id_usuario` |
| `plan_id` | BIGINT | FK | No | Plan → `planes.id_plan` |
| `monto` | DECIMAL(10,2) |  | No | Lo que cobra Mercado Pago cada mes (sigue al precio del plan) |
| `estado` | VARCHAR(30) |  | No | Estado de la adhesión (refleja el de Mercado Pago). Valores: `PENDIENTE_AUTORIZACION`, `ACTIVO`, `PAUSADO`, `CANCELADO` |
| `mp_preapproval_id` | VARCHAR(64) | UK | Sí | Id de la suscripción en Mercado Pago |
| `link_autorizacion` | VARCHAR(500) |  | Sí | Link donde el socio autoriza (recepción lo muestra como QR) |
| `email_pagador` | VARCHAR(100) |  | No | Cuenta de Mercado Pago con la que paga |
| `medio_pago` | VARCHAR(40) |  | Sí | Según Mercado Pago (account_money, debvisa, master...) |
| `fecha_alta` | DATETIME(6) |  | No | Fecha y hora de alta |
| `creado_por_id` | BIGINT | FK | Sí | Empleado que lo dio de alta → `usuarios.id_usuario` |
| `proximo_cobro` | DATE |  | Sí | Fecha del próximo cobro según Mercado Pago |
| `ultimo_cobro` | DATETIME(6) |  | Sí | Último cobro aprobado |
| `ultimo_rechazo` | DATETIME(6) |  | Sí | Alerta para recepción hasta que entre un cobro aprobado |
| `detalle_rechazo` | VARCHAR(150) |  | Sí | Motivo del último rechazo |
| `ultima_sincronizacion` | DATETIME(6) |  | Sí | Última vez que se consultó a Mercado Pago (cada hora) |
| `fecha_baja` | DATETIME(6) |  | Sí | Fecha y hora de la baja |
| `baja_por_id` | BIGINT | FK | Sí | Empleado que lo dio de baja → `usuarios.id_usuario` |

### Tabla `gastos`

**Descripción:** Gastos y egresos de la caja.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_gasto` | BIGINT | PK | No | Identificador único (autoincremental) |
| `fecha` | DATETIME(6) |  | No | Fecha y hora del gasto |
| `monto` | DECIMAL(12,2) |  | No | Importe |
| `categoria` | VARCHAR(20) |  | No | Rubro del gasto. Valores: `ALQUILER`, `SERVICIOS`, `SUELDOS`, `LIMPIEZA`, `MANTENIMIENTO`, `EQUIPAMIENTO`, `INSUMOS`, `IMPUESTOS`, `OTROS` |
| `descripcion` | VARCHAR(200) |  | No | Detalle (ej. "Factura de luz de octubre") |
| `metodo_pago` | VARCHAR(30) |  | No | Medio de pago (no admite DEBITO_AUTOMATICO). Valores: `EFECTIVO`, `TRANSFERENCIA`, `MERCADO_PAGO`, `TARJETA_DEBITO`, `TARJETA_CREDITO` |
| `fuera_de_caja` | BOOLEAN |  | No | En efectivo pero no salió de la caja: no entra en el arqueo. Por defecto: `FALSE` |
| `comprobante_nro` | VARCHAR(50) |  | Sí | Número de factura o recibo del proveedor |
| `registrado_por_id` | BIGINT | FK | Sí | Empleado que lo registró → `usuarios.id_usuario` |
| `anulado` | BOOLEAN |  | No | Se cargó mal: deja de contar (solo mientras el turno sigue abierto). Por defecto: `FALSE` |
| `anulado_por_id` | BIGINT | FK | Sí | Empleado que lo anuló → `usuarios.id_usuario` |
| `fecha_anulacion` | DATETIME(6) |  | Sí | Fecha y hora de la anulación |
| `motivo_anulacion` | VARCHAR(200) |  | Sí | Por qué se anuló |

### Tabla `cierres_caja`

**Descripción:** Cierres y arqueos de caja por turno.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_cierre` | BIGINT | PK | No | Identificador único (autoincremental) |
| `desde` | DATETIME(6) | UK | No | Comienzo del turno: el cierre anterior (o el inicio del día) |
| `hasta` | DATETIME(6) |  | No | Momento del cierre |
| `fondo_inicial` | DECIMAL(12,2) |  | No | Efectivo que dejó el cierre anterior |
| `ingresos_efectivo` | DECIMAL(12,2) |  | No | Cobros en efectivo del turno |
| `egresos_efectivo` | DECIMAL(12,2) |  | No | Gastos en efectivo que salieron de la caja |
| `efectivo_esperado` | DECIMAL(12,2) |  | No | fondo_inicial + ingresos_efectivo - egresos_efectivo |
| `efectivo_contado` | DECIMAL(12,2) |  | No | Efectivo que contó quien cierra |
| `diferencia` | DECIMAL(12,2) |  | No | efectivo_contado - efectivo_esperado (negativo = faltante) |
| `retiro` | DECIMAL(12,2) |  | No | Efectivo que se lleva el dueño |
| `fondo_siguiente` | DECIMAL(12,2) |  | No | efectivo_contado - retiro |
| `total_ingresos` | DECIMAL(12,2) |  | No | Todos los medios de pago |
| `total_egresos` | DECIMAL(12,2) |  | No | Gastos de todos los medios de pago |
| `cantidad_cobros` | INT |  | No | Cobros aprobados del turno |
| `cantidad_gastos` | INT |  | No | Gastos del turno |
| `observacion` | VARCHAR(300) |  | Sí | Comentario de quien cierra (ej. explicación de una diferencia) |
| `cerrado_por_id` | BIGINT | FK | Sí | Empleado que cerró la caja → `usuarios.id_usuario` |

### Tabla `cierres_caja_metodos`

**Descripción:** Totales de cada cierre por medio de pago.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `cierre_id` | BIGINT | PK, FK | No | Cierre de caja (parte de la clave) → `cierres_caja.id_cierre` |
| `metodo_pago` | VARCHAR(30) | PK | No | Medio de pago (parte de la clave). Valores: `EFECTIVO`, `TRANSFERENCIA`, `MERCADO_PAGO`, `TARJETA_DEBITO`, `TARJETA_CREDITO`, `DEBITO_AUTOMATICO` |
| `ingresos` | DECIMAL(12,2) |  | No | Lo que entró por ese medio |
| `egresos` | DECIMAL(12,2) |  | No | Lo que salió por ese medio |

## 5. Facturación electrónica (ARCA)

### Tabla `datos_fiscales`

**Descripción:** Datos fiscales del emisor de las facturas (registro único).

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_datos` | BIGINT | PK | No | Identificador fijo del registro único (siempre 1) |
| `cuit` | VARCHAR(11) |  | Sí | 11 dígitos, sin guiones |
| `razon_social` | VARCHAR(100) |  | Sí | Como figura en ARCA |
| `condicion_iva` | VARCHAR(30) |  | Sí | Define la letra: MONOTRIBUTO = C, RESPONSABLE_INSCRIPTO = B. Valores: `MONOTRIBUTO`, `RESPONSABLE_INSCRIPTO` |
| `ingresos_brutos` | VARCHAR(30) |  | Sí | Número de inscripción, "Exento" o "Convenio Multilateral" |
| `inicio_actividades` | DATE |  | Sí | Fecha de inicio de actividades ante ARCA |
| `domicilio_comercial` | VARCHAR(150) |  | Sí | Domicilio del local, como está declarado en ARCA |
| `punto_venta` | INT |  | Sí | Punto de venta "web services" dado de alta en ARCA |
| `identificar_socio` | BOOLEAN |  | No | TRUE = la factura sale con el DNI del socio; FALSE = consumidor final. Por defecto: `FALSE` |

### Tabla `comprobantes_fiscales`

**Descripción:** Facturas y notas de crédito electrónicas.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_comprobante` | BIGINT | PK | No | Identificador único (autoincremental) |
| `pago_id` | BIGINT | FK | No | Cobro facturado → `pago_historial.id_pago` |
| `comprobante_asociado_id` | BIGINT | FK | Sí | En una nota de crédito: la factura que anula → `comprobantes_fiscales.id_comprobante` |
| `ambiente` | VARCHAR(15) |  | No | Los de prueba nunca se mezclan con los reales. Valores: `SIMULADOR`, `HOMOLOGACION`, `PRODUCCION` |
| `estado` | VARCHAR(15) |  | No | Etapa del comprobante en la cola de emisión. Valores: `PENDIENTE`, `ENVIANDO`, `INCIERTO`, `AUTORIZADO`, `RECHAZADO` |
| `nota_credito` | BOOLEAN |  | No | TRUE = nota de crédito que anula una factura. Por defecto: `FALSE` |
| `tipo` | VARCHAR(20) |  | Sí | Letra y clase; NULL hasta que se envía. Valores: `FACTURA_B`, `NOTA_CREDITO_B`, `FACTURA_C`, `NOTA_CREDITO_C` |
| `punto_venta` | INT |  | Sí | Punto de venta con el que se numeró |
| `numero` | BIGINT |  | Sí | Correlativo por ambiente, CUIT, tipo y punto de venta |
| `fecha` | DATE |  | Sí | Fecha del comprobante |
| `cuit_emisor` | VARCHAR(11) |  | Sí | Copia de los datos fiscales al emitirlo (lo que va impreso) |
| `emisor_razon_social` | VARCHAR(100) |  | Sí | Razón social del emisor al emitirlo |
| `emisor_domicilio` | VARCHAR(150) |  | Sí | Domicilio comercial del emisor al emitirlo |
| `emisor_condicion_iva` | VARCHAR(30) |  | Sí | Condición frente al IVA del emisor al emitirlo. Valores: `MONOTRIBUTO`, `RESPONSABLE_INSCRIPTO` |
| `emisor_ingresos_brutos` | VARCHAR(30) |  | Sí | Ingresos brutos del emisor al emitirlo |
| `emisor_inicio_actividades` | DATE |  | Sí | Inicio de actividades del emisor |
| `identificar_receptor` | BOOLEAN |  | No | TRUE = sale a nombre del socio con su DNI. Por defecto: `FALSE` |
| `doc_tipo` | INT |  | Sí | 99 = consumidor final sin identificar; 96 = DNI |
| `doc_nro` | BIGINT |  | Sí | Número de documento del receptor (0 = consumidor final) |
| `condicion_iva_receptor` | INT |  | Sí | Código de ARCA (5 = consumidor final) |
| `receptor_nombre` | VARCHAR(120) |  | Sí | Nombre impreso del receptor |
| `imp_total` | DECIMAL(12,2) |  | No | Importe total (el monto abonado del cobro) |
| `imp_neto` | DECIMAL(12,2) |  | Sí | Neto gravado (en la C, igual al total) |
| `imp_iva` | DECIMAL(12,2) |  | Sí | Solo en la factura B (IVA contenido) |
| `servicio_desde` | DATE |  | Sí | Período de la membresía facturada |
| `servicio_hasta` | DATE |  | Sí | Fin del período facturado |
| `vencimiento_pago` | DATE |  | Sí | Vencimiento del pago informado a ARCA |
| `motivo` | VARCHAR(200) |  | Sí | Nota de crédito: por qué se anuló la factura |
| `cae` | VARCHAR(14) |  | Sí | Código de Autorización Electrónico |
| `cae_vencimiento` | DATE |  | Sí | Vencimiento del CAE |
| `observaciones` | TEXT |  | Sí | Observaciones o errores de ARCA ("código: mensaje") |
| `intentos` | INT |  | No | Envíos a ARCA hechos hasta ahora. Por defecto: `0` |
| `proximo_intento` | DATETIME(6) |  | Sí | Cuándo lo vuelve a tomar la cola (espera creciente entre reintentos) |
| `ultimo_error` | VARCHAR(500) |  | Sí | Último error de conexión o de ARCA |
| `solicitado_por_id` | BIGINT | FK | Sí | Empleado que pidió el comprobante → `usuarios.id_usuario` |
| `creado` | DATETIME(6) |  | No | Fecha y hora de creación (al aprobarse el pago) |
| `autorizado` | DATETIME(6) |  | Sí | Fecha y hora en que obtuvo el CAE |
| `ultimo_pedido` | TEXT |  | Sí | Auditoría: último pedido a ARCA, sin token ni firma |
| `ultima_respuesta` | TEXT |  | Sí | Auditoría: última respuesta de ARCA |
| `version` | BIGINT |  | Sí | Bloqueo optimista (@Version) |

### Tabla `tickets_acceso_arca`

**Descripción:** Permisos de acceso vigentes a los web services de ARCA.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_ticket` | BIGINT | PK | No | Identificador único (autoincremental) |
| `ambiente` | VARCHAR(15) |  | No | Ambiente de ARCA al que pertenece el permiso. Valores: `SIMULADOR`, `HOMOLOGACION`, `PRODUCCION` |
| `huella_certificado` | VARCHAR(64) |  | No | SHA-256 del certificado con el que se pidió |
| `token` | TEXT |  | No | Secreto: no se muestra ni se escribe en los logs |
| `firma` | TEXT |  | No | Secreto: no se muestra ni se escribe en los logs |
| `vence` | DATETIME(6) |  | No | Hora argentina |

## 6. Control de acceso y asistencia del personal

### Tabla `configuracion_acceso`

**Descripción:** Reglas del control de acceso presencial (registro único).

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_configuracion` | BIGINT | PK | No | Identificador fijo del registro único (siempre 1) |
| `requerir_membresia_activa` | BOOLEAN |  | No | Exige la cuota al día para ingresar |
| `requerir_certificado_medico` | BOOLEAN |  | No | Exige el apto médico vigente para ingresar |
| `permitir_override_manual` | BOOLEAN |  | No | Habilita el ingreso por excepción autorizado por recepción |
| `dias_gracia_membresia` | INT |  | No | Días que se tolera la cuota vencida |
| `dias_gracia_certificado` | INT |  | No | Días que se tolera el certificado vencido |

### Tabla `logs_asistencia`

**Descripción:** Historial de pasos por el control de acceso.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_log` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Persona que pasó por recepción (socio o personal) → `usuarios.id_usuario` |
| `fecha_hora` | DATETIME(6) |  | No | Fecha y hora del paso por recepción |
| `tipo_evento` | VARCHAR(20) |  | No | INGRESO_MOLINETE = ingreso de un socio o entrada del personal; CHECKOUT = salida del personal; INGRESO_EXCEPCION = ingreso autorizado sin cumplir las reglas. Valores: `CHECKOUT`, `INGRESO_MOLINETE`, `INGRESO_EXCEPCION` |
| `resultado` | VARCHAR(35) |  | No | Resultado de la validación (el primer motivo de rechazo). Valores: `PERMITIDO`, `DENEGADO_CUENTA_INACTIVA`, `DENEGADO_MEMBRESIA_CONGELADA`, `DENEGADO_CUOTA_VENCIDA`, `DENEGADO_LIMITE_SEMANAL`, `DENEGADO_CERTIFICADO_MEDICO` |
| `autorizado_por_id` | BIGINT | FK | Sí | Empleado que autorizó un ingreso por excepción → `usuarios.id_usuario` |
| `motivo_excepcion` | VARCHAR(200) |  | Sí | Por qué se autorizó la excepción (obligatorio en INGRESO_EXCEPCION) |

### Tabla `turnos_personal`

**Descripción:** Turnos de trabajo del personal.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_turno` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Persona del equipo → `usuarios.id_usuario` |
| `entrada` | DATETIME(6) |  | No | Hora de entrada (un turno que pasa la medianoche cuenta en el día en que empezó) |
| `salida` | DATETIME(6) |  | Sí | NULL = en curso, o se olvidó de marcarla |
| `origen` | VARCHAR(20) |  | No | Cómo empezó el turno. Valores: `RECEPCION`, `MANUAL` |
| `anulado` | BOOLEAN |  | No | No suma horas pero queda guardado con el motivo. Por defecto: `FALSE` |
| `log_entrada_id` | BIGINT | FK | Sí | Paso por recepción que lo abrió (NULL si lo cargó el admin) → `logs_asistencia.id_log` |
| `log_salida_id` | BIGINT | FK | Sí | Paso por recepción que lo cerró → `logs_asistencia.id_log` |

### Tabla `correcciones_turno`

**Descripción:** Auditoría de correcciones de turnos del personal.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_correccion` | BIGINT | PK | No | Identificador único (autoincremental) |
| `turno_id` | BIGINT | FK | No | Turno corregido → `turnos_personal.id_turno` |
| `accion` | VARCHAR(20) |  | No | Qué se le hizo al turno. Valores: `ALTA`, `CAMBIO`, `ANULACION` |
| `entrada_anterior` | DATETIME(6) |  | Sí | Vacía en un ALTA |
| `salida_anterior` | DATETIME(6) |  | Sí | Salida antes de la corrección |
| `entrada_nueva` | DATETIME(6) |  | Sí | Vacía en una ANULACION |
| `salida_nueva` | DATETIME(6) |  | Sí | Salida después de la corrección |
| `motivo` | VARCHAR(200) |  | No | Por qué se corrigió (obligatorio) |
| `autor_id` | BIGINT | FK | No | Quién hizo la corrección → `usuarios.id_usuario` |
| `fecha` | DATETIME(6) |  | No | Fecha y hora de la corrección |

## 7. Clases y reservas

### Tabla `clases`

**Descripción:** Clases y actividades grupales.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_clase` | BIGINT | PK | No | Identificador único (autoincremental) |
| `nombre` | VARCHAR(100) |  | No |  |
| `descripcion` | VARCHAR(300) |  | Sí |  |
| `capacidad_maxima` | INT |  | No |  |
| `profesor_id` | BIGINT | FK | Sí | Profesor a cargo → `usuarios.id_usuario` |
| `activa` | BOOLEAN |  | No | . Por defecto: `TRUE` |

### Tabla `clase_horarios`

**Descripción:** Días y horarios de cada clase.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_horario` | BIGINT | PK | No | Identificador único (autoincremental) |
| `clase_id` | BIGINT | FK | No | Clase → `clases.id_clase` |
| `dia_semana` | VARCHAR(15) |  | No | . Valores: `LUNES`, `MARTES`, `MIERCOLES`, `JUEVES`, `VIERNES`, `SABADO`, `DOMINGO` |
| `hora_inicio` | TIME(6) |  | No |  |
| `hora_fin` | TIME(6) |  | No |  |

### Tabla `reservas_clases`

**Descripción:** Reservas de lugares en clases grupales.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_reserva` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio → `usuarios.id_usuario` |
| `horario_id` | BIGINT | FK | No | Horario de la clase → `clase_horarios.id_horario` |
| `fecha_clase` | DATE |  | No | Fecha concreta de la clase |
| `fecha_reserva` | DATETIME(6) |  | No | Fecha y hora en que se reservó |
| `estado` | VARCHAR(20) |  | No | Estado de la reserva. Valores: `CONFIRMADA`, `CANCELADA`, `ASISTIO`, `AUSENTE` |

## 8. Entrenamiento

### Tabla `ejercicios`

**Descripción:** Catálogo de ejercicios.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_ejercicio` | BIGINT | PK | No | Identificador único (autoincremental) |
| `nombre` | VARCHAR(100) |  | No | Nombre del ejercicio |
| `descripcion` | VARCHAR(500) |  | Sí | Indicaciones de ejecución |
| `grupo_muscular` | VARCHAR(30) |  | No | Grupo muscular principal. Valores: `PECHO`, `ESPALDA`, `BICEPS`, `TRICEPS`, `HOMBROS`, `CUADRICEPS`, `ISQUIOS`, `GLUTEOS`, `PANTORRILLAS`, `ABDOMINALES`, `CORE` |
| `url_media` | VARCHAR(255) |  | Sí | GIF, video o imagen del ejercicio |
| `svg_target_id` | VARCHAR(50) |  | Sí | Zona del modelo muscular del panel |
| `patologias_contraindicadas` | VARCHAR(500) |  | Sí | Separadas por comas (ej. HERNIA,ASMA,RODILLA) |

### Tabla `rutinas`

**Descripción:** Rutinas de entrenamiento asignadas.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_rutina` | BIGINT | PK | No | Identificador único (autoincremental) |
| `nombre` | VARCHAR(100) |  | No | Nombre de la rutina (ej. "Hipertrofia 4 días") |
| `objetivo` | VARCHAR(255) |  | Sí | Objetivo de la rutina |
| `socio_id` | BIGINT | FK | No | Socio → `usuarios.id_usuario` |
| `profesor_id` | BIGINT | FK | Sí | Profesor a cargo → `usuarios.id_usuario` |
| `fecha_creacion` | DATE |  | No | Fecha de creación |
| `activa` | BOOLEAN |  | No | Al asignar una nueva, la anterior del socio queda inactiva. Por defecto: `TRUE` |

### Tabla `rutina_ejercicios`

**Descripción:** Ejercicios de cada rutina con series, repeticiones y descanso.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_rutina_ejercicio` | BIGINT | PK | No | Identificador único (autoincremental) |
| `rutina_id` | BIGINT | FK | No | Rutina → `rutinas.id_rutina` |
| `ejercicio_id` | BIGINT | FK | No | Ejercicio → `ejercicios.id_ejercicio` |
| `dia_numero` | INT |  | Sí | Día 1 a 7 de la rutina (NULL en rutinas viejas = día 1) |
| `orden` | INT |  | Sí | Posición dentro del día |
| `series` | INT |  | Sí | Series prescriptas |
| `repeticiones` | INT |  | Sí | Repeticiones por serie |
| `peso_sugerido_kg` | DOUBLE |  | Sí | Peso sugerido en kilos |
| `descanso_segundos` | INT |  | Sí | Descanso entre series, en segundos |
| `observaciones` | VARCHAR(300) |  | Sí | Indicaciones del profesor |

## 9. Seguimiento de socios (CRM)

### Tabla `tareas_seguimiento`

**Descripción:** Tareas de seguimiento y contacto con socios.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_tarea` | BIGINT | PK | No | Identificador único (autoincremental) |
| `usuario_id` | BIGINT | FK | No | Socio a contactar → `usuarios.id_usuario` |
| `tipo` | VARCHAR(20) |  | No | Por qué hay que contactarlo (CUOTA_POR_VENCER ya no se genera: queda en el historial). Valores: `CUOTA_POR_VENCER`, `CUOTA_VENCIDA`, `APTO_POR_VENCER`, `INACTIVO`, `MANUAL` |
| `descripcion` | VARCHAR(300) |  | No | Texto de la tarea |
| `vence` | DATE |  | No | Para cuándo hay que hacerla |
| `fecha_referencia` | DATE |  | Sí | Vencimiento de la cuota o del apto, o último ingreso |
| `clave` | VARCHAR(80) | UK | Sí | Situación de una automática (ej. VENCIDA:12:2026-10-20); NULL en las manuales |
| `estado` | VARCHAR(20) |  | No | Estado de la tarea. Valores: `PENDIENTE`, `HECHA`, `DESCARTADA`, `RESUELTA`. Por defecto: `PENDIENTE` |
| `canal` | VARCHAR(20) |  | Sí | Cómo se lo contactó. Valores: `WHATSAPP`, `LLAMADA`, `PRESENCIAL`, `EMAIL`, `OTRO` |
| `nota` | VARCHAR(300) |  | Sí | Qué pasó al hacerla (o por qué se resolvió sola) |
| `creada_por_id` | BIGINT | FK | Sí | NULL = automática → `usuarios.id_usuario` |
| `fecha_creacion` | DATETIME(6) |  | No | Fecha y hora de creación |
| `resuelta_por_id` | BIGINT | FK | Sí | Quién la cerró → `usuarios.id_usuario` |
| `fecha_resolucion` | DATETIME(6) |  | Sí | Fecha y hora en que se cerró |

## 10. Configuración institucional del gimnasio

### Tabla `datos_gimnasio`

**Descripción:** Datos institucionales del gimnasio (registro único).

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_datos` | BIGINT | PK | No | Identificador fijo del registro único (siempre 1) |
| `nombre` | VARCHAR(80) |  | No | Nombre del gimnasio (sale en los PDF) |
| `direccion` | VARCHAR(150) |  | Sí | Dirección del local |
| `ciudad` | VARCHAR(80) |  | Sí | Ciudad |
| `telefono` | VARCHAR(25) |  | Sí | Teléfono |
| `whatsapp` | VARCHAR(15) |  | Sí | Solo dígitos, con código de país y de área (ej. 5491123456789) |
| `email` | VARCHAR(100) |  | Sí | Correo de contacto |
| `instagram` | VARCHAR(30) |  | Sí | Usuario, sin @ |
| `logo_url` | VARCHAR(255) |  | Sí | Logo PNG para los PDF (NULL = sin logo) |
| `logo_actualizado` | DATETIME(6) |  | Sí | Versión del logo |

### Tabla `datos_gimnasio_horarios`

**Descripción:** Horario de apertura del gimnasio por día.

| Campo | Tipo de dato | Clave | Nulo | Descripción / restricciones |
|---|---|---|---|---|
| `id_datos` | BIGINT | PK, FK | No | Datos del gimnasio (parte de la clave) → `datos_gimnasio.id_datos` |
| `orden` | INT | PK | No | 0 = lunes ... 6 = domingo |
| `dia` | VARCHAR(10) |  | No | Día de la semana. Valores: `LUNES`, `MARTES`, `MIERCOLES`, `JUEVES`, `VIERNES`, `SABADO`, `DOMINGO` |
| `abre` | TIME(6) |  | Sí | Hora de apertura |
| `cierra` | TIME(6) |  | Sí | Abre y cierra en NULL = ese día no abre (no cuenta en las métricas) |

---

# Análisis de Normalización (Tercera Forma Normal - 3FN)

El diseño relacional de la base de datos de SUMMIT cumple la **Tercera Forma Normal (3FN)**:

### Primera Forma Normal (1FN)
* **Atomicidad de atributos:** cada columna guarda un único valor de su dominio. No hay listas ni JSON en columnas de negocio.
* **Eliminación de grupos repetitivos:** toda colección se modeló en una tabla aparte con relación 1:N:
  * Los horarios de una clase, en `clase_horarios`.
  * Los ejercicios de una rutina, en `rutina_ejercicios`.
  * El desglose de un cierre de caja por medio de pago, en `cierres_caja_metodos`.
  * El horario de cada día del gimnasio, en `datos_gimnasio_horarios`.
* **Excepción documentada:** `ejercicios.patologias_contraindicadas` guarda una lista separada por comas (ej. `HERNIA,ASMA,RODILLA`). Se consulta solo como texto para el cruce con las observaciones del certificado médico en el constructor de rutinas; nunca se filtra ni se une por cada valor, por eso se mantuvo en una columna.

### Segunda Forma Normal (2FN)
* **Dependencia funcional total:** la base está en 1FN y cada atributo no clave depende de la clave primaria completa.
* 28 de las 30 tablas usan una clave primaria simple (`BIGINT`), donde no puede haber dependencias parciales.
* En las dos tablas con clave compuesta (`cierres_caja_metodos` con `[cierre_id, metodo_pago]` y `datos_gimnasio_horarios` con `[id_datos, orden]`), los atributos no clave (`ingresos`, `egresos`, `dia`, `abre`, `cierra`) dependen de los dos componentes de la clave.

### Tercera Forma Normal (3FN)
* **Eliminación de dependencias transitivas:** ningún atributo no clave depende de la clave a través de otro atributo no clave ($X \to Y \to Z$).
* Las tarifas viven solo en `planes`; suscripciones, cobros y débitos referencian `plan_id` sin repetir la definición comercial.
* La identidad y el contacto de las personas viven solo en `usuarios`; la ficha del socio está separada en `perfiles_socio` (1:1) para que el personal no tenga columnas vacías forzadas.
* Los datos fiscales del emisor viven en `datos_fiscales`, separados de los datos públicos de `datos_gimnasio`.

---

## Desnormalizaciones Deliberadas y Justificadas

En un sistema contable y con valor legal, algunas copias controladas son necesarias para que un documento emitido no cambie después:

| Tabla | Atributos Desnormalizados | Justificación |
|---|---|---|
| `pago_historial` | `precio_lista`, `descuento_nombre`, `descuento_monto`, `matricula_monto`, `vence_membresia` | **Foto contable del cobro:** el comprobante debe mostrar exactamente lo que se cobró ese día. Si después cambian el precio del plan, el descuento o la matrícula, los cobros anteriores no se alteran. |
| `comprobantes_fiscales` | `cuit_emisor`, `emisor_razon_social`, `emisor_domicilio`, `emisor_condicion_iva`, `emisor_ingresos_brutos`, `emisor_inicio_actividades`, `receptor_nombre`, `imp_total` | **Comprobante fiscal inmutable:** una factura autorizada por ARCA debe reimprimirse idéntica aunque el dueño cambie sus datos fiscales o el socio su nombre. |
| `cierres_caja` | `total_ingresos`, `total_egresos`, `efectivo_esperado`, `diferencia`, `fondo_siguiente` | **Arqueo cerrado:** un cierre es un balance firmado en un momento dado y no se recalcula, aunque después se verifique o rechace un pago de ese turno. |
| `correcciones_turno` | `entrada_anterior`, `salida_anterior`, `entrada_nueva`, `salida_nueva` | **Auditoría:** guarda las horas de antes y de después de cada corrección, aunque el turno cambie de nuevo. |
| `congelamientos` | `usuario_id` (redundante con `suscripciones.usuario_id`) | Permite listar y sumar los días congelados de un socio por año sin pasar por sus suscripciones. |

---

## Reglas de Negocio Garantizadas por el Motor de Base de Datos

| Regla de Negocio | Mecanismo de Integridad en MySQL |
|---|---|
| DNI y correo únicos | `UNIQUE` sobre `usuarios.dni` y `usuarios.email`. |
| Una sola ficha por socio | `UNIQUE` sobre `perfiles_socio.usuario_id`. |
| Coherencia de fechas del apto médico | `CHECK (fecha_vencimiento >= fecha_emision)` en `certificados_medicos`. |
| Un cobro de Mercado Pago nunca se registra dos veces | `UNIQUE` sobre `pago_historial.mp_payment_id` y `debitos_automaticos.mp_preapproval_id`. |
| Dos personas no pueden cerrar la misma caja a la vez | `UNIQUE (desde)` en `cierres_caja`. |
| Lo que se retira no supera lo contado | `CHECK (retiro >= 0 AND retiro <= efectivo_contado)` en `cierres_caja`. |
| "Fuera de caja" solo en efectivo | `CHECK (fuera_de_caja = FALSE OR metodo_pago = 'EFECTIVO')` en `gastos`. |
| Numeración fiscal sin duplicados | `UNIQUE (ambiente, cuit_emisor, tipo, punto_venta, numero)` en `comprobantes_fiscales`. |
| Un permiso de ARCA vigente por certificado | `UNIQUE (ambiente, huella_certificado)` en `tickets_acceso_arca`. |
| La misma situación no genera dos tareas automáticas | `UNIQUE (clave)` en `tareas_seguimiento`. |
| Coherencia de turnos del personal | `CHECK (salida IS NULL OR salida >= entrada)` en `turnos_personal`. |
| Clases con cupo positivo y horarios coherentes | `CHECK (capacidad_maxima > 0)` y `CHECK (hora_fin > hora_inicio)`. |
| Frecuencia semanal válida de los planes | `CHECK (veces_por_semana IS NULL OR veces_por_semana BETWEEN 1 AND 7)`. |
| Un ingreso por excepción siempre tiene motivo | `CHECK (tipo_evento <> 'INGRESO_EXCEPCION' OR motivo_excepcion IS NOT NULL)` en `logs_asistencia`. |
| Dominios válidos para estados, roles y tipos | `CHECK (... IN (...))` en las 28 columnas con valores predefinidos. |
| No se borran personas con historial | Claves foráneas con la regla por defecto `RESTRICT`. |

Además, el backend refuerza en Java reglas que el motor no puede expresar: bloqueos pesimistas (`PESSIMISTIC_WRITE`) sobre la suscripción, el congelamiento, el pago y el comprobante fiscal que se están modificando, bloqueo optimista (`@Version`) en `comprobantes_fiscales`, el tope anual de días congelados y que un gasto en efectivo no supere el efectivo de la caja.

---

## Evolución del Modelo Relacional

| Versión anterior del modelo (27 tablas) | Modelo actual (30 tablas) | Motivo del cambio |
|---|---|---|
| `logs_entrenamiento` | — (eliminada) | El sistema dejó de registrar entrenamientos y progreso: las rutinas las arma el profesor y se entregan impresas o en PDF. |
| — | `tareas_seguimiento` | Seguimiento de socios: tareas automáticas (cuota vencida, apto por vencer, inactividad) y manuales, con canal de contacto y resultado. |
| — | `datos_fiscales`, `comprobantes_fiscales`, `tickets_acceso_arca` | Facturación electrónica de ARCA: datos del emisor, factura o nota de crédito de cada cobro con su CAE, y el permiso de acceso de 12 horas del WSAA. |
| `datos_gimnasio` (`capacidad`, `reglamento`) | `datos_gimnasio` (`logo_url`, `logo_actualizado`) | Se quitaron el aforo y el reglamento, que nadie usaba; se agregó el logo que sale en los PDF. |
| `pago_historial` | `pago_historial` + `vence_membresia` | El comprobante muestra hasta cuándo quedó paga la membresía. |
| `logs_asistencia.tipo_evento` con `CHECKIN_MANUAL` | Sin `CHECKIN_MANUAL` | Todos los ingresos pasan por la misma validación de recepción (`INGRESO_MOLINETE`). |
| `gastos.metodo_pago` con `DEBITO_AUTOMATICO` | Sin `DEBITO_AUTOMATICO` | El débito automático es solo un medio de cobro de cuotas, nunca de gastos. |

> **Nota sobre bases existentes:** el backend actualiza la base con `spring.jpa.hibernate.ddl-auto=update`, que agrega tablas y columnas pero nunca borra. Una base creada con una versión anterior puede conservar tablas que ya no usa ninguna entidad (`logs_entrenamiento`, `lista_espera`, `mensajes`, `conversaciones`, `novedades`, `perfiles_profesor`, `preferencias_notificacion`, `notificaciones_enviadas`, `sesiones_renovables`, `suscripciones_push`, `claves_vapid`) y columnas de funciones retiradas (`configuracion_acceso.ingreso_qr_habilitado`, `codigo_qr_ingreso`, `latitud_gimnasio`, `longitud_gimnasio`, `radio_ingreso_metros`; `logs_asistencia.latitud_socio`, `longitud_socio`, `distancia_metros`; `datos_gimnasio.capacidad`, `reglamento`). No forman parte del modelo y una instalación nueva no las crea.
