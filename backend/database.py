import os
import sqlite3
import traceback
import psycopg2
from psycopg2 import pool
from datetime import datetime, date
import pandas as pd

class PanaderiaDB:
    def __init__(self, db_path="panaderia.db"):
        self.db_path = db_path
        self.connection_string = os.getenv("DATABASE_URL")
        self.is_postgres = False
        
        if self.connection_string:
            # Asegurar que tenga sslmode para Supabase
            if "sslmode" not in self.connection_string:
                sep = "&" if "?" in self.connection_string else "?"
                self.connection_string += f"{sep}sslmode=require"
            
            # Intentar conectar a Postgres
            try:
                test_conn = psycopg2.connect(self.connection_string)
                test_conn.close()
                self.is_postgres = True
                print("[DB Backend] ✅ Conexión a PostgreSQL (Supabase/Cloud) exitosa")
            except Exception as e:
                print(f"[DB Backend] ⚠️ No se pudo conectar a PostgreSQL: {e}")
                print("[DB Backend] Usando SQLite (Local) como respaldo")
                self.is_postgres = False
        else:
            print("[DB Backend] Usando SQLite (Local)")
            
        self.init_database()
    
    def get_connection(self):
        """Retorna una conexión activa (Postgres o SQLite)"""
        if self.is_postgres:
            return psycopg2.connect(self.connection_string)
        else:
            return sqlite3.connect(self.db_path)

    def init_database(self):
        """Inicializa la base de datos con la tabla necesaria"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Sintaxis compatible con ambos (Postgres usa SERIAL, SQLite AUTOINCREMENT)
        if self.is_postgres:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS registros_panaderia (
                    id SERIAL PRIMARY KEY,
                    fecha DATE UNIQUE NOT NULL,
                    clima_promedio TEXT NOT NULL,
                    temperatura_minima REAL NOT NULL,
                    temperatura_maxima REAL NOT NULL,
                    pan_comprado_maniana INTEGER NOT NULL,
                    pan_comprado_tarde INTEGER NOT NULL,
                    pan_vendido_maniana INTEGER NOT NULL,
                    pan_vendido_tarde INTEGER NOT NULL,
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS registros_panaderia (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha DATE UNIQUE NOT NULL,
                    clima_promedio TEXT NOT NULL,
                    temperatura_minima REAL NOT NULL,
                    temperatura_maxima REAL NOT NULL,
                    pan_comprado_maniana INTEGER NOT NULL,
                    pan_comprado_tarde INTEGER NOT NULL,
                    pan_vendido_maniana INTEGER NOT NULL,
                    pan_vendido_tarde INTEGER NOT NULL,
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        conn.commit()
        conn.close()
    
    def insertar_registro(self, fecha, clima_promedio, temp_min, temp_max, 
                         pan_comp_man, pan_comp_tar, pan_vend_man, pan_vend_tar):
        """Inserta o actualiza un registro de panadería"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.is_postgres:
            cursor.execute('''
                INSERT INTO registros_panaderia 
                (fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                 pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (fecha) DO UPDATE SET
                    clima_promedio = EXCLUDED.clima_promedio,
                    temperatura_minima = EXCLUDED.temperatura_minima,
                    temperatura_maxima = EXCLUDED.temperatura_maxima,
                    pan_comprado_maniana = EXCLUDED.pan_comprado_maniana,
                    pan_comprado_tarde = EXCLUDED.pan_comprado_tarde,
                    pan_vendido_maniana = EXCLUDED.pan_vendido_maniana,
                    pan_vendido_tarde = EXCLUDED.pan_vendido_tarde
            ''', (fecha, clima_promedio, temp_min, temp_max, 
                  pan_comp_man, pan_comp_tar, pan_vend_man, pan_vend_tar))
        else:
            cursor.execute('''
                INSERT OR REPLACE INTO registros_panaderia 
                (fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                 pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (fecha, clima_promedio, temp_min, temp_max, 
                  pan_comp_man, pan_comp_tar, pan_vend_man, pan_vend_tar))
        
        conn.commit()
        conn.close()
    
    def obtener_todos_los_datos(self):
        """Retorna todos los datos como DataFrame de pandas"""
        conn = self.get_connection()
        
        query = '''
            SELECT fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                   pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde
            FROM registros_panaderia 
            ORDER BY fecha
        '''
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        return df
    
    def obtener_registro_fecha(self, fecha):
        """Obtiene un registro específico por fecha"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        ph = "%s" if self.is_postgres else "?"
        cursor.execute(f'''
            SELECT fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                   pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde
            FROM registros_panaderia WHERE fecha = {ph}
        ''', (fecha,))
        
        resultado = cursor.fetchone()
        conn.close()
        
        if resultado:
            return {
                'fecha': resultado[0],
                'clima_promedio': resultado[1],
                'temperatura_minima': resultado[2],
                'temperatura_maxima': resultado[3],
                'pan_comprado_maniana': resultado[4],
                'pan_comprado_tarde': resultado[5],
                'pan_vendido_maniana': resultado[6],
                'pan_vendido_tarde': resultado[7]
            }
        return None
    
    def contar_registros(self):
        """Cuenta cuántos registros hay en la base de datos"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM registros_panaderia')
        count = cursor.fetchone()[0]
        
        conn.close()
        return count
    
    def migrar_csv(self, csv_path):
        """Migra datos del CSV existente a la base de datos (solo si está vacía)"""
        if not os.path.exists(csv_path):
            print(f"[DB Backend] Archivo CSV {csv_path} no encontrado.")
            return False
        
        # Verificar si ya hay datos para evitar duplicar migración pesada en cada reinicio
        try:
            if self.contar_registros() > 0:
                print("[DB Backend] La base de datos ya tiene información. Saltando migración inicial.")
                return True
        except:
            pass

        print(f"[DB Backend] Iniciando migración desde: {csv_path}")
        try:
            df = pd.read_csv(csv_path)
            column_mapping = {
                'Fecha': 'fecha', 'Clima promedio': 'clima_promedio',
                'Temperatura mínima': 'temperatura_minima', 'Temperatura maxima': 'temperatura_maxima',
                'Pan comprado mañana': 'pan_comprado_maniana', 'Pan comprado tarde': 'pan_comprado_tarde',
                'Pan vendido mañana': 'pan_vendido_maniana', 'Pan vendido tarde': 'pan_vendido_tarde'
            }
            df = df.rename(columns=column_mapping)
            df['fecha'] = pd.to_datetime(df['fecha']).dt.strftime('%Y-%m-%d')
            
            conn = self.get_connection()
            cursor = conn.cursor()
            
            db_type = "PostgreSQL" if self.is_postgres else "SQLite"
            ph = "%s" if self.is_postgres else "?"
            
            for _, row in df.iterrows():
                if pd.notna(row['fecha']):
                    # Inserción directa en un solo loop para ahorrar conexiones
                    if self.is_postgres:
                        cursor.execute('''
                            INSERT INTO registros_panaderia 
                            (fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                             pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (fecha) DO NOTHING
                        ''', (row['fecha'], row['clima_promedio'], row['temperatura_minima'], row['temperatura_maxima'],
                              int(row['pan_comprado_maniana']), int(row['pan_comprado_tarde']),
                              int(row['pan_vendido_maniana']), int(row['pan_vendido_tarde'])))
                    else:
                        cursor.execute('''
                            INSERT OR IGNORE INTO registros_panaderia 
                            (fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                             pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (row['fecha'], row['clima_promedio'], row['temperatura_minima'], row['temperatura_maxima'],
                              int(row['pan_comprado_maniana']), int(row['pan_comprado_tarde']),
                              int(row['pan_vendido_maniana']), int(row['pan_vendido_tarde'])))
            
            conn.commit()
            conn.close()
            
            print(f"[DB Backend] Migrados {len(df)} registros a {db_type} correctamente.")
            return True
            
        except Exception as e:
            print(f"[DB Backend] ERROR migrando CSV: {e}")
            return False
