import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getDashboardMetricas,
  getSociosList,
  createSocio,
  updateSocio,
  deleteSocio,
  intentarAcceso,
  forzarAcceso,
  simularCertificado,
  revisarCertificado,
  procesarPago,
} from './src/db/queries.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// API Routes (Connected to Cloud SQL PostgreSQL)
// -------------------------------------------------------------

// Dashboard Metrics
app.get('/api/dashboard/metricas', async (req, res) => {
  try {
    const metricas = await getDashboardMetricas();
    res.json(metricas);
  } catch (error: any) {
    console.error('Error calculando métricas:', error);
    res.status(500).json({ error: 'Error al obtener métricas del dashboard' });
  }
});

// List Socios
app.get('/api/usuarios', async (req, res) => {
  try {
    const lista = await getSociosList();
    res.json(lista);
  } catch (error: any) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ error: error.message || 'Error al obtener socios' });
  }
});

// Crear nuevo socio
app.post('/api/usuarios/nuevo', async (req, res) => {
  try {
    const { nombre, apellido, dni, email, telefono } = req.body;
    if (!dni || !nombre || !apellido || !email) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben estar presentes.' });
    }

    await createSocio({ nombre, apellido, dni, email, telefono });
    res.json({ mensaje: 'Socio creado exitosamente en estado PENDIENTE.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al crear socio' });
  }
});

// Editar socio
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombreCompleto, email, telefono, estado } = req.body;
    await updateSocio(id, { nombreCompleto, email, telefono, estado });
    res.json({ mensaje: 'Perfil del socio actualizado correctamente.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al actualizar socio' });
  }
});

// Eliminar socio (baja lógica)
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await deleteSocio(id);
    res.json({ mensaje: 'Socio eliminado correctamente del sistema.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al eliminar socio' });
  }
});

// Acceso - Intentar
app.post('/api/acceso/intentar/:dni', async (req, res) => {
  try {
    const dni = req.params.dni;
    const result = await intentarAcceso(dni);
    return res.status(result.status).send(result.message);
  } catch (error: any) {
    console.error('Error en intento de acceso:', error);
    res.status(500).send('Error interno');
  }
});

// Acceso - Forzar ingreso
app.post('/api/acceso/forzar-ingreso/:dni', async (req, res) => {
  try {
    const dni = req.params.dni;
    const auditor = (req.query.idEmpleadoAuditor as string) || 'Admin_1';
    const resultado = await forzarAcceso(dni, auditor);
    res.json(resultado);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al forzar ingreso' });
  }
});

// Certificados - Simular carga
app.post('/api/certificados/simular/:dni', async (req, res) => {
  try {
    const dni = req.params.dni;
    const msg = await simularCertificado(dni);
    res.send(msg);
  } catch (error: any) {
    res.status(400).send(error.message || 'Error al simular certificado');
  }
});

// Certificados - Revisión
app.put('/api/certificados/revision/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const aprobado = req.query.aprobado === 'true';
    const msg = await revisarCertificado(id, aprobado);
    res.json({ mensaje: msg });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al revisar certificado' });
  }
});

// Pagos - Procesar
app.post('/api/pagos/procesar', async (req, res) => {
  try {
    const { dniSocio, planId } = req.body;
    const result = await procesarPago(dniSocio, planId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al procesar pago' });
  }
});

// Autenticación de usuario con Firebase (sincronizar con DB)
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.user.uid || !req.user.email) {
      return res.status(400).json({ error: 'Usuario no autenticado' });
    }
    const user = await getOrCreateUser(req.user.uid, req.user.email);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Vite middleware in dev, static dist in production
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      next();
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
