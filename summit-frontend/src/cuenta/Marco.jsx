
/**
 * Pantallas de la cuenta (login, contraseñas): fondo bordó con luz de cobre, el logo y una tarjeta blanca.
 */
const Marco = ({ titulo, children }) => (
  <div className="min-h-screen fondo-marca flex items-center justify-center px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <img src="/assets/logo-summit.png" alt="" className="h-32 w-auto mx-auto drop-shadow-[0_0_18px_rgba(217,160,102,0.4)]" />
        <p className="mt-4 text-sm font-black tracking-[0.4em] text-bronce-300">SUMMIT</p>
        <h1 className="mt-1 text-2xl font-extrabold text-white">{titulo}</h1>
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">{children}</div>
    </div>
  </div>
);

export default Marco;
