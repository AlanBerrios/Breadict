import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import numpy as np
import datetime
import os
import requests
import json
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
from dotenv import load_dotenv

load_dotenv()

# Importar nuestra clase de base de datos
from database import PanaderiaDB

# --- Configuración Inicial ---
# Ya no necesitamos API key - Open-Meteo es 100% gratis
DEFAULT_LAT = -33.45  # Santiago, CL (fallback)
DEFAULT_LON = -70.65

# Mapeo de climas
MAPEO_CLIMA_TEXTO_A_NUMERO = {
    "soleado": 1, "parcialmente nublado": 2, "nublado": 3,
    "despejado": 4, "lluvia ligera": 5, "lluvia": 6
}
MAPEO_CLIMA_NUMERO_A_TEXTO = {v: k for k, v in MAPEO_CLIMA_TEXTO_A_NUMERO.items()}

# Mapeo de WMO Weather Codes (Open-Meteo) a nuestro sistema interno
def wmo_code_a_clima_interno(wmo_code):
    """Traduce WMO Weather Code de Open-Meteo a nuestro número interno"""
    if wmo_code in (0,):          return 4  # despejado
    if wmo_code in (1,):          return 1  # soleado (mainly clear)
    if wmo_code in (2,):          return 2  # parcialmente nublado
    if wmo_code in (3, 45, 48):   return 3  # nublado / fog
    if wmo_code in (51, 53, 56):  return 5  # lluvia ligera (drizzle)
    if wmo_code in (55, 57):      return 5  # lluvia ligera (dense drizzle)
    if wmo_code in (61, 63, 80, 81): return 5  # lluvia ligera
    if wmo_code in (65, 66, 67, 82, 95, 96, 99): return 6  # lluvia fuerte / tormenta
    if wmo_code in (71, 73, 75, 77, 85, 86):     return 6  # nieve → tratar como lluvia
    return 3  # fallback: nublado

# Variables globales para el modelo
modelo_maniana_global = None
modelo_tarde_global = None
features_entrenamiento = None
clima_encoder_global = None
db = None

# --- Funciones de Utilidad ---
def obtener_pronostico_api(fecha_target_str, lat=None, lon=None):
    """Obtiene el clima para cualquier fecha usando Open-Meteo (gratis, sin API key)"""
    print(f"[API Backend] Solicitando clima Open-Meteo para: {fecha_target_str} (lat:{lat}, lon:{lon})")
    
    use_lat = lat if lat else DEFAULT_LAT
    use_lon = lon if lon else DEFAULT_LON
    
    try:
        fecha_target_dt = datetime.datetime.strptime(fecha_target_str, "%Y-%m-%d").date()
        hoy_dt = datetime.date.today()
        delta_dias = (fecha_target_dt - hoy_dt).days
        
        # Decidir qué endpoint usar
        if delta_dias < 0:
            # FECHA PASADA → usar Archive API (datos históricos)
            url = (
                f"https://archive-api.open-meteo.com/v1/archive"
                f"?latitude={use_lat}&longitude={use_lon}"
                f"&start_date={fecha_target_str}&end_date={fecha_target_str}"
                f"&daily=temperature_2m_max,temperature_2m_min,weathercode"
                f"&timezone=America/Santiago"
            )
            print(f"[API Backend] Usando Open-Meteo ARCHIVO (histórico)")
        else:
            # HOY o FUTURO → usar Forecast API
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={use_lat}&longitude={use_lon}"
                f"&daily=temperature_2m_max,temperature_2m_min,weathercode"
                f"&timezone=America/Santiago"
                f"&start_date={fecha_target_str}&end_date={fecha_target_str}"
            )
            print(f"[API Backend] Usando Open-Meteo FORECAST")

        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        daily = data.get('daily', {})
        temps_min = daily.get('temperature_2m_min', [])
        temps_max = daily.get('temperature_2m_max', [])
        weather_codes = daily.get('weathercode', [])
        
        if not temps_min or not temps_max:
            print(f"[API Backend] Open-Meteo no retornó datos para {fecha_target_str}")
            return "manual"
        
        temp_min = round(temps_min[0])
        temp_max = round(temps_max[0])
        wmo_code = weather_codes[0] if weather_codes else 3
        
        clima_num = wmo_code_a_clima_interno(wmo_code)
        clima_texto = MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num, "nublado")
        
        print(f"[API Backend] Open-Meteo OK: {temp_min}°C-{temp_max}°C, WMO:{wmo_code} → {clima_texto}")
        return temp_min, temp_max, clima_num, clima_texto

    except Exception as e:
        print(f"[API Backend] Error Open-Meteo: {e}")
        traceback.print_exc()
    return "manual"

