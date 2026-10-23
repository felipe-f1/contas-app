#!/usr/bin/env python3
"""Gera todos os ícones do app e as artes da loja a partir de SVG, usando o Chromium.

Uso: python3 scripts/gerar-icones.py   (precisa do Chromium; caminho em CHROMIUM)
"""
import os
import subprocess

from PIL import Image
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')

VERDE, VERDE_ESCURO, AMARELO = '#0E7C66', '#08594A', '#FFC94D'

def calendario(cor_corpo='#FFFFFF', cor_topo=AMARELO, cor_argola='#DDF2EC', cor_check=VERDE):
    """Calendário com check, num viewBox 100x100 centrado."""
    return f'''
      <rect x="18" y="24" width="64" height="58" rx="11" fill="{cor_corpo}"/>
      <path d="M18 35a11 11 0 0 1 11-11h42a11 11 0 0 1 11 11v6H18z" fill="{cor_topo}"/>
      <rect x="32" y="15" width="7" height="17" rx="3.5" fill="{cor_argola}"/>
      <rect x="61" y="15" width="7" height="17" rx="3.5" fill="{cor_argola}"/>
      <path d="M35 61l9.5 9.5L66 49" fill="none" stroke="{cor_check}" stroke-width="8.5"
            stroke-linecap="round" stroke-linejoin="round"/>'''

def fundo_degrade():
    return f'''<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#13A085"/><stop offset="1" stop-color="{VERDE_ESCURO}"/></linearGradient></defs>
      <rect width="100" height="100" fill="url(#g)"/>'''

def svg(conteudo, viewbox='0 0 100 100'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" width="100%" height="100%">{conteudo}</svg>'

def escala(conteudo, fator):
    """Encolhe o desenho em volta do centro (zona segura do ícone adaptativo)."""
    d = 50 * (1 - fator)
    return f'<g transform="translate({d} {d}) scale({fator})">{conteudo}</g>'

ICONE = svg(fundo_degrade() + escala(calendario(), 0.92))
ADAPTATIVO_FRENTE = svg(escala(calendario(), 0.62))   # Android corta até 1/3 nas bordas
ADAPTATIVO_FUNDO = svg(fundo_degrade())
# Monocromático (ícones temáticos do Android 13+): silhueta única, check vazado.
_VAZADO = '''<path d="M35 61l9.5 9.5L66 49" fill="none" stroke="black" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="18" y="39" width="64" height="4" fill="black"/>'''
MONOCROMATICO = svg(f'''<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect width="100" height="100" fill="white"/>{escala(_VAZADO, 0.62)}</mask></defs>
    <g mask="url(#m)">{escala(calendario('#FFF', '#FFF', '#FFF', '#FFF'), 0.62)}</g>''')
SPLASH = svg(escala(calendario(cor_corpo=VERDE, cor_argola=VERDE_ESCURO, cor_check='#FFFFFF'), 0.9))

BANNER = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="100%" height="100%">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#13A085"/><stop offset="1" stop-color="{VERDE_ESCURO}"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="900" cy="80" r="190" fill="#FFFFFF" opacity="0.06"/>
  <circle cx="120" cy="470" r="150" fill="#FFFFFF" opacity="0.05"/>
  <g transform="translate(70 90) scale(3.2)">{calendario()}</g>
  <text x="420" y="225" font-family="Roboto, 'Noto Sans', Arial, sans-serif" font-size="76" font-weight="800" fill="#FFFFFF">Contas em Dia</text>
  <text x="422" y="295" font-family="Roboto, 'Noto Sans', Arial, sans-serif" font-size="34" fill="#DDF2EC">Lembretes de contas e controle</text>
  <text x="422" y="340" font-family="Roboto, 'Noto Sans', Arial, sans-serif" font-size="34" fill="#DDF2EC">dos gastos do mês, no celular.</text>
</svg>'''

def renderizar(svg_texto, destino, largura, altura):
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / 'i.html'
        html.write_text(f'<html><body style="margin:0;background:transparent">'
                        f'<div style="width:{largura}px;height:{altura}px">{svg_texto}</div></body></html>')
        bruto = Path(tmp) / 'bruto.png'
        # A área visível do headless é menor que a janela: renderiza com folga e recorta.
        subprocess.run([CHROMIUM, '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                        '--default-background-color=00000000', f'--window-size={largura},{altura + 200}',
                        f'--screenshot={bruto}', html.as_uri()], check=True, capture_output=True)
        Image.open(bruto).crop((0, 0, largura, altura)).save(destino)
    print('✓', destino.relative_to(RAIZ), f'{largura}x{altura}')

alvos = [
    (ICONE, 'assets/icon.png', 1024, 1024),
    (ADAPTATIVO_FRENTE, 'assets/android-icon-foreground.png', 512, 512),
    (ADAPTATIVO_FUNDO, 'assets/android-icon-background.png', 512, 512),
    (MONOCROMATICO, 'assets/android-icon-monochrome.png', 432, 432),
    (SPLASH, 'assets/splash-icon.png', 1024, 1024),
    (ICONE, 'assets/favicon.png', 48, 48),
    (ICONE, 'loja/icone-512.png', 512, 512),
    (BANNER, 'loja/banner-1024x500.png', 1024, 500),
]
for conteudo, caminho, l, a in alvos:
    renderizar(conteudo, RAIZ / caminho, l, a)
