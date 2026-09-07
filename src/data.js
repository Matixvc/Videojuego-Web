// src/data.js — Data-driven definitions for all game content.
// Weapons, Evolutions, Passives, Enemies, Bosses, Heroes & Biomes.
// Balancing lives here; the engine never hard-codes a weapon stat.

import { CONFIG } from './config.js';

// ----------------------------------------------------------------------------
// Weapons
//   type: 'arc' (directional swing), 'cluster' (shotgun), 'projectile' (rifle)
//         'aura' (automatic AoE tick), 'orbit' (circling orbs)
//   isPrimary=true  -> activated by holding Left Click
//   isPrimary=false -> activates automatically
//   evolutionId    -> granted when weapon reaches EVO_THRESHOLD + requiredPassive
// ----------------------------------------------------------------------------
export const WEAPONS_DB = {
    sword: {
        id: 'sword', name: 'Espada Estelar', icon: '⚔️',
        desc: 'Tajo en arco direccional con Clic Izquierdo.',
        type: 'arc', baseDamage: 34, cooldown: 26, range: 120, duration: 12,
        isPrimary: true,
        evolutionId: 'evo_sword', requiredPassive: 'might'
    },
    orbs: {
        id: 'orbs', name: 'Orbes Arcanos', icon: '🔮',
        desc: 'Dispara ráfagas de orbes penetrantes hacia donde apuntas.',
        type: 'cluster', baseDamage: 24, cooldown: 22, speed: 10,
        isPrimary: true,
        evolutionId: 'evo_orbs', requiredPassive: 'cooldown'
    },
    lightning: {
        id: 'lightning', name: 'Daga Relámpago', icon: '⚡',
        desc: 'Dagas hiper-veloces lanzadas al hacer Clic Izquierdo.',
        type: 'projectile', baseDamage: 30, cooldown: 17, speed: 15,
        isPrimary: true,
        evolutionId: 'evo_lightning', requiredPassive: 'haste'
    },
    scythe: {
        id: 'scythe', name: 'Guadaña de Almas', icon: '☠️',
        desc: 'Arco oscuro circular que roba vida de los enemigos caídos.',
        type: 'arc', baseDamage: 38, cooldown: 32, range: 130, duration: 14,
        isPrimary: true,
        evolutionId: 'evo_scythe', requiredPassive: 'vampire'
    },
    fire_aura: {
        id: 'fire_aura', name: 'Aura de Fuego', icon: '🔥',
        desc: 'Zona ardiente pasiva que daña en área constantemente.',
        type: 'aura', baseDamage: 12, tickRate: 12, radius: 90,
        isPrimary: false,
        evolutionId: 'evo_aura', requiredPassive: 'area'
    },
    orbiters: {
        id: 'orbiters', name: 'Escudos Giratorios', icon: '🛡️',
        desc: 'Orbes de energía que giran en torno al personaje.',
        type: 'orbit', baseDamage: 18, count: 2, speed: 0.05, radius: 100,
        isPrimary: false,
        evolutionId: 'evo_orbit', requiredPassive: 'armor'
    },
};

// ----------------------------------------------------------------------------
// Evolutions — applied via Object.assign onto the weapon when requirements met.
// ----------------------------------------------------------------------------
export const EVOLUTIONS_DB = {
    evo_sword:     { id: 'evo_sword', name: 'Cercenador Estelar Eximio', icon: '🌌', desc: 'Tajos celestiales continuos en 360° con daño masivo.', baseDamage: 85, cooldown: 14, range: 170, duration: 18, type: 'arc' },
    evo_orbs:      { id: 'evo_orbs', name: 'Singularidad de Agujero Negro', icon: '🌀', desc: 'Orbes gigantes que atraen enemigos y explotan.', baseDamage: 70, cooldown: 15, speed: 12, type: 'cluster' },
    evo_lightning: { id: 'evo_lightning', name: 'Tormenta Voltaica Infinita', icon: '⚡⚡', desc: 'Cascada implacable de dagas encadenadas.', baseDamage: 75, cooldown: 8, speed: 18, type: 'projectile' },
    evo_scythe:    { id: 'evo_scythe', name: 'Guadaña de la Parca', icon: '☠️✨', desc: 'Gran arco de aniquilación que cura masivamente al héroe.', baseDamage: 95, cooldown: 20, range: 180, duration: 20, type: 'arc' },
    evo_aura:      { id: 'evo_aura', name: 'Supernova Infernal', icon: '💥', desc: 'Aura pulsante gigante con explosiones periódicas.', baseDamage: 38, tickRate: 8, radius: 160, type: 'aura' },
    evo_orbit:     { id: 'evo_orbit', name: 'Aegis Inviolable', icon: '🛡️✨', desc: 'Anillo denso de escudos protectores impenetrables.', baseDamage: 45, count: 6, speed: 0.08, radius: 120, type: 'orbit' },
};

