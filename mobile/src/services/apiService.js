import axios from 'axios';
import { API_CONFIG } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 120000,
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
    const cacheKey = `@prediccion_${fecha}`;
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
      
      // Guardar en cache offline si la respuesta es exitosa
      if (response.data && !response.data.error) {
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        } catch(e) { /* ignore storage errors */ }
      }
      
      return response.data;
    } catch (error) {
      // Intentar recuperar de cache si hay error de red
      try {
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr);
          cachedData.isOffline = true; // Flag for frontend
          return cachedData;
        }
      } catch(e) { /* ignore storage errors */ }
      
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

  // Obtener todos los registros con predicciones para analíticas
  async obtenerAnaliticas() {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ANALITICAS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Verificar si ya existe un registro para una fecha
  async checkFechaExiste(fecha) {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.REGISTRO_EXISTE, { params: { fecha } });
      return response.data;
    } catch (error) {
      return { exists: false };
    }
  }

  // Obtener URL de exportación CSV
  getExportUrl() {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.EXPORTAR}`;
  }

  // Manejar errores de la API
  handleError(error) {
    if (error.response) {
      const message = error.response.data.error || 'Error del servidor';
      return new Error(message);
    } else if (error.request) {
      return new Error('📡 Sin conexión a Internet o el servidor está inactivo. Verifica tu conexión WiFi o datos móviles.');
    } else {
      return new Error('Error de configuración: ' + error.message);
    }
  }
}

export default new ApiService();
