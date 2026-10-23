import { type DataISO, deDate, diasEntre, formatarData, paraDate, somarDias } from './datas.ts';
import { formatarBRL } from './dinheiro.ts';

export type Pendente = {
  descricao: string;
  valor_centavos: number;
  vencimento: DataISO;
};

export type Agendamento = {
  quando: Date;
  titulo: string;
  corpo: string;
};

export type PreferenciasLembrete = {
  diasAntes: number;
  hora: number;
};

/**
 * Gera os alertas locais: um aviso X dias antes e outro no dia do vencimento.
 * Contas que vencem no mesmo dia são agrupadas numa única notificação, o que
 * também nos mantém abaixo do limite de 64 notificações agendadas do iOS.
 */
export function planejarLembretes(
  pendentes: Pendente[],
  { diasAntes, hora }: PreferenciasLembrete,
  agora: Date = new Date(),
  limite = 60,
): Agendamento[] {
  const grupos = new Map<string, { quando: Date; vencimento: DataISO; contas: Pendente[] }>();

  for (const p of pendentes) {
    const offsets = diasAntes > 0 ? [diasAntes, 0] : [0];
    for (const antes of offsets) {
      const dia = somarDias(p.vencimento, -antes);
      const quando = paraDate(dia, hora);
      if (quando <= agora) continue;
      const chave = `${dia}|${p.vencimento}`;
      const grupo = grupos.get(chave) ?? { quando, vencimento: p.vencimento, contas: [] };
      grupo.contas.push(p);
      grupos.set(chave, grupo);
    }
  }

  return [...grupos.values()]
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .slice(0, limite)
    .map(({ quando, vencimento, contas }) => {
      const dias = diasEntre(deDate(quando), vencimento);
      const prazo = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias (${formatarData(vencimento)})`;
      const total = contas.reduce((s, c) => s + c.valor_centavos, 0);

      if (contas.length === 1) {
        const [c] = contas;
        return {
          quando,
          titulo: dias === 0 ? `⚠️ ${c.descricao} vence hoje` : `📅 ${c.descricao} vence ${prazo}`,
          corpo: `${formatarBRL(c.valor_centavos)} — toque para marcar como paga.`,
        };
      }
      return {
        quando,
        titulo: dias === 0 ? `⚠️ ${contas.length} contas vencem hoje` : `📅 ${contas.length} contas vencem ${prazo}`,
        corpo: `${contas.map((c) => c.descricao).join(', ')} — total ${formatarBRL(total)}`,
      };
    });
}

