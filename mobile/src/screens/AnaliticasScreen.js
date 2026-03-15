import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Card, Button, Title } from 'react-native-paper';
import apiService from '../services/apiService';
import { useSettings } from '../context/SettingsContext';
import AppFooter from '../components/AppFooter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.82;
const CARD_SPACING = 12;

const CLIMA_ICONS = {
  'soleado': '☀️',
  'parcialmente nublado': '⛅',
  'nublado': '☁️',
  'despejado': '🌙',
  'lluvia ligera': '🌦️',
  'lluvia': '🌧️',
};

const AnaliticasScreen = () => {
  const { themeMode } = useSettings();
  const isDarkMode = themeMode === 'dark';
  const flatListRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    cargarAnaliticas();
  }, []);

  const cargarAnaliticas = async () => {
    try {
      setLoading(true);
      const data = await apiService.obtenerAnaliticas();
      // Invertir para que el más reciente esté primero
      const reversed = (data.registros || []).reverse();
      setRegistros(reversed);
      setCurrentIndex(0);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las analíticas.');
    } finally {
      setLoading(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const formatFecha = (fechaStr) => {
    try {
      const parts = fechaStr.split('-');
      const dia = parts[2];
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const mes = meses[parseInt(parts[1]) - 1];
      const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const diaSemana = diasSemana[dateObj.getDay()];
      return `${diaSemana} ${dia} ${mes} ${parts[0]}`;
    } catch {
      return fechaStr;
    }
  };

  const renderRegistro = ({ item, index }) => {
    const totalRegistros = registros.length;
    const realNumber = totalRegistros - index; // Most recent = highest number
    const diferencia = item.vendido - item.predicho;
    const precision = item.predicho > 0
      ? Math.max(0, 100 - Math.abs(diferencia / item.predicho * 100)).toFixed(0)
      : '—';
    const climaIcon = CLIMA_ICONS[item.clima?.toLowerCase()] || '🌤️';
    const maxBar = Math.max(item.vendido, item.predicho, 1);

    return (
      <View style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
        <Card style={[styles.card, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' }]}>
          <Card.Content>
            {/* Header: Número y Fecha */}
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: isDarkMode ? '#388E3C' : '#2E7D32' }]}>
                <Text style={styles.badgeText}>#{realNumber}</Text>
              </View>
              <Text style={[styles.fechaText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                {formatFecha(item.fecha)}
              </Text>
            </View>

            {/* Clima */}
            <View style={[styles.climaRow, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]}>
              <Text style={styles.climaIcon}>{climaIcon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.climaText, { color: isDarkMode ? '#FFFFFF' : '#333333' }]}>
                  {item.clima ? item.clima.charAt(0).toUpperCase() + item.clima.slice(1) : 'N/A'}
                </Text>
                <Text style={[styles.tempText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                  🌡️ {item.temp_min}°C — {item.temp_max}°C
                </Text>
              </View>
            </View>

            {/* Barras Comparativas */}
            <View style={styles.barsContainer}>
              <View style={styles.barRow}>
                <Text style={[styles.barLabel, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>Vendido</Text>
                <View style={[styles.barBg, { backgroundColor: isDarkMode ? '#2C2C2C' : '#E8F5E9' }]}>
                  <View style={[styles.barFill, { width: `${(item.vendido / maxBar) * 100}%`, backgroundColor: isDarkMode ? '#81C784' : '#4CAF50' }]} />
                </View>
                <Text style={[styles.barValue, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>{item.vendido} kg</Text>
              </View>

              <View style={styles.barRow}>
                <Text style={[styles.barLabel, { color: isDarkMode ? '#64B5F6' : '#1565C0' }]}>Predicho</Text>
                <View style={[styles.barBg, { backgroundColor: isDarkMode ? '#2C2C2C' : '#E3F2FD' }]}>
                  <View style={[styles.barFill, { width: `${(item.predicho / maxBar) * 100}%`, backgroundColor: isDarkMode ? '#64B5F6' : '#2196F3' }]} />
                </View>
                <Text style={[styles.barValue, { color: isDarkMode ? '#64B5F6' : '#1565C0' }]}>{item.predicho} kg</Text>
              </View>
            </View>

            {/* Diferencia y Precisión */}
            <View style={styles.bottomRow}>
              <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFF8E1' }]}>
                <Text style={[styles.statLabel, { color: isDarkMode ? '#FFB74D' : '#F57C00' }]}>📊 Precisión</Text>
                <Text style={[styles.statValue, { color: isDarkMode ? '#FFB74D' : '#E65100' }]}>
                  {precision === '—' ? precision : `${precision}%`}
                </Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F3E5F5' }]}>
                <Text style={[styles.statLabel, { color: isDarkMode ? '#CE93D8' : '#7B1FA2' }]}>📦 Comprado</Text>
                <Text style={[styles.statValue, { color: isDarkMode ? '#CE93D8' : '#7B1FA2' }]}>{item.comprado} kg</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#81C784' : '#2E7D32'} />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#AAAAAA' : '#666' }]}>Cargando analíticas...</Text>
      </View>
    );
  }

  if (registros.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
        <Text style={{ fontSize: 48, marginBottom: 15 }}>📊</Text>
        <Text style={[styles.emptyText, { color: isDarkMode ? '#AAAAAA' : '#666' }]}>No hay registros todavía.</Text>
        <Text style={[styles.emptySubtext, { color: isDarkMode ? '#666' : '#999' }]}>Registra ventas para ver las analíticas.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#F5F5F5' }]}>
      <View style={styles.positionBar}>
        <Text style={[styles.positionText, { color: isDarkMode ? '#81C784' : '#2E7D32' }]}>
          Registro {registros.length - currentIndex} de {registros.length}
        </Text>
        <Text style={[styles.swipeHint, { color: isDarkMode ? '#666' : '#999' }]}>
          ← Más reciente | Más antiguo →
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={registros}
        renderItem={renderRegistro}
        keyExtractor={(item, index) => `${item.fecha}-${index}`}
        horizontal
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="center"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
      />

      <View style={styles.dotsContainer}>
        {registros.length <= 20 ? registros.map((_, i) => (
          <View key={i} style={[styles.dot, {
            backgroundColor: i === currentIndex ? (isDarkMode ? '#81C784' : '#2E7D32') : (isDarkMode ? '#333' : '#CCC'),
            width: i === currentIndex ? 10 : 6,
            height: i === currentIndex ? 10 : 6,
          }]} />
        )) : (
          <Text style={{ color: isDarkMode ? '#666' : '#999', fontSize: 12 }}>
            {registros.length - currentIndex} de {registros.length}
          </Text>
        )}
      </View>

      <AppFooter isDarkMode={isDarkMode} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  emptyText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 5 },
  positionBar: { alignItems: 'center', paddingVertical: 12 },
  positionText: { fontSize: 16, fontWeight: 'bold' },
  swipeHint: { fontSize: 12, marginTop: 2 },
  cardWrapper: { justifyContent: 'center' },
  card: { elevation: 6, borderRadius: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 },
  badgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  fechaText: { fontSize: 15, fontWeight: '600' },
  climaRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 14 },
  climaIcon: { fontSize: 28, marginRight: 10 },
  climaText: { fontSize: 15, fontWeight: 'bold' },
  tempText: { fontSize: 13, marginTop: 2 },
  barsContainer: { marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  barLabel: { width: 70, fontSize: 13, fontWeight: '600' },
  barBg: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: '100%', borderRadius: 7 },
  barValue: { width: 55, fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  bottomRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 4 },
  dot: { borderRadius: 5 },
});

export default AnaliticasScreen;
