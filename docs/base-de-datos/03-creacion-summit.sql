-- =====================================================================================
--  SUMMIT - Sistema de Gestión de Gimnasio (Panel Administrativo y Operativo)
--  Script de creación de la base de datos (DDL) · MySQL 8.x
--
--  Refleja las 28 entidades JPA del backend (paquete com.summit.backend.model) y sus
--  2 colecciones (@ElementCollection): 30 tablas relacionales en Tercera Forma Normal (3FN).
--
--  Alcance: sistema de uso exclusivo del personal del gimnasio (ADMIN, RECEPCION, PROFESOR).
--  Los socios se registran en `usuarios` con rol SOCIO pero no inician sesión: son fichas
--  que administra el personal. Incluye la facturación electrónica de ARCA (ex AFIP).
--
--  En la PC del gimnasio la base la crea el propio backend (spring.jpa.hibernate.ddl-auto=update)
--  y los registros únicos de configuración (configuracion_acceso, reglas_membresia,
--  datos_gimnasio) los carga al arrancar. Este script documenta ese mismo esquema con nombres
--  explícitos para las restricciones y reglas CHECK equivalentes a las validaciones de Java.
--
--  Motor: InnoDB · Codificación: utf8mb4 / utf8mb4_0900_ai_ci.
-- =====================================================================================

CREATE DATABASE IF NOT EXISTS summit_fitness_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE summit_fitness_db;

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================================
-- 1. PERSONAS Y SEGURIDAD DEL SISTEMA
-- =====================================================================================

-- Tabla unificada de personas: personal del gimnasio (ADMIN, RECEPCION, PROFESOR) y socios (SOCIO).
-- Solo el personal inicia sesión; el rol SOCIO identifica las fichas de los clientes.
CREATE TABLE usuarios (
    id_usuario            BIGINT        NOT NULL AUTO_INCREMENT,
    dni                   VARCHAR(15)   NOT NULL,
    nombre_completo       VARCHAR(100)  NOT NULL,
    email                 VARCHAR(100)  NOT NULL,
    password              VARCHAR(255)  NOT NULL COMMENT 'Hash BCrypt; en los socios es un valor aleatorio que no sirve para entrar',
    telefono              VARCHAR(25)       NULL,
    rol                   VARCHAR(20)   NOT NULL,
    estado                VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion        DATETIME(6)       NULL DEFAULT CURRENT_TIMESTAMP(6),
    debe_cambiar_password BOOLEAN       NOT NULL DEFAULT FALSE
        COMMENT 'TRUE con contraseña temporal: obliga a definir una contraseña propia al ingresar',
    password_cambiada     DATETIME(6)       NULL COMMENT 'Último cambio de contraseña: invalida los tokens emitidos antes',
    CONSTRAINT pk_usuarios        PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuarios_dni    UNIQUE (dni),
    CONSTRAINT uq_usuarios_email  UNIQUE (email),
    CONSTRAINT ck_usuarios_rol    CHECK (rol    IN ('ADMIN','RECEPCION','PROFESOR','SOCIO')),
    CONSTRAINT ck_usuarios_estado CHECK (estado IN ('ACTIVO','INACTIVO','PENDIENTE','SUSPENDIDO','CANCELADO'))
) ENGINE=InnoDB COMMENT='Personal del gimnasio y socios registrados';

-- Ficha personal del socio (relación 1 a 1 con usuarios).
-- Se separa para no cargar la tabla de usuarios con datos que el personal no tiene.
CREATE TABLE perfiles_socio (
    id_perfil        BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_id       BIGINT       NOT NULL,
    fecha_nacimiento DATE             NULL,
    genero           VARCHAR(20)      NULL,
    domicilio        VARCHAR(150)     NULL,
    ciudad           VARCHAR(80)      NULL,
    objetivo         VARCHAR(150)     NULL COMMENT 'Ej.: bajar de peso, hipertrofia, rehabilitación',
    observaciones    VARCHAR(500)     NULL,
    foto_url         VARCHAR(255)     NULL COMMENT 'Ruta de la foto que saca recepción para reconocerlo en cada ingreso',
    foto_actualizada DATETIME(6)      NULL COMMENT 'Versión de la foto (evita que el navegador muestre una vieja)',
    descuento_id     BIGINT           NULL COMMENT 'Descuento habitual que se le propone en cada cobro',
    CONSTRAINT pk_perfiles_socio          PRIMARY KEY (id_perfil),
    CONSTRAINT uq_perfiles_socio_usuario  UNIQUE (usuario_id),
    CONSTRAINT fk_perfiles_socio_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_perfiles_socio_descuento FOREIGN KEY (descuento_id) REFERENCES descuentos (id_descuento)
) ENGINE=InnoDB COMMENT='Ficha personal del socio (1:1 con usuarios)';

-- Links de un solo uso de "¿Olvidaste tu contraseña?". Se guarda solo la huella SHA-256 del token.
CREATE TABLE recuperaciones_password (
    id_recuperacion BIGINT      NOT NULL AUTO_INCREMENT,
    usuario_id      BIGINT      NOT NULL,
    hash_token      VARCHAR(64) NOT NULL COMMENT 'SHA-256 en hexadecimal: quien lea la base no puede usar los links',
    creada          DATETIME(6) NOT NULL,
    vence           DATETIME(6) NOT NULL,
    usada           DATETIME(6)     NULL COMMENT 'NULL = todavía sirve; fecha de uso o de anulación por un pedido nuevo',
    CONSTRAINT pk_recuperaciones_password PRIMARY KEY (id_recuperacion),
    CONSTRAINT uq_recuperaciones_hash     UNIQUE (hash_token),
    CONSTRAINT fk_recuperaciones_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_recuperaciones_fechas   CHECK (vence > creada)
) ENGINE=InnoDB COMMENT='Pedidos de recuperación de contraseña del personal';

-- =====================================================================================
-- 2. CONTROL MÉDICO (APTO FÍSICO)
-- =====================================================================================

