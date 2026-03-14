# 🍞 Breadict (v1.0)

**Breadict** (un juego de palabras entre *Bread* y *Predict*) es una aplicación móvil inteligente diseñada para ayudar a panaderías, almacenes y puntos de venta de productos perecederos a optimizar su stock diario mediante el poder del **Machine Learning**.

El objetivo principal de la app es predecir con precisión cuántos kilos de pan se venderán mañana o durante el día actual, permitiendo a los dueños comprar o producir lo justo, reduciendo el desperdicio y garantizando que nunca falte pan fresco para los clientes.

---

## ✨ Características Principales

- **📊 Predicción con IA**: Utiliza un modelo de **Random Forest Regressor** que analiza tendencias históricas para predecir la demanda de mañana y tarde.
- **🌡️ Integración de Clima GPS**: Sincronización automática con la API de **OpenWeatherMap** utilizando las coordenadas exactas de tu negocio para obtener temperaturas (Mín/Máx) y condiciones meteorológicas reales.
- **🔄 Aprendizaje Continuo**: Un sistema de registro de ventas diarias que retroalimenta el modelo, haciendo que las predicciones sean cada vez más precisas con el uso.
- **🕒 Automatización Inteligente**: La app detecta la hora actual para alternar automáticamente entre predecir el día actual o preparar la compra del día siguiente.
- **📱 Interfaz Moderna y Adaptativa**: Soporte nativo para Modo Oscuro, diseño optimizado para evitar solapamientos con botones del sistema y tutorial interactivo de bienvenida.

---

## 🛠️ Stack Tecnológico

### **Frontend (Mobile)**
- **React Native + Expo SDK 54**
- **React Native Paper** (Material Design)
- **Expo Location** (Geolocalización por coordenadas)
- **AsyncStorage** (Persistencia de configuración local)

### **Backend (API)**
- **Flask (Python)**
- **Scikit-Learn** (Modelo de Machine Learning)
- **SQLite** (Base de datos relacional para registros de ventas)
- **Pandas/Numpy** (Procesamiento de datos)

---

## 🚀 Cómo empezar

1. **Backend**: Instala las dependencias en `backend/requirements.txt` e inicia `app_flask.py` en tu servidor.
2. **Mobile**: Corre `npm install` y luego `npx expo start -c` para iniciar el bundler conectado a la URL de tu API.
3. **Configuración**: En la app móvil, activa el GPS desde el menú de Configuración para sincronizar el clima de tu ubicación.

---

*Desarrollado para optimizar el pan nuestro de cada día.* 🥖✨
