import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ConfiguracionAcceso from './pages/ConfiguracionAcceso';
import ConstructorRutinas from './pages/ConstructorRutinas';

// Basic Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Socios from './pages/Socios';
import Entrenamiento from './pages/Entrenamiento';
import MetricasGenerales from './pages/MetricasGenerales';
import NuevoSocio from './pages/NuevoSocio';
import Chat from './pages/Chat';
import TareasCRM from './pages/TareasCRM';
import Inactividad from './pages/Inactividad';

import Clases from './pages/Clases';
import Planes from './pages/Planes';
import EstadoMembresias from './pages/EstadoMembresias';
import MetricasPlanes from './pages/MetricasPlanes';
import Caja from './pages/Caja';
import AjustesGeneral from './pages/AjustesGeneral';
import AjustesTablas from './pages/AjustesTablas';
import AjustesEquipo from './pages/AjustesEquipo';
import AjustesAsistencia from './pages/AjustesAsistencia';

import EntrenamientoHoy from './pages/EntrenamientoHoy';
import EntrenamientoHistorial from './pages/EntrenamientoHistorial';
import EntrenamientoPlanes from './pages/EntrenamientoPlanes';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes - require authentication */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          
          {/* Socios */}
          <Route path="socios" element={<Socios />} />
          <Route path="rutinas/constructor" element={<ConstructorRutinas />} />
          <Route path="socios/metricas" element={<MetricasGenerales />} />
          <Route path="socios/nuevo" element={<NuevoSocio />} />
          <Route path="socios/chat" element={<Chat />} />
          <Route path="socios/tareas" element={<TareasCRM />} />
          <Route path="socios/inactividad" element={<Inactividad />} />
          
          {/* Caja */}
          <Route path="caja" element={<Caja />} />
          
          {/* Membresías / Planes */}
          <Route path="planes" element={<Planes />} />
          <Route path="membresias/metricas" element={<MetricasPlanes />} />
          <Route path="membresias/estado" element={<EstadoMembresias />} />
          
          {/* Entrenamiento */}
          <Route path="entrenamiento/hoy" element={<EntrenamientoHoy />} />
          <Route path="entrenamiento/historial" element={<EntrenamientoHistorial />} />
          <Route path="entrenamiento/rutinas" element={<EntrenamientoPlanes />} />
          <Route path="entrenamiento/ejercicios" element={<Entrenamiento />} />
          
          {/* Clases */}
          <Route path="clases/*" element={<Clases />} />
          
          {/* Ajustes */}
          <Route path="ajustes/general" element={<AjustesGeneral />} />
          <Route path="ajustes/acceso" element={<ConfiguracionAcceso />} />
          <Route path="ajustes/tablas" element={<AjustesTablas />} />
          <Route path="ajustes/equipo" element={<AjustesEquipo />} />
          <Route path="ajustes/asistencia" element={<AjustesAsistencia />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
