import { useState, useRef } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import api from '../services/api';

// Inicializamos MP una sola vez
initMercadoPago('TEST-68536601-13f7-435b-aa22-aa679fb964c0', { locale: 'es-AR' });

// Configuraciones inmutables fuera del componente
const initialization = {
    amount: 32000, 
};

const customization = {
    paymentMethods: {
        creditCard: "all",
        debitCard: "all",
    },
};

export default function SimuladorPagos() {
    // CAMBIO CLAVE: Usamos useRef en vez de useState para el DNI
    const dniRef = useRef(null); 
    
    const [estadoPago, setEstadoPago] = useState('ESPERANDO');
    const [mensaje, setMensaje] = useState('');

    const onSubmit = async ({ formData }) => {
        const dniActual = dniRef.current.value;

        if (!dniActual) {
            setEstadoPago('ERROR');
            setMensaje('Por favor, ingresá el DNI del socio antes de pagar.');
            return Promise.reject(); 
        }

        setEstadoPago('PROCESANDO');

        try { 
            // 1. HERRAMIENTA DE DEBUG: Imprimimos en la consola de tu navegador (F12) lo que capturó el Brick
            console.log("DATOS EXTRAÍDOS CORRECTAMENTE: ", formData);

            // 2. PROGRAMACIÓN DEFENSIVA: Evitamos valores nulos
            const payload = {
                token: formData.token,
                
                // Si el Brick nos da el dato, lo usamos. Si no, forzamos 'visa' para que no falle.
                paymentMethodId: formData.payment_method_id || formData.paymentMethodId || 'visa', 
                
                payerEmail: formData.payer?.email || 'test_user_summit@test.com',
                payerIdentificationType: formData.payer?.identification?.type || 'DNI',
                payerIdentificationNumber: formData.payer?.identification?.number || dniActual,
                
                // Las cuotas tampoco pueden ser nulas. Si falla, forzamos 1 cuota.
                installments: formData.installments || 1, 
                
                dniSocio: dniActual, 
                planId: 3 
            };

            const respuesta = await api.post('/pagos/procesar', payload);
            
            setEstadoPago('EXITO');
            setMensaje(`¡Pago Aprobado! ID de transacción: ${respuesta.data.id_pago_local}`);
            
            return Promise.resolve(); 

        } catch (error) {
            // ... (el resto del catch sigue igual)
            console.error("Detalle del error:", error);
            setEstadoPago('ERROR');
            // Capturamos el error exacto que nos escupa Spring Boot o MP
            setMensaje(error.response?.data?.error || 'Error interno del servidor.');
            return Promise.reject(); // Le avisa al Brick que falló
        }
    };

    const onError = async (error) => {
        console.error("Error en el Brick de MP:", error);
    };

    const onReady = async () => {};

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 dark:bg-gray-800 dark:border-gray-700 ">
            <h2 className="text-xl font-bold text-gray-800 mb-4 dark:text-gray-100 ">Simulador de Pagos (Checkout API)</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400 ">
                Módulo financiero de prueba. Seleccionando "Pase Libre" ($32.000).
            </p>

            <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">DNI del Socio que abona:</label>
                <input 
                    type="text" 
                    ref={dniRef} // CAMBIO CLAVE: Enganchamos la referencia aquí (sin value ni onChange)
                    placeholder="Ej: 12345678" 
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 dark:border-gray-600 focus:ring-green-500"
                    disabled={estadoPago === 'PROCESANDO' || estadoPago === 'EXITO'}
                />
            </div>

            {estadoPago !== 'EXITO' && (
                <div className="border border-gray-100 rounded-lg p-2 bg-gray-50 min-h-75">
                    <Payment
                        initialization={initialization}
                        customization={customization}
                        onSubmit={onSubmit}
                        onReady={onReady}
                        onError={onError}
                    />
                </div>
            )}

            {estadoPago === 'PROCESANDO' && (
                <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-lg text-center font-bold animate-pulse">
                    Procesando pago con el banco...
                </div>
            )}
            
            {mensaje && estadoPago !== 'PROCESANDO' && (
                <div className={`mt-4 p-3 rounded-lg text-center font-bold ${
                    estadoPago === 'EXITO' ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-red-100 text-red-700 border-2 border-red-500'
                }`}>
                    {mensaje}
                </div>
            )}
        </div>
    );
}