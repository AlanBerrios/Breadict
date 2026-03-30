import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import apiService from './apiService';
import { format } from 'date-fns';

const MORNING_TASK_NAME = 'MORNING_PREDICTION_TASK';
const EVENING_TASK_NAME = 'EVENING_REMINDER_TASK'; // For consistency, though evening is usually a scheduled local notif

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    return true;
  }

  async scheduleEveningReminder(timeStr, enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    if (!enabled) return;

    const [hours, minutes] = timeStr.split(':').map(Number);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📢 Recordatorio de Ventas',
        body: 'No olvides registrar las ventas de hoy para mantener tu IA actualizada. 🥖',
        data: { screen: 'Registro' },
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
    
    console.log(`Evening reminder scheduled at ${timeStr}`);
  }

  // Define the background task
  async registerBackgroundTasks() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(MORNING_TASK_NAME);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(MORNING_TASK_NAME, {
          minimumInterval: 60 * 15, // 15 minutes (minimum allowed by OS)
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }
    } catch (err) {
      console.log("Background Task TaskManager error:", err);
    }
  }
}

// Background Task Definition
TaskManager.defineTask(MORNING_TASK_NAME, async () => {
  try {
    console.log('Running background prediction fetch...');
    
    // 1. Wake up server
    const health = await apiService.healthCheck();
    if (!health) return BackgroundFetch.BackgroundFetchResult.Failed;

    // 2. Get today's date
    const today = format(new Date(), 'yyyy-MM-dd');

    // 3. Get prediction
    // Note: This might take 30-50s if server is sleeping. 
    // BackgroundFetch has a timeout (usually 30s). 
    // If it fails, the next execution might succeed if server is already awake.
    const prediction = await apiService.obtenerPrediccion(today);

    if (prediction && !prediction.error) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '☀️ Predicción del Día',
          body: `Para hoy se estima: Mañana ${prediction.prediccion_maniana_kg}kg | Tarde ${prediction.prediccion_tarde_kg}kg. ¡Éxito! 🍞`,
          data: { screen: 'Prediccion', prediction },
        },
        trigger: null, // show immediately
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.log('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default new NotificationService();
