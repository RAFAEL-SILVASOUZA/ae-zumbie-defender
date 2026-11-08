/**
 * Conteúdo do overlay de ajuda (versão 3D).
 * Mesma informação do jogo original (monstros, armas, estratégia, como jogar),
 * mas sem desenhar sprites em canvas: usamos um emoji representativo e as
 * estatísticas vêm direto de ZOMBIE_STATS / TOWER_STATS (números idênticos).
 */
const HELP_EMOJI = {
    spike: '🌵', pistol: '🔫', machinegun: '🔫', poison: '☣️', radar: '📡',
    robot: '🤖', rocket: '🚀', tesla: '⚡', radioactive: '☢️', knight: '🐴',
    drone: '🛸', laser: '🔺', mago: '🧙',
    normal: '🧟', tank: '🧟', fast: '🏃', flying: '🦇', skeleton: '💀',
    ghost: '👻', poison_z: '☠️', bomber: '💣', ice: '❄️', baby: '👶', king: '👑'
};

function renderHelpContent() {
    renderMonstersTab();
    renderWeaponsTab();
    renderStrategyTab();
    setupHelpTabs();
}

function renderMonstersTab() {
    const grid = document.getElementById('help-monsters-grid');
    if (!grid) return;
    const entries = Object.entries(ZOMBIE_STATS).filter(([_, s]) => s.weight > 0 || s.isBoss);
    grid.innerHTML = entries.map(([type, stats]) => {
        const badges = [];
        if (stats.immuneTo) stats.immuneTo.forEach(d => badges.push(`<span class="card-badge immune">Imune: ${d}</span>`));
        if (stats.slowImmune) badges.push(`<span class="card-badge immune">Imune: Slow</span>`);
        if (stats.flying) badges.push(`<span class="card-badge special">Voador</span>`);
        if (stats.isBoss) badges.push(`<span class="card-badge boss">BOSS</span>`);
        if (stats.freezesTowers) badges.push(`<span class="card-badge special">Congela Torres</span>`);
        if (stats.poisonous) badges.push(`<span class="card-badge special">Venenoso</span>`);
        if (stats.bomb) badges.push(`<span class="card-badge special">Explosivo</span>`);
        const emoji = HELP_EMOJI[type] || '🧟';
        return `
            <div class="help-card">
                <div class="help-emoji" style="color:${stats.body}">${emoji}</div>
                <h3>${stats.label}</h3>
                <div class="card-stats">
                    <div class="stat-row"><span>HP</span> <strong>${stats.hpMult}x</strong></div>
                    <div class="stat-row"><span>Vel.</span> <strong>${stats.speedMult}x</strong></div>
                    <div class="stat-row"><span>Round</span> <strong>${stats.unlockRound}+</strong></div>
                </div>
                <div class="card-badges">${badges.join('')}</div>
            </div>`;
    }).join('');
}

function renderWeaponsTab() {
    const grid = document.getElementById('help-weapons-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(TOWER_STATS).map(([type, stats]) => {
        const dps = stats.isDrone ? '—' : (stats.damage / (stats.fireRate / 1000)).toFixed(1);
        const rangeGrid = stats.mobile ? '∞' : (stats.range).toFixed(1);
        let specialText = '';
        if (stats.ignoresFlying) specialText = 'Ignora voadores';
        if (stats.splashRadius) specialText = `Área: ${stats.splashRadius.toFixed(1)}`;
        if (stats.chains) specialText = `Cadeia: ${stats.chains}`;
        if (stats.damageType === 'poison') specialText = 'Slow + Dano contínuo';
        if (stats.mobile && !stats.isDrone) specialText = 'Persegue zumbis · Cleave · Holy';
        if (stats.isDrone) specialText = 'Captura voadores e leva ao início';
        if (type === 'laser') specialText = 'Queima tudo que atravessa · Lv6: Plasma';
        return `
            <div class="help-card">
                <canvas width="80" height="80" data-tower="${type}"></canvas>
                <h3>${stats.label}</h3>
                <div class="card-stats">
                    <div class="stat-row"><span>Dano</span> <strong>${stats.damage}</strong></div>
                    <div class="stat-row"><span>DPS</span> <strong>${dps}</strong></div>
                    <div class="stat-row"><span>Alcance</span> <strong>${rangeGrid}</strong></div>
                    <div class="stat-row"><span>Custo</span> <strong>$${stats.cost}</strong></div>
                </div>
                ${specialText ? `<div class="card-special">${specialText}</div>` : ''}
            </div>`;
    }).join('');

    // desenha as miniaturas das armas com o MESMO desenho 2D do tabuleiro
    if (typeof renderHelpWeaponIcons === 'function') renderHelpWeaponIcons();
}

