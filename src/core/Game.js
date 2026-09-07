// src/core/Game.js — Central game controller.
// Owns all mutable gameplay state, the finite-state machine and the main loop.
// Coordinates Renderer / UIManager / SoundEngine / SaveSystem. No DOM work here.

import { GAME_STATES, ACTIVE_STATES, CONFIG } from '../config.js';
import {
    WEAPONS_DB, EVOLUTIONS_DB, PASSIVES_DB, HEROES_DB, ENEMIES_DB, BOSSES_DB, ENEMY_SPAWN_WEIGHTS,
} from '../data.js';
import { createPlayer, recalculateStats } from './Player.js';
import { RNG } from '../engine/RNG.js';

export class Game {
    constructor({ ui, audio, save, renderer }) {
        this.ui = ui; this.audio = audio; this.save = save; this.renderer = renderer;

        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.drops = [];
        this.floatingTexts = [];

        this.keys = {};
        this.mouse = { x: 0, y: 0, isDown: false, worldX: 0, worldY: 0 };

        this.camera = {
            x: 0, y: 0, zoom: 0.70, targetZoom: 0.70,
            update(targetX, targetY) {
                this.x += (targetX - this.x) * 0.1;
                this.y += (targetY - this.y) * 0.1;
                this.zoom += (this.targetZoom - this.zoom) * 0.1;
            }
        };

        this.rng = new RNG();
        this.waveNumber = 1;
        this.gameTime = 0;
        this.waveTimer = 0;
        this.bossActive = false;
        this.bossSpawnedThisWave = false;
        this._bossShopTimer = null;
        this._loopId = null;
        this.state = GAME_STATES.MENU;
    }

    get isRunning() { return ACTIVE_STATES.has(this.state); }

    get snapshot() {
        return {
                        state: this.state, camera: this.camera, player: this.player,
            enemies: this.enemies, projectiles: this.projectiles, particles: this.particles,
            drops: this.drops, floatingTexts: this.floatingTexts, mouse: this.mouse,
        };
    }

    /* ---------------- state machine ---------------- */
    setState(newState) {
        this.state = newState;
        if (ACTIVE_STATES.has(newState)) {
            this.ui.setHudVisible(true);
            this.ui.closeAllModals();
        }
        if (newState === GAME_STATES.CHARACTER_SELECT) {
            this.ui.setHudVisible(false);
            this.ui._setVisible('modalCharacterSelect', true);
        }
        if (newState === GAME_STATES.GAME_OVER) {
            this.ui.setHudVisible(false);
        }
        return this.state;
    }

    resetRunState() {
        this.player = null;
        this.enemies = []; this.projectiles = []; this.particles = []; this.drops = []; this.floatingTexts = [];
        this.waveNumber = 1; this.gameTime = 0; this.waveTimer = 0; this.bossActive = false; this.bossSpawnedThisWave = false;
        if (this._bossShopTimer) clearTimeout(this._bossShopTimer);
        this._bossShopTimer = null;
        this.camera.x = 0; this.camera.y = 0; this.camera.zoom = 0.70; this.camera.targetZoom = 0.70;
        this.keys = {};
        this.mouse = { x: 0, y: 0, isDown: false, worldX: 0, worldY: 0 };
    }

    applySettings() {
        const s = this.save.settings;
        this.audio.muted = s.muted;
        this.audio.sfxVolume = s.sfxVolume;
        this.audio.masterVolume = s.masterVolume;
        if (this.ui._el.btnToggleSound) this.ui._el.btnToggleSound.innerText = this.audio.muted ? '🔇' : '🔊';
        if (this.ui._el.sliderSfxVol) this.ui._el.sliderSfxVol.value = Math.round(this.audio.sfxVolume * 100);
        if (this.ui._el.sfxVolLabel) this.ui._el.sfxVolLabel.innerText = `${Math.round(this.audio.sfxVolume * 100)}%`;
        if (this.ui._el.sliderMasterVol) this.ui._el.sliderMasterVol.value = Math.round(this.audio.masterVolume * 100);
        if (this.ui._el.masterVolLabel) this.ui._el.masterVolLabel.innerText = `${Math.round(this.audio.masterVolume * 100)}%`;
    }

