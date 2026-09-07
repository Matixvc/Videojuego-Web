// src/ui/UIManager.js — All DOM work: HUD, modals, draft, shop, settings.
// Contains ZERO gameplay logic (no damage, no spawning).

import { GAME_STATES, CONFIG } from '../config.js';
import { HEROES_DB } from '../data.js';

export class UIManager {
    constructor(game, audio, save) {
        this.game = game;
        this.audio = audio;
        this.save = save;
        this._el = {};
        this.shopRerollCost = CONFIG.SHOP_REROLL_COST_BASE;
        this.draftRerollCost = CONFIG.DRAFT_REROLL_COST_BASE;
        this._cache();
        this._bindGlobalControls();
        this._bindSettings();
        this._bindHeroCards();
        this._bindShop();
        this._bindDraft();
        this._bindPause();
        this.refreshHeroCards();
    }

    _cache() {
        const ids = [
            'toastBanner','toastIcon','toastMessage','topHud','bottomHud','minimapContainer',
            'hudHeroName','playerLevelText','xpBarFill','xpText','hpBarFill','hpText','dashBarFill','dashStatusText',
            'goldCounter','killCounter','timerCounter','floorIndicator','zoomLevelText',
            'btnZoomIn','btnZoomOut','btnToggleSound','weaponIconsContainer','passiveIconsContainer',
            'bossBarContainer','bossName','bossHpBarFill','bossHpText',
            'modalCharacterSelect','modalShop','shopGoldText','shopCardsContainer','shopRerollCostText',
            'btnShopReroll','btnShopContinue','modalLevelUp','upgradeCardsContainer','rerollCostText',
            'btnReroll','modalPause','btnPause','btnResume','modalGameOver','summaryTime','summaryLevel',
            'summaryKills','summaryGold','summaryFloor','btnRestart',
            'statsGrid','sliderSfxVol','sfxVolLabel','sliderMasterVol','masterVolLabel','btnQuit'
        ];
        ids.forEach(id => { this._el[id] = document.getElementById(id); });
    }

    $(id) { return this._el[id]; }
    formatTime(totalSec) {
        const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const secs = String(totalSec % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }
    _setVisible(id, on) {
        const el = this._el[id];
        if (!el) return;
        if (on) { el.classList.remove('hidden'); el.classList.add('flex'); }
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    }

    showToast(msg, icon = 'ℹ️') {
        const toast = this._el.toastBanner, msgEl = this._el.toastMessage, iconEl = this._el.toastIcon;
        if (!toast || !msgEl) return;
        msgEl.innerText = msg;
        if (iconEl) iconEl.innerText = icon;
        toast.classList.remove('-translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
        clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('-translate-y-20', 'opacity-0');
        }, 2500);
    }

    /* ------------------------------- HUD ------------------------------- */
    updateHud() {
        const p = this.game.player;
        if (this._el.hudHeroName) this._el.hudHeroName.innerText = (HEROES_DB[p.heroType]?.name || 'HÉROE').toUpperCase();
        if (this._el.xpBarFill) this._el.xpBarFill.style.width = `${Math.min(100, (p.xp / p.nextXp) * 100)}%`;
        if (this._el.xpText) this._el.xpText.innerText = `${Math.floor(p.xp)} / ${Math.floor(p.nextXp)} XP`;
        if (this._el.playerLevelText) this._el.playerLevelText.innerText = p.level;

        if (this._el.hpBarFill) this._el.hpBarFill.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
        if (this._el.hpText) this._el.hpText.innerText = `${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;

        const dashPct = p.dashCooldown <= 0 ? 100 : ((p.maxDashCooldown - p.dashCooldown) / p.maxDashCooldown) * 100;
        if (this._el.dashBarFill) this._el.dashBarFill.style.width = `${dashPct}%`;
        if (this._el.dashStatusText) this._el.dashStatusText.innerText = p.dashCooldown <= 0 ? 'LISTO' : `${(p.dashCooldown / 60).toFixed(1)}s`;

        if (this._el.goldCounter) this._el.goldCounter.innerText = p.gold;
        if (this._el.killCounter) this._el.killCounter.innerText = p.kills;
        if (this._el.floorIndicator) this._el.floorIndicator.innerText = `Oleada #${this.game.waveNumber}`;

        const remaining = Math.max(0, Math.ceil((CONFIG.WAVE_DURATION_FRAMES - this.game.waveTimer) / 60));
        if (this._el.timerCounter) this._el.timerCounter.innerText = this.formatTime(remaining);

        const boss = this.game.enemies.find(e => e.isBoss);
        if (boss) {
            this._setVisible('bossBarContainer', true);
            if (this._el.bossName) this._el.bossName.innerText = `⚠️ JEFE: ${boss.name}`;
            if (this._el.bossHpBarFill) this._el.bossHpBarFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
            if (this._el.bossHpText) this._el.bossHpText.innerText = `${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`;
        } else if (this._el.bossBarContainer) {
            this._el.bossBarContainer.classList.add('hidden');
            this._el.bossBarContainer.classList.remove('flex');
        }
    }

