import axios from 'axios';
import { API_CONFIG } from '../config/api';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Verificar conexión con el servidor
  async healthCheck() {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.HEALTH);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Obtener predicción para una fecha específica
  async obtenerPrediccion(fecha, ubicacion = null, datosManuales = null) {
    try {
      const params = { fecha };
      
      if (ubicacion && ubicacion.latitude) {
        params.lat = ubicacion.latitude;
        params.lon = ubicacion.longitude;
      }
      
      // Si hay datos manuales, agregarlos a los parámetros
      if (datosManuales) {
        params.clima_num = datosManuales.clima_num;
        params.temp_min = datosManuales.temp_min;
        params.temp_max = datosManuales.temp_max;
      }

      const response = await this.api.get(API_CONFIG.ENDPOINTS.PREDICCION, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Registrar datos de ventas del día
  async registrarDatos(datos) {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.REGISTRO, datos);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Obtener estadísticas del sistema
  async obtenerEstadisticas() {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ESTADISTICAS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Manejar errores de la API
  handleError(error) {
    if (error.response) {
      // El servidor respondió con un error
      const message = error.response.data.error || 'Error del servidor';
      return new Error(message);
    } else if (error.request) {
      // No se recibió respuesta (falla de red o servidor apagado)
      return new Error('Sin conexión a Internet o el servidor está apagado. Revisa tu WiFi o reinicia el servidor.');
    } else {
      // Error al configurar la petición
      return new Error('Error de configuración: ' + error.message);
    }
  }
}

export default new ApiService();
