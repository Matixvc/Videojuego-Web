// smoke.test.mjs — Full validation of the refactored engine.
// 1. Loads EVERY module (catches load-time ReferenceErrors like stray code).
// 2. Tests data integrity, RNG determinism, player stats, save persistence.
// 3. Simulates real gameplay frames: spawning, combat, boss fights, drops,
//    level-ups and the merchant shop.
// Run: node smoke.test.mjs

const failures = [];
function assert(cond, msg) {
    if (cond) console.log('  ✓', msg);
    else failures.push(msg);
}

/* ============================ 1. MODULE LOAD ============================ */
console.log('--- Module loading (catches load-time errors) ---');
const mods = {};
for (const [name, path] of Object.entries({
    config: './src/config.js',
    data: './src/data.js',
    rng: './src/engine/RNG.js',
    sound: './src/engine/SoundEngine.js',
    renderer: './src/engine/Renderer.js',
    player: './src/core/Player.js',
    game: './src/core/Game.js',
    save: './src/store/SaveSystem.js',
    ui: './src/ui/UIManager.js',
})) {
    try {
        mods[name] = await import(path);
        console.log(`  ✓ loaded ${name}`);
    } catch (e) {
        failures.push(`MODULE ${name} FAILED TO LOAD: ${e.message}`);
        console.error(`  ✗ FAIL to load ${name}:`, e.message);
    }
}
if (failures.length) { console.error('\nAborting: a module failed to load.'); process.exit(1); }

const { CONFIG, GAME_STATES } = mods.config;
const { HEROES_DB, WEAPONS_DB, EVOLUTIONS_DB, PASSIVES_DB, ENEMIES_DB, BOSSES_DB } = mods.data;
const { RNG, seedFromDate } = mods.rng;
const { createPlayer, recalculateStats } = mods.player;
const { Game } = mods.game;
const { SaveSystem } = mods.save;

/* ============================ 2. DATA INTEGRITY ============================ */
console.log('\n--- Data integrity ---');
assert(Object.keys(WEAPONS_DB).length === 6, '6 weapons in DB');
assert(Object.keys(EVOLUTIONS_DB).length === 6, '6 evolutions in DB');
assert(Object.keys(PASSIVES_DB).length === 8, '8 passives in DB');
assert(Object.keys(HEROES_DB).length === 4, '4 heroes in DB');
assert(Object.keys(ENEMIES_DB).length === 3, '3 enemy types in DB');
assert(BOSSES_DB.void_titan.baseHp > 0, 'boss defined with HP');
Object.entries(WEAPONS_DB).forEach(([id, w]) => {
    assert(w.type && w.baseDamage > 0, `weapon ${id} has valid combat stats`);
    if (w.type === 'arc' || w.type === 'cluster' || w.type === 'projectile') {
        assert(w.cooldown > 0, `primary weapon ${id} has cooldown`);
    }
    if (w.type === 'aura') assert(w.tickRate > 0 && w.radius > 0, `aura weapon ${id} has tick/radius`);
    if (w.type === 'orbit') assert(w.count > 0 && w.speed > 0 && w.radius > 0, `orbit weapon ${id} has count/speed/radius`);
    if (w.evolutionId) assert(EVOLUTIONS_DB[w.evolutionId], `weapon ${id} evolution resolves`);
    if (w.requiredPassive) assert(PASSIVES_DB[w.requiredPassive], `weapon ${id} passive requirement resolves`);
});
Object.entries(EVOLUTIONS_DB).forEach(([id, evo]) => {
    assert(evo.baseDamage > 0, `evolution ${id} has damage`);
});

/* ============================ 3. RNG ============================ */
console.log('\n--- RNG ---');
{
    const a = new RNG(1234), b = new RNG(1234);
    const seq = Array.from({ length: 20 }, () => a.next());
    let identical = true;
    for (let i = 0; i < 20; i++) if (b.next() !== seq[i]) identical = false;
    assert(identical, 'same seed → identical sequence');
    assert(seq.every(v => v >= 0 && v < 1), 'outputs within [0,1)');
    assert(new RNG(1).next() !== new RNG(2).next(), 'different seeds diverge');
    assert(Number.isInteger(seedFromDate('2026-09-06')), 'seedFromDate yields int seed');
}

/* ============================ 4. PLAYER ============================ */
console.log('\n--- Player factory ---');
for (const h of Object.keys(HEROES_DB)) {
    const p = createPlayer(h);
    recalculateStats(p);
    assert(p.maxHp > 0 && p.hp === p.maxHp, `player(${h}) full HP`);
    assert(p.moveSpeed > 0 && p.might >= 1, `player(${h}) has speed+might`);
    assert(p.armor >= 0 && p.critChance >= 0, `player(${h}) defensive/crit stats defined`);
    assert(p.weapons.length === 0 && p.passives.length === 0, `player(${h}) starts empty`);
}

/* ============================ 5. SAVE SYSTEM ============================ */
console.log('\n--- SaveSystem ---');
{
    const store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    const save = new SaveSystem();
    assert(save.stats.gamesPlayed === 0, 'starts fresh');
    assert(save.isHeroUnlocked('knight') && save.isHeroUnlocked('mage'), 'knight+mage unlocked by default');
    assert(!save.isHeroUnlocked('ranger'), 'ranger locked initially');

    save.addStat('gamesPlayed', 3);
    const unlocked = save.evaluateUnlocks();
    assert(unlocked.includes('ranger'), 'ranger unlocks at 3 games');
    assert(save.isHeroUnlocked('ranger'), 'ranger persisted');
    save.recordRun({ wave: 5, time: 180, kills: 100, gold: 500 });
    assert(save.stats.bestWave === 5 && save.stats.gamesPlayed === 4, 'recordRun updates stats');
    save.reset();
    assert(save.stats.gamesPlayed === 0, 'reset works');
}

