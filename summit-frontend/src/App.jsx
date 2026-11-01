import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router';
import Login from './pages/Login';
import { sesionVigente, limpiarSesion } from './services/auth';
import { usuarioActual } from './utils/formato';

// Contraseñas: elegir la propia al entrar con una temporal, "¿Olvidaste tu contraseña?" y el link del mail
const CambiarPassword = lazy(() => import('./cuenta/CambiarPassword'));
const OlvidePassword = lazy(() => import('./cuenta/OlvidePassword'));
const RestablecerPassword = lazy(() => import('./cuenta/RestablecerPassword'));

// Cada pantalla se descarga recién cuando se abre
const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Socios = lazy(() => import('./pages/Socios'));
const NuevoSocio = lazy(() => import('./pages/NuevoSocio'));
const ImportarSocios = lazy(() => import('./pages/ImportarSocios'));
const TareasCRM = lazy(() => import('./pages/TareasCRM'));
const EstadoSocios = lazy(() => import('./pages/EstadoSocios'));
const Caja = lazy(() => import('./pages/Caja'));
const Planes = lazy(() => import('./pages/Planes'));
const EntrenamientoPlanes = lazy(() => import('./pages/EntrenamientoPlanes'));
const Entrenamiento = lazy(() => import('./pages/Entrenamiento'));
const Clases = lazy(() => import('./pages/Clases'));
const DatosGimnasio = lazy(() => import('./pages/DatosGimnasio'));
const ConfiguracionReglas = lazy(() => import('./pages/ConfiguracionReglas'));
const GestionPersonal = lazy(() => import('./pages/GestionPersonal'));

const Diferida = ({ children }) => (
  <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando…</div>}>{children}</Suspense>
);

// Mientras se descarga una pantalla de la cuenta, el fondo bordó del login
const DeLaCuenta = ({ children }) => (
  <Suspense fallback={<div className="min-h-screen bg-bordo-800" />}>{children}</Suspense>
);

// Rutas protegidas: sin token, o con el token vencido, vuelve al login
const ProtectedRoute = ({ children }) => {
  if (!sesionVigente()) {
    const habiaSesion = !!localStorage.getItem('token');
    limpiarSesion();
    return <Navigate to={habiaSesion ? '/login?sesion=expirada' : '/login'} replace />;
  }
  // Con una contraseña temporal no se entra a nada hasta elegir una propia (el backend tampoco responde otra cosa)
  if (usuarioActual()?.debeCambiarPassword) {
    return <Navigate to="/cambiar-password" replace />;
  }
  return children;
};

// Pantallas a las que no conviene entrar ni escribiendo la dirección si el rol no las ve (el backend igual las protege)
const SoloRoles = ({ roles, children }) => (roles.includes(usuarioActual()?.rol) ? children : <Navigate to="/" replace />);
const STAFF = ['ADMIN', 'RECEPCION'];

// Inicio según el rol: el tablero de recepción no le sirve al profesor (empieza en Rutinas)
const Inicio = () => (usuarioActual()?.rol === 'PROFESOR'
  ? <Navigate to="/entrenamiento/rutinas" replace />
  : <Diferida><Dashboard /></Diferida>);

// El constructor de rutinas ya no es una pantalla: se abre desde Rutinas ("+ Nueva rutina" o "Editar"). Los links
// viejos (?socio=, ?rutina=) abren ahí la misma rutina.
const AlConstructor = () => {
  const [params] = useSearchParams();
  const destino = new URLSearchParams(params);
  if (!destino.has('rutina')) destino.set('nueva', '1');
  return <Navigate to={`/entrenamiento/rutinas?${destino}`} replace />;
};

function App() {
  return (
    <Router>
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
          <Route path="socios/nuevo" element={<Diferida><NuevoSocio /></Diferida>} />
          <Route path="socios/importar" element={<Diferida><ImportarSocios /></Diferida>} />
          <Route path="socios/tareas" element={<Diferida><TareasCRM /></Diferida>} />
          <Route path="socios/estado" element={<Diferida><EstadoSocios /></Diferida>} />

          {/* Caja (cobros, gastos, cierres y facturas) */}
          <Route path="caja" element={<Diferida><Caja /></Diferida>} />

          {/* Membresías / Planes */}
          <Route path="planes" element={<Diferida><Planes /></Diferida>} />

          {/* Entrenamiento */}
          <Route path="entrenamiento/rutinas" element={<Diferida><EntrenamientoPlanes /></Diferida>} />
          <Route path="entrenamiento/ejercicios" element={<Diferida><Entrenamiento /></Diferida>} />

          {/* Clases */}
          <Route path="clases/*" element={<Diferida><Clases /></Diferida>} />

          {/* Ajustes */}
          <Route path="ajustes/reglas" element={<SoloRoles roles={STAFF}><Diferida><ConfiguracionReglas /></Diferida></SoloRoles>} />
          <Route path="ajustes/personal" element={<SoloRoles roles={['ADMIN']}><Diferida><GestionPersonal /></Diferida></SoloRoles>} />
          <Route path="ajustes/gimnasio" element={<Diferida><DatosGimnasio /></Diferida>} />

          {/* Direcciones de las pantallas que ahora son pestañas (o se fueron al tablero) */}
          <Route path="socios/metricas" element={<Navigate to="/?metricas=socios" replace />} />
          <Route path="socios/inactividad" element={<Navigate to="/socios/estado?vista=inactividad" replace />} />
          <Route path="membresias/estado" element={<Navigate to="/socios/estado" replace />} />
          <Route path="membresias/metricas" element={<Navigate to="/?metricas=ganancias" replace />} />
          <Route path="membresias/debitos" element={<Navigate to="/?metricas=planes" replace />} />
          <Route path="membresias/reglas" element={<Navigate to="/ajustes/reglas" replace />} />
          <Route path="caja/facturas" element={<Navigate to="/caja?vista=facturas" replace />} />
          <Route path="ajustes/acceso" element={<Navigate to="/ajustes/reglas" replace />} />
          <Route path="ajustes/facturacion" element={<Navigate to="/ajustes/reglas?vista=facturacion" replace />} />
          <Route path="ajustes/equipo" element={<Navigate to="/ajustes/personal" replace />} />
          <Route path="ajustes/asistencia" element={<Navigate to="/ajustes/personal?vista=asistencia" replace />} />
          <Route path="rutinas/constructor" element={<AlConstructor />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
