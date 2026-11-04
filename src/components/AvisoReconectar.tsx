import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSessao } from '../lib/sessao';
import { cores } from '../lib/tema';

/** Aparece só quando o servidor encerrou a sessão; o app segue funcionando. */
export function AvisoReconectar() {
  const { precisaReconectar } = useSessao();
  if (!precisaReconectar) return null;
  return (
    <Pressable onPress={() => router.push('/reconectar')} style={s.aviso} accessibilityRole="button">
      <Ionicons name="cloud-offline-outline" size={20} color={cores.alerta} />
      <Text style={s.texto}>Sincronização pausada. Toque para entrar de novo.</Text>
      <Ionicons name="chevron-forward" size={18} color={cores.alerta} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: cores.alertaSuave,
    borderRadius: 12,
    padding: 12,
  },
  texto: { flex: 1, color: cores.alerta, fontSize: 14, fontWeight: '600' },
});
