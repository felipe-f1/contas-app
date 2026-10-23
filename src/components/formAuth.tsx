import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cores } from '../lib/tema';
import { estilos } from './ui';

export function TelaAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.tela}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <View style={s.marca}>
            <View style={s.logo}>
              <Ionicons name="wallet-outline" size={34} color="#fff" />
            </View>
            <Text style={s.titulo}>{titulo}</Text>
            {!!subtitulo && <Text style={s.subtitulo}>{subtitulo}</Text>}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function CampoEmail({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={estilos.input}
      value={valor}
      onChangeText={(t) => onChange(t.trim())}
      placeholder="seu@email.com"
      placeholderTextColor={cores.textoSuave}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
      accessibilityLabel="E-mail"
    />
  );
}

export function CampoSenha({
  valor,
  onChange,
  placeholder = 'Senha',
  nova = false,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  nova?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <View style={s.senha}>
      <TextInput
        style={[estilos.input, { flex: 1, paddingRight: 48 }]}
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={cores.textoSuave}
        secureTextEntry={!visivel}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={nova ? 'new-password' : 'current-password'}
        textContentType={nova ? 'newPassword' : 'password'}
        accessibilityLabel={placeholder}
      />
      <Pressable
        onPress={() => setVisivel((v) => !v)}
        style={s.olho}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visivel ? 'Esconder senha' : 'Mostrar senha'}
      >
        <Ionicons name={visivel ? 'eye-off-outline' : 'eye-outline'} size={22} color={cores.textoSuave} />
      </Pressable>
    </View>
  );
}

export function CampoCodigo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={[estilos.input, s.codigo]}
      value={valor}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 8))}
      placeholder="000000"
      placeholderTextColor={cores.borda}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      accessibilityLabel="Código recebido por e-mail"
      autoFocus
    />
  );
}

export function Mensagem({ texto, tipo = 'erro' }: { texto: string | null; tipo?: 'erro' | 'info' }) {
  if (!texto) return null;
  return <Text style={[s.msg, tipo === 'erro' ? s.msgErro : s.msgInfo]}>{texto}</Text>;
}

export function Link({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Text style={s.link} onPress={onPress} accessibilityRole="link">
      {texto}
    </Text>
  );
}

const s = StyleSheet.create({
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  marca: { alignItems: 'center', gap: 8, marginBottom: 16 },
  logo: { width: 68, height: 68, borderRadius: 20, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.texto, textAlign: 'center' },
  subtitulo: { fontSize: 15, color: cores.textoSuave, textAlign: 'center', lineHeight: 21 },
  senha: { flexDirection: 'row', alignItems: 'center' },
  olho: { position: 'absolute', right: 14 },
  codigo: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  msg: { padding: 12, borderRadius: 10, fontSize: 14, lineHeight: 19 },
  msgErro: { backgroundColor: cores.perigoSuave, color: cores.perigo },
  msgInfo: { backgroundColor: cores.primariaSuave, color: cores.primaria },
  link: { color: cores.primaria, fontWeight: '600', fontSize: 15, textAlign: 'center', padding: 8 },
});
