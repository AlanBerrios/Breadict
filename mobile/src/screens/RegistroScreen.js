import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { Card, Button, Title, TextInput, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/apiService';
import { CLIMA_OPTIONS } from '../config/api';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { useSettings } from '../context/SettingsContext';
import AppFooter from '../components/AppFooter';

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
    pan_vendido_tarde: '',
    clientes_sin_pan: '',
    hora_quiebre: ''
  });

  // Estado de errores
  const [errors, setErrors] = useState({});

  // Auto-fetch clima al montar
  useEffect(() => {
    handleAutoClima(true);
  }, []);

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
    const minTemp = parseFloat(formData.temperatura_minima);
    const maxTemp = parseFloat(formData.temperatura_maxima);

    if (formData.temperatura_minima === '' || isNaN(minTemp)) newErrors.temperatura_minima = 'Debe ser un número válido';
    if (formData.temperatura_maxima === '' || isNaN(maxTemp)) newErrors.temperatura_maxima = 'Debe ser un número válido';

    if (!newErrors.temperatura_minima && !newErrors.temperatura_maxima && minTemp > maxTemp) {
      newErrors.temperatura_maxima = 'La máxima debe ser mayor o igual a la mínima';
    }

    ['pan_comprado_maniana', 'pan_comprado_tarde', 'pan_vendido_maniana', 'pan_vendido_tarde'].forEach(field => {
      if (!formData[field] || formData[field] < 0) {
        newErrors[field] = 'El valor debe ser mayor o igual a 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navegar fecha
  const changeDate = (direction) => {
    const currentDate = parseISO(formData.fecha);
    const newDate = direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1);
    const today = new Date();
    // No permitir fechas futuras más allá de hoy
    if (newDate > today) {
      Alert.alert('Aviso', 'No puedes registrar ventas de un día futuro.');
      return;
    }
    const newFechaStr = format(newDate, 'yyyy-MM-dd');
    setFormData(prev => ({
      ...prev,
      fecha: newFechaStr,
      clima_promedio: '',
      temperatura_minima: '',
      temperatura_maxima: '',
      clientes_sin_pan: '',
      hora_quiebre: ''
    }));
    setShowWeatherForm(true);
    // Auto-fetch weather for new date
    setTimeout(() => handleAutoClimaForDate(newFechaStr), 100);
  };

  // Auto-fetch for a specific date (called by changeDate)
  const handleAutoClimaForDate = async (fechaStr) => {
    setFetchingWeather(true);
    try {
      const response = await apiService.obtenerPrediccion(fechaStr, location, null);
      let climaVal = '';
      let tempMin = null;
      let tempMax = null;
      
      if (response.clima_texto) climaVal = response.clima_texto.toLowerCase();
      if (response.temperatura_minima != null) tempMin = response.temperatura_minima;
      if (response.temperatura_maxima != null) tempMax = response.temperatura_maxima;
      
      if (climaVal && tempMin != null) {
        setFormData(prev => ({
          ...prev,
          fecha: fechaStr,
          clima_promedio: climaVal,
          temperatura_minima: String(tempMin),
          temperatura_maxima: String(tempMax),
        }));
        setShowWeatherForm(false);
      } else {
        setShowWeatherForm(true);
      }
    } catch (e) {
      setShowWeatherForm(true);
    } finally {
      setFetchingWeather(false);
    }
  };

  // Auto-completar Clima
  const handleAutoClima = async (silent = false) => {
    setFetchingWeather(true);
    try {
      // Pedimos predicción al servidor sin datos manuales para forzar lectura API
      const response = await apiService.obtenerPrediccion(formData.fecha, location, null);

      if (response.aviso) {
        // Modelos no entrenados pero tenemos clima
        let climaVal = response.clima_texto ? response.clima_texto.toLowerCase() : '';
        if (climaVal && response.temperatura_minima != null) {
          setFormData(prev => ({
            ...prev,
            clima_promedio: climaVal,
            temperatura_minima: String(response.temperatura_minima),
            temperatura_maxima: String(response.temperatura_maxima),
          }));
          setShowWeatherForm(false);
        } else {
          Alert.alert('Clima no disponible', 'El clima automático no está disponible para esta fecha. Ingrésalo manualmente.');
          setShowWeatherForm(true);
        }
      } else {
        // Normal response with clima
        let climaVal = 'soleado';
        if (response.clima_texto) {
          climaVal = response.clima_texto.toLowerCase();
        }

        setFormData(prev => ({
          ...prev,
          clima_promedio: climaVal,
          temperatura_minima: String(response.temperatura_minima),
          temperatura_maxima: String(response.temperatura_maxima),
        }));
        setShowWeatherForm(false);
      }
    } catch (e) {
      // Check if it's a past date beyond forecast range
      const selectedDate = parseISO(formData.fecha);
      const today = new Date();
      const diffDays = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        Alert.alert(
          'Fecha muy antigua',
          'El clima automático solo está disponible para hoy y los próximos 5 días. Para fechas pasadas, ingresa el clima manualmente.'
        );
      } else {
        if (!silent) Alert.alert('Error API de Clima', 'No se pudo obtener el clima automático. Por favor, ingrésalo manualmente.');
      }
      setShowWeatherForm(true);
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
      // Verificar si ya existe un registro para esta fecha
      const check = await apiService.checkFechaExiste(formData.fecha);
      if (check && check.exists) {
        setLoading(false);
        const confirmOverwrite = await new Promise((resolve) => {
          Alert.alert(
            'Registro Existente',
            'Ya existe un registro de ventas para esta fecha. ¿Deseas sobreescribirlo?',
            [
              { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Sobreescribir', onPress: () => resolve(true) }
            ]
          );
        });
        if (!confirmOverwrite) return;
        setLoading(true); // Re-iniciar loading si confirma
      }

      const datosParaEnviar = {
        ...formData,
        temperatura_minima: parseFloat(formData.temperatura_minima),
        temperatura_maxima: parseFloat(formData.temperatura_maxima),
        pan_comprado_maniana: parseInt(formData.pan_comprado_maniana),
        pan_comprado_tarde: parseInt(formData.pan_comprado_tarde),
        pan_vendido_maniana: parseInt(formData.pan_vendido_maniana),
        pan_vendido_tarde: parseInt(formData.pan_vendido_tarde),
        clientes_sin_pan: formData.clientes_sin_pan ? parseInt(formData.clientes_sin_pan) : 0,
        hora_quiebre: formData.hora_quiebre || null
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
          
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateArrow, { backgroundColor: isDarkMode ? '#388E3C' : '#E8F5E8' }]}
              onPress={() => changeDate('prev')}
            >
              <Text style={[styles.dateArrowText, { color: isDarkMode ? '#FFF' : '#2E7D32' }]}>◀</Text>
            </TouchableOpacity>

            <View style={[styles.dateDisplay, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]}>              
              <Text style={[styles.dateText, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                📅 {formData.fecha}
              </Text>
              {formData.fecha !== format(new Date(), 'yyyy-MM-dd') && (
                <Text style={[styles.dateHint, { color: isDarkMode ? '#FFB74D' : '#F57C00' }]}>                  
                  (Fecha anterior)
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.dateArrow, { backgroundColor: isDarkMode ? '#388E3C' : '#E8F5E8' }]}
              onPress={() => changeDate('next')}
            >
              <Text style={[styles.dateArrowText, { color: isDarkMode ? '#FFF' : '#2E7D32' }]}>▶</Text>
            </TouchableOpacity>
          </View>
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

      {/* Datos Mañana y Tarde - Side by Side */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={styles.cardTitle}>Registrar Kilos</Title>
          <View style={styles.columnsContainer}>
            {/* Columna Mañana */}
            <View style={styles.column}>
              <Text style={[styles.columnTitle, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>☀️ Mañana</Text>
              <TextInput
                label="Comprado (kg)"
                value={formData.pan_comprado_maniana}
                onChangeText={(value) => updateField('pan_comprado_maniana', value)}
                mode="outlined"
                style={[styles.columnInput, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.pan_comprado_maniana}>{errors.pan_comprado_maniana}</HelperText>
              <TextInput
                label="Vendido (kg)"
                value={formData.pan_vendido_maniana}
                onChangeText={(value) => updateField('pan_vendido_maniana', value)}
                mode="outlined"
                style={[styles.columnInput, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.pan_vendido_maniana}>{errors.pan_vendido_maniana}</HelperText>
            </View>

            {/* Separador */}
            <View style={[styles.columnSeparator, { backgroundColor: isDarkMode ? '#333' : '#E0E0E0' }]} />

            {/* Columna Tarde */}
            <View style={styles.column}>
              <Text style={[styles.columnTitle, { color: isDarkMode ? '#FFB74D' : '#E65100' }]}>🌙 Tarde</Text>
              <TextInput
                label="Comprado (kg)"
                value={formData.pan_comprado_tarde}
                onChangeText={(value) => updateField('pan_comprado_tarde', value)}
                mode="outlined"
                style={[styles.columnInput, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#FFB74D' : '#E65100', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.pan_comprado_tarde}>{errors.pan_comprado_tarde}</HelperText>
              <TextInput
                label="Vendido (kg)"
                value={formData.pan_vendido_tarde}
                onChangeText={(value) => updateField('pan_vendido_tarde', value)}
                mode="outlined"
                style={[styles.columnInput, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#FFB74D' : '#E65100', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.pan_vendido_tarde}>{errors.pan_vendido_tarde}</HelperText>
            </View>
          </View>

          {/* Demanda Insatisfecha */}
          <Title style={[styles.cardTitle, { marginTop: 20, color: isDarkMode ? '#64B5F6' : '#2196F3' }]}>📊 Demanda Real (Opcional)</Title>
          <Text style={[dynamicStyles.subText, { marginBottom: 10 }]}>
            Si te quedaste sin pan antes de cerrar (quiebre de stock), completa estos datos. Ayudan a la IA a entender que la demanda real era mayor a lo que finalmente vendiste.
          </Text>
          <TextInput
            label="Clientes que no pudieron comprar"
            value={formData.clientes_sin_pan}
            onChangeText={(value) => updateField('clientes_sin_pan', value)}
            mode="outlined"
            style={[styles.input, dynamicStyles.input]}
            keyboardType="numeric"
            textColor={dynamicStyles.text.color}
            theme={{ colors: { primary: isDarkMode ? '#64B5F6' : '#2196F3', placeholder: dynamicStyles.subText.color }}}
          />
          <TextInput
            label="¿A qué hora se acabó el pan? (ej: 18:30)"
            value={formData.hora_quiebre}
            onChangeText={(value) => updateField('hora_quiebre', value)}
            mode="outlined"
            style={[styles.input, dynamicStyles.input, { marginTop: 5 }]}
            placeholder="Ej: 19:15"
            textColor={dynamicStyles.text.color}
            theme={{ colors: { primary: isDarkMode ? '#64B5F6' : '#2196F3', placeholder: dynamicStyles.subText.color }}}
          />
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

      <AppFooter isDarkMode={isDarkMode} />
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
  halfInput: { width: '48%', marginBottom: 5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  dateArrow: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  dateArrowText: { fontSize: 18, fontWeight: 'bold' },
  dateDisplay: { flex: 1, marginHorizontal: 10, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  dateText: { fontSize: 17, fontWeight: 'bold' },
  dateHint: { fontSize: 12, marginTop: 2 },
  columnsContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  columnSeparator: { width: 1, alignSelf: 'stretch', marginHorizontal: 8 },
  columnTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  columnInput: { marginBottom: 0 },
});

export default RegistroScreen;
