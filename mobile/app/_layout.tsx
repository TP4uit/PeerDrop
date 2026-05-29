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
        animationEnabled: true,
        animationTypeForReplace: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="radar" options={{ title: 'Radar' }} />
      <Stack.Screen name="file-selection" options={{ title: 'Select Files' }} />
      <Stack.Screen name="transfer" options={{ title: 'Transfer' }} />
    </Stack>
  );
}
