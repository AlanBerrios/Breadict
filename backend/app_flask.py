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
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
CIUDAD_API = "Santiago,CL"

# Mapeo de climas
MAPEO_CLIMA_TEXTO_A_NUMERO = {
    "soleado": 1, "parcialmente nublado": 2, "nublado": 3,
    "despejado": 4, "lluvia ligera": 5, "lluvia": 6
}
MAPEO_CLIMA_NUMERO_A_TEXTO = {v: k for k, v in MAPEO_CLIMA_TEXTO_A_NUMERO.items()}

# Variables globales para el modelo
modelo_maniana_global = None
modelo_tarde_global = None
features_entrenamiento = None
clima_encoder_global = None
db = None

# --- Funciones de Utilidad ---
def traducir_clima_api_a_numero_interno(weather_description_api, weather_id_api):
    """Traduce la descripción del clima de la API a nuestro número interno"""
    desc = weather_description_api.lower()
    if 800 == weather_id_api: return MAPEO_CLIMA_TEXTO_A_NUMERO["despejado"]
    if weather_id_api > 800 and weather_id_api < 805:
        return MAPEO_CLIMA_TEXTO_A_NUMERO["parcialmente nublado"] if "few clouds" in desc or "scattered clouds" in desc else MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"]
    if weather_id_api >= 300 and weather_id_api < 400: return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia ligera"]
    if weather_id_api >= 500 and weather_id_api < 600:
        return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia ligera"] if "light rain" in desc or "moderate rain" in desc else MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia"]
    if weather_id_api >= 200 and weather_id_api < 300: return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia"]
    print(f"Advertencia API: No se pudo traducir '{desc}' (ID: {weather_id_api}). Usando 'nublado'.")
    return MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"]

def obtener_pronostico_api(fecha_target_str, lat=None, lon=None):
    """Obtiene el pronóstico del tiempo para una fecha específica y ubicación (GPS)"""
    print(f"[API Backend] Solicitando pronóstico para: {fecha_target_str} (lat:{lat}, lon:{lon})")
    if OPENWEATHERMAP_API_KEY == "TU_API_KEY_AQUI" or not OPENWEATHERMAP_API_KEY:
        print("[API Backend] API Key no configurada.")
        return "manual"
    
    url = None
    try:
        fecha_target_dt = datetime.datetime.strptime(fecha_target_str, "%Y-%m-%d").date()
        hoy_dt = datetime.date.today()
        delta_dias = (fecha_target_dt - hoy_dt).days

        if delta_dias < 0 or delta_dias >= 6: return "manual"
        
        # Siempre intentar usar forecast para tener la min/max global del dia
        if lat and lon:
            url = f"http://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OPENWEATHERMAP_API_KEY}&units=metric&lang=es"
        else:
            url = f"http://api.openweathermap.org/data/2.5/forecast?q={CIUDAD_API}&appid={OPENWEATHERMAP_API_KEY}&units=metric&lang=es"

        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        temps_min_dia, temps_max_dia, descs_dia, ids_dia = [], [], [], []
        for item in data.get('list', []):
            if datetime.datetime.fromtimestamp(item['dt']).date() == fecha_target_dt:
                temps_min_dia.append(item['main']['temp_min'])
                temps_max_dia.append(item['main']['temp_max'])
                if not descs_dia:
                    descs_dia.append(item['weather'][0]['description'])
                    ids_dia.append(item['weather'][0]['id'])

        # Si no hay pronosticos para "hoy" (ej: OWM corto el dia porque son 23:55), hacer fallback a /weather actual
        if not temps_min_dia and delta_dias == 0:
            if lat and lon:
                url_current = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHERMAP_API_KEY}&units=metric&lang=es"
            else:
                url_current = f"http://api.openweathermap.org/data/2.5/weather?q={CIUDAD_API}&appid={OPENWEATHERMAP_API_KEY}&units=metric&lang=es"
            
            resp_cur = requests.get(url_current)
            resp_cur.raise_for_status()
            data_cur = resp_cur.json()
            
            temp_min = data_cur['main']['temp_min']
            temp_max = data_cur['main']['temp_max']
            clima_num = traducir_clima_api_a_numero_interno(data_cur['weather'][0]['description'], data_cur['weather'][0]['id'])
            clima_map_str = MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num, "nublado")
            return round(temp_min), round(temp_max), clima_num, clima_map_str
            
        if not temps_min_dia: 
            return "manual"
            
        clima_num = traducir_clima_api_a_numero_interno(descs_dia[0], ids_dia[0])
        clima_map_str = MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num, "nublado")
        return round(min(temps_min_dia)), round(max(temps_max_dia)), clima_num, clima_map_str

    except requests.exceptions.HTTPError as http_err:
        if http_err.response.status_code == 401: 
            print("[API Backend] Error 401: No autorizado. Verifica API Key.")
        else: 
            print(f"[API Backend] Error HTTP: {http_err}")
    except Exception as e:
        print(f"[API Backend] Error inesperado: {e}")
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
    db = PanaderiaDB()
    
    # Migrar datos del CSV si existe
    csv_path = "datos_panaderia_kilos.csv"
    if os.path.exists(csv_path):
        print("Migrando datos del CSV a SQLite...")
        db.migrar_csv_a_sqlite(csv_path)
    
    # Entrenar modelos iniciales
    entrenar_modelos_globales()

# Llamar a la inicialización manualmente (Flask 3.x ya no soporta before_first_request)
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
                return jsonify({
                    "error": "No se pudo obtener clima de API y no se proporcionaron datos manuales",
                    "requeridos": ["clima_num", "temp_min", "temp_max"]
                }), 400
            
            try:
                clima_num = int(clima_num)
                temp_min = float(temp_min)
                temp_max = float(temp_max)
                fuente_clima = "Datos manuales"
            except ValueError:
                return jsonify({"error": "Parámetros manuales inválidos"}), 400

        # Realizar predicción
        pred_maniana, pred_tarde, error = realizar_prediccion(fecha_str, temp_min, temp_max, clima_num)
        
        if error:
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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint para verificar que el servidor está funcionando"""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.datetime.now().isoformat(),
        "version": "1.0.0"
    }), 200

if __name__ == '__main__':
    print("Iniciando servidor Flask...")
    app.run(debug=True, host='0.0.0.0', port=5000)
