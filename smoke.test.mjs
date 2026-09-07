// Temporary smoke test — validates the refactored modules end to end without a browser.
// Run: node smoke.test.mjs
import { RNG, seedFromDate } from './src/engine/RNG.js';
import { createPlayer, recalculateStats } from './src/core/Player.js';
import { SaveSystem } from './src/store/SaveSystem.js';
import { Game } from './src/core/Game.js';
import { HEROES_DB, WEAPONS_DB, PASSIVES_DB, EVOLUTIONS_DB, BOSSES_DB, ENEMIES_DB } from './src/data.js';
import { CONFIG, GAME_STATES } from './src/config.js';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log('  ✓', msg);
    else { failures++; console.error('  ✗ FAIL:', msg); }
}

// --- RNG determinism ---
{
    const a = new RNG(1234);
    const b = new RNG(1234);
    const seq = [];
    for (let i = 0; i < 10; i++) seq.push(a.next());
    let same = true;
    for (let i = 0; i < 10; i++) if (b.next() !== seq[i]) same = false;
    assert(same, 'RNG is deterministic: same seed → same sequence');
    assert(seq.every(v => v >= 0 && v < 1), 'RNG outputs in [0,1)');
    const c = new RNG(999);
    assert(c.next() !== new RNG(1000).next(), 'Different seeds diverge');
    const dateSeed = seedFromDate('2026-09-06');
    assert(Number.isInteger(dateSeed) && dateSeed > 0, 'seedFromDate produces a valid seed');
}

// --- Player factory + stat recalculation ---
for (const heroType of ['knight', 'mage', 'ranger', 'reaper']) {
    const p = createPlayer(heroType);
    recalculateStats(p);
    assert(p.maxHp > 0 && p.hp === p.maxHp, `Player(${heroType}) starts at full HP (${p.maxHp})`);
    assert(p.might >= 1, `Player(${heroType}) might >= 1`);
    assert(p.moveSpeed > 0, `Player(${heroType}) moveSpeed > 0`);
    assert(p.weapons.length === 0, `Player(${heroType}) starts with no weapons (starter added at run start)`);
}

// --- SaveSystem with localStorage polyfill ---
{
    const store = {};
    global.localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    };
    const save = new SaveSystem();
    assert(save.stats.gamesPlayed === 0, 'SaveSystem defaults: gamesPlayed=0');
    assert(save.isHeroUnlocked('knight'), 'Knight unlocked by default');
    assert(save.isHeroUnlocked('mage'), 'Mage unlocked by default');
    assert(!save.isHeroUnlocked('ranger'), 'Ranger locked initially');

    save.addStat('gamesPlayed', 3);
    const unlocked = save.evaluateUnlocks();
    assert(unlocked.includes('ranger'), 'Ranger unlocks after 3 games');
    assert(save.isHeroUnlocked('ranger'), 'Ranger persisted as unlocked');

    save.recordRun({ wave: 4, time: 120, kills: 50, gold: 200 });
    assert(save.stats.bestWave === 4, 'recordRun updates bestWave');
    assert(save.stats.gamesPlayed === 4, 'recordRun increments gamesPlayed');
    save.reset();
    assert(save.stats.gamesPlayed === 0, 'reset restores defaults');
}

// --- Game construction + a full startNewGame cycle ---
{
    const store = {};
    global.localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    };
    const noop = () => {};
    const ui = new Proxy({}, {
        get: (t, prop) => {
            if (prop === '_el') return {};
            return (...args) => {};
        }
    });
    const audio = { init: noop, dash: noop, slash: noop, shoot: noop, hit: noop, kill: noop, pickup: noop, bossSpawn: noop, playAmbient: noop, evolve: noop, levelUp: noop, muted: false };
    const save = new SaveSystem();
    const renderer = {
        canvas: { width: 1280, height: 720 },
        miniCanvas: { width: 160, height: 160 },
        render: noop, renderMinimap: noop,
    };
    const game = new Game({ ui, audio, save, renderer });
    game.startNewGame('mage');
    assert(game.player !== null, 'startNewGame creates a player');
    assert(game.player.weapons.length === 1, 'starter weapon added');
    assert(game.player.weapons[0].id === 'orbs', 'mage starts with Orbes Arcanos');
    assert(game.state === GAME_STATES.PLAYING, 'game state is PLAYING after start');
    assert(game.snapshot.player === game.player, 'snapshot exposes the player');

    // Weapon upgrade + passive → stats react
    game.addWeapon('fire_aura');
    assert(game.player.weapons.length === 2, 'adding a new weapon works');
    const mightBefore = game.player.might;
    game.addPassive('might');
    assert(game.player.might > mightBefore, 'might passive boosts damage stat');
}

// --- Data integrity ---
{
    assert(Object.keys(WEAPONS_DB).length >= 6, 'All 6 weapons defined');
    assert(Object.keys(EVOLUTIONS_DB).length >= 6, 'All 6 evolutions defined');
    assert(Object.keys(PASSIVES_DB).length === 8, 'All 8 passives defined');
    assert(Object.keys(HEROES_DB).length === 4, 'All 4 heroes defined');
    assert(Object.keys(ENEMIES_DB).length === 3, 'All 3 enemy types defined');
    Object.entries(EVOLUTIONS_DB).forEach(([id, evo]) => {
        assert(evo.type && evo.baseDamage > 0, `Evolution ${id} has type+damage`);
    });
    Object.entries(WEAPONS_DB).forEach(([id, w]) => {
        if (w.evolutionId) assert(EVOLUTIONS_DB[w.evolutionId], `Weapon ${id} evolutionId resolves`);
        if (w.requiredPassive) assert(PASSIVES_DB[w.requiredPassive], `Weapon ${id} requiredPassive resolves`);
    });
    assert(CONFIG.WAVE_DURATION_FRAMES > 0 && CONFIG.BOSS_WAVE_INTERVAL > 0, 'Pacing config intact');
}

console.log(failures === 0 ? '\n✅ ALL SMOKE TESTS PASSED' : `\n❌ ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);