    startNewGame(heroType) {
        const unlocked = this.save.evaluateUnlocks();
        unlocked.forEach(id => this.ui.notifyNewUnlock(id));
        this.audio.init();
        this.resetRunState();
        this.rng = new RNG(((Date.now() ^ (Math.random() * 0x100000000)) >>> 0));
        this.player = createPlayer(heroType);
        this.addWeapon(HEROES_DB[heroType].starterWeapon);
        recalculateStats(this.player);
        this.setState(GAME_STATES.PLAYING);
        this.ui.updateHud();
        this.ui.renderInventoryHud();
    }

            returnToMenu() {
        if (this._bossShopTimer) clearTimeout(this._bossShopTimer);
        this._bossShopTimer = null;
        this.ui.closeAllModals();
        this.setState(GAME_STATES.CHARACTER_SELECT);
    }

    /* --------------------------- game tick --------------------------- */
    update() {
        if (!this.isRunning || !this.player) return;
        const p = this.player;
        this.gameTime++;
        this.waveTimer++;

        // Wave end → merchant shop (only when no boss alive and no shop already queued)
        if (this.waveTimer >= CONFIG.WAVE_DURATION_FRAMES) {
            const bossAlive = this.enemies.some(e => e.isBoss);
            if (bossAlive || this._bossShopTimer !== null) {
                this.waveTimer = CONFIG.WAVE_DURATION_FRAMES - 1; // keep waiting for boss
            } else {
                this.waveTimer = 0;
                this.waveNumber++;
                this.bossSpawnedThisWave = false;
                this.ui.openMerchantShop();
                return;
            }
        }
        // Boss spawn on schedule (once per wave, exact frame not required)
        if (!this.bossSpawnedThisWave && this.waveTimer >= CONFIG.BOSS_SPAWN_FRAME && this.waveNumber % CONFIG.BOSS_WAVE_INTERVAL === 0) {
            this.bossSpawnedThisWave = true;
            this.spawnBoss();
        }

        this.mouse.worldX = (this.mouse.x - this.renderer.canvas.width / 2) / this.camera.zoom + this.camera.x;
        this.mouse.worldY = (this.mouse.y - this.renderer.canvas.height / 2) / this.camera.zoom + this.camera.y;
        this.camera.update(p.x, p.y);

        // Dash / cooldown timers
        if (p.dashCooldown > 0) p.dashCooldown--;
        if (p.isDashing) { p.dashTimer--; if (p.dashTimer <= 0) p.isDashing = false; }
        if (p.invulnerableTimer > 0) p.invulnerableTimer--;

        // Movement (WASD / arrows)
        let moveX = 0, moveY = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) moveY -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) moveY += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;
        if (moveX !== 0 && moveY !== 0) { moveX *= 0.7071; moveY *= 0.7071; }
        p.vx += moveX * p.accel;
        p.vy += moveY * p.accel;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;
        p.angle = Math.atan2(this.mouse.worldY - p.y, this.mouse.worldX - p.x);

        // HP regen
        if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.hpRegen);

        this.updateWeapons();
        this.spawnEnemies();
        this.resolveProjectiles();
        this.resolveEnemyCollision();
        this.resolveDrops();
        this.resolveEffects();

        this.ui.updateHud();
        this.renderer.renderMinimap(p, this.enemies);
    }

    spawnEnemies() {
        if (this.enemies.length >= CONFIG.MAX_ENEMIES_BASE + this.waveNumber * CONFIG.MAX_ENEMIES_PER_WAVE) return;
        const rate = Math.min(CONFIG.SPAWN_RATE_CAP, CONFIG.SPAWN_RATE_BASE + Math.min(0.2, this.waveNumber * CONFIG.SPAWN_RATE_PER_WAVE));
        if (!this.rng.chance(rate)) return;

        const canvas = this.renderer.canvas;
        const angle = this.rng.next() * Math.PI * 2;
        const spawnDist = (Math.max(canvas.width, canvas.height) / this.camera.zoom) * 0.6 + 100;
        const x = this.player.x + Math.cos(angle) * spawnDist;
        const y = this.player.y + Math.sin(angle) * spawnDist;

        const type = this._pickEnemyType();
        const db = ENEMIES_DB[type];
        if (!db) return;
        const hpScale = 1 + (this.waveNumber - 1) * CONFIG.HP_SCALE_PER_WAVE;
        const isElite = this.rng.chance(Math.min(CONFIG.ELITE_CHANCE_CAP, this.waveNumber * CONFIG.ELITE_CHANCE_PER_WAVE));
        const eliteMult = isElite ? CONFIG.ELITE_HP_MULT : 1;

        this.enemies.push({
            x, y,
            radius: isElite ? db.eliteRadius : db.radius,
            hp: db.baseHp * hpScale * eliteMult,
            maxHp: db.baseHp * hpScale * eliteMult,
            speed: db.speed,
            damage: db.damage * (isElite ? CONFIG.ELITE_DAMAGE_MULT : 1),
            color: isElite ? (db.eliteColor || '#facc15') : db.color,
            type,
            xpValue: isElite ? db.eliteXp : db.xpValue,
            isElite
        });
    }

    _pickEnemyType() {
        const w = {};
        let total = 0;
        for (const [k, v] of Object.entries(ENEMY_SPAWN_WEIGHTS)) {
            const weight = Math.max(0, v.base + v.perWave * (this.waveNumber - 1));
            w[k] = weight; total += weight;
        }
        let r = this.rng.next() * total;
        for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) return k; }
        return 'crawler';
    }

    spawnBoss() {
        this.bossActive = true;
        this.setState(GAME_STATES.BOSS_FIGHT);
        this.audio.bossSpawn();
        this.audio.playAmbient(this.waveNumber);
        const angle = this.rng.next() * Math.PI * 2;
        const x = this.player.x + Math.cos(angle) * 600;
        const y = this.player.y + Math.sin(angle) * 600;
        const def = BOSSES_DB.void_titan;
        const bossHp = def.baseHp * (1 + (this.waveNumber - 1) * CONFIG.BOSS_HP_SCALING);
        const boss = {
            x, y, radius: def.radius, hp: bossHp, maxHp: bossHp,
            speed: def.speed, damage: def.damage, color: def.color,
            type: 'boss', isBoss: true, name: `TITÁN DEL VACÍO (OLEADA ${this.waveNumber})`,
            xpValue: def.xpValue
        };
                this.enemies.push(boss);
        this.ui.showToast(`¡ATENCIÓN: Se ha engendrado ${boss.name}!`, '⚠️');
    }

    updateWeapons() {
        const p = this.player;
        p.weapons.forEach(w => {
            w.timer++;
            const cd = w.cooldown * p.cooldownMultiplier;

            if (w.isPrimary && this.mouse.isDown && w.timer >= cd) {
                w.timer = 0;
                const ang = p.angle;
                if (w.type === 'arc') {
                    this.audio.slash();
                    this.projectiles.push({
                        type: 'arc', x: p.x, y: p.y,
                        radius: (w.range + w.level * 10) * p.areaMultiplier,
                        damage: w.baseDamage * (1 + (w.level - 1) * 0.2) * p.might,
                        duration: w.duration, timer: 0, angle: ang,
                        color: w.isEvolved ? '#f59e0b' : '#818cf8'
                    });
                } else if (w.type === 'cluster') {
                    this.audio.shoot();
                    const count = 3 + Math.floor(w.level / 2);
                    for (let i = 0; i < count; i++) {
                        const spread = ang + (i - (count - 1) / 2) * 0.18;
                        this.projectiles.push({
                            type: 'bullet', x: p.x, y: p.y,
                            vx: Math.cos(spread) * w.speed, vy: Math.sin(spread) * w.speed,
                            radius: w.isEvolved ? 11 : 7,
                            damage: w.baseDamage * (1 + (w.level - 1) * 0.2) * p.might,
                            color: w.isEvolved ? '#f43f5e' : '#c084fc', life: 100
                        });
                    }
                } else if (w.type === 'projectile') {
                    this.audio.shoot();
                    this.projectiles.push({
                        type: 'bullet', x: p.x, y: p.y,
                        vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
                        radius: 6,
                        damage: w.baseDamage * (1 + (w.level - 1) * 0.25) * p.might,
                        color: '#f472b6', life: 110
                    });
                }
            }

            if (!w.isPrimary) {
                if (w.type === 'aura' && this.gameTime % w.tickRate === 0) {
                    const r = (w.radius + w.level * 8) * p.areaMultiplier;
                    const dmg = w.baseDamage * (1 + (w.level - 1) * 0.2) * p.might;
                    this.enemies.forEach(e => {
                        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (e.radius + r) ** 2) this.damageEnemy(e, dmg, false);
                    });
                } else if (w.type === 'orbit') {
                    this.updateOrbiters(w, p);
                }
            }
        });
    }

    updateOrbiters(w, p) {
        const targetCount = w.count;
        if (!w.orbiters) w.orbiters = [];
        while (w.orbiters.length < targetCount) {
            w.orbiters.push({ angle: (w.orbiters.length / targetCount) * Math.PI * 2, x: p.x, y: p.y });
        }
        if (w.orbiters.length > targetCount) w.orbiters.length = targetCount;
        const orbR = (w.radius + w.level * 5) * p.areaMultiplier;

        w.orbiters.forEach(o => {
            o.angle += w.speed;
            o.x = p.x + Math.cos(o.angle) * orbR;
            o.y = p.y + Math.sin(o.angle) * orbR;
        });

                if (this.gameTime % CONFIG.ORBIT_DAMAGE_TICK === 0) {
            const dmg = w.baseDamage * (1 + (w.level - 1) * 0.2) * p.might;
            w.orbiters.forEach(o => {
                this.enemies.forEach(e => {
                    if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (e.radius + 4) ** 2) this.damageEnemy(e, dmg, false);
                });
            });
        }
    }

    resolveProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const pr = this.projectiles[i];
            pr.x += (pr.vx || 0); pr.y += (pr.vy || 0);
            if (pr.timer !== undefined) pr.timer++;

            if (pr.type === 'bullet') {
                pr.life--;
                this.enemies.forEach(e => {
                    if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 < (e.radius + pr.radius) ** 2) {
                        this.damageEnemy(e, pr.damage);
                        pr.life = 0;
                    }
                });
                if (pr.life <= 0) this.projectiles.splice(i, 1);
            } else if (pr.type === 'arc') {
                if (pr.timer === 1) {
                    this.enemies.forEach(e => {
                        if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 < (e.radius + pr.radius) ** 2) {
                            this.damageEnemy(e, pr.damage);
                        }
                    });
                }
                if (pr.timer >= pr.duration) this.projectiles.splice(i, 1);
            }
        }
    }

    resolveEnemyCollision() {
        const p = this.player;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            e.x += Math.cos(a) * e.speed;
            e.y += Math.sin(a) * e.speed;

            if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < (p.radius + e.radius) ** 2) {
                if (p.invulnerableTimer <= 0) {
                    const net = Math.max(1, e.damage - p.armor);
                    p.hp -= net / 8;
                    this.audio.hit();
                    if (p.hp <= 0) { this.triggerGameOver(); return; }
                }
            }
        }
    }

    resolveDrops() {
        const p = this.player;
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            const distSq = (p.x - d.x) ** 2 + (p.y - d.y) ** 2;
            if (distSq < p.magnetRange ** 2) {
                const a = Math.atan2(p.y - d.y, p.x - d.x);
                d.x += Math.cos(a) * 8; d.y += Math.sin(a) * 8;
            }
            if (distSq < (p.radius + 12) ** 2) {
                if (d.type === 'xp') this.gainXp(d.value);
                if (d.type === 'gold') { p.gold += d.value; this.audio.pickup(); }
                this.drops.splice(i, 1);
            }
        }
    }

    resolveEffects() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx; pt.y += pt.vy; pt.life--;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 0.7; ft.life--;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

        /* ---------------- combat / progression ---------------- */
    damageEnemy(enemy, rawDamage, canCrit = true) {
        let isCrit = false;
        let finalDamage = rawDamage;
        if (canCrit && this.rng.chance(this.player.critChance)) {
            isCrit = true;
            finalDamage *= this.player.critDamage;
        }
        enemy.hp -= finalDamage;
        this.audio.hit();

        if (this.player.lifesteal > 0) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + finalDamage * this.player.lifesteal);
        }
        this.createFloatingText(
            Math.round(finalDamage),
            enemy.x + (this.rng.next() * 16 - 8), enemy.y - 12,
            isCrit ? '#facc15' : '#ffffff', isCrit ? 22 : 14
        );

        if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    killEnemy(enemy) {
        this.audio.kill();
        this.player.kills++;
        this.save.addStat('totalKills', 1);

        const color = enemy.isBoss ? '#f59e0b' : (enemy.isElite ? '#a855f7' : '#38bdf8');
        this.drops.push({ x: enemy.x, y: enemy.y, value: enemy.xpValue, type: 'xp', color });

        if (this.rng.chance(CONFIG.GOLD_DROP_CHANCE) || enemy.isElite || enemy.isBoss) {
            this.drops.push({
                x: enemy.x + (this.rng.next() * 12 - 6),
                y: enemy.y + (this.rng.next() * 12 - 6),
                value: enemy.isBoss ? CONFIG.BOSS_GOLD_DROP : (enemy.isElite ? CONFIG.ELITE_GOLD_DROP : Math.floor(this.rng.next() * 4 + 1)),
                type: 'gold', color: '#eab308'
            });
        }

        if (enemy.isBoss) {
            this.bossActive = false;
            this.setState(GAME_STATES.PLAYING);
            this.save.addStat('bossKills', 1);
            this.save.evaluateUnlocks().forEach(id => this.ui.notifyNewUnlock(id));
            this.ui.showToast('¡JEFE DERROTADO! Abriendo Tienda del Mercader...', '🏆');
            if (this._bossShopTimer) clearTimeout(this._bossShopTimer);
            this._bossShopTimer = setTimeout(() => this.ui.openMerchantShop(), 1500);
        }

        const idx = this.enemies.indexOf(enemy);
        if (idx > -1) this.enemies.splice(idx, 1);
    }

    gainXp(amount) {
        this.player.xp += amount;
        if (this.player.xp >= this.player.nextXp) {
            this.player.xp -= this.player.nextXp;
            this.player.level++;
            this.player.nextXp = Math.floor(this.player.nextXp * CONFIG.XP_SCALING);
            this.audio.levelUp();
            this.ui.showLevelUpModal();
        }
    }

    addWeapon(weaponId) {
        const def = WEAPONS_DB[weaponId];
        if (!def) return;
        const existing = this.player.weapons.find(w => w.id === weaponId);
        if (existing) {
            existing.level++;
            this.checkWeaponEvolution(existing);
        } else if (this.player.weapons.length < CONFIG.MAX_WEAPONS) {
            this.player.weapons.push({ ...def, level: 1, timer: 0 });
        }
        this.ui.renderInventoryHud();
    }

    addPassive(passiveId) {
        const def = PASSIVES_DB[passiveId];
        if (!def) return;
        const existing = this.player.passives.find(p => p.id === passiveId);
        if (existing) existing.level++;
        else if (this.player.passives.length < CONFIG.MAX_PASSIVES) this.player.passives.push({ ...def, level: 1 });
        recalculateStats(this.player);
        this.player.weapons.forEach(w => this.checkWeaponEvolution(w));
        this.ui.renderInventoryHud();
    }

        checkWeaponEvolution(weapon) {
        if (weapon.level >= CONFIG.EVO_THRESHOLD && weapon.evolutionId && !this.player.evolutions.includes(weapon.evolutionId)) {
            const evo = EVOLUTIONS_DB[weapon.evolutionId];
            const hasReq = this.player.passives.some(p => p.id === weapon.requiredPassive);
            if (evo && hasReq) {
                this.player.evolutions.push(weapon.evolutionId);
                Object.assign(weapon, evo, { isEvolved: true });
                this.audio.evolve();
                this.createFloatingText('¡ARMA EVOLUCIONADA!', this.player.x, this.player.y - 50, '#f59e0b', 26);
            }
        }
    }

    /* ---------------- economy ---------------- */
    consumeGold(amount) {
        if (this.player.gold >= amount) { this.player.gold -= amount; return true; }
        return false;
    }

    generateShopItems() {
        const items = [
            { id: 'heal50', title: 'Poción Mayor de Vida', icon: '🧪', desc: 'Restaura el 50% de tu Salud Máxima inmediatamente.', price: 35 },
            { id: 'elixir_might', title: 'Elixir de Fuerza Berserker', icon: '🍷', desc: 'Aumenta tu Daño Global (Might) un +15% de forma permanente.', price: 70 },
            { id: 'elixir_armor', title: 'Inyección de Placa Rúnica', icon: '🛡️', desc: 'Aumenta la Armadura en +4 puntos permanentes.', price: 55 },
            { id: 'elixir_speed', title: 'Tónico de Velocidad', icon: '⚡', desc: 'Incrementa la Velocidad de Movimiento un +10%.', price: 50 },
            { id: 'elixir_crit', title: 'Ojo del Halcón Voraz', icon: '👁️', desc: 'Aumenta la Probabilidad de Ataque Crítico un +10%.', price: 65 },
        ];
        this.rng.shuffle(items);
        return items.slice(0, 3);
    }

    applyShopItem(id) {
        const p = this.player;
        if (id === 'heal50') {
            p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
            this.ui.showToast('¡Salud restaurada!', '💖');
        } else if (id === 'elixir_might') {
            p.permanentMight += 0.15;
            this.ui.showToast('¡Daño aumentado +15%!', '🥊');
        } else if (id === 'elixir_armor') {
            p.permanentArmor += 4;
            this.ui.showToast('¡Armadura +4!', '🛡️');
        } else if (id === 'elixir_speed') {
            p.permanentSpeed *= 1.10;
            this.ui.showToast('¡Velocidad +10%!', '👟');
        } else if (id === 'elixir_crit') {
            p.permanentCrit += 0.10;
            this.ui.showToast('¡Prob. Crítico +10%!', '🎯');
        }
        recalculateStats(p);
        this.ui.updateStatsGrid();
    }

    /* ---------------- draft options ---------------- */
    generateUpgradeOptions() {
        const p = this.player;
        const options = [];

        Object.keys(WEAPONS_DB).forEach(id => {
            const existing = p.weapons.find(w => w.id === id);
            if (existing && existing.level < CONFIG.WEAPON_MAX_LEVEL && !existing.isEvolved) {
                options.push({ type: 'weapon', id, title: `Mejorar ${existing.name}`, desc: `${existing.desc} (Niv. ${existing.level} → ${existing.level + 1})`, icon: existing.icon, badge: 'ARMA' });
            } else if (!existing && p.weapons.length < CONFIG.MAX_WEAPONS) {
                const def = WEAPONS_DB[id];
                options.push({ type: 'weapon', id, title: `Nueva Arma: ${def.name}`, desc: def.desc, icon: def.icon, badge: 'NUEVA ARMA' });
            }
        });

        Object.keys(PASSIVES_DB).forEach(id => {
            const ex = p.passives.find(w => w.id === id);
            if (ex && ex.level < CONFIG.PASSIVE_MAX_LEVEL) {
                options.push({ type: 'passive', id, title: `Mejorar ${ex.name}`, desc: `${ex.desc} (Niv. ${ex.level} → ${ex.level + 1})`, icon: ex.icon, badge: 'RELIQUIA' });
            } else if (!ex && p.passives.length < CONFIG.MAX_PASSIVES) {
                const def = PASSIVES_DB[id];
                options.push({ type: 'passive', id, title: `Nueva Reliquia: ${def.name}`, desc: def.desc, icon: def.icon, badge: 'NUEVA RELIQUIA' });
            }
        });

        options.push(
            { type: 'stat', stat: 'heal', title: 'Curación Mayor', desc: 'Restaura un 40% de la Salud Máxima.', icon: '💖', badge: 'CURACIÓN' },
            { type: 'stat', stat: 'hp', title: 'Salud Máxima', desc: 'Aumenta la Salud Máxima en +20 y sana.', icon: '❤️', badge: 'ESTADÍSTICA' },
            { type: 'stat', stat: 'gold', title: 'Bolsa de Oro', desc: 'Obtienes +50 Monedas de Oro inmediatamente.', icon: '🪙', badge: 'RECOMPENSA' }
        );
        return options;
    }

    applyUpgrade(opt) {
        const p = this.player;
        if (opt.type === 'weapon') this.addWeapon(opt.id);
        else if (opt.type === 'passive') this.addPassive(opt.id);
        else if (opt.type === 'stat') {
            if (opt.stat === 'heal') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
            if (opt.stat === 'hp') { p.maxHp += 20; p.hp += 20; }
            if (opt.stat === 'gold') p.gold += 50;
        }
        this.ui.updateHud();
    }

    /* ---------------- game over ---------------- */
    triggerGameOver() {
        if (this.state === GAME_STATES.GAME_OVER) return;
        this.setState(GAME_STATES.GAME_OVER);
        const totalSec = Math.floor(this.gameTime / 60);
        this.save.recordRun({ wave: this.waveNumber, time: totalSec, kills: this.player.kills, gold: this.player.gold });
        this.ui.showGameOver({ time: totalSec, level: this.player.level, kills: this.player.kills, gold: this.player.gold, wave: this.waveNumber });
    }

    /* ---------------- input (wired by main.js) ---------------- */
    onKeyDown(e) {
        this.keys[e.code] = true;
        if (e.code === 'KeyP' || e.code === 'Escape') this.ui.togglePauseMenu();
        if (e.code === 'Space') this.triggerDash();
    }
    onKeyUp(e) { this.keys[e.code] = false; }
    onMouseMove(e) { this.mouse.x = e.clientX; this.mouse.y = e.clientY; }
    onMouseDown(e) {
        if (e.button === 0) this.mouse.isDown = true;
        if (e.button === 2) { e.preventDefault(); this.triggerDash(); }
    }
    onMouseUp(e) { if (e.button === 0) this.mouse.isDown = false; }

    /* ---------------- dash / effects ---------------- */
    triggerDash() {
        const p = this.player;
        if (!p || !this.isRunning) return;
        if (p.dashCooldown <= 0 && (p.vx !== 0 || p.vy !== 0)) {
            p.dashCooldown = CONFIG.DASH_COOLDOWN;
            p.isDashing = true;
            p.dashTimer = CONFIG.DASH_DURATION;
            p.invulnerableTimer = CONFIG.DASH_INVULN;
            p.vx *= CONFIG.DASH_BOOST;
            p.vy *= CONFIG.DASH_BOOST;
            this.audio.dash();
            for (let i = 0; i < CONFIG.DASH_PARTICLES; i++) {
                this.particles.push({
                    x: p.x, y: p.y,
                    vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                    life: 18, color: '#38bdf8'
                });
            }
        }
    }

    createFloatingText(text, x, y, color = '#ffffff', size = 16) {
        this.floatingTexts.push({ text, x, y, color, size, life: 45, maxLife: 45 });
    }

    spawnParticle(x, y, color = '#ffffff', count = 6) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
                life: 24, color
            });
        }
    }

    /* ---------------- loop ---------------- */
    startLoop() { if (!this._loopId) this._loopId = requestAnimationFrame(() => this.gameLoop()); }
    stopLoop() { if (this._loopId) { cancelAnimationFrame(this._loopId); this._loopId = null; } }
    gameLoop() {
        this.update();
        this.renderer.render(this.snapshot);
        this._loopId = requestAnimationFrame(() => this.gameLoop());
    }
}