function renderStrategyTab() {
    const container = document.getElementById('help-strategy-content');
    if (!container) return;
    const monsters = Object.entries(ZOMBIE_STATS).filter(([_, s]) => s.weight > 0 || s.isBoss);
    const weapons = Object.keys(TOWER_STATS);
    let cardsHtml = '';
    monsters.forEach(([mType, mStats]) => {
        const rated = weapons.map(wType => ({ type: wType, rating: rateWeaponVsMonster(wType, mType) }));
        rated.sort((a, b) => b.rating - a.rating);
        let rowsHtml = '';
        rated.forEach(({ type: wType, rating }) => {
            let cls = 'regular';
            if (rating === 3) cls = 'best';
            else if (rating === 2) cls = 'good';
            else if (rating <= 0) cls = 'bad';
            const tip = getStrategyTip(wType, mType);
            const showTip = (rating === 3 || rating <= 0) && tip;
            rowsHtml += `
                <div class="weapon-row ${cls}">
                    <span class="weapon-emoji">${HELP_EMOJI[wType] || '🗼'}</span>
                    <span>${TOWER_STATS[wType].label}</span>
                    ${showTip ? `<span class="tip">${tip}</span>` : ''}
                </div>`;
        });
        cardsHtml += `
            <div class="strategy-card">
                <div class="strategy-card-header">
                    <span class="monster-emoji">${HELP_EMOJI[mType] || '🧟'}</span>
                    <span class="monster-label">${mStats.label}</span>
                </div>
                <div class="strategy-card-body">${rowsHtml}</div>
            </div>`;
    });
    container.innerHTML = `<div class="strategy-cards-grid">${cardsHtml}</div>`;
}

function rateWeaponVsMonster(weaponType, monsterType) {
    const wStats = TOWER_STATS[weaponType];
    const mStats = ZOMBIE_STATS[monsterType];
    const dmgType = wStats.damageType;
    if (mStats.immuneTo && mStats.immuneTo.includes(dmgType)) return -1;
    if (weaponType === 'knight') return 3;
    if (weaponType === 'drone') return mStats.flying ? 3 : 0;
    let rating = 2;
    if (mStats.flying && weaponType === 'spike') return 0;
    if (mStats.freezesTowers && weaponType === 'poison') return 3;
    if (weaponType === 'tesla' && mStats.flying) return 3;
    if (mStats.hpMult >= 2 && weaponType === 'radar') return 3;
    if (mStats.flying && weaponType === 'rocket') return 3;
    if (weaponType === 'radioactive') rating = 3;
    if (mStats.speedMult >= 1.5 && weaponType === 'machinegun') rating = 3;
    return rating;
}

function getStrategyTip(weaponType, monsterType) {
    const mStats = ZOMBIE_STATS[monsterType];
    const wStats = TOWER_STATS[weaponType];
    if (mStats.immuneTo && mStats.immuneTo.includes(wStats.damageType)) return `Imune a ${wStats.damageType}!`;
    if (mStats.flying && weaponType === 'spike') return 'Espinhos não atingem voadores!';
    if (mStats.freezesTowers && weaponType === 'poison') return 'Veneno quebra a armadura de gelo!';
    if (weaponType === 'tesla' && mStats.flying) return 'Tesla atinge múltiplos voadores de uma vez!';
    if (mStats.hpMult >= 2 && weaponType === 'radar') return 'Alto dano do Radar derrete tanques!';
    if (weaponType === 'knight') return 'Cavaleiro persegue e ignora imunidades!';
    return '';
}

function setupHelpTabs() {
    const tabs = document.querySelectorAll('.help-tab');
    const contents = document.querySelectorAll('.help-tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            contents.forEach(c => c.classList.toggle('active', c.dataset.content === targetTab));
        });
    });
}
