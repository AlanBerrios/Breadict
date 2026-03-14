import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Card, Button, Title, TextInput, Switch, Divider } from 'react-native-paper';
import { useSettings } from '../context/SettingsContext';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

const ConfiguracionScreen = () => {
  const { 
    storeName, 
    themeMode, 
    autoPredict, 
    limitMorning, 
    limitAfternoon,
    location,
    updateStoreName, 
    updateThemeMode, 
    updateAutoPredict,
    updateLimits,
    updateLocation
  } = useSettings();
  
  const navigation = useNavigation();

  const [tempStoreName, setTempStoreName] = useState(storeName);
  const [isDark, setIsDark] = useState(themeMode === 'dark');
  const [isAuto, setIsAuto] = useState(autoPredict);
  
  const [tempLimitM, setTempLimitM] = useState(limitMorning ? limitMorning.toString() : '8');
  const [tempLimitA, setTempLimitA] = useState(limitAfternoon ? limitAfternoon.toString() : '14');
  const [tempLocation, setTempLocation] = useState(location);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Sync state if context changes externally
  useEffect(() => {
    setTempStoreName(storeName);
    setIsDark(themeMode === 'dark');
    setIsAuto(autoPredict);
    setTempLimitM(limitMorning ? limitMorning.toString() : '8');
    setTempLimitA(limitAfternoon ? limitAfternoon.toString() : '14');
    setTempLocation(location);
  }, [storeName, themeMode, autoPredict, limitMorning, limitAfternoon, location]);

  const saveSettings = async (showFeedback = true) => {
    try {
      if (!tempStoreName.trim()) {
        if (showFeedback) Alert.alert('Error', 'El nombre de la panadería no puede estar vacío.');
        return false;
      }
      
      let lm = parseInt(tempLimitM);
      let la = parseInt(tempLimitA);
      
      if (isNaN(lm) || isNaN(la) || lm < 0 || lm > 23 || la < 0 || la > 23) {
        if (showFeedback) Alert.alert('Error', 'Las horas límite deben ser números válidos entre 0 y 23.');
        return false;
      }
      
      if (lm >= la) {
        if (showFeedback) Alert.alert('Error', 'La hora de la mañana debe ser menor a la hora de la tarde.');
        return false;
      }

      if (!tempLocation) {
        if (showFeedback) Alert.alert('Error', 'Debes configurar tu ubicación GPS.');
        return false;
      }

      await updateStoreName(tempStoreName);
      await updateThemeMode(isDark ? 'dark' : 'light');
      await updateAutoPredict(isAuto);
      await updateLimits(lm, la);
      await updateLocation(tempLocation);
      
      return true;
    } catch (e) {
      if (showFeedback) Alert.alert('Error', 'Ocurrió un problema guardando las preferencias.');
      return false;
    }
  };

  // Auto-save on blur (navigating away)
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      saveSettings(false); // Silent save
    });
    return unsubscribe;
  }, [navigation, tempStoreName, isDark, isAuto, tempLimitM, tempLimitA, tempLocation]);

  const handleSave = async () => {
    const success = await saveSettings(true);
    if (success) {
      Alert.alert(
        'Guardado', 
        'Las preferencias se han guardado exitosamente.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleGetLocation = async () => {
    setFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la ubicación para esta función.');
        setFetchingLocation(false);
        return;
      }
      let currentLoc = await Location.getCurrentPositionAsync({});
      
      let reverse = await Location.reverseGeocodeAsync({
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude
      });
      let cityName = 'Desconocido';
      if (reverse && reverse.length > 0) {
        cityName = reverse[0].city || reverse[0].subregion || reverse[0].region || 'Desconocido';
      }

      const newLoc = {
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
        city: cityName
      };
      
      setTempLocation(newLoc);
      // Auto-save location immediately to context/storage
      await updateLocation(newLoc);
      
      Alert.alert('Éxito', `Coordenadas GPS obtenidas: ${cityName}.`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo obtener la ubicación GPS.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const isDarkMode = isDark;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#F5F5F5',
    },
    card: {
      margin: 15,
      elevation: 4,
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    },
    cardTitle: {
      fontSize: 18,
      marginBottom: 15,
      color: isDarkMode ? '#81C784' : '#2E7D32',
    },
    input: {
      marginBottom: 15,
      backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF',
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333333' : '#E0E0E0',
    },
    settingRowNoBorder: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
    },
    settingTextContainer: {
      flex: 1,
      paddingRight: 10,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDarkMode ? '#FFFFFF' : '#333333',
    },
    settingDescription: {
      fontSize: 12,
      color: isDarkMode ? '#AAAAAA' : '#666666',
      marginTop: 2,
    },
    buttonContainer: {
      padding: 15,
      paddingBottom: 80, // Added padding for device navigation bars
    },
    saveButton: {
      backgroundColor: isDarkMode ? '#388E3C' : '#2E7D32',
    },
    hoursContainer: {
      marginTop: 15,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#333333' : '#E0E0E0',
    },
    rowInputs: {
      flexDirection: 'row',
      justifyContent: 'space-between'
    },
    halfInput: {
      width: '48%',
      backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF',
    }
  });

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Personalización</Title>
          
          <TextInput
            label="Nombre de la Panadería/Almacén"
            value={tempStoreName}
            onChangeText={setTempStoreName}
            mode="outlined"
            style={styles.input}
            textColor={isDarkMode ? '#FFFFFF' : '#000000'}
            theme={{ 
              colors: { 
                primary: isDarkMode ? '#81C784' : '#2E7D32',
                placeholder: isDarkMode ? '#AAAAAA' : '#666666',
                text: isDarkMode ? '#FFFFFF' : '#000000',
              }
            }}
          />

          <View style={styles.settingRowNoBorder}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Modo Oscuro</Text>
              <Text style={styles.settingDescription}>
                Cambiar el tema visual de la aplicación.
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={setIsDark}
              color={isDarkMode ? '#81C784' : '#2E7D32'}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Ubicación del Clima</Title>
          <Text style={[styles.settingDescription, { marginBottom: 15 }]}>
            Para obtener el pronóstico exacto de tu local, permite el acceso a tu ubicación GPS.
          </Text>
          
          <Button 
            icon="map-marker" 
            mode="contained-tonal" 
            loading={fetchingLocation}
            onPress={handleGetLocation}
            buttonColor={isDarkMode ? '#388E3C' : '#E8F5E8'}
            textColor={isDarkMode ? '#FFF' : '#2E7D32'}
            style={{ marginBottom: 10 }}
          >
            Obtener Ubicación GPS
          </Button>

          {tempLocation && (
            <Text style={[styles.settingDescription, { color: isDarkMode ? '#81C784' : '#2E7D32', fontWeight: 'bold' }]}>
              ✓ Coordenadas registradas automáticamente
            </Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Automatización</Title>
          
          <View style={isAuto ? styles.settingRow : styles.settingRowNoBorder}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Predicción Automática</Text>
              <Text style={styles.settingDescription}>
                Obtiene el clima y predice compras automáticamente basado en la hora del día.
              </Text>
            </View>
            <Switch
              value={isAuto}
              onValueChange={setIsAuto}
              color={isDarkMode ? '#81C784' : '#2E7D32'}
            />
          </View>

          {isAuto && (
            <View style={styles.hoursContainer}>
              <Text style={[styles.settingTitle, { marginBottom: 10 }]}>Horarios de Predicción</Text>
              <Text style={[styles.settingDescription, { marginBottom: 15 }]}>
                Antes de la hora de la mañana, predecirá todo hoy. Pasando la hora de la tarde, predecirá para mañana.
              </Text>
              
              <View style={styles.rowInputs}>
                <TextInput
                  label="Límite Mañana (Ej: 8)"
                  value={tempLimitM}
                  onChangeText={setTempLimitM}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.halfInput}
                  textColor={isDarkMode ? '#FFFFFF' : '#000000'}
                  theme={{ 
                    colors: { 
                      primary: isDarkMode ? '#81C784' : '#2E7D32',
                      placeholder: isDarkMode ? '#AAAAAA' : '#666666',
                    }
                  }}
                />
                
                <TextInput
                  label="Límite Tarde (Ej: 14)"
                  value={tempLimitA}
                  onChangeText={setTempLimitA}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.halfInput}
                  textColor={isDarkMode ? '#FFFFFF' : '#000000'}
                  theme={{ 
                    colors: { 
                      primary: isDarkMode ? '#81C784' : '#2E7D32',
                      placeholder: isDarkMode ? '#AAAAAA' : '#666666',
                    }
                  }}
                />
              </View>
            </View>
          )}

        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
        >
          Guardar Cambios
        </Button>
      </View>
    </ScrollView>
  );
};

export default ConfiguracionScreen;
