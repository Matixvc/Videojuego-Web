// src/config.js — Central balance & engine constants.
// All tunable values live here so gameplay can be balanced without touching logic.

export const GAME_VERSION = '2.0.0-alpha';
export const SAVE_KEY = 'echoes_of_infinity_save';
export const SAVE_VERSION = 1;

export const GAME_STATES = {
    MENU: 'MENU',
    CHARACTER_SELECT: 'CHARACTER_SELECT',
    PLAYING: 'PLAYING',
    BOSS_FIGHT: 'BOSS_FIGHT',        // active, but a boss is alive
    WAVE_TRANSITION: 'WAVE_TRANSITION', // between biomes (future use)
    LEVEL_UP: 'LEVEL_UP',          // draft modal is open
    SHOP: 'SHOP',                  // merchant modal is open
    PAUSED: 'PAUSED',              // pause/settings menu
    GAME_OVER: 'GAME_OVER',
};

// States in which the core update loop is frozen (no movement/combat).
// PLAYING and BOSS_FIGHT keep ticking — everything else pauses time.
export const ACTIVE_STATES = new Set([GAME_STATES.PLAYING, GAME_STATES.BOSS_FIGHT]);

export const CONFIG = {
    // === Pacing ===
    WAVE_DURATION_FRAMES: 3600,       // 60s @ 60fps -> triggers shop / next wave
    BOSS_SPAWN_FRAME: 1200,           // frame within a wave when a boss may spawn
    BOSS_WAVE_INTERVAL: 2,            // boss on every N-th wave

    // === Enemy scaling ===
    MAX_ENEMIES_BASE: 30,
    MAX_ENEMIES_PER_WAVE: 12,
    SPAWN_RATE_BASE: 0.06,
    SPAWN_RATE_PER_WAVE: 0.015,
    SPAWN_RATE_CAP: 0.2,
    HP_SCALE_PER_WAVE: 0.4,
    ELITE_CHANCE_CAP: 0.18,
    ELITE_CHANCE_PER_WAVE: 0.025,
    ELITE_HP_MULT: 2.5,
    ELITE_DAMAGE_MULT: 1.5,

    // === Boss ===
    BOSS_HP_BASE: 1200,
    BOSS_HP_SCALING: 0.75,
    BOSS_DAMAGE: 35,
    BOSS_SPEED: 1.2,
    BOSS_RADIUS: 48,

    // === Progression ===
    XP_BASE: 40,
    XP_SCALING: 1.35,
    WEAPON_MAX_LEVEL: 8,
    PASSIVE_MAX_LEVEL: 5,
    MAX_WEAPONS: 4,
    MAX_PASSIVES: 6,
    EVO_THRESHOLD: 8,

    // === Player combat ===
    PLAYER_RADIUS: 18,
    PLAYER_FRICTION: 0.82,
    PLAYER_ACCEL: 0.95,
    PLAYER_BASE_SPEED: 4.0,
    PLAYER_HP_REGEN: 0.02,
    CRIT_DAMAGE: 2.0,
    BASE_CRIT_CHANCE: 0.08,

    // === Dash ===
    DASH_COOLDOWN: 100,
    DASH_DURATION: 12,
    DASH_INVULN: 20,
    DASH_BOOST: 2.8,
    DASH_PARTICLES: 12,

    // === Orbit weapon (Escudos Giratorios / Aegis) ===
    ORBIT_DAMAGE_TICK: 15,            // frames between damage ticks (anti-spam floating text)

    // === Economy ===
    SHOP_REROLL_COST_BASE: 25,
    SHOP_REROLL_STEP: 15,
    DRAFT_REROLL_COST_BASE: 25,
    DRAFT_REROLL_STEP: 15,
    GOLD_DROP_CHANCE: 0.28,
    ELITE_GOLD_DROP: 20,
    BOSS_GOLD_DROP: 60,

    // === Unlock progression (meta) ===
    UNLOCK_RANGER_AFTER_GAMES: 3,
    UNLOCK_REAPER_AFTER_BOSS_KILLS: 1,
};

export const PLAYER_DEFAULTS = {
    friction: CONFIG.PLAYER_FRICTION,
    accel: CONFIG.PLAYER_ACCEL,
    radius: CONFIG.PLAYER_RADIUS,
    moveSpeed: CONFIG.PLAYER_BASE_SPEED,
    hpRegen: CONFIG.PLAYER_HP_REGEN,
    armor: 0,
    might: 1.0,
    cooldownMultiplier: 1.0,
    areaMultiplier: 1.0,
    magnetRangeBase: 120,
    critChance: CONFIG.BASE_CRIT_CHANCE,
    critDamage: CONFIG.CRIT_DAMAGE,
    lifesteal: 0,
    maxDashCooldown: CONFIG.DASH_COOLDOWN,
};

export const HERO_BASE_STATS = {
    knight:  { baseHp: 140, baseArmor: 6, baseSpeed: 3.8 },
    mage:    { baseHp: 90 },
    ranger:  { baseHp: 100, baseSpeed: 4.6, baseCrit: 0.20 },
    reaper:  { baseHp: 110, baseMight: 1.1, baseLifesteal: 0.03 },
};