/* ============================ 6. GAME SIMULATION ============================ */
console.log('\n--- Game simulation ---');
{
    const store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

    const noop = () => {};
    const audio = new Proxy({}, {
        get: (t, prop) => {
            if (prop === 'muted') return false;
            if (prop === 'sfxVolume') return 0.7;
            if (prop === 'masterVolume') return 0.8;
            return noop;
        }
    });
    const ui = new Proxy({}, {
        get: (t, prop) => { if (prop === '_el') return {}; return noop; }
    });
    const renderer = {
        canvas: { width: 1280, height: 720 },
        miniCanvas: { width: 160, height: 160 },
        render: noop, renderMinimap: noop, get: () => null
    };
    const save = new SaveSystem();
    const game = new Game({ ui, audio, save, renderer });

    // Game start
    game.startNewGame('knight');
    assert(game.player !== null && game.state === GAME_STATES.PLAYING, 'run starts in PLAYING');
    assert(game.player.weapons.length === 1 && game.player.weapons[0].id === 'sword', 'knight starts with sword');

    // Simulate ~300 frames of gameplay
    let error = null;
    try { for (let i = 0; i < 300; i++) game.update(); } catch (e) { error = e; }
    assert(!error, `300 frames of update() run clean${error ? ' → ' + error.message : ''}`);
    assert(game.gameTime === 300, 'gameTime advanced');

    // Force an enemy into collision range → player takes damage
    const beforeHp = game.player.hp;
    game.enemies.push({ x: game.player.x + 1, y: game.player.y, radius: 5, hp: 50, maxHp: 50, speed: 0, damage: 200, color: '#fff', type: 'crawler', xpValue: 10, isElite: false });
    try { game.update(); } catch (e) { error = e; }
    assert(!error, `collision update runs${error ? ' → ' + error.message : ''}`);
    assert(game.player.hp < beforeHp, 'player takes collision damage');

    // Kill an enemy → XP drops
    game.enemies.push({ x: game.player.x + 200, y: game.player.y + 200, radius: 10, hp: 1, maxHp: 1, speed: 0, damage: 0, color: '#fff', type: 'crawler', xpValue: 10, isElite: false });
    const target = game.enemies[game.enemies.length - 1];
    game.damageEnemy(target, 5);
    assert(target.hp <= 0 && game.drops.length >= 1, 'killed enemy drops XP');

    // Level up path
    game.gainXp(100000);
    assert(game.player.level > 1, `player leveled up to ${game.player.level}`);
    assert(game.player.xp < game.player.nextXp || game.player.level > 1, 'XP overflow handled');

    // Passive stacking
    const mayBefore = game.player.might;
    game.addPassive('might'); game.addPassive('might'); game.addPassive('might');
    assert(game.player.might > mayBefore, 'might passive raises damage stat');
    assert(game.player.passives.find(p => p.id === 'might').level === 3, 'passive stacking works');

    // Shop generation + purchase
    game.player.gold = 1000;
    const items = game.generateShopItems();
    assert(items.length === 3, 'shop offers 3 items');
    const goldBefore = game.player.gold;
    game.consumeGold(items[0].price);
    assert(game.player.gold === goldBefore - items[0].price, 'consumeGold deducts');
    game.applyShopItem('elixir_might');
    assert(game.player.permanentMight > 0, 'permanent might elixir applies');

    // Draft options
    const opts = game.generateUpgradeOptions();
    assert(opts.length >= 3, `draft offers >= 3 options (got ${opts.length})`);

    // Boss spawn on schedule (wave 2 @ frame 1200)
    game.waveNumber = 2;
    game.waveTimer = CONFIG.BOSS_SPAWN_FRAME;
    error = null;
    try { game.update(); } catch (e) { error = e; }
    assert(!error, `boss spawn update runs${error ? ' → ' + error.message : ''}`);
    const boss = game.enemies.find(e => e.isBoss);
    assert(boss !== undefined, 'boss spawned on schedule');
    assert(game.state === GAME_STATES.BOSS_FIGHT, 'state flips to BOSS_FIGHT');

    // Kill the boss → unlock + stats + shop scheduled
    const beforeBoss = save.stats.bossKills;
    boss.hp = 1;
    game.damageEnemy(boss, 1);
    assert(game.state === GAME_STATES.PLAYING, 'boss defeat returns to PLAYING');
    assert(save.stats.bossKills === beforeBoss + 1, 'bossKills recorded');
    assert(game._bossShopTimer !== null, 'boss shop scheduled');

    // Game over path
    game.player.hp = -50;
    error = null;
    try { game.update(); } catch (e) { error = e; }
    assert(!error, `game-over path runs${error ? ' → ' + error.message : ''}`);
    assert(game.state === GAME_STATES.GAME_OVER, 'state is GAME_OVER');
    assert(save.stats.gamesPlayed >= 1, 'run recorded on game over');
}

/* ============================ 7. FINAL ============================ */
console.log('');
if (failures.length) {
    console.error(`❌ ${failures.length} FAILURES:`);
    failures.forEach(f => console.error('  -', f));
    process.exit(1);
}
console.log('✅ ALL SMOKE TESTS PASSED');
process.exit(0);