    renderInventoryHud() {
        const p = this.game.player;
        if (this._el.weaponIconsContainer) {
            this._el.weaponIconsContainer.innerHTML = p.weapons.map(w =>
                `<div class="w-8 h-8 rounded-lg bg-slate-900 border ${w.isEvolved ? 'border-amber-400 shadow-amber-500/50 shadow-md' : 'border-indigo-500/40'} flex items-center justify-center text-sm relative" title="${w.name} (Niv. ${w.level})">
                    ${w.icon}
                    <span class="absolute -bottom-1 -right-1 text-[9px] bg-slate-950 font-bold px-1 rounded text-amber-300 border border-slate-700">${w.level}</span>
                </div>`
            ).join('');
        }
        if (this._el.passiveIconsContainer) {
            this._el.passiveIconsContainer.innerHTML = p.passives.map(pas =>
                `<div class="w-8 h-8 rounded-lg bg-slate-900 border border-purple-500/40 flex items-center justify-center text-sm relative" title="${pas.name} (Niv. ${pas.level})">
                    ${pas.icon}
                    <span class="absolute -bottom-1 -right-1 text-[9px] bg-slate-950 font-bold px-1 rounded text-purple-300 border border-slate-700">${pas.level}</span>
                </div>`
            ).join('');
        }
    }

    updateStatsGrid() {
        const p = this.game.player;
        const grid = this._el.statsGrid;
        if (!grid) return;
        grid.innerHTML = `
            <div>❤️ Salud: <span class="text-emerald-400">${Math.ceil(p.hp)}/${p.maxHp}</span></div>
            <div>🛡️ Armadura: <span class="text-indigo-400">${p.armor}</span></div>
            <div>👟 Vel. Movimiento: <span class="text-cyan-400">${p.moveSpeed.toFixed(1)}</span></div>
            <div>🥊 Daño (Might): <span class="text-amber-400">+${Math.round((p.might - 1) * 100)}%</span></div>
            <div>🎯 Prob. Crítico: <span class="text-pink-400">${Math.round(p.critChance * 100)}%</span></div>
            <div>🩸 Robo de Vida: <span class="text-red-400">${(p.lifesteal * 100).toFixed(1)}%</span></div>
            <div>⏳ Cadencia: <span class="text-purple-400">${Math.round((1 - p.cooldownMultiplier) * 100)}%</span></div>
            <div>🌀 Área Ataque: <span class="text-emerald-400">+${Math.round((p.areaMultiplier - 1) * 100)}%</span></div>
            <div>🧲 Rango Imán: <span class="text-yellow-400">${Math.round(p.magnetRange)}px</span></div>
        `;
    }

    refreshHeroCards() {
        const unlocks = this.save.data.unlocks.heroes;
        document.querySelectorAll('.hero-card').forEach(card => {
            const hero = card.getAttribute('data-hero');
            const unlocked = unlocks.includes(hero);
            let lock = card.querySelector('.lock-overlay');
            if (!unlocked) {
                card.classList.add('locked', 'opacity-60', 'cursor-not-allowed');
                if (!lock) {
                    const ov = document.createElement('div');
                    ov.className = 'lock-overlay absolute inset-0 rounded-2xl bg-slate-950/80 flex flex-col items-center justify-center gap-1';
                    ov.innerHTML = `<span class="text-3xl">🔒</span><span class="text-[10px] text-slate-400">Bloqueado</span>`;
                    card.appendChild(ov);
                }
            } else {
                card.classList.remove('locked', 'opacity-60', 'cursor-not-allowed');
                if (lock) lock.remove();
            }
        });
    }

        notifyNewUnlock(heroId) {
        this.showToast(`¡Nuevo Campeón desbloqueado: ${HEROES_DB[heroId].name}!`, '🔓');
        this.refreshHeroCards();
    }

