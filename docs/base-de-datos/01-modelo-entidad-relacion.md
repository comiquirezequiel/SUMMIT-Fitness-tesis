# SUMMIT · Modelo Entidad-Relación (DER)

Sistema de gestión de gimnasio (Panel Administrativo y Operativo) · base de datos MySQL `summit_fitness_db` · **30 entidades relacionales** (28 entidades JPA y 2 colecciones dependientes).

> **Alcance:**
> El modelo corresponde al **sistema de gestión del gimnasio**, que usa solo el personal (dueño/administración, recepción y profesores). Los socios están en `usuarios` con rol `SOCIO`, pero no inician sesión: son fichas que maneja el personal. La app móvil de socios, el chat, las notificaciones push, las novedades, la lista de espera y el registro de entrenamientos se retiraron del sistema. Se incorporaron la facturación electrónica de ARCA y el seguimiento de socios.

---

## Notación

Notación de **pata de gallo** (*crow's foot*), estándar de modelado relacional (compatible con Lucidchart, Draw.io y Mermaid):

| Símbolo | Significado |
|---|---|
| `\|\|` | exactamente uno (1) |
| `\|o` | cero o uno (0..1) |
| `o{` | cero o muchos (0..N) |
| `\|{` | uno o muchos (1..N) |

`PK` clave primaria · `FK` clave foránea · `UK` valor único / clave candidata.

Cada diagrama está también como archivo en [`diagramas/`](diagramas/): el fuente Mermaid (`.mmd`) y la imagen (`.svg` y `.png`).

## Organización de los Módulos del Sistema

La entidad troncal es **`usuarios`**: el personal (administración, recepción, profesores) y los socios se registran en una sola tabla y se distinguen por el atributo `rol`. El sistema se compone de 10 módulos:

| Módulo | Entidades |
|---|---|
| 1. Personas y seguridad | `usuarios`, `perfiles_socio`, `recuperaciones_password` |
| 2. Control médico y membresías | `certificados_medicos`, `planes`, `descuentos`, `suscripciones`, `congelamientos`, `reglas_membresia` |
| 3. Cobros, pagos y caja | `pago_historial`, `debitos_automaticos`, `gastos`, `cierres_caja`, `cierres_caja_metodos` |
| 4. Facturación electrónica (ARCA) | `datos_fiscales`, `comprobantes_fiscales`, `tickets_acceso_arca` |
| 5. Control de acceso y asistencia del personal | `configuracion_acceso`, `logs_asistencia`, `turnos_personal`, `correcciones_turno` |
| 6. Clases y reservas | `clases`, `clase_horarios`, `reservas_clases` |
| 7. Entrenamiento | `ejercicios`, `rutinas`, `rutina_ejercicios` |
| 8. Seguimiento de socios (CRM) | `tareas_seguimiento` |
| 9. Configuración institucional | `datos_gimnasio`, `datos_gimnasio_horarios` |

---

## 1. DER General (Vista de Conjunto)

Visión global de las 30 entidades y sus relaciones (diagrama [`01-der-general`](diagramas/01-der-general.svg)):

```mermaid
erDiagram
    direction LR
    usuarios ||--o| perfiles_socio : "tiene ficha (1:0..1)"
    descuentos |o--o{ perfiles_socio : "es el habitual de"
    usuarios ||--o{ recuperaciones_password : "solicita"

    usuarios ||--o{ certificados_medicos : "presenta (socio)"
    usuarios |o--o{ certificados_medicos : "revisa (personal)"

    usuarios ||--o{ suscripciones : "contrata"
    planes ||--o{ suscripciones : "define"
    suscripciones ||--o{ congelamientos : "se congela en"
    usuarios |o--o{ congelamientos : "registra (personal)"

    usuarios ||--o{ pago_historial : "paga (socio)"
    planes ||--o{ pago_historial : "corresponde a"
    usuarios |o--o{ pago_historial : "cobra / verifica (personal)"
    usuarios ||--o{ debitos_automaticos : "adhiere"
    planes ||--o{ debitos_automaticos : "cobra"
    usuarios |o--o{ gastos : "registra / anula"
    usuarios |o--o{ cierres_caja : "cierra"
    cierres_caja ||--|{ cierres_caja_metodos : "se desglosa en"

    pago_historial ||--o{ comprobantes_fiscales : "se factura en"
    comprobantes_fiscales |o--o{ comprobantes_fiscales : "anula (nota de crédito)"
    usuarios |o--o{ comprobantes_fiscales : "solicita"

    usuarios ||--o{ logs_asistencia : "pasa por recepción"
    usuarios |o--o{ logs_asistencia : "autoriza excepción"
    usuarios ||--o{ turnos_personal : "cumple"
    logs_asistencia |o--o{ turnos_personal : "abre o cierra"
    turnos_personal ||--o{ correcciones_turno : "se corrige con"
    usuarios ||--o{ correcciones_turno : "corrige"

    usuarios |o--o{ clases : "dicta (profesor)"
    clases ||--o{ clase_horarios : "se dicta en"
    clase_horarios ||--o{ reservas_clases : "recibe"
    usuarios ||--o{ reservas_clases : "reserva (socio)"

    usuarios ||--o{ rutinas : "recibe (socio)"
    usuarios |o--o{ rutinas : "arma (profesor)"
    rutinas ||--o{ rutina_ejercicios : "contiene"
    ejercicios ||--o{ rutina_ejercicios : "se prescribe en"

    usuarios ||--o{ tareas_seguimiento : "es contactado (socio)"
    usuarios |o--o{ tareas_seguimiento : "carga / resuelve (personal)"

    datos_gimnasio ||--|{ datos_gimnasio_horarios : "abre en"

    configuracion_acceso
    reglas_membresia
    datos_fiscales
    tickets_acceso_arca

    usuarios {
        bigint id_usuario PK "Identificador único central"
        varchar dni UK "Documento de identidad"
        varchar nombre_completo "Apellido y nombre"
        varchar email UK "Correo de acceso del personal"
        varchar password "Hash BCrypt"
        varchar telefono "Contacto (WhatsApp)"
        varchar rol "ADMIN, RECEPCION, PROFESOR, SOCIO"
        varchar estado "ACTIVO, INACTIVO, etc."
        datetime fecha_creacion "Alta en el sistema"
        boolean debe_cambiar_password "Contraseña temporal"
        datetime password_cambiada "Último cambio"
    }
```

> **Nota de diseño:** `configuracion_acceso`, `reglas_membresia`, `datos_gimnasio` y `datos_fiscales` son tablas de **registro único** (id `1`) para la configuración del gimnasio: no dependen de datos transaccionales. Las tres primeras las crea el backend al arrancar con valores por defecto; `datos_fiscales` se crea al guardar por primera vez *Ajustes > Facturación*. `tickets_acceso_arca` guarda el permiso vigente para los web services de ARCA y no se relaciona con otras tablas.

---

## 2. Personas y Seguridad

Una sola tabla de personas con autenticación centralizada. La ficha del socio (`perfiles_socio`) es 1:1 y opcional: el personal no la tiene. El descuento habitual del socio se le propone en cada cobro. Los pedidos de "¿Olvidaste tu contraseña?" guardan solo la huella del link.

```mermaid
erDiagram
    usuarios ||--o| perfiles_socio : "tiene ficha (1:0..1)"
    descuentos |o--o{ perfiles_socio : "es el habitual de"
    usuarios ||--o{ recuperaciones_password : "solicita"

    usuarios {
        bigint id_usuario PK
        varchar dni UK
        varchar nombre_completo
        varchar email UK
        varchar password "Hash BCrypt"
        varchar telefono
        varchar rol "ADMIN, RECEPCION, PROFESOR, SOCIO"
        varchar estado "ACTIVO, INACTIVO, PENDIENTE, SUSPENDIDO, CANCELADO"
        datetime fecha_creacion
        boolean debe_cambiar_password
        datetime password_cambiada
    }
    perfiles_socio {
        bigint id_perfil PK
        bigint usuario_id FK, UK
        bigint descuento_id FK
        date fecha_nacimiento
        varchar genero
        varchar domicilio
        varchar ciudad
        varchar objetivo
        varchar observaciones
        varchar foto_url "Foto para reconocerlo en recepción"
        datetime foto_actualizada
    }
    descuentos {
        bigint id_descuento PK
        varchar nombre UK
        varchar tipo "PORCENTAJE, MONTO_FIJO"
        decimal valor
        boolean activo
    }
    recuperaciones_password {
        bigint id_recuperacion PK
        bigint usuario_id FK
        varchar hash_token UK "SHA-256 del link"
        datetime creada
        datetime vence
        datetime usada
    }
```

---

## 3. Control Médico y Membresías

El **certificado médico** es el control legal del sistema: al pasar por recepción se toma el certificado que rige (el de vencimiento más lejano que no fue rechazado) y se verifica que no esté vencido, con los días de gracia configurados. La **suscripción** es la vigencia de la membresía: cada cobro aprobado la extiende y cada congelamiento corre su vencimiento.

```mermaid
erDiagram
    usuarios ||--o{ certificados_medicos : "presenta (socio)"
    usuarios |o--o{ certificados_medicos : "revisa (personal)"
    usuarios ||--o{ suscripciones : "contrata"
    planes ||--o{ suscripciones : "define"
    suscripciones ||--o{ congelamientos : "se congela en"
    usuarios ||--o{ congelamientos : "congela (socio)"
    usuarios |o--o{ congelamientos : "registra (personal)"

    usuarios {
        bigint id_usuario PK
    }
    certificados_medicos {
        bigint id_certificado PK
        bigint usuario_id FK "socio titular"
        bigint revisado_por_id FK "empleado que revisó"
        varchar archivo_url
        date fecha_emision
        date fecha_vencimiento
        varchar estado_legal "VIGENTE, VENCIDO, RECHAZADO, PENDIENTE_REVISION"
        varchar observaciones_patologias
        varchar resumen_ia "Lectura de la IA confirmada"
        varchar motivo_rechazo
        datetime fecha_revision
    }
    planes {
        bigint id_plan PK
        varchar nombre_plan UK
        decimal precio_base
        int duracion_dias
        int veces_por_semana "NULL = pase libre"
        boolean activo
    }
    suscripciones {
        bigint id_suscripcion PK
        bigint usuario_id FK
        bigint plan_id FK
        date fecha_inicio
        date fecha_vencimiento
        boolean activa
    }
    congelamientos {
        bigint id_congelamiento PK
        bigint suscripcion_id FK
        bigint usuario_id FK
        bigint registrado_por_id FK
        date desde
        date hasta
        int dias_aplicados
        varchar motivo "VACACIONES, SALUD, OTRO"
        boolean terminado_antes
        boolean anulado
    }
    reglas_membresia {
        bigint id_reglas PK "registro único (1)"
        decimal matricula_monto
        int matricula_reinscripcion_dias
        int congelamiento_min_dias
        int congelamiento_max_dias_anio
    }
```

---

## 4. Cobros, Pagos y Caja

Cada cobro guarda la foto de lo que se cobró (precio de lista, descuento, matrícula y hasta cuándo quedó paga la membresía). El débito automático registra cada cobro de Mercado Pago como un `pago_historial` más. La caja se cierra por turnos: cada cierre guarda el arqueo y su desglose por medio de pago.

```mermaid
erDiagram
    usuarios ||--o{ pago_historial : "paga (socio)"
    usuarios |o--o{ pago_historial : "cobra / verifica (personal)"
    planes ||--o{ pago_historial : "corresponde a"
    usuarios ||--o{ debitos_automaticos : "adhiere"
    planes ||--o{ debitos_automaticos : "cobra"
    usuarios |o--o{ gastos : "registra / anula"
    usuarios |o--o{ cierres_caja : "cierra"
    cierres_caja ||--|{ cierres_caja_metodos : "se desglosa en"

    usuarios {
        bigint id_usuario PK
    }
    planes {
        bigint id_plan PK
    }
    pago_historial {
        bigint id_pago PK
        bigint usuario_id FK "socio que paga"
        bigint plan_id FK
        bigint registrado_por_id FK "quien cobró"
        bigint verificado_por_id FK
        decimal monto_abonado
        decimal precio_lista
        varchar descuento_nombre
        decimal descuento_monto
        decimal matricula_monto
        varchar metodo_pago
        varchar estado_pago "PENDIENTE, APROBADO, RECHAZADO"
        datetime fecha_pago
        date vence_membresia
        varchar mp_payment_id UK
    }
    debitos_automaticos {
        bigint id_debito PK
        bigint usuario_id FK
        bigint plan_id FK
        decimal monto
        varchar estado "PENDIENTE_AUTORIZACION, ACTIVO, PAUSADO, CANCELADO"
        varchar mp_preapproval_id UK
        varchar email_pagador
        date proximo_cobro
        datetime ultimo_rechazo
    }
    gastos {
        bigint id_gasto PK
        bigint registrado_por_id FK
        bigint anulado_por_id FK
        datetime fecha
        varchar categoria "ALQUILER, SUELDOS, etc."
        decimal monto
        varchar metodo_pago
        boolean fuera_de_caja
        boolean anulado
    }
    cierres_caja {
        bigint id_cierre PK
        bigint cerrado_por_id FK
        datetime desde UK
        datetime hasta
        decimal fondo_inicial
        decimal efectivo_esperado
        decimal efectivo_contado
        decimal diferencia
        decimal retiro
        decimal fondo_siguiente
        decimal total_ingresos
        decimal total_egresos
    }
    cierres_caja_metodos {
        bigint cierre_id PK, FK
        varchar metodo_pago PK
        decimal ingresos
        decimal egresos
    }
```

---

## 5. Facturación Electrónica (ARCA)

Cada cobro aprobado genera un comprobante `PENDIENTE` en la misma transacción; una cola le pide el CAE a ARCA y lo numera. Una factura autorizada no se borra: se anula con una nota de crédito que apunta a ella (`comprobante_asociado_id`). El comprobante copia los datos fiscales del momento en que se emitió.

```mermaid
erDiagram
    pago_historial ||--o{ comprobantes_fiscales : "se factura en"
    comprobantes_fiscales |o--o{ comprobantes_fiscales : "anula (nota de crédito)"
    usuarios |o--o{ comprobantes_fiscales : "solicita"

    pago_historial {
        bigint id_pago PK
        decimal monto_abonado
    }
    usuarios {
        bigint id_usuario PK
    }
    comprobantes_fiscales {
        bigint id_comprobante PK
        bigint pago_id FK
        bigint comprobante_asociado_id FK "factura que anula"
        bigint solicitado_por_id FK
        varchar ambiente UK "SIMULADOR, HOMOLOGACION, PRODUCCION"
        varchar estado "PENDIENTE, ENVIANDO, INCIERTO, AUTORIZADO, RECHAZADO"
        varchar tipo UK "FACTURA_B, NOTA_CREDITO_B, FACTURA_C, NOTA_CREDITO_C"
        varchar cuit_emisor UK
        int punto_venta UK
        bigint numero UK
        date fecha
        decimal imp_total
        decimal imp_neto
        decimal imp_iva
        varchar cae
        date cae_vencimiento
        int intentos
        datetime proximo_intento
        bigint version "bloqueo optimista"
    }
    datos_fiscales {
        bigint id_datos PK "registro único (1)"
        varchar cuit
        varchar razon_social
        varchar condicion_iva "MONOTRIBUTO, RESPONSABLE_INSCRIPTO"
        varchar ingresos_brutos
        date inicio_actividades
        varchar domicilio_comercial
        int punto_venta
        boolean identificar_socio
    }
    tickets_acceso_arca {
        bigint id_ticket PK
        varchar ambiente UK
        varchar huella_certificado UK
        text token
        text firma
        datetime vence "12 horas"
    }
```

---

## 6. Control de Acceso Presencial y Asistencia del Personal

Todo paso por el control de acceso de recepción queda en `logs_asistencia`: los ingresos de los socios (permitidos o denegados, y las excepciones con quién las autorizó y por qué) y las marcas del personal. Para el personal, la entrada y la salida además abren y cierran un `turno_personal`, que el admin corrige dejando el motivo.

```mermaid
erDiagram
    usuarios ||--o{ logs_asistencia : "pasa por recepción"
    usuarios |o--o{ logs_asistencia : "autoriza excepción"
    usuarios ||--o{ turnos_personal : "cumple"
    logs_asistencia |o--o{ turnos_personal : "abre o cierra"
    turnos_personal ||--o{ correcciones_turno : "se corrige con"
    usuarios ||--o{ correcciones_turno : "corrige"

    usuarios {
        bigint id_usuario PK
    }
    configuracion_acceso {
        bigint id_configuracion PK "registro único (1)"
        boolean requerir_membresia_activa
        boolean requerir_certificado_medico
        boolean permitir_override_manual
        int dias_gracia_membresia
        int dias_gracia_certificado
    }
    logs_asistencia {
        bigint id_log PK
        bigint usuario_id FK
        bigint autorizado_por_id FK
        datetime fecha_hora
        varchar tipo_evento "INGRESO_MOLINETE, CHECKOUT, INGRESO_EXCEPCION"
        varchar resultado "PERMITIDO, DENEGADO_..."
        varchar motivo_excepcion
    }
    turnos_personal {
        bigint id_turno PK
        bigint usuario_id FK
        bigint log_entrada_id FK
        bigint log_salida_id FK
        datetime entrada
        datetime salida
        varchar origen "RECEPCION, MANUAL"
        boolean anulado
    }
    correcciones_turno {
        bigint id_correccion PK
        bigint turno_id FK
        bigint autor_id FK
        varchar accion "ALTA, CAMBIO, ANULACION"
        datetime entrada_anterior
        datetime salida_anterior
        datetime entrada_nueva
        datetime salida_nueva
        varchar motivo
        datetime fecha
    }
```

---

## 7. Clases y Reservas de Cupos

```mermaid
erDiagram
    usuarios |o--o{ clases : "dicta (profesor)"
    clases ||--o{ clase_horarios : "se dicta en"
    clase_horarios ||--o{ reservas_clases : "recibe"
    usuarios ||--o{ reservas_clases : "reserva (socio)"

    usuarios {
        bigint id_usuario PK
    }
    clases {
        bigint id_clase PK
        bigint profesor_id FK
        varchar nombre
        varchar descripcion
        int capacidad_maxima
        boolean activa
    }
    clase_horarios {
        bigint id_horario PK
        bigint clase_id FK
        varchar dia_semana "LUNES a DOMINGO"
        time hora_inicio
        time hora_fin
    }
    reservas_clases {
        bigint id_reserva PK
        bigint usuario_id FK
        bigint horario_id FK
        date fecha_clase
        datetime fecha_reserva
        varchar estado "CONFIRMADA, CANCELADA, ASISTIO, AUSENTE"
    }
```

---

## 8. Entrenamiento

`rutina_ejercicios` resuelve la relación N:M entre `rutinas` y `ejercicios`, con la dosis de cada ejercicio por día (series, repeticiones, peso y descanso). Las contraindicaciones de cada ejercicio se cruzan con las patologías del certificado médico del socio al armar la rutina.

```mermaid
erDiagram
    usuarios ||--o{ rutinas : "recibe (socio)"
    usuarios |o--o{ rutinas : "arma (profesor)"
    rutinas ||--o{ rutina_ejercicios : "contiene"
    ejercicios ||--o{ rutina_ejercicios : "se prescribe en"

    usuarios {
        bigint id_usuario PK
    }
    ejercicios {
        bigint id_ejercicio PK
        varchar nombre
        varchar descripcion
        varchar grupo_muscular "PECHO, ESPALDA, BICEPS..."
        varchar url_media
        varchar svg_target_id "zona del modelo muscular"
        varchar patologias_contraindicadas
    }
    rutinas {
        bigint id_rutina PK
        bigint socio_id FK
        bigint profesor_id FK
        varchar nombre
        varchar objetivo
        date fecha_creacion
        boolean activa
    }
    rutina_ejercicios {
        bigint id_rutina_ejercicio PK
        bigint rutina_id FK
        bigint ejercicio_id FK
        int dia_numero "1 a 7"
        int orden
        int series
        int repeticiones
        double peso_sugerido_kg
        int descanso_segundos
        varchar observaciones
    }
```

---

## 9. Seguimiento de Socios (CRM)

Las tareas automáticas las genera el backend cada hora (cuota vencida hace pocos días, apto médico por vencer, socio al día que hace días que no viene); las manuales las carga el equipo. La `clave` identifica la situación de una tarea automática, así la misma situación no genera dos tareas.

```mermaid
erDiagram
    usuarios ||--o{ tareas_seguimiento : "es contactado (socio)"
    usuarios |o--o{ tareas_seguimiento : "carga (personal)"
    usuarios |o--o{ tareas_seguimiento : "resuelve (personal)"

    usuarios {
        bigint id_usuario PK
        varchar nombre_completo
        varchar telefono "link de WhatsApp"
    }
    tareas_seguimiento {
        bigint id_tarea PK
        bigint usuario_id FK "socio"
        bigint creada_por_id FK "NULL = automática"
        bigint resuelta_por_id FK
        varchar tipo "CUOTA_VENCIDA, APTO_POR_VENCER, INACTIVO, MANUAL"
        varchar descripcion
        date vence
        date fecha_referencia
        varchar clave UK "evita duplicar automáticas"
        varchar estado "PENDIENTE, HECHA, DESCARTADA, RESUELTA"
        varchar canal "WHATSAPP, LLAMADA, PRESENCIAL, EMAIL, OTRO"
        varchar nota
        datetime fecha_creacion
        datetime fecha_resolucion
    }
```

---

## 10. Configuración Institucional del Gimnasio

Los datos públicos del gimnasio (nombre, contacto y logo) salen en los comprobantes y las rutinas en PDF. El horario de cada día define qué días cuentan en las métricas de asistencia.

```mermaid
erDiagram
    datos_gimnasio ||--|{ datos_gimnasio_horarios : "abre en"

    datos_gimnasio {
        bigint id_datos PK "registro único (1)"
        varchar nombre
        varchar direccion
        varchar ciudad
        varchar telefono
        varchar whatsapp
        varchar email
        varchar instagram
        varchar logo_url "logo de los PDF"
        datetime logo_actualizado
    }
    datos_gimnasio_horarios {
        bigint id_datos PK, FK
        int orden PK "0 = lunes ... 6 = domingo"
        varchar dia
        time abre
        time cierra "NULL = no abre"
    }
```

---

## Cardinalidades y Reglas de Negocio

| Relación | Cardinalidad | Regla de Negocio |
|---|---|---|
| `usuarios` — `perfiles_socio` | 1 : 0..1 | Solo los socios tienen ficha personal. |
| `descuentos` — `perfiles_socio` | 0..1 : N | Un descuento puede ser el habitual de muchos socios; borrarlo deja a esos socios sin descuento habitual. |
| `usuarios` — `certificados_medicos` | 1 : N | Un socio presenta varios aptos a lo largo del tiempo; rige el de vencimiento más lejano que no fue rechazado. |
| `usuarios` — `suscripciones` | 1 : N | Un socio renueva o cambia de plan; tiene una sola suscripción activa a la vez. |
| `planes` — `suscripciones` | 1 : N | Un plan lo contratan muchos socios. |
| `suscripciones` — `congelamientos` | 1 : N | Una membresía puede congelarse varias veces, dentro del tope anual de días. |
| `usuarios` — `pago_historial` | 1 : N | Solo los cobros `APROBADO` extienden la membresía y suman en la caja. |
| `usuarios` — `debitos_automaticos` | 1 : N | Un socio puede adherir al débito automático, darse de baja y volver a adherir. |
| `cierres_caja` — `cierres_caja_metodos` | 1 : 1..N | Cada arqueo se desglosa por medio de pago. |
| `pago_historial` — `comprobantes_fiscales` | 1 : N | Un cobro tiene su factura y, si se anula, la nota de crédito. |
| `comprobantes_fiscales` — `comprobantes_fiscales` | 0..1 : N | Una nota de crédito apunta a la factura que anula. |
| `usuarios` — `logs_asistencia` | 1 : N | Todo paso por recepción queda registrado. |
| `usuarios` — `turnos_personal` | 1 : N | Cada persona del equipo marca su entrada y su salida. |
| `logs_asistencia` — `turnos_personal` | 0..1 : N | El paso por recepción que abrió o cerró el turno; vacío si el turno lo cargó el admin. |
| `turnos_personal` — `correcciones_turno` | 1 : N | Cada corrección deja autor, motivo y las horas de antes y después. |
| `usuarios` — `clases` | 0..1 : N | Un profesor puede dar varias clases. |
| `clases` — `clase_horarios` | 1 : N | Una clase tiene varios horarios semanales. |
| `clase_horarios` — `reservas_clases` | 1 : N | Las reservas de una fecha no superan la capacidad máxima de la clase. |
| `rutinas` — `ejercicios` | **N : M** | Resuelta con la entidad asociativa `rutina_ejercicios`. |
| `usuarios` — `rutinas` | 1 : N | Un socio tiene una sola rutina activa: asignar una nueva desactiva la anterior. |
| `usuarios` — `tareas_seguimiento` | 1 : N | Un socio puede tener varias tareas de contacto, automáticas o manuales. |
| `datos_gimnasio` — `datos_gimnasio_horarios` | 1 : 7 | Un horario por cada día de la semana (los días sin horas no abre). |
