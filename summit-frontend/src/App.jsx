import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AvisoActualizacion from './components/AvisoActualizacion';
import { sesionVigente, limpiarSesion } from './services/auth';
import { useFunciones } from './services/funciones';
import { usuarioActual } from './utils/formato';

// Portal del socio (pensado para el celular): se descarga aparte, el personal no lo necesita. Mientras la app del
// socio está suspendida, el socio ve AppSuspendida
const PortalSocio = lazy(() => import('./portal/PortalSocio'));
const AppSuspendida = lazy(() => import('./cuenta/AppSuspendida'));

// Contraseñas: elegir la propia al entrar con una temporal, "¿Olvidaste tu contraseña?" y el link del mail.
// Las usan el socio y el personal (por eso están en cuenta/ y no en pages/)
const CambiarPassword = lazy(() => import('./cuenta/CambiarPassword'));
const OlvidePassword = lazy(() => import('./cuenta/OlvidePassword'));
const RestablecerPassword = lazy(() => import('./cuenta/RestablecerPassword'));

// Panel del personal: cada pantalla se descarga recién cuando se abre, así el socio no baja ninguna
// (en el build llevan el prefijo panel-: ver vite.config.js)
const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Socios = lazy(() => import('./pages/Socios'));
const NuevoSocio = lazy(() => import('./pages/NuevoSocio'));
const ImportarSocios = lazy(() => import('./pages/ImportarSocios'));
const MetricasGenerales = lazy(() => import('./pages/MetricasGenerales'));
const Chat = lazy(() => import('./pages/Chat'));
const TareasCRM = lazy(() => import('./pages/TareasCRM'));
const Inactividad = lazy(() => import('./pages/Inactividad'));
const Caja = lazy(() => import('./pages/Caja'));
const Planes = lazy(() => import('./pages/Planes'));
const EstadoMembresias = lazy(() => import('./pages/EstadoMembresias'));
const DescuentosReglas = lazy(() => import('./pages/DescuentosReglas'));
const MetricasPlanes = lazy(() => import('./pages/MetricasPlanes'));
const DebitosAutomaticos = lazy(() => import('./pages/DebitosAutomaticos'));
const ConstructorRutinas = lazy(() => import('./pages/ConstructorRutinas'));
const EntrenamientoHoy = lazy(() => import('./pages/EntrenamientoHoy'));
const EntrenamientoHistorial = lazy(() => import('./pages/EntrenamientoHistorial'));
const EntrenamientoPlanes = lazy(() => import('./pages/EntrenamientoPlanes'));
const Entrenamiento = lazy(() => import('./pages/Entrenamiento'));
const Clases = lazy(() => import('./pages/Clases'));
const DatosGimnasio = lazy(() => import('./pages/DatosGimnasio'));
const Novedades = lazy(() => import('./pages/Novedades'));
const ConfiguracionAcceso = lazy(() => import('./pages/ConfiguracionAcceso'));
const AjustesEquipo = lazy(() => import('./pages/AjustesEquipo'));
const AjustesAsistencia = lazy(() => import('./pages/AjustesAsistencia'));

const Diferida = ({ children }) => (
  <Suspense fallback={<div className="p-8 text-sm text-slate-400">Cargando…</div>}>{children}</Suspense>
);

// Mientras se descarga una pantalla de la cuenta, el fondo bordó del login
const DeLaCuenta = ({ children }) => (
  <Suspense fallback={<div className="min-h-screen bg-bordo-800" />}>{children}</Suspense>
);

// Rutas protegidas: sin token, o con el token vencido, vuelve al login
const ProtectedRoute = ({ children }) => {
  const { appSocios } = useFunciones();
  if (!sesionVigente()) {
    const habiaSesion = !!localStorage.getItem('token');
    limpiarSesion();
    return <Navigate to={habiaSesion ? '/login?sesion=expirada' : '/login'} replace />;
  }
  // Con una contraseña temporal no se entra a nada hasta elegir una propia (el backend tampoco responde otra cosa)
  if (usuarioActual()?.debeCambiarPassword) {
    return <Navigate to="/cambiar-password" replace />;
  }
  // El socio usa su portal (pensado para el celular); el panel es para el personal. Con la app del socio suspendida,
  // una sesión de socio que quedó abierta ve el aviso
  if (usuarioActual()?.rol === 'SOCIO') {
    if (!appSocios) {
      return <DeLaCuenta><AppSuspendida /></DeLaCuenta>;
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <PortalSocio />
      </Suspense>
    );
  }
  return children;
};