    /* --------------------------- global controls --------------------------- */
    _bindGlobalControls() {
        this._el.btnZoomIn?.addEventListener('click', () => {
            this.game.camera.targetZoom = Math.min(1.2, this.game.camera.targetZoom + 0.1);
            this._el.zoomLevelText.innerText = `${this.game.camera.targetZoom.toFixed(1)}x`;
        });
        this._el.btnZoomOut?.addEventListener('click', () => {
            this.game.camera.targetZoom = Math.max(0.4, this.game.camera.targetZoom - 0.1);
            this._el.zoomLevelText.innerText = `${this.game.camera.targetZoom.toFixed(1)}x`;
        });
        this._el.btnToggleSound?.addEventListener('click', () => {
            this.audio.muted = !this.audio.muted;
            this._el.btnToggleSound.innerText = this.audio.muted ? '🔇' : '🔊';
            this.save.setSetting('muted', this.audio.muted);
        });
        this._el.btnRestart?.addEventListener('click', () => this.game.returnToMenu());
    }

    _bindSettings() {
        this._el.sliderSfxVol?.addEventListener('input', e => {
            const val = parseInt(e.target.value);
            this.audio.sfxVolume = val / 100;
            if (this._el.sfxVolLabel) this._el.sfxVolLabel.innerText = `${val}%`;
            this.save.setSetting('sfxVolume', this.audio.sfxVolume);
        });
        this._el.sliderMasterVol?.addEventListener('input', e => {
            const val = parseInt(e.target.value);
            this.audio.masterVolume = val / 100;
            if (this._el.masterVolLabel) this._el.masterVolLabel.innerText = `${val}%`;
            this.save.setSetting('masterVolume', this.audio.masterVolume);
        });
    }

    _bindHeroCards() {
        document.querySelectorAll('.hero-card').forEach(card => {
            card.addEventListener('click', () => {
                const hero = card.getAttribute('data-hero');
                if (this.save.isHeroUnlocked(hero)) this.game.startNewGame(hero);
                else this.showToast('¡Campeón bloqueado! Sigue jugando para desbloquearlo.', '🔒');
            });
        });
    }

    /* --------------------------- pause --------------------------- */
    _bindPause() {
        this._el.btnPause?.addEventListener('click', () => this.togglePauseMenu());
        this._el.btnResume?.addEventListener('click', () => this.togglePauseMenu());
        this._el.btnQuit?.addEventListener('click', () => this.game.returnToMenu());
    }

    togglePauseMenu() {
        if (this.game.state === GAME_STATES.PLAYING || this.game.state === GAME_STATES.BOSS_FIGHT) {
            this._prePauseState = this.game.state;
            this.updateStatsGrid();
            this._setVisible('modalPause', true);
            this.game.setState(GAME_STATES.PAUSED);
        } else if (this.game.state === GAME_STATES.PAUSED) {
            this._setVisible('modalPause', false);
            this.game.setState(this._prePauseState || GAME_STATES.PLAYING);
        }
    }

        setHudVisible(on) {
        this._el.topHud.classList.toggle('opacity-0', !on);
        this._el.bottomHud.classList.toggle('opacity-0', !on);
        this._el.minimapContainer.classList.toggle('opacity-0', !on);
    }

    closeAllModals() {
        ['modalShop', 'modalLevelUp', 'modalPause', 'modalGameOver', 'modalCharacterSelect'].forEach(id => {
            const el = this._el[id];
            if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
        });
    }

        showGameOver({ time, level, kills, gold, wave }) {
        if (this._el.summaryTime) this._el.summaryTime.innerText = this.formatTime(time);
        if (this._el.summaryLevel) this._el.summaryLevel.innerText = level;
        if (this._el.summaryKills) this._el.summaryKills.innerText = kills;
        if (this._el.summaryGold) this._el.summaryGold.innerText = gold;
        if (this._el.summaryFloor) this._el.summaryFloor.innerText = wave;
        this._setVisible('modalGameOver', true);
    }

    /* --------------------------- shop --------------------------- */
    _bindShop() {
        this._el.btnShopReroll?.addEventListener('click', () => this.rerollShop());
        this._el.btnShopContinue?.addEventListener('click', () => {
            this._setVisible('modalShop', false);
            this.game.setState(GAME_STATES.PLAYING);
        });
    }

    rerollShop() {
        if (!this.game.consumeGold(this.shopRerollCost)) {
            this.showToast('¡No tienes suficiente Oro para Reroll!', '❌');
            return;
        }
        this.shopRerollCost += CONFIG.SHOP_REROLL_STEP;
        if (this._el.shopRerollCostText) this._el.shopRerollCostText.innerText = this.shopRerollCost;
        this.generateShopOffers();
        this.updateHud();
    }

