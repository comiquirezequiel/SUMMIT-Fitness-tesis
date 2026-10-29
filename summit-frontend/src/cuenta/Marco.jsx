
/**
 * Pantallas de la cuenta (login, contraseñas): fondo bordó de punta a punta, la marca y una tarjeta blanca.
 */
const Marco = ({ titulo, children }) => (
  <div className="min-h-screen bg-bordo-800 flex items-center justify-center px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <img src="/favicon.svg" alt="" className="w-16 h-16 mx-auto rounded-2xl shadow-lg ring-1 ring-white/15" />
        <p className="mt-4 text-xs font-black tracking-[0.3em] text-bronce-300">SUMMIT</p>
        <h1 className="mt-1 text-2xl font-extrabold text-white">{titulo}</h1>
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">{children}</div>
    </div>
  </div>
);

export default Marco;
