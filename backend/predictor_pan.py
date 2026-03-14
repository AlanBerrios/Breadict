import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import numpy as np
import datetime
import os
import requests # Para llamadas a la API
import json     # Para manejar la respuesta de la API
import traceback # Para imprimir el stack trace completo en excepciones
from urllib.parse import urlparse # <--- AÑADIDO PARA PARSEAR URL

# --- Variables Globales y Configuración ---
RUTA_CSV_PANADERIA = "datos_panaderia_kilos.csv"

# !!!!! IMPORTANTE: USA TU API KEY DE OPENWEATHERMAP !!!!!
# La API Key del correo de OpenWeatherMap es: c644cd8961008ba78cea6524e87c18ff
# Recuerda que puede tardar "un par de horas" en activarse después de recibir el correo.
OPENWEATHERMAP_API_KEY = "c644cd8961008ba78cea6524e87c18ff" # <--- ¡ASEGÚRATE QUE ESTA SEA TU CLAVE!

CIUDAD_API = "Santiago,CL" # Código de ciudad para OpenWeatherMap

# Mapeo explícito de climas a números para entrada de usuario y consistencia
MAPEO_CLIMA_TEXTO_A_NUMERO = {
    "soleado": 1,
    "parcialmente nublado": 2,
    "nublado": 3,
    "despejado": 4,
    "lluvia ligera": 5,
    "lluvia": 6
}
MAPEO_CLIMA_NUMERO_A_TEXTO = {v: k for k, v in MAPEO_CLIMA_TEXTO_A_NUMERO.items()}

clima_encoder_interno = LabelEncoder()
try:
    clima_encoder_interno.fit(list(MAPEO_CLIMA_TEXTO_A_NUMERO.values()))
except Exception as e:
    print(f"Error inicializando clima_encoder_interno: {e}. Usando fallback.")
    clima_encoder_interno.fit([1,2,3,4,5,6])


def traducir_clima_api_a_numero_interno(weather_description_api, weather_id_api):
    """
    Traduce la descripción del clima de la API de OpenWeatherMap
    a uno de nuestros números de clima internos (1-6).
    Se basa en el ID y la descripción.
    """
    desc = weather_description_api.lower()
    
    # Basado en ID (más fiable a veces)
    if 800 == weather_id_api: # Clear
        return MAPEO_CLIMA_TEXTO_A_NUMERO["despejado"] 
    if weather_id_api > 800 and weather_id_api < 805: # Clouds
        if "broken clouds" in desc or "overcast clouds" in desc:
            return MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"]
        else: # few clouds, scattered clouds
            return MAPEO_CLIMA_TEXTO_A_NUMERO["parcialmente nublado"]
    if weather_id_api >= 300 and weather_id_api < 400: # Drizzle
        return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia ligera"]
    if weather_id_api >= 500 and weather_id_api < 600: # Rain
        if "light rain" in desc or "moderate rain" in desc or "light intensity shower rain" in desc:
            return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia ligera"]
        else: 
            return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia"]
    if weather_id_api >= 200 and weather_id_api < 300: # Thunderstorm
        return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia"] 
    if weather_id_api >= 600 and weather_id_api < 700: # Snow
        return MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"] 
    if weather_id_api >= 700 and weather_id_api < 800: # Atmosphere (mist, smoke, haze, etc.)
        return MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"]

    # Fallback basado en descripción si el ID no fue concluyente
    if "clear" in desc or "sun" in desc:
        return MAPEO_CLIMA_TEXTO_A_NUMERO["despejado"]
    if "few clouds" in desc or "scattered clouds" in desc:
        return MAPEO_CLIMA_TEXTO_A_NUMERO["parcialmente nublado"]
    if "clouds" in desc or "overcast" in desc: 
        return MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"]
    if "light rain" in desc or "drizzle" in desc or ("shower rain" in desc and "light" in desc):
        return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia ligera"]
    if "rain" in desc:
        return MAPEO_CLIMA_TEXTO_A_NUMERO["lluvia"]
    
    print(f"Advertencia: No se pudo traducir la descripción de clima API: '{desc}' (ID: {weather_id_api}). Usando 'nublado' por defecto.")
    return MAPEO_CLIMA_TEXTO_A_NUMERO["nublado"] 

