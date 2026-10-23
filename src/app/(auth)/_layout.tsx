import { Stack } from 'expo-router';

import { cores } from '../../lib/tema';

export const unstable_settings = { initialRouteName: 'entrar' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastrar" />
      <Stack.Screen name="recuperar" />
    </Stack>
  );
}