def preparar_datos_para_entrenamiento(df):
    """Prepara los datos para el entrenamiento del modelo"""
    if df.empty:
        return df, None

    df['Fecha'] = pd.to_datetime(df['fecha'], errors='coerce')
    df.dropna(subset=['Fecha'], inplace=True)
    df['DiaSemana'] = df['Fecha'].dt.dayofweek
    df['Mes'] = df['Fecha'].dt.month
    df['DiaAnio'] = df['Fecha'].dt.dayofyear
    
    df['ClimaNumero'] = df['clima_promedio'].astype(str).str.lower().map(MAPEO_CLIMA_TEXTO_A_NUMERO)
    df.dropna(subset=['ClimaNumero'], inplace=True)
    
    if df.empty:
        return df, None

    df['ClimaNumero'] = df['ClimaNumero'].astype(int)
    
    # Crear y entrenar el encoder
    encoder = LabelEncoder()
    encoder.fit(sorted(list(MAPEO_CLIMA_TEXTO_A_NUMERO.values())))
    df['ClimaCodificado'] = encoder.transform(df['ClimaNumero'])
    
    return df, encoder

def entrenar_modelos_globales():
    """Entrena los modelos y los guarda en variables globales"""
    global modelo_maniana_global, modelo_tarde_global, features_entrenamiento, clima_encoder_global
    
    try:
        # Obtener datos de la base de datos
        if db is None:
            print("[Model Backend] Base de datos no inicializada.")
            return False
            
        df = db.obtener_todos_los_datos()
        
        if df is None or getattr(df, 'empty', True) or len(df) < 2:
            print("[Model Backend] No hay suficientes datos para entrenar.")
            return False

        # Preparar datos
        df_preparado, encoder = preparar_datos_para_entrenamiento(df)
        
        if df_preparado is None or getattr(df_preparado, 'empty', True):
            print("[Model Backend] Error preparando datos.")
            return False

        features = ['temperatura_minima', 'temperatura_maxima', 'DiaSemana', 'Mes', 'DiaAnio', 'ClimaCodificado']
        
        # Verificar columnas necesarias
        if not all(col in df_preparado.columns for col in features):
            print(f"[Model Backend] Faltan columnas: {features}")
            return False

        X = df_preparado[features]
        y_maniana = df_preparado['pan_comprado_maniana'].astype(int)
        y_tarde = df_preparado['pan_comprado_tarde'].astype(int)

        if len(X) < 2:
            print("[Model Backend] Datos insuficientes para entrenamiento.")
            return False

        # Entrenar modelos
        modelo_maniana_global = RandomForestRegressor(n_estimators=100, random_state=42)
        modelo_tarde_global = RandomForestRegressor(n_estimators=100, random_state=42)
        
        modelo_maniana_global.fit(X, y_maniana)
        modelo_tarde_global.fit(X, y_tarde)
        
        features_entrenamiento = features
        clima_encoder_global = encoder
        
        print("[Model Backend] Modelos entrenados exitosamente.")
        return True

    except Exception as e:
        print(f"[Model Backend] Error entrenando modelos: {e}")
        traceback.print_exc()
        return False

