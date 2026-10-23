import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { cores } from '../lib/tema';

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[estilos.cartao, style]}>{children}</View>;
}

export function TituloSecao({ children }: { children: ReactNode }) {
  return <Text style={estilos.tituloSecao}>{children}</Text>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.rotulo}>{children}</Text>;
}

type VarianteBotao = 'primario' | 'secundario' | 'perigo';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  icone,
  desabilitado,
}: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  icone?: ComponentProps<typeof Ionicons>['name'];
  desabilitado?: boolean;
}) {
  const fundo = { primario: cores.primaria, secundario: cores.primariaSuave, perigo: cores.perigoSuave }[variante];
  const texto = { primario: '#fff', secundario: cores.primaria, perigo: cores.perigo }[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.botao, { backgroundColor: fundo, opacity: desabilitado ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      {icone && <Ionicons name={icone} size={18} color={texto} />}
      <Text style={[estilos.botaoTexto, { color: texto }]}>{titulo}</Text>
    </Pressable>
  );
}

export function BotaoFlutuante({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Adicionar"
      style={({ pressed }) => [estilos.fab, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="add" size={30} color="#fff" />
    </Pressable>
  );
}

export function Vazio({ icone, titulo, texto }: { icone: ComponentProps<typeof Ionicons>['name']; titulo: string; texto: string }) {
  return (
    <View style={estilos.vazio}>
      <Ionicons name={icone} size={48} color={cores.primaria} />
      <Text style={estilos.vazioTitulo}>{titulo}</Text>
      <Text style={estilos.vazioTexto}>{texto}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, paddingBottom: 96, gap: 12 },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  tituloSecao: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.texto, marginBottom: 6 },
  input: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: cores.texto,
  },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  botaoTexto: { fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  vazio: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  vazioTexto: { fontSize: 15, color: cores.textoSuave, textAlign: 'center', lineHeight: 21 },
});