    openMerchantShop() {
        this.shopRerollCost = CONFIG.SHOP_REROLL_COST_BASE;
        this.game.setState(GAME_STATES.SHOP);
        if (this._el.shopGoldText) this._el.shopGoldText.innerText = this.game.player.gold;
        if (this._el.shopRerollCostText) this._el.shopRerollCostText.innerText = this.shopRerollCost;
        this._setVisible('modalShop', true);
        this.generateShopOffers();
    }

    generateShopOffers() {
        const container = this._el.shopCardsContainer;
        if (!container) return;
        container.innerHTML = '';
        this.game.generateShopItems().forEach(item => {
            const card = document.createElement('div');
            card.className = 'bg-slate-900 border-2 border-amber-500/40 hover:border-amber-400 p-4 rounded-2xl flex flex-col justify-between text-left card-hover transition group';
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-orbitron border border-amber-500/30">MERCADER</span>
                        <span class="text-3xl">${item.icon}</span>
                    </div>
                    <h3 class="font-orbitron font-bold text-sm text-white group-hover:text-amber-300 transition">${item.title}</h3>
                    <p class="text-xs text-slate-400 mt-1">${item.desc}</p>
                </div>
                <button class="mt-4 w-full bg-amber-600/80 hover:bg-amber-500 text-white font-bold py-2 rounded-xl text-xs transition border border-amber-400/40 flex justify-between items-center px-4">
                    <span>Comprar</span> <span>🪙 ${item.price}</span>
                </button>
            `;
            card.querySelector('button').addEventListener('click', () => {
                if (this.game.consumeGold(item.price)) {
                    this.game.applyShopItem(item.id);
                    if (this._el.shopGoldText) this._el.shopGoldText.innerText = this.game.player.gold;
                    this.updateHud();
                    card.style.opacity = '0.4';
                    const btn = card.querySelector('button');
                    btn.disabled = true;
                    btn.innerText = 'Comprado';
                } else {
                    this.showToast('¡No tienes suficiente Oro!', '❌');
                }
            });
                        container.appendChild(card);
        });
    }

    /* --------------------------- level up / draft --------------------------- */
    _bindDraft() {
        this._el.btnReroll?.addEventListener('click', () => this.rerollDraft());
    }

    rerollDraft() {
        if (!this.game.consumeGold(this.draftRerollCost)) {
            this.showToast('¡No tienes suficiente Oro para Reroll!', '❌');
            return;
        }
        this.draftRerollCost += CONFIG.DRAFT_REROLL_STEP;
        if (this._el.rerollCostText) this._el.rerollCostText.innerText = this.draftRerollCost;
        this.generateUpgradeCards();
    }

    showLevelUpModal() {
        this.game.setState(GAME_STATES.LEVEL_UP);
        this.draftRerollCost = CONFIG.DRAFT_REROLL_COST_BASE;
        if (this._el.rerollCostText) this._el.rerollCostText.innerText = this.draftRerollCost;
        this._setVisible('modalLevelUp', true);
        this.generateUpgradeCards();
    }

    generateUpgradeCards() {
        const container = this._el.upgradeCardsContainer;
        if (!container) return;
        container.innerHTML = '';
        const options = this.game.generateUpgradeOptions();
        this.game.rng.shuffle(options);
        for (let i = 0; i < Math.min(3, options.length); i++) {
            const opt = options[i];
            const card = document.createElement('div');
            card.className = 'bg-slate-900 border-2 border-indigo-500/40 hover:border-amber-400 p-4 rounded-2xl flex flex-col items-center justify-between text-left cursor-pointer card-hover transition group';
            card.innerHTML = `
                <div class="w-full flex justify-between items-center mb-2">
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-orbitron border border-indigo-500/30">${opt.badge}</span>
                    <span class="text-3xl">${opt.icon}</span>
                </div>
                <div class="w-full space-y-1">
                    <h3 class="font-orbitron font-bold text-sm text-white group-hover:text-amber-300 transition">${opt.title}</h3>
                    <p class="text-xs text-slate-400">${opt.desc}</p>
                </div>
                <button class="mt-4 w-full bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs transition border border-indigo-400/40">
                    Seleccionar
                </button>
            `;
            card.addEventListener('click', () => this.applyUpgrade(opt));
            container.appendChild(card);
        }
    }

    applyUpgrade(opt) {
        this.game.applyUpgrade(opt);
        this.renderInventoryHud();
        this._setVisible('modalLevelUp', false);
        this.game.setState(GAME_STATES.PLAYING);
    }
}
