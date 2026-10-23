// Datas são guardadas como texto local ("YYYY-MM-DD" / "YYYY-MM") para evitar
// problemas de fuso horário: uma conta que vence dia 10 vence dia 10 em qualquer lugar.

export type DataISO = string; // YYYY-MM-DD
export type Mes = string; // YYYY-MM

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function deDate(d: Date): DataISO {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hojeISO(agora: Date = new Date()): DataISO {
  return deDate(agora);
}

export function paraDate(data: DataISO, hora = 0, minuto = 0): Date {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(a, m - 1, d, hora, minuto);
}

export function mesDe(data: DataISO): Mes {
  return data.slice(0, 7);
}

export function mesAtual(agora: Date = new Date()): Mes {
  return mesDe(hojeISO(agora));
}

export function somarMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function diasNoMes(mes: Mes): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

/** Dia 31 em fevereiro vira o último dia do mês. */
export function vencimentoNoMes(mes: Mes, dia: number): DataISO {
  return `${mes}-${pad(Math.min(dia, diasNoMes(mes)))}`;
}

export function somarDias(data: DataISO, n: number): DataISO {
  const d = paraDate(data);
  d.setDate(d.getDate() + n);
  return deDate(d);
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  const utc = (s: DataISO) => {
    const [a, m, d] = s.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

export function nomeMes(mes: Mes): string {
  const [a, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
}

export function formatarData(data: DataISO): string {
  const [, m, d] = data.split('-');
  return `${d}/${m}`;
}

export function descreverPrazo(vencimento: DataISO, hoje: DataISO): string {
  const dias = diasEntre(hoje, vencimento);
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  if (dias > 1) return `Vence em ${dias} dias`;
  if (dias === -1) return 'Venceu ontem';
  return `Venceu há ${-dias} dias`;
}
