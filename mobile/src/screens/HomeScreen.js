import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  Animated
} from 'react-native';
import { Card, Button, Title, Paragraph, Modal, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/apiService';
import { useSettings } from '../context/SettingsContext';
import { useFocusEffect } from '@react-navigation/native';
import AppFooter from '../components/AppFooter';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { storeName, themeMode, location, hasSeenTutorial, updateHasSeenTutorial, serverStatus, setServerStatus } = useSettings();
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('🔌 Despertando servidor...');
  const [bypassLoading, setBypassLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showBypassButton, setShowBypassButton] = useState(false);
  const [weatherApiStatus, setWeatherApiStatus] = useState('checking'); // 'checking', 'ok', 'error'
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
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

    // Mostrar botón de bypass tras 3 segundos si sigue cargando
    const bypassTimer = setTimeout(() => {
      setShowBypassButton(true);
    }, 3000);

    return () => clearTimeout(bypassTimer);
  }, [hasSeenTutorial]);

  // Re-fetch stats every time the screen comes into focus (e.g. after registering)
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        const refresh = async () => {
          try {
            const stats = await apiService.obtenerEstadisticas();
            setEstadisticas(stats);
            // Fetch weekly data
            const analytics = await apiService.obtenerAnaliticas();
            if (analytics.registros) {
              const last7 = analytics.registros.slice(-7);
              setWeeklyData(last7);
            }
          } catch (e) { /* silent */ }
        };
        refresh();
      }
    }, [loading])
  );

  const verificarConexion = async () => {
    try {
      setLoading(true);
      setLoadingText('🔌 Despertando servidor...');
      
      // Mostrar el logo un mínimo de 3 segundos
      const minDelay = new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verificar conexión con el servidor
      const connectionCheck = async () => {
        let isReady = false;
        while (!isReady) {
          const health = await apiService.healthCheck();
          
          if (health && health.status === 'initializing') {
            setLoadingText('⚙️ Servidor encendido, inicializando base de datos y modelos...');
            // Esperar 2 segundos antes de reintentar
            await new Promise(r => setTimeout(r, 2000));
          } else {
            setServerStatus('connected');
            setLoadingText('✅ Conexión establecida. Sincronizando datos...');
            
            // Actualizar estado del clima basado en la respuesta del server
            if (health && health.weather_api_ok) {
              setWeatherApiStatus('ok');
            } else {
              setWeatherApiStatus('error');
            }
            
            // Obtener estadísticas
            const stats = await apiService.obtenerEstadisticas();
            setEstadisticas(stats);
            isReady = true;
          }
        }
      };
      
      await Promise.all([minDelay, connectionCheck()]);
      
    } catch (error) {
      setServerStatus('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Fade in cards
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleBypass = () => {
    setBypassLoading(true);
    // Iniciar animación aunque el servidor no responda
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    verificarConexion();
  }, []);

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

  if (loading && !bypassLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
        <Image 
          source={require('../../assets/icon.png')} 
          style={{ width: 120, height: 120, marginBottom: 20, borderRadius: 25 }} 
        />
        <ActivityIndicator size="large" color={isDarkMode ? '#81C784' : '#2E7D32'} />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#AAAAAA' : '#666', marginTop: 20, textAlign: 'center', paddingHorizontal: 20 }]}>
          {serverStatus === 'error' ? 'Error al conectar' : loadingText}
        </Text>
        
        {showBypassButton && serverStatus !== 'error' && (
          <Text style={{ color: isDarkMode ? '#888' : '#888', textAlign: 'center', marginTop: 10, fontSize: 13, paddingHorizontal: 30 }}>
            El servidor en la nube gratuita de Render toma hasta 50 segundos en arrancar tras periodos de inactividad.
          </Text>
        )}
        
        {showBypassButton && (
          <Button 
            mode="text" 
            onPress={handleBypass}
            textColor={isDarkMode ? '#81C784' : '#2E7D32'}
            style={{ marginTop: 30 }}
          >
            Entrar a la app de todas formas
          </Button>
        )}
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
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={{ paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#2E7D32']}
          tintColor={isDarkMode ? '#81C784' : '#2E7D32'}
        />
      }
    >
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={styles.title}>{storeName}</Text>
        <Text style={styles.subtitle}>Sistema de Predicción de Ventas</Text>
      </View>

      {/* Offline Banner */}
      {serverStatus === 'error' && (
        <View style={[styles.offlineBanner, { backgroundColor: isDarkMode ? '#B71C1C' : '#FFCDD2' }]}>
          <Text style={{ color: isDarkMode ? '#FFF' : '#B71C1C', fontWeight: 'bold', textAlign: 'center' }}>
            📡 Sin conexión al servidor. Desliza hacia abajo para reintentar.
          </Text>
        </View>
      )}

      <Animated.View style={{ opacity: fadeAnim }}>

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
            <Text style={[styles.statusLabel, dynamicStyles.text]}>Servicio de Clima:</Text>
            <View style={[styles.statusIndicator, { 
              backgroundColor: weatherApiStatus === 'ok' ? (isDarkMode ? '#81C784' : '#4CAF50') : 
                               (weatherApiStatus === 'error' ? (isDarkMode ? '#E57373' : '#F44336') : 
                               (isDarkMode ? '#FFB74D' : '#FF9800'))
            }]} />
            <Text style={[styles.statusText, { 
              color: weatherApiStatus === 'ok' ? (isDarkMode ? '#81C784' : '#4CAF50') : 
                     (weatherApiStatus === 'error' ? (isDarkMode ? '#E57373' : '#F44336') : 
                     (isDarkMode ? '#FFB74D' : '#FF9800'))
            }]}>
              {weatherApiStatus === 'ok' ? 'Online' : (weatherApiStatus === 'error' ? 'Offline' : 'Verificando...')}
            </Text>
          </View>
          <View style={[styles.statusRow, { marginTop: 10 }]}>
            <Text style={[styles.statusLabel, dynamicStyles.text]}>Ubicación Guardada:</Text>
            <Text style={[styles.statusText, dynamicStyles.subText, { fontWeight: 'normal', flexShrink: 1 }]}>
              {location 
                ? (location.city 
                  ? location.city 
                  : (location.latitude 
                    ? `Lat: ${location.latitude.toFixed(2)}, Lon: ${location.longitude.toFixed(2)}` 
                    : String(location))) 
                : 'No configurada (Ir a Configuración)'}
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

      {/* Resumen Semanal */}
      {weeklyData.length > 0 && (
        <Card style={[styles.card, dynamicStyles.card]}>
          <Card.Content>
            <Title style={dynamicStyles.text}>📈 Resumen Semanal</Title>
            <Text style={[dynamicStyles.subText, { marginBottom: 12 }]}>
              Últimos {weeklyData.length} registros
            </Text>
            {(() => {
              const maxVal = Math.max(...weeklyData.map(d => Math.max(d.vendido || 0, d.predicho || 0)), 1);
              const totalVendido = weeklyData.reduce((s, d) => s + (d.vendido || 0), 0);
              const totalPredicho = weeklyData.reduce((s, d) => s + (d.predicho || 0), 0);
              const precision = totalPredicho > 0 ? Math.max(0, 100 - Math.abs((totalVendido - totalPredicho) / totalPredicho * 100)).toFixed(0) : '--';
              const diasSemana = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
              return (
                <>
                  <View style={styles.weekChart}>
                    {weeklyData.map((d, i) => {
                      const parts = d.fecha?.split('-') || [];
                      const dateObj = parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) : new Date();
                      const dayLabel = diasSemana[dateObj.getDay()];
                      return (
                        <View key={i} style={styles.weekDay}>
                          <View style={styles.weekBarsRow}>
                            <View style={[styles.weekBar, {
                              height: Math.max(4, (d.vendido || 0) / maxVal * 60),
                              backgroundColor: isDarkMode ? '#81C784' : '#4CAF50'
                            }]} />
                            <View style={[styles.weekBar, {
                              height: Math.max(4, (d.predicho || 0) / maxVal * 60),
                              backgroundColor: isDarkMode ? '#64B5F6' : '#2196F3'
                            }]} />
                          </View>
                          <Text style={[styles.weekDayLabel, { color: isDarkMode ? '#888' : '#999' }]}>{dayLabel}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.weekLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#81C784' : '#4CAF50' }]} />
                      <Text style={[{ fontSize: 12 }, dynamicStyles.subText]}>Vendido</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#64B5F6' : '#2196F3' }]} />
                      <Text style={[{ fontSize: 12 }, dynamicStyles.subText]}>Predicho</Text>
                    </View>
                    <Text style={[{ fontSize: 12, fontWeight: 'bold' }, { color: isDarkMode ? '#FFB74D' : '#E65100' }]}>
                      🎯 Precisión: {precision}%
                    </Text>
                  </View>
                </>
              );
            })()}
          </Card.Content>
        </Card>
      )}

      {/* Botón Analíticas de IA */}
      {estadisticas && estadisticas.total_registros > 0 && (
        <Card style={[styles.card, dynamicStyles.card]}>
          <Card.Content>
            <Title style={dynamicStyles.text}>Analíticas de IA</Title>
            <Paragraph style={dynamicStyles.subText}>
              Explora todos tus registros con predicciones vs ventas reales en una línea de tiempo interactiva.
            </Paragraph>
            <Button
              mode="contained"
              icon="chart-timeline-variant"
              onPress={() => navigation.navigate('Analiticas')}
              buttonColor={isDarkMode ? '#1565C0' : '#1976D2'}
              textColor="#FFF"
              style={{ marginTop: 10 }}
            >
              Ver Analíticas
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Botones de Acción - Card Style */}
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={dynamicStyles.text}>📊 Predicción de Compras</Title>
          <Paragraph style={dynamicStyles.subText}>
            Consulta cuánto pan comprar hoy o mañana según el clima y tu historial.
          </Paragraph>
          <Button
            mode="contained"
            icon="crystal-ball"
            onPress={() => navigation.navigate('Prediccion')}
            buttonColor={isDarkMode ? '#388E3C' : '#2E7D32'}
            textColor="#FFF"
            style={{ marginTop: 10 }}
          >
            Ver Predicción
          </Button>
        </Card.Content>
      </Card>

      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Title style={dynamicStyles.text}>📝 Registrar Ventas</Title>
          <Paragraph style={dynamicStyles.subText}>
            Registra las ventas del día para mejorar la precisión de las predicciones.
          </Paragraph>
          <Button
            mode="contained"
            icon="pencil-plus"
            onPress={() => navigation.navigate('Registro')}
            buttonColor={isDarkMode ? '#388E3C' : '#2E7D32'}
            textColor="#FFF"
            style={{ marginTop: 10 }}
          >
            Registrar Ventas
          </Button>
        </Card.Content>
      </Card>

      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content>
          <Button
            mode="outlined"
            icon="cog"
            onPress={() => navigation.navigate('Configuracion')}
            textColor={isDarkMode ? '#AAAAAA' : '#616161'}
            theme={{ colors: { outline: isDarkMode ? '#555' : '#CCC' } }}
          >
            Configuración
          </Button>
        </Card.Content>
      </Card>

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

      <AppFooter isDarkMode={isDarkMode} />
      </Animated.View>

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
  offlineBanner: {
    padding: 10,
    marginHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
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
  predictionLabel: { fontSize: 16, fontWeight: 'bold' },
  predictionValue: { fontSize: 20, fontWeight: 'bold' },
  weekChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 80, marginBottom: 10 },
  weekDay: { alignItems: 'center', flex: 1 },
  weekBarsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  weekBar: { width: 8, borderRadius: 4 },
  weekDayLabel: { fontSize: 11, marginTop: 4, fontWeight: 'bold' },
  weekLegend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});

export default HomeScreen;
