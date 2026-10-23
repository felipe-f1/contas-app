import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cores } from '../lib/tema';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'apagar'] as const;

/** Bolinhas + teclado numérico próprio (o PIN nunca passa pelo teclado do sistema). */
export function TecladoPin({
  valor,
  onChange,
  tamanho = 6,
  onBiometria,
  erro,
}: {
  valor: string;
  onChange: (v: string) => void;
  tamanho?: number;
  onBiometria?: () => void;
  erro?: boolean;
}) {
  function tocar(t: (typeof TECLAS)[number]) {
    if (t === 'apagar') onChange(valor.slice(0, -1));
    else if (t === 'bio') onBiometria?.();
    else if (valor.length < tamanho) onChange(valor + t);
  }

  return (
    <View style={s.container}>
      <View style={s.bolinhas} accessibilityLabel={`${valor.length} de ${tamanho} dígitos`}>
        {Array.from({ length: tamanho }, (_, i) => (
          <View key={i} style={[s.bolinha, i < valor.length && s.cheia, erro && s.erro]} />
        ))}
      </View>
      <View style={s.teclado}>
        {TECLAS.map((t) =>
          t === 'bio' && !onBiometria ? (
            <View key={t} style={s.tecla} />
          ) : (
            <Pressable
              key={t}
              onPress={() => tocar(t)}
              style={({ pressed }) => [s.tecla, pressed && { backgroundColor: cores.primariaSuave }]}
              accessibilityRole="button"
              accessibilityLabel={t === 'apagar' ? 'Apagar' : t === 'bio' ? 'Usar biometria' : t}
            >
              {t === 'apagar' ? (
                <Ionicons name="backspace-outline" size={26} color={cores.texto} />
              ) : t === 'bio' ? (
                <Ionicons name="finger-print" size={30} color={cores.primaria} />
              ) : (
                <Text style={s.numero}>{t}</Text>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 32 },
  bolinhas: { flexDirection: 'row', gap: 16 },
  bolinha: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: cores.primaria },
  cheia: { backgroundColor: cores.primaria },
  erro: { borderColor: cores.perigo, backgroundColor: cores.perigo },
  teclado: { flexDirection: 'row', flexWrap: 'wrap', width: 288, justifyContent: 'space-between', rowGap: 14 },
  tecla: { width: 84, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  numero: { fontSize: 30, fontWeight: '500', color: cores.texto },
});
