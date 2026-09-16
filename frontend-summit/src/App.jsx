import { useState } from 'react';
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
  const [socioSeleccionado, setSocioSeleccionado] = useState(null); // NUEVO

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      
      {/* 1. La Barra Lateral */}
      <Sidebar vistaActual={vistaActual} setVistaActual={setVistaActual} />

      {/* 2. El Contenido Dinámico */}
      <main className="flex-1 overflow-y-auto">
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
          <div className="p-8 flex items-center justify-center h-full">
            <h1 className="text-3xl text-gray-500 font-bold">Módulo de Acceso QR (Próximamente)</h1>
          </div>
        )}

        {vistaActual === 'socios' && (
          <div className="p-8">
            {/* Le pasamos la función setSocioSeleccionado para que la tabla pueda usarla */}
            <GestionSocios setVistaActual={setVistaActual} setSocioSeleccionado={setSocioSeleccionado} />
          </div>
        )}

        {vistaActual === 'nuevo-socio' && (
          <div className="p-8">
            <NuevoSocio setVistaActual={setVistaActual} />
          </div>
        )}

        {/* NUEVA VISTA */}
        {vistaActual === 'editar-socio' && (
          <div className="p-8">
            <EditarSocio setVistaActual={setVistaActual} socioSeleccionado={socioSeleccionado} />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;