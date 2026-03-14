import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Card, Button, Title, TextInput, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/apiService';
import { CLIMA_OPTIONS } from '../config/api';
import { format } from 'date-fns';
import { useSettings } from '../context/SettingsContext';

const RegistroScreen = () => {
  const navigation = useNavigation();
  const { themeMode, location } = useSettings();
  const isDarkMode = themeMode === 'dark';
  
  const [loading, setLoading] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [showWeatherForm, setShowWeatherForm] = useState(true);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    clima_promedio: '',
    temperatura_minima: '',
    temperatura_maxima: '',
    pan_comprado_maniana: '',
    pan_comprado_tarde: '',
    pan_vendido_maniana: '',
    pan_vendido_tarde: ''
  });

  // Estado de errores
  const [errors, setErrors] = useState({});

  // Actualizar campo del formulario
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando se modifica
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.fecha) newErrors.fecha = 'La fecha es requerida';
    if (!formData.clima_promedio) newErrors.clima_promedio = 'Selecciona un clima';
    if (!formData.temperatura_minima || formData.temperatura_minima <= 0) newErrors.temperatura_minima = 'Temperatura mínima inválida';
    if (!formData.temperatura_maxima || formData.temperatura_maxima <= 0) newErrors.temperatura_maxima = 'Temperatura máxima inválida';

    if (parseFloat(formData.temperatura_minima) > parseFloat(formData.temperatura_maxima)) {
      newErrors.temperatura_maxima = 'La temperatura máxima debe ser mayor o igual que la mínima';
    }

    ['pan_comprado_maniana', 'pan_comprado_tarde', 'pan_vendido_maniana', 'pan_vendido_tarde'].forEach(field => {
      if (!formData[field] || formData[field] < 0) {
        newErrors[field] = 'El valor debe ser mayor o igual a 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Auto-completar Clima
  const handleAutoClima = async () => {
    setFetchingWeather(true);
    try {
      // Pedimos predicción al servidor sin datos manuales para forzar lectura API
      const response = await apiService.obtenerPrediccion(formData.fecha, location, null);
      
      // La API nos devuelve clima_texto.
      let climaVal = 'soleado';
      if (response.clima_texto) {
         climaVal = response.clima_texto.toLowerCase();
      }
      
      setFormData(prev => ({
        ...prev,
        clima_promedio: climaVal, // Usar directamente el string ('soleado', 'nublado', etc)
        temperatura_minima: String(response.temperatura_minima),
        temperatura_maxima: String(response.temperatura_maxima),
      }));
      
      setShowWeatherForm(false); // Ocultar formulario al obtener con éxito
      
    } catch (e) {
      Alert.alert('Error API de Clima', 'No se pudo obtener el clima automático. Por favor, ingrésalo manualmente.');
      setShowWeatherForm(true); // Forzar mostrar el form si hubo error
    } finally {
      setFetchingWeather(false);
    }
  };

  // Enviar formulario
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Por favor corrige los errores en el formulario');
      return;
    }

    setLoading(true);
    try {
      const datosParaEnviar = {
        ...formData,
        temperatura_minima: parseFloat(formData.temperatura_minima),
        temperatura_maxima: parseFloat(formData.temperatura_maxima),
        pan_comprado_maniana: parseInt(formData.pan_comprado_maniana),
        pan_comprado_tarde: parseInt(formData.pan_comprado_tarde),
        pan_vendido_maniana: parseInt(formData.pan_vendido_maniana),
        pan_vendido_tarde: parseInt(formData.pan_vendido_tarde)
      };

      await apiService.registrarDatos(datosParaEnviar);
      
      Alert.alert(
        'Éxito',
        'Datos registrados correctamente. El modelo se ha actualizado.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#81C784' : '#2E7D32'} />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#AAAAAA' : '#666' }]}>Registrando datos...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' },
    card: { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' },
    text: { color: isDarkMode ? '#FFFFFF' : '#333333' },
    subText: { color: isDarkMode ? '#AAAAAA' : '#666666' },
    input: { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF' }
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={{ paddingBottom: 80 }}>
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={dynamicStyles.text}>Registrar Ventas del Día</Title>
          <Text style={dynamicStyles.subText}>
            Ingresa los datos reales de ventas para mejorar las predicciones
          </Text>
        </Card.Content>
      </Card>

      {/* Información del Día */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={styles.cardTitle}>Información del Día</Title>
          
          <TextInput
            label="Fecha"
            value={formData.fecha}
            onChangeText={(value) => updateField('fecha', value)}
            mode="outlined"
            style={[styles.input, dynamicStyles.input]}
            editable={false}
            textColor={dynamicStyles.text.color}
            theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
          />
          <HelperText type="error" visible={!!errors.fecha}>{errors.fecha}</HelperText>

          <Button 
            icon="weather-partly-cloudy" 
            mode="contained-tonal" 
            loading={fetchingWeather}
            onPress={handleAutoClima}
            buttonColor={isDarkMode ? '#388E3C' : '#E8F5E8'}
            textColor={isDarkMode ? '#FFF' : '#2E7D32'}
            style={{ marginBottom: 15 }}
          >
            Obtener Clima Automático
          </Button>

          {showWeatherForm ? (
            <>
              <Text style={[styles.label, dynamicStyles.text]}>Clima del Día:</Text>
              <View style={styles.climaContainer}>
                {CLIMA_OPTIONS.map((opcion) => (
                  <Button
                    key={opcion.value}
                    mode={formData.clima_promedio === opcion.value ? "contained" : "outlined"}
                    onPress={() => updateField('clima_promedio', opcion.value)}
                    style={styles.climaButton}
                    buttonColor={formData.clima_promedio === opcion.value ? (isDarkMode ? '#388E3C' : '#2E7D32') : undefined}
                    textColor={formData.clima_promedio === opcion.value ? '#FFF' : (isDarkMode ? '#81C784' : '#2E7D32')}
                    theme={{ colors: { outline: isDarkMode ? '#81C784' : '#2E7D32' } }}
                    compact
                  >
                    {opcion.label}
                  </Button>
                ))}
              </View>
              <HelperText type="error" visible={!!errors.clima_promedio}>{errors.clima_promedio}</HelperText>

              <TextInput
                label="Temperatura Mínima (°C)"
                value={formData.temperatura_minima}
                onChangeText={(value) => updateField('temperatura_minima', value)}
                mode="outlined"
                style={[styles.input, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.temperatura_minima}>{errors.temperatura_minima}</HelperText>

              <TextInput
                label="Temperatura Máxima (°C)"
                value={formData.temperatura_maxima}
                onChangeText={(value) => updateField('temperatura_maxima', value)}
                mode="outlined"
                style={[styles.input, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.temperatura_maxima}>{errors.temperatura_maxima}</HelperText>
            </>
          ) : (
            <View style={[styles.weatherSummary, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F9F9F9', borderColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
              <Text style={[styles.summaryText, dynamicStyles.text]}>
                🌤️ {CLIMA_OPTIONS.find(c => c.value === formData.clima_promedio)?.label || 'Desconocido'}
              </Text>
              <Text style={[styles.summaryText, dynamicStyles.subText]}>
                🌡️ Min: {formData.temperatura_minima}°C - Max: {formData.temperatura_maxima}°C
              </Text>
              
              <Button mode="text" onPress={() => setShowWeatherForm(true)} textColor={isDarkMode ? '#81C784' : '#2E7D32'}>
                Editar Manualmente
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Datos de Compras */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={styles.cardTitle}>Pan Comprado (kg)</Title>
          <View style={styles.rowInputs}>
            <TextInput
              label="Mañana (kg)"
              value={formData.pan_comprado_maniana}
              onChangeText={(value) => updateField('pan_comprado_maniana', value)}
              mode="outlined"
              style={[styles.halfInput, dynamicStyles.input]}
              keyboardType="numeric"
              textColor={dynamicStyles.text.color}
              theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
            />
            <TextInput
              label="Tarde (kg)"
              value={formData.pan_comprado_tarde}
              onChangeText={(value) => updateField('pan_comprado_tarde', value)}
              mode="outlined"
              style={[styles.halfInput, dynamicStyles.input]}
              keyboardType="numeric"
              textColor={dynamicStyles.text.color}
              theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
            />
          </View>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <HelperText type="error" visible={!!errors.pan_comprado_maniana} style={{width: '48%'}}>{errors.pan_comprado_maniana}</HelperText>
            <HelperText type="error" visible={!!errors.pan_comprado_tarde} style={{width: '48%'}}>{errors.pan_comprado_tarde}</HelperText>
          </View>
        </Card.Content>
      </Card>

      {/* Datos de Ventas */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={styles.cardTitle}>Pan Vendido (kg)</Title>
          <View style={styles.rowInputs}>
            <TextInput
              label="Mañana (kg)"
              value={formData.pan_vendido_maniana}
              onChangeText={(value) => updateField('pan_vendido_maniana', value)}
              mode="outlined"
              style={[styles.halfInput, dynamicStyles.input]}
              keyboardType="numeric"
              textColor={dynamicStyles.text.color}
              theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
            />
            <TextInput
              label="Tarde (kg)"
              value={formData.pan_vendido_tarde}
              onChangeText={(value) => updateField('pan_vendido_tarde', value)}
              mode="outlined"
              style={[styles.halfInput, dynamicStyles.input]}
              keyboardType="numeric"
              textColor={dynamicStyles.text.color}
              theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
            />
          </View>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <HelperText type="error" visible={!!errors.pan_vendido_maniana} style={{width: '48%'}}>{errors.pan_vendido_maniana}</HelperText>
            <HelperText type="error" visible={!!errors.pan_vendido_tarde} style={{width: '48%'}}>{errors.pan_vendido_tarde}</HelperText>
          </View>
        </Card.Content>
      </Card>

      {/* Botones de Acción */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={[styles.submitButton, { backgroundColor: isDarkMode ? '#388E3C' : '#2E7D32' }]}
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Registrar Datos'}
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
          textColor={isDarkMode ? '#81C784' : '#2E7D32'}
          theme={{ colors: { outline: isDarkMode ? '#81C784' : '#2E7D32' } }}
        >
          Cancelar
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  card: { margin: 15, elevation: 4 },
  cardTitle: { fontSize: 18, marginBottom: 15, color: '#4CAF50' },
  input: { marginBottom: 5 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  climaContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  climaButton: { marginRight: 8, marginBottom: 8 },
  buttonContainer: { padding: 15 },
  submitButton: { marginBottom: 10 },
  cancelButton: { borderWidth: 1 },
  weatherSummary: { padding: 15, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginTop: 10 },
  summaryText: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%', marginBottom: 5 }
});

export default RegistroScreen;
