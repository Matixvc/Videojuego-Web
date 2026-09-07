// src/store/SaveSystem.js â€” Persistence layer over localStorage.
// Holds settings, lifetime stats, and unlocks. Never throws: a corrupted /
// unavailable store simply resets to defaults so the player is never blocked.

import { SAVE_KEY, SAVE_VERSION, CONFIG } from '../config.js';

const DEFAULTS = {
    settings: {
        masterVolume: 0.8,
        sfxVolume: 0.7,
        muted: false,
    },
    stats: {
        gamesPlayed: 0,
        bossKills: 0,
        totalKills: 0,
        totalGold: 0,
        totalGames: 0,
        bestWave: 1,
        bestTime: 0,
    },
    unlocks: {
        heroes: ['knight', 'mage'], // first two unlocked by default
    },
    version: SAVE_VERSION,
};

export class SaveSystem {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return this._defaults();
            return this._migrate(JSON.parse(raw));
        } catch (e) {
            return this._defaults();
        }
    }

    _defaults() {
        return JSON.parse(JSON.stringify(DEFAULTS));
    }

    _migrate(saved) {
        if (!saved.version) saved.version = SAVE_VERSION;
        if (saved.version < SAVE_VERSION) {
            saved = { ...this._defaults(), ...JSON.parse(JSON.stringify(saved)) };
            saved.version = SAVE_VERSION;
        }
        saved.settings = { ...DEFAULTS.settings, ...(saved.settings || {}) };
        saved.stats = { ...DEFAULTS.stats, ...(saved.stats || {}) };
        saved.unlocks = { ...DEFAULTS.unlocks, ...(saved.unlocks || {}) };
        return saved;
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) { /* storage full / disabled */ }
        return this.data;
    }

    // ---- settings ----
    get settings() { return this.data.settings; }
    setSetting(key, value) {
        this.data.settings[key] = value;
        this.save();
    }
    get stats() { return this.data.stats; }

    // ---- unlocks ----
    isHeroUnlocked(heroId) {
        return this.data.unlocks.heroes.includes(heroId);
    }
    unlockHero(heroId) {
        if (!this.data.unlocks.heroes.includes(heroId)) {
            this.data.unlocks.heroes.push(heroId);
            this.save();
            return true;
        }
        return false;
    }

    // Evaluate unlocks that should fire from lifetime stats. Returns newly unlocked hero ids.
    evaluateUnlocks() {
        const unlocked = [];
        if (this.data.stats.gamesPlayed >= CONFIG.UNLOCK_RANGER_AFTER_GAMES && !this.isHeroUnlocked('ranger')) {
            this.unlockHero('ranger'); unlocked.push('ranger');
        }
        if (this.data.stats.bossKills >= CONFIG.UNLOCK_REAPER_AFTER_BOSS_KILLS && !this.isHeroUnlocked('reaper')) {
            this.unlockHero('reaper'); unlocked.push('reaper');
        }
        this.save();
        return unlocked;
    }

    // Track a finished run; updates bests in one place.
    recordRun({ wave, time, kills, gold }) {
        this.addStat('gamesPlayed', 1);
        this.addStat('totalKills', kills);
        this.addStat('totalGold', gold);
        if (wave > this.data.stats.bestWave) this.data.stats.bestWave = wave;
        if (time > this.data.stats.bestTime) this.data.stats.bestTime = time;
        this.save();
    }

    addStat(key, amount = 1) {
        this.data.stats[key] = (this.data.stats[key] || 0) + amount;
    }

    reset() {
        this.data = this._defaults();
        this.save();
    }

    // ---- export / import (for backups) ----
    export() {
        return JSON.stringify(this.data, null, 2);
    }
    import(json) {
        this.data = this._migrate(JSON.parse(json));
        this.save();
    }
}
