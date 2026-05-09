# 🧟 Zombie Defender — Guia de Torres e Zumbis

## 📊 Escala de Upgrades
Todas as torres podem ser melhoradas até **3 níveis** (clique na torre colocada). Cada nível aplica:
- **Dano:** +55%
- **Alcance:** +12%
- **Cadência:** ×0.82 (18% mais rápida)

---

## 🔫 Torres (Armas)

| Torre | Custo | Dano Base | DPS* | Alcance | Tipo | Especial |
|:---|:---:|:---:|:---:|:---:|:---|:---|
| **Espinhos** | $5 | 6 | 4.6 | 1.5 | `physical` | Dano de contato. **Não atinge voadores.** |
| **Pistola** | $10 | 9 | 11.3 | 2.5 | `physical` | Tiro básico confiável. |
| **Metralhadora** | $30 | 11 | 28.9 | 3.0 | `physical` | Alta cadência, excelente DPS inicial. |
| **Veneno** | $40 | 4 | 5.7 | 2.5 | `poison` | Desacelera (55%), aplica dano ao tempo. **Quebra armadura de gelo.** |
| **Radar** | $100 | 60 | 40.0 | 7.0 | `energy` | Alcance enorme, dano alto por tiro. |
| **Robô** | $120 | 22 | 40.0 | 3.5 | `physical` | Alto DPS consistente. |
| **Foguete** | $150 | 30 | 23.1 | 4.0 | `explosive` | Dano em área (splash radius 1.3). |
| **Tesla** | $200 | 80 | 72.7 | 4.0 | `energy` | Raios em cadeia (atinge até 3 alvos extras). |
| **Radioativa** | $250 | 100 | 40.0 | 2.5 | `energy` | Pulso circular AoE instantâneo. |

> *DPS = Dano por Segundo (baseado no cooldown base, sem upgrades).

### 🧩 Tipos de Dano e Imunidades
- **`physical`**: Ineficaz contra Esqueleto e Fantasma (dano 0).
- **`energy`**: Ignora imunidades físicas. Melhor contra hordas mistas.
- **`explosive`**: Bom contra aglomerados, mas alguns zumbis podem ter resistência.
- **`poison`**: Útil para controle de multidão e contra Zumbi Gelo.

---

## 🧟 Zumbis

| Zumbi | Round | HP Rel. | Vel. | Traços | Fraqueza / Como Matar |
|:---|:---:|:---:|:---:|:---|:---|
| **Normal** | 1 | 1.0x | 1.0x | Nenhum | Qualquer torre. |
| **Tanque** | 2 | 2.6x | 0.7x | Pesado, chifres | Metralhadora, Robô, Tesla. |
| **Rápido** | 3 | 0.55x | 1.7x | Leve | Veneno (para frear), Radar (alcance). |
| **Voador** | 4 | 0.85x | 1.2x | Voa em bandos | **Espinhos NÃO funcionam.** Use Radar, Tesla, Foguete. |
| **Esqueleto** | 5 | 0.75x | 1.05x | **Imune a `physical`**, imune a slow | Use **Tesla, Radar, Radioativa, Foguete** (energia/explosivo). |
| **Fantasma** | 6 | 0.5x | 1.0x | **Imune a `physical`**, 45% chance de desviar | Energia (Tesla/Radar) ou Veneno. |
| **Venenoso** | 7 | 1.0x | 0.95x | Envenena torres ao morrer | Robô, Metralhadora (matar rápido antes que chegue). |
| **Bombista** | 8 | 0.7x | 0.9x | Explode ao morrer | Manter distância, usar Radar/Tesla para eliminar à distância. |
| **Gelo** | 9 | 1.6x | 0.85x | **Congela torres**, imune a slow | **Veneno** quebra a armadura de gelo primeiro, depois qualquer torre. |
| **Bebê** | 10 | 0.3x | 1.9x | Cabeça grande, muito rápido | Veneno (freia), Metralhadora (DPS bruto). |
| **Rei Zumbi** | 12 | 11.0x | 0.55x | Boss, coroa, chifres | Combo Tesla + Radioativa + Radar. Focar dano máximo. |

---

## 💡 Combos e Estratégias

### 🛡️ Linha de Frente (Barreira)
- **Espinhos + Veneno**: Espinhos dão dano de contato, Veneno freia e envenena. Ótimo para rounds 1-5.
- **Robô + Metralhadora**: DPS massivo físico para derreter Tanques e Reis.

### ⚡ Contra Imunidades Físicas (Round 5+)
- **Tesla + Radar**: Ambos usam dano `energy`, ignoram imunidade de Esqueletos e Fantasmas.
- **Radioativa**: Pulso AoE em energia, limpa hordas mistas sem se preocupar com imunidades.

### ❄️ Contra Zumbi Gelo (Round 9)
- Coloque **Veneno** na frente. O veneno quebra a armadura de gelo do zumbi, impedindo que ele congele suas outras torres. Depois, o Robô ou Tesla finalizam.

### 💣 Contra Hordas e Voadores
- **Foguete**: Dano em área, excelente quando zumbis se agrupam.
- **Radar**: Alcance 7.0 elimina voadores antes que cruzem o mapa.

### 👑 Contra Rei Zumbi (Round 12)
- HP 11x exige foco total. Posicione **Tesla** (cadeia atinge o Rei e adjacências) + **Radioativa** (dano 100 em área) + **Radar** (alcance longo). Upgrades no nível 3 são obrigatórios.

---

## 📈 Dicas Gerais
1. **Economia**: Venda torres inúteis (50% de reembolso) para financiar upgrades.
2. **Posicionamento**: Torres de longo alcance (Radar, Tesla) ficam atrás; Espinhos/Veneno na frente.
3. **Velocidade**: Use os botões `2x` ou `3x` para pular fases de espera, mas pause (`0x`) para posicionar torres com precisão.
4. **Imunidades**: Se seus tiros mostram `"imune!"`, troque para uma torre de `energy` ou `explosive`.
