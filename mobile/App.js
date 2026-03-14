import React from 'react';
import { Image, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';

import HomeScreen from './src/screens/HomeScreen';
import RegistroScreen from './src/screens/RegistroScreen';
import PrediccionScreen from './src/screens/PrediccionScreen';
import ConfiguracionScreen from './src/screens/ConfiguracionScreen';

const Stack = createStackNavigator();

const LogoTitle = () => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        style={{ width: 36, height: 36, marginRight: 10, resizeMode: 'contain', borderRadius: 18, overflow: 'hidden' }}
        source={require('./assets/icon.png')}
      />
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>Breadict</Text>
    </View>
  );
};

function AppNavigation() {
  const { themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  
  const headerOptions = {
    headerStyle: { backgroundColor: isDark ? '#1E1E1E' : '#2E7D32' },
    headerTintColor: '#fff',
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ 
            headerTitle: (props) => <LogoTitle {...props} />,
            headerTitleAlign: 'center',
            ...headerOptions
          }} 
        />
        <Stack.Screen 
          name="Registro" 
          component={RegistroScreen} 
          options={{ 
            title: 'Registrar Ventas',
            ...headerOptions
          }} 
        />
        <Stack.Screen 
          name="Prediccion" 
          component={PrediccionScreen} 
          options={{ 
            title: 'Predicción de Compras',
            ...headerOptions
          }} 
        />
        <Stack.Screen 
          name="Configuracion" 
          component={ConfiguracionScreen} 
          options={{ 
            title: 'Configuración',
            ...headerOptions
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <PaperProvider>
          <AppNavigation />
        </PaperProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
