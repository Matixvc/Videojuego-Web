// src/core/Player.js — Player state factory & derived-stat recalculation.
// Pure in spirit: a player is a plain data object; stats are recomputed
// from perks (passives) so the same logic powers live gameplay and any
// future "inspect build" screen.

import { HEROES_DB } from '../data.js';
import { PLAYER_DEFAULTS, CONFIG } from '../config.js';

/** Build a fresh player for the chosen hero. */
export function createPlayer(heroType) {
    const hero = HEROES_DB[heroType];
    const p = {
        // movement
        x: 0, y: 0, vx: 0, vy: 0,
        friction: PLAYER_DEFAULTS.friction,
        accel: PLAYER_DEFAULTS.accel,
        radius: PLAYER_DEFAULTS.radius,
        heroType,
        color: hero.color,
        angle: 0,
        // combat stats
        maxHp: hero.baseHp,
        hp: hero.baseHp,
        hpRegen: PLAYER_DEFAULTS.hpRegen,
        armor: hero.baseArmor || 0,
        moveSpeed: hero.baseSpeed || PLAYER_DEFAULTS.moveSpeed,
        might: hero.baseMight || PLAYER_DEFAULTS.might,
        cooldownMultiplier: PLAYER_DEFAULTS.cooldownMultiplier,
        areaMultiplier: PLAYER_DEFAULTS.areaMultiplier,
        magnetRange: PLAYER_DEFAULTS.magnetRangeBase,
        critChance: hero.baseCrit || PLAYER_DEFAULTS.critChance,
        critDamage: PLAYER_DEFAULTS.critDamage,
        lifesteal: hero.baseLifesteal || PLAYER_DEFAULTS.lifesteal,
        // progression
        level: 1, xp: 0, nextXp: CONFIG.XP_BASE, gold: 0, kills: 0,
        // dash
        dashCooldown: 0,
        maxDashCooldown: PLAYER_DEFAULTS.maxDashCooldown,
        isDashing: false,
        dashTimer: 0,
        invulnerableTimer: 0,
                // inventory
        weapons: [],
        passives: [],
        evolutions: [],
        // permanent (shop) bonuses — survive stat recalculation
        permanentMight: 0,
        permanentArmor: 0,
        permanentCrit: 0,
        permanentSpeed: 1.0,
    };
    return p;
}

/** Recompute derived stats from collected passives + hero base. */
export function recalculateStats(player) {
    const hero = HEROES_DB[player.heroType];
        let mightMod = hero.baseMight || 1.0;
    let armorAdd = hero.baseArmor || 0;
    let speedMod = 1.0;
    let cooldownMod = 1.0; // mage has no base modifier in DB; applied via passives
    let areaMod = 1.0;
    let magnetAdd = 0;
    let lifestealAdd = hero.baseLifesteal || 0;
    let critAdd = hero.baseCrit || CONFIG.BASE_CRIT_CHANCE;

    player.passives.forEach(p => {
        if (p.stat === 'might') mightMod += p.value * p.level;
        if (p.stat === 'armor') armorAdd += p.value * p.level;
        if (p.stat === 'moveSpeed') speedMod += p.value * p.level;
        if (p.stat === 'cooldown') cooldownMod -= p.value * p.level;
        if (p.stat === 'area') areaMod += p.value * p.level;
        if (p.stat === 'magnet') magnetAdd += p.value * p.level;
        if (p.stat === 'vampire') lifestealAdd += p.value * p.level;
        if (p.stat === 'crit') critAdd += p.value * p.level;
    });

    // Permanent shop bonuses always survive stat recalculation (bug fix).
    mightMod += player.permanentMight || 0;
    armorAdd += player.permanentArmor || 0;
    speedMod *= player.permanentSpeed || 1.0;
    critAdd += player.permanentCrit || 0;

    // Hero-specific base modifiers that previously lived inline in startNewGame.
    if (player.heroType === 'mage') { cooldownMod = 0.85 * cooldownMod; areaMod *= 1.25; }
    if (player.heroType === 'ranger') speedMod *= 1.0; // base already 4.6 below

    player.might = mightMod;
    player.armor = armorAdd;
    player.moveSpeed = (player.heroType === 'ranger' ? 4.6 : (hero.baseSpeed || CONFIG.PLAYER_BASE_SPEED)) * speedMod;
    player.cooldownMultiplier = Math.max(0.25, cooldownMod);
        player.areaMultiplier = areaMod;
    player.magnetRange = 120 * (1 + magnetAdd);
    player.lifesteal = lifestealAdd;
    player.critChance = critAdd;
}
