import { Stack } from 'expo-router';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="radar"
        options={{ title: 'Radar' }}
      />
      <Stack.Screen
        name="receive"
        options={{ title: 'Receive' }}
      />
      <Stack.Screen
        name="file-selection"
        options={{ title: 'Select Files' }}
      />
      <Stack.Screen
        name="transfer"
        options={{ title: 'Transfer' }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: 'Settings' }}
      />
    </Stack>
  );
}