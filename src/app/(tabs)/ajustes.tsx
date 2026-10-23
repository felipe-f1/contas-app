import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Contador } from '../../components/campos';
import { Botao, Cartao, TituloSecao, estilos } from '../../components/ui';
import { type Config, lerConfig, salvarConfig } from '../../lib/db';
import {
  type Calendario,
  enviarNotificacaoTeste,
  limparAgenda,
  listarCalendarios,
  pedirPermissaoNotificacoes,
  sincronizar,
} from '../../lib/sincronizar';
import { cores } from '../../lib/tema';

export default function Ajustes() {
  const db = useSQLiteContext();
  const [config, setConfig] = useState<Config | null>(null);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);

  useFocusEffect(
    useCallback(() => {
      lerConfig(db).then(async (c) => {
        setConfig(c);
        if (c.agendaAtiva) setCalendarios((await listarCalendarios()) ?? []);
      });
    }, [db]),
  );

  async function atualizar(parcial: Partial<Config>) {
    setConfig((c) => (c ? { ...c, ...parcial } : c));
    await salvarConfig(db, parcial);
    sincronizar(db);
  }

  async function alternarAgenda(ativar: boolean) {
    if (!config) return;
    if (!ativar) {
      if (config.agendaId) await limparAgenda(config.agendaId);
      await atualizar({ agendaAtiva: false });
      return;
    }
    const lista = await listarCalendarios();
    if (!lista) {
      Alert.alert('Permissão negada', 'Libere o acesso ao calendário nas configurações do celular.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    if (lista.length === 0) {
      Alert.alert('Nenhum calendário', 'Adicione sua conta Google ao celular para usar o Google Agenda.');
      return;
    }
    setCalendarios(lista);
    const agendaId = lista.some((c) => c.id === config.agendaId) ? config.agendaId : lista[0].id;
    await atualizar({ agendaAtiva: true, agendaId });
  }

  async function escolherCalendario(id: string) {
    if (!config || id === config.agendaId) return;
    if (config.agendaId) await limparAgenda(config.agendaId);
    await atualizar({ agendaId: id });
  }

  async function testar() {
    if (await pedirPermissaoNotificacoes()) await enviarNotificacaoTeste();
    else
      Alert.alert('Notificações desativadas', 'Ative as notificações do app nas configurações do celular.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
      ]);
  }

  if (!config) return null;

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <TituloSecao>Lembretes no celular</TituloSecao>
      <Cartao style={{ gap: 16 }}>
        <Linha titulo="Avisar antes do vencimento" sub={config.diasAntes === 0 ? 'Só no dia' : 'Além do aviso no dia'}>
          <Contador
            valor={config.diasAntes}
            min={0}
            max={10}
            onChange={(diasAntes) => atualizar({ diasAntes })}
            formatar={(n) => (n === 0 ? 'não' : n === 1 ? '1 dia' : `${n} dias`)}
          />
        </Linha>
        <Linha titulo="Horário do aviso">
          <Contador
            valor={config.hora}
            min={5}
            max={22}
            onChange={(hora) => atualizar({ hora })}
            formatar={(n) => `${String(n).padStart(2, '0')}:00`}
          />
        </Linha>
        <Botao titulo="Enviar notificação de teste" variante="secundario" icone="notifications-outline" onPress={testar} />
      </Cartao>

      <TituloSecao>Google Agenda</TituloSecao>
      <Cartao style={{ gap: 12 }}>
        <Linha titulo="Criar eventos na agenda" sub="Cada conta pendente vira um evento com alerta">
          <Switch
            value={config.agendaAtiva}
            onValueChange={alternarAgenda}
            trackColor={{ true: cores.primaria }}
          />
        </Linha>
        {config.agendaAtiva &&
          calendarios.map((c) => {
            const ativo = c.id === config.agendaId;
            return (
              <Pressable
                key={c.id}
                onPress={() => escolherCalendario(c.id)}
                style={s.opcao}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
              >
                <Ionicons name={ativo ? 'radio-button-on' : 'radio-button-off'} size={22} color={cores.primaria} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTitulo}>{c.titulo}</Text>
                  {!!c.conta && <Text style={s.sub}>{c.conta}</Text>}
                </View>
              </Pressable>
            );
          })}
      </Cartao>

      <TituloSecao>E-mail</TituloSecao>
      <Cartao style={s.emBreve}>
        <Ionicons name="mail-outline" size={22} color={cores.textoSuave} />
        <Text style={[s.sub, { flex: 1 }]}>
          Em breve: resumo semanal das contas por e-mail. Exige um pequeno servidor, que é a próxima fase do projeto.
        </Text>
      </Cartao>
    </ScrollView>
  );
}

function Linha({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={s.linha}>
      <View style={{ flex: 1 }}>
        <Text style={s.titulo}>{titulo}</Text>
        {!!sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  sub: { fontSize: 13, color: cores.textoSuave, marginTop: 2, lineHeight: 18 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  opcaoTitulo: { fontSize: 15, color: cores.texto, fontWeight: '500' },
  emBreve: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
