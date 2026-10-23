import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { cores } from '../../lib/tema';

type Icone = ComponentProps<typeof Ionicons>['name'];

const icone = (nome: Icone) =>
  function TabIcon({ color, size }: { color: ColorValue | null; size: number }) {
    return <Ionicons name={nome} size={size} color={typeof color === 'string' ? color : undefined} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.textoSuave,
        headerStyle: { backgroundColor: cores.superficie },
        headerTitleStyle: { color: cores.texto, fontWeight: '700' },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'A pagar', tabBarIcon: icone('alarm-outline') }} />
      <Tabs.Screen name="mes" options={{ title: 'Mês', tabBarIcon: icone('stats-chart-outline') }} />
      <Tabs.Screen name="fixas" options={{ title: 'Contas fixas', tabBarIcon: icone('repeat-outline') }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: icone('settings-outline') }} />
    </Tabs>
  );
}
