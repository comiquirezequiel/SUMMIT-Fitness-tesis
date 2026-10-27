import axios from 'axios';

// Creamos una instancia de Axios preconfigurada
const api = axios.create({
    baseURL: 'http://localhost:8080/api', // La ruta base del backend
    timeout: 5000, // Si el backend tarda más de 5 segundos, corta la petición
});

export default api;