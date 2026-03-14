import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Card, Button, Title, Paragraph, Modal, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/apiService';
import { useSettings } from '../context/SettingsContext';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { storeName, themeMode, location, hasSeenTutorial, updateHasSeenTutorial } = useSettings();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  
  // Tutorial State
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);

  const isDarkMode = themeMode === 'dark';

  useEffect(() => {
    verificarConexion();
    
    // Mostrar tutorial si no se ha visto
    if (hasSeenTutorial === false) {
      setTutorialVisible(true);
    }
  }, [hasSeenTutorial]);

  const verificarConexion = async () => {
    try {
      setLoading(true);
      
      // Verificar conexión con el servidor
      await apiService.healthCheck();
      setServerStatus('connected');
      
      // Obtener estadísticas
      const stats = await apiService.obtenerEstadisticas();
      setEstadisticas(stats);
      
    } catch (error) {
      setServerStatus('error');
      Alert.alert(
        'Error de Conexión',
        'No se puede conectar al servidor. Asegúrate de que el servidor esté funcionando y que la URL sea correcta.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNextTutorial = () => {
    if (tutorialStep < 3) {
      setTutorialStep(tutorialStep + 1);
    } else {
      finishTutorial();
    }
  };

  const finishTutorial = async () => {
    setTutorialVisible(false);
    await updateHasSeenTutorial(true);
  };

  const getStatusColor = () => {
    switch (serverStatus) {
      case 'connected': return isDarkMode ? '#81C784' : '#4CAF50';
      case 'error': return isDarkMode ? '#E57373' : '#F44336';
      default: return isDarkMode ? '#FFB74D' : '#FF9800';
    }
  };

  const getStatusText = () => {
    switch (serverStatus) {
      case 'connected': return 'Conectado';
      case 'error': return 'Error de Conexión';
      default: return 'Verificando...';
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#81C784' : '#2E7D32'} />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#AAAAAA' : '#666' }]}>Verificando conexión...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' },
    header: { backgroundColor: isDarkMode ? '#1E1E1E' : '#2E7D32' },
    card: { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' },
    text: { color: isDarkMode ? '#FFFFFF' : '#000000' },
    subText: { color: isDarkMode ? '#AAAAAA' : '#666666' },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={styles.title}>{storeName}</Text>
        <Text style={styles.subtitle}>Sistema de Predicción de Ventas</Text>
      </View>

      {/* Estado del Servidor y Ubicación */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, dynamicStyles.text]}>Estado del Servidor:</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
          <View style={[styles.statusRow, { marginTop: 10 }]}>
            <Text style={[styles.statusLabel, dynamicStyles.text]}>Ubicación Guardada:</Text>
            <Text style={[styles.statusText, dynamicStyles.subText, { fontWeight: 'normal', flexShrink: 1 }]}>
              {location ? (location.city ? location.city : (location.latitude ? `Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}` : location)) : 'No configurada (Ir a Configuración)'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Estadísticas */}
      {estadisticas && (
        <Card style={[styles.card, dynamicStyles.card]}>
          <Card.Content>
            <Title style={dynamicStyles.text}>Estadísticas</Title>
            <Paragraph style={dynamicStyles.subText}>Registros totales: {estadisticas.total_registros}</Paragraph>
            <Paragraph style={dynamicStyles.subText}>
              Modelos entrenados: {estadisticas.modelos_entrenados ? 'Sí' : 'No'}
            </Paragraph>
          </Card.Content>
        </Card>
      )}

      {/* Gráfica de Predicción vs Realidad */}
      {estadisticas && estadisticas.historial_comparativo && estadisticas.historial_comparativo.length > 0 && (
        <Card style={[styles.card, dynamicStyles.card]}>
          <Card.Content>
            <Title style={dynamicStyles.text}>Efectividad de IA</Title>
            <Paragraph style={[dynamicStyles.subText, { marginBottom: 15 }]}>Últimos 5 días (Kilos Totales)</Paragraph>
            
            <View style={styles.chartLegend}>
               <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#81C784' : '#4CAF50' }]} /><Text style={dynamicStyles.subText}>Vendido</Text></View>
               <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#64B5F6' : '#2196F3' }]} /><Text style={dynamicStyles.subText}>Predicho</Text></View>
            </View>

            {estadisticas.historial_comparativo.map((item, index) => {
              const maxVal = Math.max(...estadisticas.historial_comparativo.map(h => Math.max(h.vendido, h.predicho)), 1);
              const pctVendido = (item.vendido / maxVal) * 100;
              const pctPredicho = (item.predicho / maxVal) * 100;
              
              return (
                <View key={index} style={styles.chartRow}>
                  <Text style={[styles.chartLabel, dynamicStyles.text]}>{item.fecha}</Text>
                  <View style={[styles.barsContainer, { borderLeftColor: isDarkMode ? '#444' : '#ccc' }]}>
                    <View style={styles.barWrapper}>
                       <View style={[styles.bar, { width: `${pctVendido}%`, backgroundColor: isDarkMode ? '#81C784' : '#4CAF50' }]} />
                        <Text style={[styles.barText, { color: isDarkMode ? '#aaa' : '#666' }]}>{item.vendido} kg</Text>
                    </View>
                    <View style={styles.barWrapper}>
                       <View style={[styles.bar, { width: `${pctPredicho}%`, backgroundColor: isDarkMode ? '#64B5F6' : '#2196F3' }]} />
                        <Text style={[styles.barText, { color: isDarkMode ? '#aaa' : '#666' }]}>{item.predicho} kg</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </Card.Content>
        </Card>
      )}

      {/* Botones de Acción */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDarkMode ? '#388E3C' : '#2E7D32' }]}
          onPress={() => navigation.navigate('Prediccion')}
        >
          <Text style={styles.buttonText}>📊 Ver Predicción</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDarkMode ? '#388E3C' : '#2E7D32' }]}
          onPress={() => navigation.navigate('Registro')}
        >
          <Text style={styles.buttonText}>📝 Registrar Ventas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDarkMode ? '#424242' : '#616161' }]}
          onPress={() => navigation.navigate('Configuracion')}
        >
          <Text style={styles.buttonText}>⚙️ Configuración</Text>
        </TouchableOpacity>
      </View>

      {/* Información Adicional */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={dynamicStyles.text}>¿Cómo funciona?</Title>
          <Paragraph style={[styles.infoText, dynamicStyles.subText]}>
            1. Consulta la predicción de compras para mañana
          </Paragraph>
          <Paragraph style={[styles.infoText, dynamicStyles.subText]}>
            2. Al final del día, registra las ventas reales
          </Paragraph>
          <Paragraph style={[styles.infoText, dynamicStyles.subText]}>
            3. El sistema aprende y mejora con cada registro
          </Paragraph>
        </Card.Content>
      </Card>

      {/* Botón de Refrescar */}
      <Button
        mode="outlined"
        onPress={verificarConexion}
        style={styles.refreshButton}
        icon="refresh"
        textColor={isDarkMode ? '#81C784' : '#2E7D32'}
        theme={{ colors: { outline: isDarkMode ? '#81C784' : '#2E7D32' } }}
      >
        Verificar Conexión
      </Button>

      {/* Tutorial Modal */}
      <Portal>
        <Modal
          visible={tutorialVisible}
          dismissable={false}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' }
          ]}
        >
          <Title style={[styles.modalTitle, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>
            {tutorialStep === 1 && "¡Bienvenido a Breadict! 🍞"}
            {tutorialStep === 2 && "Paso 1: Configuración ⚙️"}
            {tutorialStep === 3 && "Paso 2: ¡Todo listo! 🚀"}
          </Title>
          
          <Paragraph style={[styles.modalText, { color: isDarkMode ? '#FFFFFF' : '#333' }]}>
            {tutorialStep === 1 && "Breadict te ayudará a predecir cuánto pan comprar basado en el clima y tus ventas pasadas. Para empezar, necesitamos configurar unos detalles."}
            {tutorialStep === 2 && "Primero, ve a 'Configuración' y presiona 'Obtener Ubicación GPS'. Esto nos permitirá obtener el clima exacto de tu panadería.\n\nNo olvides presionar 'Guardar Cambios' al terminar."}
            {tutorialStep === 3 && "Una vez configurada tu ubicación, podrás usar 'Ver Predicción' para saber cuánto pan comprar, y 'Registrar Ventas' al final del día para que el sistema aprenda.\n\n¡Empecemos!"}
          </Paragraph>

          <Button 
            mode="contained" 
            onPress={handleNextTutorial}
            style={styles.modalButton}
            buttonColor={isDarkMode ? '#388E3C' : '#2E7D32'}
          >
            {tutorialStep < 3 ? "Siguiente" : "Entendido"}
          </Button>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
    opacity: 0.9,
  },
  card: {
    margin: 15,
    elevation: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    padding: 15,
  },
  button: {
    padding: 18,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  refreshButton: {
    margin: 15,
    borderWidth: 1,
  },
  modalContent: {
    padding: 25,
    margin: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 5,
  },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 5 },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  chartLabel: { width: 50, fontSize: 13, fontWeight: 'bold' },
  barsContainer: { flex: 1, paddingLeft: 10, borderLeftWidth: 1 },
  barWrapper: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  bar: { height: 14, borderRadius: 7, minWidth: 5 },
  barText: { fontSize: 11, marginLeft: 6, fontWeight: 'bold' },
});

export default HomeScreen;
