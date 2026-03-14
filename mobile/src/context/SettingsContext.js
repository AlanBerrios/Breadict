import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [storeName, setStoreName] = useState('Breadict');
  const [themeMode, setThemeMode] = useState('light'); // 'light' | 'dark'
  const [autoPredict, setAutoPredict] = useState(true);
  
  // Nuevos límites de hora
  const [limitMorning, setLimitMorning] = useState(8);
  const [limitAfternoon, setLimitAfternoon] = useState(14);
  
  // Ubicación para el pronóstico del clima (GPS object: {latitude, longitude})
  const [location, setLocation] = useState(null);
  
  // Estado del tutorial de bienvenida
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true); // Default true until loaded
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedName = await AsyncStorage.getItem('@store_name');
      const storedTheme = await AsyncStorage.getItem('@theme_mode');
      const storedAuto = await AsyncStorage.getItem('@auto_predict');
      const storedLimitM = await AsyncStorage.getItem('@limit_morning');
      const storedLimitA = await AsyncStorage.getItem('@limit_afternoon');
      const storedLocation = await AsyncStorage.getItem('@location');
      const storedTutorial = await AsyncStorage.getItem('@has_seen_tutorial');

      if (storedName) setStoreName(storedName);
      if (storedTheme) setThemeMode(storedTheme);
      if (storedAuto !== null) setAutoPredict(JSON.parse(storedAuto));
      if (storedLimitM) setLimitMorning(parseInt(storedLimitM, 10));
      if (storedLimitA) setLimitAfternoon(parseInt(storedLimitA, 10));
      if (storedLocation) {
        try {
          setLocation(JSON.parse(storedLocation));
        } catch (parseError) {
          // Fallback para strings antiguos de versión anterior (ej: "Santiago,CL")
          setLocation({ latitude: null, longitude: null, city: storedLocation });
        }
      }
      
      if (storedTutorial !== null) {
        setHasSeenTutorial(JSON.parse(storedTutorial));
      } else {
        setHasSeenTutorial(false); // Si no existe, es que no lo ha visto
      }
      
    } catch (e) {
      console.log('Error loading settings', e);
    } finally {
      setLoading(false);
    }
  };

  const updateStoreName = async (newName) => {
    setStoreName(newName);
    await AsyncStorage.setItem('@store_name', newName);
  };

  const updateThemeMode = async (newTheme) => {
    setThemeMode(newTheme);
    await AsyncStorage.setItem('@theme_mode', newTheme);
  };

  const updateAutoPredict = async (value) => {
    setAutoPredict(value);
    await AsyncStorage.setItem('@auto_predict', JSON.stringify(value));
  };

  const updateLimits = async (morning, afternoon) => {
    setLimitMorning(morning);
    setLimitAfternoon(afternoon);
    await AsyncStorage.setItem('@limit_morning', morning.toString());
    await AsyncStorage.setItem('@limit_afternoon', afternoon.toString());
  };

  const updateLocation = async (newLocation) => {
    setLocation(newLocation);
    await AsyncStorage.setItem('@location', JSON.stringify(newLocation));
  };

  const updateHasSeenTutorial = async (value) => {
    setHasSeenTutorial(value);
    await AsyncStorage.setItem('@has_seen_tutorial', JSON.stringify(value));
  };

  const value = {
    storeName,
    themeMode,
    autoPredict,
    limitMorning,
    limitAfternoon,
    location,
    hasSeenTutorial,
    updateStoreName,
    updateThemeMode,
    updateAutoPredict,
    updateLimits,
    updateLocation,
    updateHasSeenTutorial,
    loading
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
