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
import { Card, Button, Title, TextInput, HelperText, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/apiService';
import { CLIMA_OPTIONS } from '../config/api';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { useSettings } from '../context/SettingsContext';

const PrediccionScreen = () => {
  const navigation = useNavigation();
  const { themeMode, autoPredict, limitMorning, limitAfternoon, location } = useSettings();
  const isDarkMode = themeMode === 'dark';

  const [loading, setLoading] = useState(false);
  const [usarDatosManuales, setUsarDatosManuales] = useState(!autoPredict);
  const [prediccion, setPrediccion] = useState(null);
  const [autoFetched, setAutoFetched] = useState(false);

  // Determinar fecha y qué se muestra por defecto basado en límites
  const getTargetDate = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Si la hora actual es menor al limite de tarde, predecimos para hoy.
    // (Incluso si es mediodia, hoy sigo necesitando pan para la tarde)
    // Pero si pasó el límite de la tarde, ya predecimos para mañana.
    if (currentHour < limitAfternoon) {
      return format(now, 'yyyy-MM-dd');
    }
    return format(addDays(now, 1), 'yyyy-MM-dd');
  };
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    fecha: getTargetDate(),
    clima_num: '',
    temp_min: '',
    temp_max: ''
  });

  // Estado de errores
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Cuando entramos, si autopredict está on, recalculamos la fecha según limits actuales
    const targetDate = getTargetDate();
    setFormData(prev => ({ ...prev, fecha: targetDate }));

    if (autoPredict && !autoFetched) {
      obtenerPrediccion(false, targetDate);
      setAutoFetched(true);
    }
  }, [autoPredict, limitMorning, limitAfternoon]);

  const formatFecha = (fechaStr) => {
    try {
      const parts = fechaStr.split('-');
      const dia = parts[2];
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const diaSemana = diasSemana[dateObj.getDay()];
      const mes = meses[parseInt(parts[1]) - 1];
      return `${diaSemana} ${dia} ${mes}`;
    } catch { return fechaStr; }
  };

  const getDateLabel = (fechaStr) => {
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const manana = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    if (fechaStr === hoy) return '(Hoy)';
    if (fechaStr === manana) return '(Mañana)';
    return '';
  };

  const changeDate = (direction) => {
    const currentDate = parseISO(formData.fecha);
    const newDate = direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1);
    const newFechaStr = format(newDate, 'yyyy-MM-dd');
    setFormData(prev => ({ ...prev, fecha: newFechaStr }));
    setPrediccion(null);
  };

  // Actualizar campo del formulario
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validar formulario manual
  const validateFormManual = () => {
    const newErrors = {};
    if (!formData.fecha) newErrors.fecha = 'La fecha es requerida';
    if (!formData.clima_num) newErrors.clima_num = 'Selecciona un clima';
    if (!formData.temp_min || formData.temp_min <= 0) newErrors.temp_min = 'Temperatura mínima inválida';
    if (!formData.temp_max || formData.temp_max <= 0) newErrors.temp_max = 'Temperatura máxima inválida';
    if (parseFloat(formData.temp_min) > parseFloat(formData.temp_max)) {
      newErrors.temp_max = 'La temperatura máxima debe ser mayor que la mínima';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Obtener predicción
  const obtenerPrediccion = async (forceManual = usarDatosManuales) => {
    if (forceManual && !validateFormManual()) {
      Alert.alert('Error', 'Por favor corrige los errores en el formulario');
      return;
    }

    setLoading(true);
    try {
      let datosManuales = null;
      
      if (forceManual) {
        // Mapear clima texto a número (para compatibilidad de backend si se requiere inverso)
        // El formulario ya guarda en clima_num el ID del clima (1-6) a partir de CLIMA_OPTIONS
        datosManuales = {
          clima_num: parseInt(formData.clima_num),
          temp_min: parseFloat(formData.temp_min),
          temp_max: parseFloat(formData.temp_max)
        };
      }

      const response = await apiService.obtenerPrediccion(formData.fecha, location, datosManuales);
      setPrediccion(response);

    } catch (error) {
      if (!forceManual) {
         // Si falló el auto-fetch, activar manual
         setUsarDatosManuales(true);
         Alert.alert('Aviso', 'No se pudo obtener el clima automático. Por favor verifica manualmente.');
      } else {
         Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Limpiar predicción
  const limpiarPrediccion = () => {
    setPrediccion(null);
    setUsarDatosManuales(true); // Al limpiar forzamos a mostrar opciones
    setFormData({
      fecha: getTargetDate(),
      clima_num: '',
      temp_min: '',
      temp_max: ''
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#81C784' : '#2E7D32'} />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#AAAAAA' : '#666' }]}>Calculando predicción...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' },
    card: { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' },
    text: { color: isDarkMode ? '#FFFFFF' : '#333333' },
    subText: { color: isDarkMode ? '#AAAAAA' : '#666666' },
    input: { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF' },
    resultCard: { backgroundColor: isDarkMode ? '#1B5E20' : '#E8F5E8', borderColor: isDarkMode ? '#81C784' : '#4CAF50' },
    predictionItem: { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF' },
    totalItem: { backgroundColor: isDarkMode ? '#388E3C' : '#4CAF50' },
    recommendationBox: { backgroundColor: isDarkMode ? '#873600' : '#FFF3E0', borderLeftColor: isDarkMode ? '#E65100' : '#FF9800' },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={{ paddingBottom: 80 }}>
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={dynamicStyles.text}>Predicción de Compras</Title>
          <Text style={dynamicStyles.subText}>
            Obtén la cantidad recomendada de pan para comprar ({formData.fecha}).
          </Text>
        </Card.Content>
      </Card>

      {/* Solo mostramos la tarjeta de configuración si no tenemos una predicción automática activa que se quiera ocultar */}
      {!prediccion && (
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={styles.cardTitle}>Configurar Predicción</Title>
          
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateArrow, { backgroundColor: isDarkMode ? '#388E3C' : '#E8F5E8' }]}
              onPress={() => changeDate('prev')}
            >
              <Text style={[styles.dateArrowText, { color: isDarkMode ? '#FFF' : '#2E7D32' }]}>◀</Text>
            </TouchableOpacity>
            <View style={[styles.dateDisplay, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]}>
              <Text style={[styles.dateText, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                📅 {formatFecha(formData.fecha)}
              </Text>
              {getDateLabel(formData.fecha) !== '' && (
                <Text style={[styles.dateHint, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>
                  {getDateLabel(formData.fecha)}
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
          {location && location.city && (
            <Text style={[styles.locationText, { color: isDarkMode ? '#AAAAAA' : '#888' }]}>
              📍 {location.city}
            </Text>
          )}
          <HelperText type="error" visible={!!errors.fecha}>{errors.fecha}</HelperText>

          {/* Toggle para datos manuales */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, dynamicStyles.text]}>Ajustar clima manualmente:</Text>
            <Chip
              selected={usarDatosManuales}
              onPress={() => setUsarDatosManuales(!usarDatosManuales)}
              style={{ backgroundColor: usarDatosManuales ? (isDarkMode ? '#388E3C' : '#E8F5E8') : (isDarkMode ? '#333' : '#F0F0F0') }}
              textStyle={{ color: usarDatosManuales ? (isDarkMode ? '#FFF' : '#2E7D32') : (isDarkMode ? '#AAA' : '#666') }}
            >
              {usarDatosManuales ? 'Sí' : 'No (Automático)'}
            </Chip>
          </View>

          {usarDatosManuales && (
            <>
              <Text style={[styles.label, dynamicStyles.text]}>Clima Esperado:</Text>
              <View style={styles.climaContainer}>
                {CLIMA_OPTIONS.map((opcion) => (
                  <Button
                    key={opcion.value}
                    mode={formData.clima_num === opcion.value ? "contained" : "outlined"}
                    onPress={() => updateField('clima_num', opcion.value)}
                    style={styles.climaButton}
                    buttonColor={formData.clima_num === opcion.value ? (isDarkMode ? '#388E3C' : '#2E7D32') : undefined}
                    textColor={formData.clima_num === opcion.value ? '#FFF' : (isDarkMode ? '#81C784' : '#2E7D32')}
                    theme={{ colors: { outline: isDarkMode ? '#81C784' : '#2E7D32' } }}
                    compact
                  >
                    {opcion.label}
                  </Button>
                ))}
              </View>
              <HelperText type="error" visible={!!errors.clima_num}>{errors.clima_num}</HelperText>

              <TextInput
                label="Temperatura Mínima (°C)"
                value={formData.temp_min}
                onChangeText={(value) => updateField('temp_min', value)}
                mode="outlined"
                style={[styles.input, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.temp_min}>{errors.temp_min}</HelperText>

              <TextInput
                label="Temperatura Máxima (°C)"
                value={formData.temp_max}
                onChangeText={(value) => updateField('temp_max', value)}
                mode="outlined"
                style={[styles.input, dynamicStyles.input]}
                keyboardType="numeric"
                textColor={dynamicStyles.text.color}
                theme={{ colors: { primary: isDarkMode ? '#81C784' : '#2E7D32', placeholder: dynamicStyles.subText.color }}}
              />
              <HelperText type="error" visible={!!errors.temp_max}>{errors.temp_max}</HelperText>
            </>
          )}

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={() => obtenerPrediccion(usarDatosManuales)}
              style={[styles.predictButton, { backgroundColor: isDarkMode ? '#388E3C' : '#2E7D32' }]}
              disabled={loading}
            >
              Obtener Predicción
            </Button>
          </View>
        </Card.Content>
      </Card>
      )}

      {/* Resultados de la Predicción */}
      {prediccion && (
        <Card style={[styles.card, dynamicStyles.resultCard, { borderWidth: 1 }]}>
          <Card.Content>
            <Title style={[styles.resultTitle, { color: isDarkMode ? '#A5D6A7' : '#2E7D32' }]}>📊 Resultados de Predicción</Title>
            
            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Fecha:</Text>
              <Text style={[styles.resultValue, { color: isDarkMode ? '#FFF' : '#333' }]}>
                {formatFecha(prediccion.fecha)} {getDateLabel(prediccion.fecha)}
              </Text>
            </View>
            {location && location.city && (
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Ubicación:</Text>
                <Text style={[styles.resultValue, { color: isDarkMode ? '#FFF' : '#333' }]}>📍 {location.city}</Text>
              </View>
            )}

            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Fuente del Clima:</Text>
              <Text style={[styles.resultValue, { color: isDarkMode ? '#FFF' : '#333' }]}>{prediccion.fuente_clima}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Clima:</Text>
              <Text style={[styles.resultValue, { color: isDarkMode ? '#FFF' : '#333' }]}>
                {prediccion.clima_texto?.charAt(0).toUpperCase() + prediccion.clima_texto?.slice(1)}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Temperatura:</Text>
              <Text style={[styles.resultValue, { color: isDarkMode ? '#FFF' : '#333' }]}>
                {prediccion.temperatura_minima}°C - {prediccion.temperatura_maxima}°C
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.predictionContainer}>
              <View style={[styles.predictionItem, dynamicStyles.predictionItem]}>
                <Text style={[styles.predictionLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Mañana:</Text>
                <Text style={[styles.predictionValue, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>
                  {prediccion.prediccion_maniana_kg} kg
                </Text>
              </View>

              <View style={[styles.predictionItem, dynamicStyles.predictionItem]}>
                <Text style={[styles.predictionLabel, { color: isDarkMode ? '#E0E0E0' : '#333' }]}>Tarde:</Text>
                <Text style={[styles.predictionValue, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>
                  {prediccion.prediccion_tarde_kg} kg
                </Text>
              </View>

              <View style={[styles.predictionItem, dynamicStyles.totalItem]}>
                <Text style={styles.totalLabel}>Total del Día:</Text>
                <Text style={styles.totalValue}>
                  {prediccion.total_prediccion_kg} kg
                </Text>
              </View>
            </View>

            <View style={[styles.recommendationBox, dynamicStyles.recommendationBox]}>
              <Text style={[styles.recommendationTitle, { color: isDarkMode ? '#FFB74D' : '#E65100' }]}>💡 Recomendación:</Text>
              <Text style={[styles.recommendationText, { color: isDarkMode ? '#F5F5F5' : '#333' }]}>
                Comprar {prediccion.prediccion_maniana_kg} kg para la mañana y {prediccion.prediccion_tarde_kg} kg para la tarde.
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Botones de Acción */}
      {prediccion && (
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={limpiarPrediccion}
            style={styles.clearButton}
            textColor={isDarkMode ? '#81C784' : '#2E7D32'}
            theme={{ colors: { outline: isDarkMode ? '#81C784' : '#2E7D32' } }}
          >
            Modificar / Nueva Predicción
          </Button>
        </View>
      )}
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
  predictButton: { marginBottom: 10 },
  resultTitle: { fontSize: 20, marginBottom: 20, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  resultLabel: { fontSize: 16, fontWeight: 'bold' },
  resultValue: { fontSize: 16 },
  divider: { height: 1, backgroundColor: '#4CAF50', marginVertical: 15 },
  predictionContainer: { marginBottom: 20 },
  predictionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, marginBottom: 8 },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  recommendationBox: { padding: 15, borderRadius: 8, borderLeftWidth: 4 },
  recommendationTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  recommendationText: { fontSize: 14, lineHeight: 20 },
  clearButton: { borderWidth: 1 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 15 },
  toggleLabel: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  dateArrow: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  dateArrowText: { fontSize: 18, fontWeight: 'bold' },
  dateDisplay: { flex: 1, marginHorizontal: 10, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  dateText: { fontSize: 17, fontWeight: 'bold' },
  dateHint: { fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  locationText: { textAlign: 'center', fontSize: 13, marginBottom: 5, marginTop: -2 },
});

export default PrediccionScreen;
