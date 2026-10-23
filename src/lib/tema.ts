import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export const cores = {
  fundo: '#F4F6F8',
  superficie: '#FFFFFF',
  texto: '#14181F',
  textoSuave: '#5E6773',
  borda: '#E2E6EB',
  primaria: '#0E7C66',
  primariaSuave: '#E3F3EF',
  perigo: '#C2362B',
  perigoSuave: '#FBE9E7',
  alerta: '#B86E00',
  alertaSuave: '#FFF3DE',
};

type Icone = ComponentProps<typeof Ionicons>['name'];

export const CATEGORIAS: { nome: string; icone: Icone; cor: string }[] = [
  { nome: 'Moradia', icone: 'home-outline', cor: '#4C6FFF' },
  { nome: 'Luz, água e gás', icone: 'flash-outline', cor: '#E0A100' },
  { nome: 'Internet e celular', icone: 'wifi-outline', cor: '#0097A7' },
  { nome: 'Cartão de crédito', icone: 'card-outline', cor: '#7B4DDB' },
  { nome: 'Mercado', icone: 'cart-outline', cor: '#2E9D52' },
  { nome: 'Transporte', icone: 'car-outline', cor: '#546E7A' },
  { nome: 'Saúde', icone: 'medkit-outline', cor: '#D84343' },
  { nome: 'Educação', icone: 'school-outline', cor: '#3F51B5' },
  { nome: 'Assinaturas', icone: 'play-circle-outline', cor: '#C2185B' },
  { nome: 'Lazer', icone: 'happy-outline', cor: '#F57C00' },
  { nome: 'Impostos', icone: 'document-text-outline', cor: '#6D4C41' },
  { nome: 'Outros', icone: 'ellipsis-horizontal-circle-outline', cor: '#78909C' },
];

export const CATEGORIAS_RECEITA: typeof CATEGORIAS = [
  { nome: 'Salário', icone: 'briefcase-outline', cor: '#0E7C66' },
  { nome: 'Renda extra', icone: 'sparkles-outline', cor: '#2E9D52' },
  { nome: 'Investimentos', icone: 'trending-up-outline', cor: '#00897B' },
  { nome: 'Reembolso', icone: 'return-down-back-outline', cor: '#558B2F' },
  { nome: 'Outras receitas', icone: 'add-circle-outline', cor: '#78909C' },
];

export function categoriasDo(tipo: 'despesa' | 'receita') {
  return tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS;
}

export function categoria(nome: string) {
  return [...CATEGORIAS, ...CATEGORIAS_RECEITA].find((c) => c.nome === nome) ?? CATEGORIAS[CATEGORIAS.length - 1];
}
