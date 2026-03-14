import sqlite3
import os
from datetime import datetime, date
import pandas as pd

class PanaderiaDB:
    def __init__(self, db_path="panaderia.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Inicializa la base de datos SQLite con la tabla necesaria"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
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
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
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
        conn = sqlite3.connect(self.db_path)
        
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
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                   pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde
            FROM registros_panaderia WHERE fecha = ?
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
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM registros_panaderia')
        count = cursor.fetchone()[0]
        
        conn.close()
        return count
    
    def migrar_csv_a_sqlite(self, csv_path):
        """Migra datos del CSV existente a SQLite"""
        if not os.path.exists(csv_path):
            print(f"Archivo CSV {csv_path} no encontrado")
            return False
        
        try:
            df = pd.read_csv(csv_path)
            
            # Renombrar columnas si es necesario
            column_mapping = {
                'Fecha': 'fecha',
                'Clima promedio': 'clima_promedio',
                'Temperatura mínima': 'temperatura_minima',
                'Temperatura maxima': 'temperatura_maxima',
                'Pan comprado mañana': 'pan_comprado_maniana',
                'Pan comprado tarde': 'pan_comprado_tarde',
                'Pan vendido mañana': 'pan_vendido_maniana',
                'Pan vendido tarde': 'pan_vendido_tarde'
            }
            
            # Aplicar mapeo de columnas
            df = df.rename(columns=column_mapping)
            
            # Convertir fecha a formato YYYY-MM-DD
            df['fecha'] = pd.to_datetime(df['fecha']).dt.strftime('%Y-%m-%d')
            
            # Insertar cada registro
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for _, row in df.iterrows():
                if pd.notna(row['fecha']) and pd.notna(row['clima_promedio']):
                    cursor.execute('''
                        INSERT OR REPLACE INTO registros_panaderia 
                        (fecha, clima_promedio, temperatura_minima, temperatura_maxima,
                         pan_comprado_maniana, pan_comprado_tarde, pan_vendido_maniana, pan_vendido_tarde)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (row['fecha'], row['clima_promedio'], 
                          row['temperatura_minima'], row['temperatura_maxima'],
                          int(row['pan_comprado_maniana']), int(row['pan_comprado_tarde']),
                          int(row['pan_vendido_maniana']), int(row['pan_vendido_tarde'])))
            
            conn.commit()
            conn.close()
            
            print(f"Migrados {len(df)} registros del CSV a SQLite")
            return True
            
        except Exception as e:
            print(f"Error migrando CSV: {e}")
            return False
