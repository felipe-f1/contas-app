import * as Calendar from 'expo-calendar/legacy';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { hojeISO, paraDate, somarDias } from './datas';
import { type Config, type Lancamento, gerarMesesPendentes, lerConfig, listarPendentes } from './db';
import { formatarBRL } from './dinheiro';
import { hashTexto } from './hash';
import { enviarBackup } from './nuvem';
import { planejarLembretes } from './planejarLembretes';

const CANAL_ANDROID = 'vencimentos';
const JANELA_FUTURO_DIAS = 62;
const JANELA_PASSADO_DIAS = 60;
const MARCA = /\[contas-app:\d+:[a-z0-9]+\]/;

// ---------------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------------
export async function configurarNotificacoes() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Vencimento de contas',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function enviarNotificacaoTeste() {
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔔 Teste de lembrete', body: 'Os lembretes de contas estão funcionando.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CANAL_ANDROID },
  });
}

async function agendarNotificacoes(pendentes: Lancamento[], config: Config) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  // Recria tudo do zero: é idempotente e não depende de guardar IDs.
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const a of planejarLembretes(pendentes, config)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: a.titulo, body: a.corpo },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.quando, channelId: CANAL_ANDROID },
    });
  }
}

// ---------------------------------------------------------------------------
// Agenda (Google Agenda via calendário do aparelho)
// ---------------------------------------------------------------------------
export type Calendario = { id: string; titulo: string; conta: string };

export async function listarCalendarios(): Promise<Calendario[] | null> {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  if (!granted) return null;
  const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ehGoogle = (c: Calendar.Calendar) => c.source?.type === 'com.google' || /gmail\.com$/.test(c.source?.name ?? '');
  return calendarios
    .filter((c) => c.allowsModifications)
    .sort((a, b) => Number(ehGoogle(b)) - Number(ehGoogle(a)) || Number(!!b.isPrimary) - Number(!!a.isPrimary))
    .map((c) => ({ id: c.id, titulo: c.title, conta: c.source?.name ?? '' }));
}

/**
 * Deixa o calendário igual ao estado desejado: cada conta pendente tem um evento
 * com uma marca nas notas. Eventos com marca desatualizada (conta paga, editada
 * ou apagada) são removidos; eventos sem a nossa marca nunca são tocados.
 */
async function reconciliarAgenda(calendarioId: string, pendentes: Lancamento[], config: Config) {
  if (!(await Calendar.getCalendarPermissionsAsync()).granted) return;
  const hoje = hojeISO();
  const inicio = paraDate(somarDias(hoje, -JANELA_PASSADO_DIAS));
  const fim = paraDate(somarDias(hoje, JANELA_FUTURO_DIAS + 1));

  const desejados = new Map(pendentes.map((l) => [marcaDe(l, config), l]));
  for (const ev of await Calendar.getEventsAsync([calendarioId], inicio, fim)) {
    const marca = ev.notes?.match(MARCA)?.[0];
    if (!marca) continue;
    if (desejados.has(marca)) desejados.delete(marca);
    else await Calendar.deleteEventAsync(ev.id);
  }

  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo';
  for (const [marca, l] of desejados) {
    const inicioEvento = paraDate(l.vencimento, config.hora);
    const alarmes = [0, ...(config.diasAntes > 0 ? [-config.diasAntes * 24 * 60] : [])];
    await Calendar.createEventAsync(calendarioId, {
      title: `💸 ${l.descricao} — ${formatarBRL(l.valor_centavos)}`,
      startDate: inicioEvento,
      endDate: new Date(inicioEvento.getTime() + 30 * 60_000),
      timeZone: fuso,
      notes: `Conta a pagar (criado pelo app Contas).\n${marca}`,
      alarms: alarmes.map((relativeOffset) => ({ relativeOffset, method: Calendar.AlarmMethod.ALERT })),
    });
  }
}

/** Remove da agenda todos os eventos criados pelo app (ao desativar a integração). */
export async function limparAgenda(calendarioId: string) {
  if (!(await Calendar.getCalendarPermissionsAsync()).granted) return;
  const hoje = hojeISO();
  const eventos = await Calendar.getEventsAsync([calendarioId], paraDate(somarDias(hoje, -400)), paraDate(somarDias(hoje, 400)));
  for (const ev of eventos) if (MARCA.test(ev.notes ?? '')) await Calendar.deleteEventAsync(ev.id);
}

function marcaDe(l: Lancamento, c: Config) {
  const assinatura = [l.descricao, l.valor_centavos, l.vencimento, c.hora, c.diasAntes].join('|');
  return `[contas-app:${l.id}:${hashTexto(assinatura)}]`;
}

// ---------------------------------------------------------------------------
// Ponto único de sincronização: chamado ao abrir o app e após qualquer mudança.
// Execuções são enfileiradas para nunca rodarem em paralelo.
// ---------------------------------------------------------------------------
let fila: Promise<void> = Promise.resolve();

export function sincronizar(db: SQLiteDatabase): Promise<void> {
  fila = fila
    .then(async () => {
      await gerarMesesPendentes(db);
      const config = await lerConfig(db);
      const hoje = hojeISO();
      const pendentes = await listarPendentes(db, somarDias(hoje, JANELA_FUTURO_DIAS));
      await agendarNotificacoes(pendentes, config);
      if (config.agendaAtiva && config.agendaId) {
        const limite = somarDias(hoje, -JANELA_PASSADO_DIAS);
        await reconciliarAgenda(config.agendaId, pendentes.filter((l) => l.vencimento >= limite), config);
      }
      if (config.backupAtivo) await enviarBackup(db).catch((e) => console.warn('Backup adiado', e));
    })
    .catch((e) => console.warn('Falha ao sincronizar lembretes', e));
  return fila;
}
