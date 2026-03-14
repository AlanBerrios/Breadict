// Archivo de configuración para las URLs de la API
// Cambia la IP por la IP local de tu computadora en la red WiFi cuando trabajes localmente
// Para producción, cambia BASE_URL por la URL de tu backend en la nube (ej: Render, Railway, etc.)

export const API_CONFIG = {
  // BASE_URL de producción real en Render
  BASE_URL: 'https://breadict.onrender.com',
  ENDPOINTS: {
    REGISTRO: '/api/registro',
    PREDICCION: '/api/prediccion',
    ESTADISTICAS: '/api/estadisticas',
    HEALTH: '/api/health'
  }
};

// Opciones de clima para el formulario
export const CLIMA_OPTIONS = [
  { value: 'soleado', label: 'Soleado' },
  { value: 'parcialmente nublado', label: 'Parcialmente Nublado' },
  { value: 'nublado', label: 'Nublado' },
  { value: 'despejado', label: 'Despejado' },
  { value: 'lluvia ligera', label: 'Lluvia Ligera' },
  { value: 'lluvia', label: 'Lluvia' }
];