// ----------------------------------------------------------------------------
// Passives (Reliquias)
// ----------------------------------------------------------------------------
export const PASSIVES_DB = {
    might:    { id: 'might', name: 'Guantelete de Fuerza', icon: '🥊', desc: 'Aumenta el Daño global en +15%.', stat: 'might', value: 0.15 },
    armor:    { id: 'armor', name: 'Placa Rúnica', icon: '🛡️', desc: 'Reduce el daño recibido en +3.', stat: 'armor', value: 3 },
    haste:    { id: 'haste', name: 'Botas de Mercurio', icon: '👟', desc: 'Aumenta la Velocidad de Movimiento en +12%.', stat: 'moveSpeed', value: 0.12 },
    cooldown: { id: 'cooldown', name: 'Reloj Cósmico', icon: '⏳', desc: 'Aumenta la Cadencia de Ataque en +10%.', stat: 'cooldown', value: 0.10 },
    area:     { id: 'area', name: 'Anillo de Expansión', icon: '🌀', desc: 'Aumenta el Área de todos los ataques en +15%.', stat: 'area', value: 0.15 },
    magnet:   { id: 'magnet', name: 'Gema Magnética', icon: '🧲', desc: 'Aumenta el Rango de Recolección en +40%.', stat: 'magnet', value: 0.40 },
    vampire:  { id: 'vampire', name: 'Colmillo Vampírico', icon: '🩸', desc: 'Otorga +1.5% de Robo de Vida en cada impacto.', stat: 'vampire', value: 0.015 },
    crit:     { id: 'crit', name: 'Ojo de Halcón', icon: '🎯', desc: 'Aumenta la Probabilidad de Crítico en +10%.', stat: 'crit', value: 0.10 },
};

// ----------------------------------------------------------------------------
// Heroes (Campeones)
// ----------------------------------------------------------------------------
export const HEROES_DB = {
    knight: {
        id: 'knight', name: 'Paladín del Umbral', icon: '⚔️', color: '#6366f1',
        role: 'Tanque / Daño', baseHp: 140, baseArmor: 6, baseSpeed: 3.8,
        starterWeapon: 'sword',
        flavor: '❤️ Salud: +40%  🛡️ Armadura: +6  ⚔️ Arma: Espada Estelar'
    },
    mage: {
        id: 'mage', name: 'Arcanista del Vacío', icon: '🔮', color: '#a855f7',
        role: 'Magia / Distancia', baseHp: 90,
        starterWeapon: 'orbs',
        flavor: '⏳ Cooldown: -15%  🌀 Área: +25%  🔮 Arma: Orbes Arcanos'
    },
    ranger: {
        id: 'ranger', name: 'Cazador Neón', icon: '🏹', color: '#ec4899',
        role: 'Veloz / Crítico', baseHp: 100, baseSpeed: 4.6, baseCrit: 0.20,
        starterWeapon: 'lightning',
        flavor: '👟 Vel. Movimiento: +20%  🎯 Crítico: +15%  ⚡ Arma: Daga Relámpago'
    },
    reaper: {
        id: 'reaper', name: 'Segador de Almas', icon: '☠️', color: '#10b981',
        role: 'Sanguinario / Híbrido', baseHp: 110, baseMight: 1.1, baseLifesteal: 0.03,
        starterWeapon: 'scythe',
        flavor: '🩸 Robo de Vida: 3%  🥊 Daño Base: +10%  ☠️ Arma: Guadaña de Almas'
    },
};

