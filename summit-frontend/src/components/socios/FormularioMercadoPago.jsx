import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';

// La clave con la que se inició el SDK de Mercado Pago: se inicia una sola vez
let iniciadoCon = null;

/**
 * Formulario de tarjeta de Mercado Pago (Card Payment Brick): la tarjeta se carga en un formulario de Mercado Pago y
 * vuelve convertida en un token, así sus datos nunca pasan por SUMMIT. Se descarga aparte, recién cuando se cobra con
 * tarjeta. onCobrar(tarjeta) tiene que devolver una promesa: si falla, el formulario vuelve a quedar listo.
 */
const FormularioMercadoPago = ({ publicKey, total, onCobrar }) => {
  if (iniciadoCon !== publicKey) {
    initMercadoPago(publicKey, { locale: 'es-AR' });
    iniciadoCon = publicKey;
  }
  return (
    <CardPayment
      initialization={{ amount: Number(total) }}
      customization={{ paymentMethods: { maxInstallments: 1 } }}
      locale="es-AR"
      onSubmit={(datos) => onCobrar({
        token: datos.token,
        medio: datos.payment_method_id,
        emisor: datos.issuer_id ? String(datos.issuer_id) : null,
        cuotas: datos.installments,
        email: datos.payer?.email,
        tipoDocumento: datos.payer?.identification?.type,
        documento: datos.payer?.identification?.number,
      })}
    />
  );
};

export default FormularioMercadoPago;