def realizar_prediccion(fecha_str, temp_min, temp_max, clima_num):
    """Realiza predicción usando los modelos globales"""
    global modelo_maniana_global, modelo_tarde_global, features_entrenamiento, clima_encoder_global
    
    if not all([modelo_maniana_global, modelo_tarde_global, features_entrenamiento, clima_encoder_global]):
        return None, None, "Modelos no entrenados"
    
    try:
        fecha_dt = datetime.datetime.strptime(fecha_str, "%Y-%m-%d").date()
        dia_semana = fecha_dt.weekday()
        mes = fecha_dt.month
        dia_anio = int(fecha_dt.strftime('%j'))
        
        if clima_encoder_global is None:
            return None, None, "Clima encoder no inicializado"
            
        clima_codificado = clima_encoder_global.transform([clima_num])[0]
        
        datos_prediccion = pd.DataFrame([{
            'temperatura_minima': temp_min,
            'temperatura_maxima': temp_max,
            'DiaSemana': dia_semana,
            'Mes': mes,
            'DiaAnio': dia_anio,
            'ClimaCodificado': clima_codificado
        }])
        
        datos_prediccion = datos_prediccion[features_entrenamiento]
        
        if modelo_maniana_global is not None:
            pred_maniana = int(round(modelo_maniana_global.predict(datos_prediccion)[0]))
        else:
            return None, None, "Modelo de mañana no entrenado"

        if modelo_tarde_global is not None:
            pred_tarde = int(round(modelo_tarde_global.predict(datos_prediccion)[0]))
        else:
            return None, None, "Modelo de tarde no entrenado"
        
        return pred_maniana, pred_tarde, None
        
    except Exception as e:
        print(f"Error en predicción: {e}")
        return None, None, str(e)

# --- Inicialización de la Aplicación Flask ---
app = Flask(__name__)
CORS(app)  # Permitir peticiones desde la app móvil

def inicializar():
    """Inicializa la base de datos y los modelos"""
    global db
    print(f"[App Backend] Inicializando en: {os.getcwd()}")
    db = PanaderiaDB()
    
    # Migrar datos del CSV si existe
    csv_path = "datos_panaderia_kilos.csv"
    if os.path.exists(csv_path):
        print(f"[App Backend] Detectado CSV de entrenamiento: {csv_path}")
        exito = db.migrar_csv_a_sqlite(csv_path)
        print(f"[App Backend] Resultado migración: {'Exitosa' if exito else 'Fallida'}")
    else:
        print(f"[App Backend] No se encontró CSV inicial en {os.getcwd()}")
    
    # Entrenar modelos iniciales
    status_entrenamiento = entrenar_modelos_globales()
    print(f"[App Backend] Modelos entrenados al inicio: {'Sí' if status_entrenamiento else 'No (Faltan datos)'}")

# Llamar a la inicialización manualmente
with app.app_context():
    inicializar()

# --- Endpoints de la API ---