def obtener_pronostico_api(fecha_target_str):
    """
    Obtiene el pronóstico del tiempo para una fecha específica usando OpenWeatherMap.
    Devuelve (temp_min, temp_max, clima_numero_interno, descripcion_api) o "manual" si falla/no aplica.
    """
    print(f"[DEBUG API] Iniciando obtener_pronostico_api para fecha: {fecha_target_str}")
    api_key_display = f"{OPENWEATHERMAP_API_KEY[:5]}...{OPENWEATHERMAP_API_KEY[-5:]}" if OPENWEATHERMAP_API_KEY and len(OPENWEATHERMAP_API_KEY) > 10 else "NO VALIDA O CORTA"
    print(f"[DEBUG API] Usando API Key: {api_key_display}")

    if OPENWEATHERMAP_API_KEY == "TU_API_KEY_AQUI" or not OPENWEATHERMAP_API_KEY: 
        print("[DEBUG API] API Key no configurada o es placeholder 'TU_API_KEY_AQUI'.")
        print("Error: Debes configurar tu API Key de OpenWeatherMap en la variable OPENWEATHERMAP_API_KEY.")
        return "manual" 
    
    data = None 
    url = None  

    try:
        fecha_target_dt = datetime.datetime.strptime(fecha_target_str, "%Y-%m-%d").date()
        hoy_dt = datetime.date.today()
        delta_dias = (fecha_target_dt - hoy_dt).days
        print(f"[DEBUG API] delta_dias calculado: {delta_dias}")
 
        if delta_dias < 0:
            print(f"[DEBUG API] Fecha es pasada (delta_dias: {delta_dias}). Retornando 'manual'.")
            return "manual"
        
        if delta_dias == 0:
            url = f"http://api.openweathermap.org/data/2.5/weather?q={CIUDAD_API}&appid={OPENWEATHERMAP_API_KEY}&units=metric&lang=es"
        elif delta_dias > 0 and delta_dias < 6: 
             url = f"http://api.openweathermap.org/data/2.5/forecast?q={CIUDAD_API}&appid={OPENWEATHERMAP_API_KEY}&units=metric&lang=es"
        else: 
            print(f"[DEBUG API] Fecha muy lejana (delta_dias: {delta_dias}). Retornando 'manual'.")
            return "manual" 

        if url: 
            url = url.strip() 
        else: # No debería ocurrir si delta_dias está en los rangos esperados
            print("[DEBUG API] URL no se pudo construir. Retornando 'manual'.")
            return "manual"


        print(f"[DEBUG API] URL seleccionada (después de strip): '{url}'") 
        print(f"[DEBUG API] Realizando solicitud GET a: {url}")
        response = requests.get(url)
        print(f"[DEBUG API] Código de estado de la respuesta HTTP: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print("[DEBUG API] Respuesta JSON obtenida y parseada exitosamente.")
        # print(f"[DEBUG API] Contenido de data: {json.dumps(data, indent=2)}") 

        # --- CORRECCIÓN EN LA VERIFICACIÓN DE URL ---
        parsed_url = urlparse(url)
        path = parsed_url.path # Esto será por ej. '/data/2.5/weather'
        print(f"[DEBUG API] Verificando parsed_url.path. Path es: '{path}'")

        if path.endswith("/weather"): 
            print("[DEBUG API] Procesando respuesta de /weather (verificado por path).")
            temp_min = data['main']['temp_min']
            temp_max = data['main']['temp_max']
            weather_description = data['weather'][0]['description']
            weather_id = data['weather'][0]['id']
            clima_num = traducir_clima_api_a_numero_interno(weather_description, weather_id)
            print(f"[DEBUG API] /weather procesado. TempMin: {temp_min}, TempMax: {temp_max}, ClimaNum: {clima_num}")
            return round(temp_min), round(temp_max), clima_num, weather_description

        elif path.endswith("/forecast"): 
            print("[DEBUG API] Procesando respuesta de /forecast (verificado por path).")
            temps_min_dia = []
            temps_max_dia = []
            weather_descriptions_dia = [] 
            weather_ids_dia = []          

            print(f"[DEBUG API] Iterando sobre data['list'] para fecha_target_dt: {fecha_target_dt}")
            items_encontrados_para_fecha = 0
            for item_dia in data.get('list', []): 
                item_fecha_dt = datetime.datetime.fromtimestamp(item_dia['dt']).date()
                if item_fecha_dt == fecha_target_dt:
                    items_encontrados_para_fecha +=1
                    temps_min_dia.append(item_dia['main']['temp_min'])
                    temps_max_dia.append(item_dia['main']['temp_max'])
                    if not weather_descriptions_dia: 
                        weather_descriptions_dia.append(item_dia['weather'][0]['description'])
                        weather_ids_dia.append(item_dia['weather'][0]['id'])
            
            print(f"[DEBUG API] Items encontrados para la fecha {fecha_target_dt}: {items_encontrados_para_fecha}")
            
            if not temps_min_dia: 
                print(f"[DEBUG API] No se encontró pronóstico para {fecha_target_str} en la lista de /forecast. Retornando 'manual'.")
                return "manual"

            temp_min_final = min(temps_min_dia)
            temp_max_final = max(temps_max_dia)
            
            if not weather_descriptions_dia: 
                print(f"[DEBUG API] weather_descriptions_dia está vacía a pesar de tener temperaturas. Retornando 'manual'.")
                return "manual"

            weather_description = weather_descriptions_dia[0] 
            weather_id = weather_ids_dia[0]
            clima_num = traducir_clima_api_a_numero_interno(weather_description, weather_id)
            print(f"[DEBUG API] /forecast procesado. TempMin: {temp_min_final}, TempMax: {temp_max_final}, ClimaNum: {clima_num}")
            return round(temp_min_final), round(temp_max_final), clima_num, weather_description
        else:
            print(f"[DEBUG API] Path no termina ni con /weather ni con /forecast. Path: '{path}'. URL: '{url}'. Retornando 'manual'.")
            
    except requests.exceptions.HTTPError as http_err:
        print(f"[DEBUG API] Capturado requests.exceptions.HTTPError.")
        if http_err.response.status_code == 401:
            print("Error 401: No autorizado. Verifica tu API Key y que esté activa.")
            print("Recuerda que la API Key puede tardar unas horas en activarse después de crearla o confirmar tu email.")
        else:
            print(f"Error HTTP al obtener el pronóstico: {http_err}")
    except requests.exceptions.RequestException as e:
        print(f"[DEBUG API] Capturado requests.exceptions.RequestException.")
        print(f"Error de red al obtener el pronóstico: {e}")
    except KeyError as e:
        print(f"[DEBUG API] Capturado KeyError.")
        data_for_error = locals().get('data', 'No se pudo obtener `data`')
        print(f"Error al procesar la respuesta de la API (KeyError): {e}. Respuesta parcial o completa: {data_for_error}")
        print(traceback.format_exc())
    except Exception as e:
        print(f"[DEBUG API] Capturado Exception general: {type(e).__name__} - {e}")
        print(traceback.format_exc()) 
        print(f"Error inesperado al obtener el pronóstico: {e}")
    
    print("[DEBUG API] Se alcanzó el final de la función o un bloque except. Retornando 'manual'.")
    return "manual" 


def mostrar_opciones_clima():
    print("\nOpciones de Clima (para ingreso manual):")
    for clima_texto, clima_num in MAPEO_CLIMA_TEXTO_A_NUMERO.items():
        print(f"  {clima_num}: {clima_texto.capitalize()}")

def obtener_clima_usuario_manual():
    """Solicita al usuario que elija un clima por número o salir."""
    mostrar_opciones_clima()
    while True:
        clima_input_str = input(f"Elige el número del clima (1-{len(MAPEO_CLIMA_TEXTO_A_NUMERO)}) o escribe 's' para salir: ").strip().lower()
        if clima_input_str == 's':
            return "SALIR_CLIMA" 
        try:
            clima_num_input = int(clima_input_str)
            if clima_num_input in MAPEO_CLIMA_TEXTO_A_NUMERO.values():
                return clima_num_input
            else:
                print(f"Número de clima no válido.")
        except ValueError:
            print("Entrada no válida. Por favor, ingresa un número o 's' para salir.")

def cargar_y_preparar_datos(ruta_csv, entrenando=False):
    global clima_encoder_interno
    if not os.path.exists(ruta_csv):
        print(f"Advertencia: El archivo CSV '{ruta_csv}' no existe.")
        columnas_esperadas = ['Fecha', 'Clima promedio', 'Temperatura mínima', 'Temperatura maxima',
                              'Pan comprado mañana', 'Pan comprado tarde', 'Pan vendido mañana', 'Pan vendido tarde']
        df = pd.DataFrame(columns=columnas_esperadas)
        try:
            df.to_csv(ruta_csv, index=False)
            print(f"Se ha creado un archivo CSV vacío: '{ruta_csv}'")
        except Exception as e:
            print(f"No se pudo crear el archivo CSV vacío: {e}")
            return None
        return df

    try:
        df = pd.read_csv(ruta_csv)
        if entrenando: print(f"Archivo CSV '{ruta_csv}' cargado exitosamente.")
    except pd.errors.EmptyDataError:
        print(f"Advertencia: El archivo CSV '{ruta_csv}' está vacío.")
        columnas_esperadas = ['Fecha', 'Clima promedio', 'Temperatura mínima', 'Temperatura maxima',
                              'Pan comprado mañana', 'Pan comprado tarde', 'Pan vendido mañana', 'Pan vendido tarde']
        df = pd.DataFrame(columns=columnas_esperadas)
        return df
    except Exception as e:
        print(f"Error al cargar el archivo CSV '{ruta_csv}': {e}")
        return None

    if 'Fecha' not in df.columns:
        print("Error: La columna 'Fecha' no se encuentra en el CSV.")
        return None
    df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')
    df.dropna(subset=['Fecha'], inplace=True)

    df['DiaSemana'] = df['Fecha'].dt.dayofweek
    df['Mes'] = df['Fecha'].dt.month
    df['DiaAnio'] = df['Fecha'].dt.dayofyear
    df['Anio'] = df['Fecha'].dt.year

    if 'Clima promedio' in df.columns:
        df['ClimaNumero'] = df['Clima promedio'].astype(str).str.lower().map(MAPEO_CLIMA_TEXTO_A_NUMERO)
        df.dropna(subset=['ClimaNumero'], inplace=True) 
        if not df.empty: 
            df['ClimaNumero'] = df['ClimaNumero'].astype(int)
            df['ClimaCodificado'] = clima_encoder_interno.transform(df['ClimaNumero'])
        else: 
            if entrenando: print("Advertencia: DataFrame vacío después de procesar 'Clima promedio'.")
            df['ClimaCodificado'] = pd.Series(dtype=int) 

    else:
        if entrenando: print("Advertencia: Columna 'Clima promedio' no encontrada.")
        df['ClimaCodificado'] = 0 

    cols_pan = ['Pan comprado mañana', 'Pan comprado tarde', 'Pan vendido mañana', 'Pan vendido tarde']
    for col in cols_pan:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').round().astype('Int64')
        else:
            if entrenando: print(f"Advertencia: Columna '{col}' no encontrada. Se usará 0.")
            df[col] = 0
    
    if entrenando and not df.empty:
        df.dropna(subset=['Pan comprado mañana', 'Pan comprado tarde'], inplace=True)
    return df

def entrenar_modelos(df):
    if df is None or df.empty or len(df) < 2:
        print("No hay suficientes datos para entrenar los modelos.")
        return None, None, None
    if 'ClimaCodificado' not in df.columns or df['ClimaCodificado'].isnull().all():
        print("Error: 'ClimaCodificado' es necesario y falta o está vacío.")
        return None, None, None

    features = ['Temperatura mínima', 'Temperatura maxima', 'DiaSemana', 'Mes', 'DiaAnio', 'ClimaCodificado']
    for feature in features:
        if feature not in df.columns:
            print(f"Error: Característica '{feature}' no encontrada.")
            return None, None, None
    
    df_train = df[features + ['Pan comprado mañana', 'Pan comprado tarde']].copy()
    df_train.dropna(inplace=True)

    if df_train.empty or len(df_train) < 2:
        print("Datos insuficientes después de limpiar NaNs para entrenamiento.")
        return None, None, None

    X = df_train[features]
    y_maniana = df_train['Pan comprado mañana'].astype(int)
    y_tarde = df_train['Pan comprado tarde'].astype(int)

    modelo_maniana = RandomForestRegressor(n_estimators=100, random_state=42, oob_score=True)
    modelo_tarde = RandomForestRegressor(n_estimators=100, random_state=42, oob_score=True)

    try:
        modelo_maniana.fit(X, y_maniana)
        if hasattr(modelo_maniana, 'oob_score_') and modelo_maniana.oob_score_ is not None:
             print(f"Modelo Mañana OOB Score: {modelo_maniana.oob_score_:.4f}")
    except Exception as e:
        print(f"Error al entrenar modelo mañana: {e}")
        return None, None, features
    try:
        modelo_tarde.fit(X, y_tarde)
        if hasattr(modelo_tarde, 'oob_score_') and modelo_tarde.oob_score_ is not None:
            print(f"Modelo Tarde OOB Score: {modelo_tarde.oob_score_:.4f}")
    except Exception as e:
        print(f"Error al entrenar modelo tarde: {e}")
        return modelo_maniana, None, features
    return modelo_maniana, modelo_tarde, features

def predecir_pan_script(modelo_maniana, modelo_tarde, features, fecha_pred_str, clima_num_pred, temp_min_pred, temp_max_pred):
    global clima_encoder_interno
    if modelo_maniana is None or modelo_tarde is None:
        print("Modelos no entrenados.")
        return None, None
    try:
        fecha_dt = pd.to_datetime(fecha_pred_str)
    except ValueError:
        print(f"Error: Formato de fecha '{fecha_pred_str}' no válido.")
        return None, None

    dia_semana = fecha_dt.dayofweek
    mes = fecha_dt.month
    dia_anio = fecha_dt.dayofyear
    try:
        clima_codificado_pred = clima_encoder_interno.transform([clima_num_pred])[0]
    except Exception as e:
        print(f"Error al codificar clima '{clima_num_pred}': {e}")
        return None, None

    datos_prediccion = pd.DataFrame({
        'Temperatura mínima': [temp_min_pred], 'Temperatura maxima': [temp_max_pred],
        'DiaSemana': [dia_semana], 'Mes': [mes], 'DiaAnio': [dia_anio],
        'ClimaCodificado': [clima_codificado_pred]
    })
    datos_prediccion = datos_prediccion[features]
    pred_maniana_kg_float = modelo_maniana.predict(datos_prediccion)[0]
    pred_tarde_kg_float = modelo_tarde.predict(datos_prediccion)[0]
    return int(round(pred_maniana_kg_float)), int(round(pred_tarde_kg_float))

def agregar_o_actualizar_dia(ruta_csv):
    print("\n--- Agregar o Actualizar Datos de un Día ---")
    df_existente = cargar_y_preparar_datos(ruta_csv, entrenando=False)
    if df_existente is None: 
        df_existente = pd.DataFrame(columns=['Fecha', 'Clima promedio', 'Temperatura mínima', 'Temperatura maxima',
                                             'Pan comprado mañana', 'Pan comprado tarde', 'Pan vendido mañana', 'Pan vendido tarde'])
    while True:
        fecha_str = input("Fecha del día (YYYY-MM-DD): ").strip()
        try:
            fecha_dt_ingresada = datetime.datetime.strptime(fecha_str, "%Y-%m-%d").date()
            if fecha_dt_ingresada > datetime.date.today():
                print(f"Error: No puedes ingresar datos para una fecha futura ({fecha_str}).")
                continue
            break
        except ValueError:
            print("Formato de fecha incorrecto.")

    print("Para el clima, puedes ingresarlo manualmente o intentar obtenerlo de la API si es un día reciente.")
    opcion_clima_api = input("¿Intentar obtener clima de la API para esta fecha? (s/n, por defecto n para fechas pasadas): ").strip().lower()
    
    temp_min_manual, temp_max_manual, clima_num_manual = None, None, None

    if opcion_clima_api == 's':
        pronostico = obtener_pronostico_api(fecha_str)
        if pronostico and pronostico != "manual":
            temp_min_api, temp_max_api, clima_num_api, desc_api = pronostico
            print(f"Clima obtenido de API para {fecha_str}: Temp Min: {temp_min_api}°C, Temp Max: {temp_max_api}°C, Clima: {MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num_api, 'Desconocido')} ({desc_api})")
            usar_api = input("¿Usar estos datos de la API? (s/n): ").strip().lower()
            if usar_api == 's':
                temp_min_manual = temp_min_api
                temp_max_manual = temp_max_api
                clima_num_manual = clima_num_api
        else:
            print("No se pudo obtener el clima de la API o se requiere ingreso manual para esta fecha.")

    if clima_num_manual is None: 
        clima_num_manual = obtener_clima_usuario_manual()
        if clima_num_manual == "SALIR_CLIMA":
            print("Operación de agregar/actualizar día cancelada.")
            return 
    
    clima_texto_seleccionado = MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num_manual, "desconocido")
    
    if temp_min_manual is None: 
        while True:
            try:
                temp_min_manual_str = input("Temperatura mínima (o 's' para cancelar): ").strip().lower()
                if temp_min_manual_str == 's':
                    print("Operación de agregar/actualizar día cancelada.")
                    return
                temp_min_manual = float(temp_min_manual_str)

                temp_max_manual_str = input("Temperatura máxima (o 's' para cancelar): ").strip().lower()
                if temp_max_manual_str == 's':
                    print("Operación de agregar/actualizar día cancelada.")
                    return
                temp_max_manual = float(temp_max_manual_str)

                if temp_min_manual > temp_max_manual: print("Temp mínima > máxima.")
                else: break
            except ValueError: print("Número inválido.")

    def obtener_kilos_pan(mensaje_prompt):
        while True:
            try:
                kilos_str = input(f"{mensaje_prompt} (kilos enteros o 's' para cancelar): ").strip().lower()
                if kilos_str == 's':
                    return "SALIR_PAN" 
                kilos = int(kilos_str)
                if kilos >= 0: return kilos
                else: print("Kilos no pueden ser negativos.")
            except ValueError: print("Número entero inválido.")

    pan_comp_m = obtener_kilos_pan("Pan comprado mañana")
    if pan_comp_m == "SALIR_PAN": print("Operación de agregar/actualizar día cancelada."); return
    pan_comp_t = obtener_kilos_pan("Pan comprado tarde")
    if pan_comp_t == "SALIR_PAN": print("Operación de agregar/actualizar día cancelada."); return
    pan_vend_m = obtener_kilos_pan("Pan vendido mañana")
    if pan_vend_m == "SALIR_PAN": print("Operación de agregar/actualizar día cancelada."); return
    pan_vend_t = obtener_kilos_pan("Pan vendido tarde")
    if pan_vend_t == "SALIR_PAN": print("Operación de agregar/actualizar día cancelada."); return

    nueva_fila_datos = {
        'Fecha': pd.to_datetime(fecha_dt_ingresada), 
        'Clima promedio': clima_texto_seleccionado, 
        'Temperatura mínima': temp_min_manual, 'Temperatura maxima': temp_max_manual,
        'Pan comprado mañana': pan_comp_m, 'Pan comprado tarde': pan_comp_t,
        'Pan vendido mañana': pan_vend_m, 'Pan vendido tarde': pan_vend_t
    }

    if not df_existente.empty and 'Fecha' in df_existente.columns:
         df_existente['FechaOnly'] = pd.to_datetime(df_existente['Fecha']).dt.date
         indice_existente = df_existente[df_existente['FechaOnly'] == fecha_dt_ingresada].index
         df_existente.drop(columns=['FechaOnly'], inplace=True, errors='ignore') 
    else:
        indice_existente = pd.Index([])

    if not indice_existente.empty:
        print(f"Actualizando datos para {fecha_str}...")
        for col, val in nueva_fila_datos.items():
            df_existente.loc[indice_existente[0], col] = val
    else:
        print(f"Agregando nuevos datos para {fecha_str}...")
        nueva_fila_df = pd.DataFrame([nueva_fila_datos])
        df_existente = pd.concat([df_existente, nueva_fila_df], ignore_index=True)

    if 'Fecha' in df_existente.columns:
        df_existente['Fecha'] = pd.to_datetime(df_existente['Fecha']) 
        df_existente.sort_values(by='Fecha', inplace=True)
        df_existente['Fecha'] = df_existente['Fecha'].dt.strftime('%Y-%m-%d')
    try:
        df_existente.to_csv(ruta_csv, index=False)
        print(f"Datos guardados en '{ruta_csv}'.")
    except Exception as e:
        print(f"Error al guardar en CSV: {e}")

