# Factura electrónica de ARCA

SUMMIT factura cada cobro aprobado con los web services de ARCA (ex AFIP), directo desde la PC del gimnasio y sin
servicios de terceros: ni la clave del certificado ni los datos de los socios salen de ahí. La factura sale sola, con su
CAE y el código QR, y se imprime o se manda por WhatsApp como el comprobante de siempre.

Viene **apagada**. Se prende en `application-local.properties` (ver [Prenderla](#prenderla)), primero con el simulador
para probar y después contra ARCA.

## Cómo funciona

- **Al cobrar**, la factura se pide a ARCA en segundo plano y casi siempre llega en un segundo: el paso final del cobro
  ya muestra la factura autorizada y su PDF. En la caja, cada cobro dice qué factura tiene.
- **Por ser gimnasio** (anexo de la RG 4290), al consumidor final hay que darle la factura **impresa**, salvo que acepte
  recibirla en el momento por otro medio (WhatsApp, mail).
- **Si ARCA no responde**, la factura queda pendiente y se reintenta sola (al minuto, a los 5, a los 15 y después cada
  hora). En *Caja & Pagos*, pestaña *Facturas*, está el botón *Mandar ahora*. Sale con la fecha del día en que ARCA la autoriza.
- **Si se corta la conexión justo al pedirla**, queda *Confirmando con ARCA*: antes de usar otro número, SUMMIT le
  pregunta a ARCA si la autorizó. Así nunca se duplica ni se saltea un número.
- **Si ARCA la rechaza**, el motivo se ve en *Facturas*. Se corrige (por ejemplo, los datos fiscales) y el admin la
  reintenta. Un rechazo no gasta el número.
- **Para anularla**, el admin emite una nota de crédito de la misma letra, con un motivo. Una factura autorizada no se
  borra nunca. La nota de crédito no toca la caja ni la membresía: si se devolvió la plata, se carga como gasto.
- **Volver a facturar**: con la factura anulada, el admin puede hacer una nueva para el mismo cobro, por ejemplo a nombre
  del socio con su DNI.
- Un cobro *a verificar* se factura recién cuando se aprueba. Uno rechazado o de $ 0 no se factura. El débito automático
  se factura cuando Mercado Pago confirma el cobro.
- Los cobros de antes de prender la facturación no se facturan solos: en la caja, el admin tiene el botón *Facturar*.

### Qué factura corresponde

| El dueño es | Factura | Para anularla |
|---|---|---|
| Monotributista | C (código 11): el precio no discrimina IVA | Nota de crédito C (13) |
| Responsable inscripto | B (código 6) al consumidor final, con el IVA contenido (21 %) que pide la Ley 27.743 | Nota de crédito B (8) |

Se elige en *Ajustes > Configuración y reglas > Facturación*. Por defecto la factura sale "a consumidor final", sin identificar al socio: las
cuotas están muy por debajo del monto desde el que ARCA lo exige. Si se prefiere, se factura a nombre del socio con su
DNI.

**No está** la Factura A (la que pide una empresa o un monotributista con su CUIT): si hiciera falta, la decide el
contador del dueño.

## Prenderla

Se configura con cuatro valores: `ARCA_HABILITADA`, `ARCA_AMBIENTE`, `ARCA_CERTIFICADO` y `ARCA_CERTIFICADO_PASSWORD`.
En la PC de desarrollo van en `summit-backend/src/main/resources/application-local.properties`; en la PC del gimnasio
instalada con [INSTALACION.md](INSTALACION.md), en `C:\SUMMIT\app\config\application.properties`. Después de cambiarlos
hay que reiniciar el backend (en el gimnasio, el servicio `SUMMIT-Backend`). Las rutas se escriben con barras `/` (en
esos archivos la barra invertida no se puede usar sola).

### 1. Con el simulador (para probar y mostrar)

El simulador es un ARCA de mentira que corre adentro del backend: recibe los mismos mensajes que el real y valida lo
mismo (numeración, fechas, IVA, notas de crédito), pero sus CAE no valen nada. No hace falta certificado.

```properties
ARCA_HABILITADA=true
ARCA_AMBIENTE=SIMULADOR
```

En *Ajustes > Configuración y reglas > Facturación* se cargan unos datos fiscales cualquiera, con una CUIT válida (por ejemplo `20-11111111-2`),
y se toca *Probar conexión*. Las facturas salen con la marca de agua "SIN VALIDEZ FISCAL".

### 2. Pruebas en ARCA (homologación)

ARCA tiene un ambiente de pruebas gratuito. El certificado de homologación se saca con la CUIT y la clave fiscal
(nivel 2 o más) de quien desarrolla, no hace falta la del dueño.

1. En la web de ARCA, *Administrador de Relaciones de Clave Fiscal* > *Adherir servicio* > ARCA > *Servicios
   interactivos* > **WSASS** (Autogestión de certificados para homologación). Salir y volver a entrar.
2. Generar la clave privada y el pedido de certificado en una carpeta fuera del repositorio, dentro de tu usuario (que
   solo vos podés leer). Git for Windows ya trae OpenSSL; en Git Bash:

   ```bash
   mkdir -p ~/arca-homologacion && cd ~/arca-homologacion
   openssl genrsa -out summit.key 2048
   MSYS_NO_PATHCONV=1 openssl req -new -key summit.key -subj "/C=AR/O=Tu Nombre/CN=summit/serialNumber=CUIT 20111111112" -out summit.csr
   ```

   En `serialNumber` va la palabra CUIT, un espacio y los 11 números de tu CUIT.
3. En WSASS: *Nuevo certificado* (un nombre cualquiera y el contenido de `summit.csr`). Guardar lo que devuelve como
   `summit.crt`. Después, *Crear autorización a servicio*: ese nombre, tu CUIT y el servicio `wsfe`.
4. Juntar certificado y clave en un archivo con contraseña:

   ```bash
   openssl pkcs12 -export -inkey summit.key -in summit.crt -out summit.p12
   ```

5. En `application-local.properties`:

   ```properties
   ARCA_HABILITADA=true
   ARCA_AMBIENTE=HOMOLOGACION
   ARCA_CERTIFICADO=C:/Users/tu-usuario/arca-homologacion/summit.p12
   ARCA_CERTIFICADO_PASSWORD=la-que-elegiste
   ```

6. *Ajustes > Configuración y reglas > Facturación*: los datos fiscales con tu CUIT y el punto de venta 1 (en homologación no hace falta darlo de
   alta). *Probar conexión* tiene que dar los 5 pasos bien.

### 3. Producción (el dueño, con su contador)

Lleva un par de horas y se hace en la PC del gimnasio.

1. **Con el contador**, confirmar: la condición frente al IVA, la alícuota (21 %), qué se usa si ARCA no anda por mucho
   tiempo (ver [Contingencia](#contingencia)), si corresponden los duplicados electrónicos de la RG 3685 y cuánto tiempo
   guardar los comprobantes (al menos 10 años).
2. **Clave fiscal nivel 3** del dueño (o de quien represente a la sociedad).
3. **Clave privada y pedido de certificado**: los mismos comandos del paso 2.2, en `C:/SUMMIT/app/config/arca` (una
   carpeta privada de la instalación que el backend puede leer), con la CUIT del dueño y su nombre o razón social en
   `O=`.
4. **Certificado**: en ARCA, *Administración de Certificados Digitales* > *Agregar alias* > subir el `.csr` > descargar el
   `.crt`. Armar el `.p12` como en el paso 2.4.
5. **Autorizarlo a facturar**: *Administrador de Relaciones* > *Nueva relación* > ARCA > *WebServices* > *Facturación
   Electrónica*; como representante, el alias del certificado.
6. **Punto de venta**: *Administración de Puntos de Venta y Domicilios* > alta de uno nuevo para web services ("RECE
   para aplicativo y web services" si es responsable inscripto, "Factura Electrónica - Monotributo - Web Services" si es
   monotributista), con el domicilio del gimnasio.
7. **SUMMIT**: en `C:\SUMMIT\app\config\application.properties`, `ARCA_HABILITADA=true`, `ARCA_AMBIENTE=PRODUCCION`,
   `ARCA_CERTIFICADO=C:/SUMMIT/app/config/arca/summit.p12` y su contraseña. Reiniciar el servicio `SUMMIT-Backend`.
8. **Ajustes > Configuración y reglas > Facturación**: los datos fiscales del dueño y *Probar conexión*: el punto de venta tiene que aparecer
   habilitado y la numeración en 0. Hacer un primer cobro y verificar la factura escaneando el QR con el celular.

Cada comprobante guarda el ambiente en que se emitió: los de prueba nunca se mezclan con los reales, y al cambiar de
ambiente las facturas de prueba que quedaron pendientes no se mandan a producción.

## El certificado

- **Nunca en el repositorio**: el `.gitignore` ignora los `.p12`, `.key`, `.crt`, `.csr` y `.pem`. En el gimnasio va
  en `C:\SUMMIT\app\config\arca\`, que hereda los permisos privados de la instalación (administradores, SYSTEM y la
  cuenta del servicio del backend, que solo lo lee). Una vez armado el `.p12`, el `.key` suelto se puede borrar (la
  clave queda adentro del `.p12`).
- **Copia de seguridad**: el dueño guarda una copia cifrada del `.p12` (en un USB o un gestor de contraseñas). Si se
  pierde no es grave: se genera otro pedido y se agrega un certificado nuevo al mismo alias. Si se filtra, se reemplaza y
  se revisan las relaciones en ARCA.
- **Vence** (habitualmente a los 2 años): *Ajustes > Configuración y reglas > Facturación* avisa desde 30 días antes. Se renueva con *Agregar
  certificado* sobre el mismo alias.
- **La hora de la PC** tiene que estar bien (Configuración de Windows > Hora > *Sincronizar ahora*): con el reloj corrido,
  ARCA rechaza el pedido de acceso.

## Contingencia

Un corte corto lo resuelve la cola de reintentos. Para un corte largo, la ley pide que un gimnasio tenga habilitada otra
forma de emitir (RG 4290): el CAEA (que SUMMIT todavía no tiene) o *Comprobantes en línea* desde la web de ARCA, con un
punto de venta propio. Cuál se usa lo decide el contador.

## Lo que todavía no hace

Factura A, CAEA, duplicados electrónicos (RG 3685), notas de crédito parciales y la devolución del cobro en la caja junto
con la nota de crédito.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| Falta el certificado de ARCA | Completar `ARCA_CERTIFICADO` y reiniciar el backend |
| No se encuentra el certificado en ... | La ruta está mal escrita (con barras `/`) o el archivo no está |
| La contraseña del certificado no es la correcta | Revisar `ARCA_CERTIFICADO_PASSWORD` |
| ARCA no reconoce el certificado | Es de otro ambiente: el de homologación no sirve en producción, ni al revés |
| El certificado no está autorizado a facturar | Falta la relación con *Facturación Electrónica* (producción) o la autorización a `wsfe` en WSASS (homologación) |
| La hora de esta PC no coincide con la de ARCA | Sincronizar la hora de Windows |
| ARCA ya entregó un permiso de acceso para este certificado | Esperar hasta 12 horas (pasa si se restauró la base o se cambió de PC con el mismo certificado) |
| El punto de venta N no está dado de alta para web services | Darlo de alta en ARCA o corregir el número en *Ajustes > Configuración y reglas > Facturación* |
| Faltan datos fiscales | Completarlos en *Ajustes > Configuración y reglas > Facturación*: lo que esperaba sale enseguida |
| Una factura sigue *Confirmando con ARCA* | ARCA no responde: se resuelve sola cuando vuelve. *Mandar ahora* lo intenta de nuevo |
| El backend no arranca: "summit.arca.ambiente (ARCA_AMBIENTE) tiene que ser..." | Corregir `ARCA_AMBIENTE` (SIMULADOR, HOMOLOGACION o PRODUCCION) |

## Para quien mantenga el sistema

- **Backend**: `summit-backend/src/main/java/com/summit/backend/arca/` tiene el protocolo (permiso de acceso del WSAA
  firmado con BouncyCastle, cliente del WSFEv1, transporte y simulador); `service/FacturacionService.java`, la cola de
  emisión; `service/DatosFiscalesService.java`, los datos fiscales. Los mensajes SOAP se arman a mano siguiendo el orden
  del WSDL (son pocos métodos y así se ve exactamente qué se manda).
- **Panel**: `services/facturacion.js`, `pages/Facturas.jsx`, `pages/AjustesFacturacion.jsx` y
  `components/pdf/FacturaPdf.jsx` (el PDF, con el QR como vector).
- **Tests**: `FacturacionTest` (16, contra el simulador) dentro de `.\mvnw.cmd test`.
- **Normas**: RG 1415 y RG 4291 (datos del comprobante), RG 4290 (gimnasios: entrega impresa y contingencia), RG 4892
  (código QR), RG 5616 (la condición frente al IVA del receptor es obligatoria desde el 1/12/2026; SUMMIT ya la manda) y
  Ley 27.743 (IVA contenido en la Factura B).