-- Certificados médicos de los socios. El control de acceso exige uno vigente (no vencido ni
-- rechazado) si así lo indica configuracion_acceso.requerir_certificado_medico.
CREATE TABLE certificados_medicos (
    id_certificado           BIGINT        NOT NULL AUTO_INCREMENT,
    usuario_id               BIGINT        NOT NULL COMMENT 'Socio titular del certificado',
    archivo_url              VARCHAR(255)  NOT NULL COMMENT 'Ruta interna del archivo (PDF o imagen); se descarga por la API con permisos',
    fecha_emision            DATE          NOT NULL,
    fecha_vencimiento        DATE          NOT NULL COMMENT 'Consultada en cada ingreso del socio',
    estado_legal             VARCHAR(20)   NOT NULL,
    observaciones_patologias VARCHAR(500)      NULL COMMENT 'Patologías y restricciones informadas (las cruza el constructor de rutinas)',
    resumen_ia               VARCHAR(1000)     NULL COMMENT 'Lectura del asistente de IA local (Ollama) confirmada por una persona',
    motivo_rechazo           VARCHAR(200)      NULL COMMENT 'Ilegible, no es del socio, sospecha de adulteración...',
    revisado_por_id          BIGINT            NULL COMMENT 'Empleado que lo rechazó o lo volvió a aprobar',
    fecha_revision           DATETIME(6)       NULL,
    CONSTRAINT pk_certificados_medicos PRIMARY KEY (id_certificado),
    CONSTRAINT fk_certificados_usuario   FOREIGN KEY (usuario_id)      REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_certificados_revisor   FOREIGN KEY (revisado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_certificados_estado CHECK (estado_legal IN ('VIGENTE','VENCIDO','RECHAZADO','PENDIENTE_REVISION')),
    CONSTRAINT ck_certificados_fechas CHECK (fecha_vencimiento >= fecha_emision)
) ENGINE=InnoDB COMMENT='Certificados médicos y control de apto físico';

-- =====================================================================================
-- 3. PLANES, MEMBRESÍAS Y REGLAS COMERCIALES
-- =====================================================================================

-- Catálogo de planes (frecuencia semanal y precio).
CREATE TABLE planes (
    id_plan          BIGINT         NOT NULL AUTO_INCREMENT,
    nombre_plan      VARCHAR(50)    NOT NULL,
    descripcion      VARCHAR(255)       NULL,
    precio_base      DECIMAL(10,2)  NOT NULL,
    duracion_dias    INT            NOT NULL DEFAULT 30,
    veces_por_semana INT                NULL COMMENT 'Días de acceso por semana (1 a 7). NULL = pase libre',
    activo           BOOLEAN        NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_planes        PRIMARY KEY (id_plan),
    CONSTRAINT uq_planes_nombre UNIQUE (nombre_plan),
    CONSTRAINT ck_planes_precio   CHECK (precio_base >= 0),
    CONSTRAINT ck_planes_duracion CHECK (duracion_dias > 0),
    CONSTRAINT ck_planes_veces    CHECK (veces_por_semana IS NULL OR veces_por_semana BETWEEN 1 AND 7)
) ENGINE=InnoDB COMMENT='Catálogo de planes y tarifas';

-- Catálogo de descuentos (familiar, estudiante, convenios). Se aplican sobre el precio del plan,
-- nunca sobre la matrícula.
CREATE TABLE descuentos (
    id_descuento BIGINT        NOT NULL AUTO_INCREMENT,
    nombre       VARCHAR(60)   NOT NULL,
    tipo         VARCHAR(20)   NOT NULL COMMENT 'PORCENTAJE (% del precio del plan) o MONTO_FIJO (pesos que se restan)',
    valor        DECIMAL(10,2) NOT NULL,
    activo       BOOLEAN       NOT NULL DEFAULT TRUE COMMENT 'Uno desactivado no se ofrece al cobrar ni se aplica como habitual',
    CONSTRAINT pk_descuentos        PRIMARY KEY (id_descuento),
    CONSTRAINT uq_descuentos_nombre UNIQUE (nombre),
    CONSTRAINT ck_descuentos_tipo  CHECK (tipo IN ('PORCENTAJE','MONTO_FIJO')),
    CONSTRAINT ck_descuentos_valor CHECK (valor > 0)
) ENGINE=InnoDB COMMENT='Catálogo de descuentos comerciales';

-- Membresías (vigencias) de cada socio. Cada cobro aprobado extiende la activa o crea una nueva.
CREATE TABLE suscripciones (
    id_suscripcion    BIGINT  NOT NULL AUTO_INCREMENT,
    usuario_id        BIGINT  NOT NULL,
    plan_id           BIGINT  NOT NULL,
    fecha_inicio      DATE    NOT NULL,
    fecha_vencimiento DATE    NOT NULL,
    activa            BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_suscripciones PRIMARY KEY (id_suscripcion),
    CONSTRAINT fk_suscripciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_suscripciones_plan    FOREIGN KEY (plan_id)    REFERENCES planes (id_plan),
    CONSTRAINT ck_suscripciones_fechas CHECK (fecha_vencimiento >= fecha_inicio)
) ENGINE=InnoDB COMMENT='Suscripciones y vigencia de membresías';

-- Congelamientos de membresía (vacaciones, salud). Mientras dura, el socio no ingresa y el
-- vencimiento de su suscripción se corre esos días.
CREATE TABLE congelamientos (
    id_congelamiento  BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_id        BIGINT       NOT NULL,
    suscripcion_id    BIGINT       NOT NULL COMMENT 'Membresía a la que se le corrió el vencimiento',
    desde             DATE         NOT NULL COMMENT 'Primer día congelado (incluido)',
    hasta             DATE         NOT NULL COMMENT 'Último día congelado (incluido)',
    motivo            VARCHAR(20)  NOT NULL,
    observacion       VARCHAR(200)     NULL,
    dias_aplicados    INT          NOT NULL COMMENT 'Días sumados al vencimiento (0 si se anuló antes de empezar)',
    terminado_antes   BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'Volvió antes: hasta pasó a ser el día anterior a su vuelta',
    anulado           BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'Se anuló antes de empezar: no corrió el vencimiento',
    registrado_por_id BIGINT           NULL,
    fecha_registro    DATETIME(6)  NOT NULL,
    CONSTRAINT pk_congelamientos PRIMARY KEY (id_congelamiento),
    CONSTRAINT fk_congelamientos_usuario     FOREIGN KEY (usuario_id)        REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_congelamientos_suscripcion FOREIGN KEY (suscripcion_id)    REFERENCES suscripciones (id_suscripcion),
    CONSTRAINT fk_congelamientos_registrador FOREIGN KEY (registrado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_congelamientos_motivo CHECK (motivo IN ('VACACIONES','SALUD','OTRO')),
    CONSTRAINT ck_congelamientos_dias   CHECK (dias_aplicados >= 0)
) ENGINE=InnoDB COMMENT='Congelamientos temporales de membresías';

-- Reglas de membresía que define el dueño (registro único, id 1).
CREATE TABLE reglas_membresia (
    id_reglas                    BIGINT        NOT NULL,
    matricula_monto              DECIMAL(10,2) NOT NULL COMMENT 'Matrícula de inscripción. 0 = no se cobra',
    matricula_reinscripcion_dias INT           NOT NULL COMMENT 'Se vuelve a cobrar tras más de estos días sin cuota. 0 = solo la primera vez',
    congelamiento_min_dias       INT           NOT NULL COMMENT 'Días mínimos de cada congelamiento',
    congelamiento_max_dias_anio  INT           NOT NULL COMMENT 'Días máximos por año calendario. 0 = el gimnasio no congela',
    CONSTRAINT pk_reglas_membresia PRIMARY KEY (id_reglas),
    CONSTRAINT ck_reglas_valores CHECK (matricula_monto >= 0 AND matricula_reinscripcion_dias >= 0
                                        AND congelamiento_min_dias >= 1 AND congelamiento_max_dias_anio >= 0)
) ENGINE=InnoDB COMMENT='Matrícula y límites de congelamiento (registro único)';

-- =====================================================================================
-- 4. COBROS, DÉBITO AUTOMÁTICO Y CAJA
-- =====================================================================================

-- Cobros de membresía (en recepción, con tarjeta por Mercado Pago o por débito automático).
-- Conserva la foto del precio, el descuento y la matrícula del momento del cobro.
CREATE TABLE pago_historial (
    id_pago            BIGINT        NOT NULL AUTO_INCREMENT,
    usuario_id         BIGINT        NOT NULL COMMENT 'Socio que paga',
    plan_id            BIGINT        NOT NULL,
    monto_abonado      DECIMAL(10,2) NOT NULL COMMENT 'precio_lista - descuento_monto + matricula_monto',
    fecha_pago         DATETIME(6)   NOT NULL,
    metodo_pago        VARCHAR(30)   NOT NULL,
    comprobante_nro    VARCHAR(50)       NULL COMMENT 'Número de operación de la transferencia o del QR',
    estado_pago        VARCHAR(20)   NOT NULL DEFAULT 'APROBADO' COMMENT 'Solo APROBADO extiende la membresía y suma en la caja',
    mp_payment_id      VARCHAR(40)       NULL COMMENT 'Id del cobro en Mercado Pago (débito o tarjeta): nunca se registra dos veces',
    registrado_por_id  BIGINT            NULL COMMENT 'Empleado que cobró (NULL en los cobros automáticos)',
    verificado_por_id  BIGINT            NULL COMMENT 'Quién confirmó o rechazó un pago "a verificar"',
    fecha_verificacion DATETIME(6)       NULL,
    precio_lista       DECIMAL(10,2)     NULL COMMENT 'Precio del plan al momento del cobro',
    descuento_nombre   VARCHAR(120)      NULL COMMENT 'Nombre del descuento o "Especial: <motivo>"',
    descuento_monto    DECIMAL(10,2)     NULL,
    matricula_monto    DECIMAL(10,2)     NULL COMMENT 'NULL = no correspondía; 0 = se bonificó; > 0 = se cobró',
    vence_membresia    DATE              NULL COMMENT 'Hasta cuándo quedó paga la membresía con este cobro',
    CONSTRAINT pk_pago_historial PRIMARY KEY (id_pago),
    CONSTRAINT uq_pago_mp_payment UNIQUE (mp_payment_id),
    CONSTRAINT fk_pago_usuario      FOREIGN KEY (usuario_id)        REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_pago_plan         FOREIGN KEY (plan_id)           REFERENCES planes (id_plan),
    CONSTRAINT fk_pago_registrador  FOREIGN KEY (registrado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_pago_verificador  FOREIGN KEY (verificado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_pago_metodo CHECK (metodo_pago IN ('EFECTIVO','TRANSFERENCIA','MERCADO_PAGO','TARJETA_DEBITO','TARJETA_CREDITO','DEBITO_AUTOMATICO')),
    CONSTRAINT ck_pago_estado CHECK (estado_pago IN ('PENDIENTE','APROBADO','RECHAZADO')),
    CONSTRAINT ck_pago_monto  CHECK (monto_abonado >= 0)
) ENGINE=InnoDB COMMENT='Registro de cobros de membresías';

-- Adhesiones al débito automático mensual (Mercado Pago Suscripciones / preapproval).
CREATE TABLE debitos_automaticos (
    id_debito             BIGINT        NOT NULL AUTO_INCREMENT,
    usuario_id            BIGINT        NOT NULL,
    plan_id               BIGINT        NOT NULL,
    monto                 DECIMAL(10,2) NOT NULL COMMENT 'Lo que cobra Mercado Pago cada mes (sigue al precio del plan)',
    estado                VARCHAR(30)   NOT NULL,
    mp_preapproval_id     VARCHAR(64)       NULL COMMENT 'Id de la suscripción en Mercado Pago',
    link_autorizacion     VARCHAR(500)      NULL COMMENT 'Link donde el socio autoriza (recepción lo muestra como QR)',
    email_pagador         VARCHAR(100)  NOT NULL COMMENT 'Cuenta de Mercado Pago con la que paga',
    medio_pago            VARCHAR(40)       NULL COMMENT 'Según Mercado Pago (account_money, debvisa, master...)',
    fecha_alta            DATETIME(6)   NOT NULL,
    creado_por_id         BIGINT            NULL,
    proximo_cobro         DATE              NULL,
    ultimo_cobro          DATETIME(6)       NULL,
    ultimo_rechazo        DATETIME(6)       NULL COMMENT 'Alerta para recepción hasta que entre un cobro aprobado',
    detalle_rechazo       VARCHAR(150)      NULL,
    ultima_sincronizacion DATETIME(6)       NULL,
    fecha_baja            DATETIME(6)       NULL,
    baja_por_id           BIGINT            NULL,
    CONSTRAINT pk_debitos_automaticos PRIMARY KEY (id_debito),
    CONSTRAINT uq_debitos_preapproval UNIQUE (mp_preapproval_id),
    CONSTRAINT fk_debitos_usuario FOREIGN KEY (usuario_id)    REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_debitos_plan    FOREIGN KEY (plan_id)       REFERENCES planes (id_plan),
    CONSTRAINT fk_debitos_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_debitos_baja    FOREIGN KEY (baja_por_id)   REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_debitos_estado CHECK (estado IN ('PENDIENTE_AUTORIZACION','ACTIVO','PAUSADO','CANCELADO')),
    CONSTRAINT ck_debitos_monto  CHECK (monto > 0)
) ENGINE=InnoDB COMMENT='Adhesiones al débito automático con Mercado Pago';

-- Gastos (egresos) del gimnasio. Uno en efectivo sale de la caja de recepción, salvo que lo haya
-- pagado el dueño con su plata (fuera_de_caja). No se borran: se anulan con motivo.
CREATE TABLE gastos (
    id_gasto          BIGINT        NOT NULL AUTO_INCREMENT,
    fecha             DATETIME(6)   NOT NULL,
    monto             DECIMAL(12,2) NOT NULL,
    categoria         VARCHAR(20)   NOT NULL,
    descripcion       VARCHAR(200)  NOT NULL,
    metodo_pago       VARCHAR(30)   NOT NULL,
    fuera_de_caja     BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'En efectivo pero no salió de la caja: no entra en el arqueo',
    comprobante_nro   VARCHAR(50)       NULL,
    registrado_por_id BIGINT            NULL,
    anulado           BOOLEAN       NOT NULL DEFAULT FALSE,
    anulado_por_id    BIGINT            NULL,
    fecha_anulacion   DATETIME(6)       NULL,
    motivo_anulacion  VARCHAR(200)      NULL,
    CONSTRAINT pk_gastos PRIMARY KEY (id_gasto),
    CONSTRAINT fk_gastos_registrador FOREIGN KEY (registrado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_gastos_anulador    FOREIGN KEY (anulado_por_id)    REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_gastos_categoria CHECK (categoria IN ('ALQUILER','SERVICIOS','SUELDOS','LIMPIEZA','MANTENIMIENTO','EQUIPAMIENTO','INSUMOS','IMPUESTOS','OTROS')),
    CONSTRAINT ck_gastos_metodo    CHECK (metodo_pago IN ('EFECTIVO','TRANSFERENCIA','MERCADO_PAGO','TARJETA_DEBITO','TARJETA_CREDITO')),
    CONSTRAINT ck_gastos_monto     CHECK (monto > 0),
    CONSTRAINT ck_gastos_fuera_caja CHECK (fuera_de_caja = FALSE OR metodo_pago = 'EFECTIVO')
) ENGINE=InnoDB COMMENT='Gastos y egresos de la caja';

-- Cierre de caja (arqueo) de un turno: desde el cierre anterior hasta este. Foto inmutable.
CREATE TABLE cierres_caja (
    id_cierre         BIGINT        NOT NULL AUTO_INCREMENT,
    desde             DATETIME(6)   NOT NULL COMMENT 'Comienzo del turno: el cierre anterior (o el inicio del día)',
    hasta             DATETIME(6)   NOT NULL COMMENT 'Momento del cierre',
    fondo_inicial     DECIMAL(12,2) NOT NULL COMMENT 'Efectivo que dejó el cierre anterior',
    ingresos_efectivo DECIMAL(12,2) NOT NULL,
    egresos_efectivo  DECIMAL(12,2) NOT NULL,
    efectivo_esperado DECIMAL(12,2) NOT NULL COMMENT 'fondo_inicial + ingresos_efectivo - egresos_efectivo',
    efectivo_contado  DECIMAL(12,2) NOT NULL,
    diferencia        DECIMAL(12,2) NOT NULL COMMENT 'efectivo_contado - efectivo_esperado (negativo = faltante)',
    retiro            DECIMAL(12,2) NOT NULL COMMENT 'Efectivo que se lleva el dueño',
    fondo_siguiente   DECIMAL(12,2) NOT NULL COMMENT 'efectivo_contado - retiro',
    total_ingresos    DECIMAL(12,2) NOT NULL COMMENT 'Todos los medios de pago',
    total_egresos     DECIMAL(12,2) NOT NULL,
    cantidad_cobros   INT           NOT NULL,
    cantidad_gastos   INT           NOT NULL,
    observacion       VARCHAR(300)      NULL,
    cerrado_por_id    BIGINT            NULL,
    CONSTRAINT pk_cierres_caja PRIMARY KEY (id_cierre),
    CONSTRAINT uq_cierres_desde UNIQUE (desde),
    CONSTRAINT fk_cierres_cerrado_por FOREIGN KEY (cerrado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_cierres_periodo CHECK (hasta > desde),
    CONSTRAINT ck_cierres_retiro  CHECK (retiro >= 0 AND retiro <= efectivo_contado)
) ENGINE=InnoDB COMMENT='Cierres y arqueos de caja por turno';

-- Desglose de cada cierre por medio de pago (@ElementCollection de CierreCaja).
CREATE TABLE cierres_caja_metodos (
    cierre_id   BIGINT        NOT NULL,
    metodo_pago VARCHAR(30)   NOT NULL,
    ingresos    DECIMAL(12,2) NOT NULL,
    egresos     DECIMAL(12,2) NOT NULL,
    CONSTRAINT pk_cierres_caja_metodos PRIMARY KEY (cierre_id, metodo_pago),
    CONSTRAINT fk_cierres_metodos_cierre FOREIGN KEY (cierre_id) REFERENCES cierres_caja (id_cierre) ON DELETE CASCADE,
    CONSTRAINT ck_cierres_metodos_metodo CHECK (metodo_pago IN ('EFECTIVO','TRANSFERENCIA','MERCADO_PAGO','TARJETA_DEBITO','TARJETA_CREDITO','DEBITO_AUTOMATICO'))
) ENGINE=InnoDB COMMENT='Totales de cada cierre por medio de pago';

-- =====================================================================================
-- 5. FACTURACIÓN ELECTRÓNICA (ARCA, EX AFIP)
-- =====================================================================================

-- Datos fiscales del dueño (registro único, id 1). Aparte de datos_gimnasio, que es información pública.
CREATE TABLE datos_fiscales (
    id_datos            BIGINT       NOT NULL,
    cuit                VARCHAR(11)      NULL COMMENT '11 dígitos, sin guiones',
    razon_social        VARCHAR(100)     NULL COMMENT 'Como figura en ARCA',
    condicion_iva       VARCHAR(30)      NULL COMMENT 'Define la letra: MONOTRIBUTO = C, RESPONSABLE_INSCRIPTO = B',
    ingresos_brutos     VARCHAR(30)      NULL COMMENT 'Número de inscripción, "Exento" o "Convenio Multilateral"',
    inicio_actividades  DATE             NULL,
    domicilio_comercial VARCHAR(150)     NULL,
    punto_venta         INT              NULL COMMENT 'Punto de venta "web services" dado de alta en ARCA',
    identificar_socio   BOOLEAN      NOT NULL DEFAULT FALSE COMMENT 'TRUE = la factura sale con el DNI del socio; FALSE = consumidor final',
    CONSTRAINT pk_datos_fiscales PRIMARY KEY (id_datos),
    CONSTRAINT ck_datos_fiscales_iva  CHECK (condicion_iva IN ('MONOTRIBUTO','RESPONSABLE_INSCRIPTO')),
    CONSTRAINT ck_datos_fiscales_pv   CHECK (punto_venta IS NULL OR punto_venta BETWEEN 1 AND 99998)
) ENGINE=InnoDB COMMENT='Datos fiscales del emisor de las facturas (registro único)';

-- Factura o nota de crédito electrónica de un cobro. Se crea PENDIENTE en la misma transacción que
-- aprueba el pago y una cola le pide el CAE a ARCA. Autorizada, no se modifica: se anula con una NC.
CREATE TABLE comprobantes_fiscales (
    id_comprobante            BIGINT        NOT NULL AUTO_INCREMENT,
    pago_id                   BIGINT        NOT NULL COMMENT 'Cobro facturado',
    comprobante_asociado_id   BIGINT            NULL COMMENT 'En una nota de crédito: la factura que anula',
    ambiente                  VARCHAR(15)   NOT NULL COMMENT 'Los de prueba nunca se mezclan con los reales',
    estado                    VARCHAR(15)   NOT NULL,
    nota_credito              BOOLEAN       NOT NULL DEFAULT FALSE,
    tipo                      VARCHAR(20)       NULL COMMENT 'Letra y clase; NULL hasta que se envía',
    punto_venta               INT               NULL,
    numero                    BIGINT            NULL COMMENT 'Correlativo por ambiente, CUIT, tipo y punto de venta',
    fecha                     DATE              NULL,
    cuit_emisor               VARCHAR(11)       NULL COMMENT 'Copia de los datos fiscales al emitirlo (lo que va impreso)',
    emisor_razon_social       VARCHAR(100)      NULL,
    emisor_domicilio          VARCHAR(150)      NULL,
    emisor_condicion_iva      VARCHAR(30)       NULL,
    emisor_ingresos_brutos    VARCHAR(30)       NULL,
    emisor_inicio_actividades DATE              NULL,
    identificar_receptor      BOOLEAN       NOT NULL DEFAULT FALSE,
    doc_tipo                  INT               NULL COMMENT '99 = consumidor final sin identificar; 96 = DNI',
    doc_nro                   BIGINT            NULL,
    condicion_iva_receptor    INT               NULL COMMENT 'Código de ARCA (5 = consumidor final)',
    receptor_nombre           VARCHAR(120)      NULL,
    imp_total                 DECIMAL(12,2) NOT NULL,
    imp_neto                  DECIMAL(12,2)     NULL,
    imp_iva                   DECIMAL(12,2)     NULL COMMENT 'Solo en la factura B (IVA contenido)',
    servicio_desde            DATE              NULL COMMENT 'Período de la membresía facturada',
    servicio_hasta            DATE              NULL,
    vencimiento_pago          DATE              NULL,
    motivo                    VARCHAR(200)      NULL COMMENT 'Nota de crédito: por qué se anuló la factura',
    cae                       VARCHAR(14)       NULL COMMENT 'Código de Autorización Electrónico',
    cae_vencimiento           DATE              NULL,
    observaciones             TEXT              NULL COMMENT 'Observaciones o errores de ARCA ("código: mensaje")',
    intentos                  INT           NOT NULL DEFAULT 0,
    proximo_intento           DATETIME(6)       NULL,
    ultimo_error              VARCHAR(500)      NULL,
    solicitado_por_id         BIGINT            NULL,
    creado                    DATETIME(6)   NOT NULL,
    autorizado                DATETIME(6)       NULL,
    ultimo_pedido             TEXT              NULL COMMENT 'Auditoría: último pedido a ARCA, sin token ni firma',
    ultima_respuesta          TEXT              NULL,
    version                   BIGINT            NULL COMMENT 'Bloqueo optimista (@Version)',
    CONSTRAINT pk_comprobantes_fiscales PRIMARY KEY (id_comprobante),
    CONSTRAINT uk_comprobante_numero UNIQUE (ambiente, cuit_emisor, tipo, punto_venta, numero),
    CONSTRAINT fk_comprobantes_pago      FOREIGN KEY (pago_id)                 REFERENCES pago_historial (id_pago),
    CONSTRAINT fk_comprobantes_asociado  FOREIGN KEY (comprobante_asociado_id) REFERENCES comprobantes_fiscales (id_comprobante),
    CONSTRAINT fk_comprobantes_solicitante FOREIGN KEY (solicitado_por_id)     REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_comprobantes_ambiente CHECK (ambiente IN ('SIMULADOR','HOMOLOGACION','PRODUCCION')),
    CONSTRAINT ck_comprobantes_estado   CHECK (estado IN ('PENDIENTE','ENVIANDO','INCIERTO','AUTORIZADO','RECHAZADO')),
    CONSTRAINT ck_comprobantes_tipo     CHECK (tipo IN ('FACTURA_B','NOTA_CREDITO_B','FACTURA_C','NOTA_CREDITO_C')),
    CONSTRAINT ck_comprobantes_iva      CHECK (emisor_condicion_iva IN ('MONOTRIBUTO','RESPONSABLE_INSCRIPTO')),
    CONSTRAINT ck_comprobantes_total    CHECK (imp_total >= 0),
    INDEX idx_comprobante_cola (ambiente, estado, proximo_intento),
    INDEX idx_comprobante_pago (pago_id)
) ENGINE=InnoDB COMMENT='Facturas y notas de crédito electrónicas';

-- Permiso de acceso de ARCA (Ticket de Acceso del WSAA): vale 12 horas y se reutiliza hasta que vence.
CREATE TABLE tickets_acceso_arca (
    id_ticket          BIGINT      NOT NULL AUTO_INCREMENT,
    ambiente           VARCHAR(15) NOT NULL,
    huella_certificado VARCHAR(64) NOT NULL COMMENT 'SHA-256 del certificado con el que se pidió',
    token              TEXT        NOT NULL COMMENT 'Secreto: no se muestra ni se escribe en los logs',
    firma              TEXT        NOT NULL COMMENT 'Secreto: no se muestra ni se escribe en los logs',
    vence              DATETIME(6) NOT NULL COMMENT 'Hora argentina',
    CONSTRAINT pk_tickets_acceso_arca PRIMARY KEY (id_ticket),
    CONSTRAINT uk_ticket_arca UNIQUE (ambiente, huella_certificado),
    CONSTRAINT ck_tickets_ambiente CHECK (ambiente IN ('SIMULADOR','HOMOLOGACION','PRODUCCION'))
) ENGINE=InnoDB COMMENT='Permisos de acceso vigentes a los web services de ARCA';

-- =====================================================================================
-- 6. CONTROL DE ACCESO PRESENCIAL Y ASISTENCIA DEL PERSONAL
-- =====================================================================================

-- Reglas del control de acceso en recepción (registro único, id 1).
CREATE TABLE configuracion_acceso (
    id_configuracion            BIGINT  NOT NULL,
    requerir_membresia_activa   BOOLEAN NOT NULL,
    requerir_certificado_medico BOOLEAN NOT NULL,
    permitir_override_manual    BOOLEAN NOT NULL COMMENT 'Habilita el ingreso por excepción autorizado por recepción',
    dias_gracia_membresia       INT     NOT NULL COMMENT 'Días que se tolera la cuota vencida',
    dias_gracia_certificado     INT     NOT NULL COMMENT 'Días que se tolera el certificado vencido',
    CONSTRAINT pk_configuracion_acceso PRIMARY KEY (id_configuracion),
    CONSTRAINT ck_configuracion_gracia CHECK (dias_gracia_membresia >= 0 AND dias_gracia_certificado >= 0)
) ENGINE=InnoDB COMMENT='Reglas del control de acceso presencial (registro único)';

-- Cada paso por el control de acceso de recepción: ingresos de socios (permitidos o denegados) y
-- marcas del personal. Historial que no se modifica (salvo la corrección en el momento de un turno).
CREATE TABLE logs_asistencia (
    id_log            BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_id        BIGINT       NOT NULL,
    fecha_hora        DATETIME(6)  NOT NULL,
    tipo_evento       VARCHAR(20)  NOT NULL,
    resultado         VARCHAR(35)  NOT NULL,
    autorizado_por_id BIGINT           NULL COMMENT 'Empleado que autorizó un ingreso por excepción',
    motivo_excepcion  VARCHAR(200)     NULL,
    CONSTRAINT pk_logs_asistencia PRIMARY KEY (id_log),
    CONSTRAINT fk_logs_asistencia_usuario     FOREIGN KEY (usuario_id)        REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_logs_asistencia_autorizador FOREIGN KEY (autorizado_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_logs_asistencia_tipo CHECK (tipo_evento IN ('CHECKOUT','INGRESO_MOLINETE','INGRESO_EXCEPCION')),
    CONSTRAINT ck_logs_asistencia_resultado CHECK (resultado IN ('PERMITIDO','DENEGADO_CUENTA_INACTIVA','DENEGADO_MEMBRESIA_CONGELADA','DENEGADO_CUOTA_VENCIDA','DENEGADO_LIMITE_SEMANAL','DENEGADO_CERTIFICADO_MEDICO')),
    CONSTRAINT ck_logs_asistencia_excepcion CHECK (tipo_evento <> 'INGRESO_EXCEPCION' OR motivo_excepcion IS NOT NULL)
) ENGINE=InnoDB COMMENT='Historial de pasos por el control de acceso';

-- Turnos de trabajo del personal: de la entrada a la salida. Los abre y cierra su paso por recepción.
CREATE TABLE turnos_personal (
    id_turno       BIGINT      NOT NULL AUTO_INCREMENT,
    usuario_id     BIGINT      NOT NULL COMMENT 'Persona del equipo',
    entrada        DATETIME(6) NOT NULL,
    salida         DATETIME(6)     NULL COMMENT 'NULL = en curso, o se olvidó de marcarla',
    origen         VARCHAR(20) NOT NULL,
    anulado        BOOLEAN     NOT NULL DEFAULT FALSE COMMENT 'No suma horas pero queda guardado con el motivo',
    log_entrada_id BIGINT          NULL COMMENT 'Paso por recepción que lo abrió (NULL si lo cargó el admin)',
    log_salida_id  BIGINT          NULL COMMENT 'Paso por recepción que lo cerró',
    CONSTRAINT pk_turnos_personal PRIMARY KEY (id_turno),
    CONSTRAINT fk_turnos_usuario     FOREIGN KEY (usuario_id)     REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_turnos_log_entrada FOREIGN KEY (log_entrada_id) REFERENCES logs_asistencia (id_log),
    CONSTRAINT fk_turnos_log_salida  FOREIGN KEY (log_salida_id)  REFERENCES logs_asistencia (id_log),
    CONSTRAINT ck_turnos_origen CHECK (origen IN ('RECEPCION','MANUAL')),
    CONSTRAINT ck_turnos_horas  CHECK (salida IS NULL OR salida >= entrada),
    INDEX idx_turnos_personal_usuario (usuario_id, entrada),
    INDEX idx_turnos_personal_entrada (entrada)
) ENGINE=InnoDB COMMENT='Turnos de trabajo del personal';

-- Correcciones de los turnos: quién, cuándo, por qué y las horas de antes y de después.
CREATE TABLE correcciones_turno (
    id_correccion    BIGINT       NOT NULL AUTO_INCREMENT,
    turno_id         BIGINT       NOT NULL,
    accion           VARCHAR(20)  NOT NULL,
    entrada_anterior DATETIME(6)      NULL COMMENT 'Vacía en un ALTA',
    salida_anterior  DATETIME(6)      NULL,
    entrada_nueva    DATETIME(6)      NULL COMMENT 'Vacía en una ANULACION',
    salida_nueva     DATETIME(6)      NULL,
    motivo           VARCHAR(200) NOT NULL,
    autor_id         BIGINT       NOT NULL,
    fecha            DATETIME(6)  NOT NULL,
    CONSTRAINT pk_correcciones_turno PRIMARY KEY (id_correccion),
    CONSTRAINT fk_correcciones_turno FOREIGN KEY (turno_id) REFERENCES turnos_personal (id_turno),
    CONSTRAINT fk_correcciones_autor FOREIGN KEY (autor_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_correcciones_accion CHECK (accion IN ('ALTA','CAMBIO','ANULACION')),
    INDEX idx_correcciones_turno (turno_id)
) ENGINE=InnoDB COMMENT='Auditoría de correcciones de turnos del personal';

-- =====================================================================================
-- 7. CLASES Y RESERVAS DE CUPOS
-- =====================================================================================

-- Clases grupales (Spinning, Funcional, Yoga...).
CREATE TABLE clases (
    id_clase         BIGINT       NOT NULL AUTO_INCREMENT,
    nombre           VARCHAR(100) NOT NULL,
    descripcion      VARCHAR(300)     NULL,
    capacidad_maxima INT          NOT NULL,
    profesor_id      BIGINT           NULL,
    activa           BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_clases PRIMARY KEY (id_clase),
    CONSTRAINT fk_clases_profesor FOREIGN KEY (profesor_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_clases_capacidad CHECK (capacidad_maxima > 0)
) ENGINE=InnoDB COMMENT='Clases y actividades grupales';

-- Horarios semanales de cada clase.
CREATE TABLE clase_horarios (
    id_horario  BIGINT      NOT NULL AUTO_INCREMENT,
    clase_id    BIGINT      NOT NULL,
    dia_semana  VARCHAR(15) NOT NULL,
    hora_inicio TIME(6)     NOT NULL,
    hora_fin    TIME(6)     NOT NULL,
    CONSTRAINT pk_clase_horarios PRIMARY KEY (id_horario),
    CONSTRAINT fk_clase_horarios_clase FOREIGN KEY (clase_id) REFERENCES clases (id_clase),
    CONSTRAINT ck_clase_horarios_dia  CHECK (dia_semana IN ('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO')),
    CONSTRAINT ck_clase_horarios_hora CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB COMMENT='Días y horarios de cada clase';

-- Lugares reservados por los socios en una clase de una fecha (los carga recepción).
CREATE TABLE reservas_clases (
    id_reserva    BIGINT      NOT NULL AUTO_INCREMENT,
    usuario_id    BIGINT      NOT NULL COMMENT 'Socio',
    horario_id    BIGINT      NOT NULL,
    fecha_clase   DATE        NOT NULL,
    fecha_reserva DATETIME(6) NOT NULL,
    estado        VARCHAR(20) NOT NULL,
    CONSTRAINT pk_reservas_clases PRIMARY KEY (id_reserva),
    CONSTRAINT fk_reservas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_reservas_horario FOREIGN KEY (horario_id) REFERENCES clase_horarios (id_horario),
    CONSTRAINT ck_reservas_estado CHECK (estado IN ('CONFIRMADA','CANCELADA','ASISTIO','AUSENTE'))
) ENGINE=InnoDB COMMENT='Reservas de lugares en clases grupales';

-- =====================================================================================
-- 8. ENTRENAMIENTO: CATÁLOGO DE EJERCICIOS Y RUTINAS
-- =====================================================================================

-- Catálogo de ejercicios por grupo muscular, con sus contraindicaciones.
CREATE TABLE ejercicios (
    id_ejercicio               BIGINT       NOT NULL AUTO_INCREMENT,
    nombre                     VARCHAR(100) NOT NULL,
    descripcion                VARCHAR(500)     NULL,
    grupo_muscular             VARCHAR(30)  NOT NULL,
    url_media                  VARCHAR(255)     NULL COMMENT 'GIF, video o imagen del ejercicio',
    svg_target_id              VARCHAR(50)      NULL COMMENT 'Zona del modelo muscular del panel',
    patologias_contraindicadas VARCHAR(500)     NULL COMMENT 'Separadas por comas (ej. HERNIA,ASMA,RODILLA)',
    CONSTRAINT pk_ejercicios PRIMARY KEY (id_ejercicio),
    CONSTRAINT ck_ejercicios_grupo CHECK (grupo_muscular IN ('PECHO','ESPALDA','BICEPS','TRICEPS','HOMBROS','CUADRICEPS','ISQUIOS','GLUTEOS','PANTORRILLAS','ABDOMINALES','CORE'))
) ENGINE=InnoDB COMMENT='Catálogo de ejercicios';

-- Rutinas que arma el profesor para un socio.
CREATE TABLE rutinas (
    id_rutina      BIGINT       NOT NULL AUTO_INCREMENT,
    nombre         VARCHAR(100) NOT NULL,
    objetivo       VARCHAR(255)     NULL,
    socio_id       BIGINT       NOT NULL,
    profesor_id    BIGINT           NULL,
    fecha_creacion DATE         NOT NULL,
    activa         BOOLEAN      NOT NULL DEFAULT TRUE COMMENT 'Al asignar una nueva, la anterior del socio queda inactiva',
    CONSTRAINT pk_rutinas PRIMARY KEY (id_rutina),
    CONSTRAINT fk_rutinas_socio    FOREIGN KEY (socio_id)    REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_rutinas_profesor FOREIGN KEY (profesor_id) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB COMMENT='Rutinas de entrenamiento asignadas';

-- Entidad asociativa N:M entre rutinas y ejercicios, con la dosis prescripta para cada día.
CREATE TABLE rutina_ejercicios (
    id_rutina_ejercicio BIGINT       NOT NULL AUTO_INCREMENT,
    rutina_id           BIGINT       NOT NULL,
    ejercicio_id        BIGINT       NOT NULL,
    dia_numero          INT              NULL COMMENT 'Día 1 a 7 de la rutina (NULL en rutinas viejas = día 1)',
    orden               INT              NULL COMMENT 'Posición dentro del día',
    series              INT              NULL,
    repeticiones        INT              NULL,
    peso_sugerido_kg    DOUBLE           NULL,
    descanso_segundos   INT              NULL,
    observaciones       VARCHAR(300)     NULL,
    CONSTRAINT pk_rutina_ejercicios PRIMARY KEY (id_rutina_ejercicio),
    CONSTRAINT fk_rutina_ejercicios_rutina    FOREIGN KEY (rutina_id)    REFERENCES rutinas (id_rutina) ON DELETE CASCADE,
    CONSTRAINT fk_rutina_ejercicios_ejercicio FOREIGN KEY (ejercicio_id) REFERENCES ejercicios (id_ejercicio),
    CONSTRAINT ck_rutina_ejercicios_dia CHECK (dia_numero IS NULL OR dia_numero BETWEEN 1 AND 7),
    CONSTRAINT ck_rutina_ejercicios_valores CHECK ((series IS NULL OR series >= 0) AND (repeticiones IS NULL OR repeticiones >= 0)
                                                   AND (peso_sugerido_kg IS NULL OR peso_sugerido_kg >= 0)
                                                   AND (descanso_segundos IS NULL OR descanso_segundos >= 0))
) ENGINE=InnoDB COMMENT='Ejercicios de cada rutina con series, repeticiones y descanso';

-- =====================================================================================
-- 9. SEGUIMIENTO DE SOCIOS (CRM)
-- =====================================================================================

-- Tareas de contacto con un socio: automáticas (cuota vencida, apto por vencer, inactividad) o
-- cargadas por el equipo. La clave evita que la misma situación genere dos tareas.
CREATE TABLE tareas_seguimiento (
    id_tarea         BIGINT       NOT NULL AUTO_INCREMENT,
    usuario_id       BIGINT       NOT NULL COMMENT 'Socio a contactar',
    tipo             VARCHAR(20)  NOT NULL,
    descripcion      VARCHAR(300) NOT NULL,
    vence            DATE         NOT NULL COMMENT 'Para cuándo hay que hacerla',
    fecha_referencia DATE             NULL COMMENT 'Vencimiento de la cuota o del apto, o último ingreso',
    clave            VARCHAR(80)      NULL COMMENT 'Situación de una automática (ej. VENCIDA:12:2026-10-20); NULL en las manuales',
    estado           VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
    canal            VARCHAR(20)      NULL COMMENT 'Cómo se lo contactó',
    nota             VARCHAR(300)     NULL COMMENT 'Qué pasó al hacerla (o por qué se resolvió sola)',
    creada_por_id    BIGINT           NULL COMMENT 'NULL = automática',
    fecha_creacion   DATETIME(6)  NOT NULL,
    resuelta_por_id  BIGINT           NULL,
    fecha_resolucion DATETIME(6)      NULL,
    CONSTRAINT pk_tareas_seguimiento PRIMARY KEY (id_tarea),
    CONSTRAINT uq_tareas_clave UNIQUE (clave),
    CONSTRAINT fk_tareas_usuario  FOREIGN KEY (usuario_id)      REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_tareas_creador  FOREIGN KEY (creada_por_id)   REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_tareas_resuelta FOREIGN KEY (resuelta_por_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT ck_tareas_tipo   CHECK (tipo   IN ('CUOTA_POR_VENCER','CUOTA_VENCIDA','APTO_POR_VENCER','INACTIVO','MANUAL')),
    CONSTRAINT ck_tareas_estado CHECK (estado IN ('PENDIENTE','HECHA','DESCARTADA','RESUELTA')),
    CONSTRAINT ck_tareas_canal  CHECK (canal  IN ('WHATSAPP','LLAMADA','PRESENCIAL','EMAIL','OTRO'))
) ENGINE=InnoDB COMMENT='Tareas de seguimiento y contacto con socios';

-- =====================================================================================
-- 10. CONFIGURACIÓN INSTITUCIONAL DEL GIMNASIO
-- =====================================================================================

-- Datos públicos del gimnasio (registro único, id 1): salen en los comprobantes y las rutinas en PDF.
CREATE TABLE datos_gimnasio (
    id_datos         BIGINT       NOT NULL,
    nombre           VARCHAR(80)  NOT NULL,
    direccion        VARCHAR(150)     NULL,
    ciudad           VARCHAR(80)      NULL,
    telefono         VARCHAR(25)      NULL,
    whatsapp         VARCHAR(15)      NULL COMMENT 'Solo dígitos, con código de país y de área (ej. 5491123456789)',
    email            VARCHAR(100)     NULL,
    instagram        VARCHAR(30)      NULL COMMENT 'Usuario, sin @',
    logo_url         VARCHAR(255)     NULL COMMENT 'Logo PNG para los PDF (NULL = sin logo)',
    logo_actualizado DATETIME(6)      NULL COMMENT 'Versión del logo',
    CONSTRAINT pk_datos_gimnasio PRIMARY KEY (id_datos)
) ENGINE=InnoDB COMMENT='Datos institucionales del gimnasio (registro único)';

-- Horario de cada día de la semana (@ElementCollection ordenada de DatosGimnasio).
CREATE TABLE datos_gimnasio_horarios (
    id_datos BIGINT      NOT NULL,
    orden    INT         NOT NULL COMMENT '0 = lunes ... 6 = domingo',
    dia      VARCHAR(10) NOT NULL,
    abre     TIME(6)         NULL,
    cierra   TIME(6)         NULL COMMENT 'Abre y cierra en NULL = ese día no abre (no cuenta en las métricas)',
    CONSTRAINT pk_datos_gimnasio_horarios PRIMARY KEY (id_datos, orden),
    CONSTRAINT fk_datos_horarios_datos FOREIGN KEY (id_datos) REFERENCES datos_gimnasio (id_datos) ON DELETE CASCADE,
    CONSTRAINT ck_datos_horarios_dia CHECK (dia IN ('LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO')),
    CONSTRAINT ck_datos_horarios_orden CHECK (orden BETWEEN 0 AND 6),
    CONSTRAINT ck_datos_horarios_horas CHECK ((abre IS NULL AND cierra IS NULL) OR (abre IS NOT NULL AND cierra IS NOT NULL AND cierra > abre))
) ENGINE=InnoDB COMMENT='Horario de apertura del gimnasio por día';

SET FOREIGN_KEY_CHECKS = 1;
