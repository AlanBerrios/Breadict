import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

const AppFooter = ({ isDarkMode = false }) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.brand, { color: isDarkMode ? '#555' : '#CCC' }]}>
        🍞 Breadict
      </Text>
      <Text style={[styles.credit, { color: isDarkMode ? '#444' : '#DDD' }]}>
        Creado por Alan Berrios Estay
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://github.com/AlanBerrios')}>
        <Text style={[styles.github, { color: isDarkMode ? '#5a5a5a' : '#BBB' }]}>
          github.com/AlanBerrios
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 50,
    marginTop: 10,
  },
  brand: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  credit: { fontSize: 11 },
  github: { fontSize: 11, marginTop: 2, textDecorationLine: 'underline' },
});

export default AppFooter;
