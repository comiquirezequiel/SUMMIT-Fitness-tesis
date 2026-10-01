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

// Páginas conectadas a la API
import Caja from "./pages/Caja";
import Planes from "./pages/Planes";
import Membresias from "./pages/Membresias";
import EstadoMembresias from "./pages/EstadoMembresias";
import MetricasPlanes from "./pages/MetricasPlanes";
import Entrenamiento from "./pages/Entrenamiento";
import EntrenamientoHoy from "./pages/EntrenamientoHoy";
import EntrenamientoHistorial from "./pages/EntrenamientoHistorial";
import EntrenamientoPlanes from "./pages/EntrenamientoPlanes";
import Clases from "./pages/Clases";
import Chat from "./pages/Chat";
import TareasCRM from "./pages/TareasCRM";
import MetricasGenerales from "./pages/MetricasGenerales";
import ConstructorRutinas from "./pages/ConstructorRutinas";
import ConfiguracionAcceso from "./pages/ConfiguracionAcceso";
import AjustesGeneral from "./pages/AjustesGeneral";
import AjustesTablas from "./pages/AjustesTablas";
import AjustesEquipo from "./pages/AjustesEquipo";
import AjustesAsistencia from "./pages/AjustesAsistencia";

function App() {
  // Estado para controlar qué "endpoint" visualizamos
  const [vistaActual, setVistaActual] = useState('dashboard');
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [temaOscuro, setTemaOscuro] = useState(false);

  // Componente para vistas que no están implementadas aún
  const Proximamente = ({ nombre }) => (
    <div className="p-8 mt-12">
      <h1 className="text-3xl text-gray-500 font-bold">{nombre} (Próximamente)</h1>
    </div>
  );

  return (
    <div className={`${temaOscuro ? 'dark' : ''}`}>
        
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

            {vistaActual === 'caja' && (
              <div className="p-8 mt-12">
                <Caja />
              </div>
            )}

            {vistaActual === 'planes' && (
              <div className="p-8 mt-12">
                <Planes />
              </div>
            )}

            {vistaActual === 'membresias' && (
              <div className="p-8 mt-12">
                <Membresias />
              </div>
            )}

            {vistaActual === 'estado-membresias' && (
              <div className="p-8 mt-12">
                <EstadoMembresias />
              </div>
            )}

            {vistaActual === 'metricas-planes' && (
              <div className="p-8 mt-12">
                <MetricasPlanes />
              </div>
            )}

            {vistaActual === 'entrenamiento' && (
              <div className="p-8 mt-12">
                <Entrenamiento />
              </div>
            )}

            {vistaActual === 'entrenamiento-hoy' && (
              <div className="p-8 mt-12">
                <EntrenamientoHoy />
              </div>
            )}

            {vistaActual === 'entrenamiento-historial' && (
              <div className="p-8 mt-12">
                <EntrenamientoHistorial />
              </div>
            )}

            {vistaActual === 'entrenamiento-rutinas' && (
              <div className="p-8 mt-12">
                <EntrenamientoPlanes />
              </div>
            )}

            {vistaActual === 'clases' && (
              <div className="p-8 mt-12">
                <Clases />
              </div>
            )}

            {vistaActual === 'chat' && (
              <div className="p-8 mt-12">
                <Chat />
              </div>
            )}

            {vistaActual === 'tareas-crm' && (
              <div className="p-8 mt-12">
                <TareasCRM />
              </div>
            )}

            {vistaActual === 'metricas-generales' && (
              <div className="p-8 mt-12">
                <MetricasGenerales />
              </div>
            )}

            {vistaActual === 'constructor-rutinas' && (
              <div className="p-8 mt-12">
                <ConstructorRutinas />
              </div>
            )}

            {vistaActual === 'config' && (
              <div className="p-8 mt-12">
                <h1 className="text-3xl text-gray-500 font-bold mb-8">Configuraciones</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button onClick={() => setVistaActual('ajustes-general')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors text-left">
                    <h3 className="font-bold text-slate-800 mb-2">Ajustes General</h3>
                    <p className="text-sm text-slate-500">Configuración general del sistema</p>
                  </button>
                  <button onClick={() => setVistaActual('configuracion-acceso')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors text-left">
                    <h3 className="font-bold text-slate-800 mb-2">Configuración de Acceso</h3>
                    <p className="text-sm text-slate-500">Control de accesos y permisos</p>
                  </button>
                  <button onClick={() => setVistaActual('ajustes-tablas')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors text-left">
                    <h3 className="font-bold text-slate-800 mb-2">Ajustes de Tablas</h3>
                    <p className="text-sm text-slate-500">Configuración de tablas del sistema</p>
                  </button>
                  <button onClick={() => setVistaActual('ajustes-equipo')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors text-left">
                    <h3 className="font-bold text-slate-800 mb-2">Ajustes de Equipo</h3>
                    <p className="text-sm text-slate-500">Gestión de equipo de trabajo</p>
                  </button>
                  <button onClick={() => setVistaActual('ajustes-asistencia')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors text-left">
                    <h3 className="font-bold text-slate-800 mb-2">Ajustes de Asistencia</h3>
                    <p className="text-sm text-slate-500">Control de asistencias y horarios</p>
                  </button>
                </div>
              </div>
            )}

            {vistaActual === 'ajustes-general' && (
              <div className="p-8 mt-12">
                <AjustesGeneral />
              </div>
            )}

            {vistaActual === 'configuracion-acceso' && (
              <div className="p-8 mt-12">
                <ConfiguracionAcceso />
              </div>
            )}

            {vistaActual === 'ajustes-tablas' && (
              <div className="p-8 mt-12">
                <AjustesTablas />
              </div>
            )}

            {vistaActual === 'ajustes-equipo' && (
              <div className="p-8 mt-12">
                <AjustesEquipo />
              </div>
            )}

            {vistaActual === 'ajustes-asistencia' && (
              <div className="p-8 mt-12">
                <AjustesAsistencia />
              </div>
            )}

          </main>
        </div>
    </div>
  );
}

export default App;
