// Configuración de la API
export const API_CONFIG = {
  // Cambia esta URL cuando uses Ngrok o cuando subas a producción
  BASE_URL: __DEV__ ? 'http://192.168.100.5:5000' : 'http://tu-servidor.com:5000',
  
  // Endpoints
  ENDPOINTS: {
    PREDICCION: '/api/prediccion',
    REGISTRO: '/api/registro',
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
