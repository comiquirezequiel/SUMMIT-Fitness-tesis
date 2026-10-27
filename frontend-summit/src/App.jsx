import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import Sidebar from "./components/Sidebar";
import DashboardGerencial from "./components/DashboardGerencial";
import MolineteSimulador from "./components/MolineteSimulador";
import GestorCertificados from "./components/GestorCertificados";
import SimuladorPagos from "./components/SimuladorPagos";
import GestionSocios from "./components/GestionSocios";
import NuevoSocio from "./components/NuevoSocio";
import EditarSocio from "./components/EditarSocio";

function App() {
  // Estado para controlar qué "endpoint" visualizamos
  const [vistaActual, setVistaActual] = useState('dashboard');
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [temaOscuro, setTemaOscuro] = useState(false);

  return (
    <div className={`${temaOscuro ? 'dark' : ''}`}>
        
        {/* ¡CORRECCIÓN AQUÍ! Le quitamos el </div> del final a esta línea */}
        <div className="flex min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      
          {/* Barra Lateral */}
          <Sidebar vistaActual={vistaActual} setVistaActual={setVistaActual} />

          {/* Contenido Dinámico */}
          <main className="flex-1 overflow-y-auto relative">

            {/* Botón flotante para cambiar el tema */}
            <button 
                onClick={() => setTemaOscuro(!temaOscuro)}
                className="absolute top-4 right-8 p-3 rounded-full bg-white dark:bg-gray-800 shadow-md text-gray-500 hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400 transition-all z-50"
                title="Alternar Tema"
            >
                {temaOscuro ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            
            {vistaActual === 'dashboard' && (
              <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
                <DashboardGerencial />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <GestorCertificados />
                    <MolineteSimulador />
                    <SimuladorPagos />
                </div>
              </div>
            )}

            {vistaActual === 'qr' && (
              <div className="p-8 mt-12">
                <h1 className="text-3xl text-gray-500 font-bold">Módulo de Acceso QR (Próximamente)</h1>
              </div>
            )}

            {vistaActual === 'socios' && (
              <div className="p-8 mt-12">
                <GestionSocios setVistaActual={setVistaActual} setSocioSeleccionado={setSocioSeleccionado} />
              </div>
            )}

            {vistaActual === 'nuevo-socio' && (
              <div className="p-8 mt-12">
                <NuevoSocio setVistaActual={setVistaActual} />
              </div>
            )}

            {vistaActual === 'editar-socio' && (
              <div className="p-8 mt-12">
                <EditarSocio setVistaActual={setVistaActual} socioSeleccionado={socioSeleccionado} />
              </div>
            )}

          </main>
        {/* Aquí es donde realmente cierra el contenedor flex */}
        </div> 
    </div>
  );
}

export default App;