// Unlock order: first two are always available, the rest unlock via meta-progress.
export const HERO_UNLOCK_ORDER = ['knight', 'mage', 'ranger', 'reaper'];

// ----------------------------------------------------------------------------
// Enemies
//   base stats scale by (1 + (wave-1)*HP_SCALE_PER_WAVE); elites get ELITE_* mults.
// ----------------------------------------------------------------------------
export const ENEMIES_DB = {
    crawler: { id: 'crawler', name: 'Reptador', radius: 12, baseHp: 24, speed: 2.0, damage: 8, color: '#ef4444', eliteRadius: 18, xpValue: 10, eliteXp: 35 },
    runner: { id: 'runner', name: 'Zángano', radius: 9, baseHp: 15, speed: 3.5, damage: 6, color: '#f97316', eliteRadius: 14, xpValue: 12, eliteXp: 40 },
    brute: { id: 'brute', name: 'Bruto', radius: 22, baseHp: 100, speed: 1.3, damage: 20, color: '#8b5cf6', eliteRadius: 28, xpValue: 35, eliteXp: 85 },
};

// Spawn weights are recomputed each wave (more brutes/later-game types as waves climb).
export const ENEMY_SPAWN_WEIGHTS = {
    crawler: { base: 0.60, perWave: 0.01 },
    runner: { base: 0.25, perWave: 0.01 },
    brute: { base: 0.15, perWave: 0.02 },
};

export const BOSSES_DB = {
    // Only one boss archetype for now; more will be added as biomes unlock.
    void_titan: {
        id: 'void_titan', name: 'TITÁN DEL VACÍO', icon: '⚠️',
        radius: CONFIG.BOSS_RADIUS, baseHp: CONFIG.BOSS_HP_BASE,
        speed: CONFIG.BOSS_SPEED, damage: CONFIG.BOSS_DAMAGE, color: '#dc2626',
        xpValue: 500
    },
};

// ----------------------------------------------------------------------------
// Biomes / Floors (structure for future wave-based theme progression).
// ----------------------------------------------------------------------------
export const BIOMES_DB = {
    void_outskirts: {
        id: 'void_outskirts', name: 'Fuera del Vacío', floorRange: [1, 3],
        enemyWeight: { crawler: 0.7, runner: 0.25, brute: 0.05 },
        boss: 'void_titan',
        tint: 'rgba(99,102,241,0.06)'
    },
    nexus_core: {
        id: 'nexus_core', name: 'Núcleo del Nexo', floorRange: [4, 6],
        enemyWeight: { crawler: 0.4, runner: 0.4, brute: 0.2 },
        boss: 'void_titan',
        tint: 'rgba(168,85,247,0.08)'
    },
};

export function getBiomeForWave(wave) {
    for (const b of Object.values(BIOMES_DB)) {
        if (wave >= b.floorRange[0] && wave <= b.floorRange[1]) return b;
    }
    return BIOMES_DB.nexus_core;
}

// ----------------------------------------------------------------------------
// Textures (optional local PNGs); the renderer falls back to procedural art.
// ----------------------------------------------------------------------------
export const LOCAL_ASSETS_CONFIG = {
    knight: 'assets/heroes/knight.png',
    mage: 'assets/heroes/mage.png',
    ranger: 'assets/heroes/ranger.png',
    reaper: 'assets/heroes/reaper.png',
    crawler: 'assets/enemies/crawler.png',
    runner: 'assets/enemies/runner.png',
    brute: 'assets/enemies/brute.png',
    boss: 'assets/enemies/boss.png',
        ground: 'assets/ground.jpeg',
};