def ejecutar_prediccion():
    print("\n--- Ejecutar Predicción de Pan ---")
    df_panaderia = cargar_y_preparar_datos(RUTA_CSV_PANADERIA, entrenando=True)
    if df_panaderia is None or df_panaderia.empty or len(df_panaderia) < 2:
        print("No hay suficientes datos históricos. Agrega más datos.")
        return

    print("\n--- Entrenando Modelos ---")
    modelo_maniana, modelo_tarde, features_entrenamiento = entrenar_modelos(df_panaderia)
    if not (modelo_maniana and modelo_tarde):
        print("\nNo se pudieron entrenar los modelos.")
        return
        
    print("\n--- Modelos Entrenados Exitosamente ---")
    print("\n--- Realizando una Predicción ---")
    
    default_fecha_pred = (datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    while True:
        fecha_input_usuario = input(f"Fecha para predecir (YYYY-MM-DD, 'hoy', 'mañana', ej: {default_fecha_pred}): ").strip().lower()
        if not fecha_input_usuario: fecha_a_predecir_str = default_fecha_pred; break
        elif fecha_input_usuario == "hoy": fecha_a_predecir_str = datetime.date.today().strftime("%Y-%m-%d"); break
        elif fecha_input_usuario == "mañana": fecha_a_predecir_str = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d"); break
        else:
            try: datetime.datetime.strptime(fecha_input_usuario, "%Y-%m-%d"); fecha_a_predecir_str = fecha_input_usuario; break
            except ValueError: print("Formato de fecha no válido.")
    
    print(f"Prediciendo para la fecha: {fecha_a_predecir_str}")

    temp_min_pred, temp_max_pred, clima_num_pred = None, None, None
    pronostico_resultado = obtener_pronostico_api(fecha_a_predecir_str)

    if pronostico_resultado and pronostico_resultado != "manual":
        temp_min_api, temp_max_api, clima_num_api, desc_api = pronostico_resultado
        print(f"Clima obtenido de API para {fecha_a_predecir_str}: Temp Min: {temp_min_api}°C, Temp Max: {temp_max_api}°C, Clima: {MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num_api, 'Desconocido')} ({desc_api})")
        usar_api = input("¿Usar estos datos de la API para la predicción? (s/n): ").strip().lower()
        if usar_api == 's':
            temp_min_pred = temp_min_api
            temp_max_pred = temp_max_api
            clima_num_pred = clima_num_api
    
    if clima_num_pred is None: 
        print("Ingreso manual de datos de clima y temperatura:")
        clima_num_pred = obtener_clima_usuario_manual()
        if clima_num_pred == "SALIR_CLIMA":
            print("Predicción cancelada.")
            return 

        default_temp_min = 10.0
        default_temp_max = 20.0
        while True:
            try:
                temp_min_str = input(f"Temperatura mínima esperada (ej: {default_temp_min}, o 's' para cancelar): ").strip().lower()
                if temp_min_str == 's': print("Predicción cancelada."); return
                temp_min_pred = float(temp_min_str) if temp_min_str else default_temp_min

                temp_max_str = input(f"Temperatura máxima esperada (ej: {default_temp_max}, o 's' para cancelar): ").strip().lower()
                if temp_max_str == 's': print("Predicción cancelada."); return
                temp_max_pred = float(temp_max_str) if temp_max_str else default_temp_max

                if temp_min_pred > temp_max_pred: print("Temp mínima > máxima.")
                else: break
            except ValueError: print("Número inválido.")

    prediccion = predecir_pan_script(modelo_maniana, modelo_tarde, features_entrenamiento,
                              fecha_a_predecir_str, clima_num_pred, temp_min_pred, temp_max_pred)

    if prediccion and prediccion[0] is not None and prediccion[1] is not None:
        pan_maniana_kg, pan_tarde_kg = prediccion
        clima_texto_pred = MAPEO_CLIMA_NUMERO_A_TEXTO.get(clima_num_pred, "Desconocido")
        print(f"\n--- Estimación para el {fecha_a_predecir_str} ---")
        print(f"Clima: {clima_num_pred} ({clima_texto_pred.capitalize()}), Temp Min: {temp_min_pred}°C, Temp Max: {temp_max_pred}°C")
        print(f"Cantidad de pan estimada a comprar por la MAÑANA: {pan_maniana_kg} kg (enteros)")
        print(f"Cantidad de pan estimada a comprar por la TARDE:  {pan_tarde_kg} kg (enteros)")
    else:
        print(f"\nNo se pudo realizar la predicción para {fecha_a_predecir_str}.")

if __name__ == "__main__":
    if not list(clima_encoder_interno.classes_): 
        try: clima_encoder_interno.fit(list(MAPEO_CLIMA_TEXTO_A_NUMERO.values()))
        except Exception as e: print(f"Error crítico al ajustar clima_encoder_interno: {e}")

    while True:
        print("\n--- Menú Principal ---")
        print("1. Agregar o actualizar datos de un día")
        print("2. Predecir cantidad de pan")
        print("3. Salir")
        opcion = input("Selecciona una opción: ").strip()
        if opcion == '1': agregar_o_actualizar_dia(RUTA_CSV_PANADERIA)
        elif opcion == '2': ejecutar_prediccion()
        elif opcion == '3': print("Saliendo del programa."); break
        else: print("Opción no válida.")