// Pantallas que existen solo para la app del socio (chat, novedades): suspendida, vuelven al inicio
const SoloConAppSocios = ({ children }) => (useFunciones().appSocios ? children : <Navigate to="/" replace />);

// Inicio según el rol: el tablero de recepción no le sirve al profesor
const Inicio = () => (usuarioActual()?.rol === 'PROFESOR'
  ? <Navigate to="/rutinas/constructor" replace />
  : <Diferida><Dashboard /></Diferida>);

function App() {
  return (
    <Router>
      <AvisoActualizacion />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cambiar-password" element={<DeLaCuenta><CambiarPassword /></DeLaCuenta>} />
        <Route path="/olvide-password" element={<DeLaCuenta><OlvidePassword /></DeLaCuenta>} />
        <Route path="/restablecer" element={<DeLaCuenta><RestablecerPassword /></DeLaCuenta>} />

        {/* Protected Routes - require authentication */}
        <Route path="/" element={
          <ProtectedRoute>
            <Diferida><Layout /></Diferida>
          </ProtectedRoute>
        }>
          <Route index element={<Inicio />} />

          {/* Socios */}
          <Route path="socios" element={<Diferida><Socios /></Diferida>} />
          <Route path="rutinas/constructor" element={<Diferida><ConstructorRutinas /></Diferida>} />
          <Route path="socios/metricas" element={<Diferida><MetricasGenerales /></Diferida>} />
          <Route path="socios/nuevo" element={<Diferida><NuevoSocio /></Diferida>} />
          <Route path="socios/importar" element={<Diferida><ImportarSocios /></Diferida>} />
          <Route path="socios/novedades" element={<SoloConAppSocios><Diferida><Novedades /></Diferida></SoloConAppSocios>} />
          <Route path="socios/chat" element={<SoloConAppSocios><Diferida><Chat /></Diferida></SoloConAppSocios>} />
          <Route path="socios/tareas" element={<Diferida><TareasCRM /></Diferida>} />
          <Route path="socios/inactividad" element={<Diferida><Inactividad /></Diferida>} />

          {/* Caja */}
          <Route path="caja" element={<Diferida><Caja /></Diferida>} />

          {/* Membresías / Planes */}
          <Route path="planes" element={<Diferida><Planes /></Diferida>} />
          <Route path="membresias/metricas" element={<Diferida><MetricasPlanes /></Diferida>} />
          <Route path="membresias/estado" element={<Diferida><EstadoMembresias /></Diferida>} />
          <Route path="membresias/debitos" element={<Diferida><DebitosAutomaticos /></Diferida>} />
          <Route path="membresias/reglas" element={<Diferida><DescuentosReglas /></Diferida>} />

          {/* Entrenamiento */}
          <Route path="entrenamiento/hoy" element={<Diferida><EntrenamientoHoy /></Diferida>} />
          <Route path="entrenamiento/historial" element={<Diferida><EntrenamientoHistorial /></Diferida>} />
          <Route path="entrenamiento/rutinas" element={<Diferida><EntrenamientoPlanes /></Diferida>} />
          <Route path="entrenamiento/ejercicios" element={<Diferida><Entrenamiento /></Diferida>} />

          {/* Clases */}
          <Route path="clases/*" element={<Diferida><Clases /></Diferida>} />

          {/* Ajustes */}
          <Route path="ajustes/gimnasio" element={<Diferida><DatosGimnasio /></Diferida>} />
          <Route path="ajustes/acceso" element={<Diferida><ConfiguracionAcceso /></Diferida>} />
          <Route path="ajustes/equipo" element={<Diferida><AjustesEquipo /></Diferida>} />
          <Route path="ajustes/asistencia" element={<Diferida><AjustesAsistencia /></Diferida>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