@app.route('/api/registro', methods=['POST'])
def registrar_datos():
    """Registra los datos reales de ventas del día"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request debe ser JSON"}), 400

        # Campos requeridos
        required_fields = ['fecha', 'clima_promedio', 'temperatura_minima', 'temperatura_maxima', 
                           'pan_comprado_maniana', 'pan_comprado_tarde', 'pan_vendido_maniana', 'pan_vendido_tarde']
        
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Faltan campos: {required_fields}"}), 400
        
        # Validaciones
        fecha_str = data['fecha']
        try:
            fecha_dt = datetime.datetime.strptime(fecha_str, "%Y-%m-%d").date()
            if fecha_dt > datetime.date.today():
                return jsonify({"error": "No puedes registrar datos futuros"}), 400
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido. Usar YYYY-MM-DD"}), 400

        clima_texto = str(data['clima_promedio']).lower()
        if clima_texto not in MAPEO_CLIMA_TEXTO_A_NUMERO:
            return jsonify({"error": f"Clima no válido. Usar: {list(MAPEO_CLIMA_TEXTO_A_NUMERO.keys())}"}), 400

        if db is not None:
            # Insertar en base de datos
            db.insertar_registro(
                fecha_str, clima_texto,
                float(data['temperatura_minima']), float(data['temperatura_maxima']),
                int(data['pan_comprado_maniana']), int(data['pan_comprado_tarde']),
                int(data['pan_vendido_maniana']), int(data['pan_vendido_tarde'])
            )

        # Reentrenar modelos con el nuevo dato en segundo plano para no bloquear
        threading.Thread(target=entrenar_modelos_globales).start()

        return jsonify({"message": "Datos registrados exitosamente", "fecha": fecha_str}), 200

    except Exception as e:
        print(f"Error en /api/registro: {e}")
        return jsonify({"error": f"Error interno: {e}"}), 500

@app.route('/api/prediccion', methods=['GET'])
def obtener_prediccion():
    """Obtiene predicción para una fecha específica"""
    try:
        fecha_str = request.args.get('fecha')
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        if not fecha_str:
            return jsonify({"error": "Parámetro 'fecha' (YYYY-MM-DD) es requerido"}), 400

        # Validar formato de fecha
        try:
            datetime.datetime.strptime(fecha_str, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido. Usar YYYY-MM-DD"}), 400

        # Obtener datos del clima
        clima_info = obtener_pronostico_api(fecha_str, lat, lon)
        
        if clima_info and clima_info != "manual":
            temp_min, temp_max, clima_num, desc_api = clima_info
            fuente_clima = f"API ({desc_api})"
        else:
            # Intentar obtener datos manuales de los parámetros
            clima_num = request.args.get('clima_num')
            temp_min = request.args.get('temp_min')
            temp_max = request.args.get('temp_max')
            
            if not all([clima_num, temp_min, temp_max]):
                print("[API Backend] Fallaron datos de clima y no hay datos manuales en la petición.")
                return jsonify({
                    "error": "No se pudo obtener clima de API y no se proporcionaron datos manuales",
                    "requeridos": ["clima_num", "temp_min", "temp_max"]
                }), 400
            
            try:
                clima_num = int(clima_num)
                temp_min = float(temp_min)
                temp_max = float(temp_max)
                fuente_clima = "Datos manuales"
            except (ValueError, TypeError):
                return jsonify({"error": "Parámetros manuales inválidos (deben ser números)"}), 400

        # Realizar predicción
        pred_maniana, pred_tarde, error = realizar_prediccion(fecha_str, temp_min, temp_max, clima_num)
        
        if error:
            # Si los modelos no están entrenados, igualmente retornar los datos del clima
            if "no entrenados" in error.lower():
                print(f"[API Backend] Modelos no entrenados, devolviendo solo clima.")
                return jsonify({
                    "fecha": fecha_str,
                    "fuente_clima": fuente_clima,
                    "clima_numero": clima_num,
                    "clima_texto": MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num, "desconocido"),
                    "temperatura_minima": temp_min,
                    "temperatura_maxima": temp_max,
                    "prediccion_maniana_kg": None,
                    "prediccion_tarde_kg": None,
                    "total_prediccion_kg": 0,
                    "aviso": "Registra al menos 2 días de ventas para activar las predicciones."
                }), 200
            print(f"[API Backend] Error en predicción: {error}")
            return jsonify({"error": error}), 500

        total_pred = 0
        if pred_maniana is not None and pred_tarde is not None:
             total_pred = pred_maniana + pred_tarde

        return jsonify({
            "fecha": fecha_str,
            "fuente_clima": fuente_clima,
            "clima_numero": clima_num,
            "clima_texto": MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num, "desconocido"),
            "temperatura_minima": temp_min,
            "temperatura_maxima": temp_max,
            "prediccion_maniana_kg": pred_maniana,
            "prediccion_tarde_kg": pred_tarde,
            "total_prediccion_kg": total_pred
        }), 200

    except Exception as e:
        print(f"Error en /api/prediccion: {e}")
        return jsonify({"error": f"Error interno: {e}"}), 500

@app.route('/api/estadisticas', methods=['GET'])
def obtener_estadisticas():
    """Obtiene estadísticas básicas y el historial comparativo de predicción vs venta real de los últimos 5 días"""
    try:
        total_registros = db.contar_registros() if db is not None else 0
        
        historial = []
        if db is not None:
            df = db.obtener_todos_los_datos()
            if not df.empty:
                # Ordenar por fecha y tomar los últimos 5
                df_reciente = df.sort_values(by='fecha', ascending=False).head(5)
                
                # Invertir para que el orden sea cronológico normal
                df_reciente = df_reciente.iloc[::-1]
                
                for _, row in df_reciente.iterrows():
                    vendido_total = int(row['pan_vendido_maniana']) + int(row['pan_vendido_tarde'])
                    
                    # Intentar re-predecir el pasado basado en el clima del registro para compararlo
                    try:
                        clima_num = MAPEO_CLIMA_TEXTO_A_NUMERO.get(str(row['clima_promedio']).lower(), 3)
                        p_man, p_tar, _ = realizar_prediccion(
                            str(row['fecha']), 
                            float(row['temperatura_minima']),
                            float(row['temperatura_maxima']),
                            clima_num
                        )
                        predicho_total = (p_man or 0) + (p_tar or 0)
                    except Exception as e:
                        print(f"Error generando histórico para {row['fecha']}: {e}")
                        predicho_total = 0
                        
                    historial.append({
                        "fecha": str(row['fecha'])[-5:], # Solo mes y dia "MM-DD"
                        "vendido": vendido_total,
                        "predicho": predicho_total
                    })

        return jsonify({
            "total_registros": total_registros,
            "modelos_entrenados": modelo_maniana_global is not None and modelo_tarde_global is not None,
            "ultima_actualizacion": datetime.datetime.now().isoformat(),
            "historial_comparativo": historial
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/analiticas', methods=['GET'])
def obtener_analiticas():
    """Retorna TODOS los registros con predicciones para la pantalla de análisis interactivo"""
    try:
        if db is None:
            return jsonify({"registros": [], "total": 0}), 200
        
        df = db.obtener_todos_los_datos()
        if df.empty:
            return jsonify({"registros": [], "total": 0}), 200
        
        registros = []
        df_sorted = df.sort_values(by='fecha', ascending=True)
        
        for _, row in df_sorted.iterrows():
            vendido_man = int(row['pan_vendido_maniana'])
            vendido_tar = int(row['pan_vendido_tarde'])
            vendido_total = vendido_man + vendido_tar
            comprado_total = int(row['pan_comprado_maniana']) + int(row['pan_comprado_tarde'])
            
            predicho_total = 0
            try:
                clima_num = MAPEO_CLIMA_TEXTO_A_NUMERO.get(str(row['clima_promedio']).lower(), 3)
                p_man, p_tar, _ = realizar_prediccion(
                    str(row['fecha']),
                    float(row['temperatura_minima']),
                    float(row['temperatura_maxima']),
                    clima_num
                )
                predicho_total = (p_man or 0) + (p_tar or 0)
            except Exception:
                predicho_total = 0
            
            registros.append({
                "fecha": str(row['fecha']),
                "clima": str(row['clima_promedio']),
                "temp_min": float(row['temperatura_minima']),
                "temp_max": float(row['temperatura_maxima']),
                "vendido": vendido_total,
                "comprado": comprado_total,
                "predicho": predicho_total
            })
        
        return jsonify({"registros": registros, "total": len(registros)}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/registro/existe', methods=['GET'])
def check_registro_exists():
    """Verifica si ya existe un registro para una fecha dada"""
    fecha = request.args.get('fecha')
    if not fecha:
        return jsonify({"error": "Fecha requerida"}), 400
    try:
        registro = db.obtener_registro_fecha(fecha)
        exists = registro is not None and not registro.empty if hasattr(registro, 'empty') else registro is not None
        return jsonify({"exists": exists, "fecha": fecha}), 200
    except Exception as e:
        return jsonify({"exists": False, "fecha": fecha}), 200

@app.route('/api/exportar', methods=['GET'])
def exportar_csv():
    """Exporta todos los registros como CSV"""
    try:
        df = db.obtener_todos_los_datos()
        if df.empty:
            return jsonify({"error": "No hay datos para exportar"}), 404
        csv_data = df.to_csv(index=False)
        return csv_data, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename=breadict_datos.csv'
        }
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint para verificar que el servidor está funcionando"""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.datetime.now().isoformat(),
        "version": "2.1.0",
        "weather_api": "Open-Meteo (gratis, sin API key)",
        "database_type": "PostgreSQL (Cloud)" if db and db.is_postgres else "SQLite (Local)"
    }), 200

if __name__ == '__main__':
    print("Iniciando servidor Flask...")
    app.run(debug=True, host='0.0.0.0', port=5000)
