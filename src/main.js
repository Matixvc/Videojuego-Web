// src/main.js — Application entry point.
// Wires up all subsystems (Renderer, SoundEngine, SaveSystem, Game, UIManager),
// binds input and kicks off the main loop. Run as an ES module (see index.html).

import { Renderer } from './engine/Renderer.js';
import { SoundEngine } from './engine/SoundEngine.js';
import { SaveSystem } from './store/SaveSystem.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { GAME_STATES, CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const minimapCanvas = document.getElementById('minimapCanvas');

    const audio = new SoundEngine();
    const save = new SaveSystem();
    const renderer = new Renderer(canvas, minimapCanvas);

    // Game is built first with ui:null; UIManager needs a reference to Game, and
    // Game needs UIManager — inject afterwards to break the construction cycle.
    const game = new Game({ renderer, audio, save, ui: null });
    const ui = new UIManager(game, audio, save);
    game.ui = ui;

    game.applySettings();
    game.setState(GAME_STATES.CHARACTER_SELECT); // show character select, hide HUD
    game.startLoop();

    // ---- Input ----
    const onKeyDown = (e) => {
        game.onKeyDown(e);
    };
    const onKeyUp = (e) => game.onKeyUp(e);
    canvas.addEventListener('mousemove', (e) => game.onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => game.onMouseDown(e));
    canvas.addEventListener('mouseup', (e) => game.onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Expose for debugging in dev tools.
    window.__GAME = { game, ui, audio, save, renderer };

    /* ------------------------------------------------------------------
     * Optional headless self-test: append ?autotest to the URL and the
     * engine boots a real run, simulates frames with the REAL canvas
     * renderer, spawns/kills a boss and reports the result in <title>.
     * Used by the automated browser check (never runs in normal play).
     * ------------------------------------------------------------------ */
    if (new URLSearchParams(location.search).has('autotest')) {
        setTimeout(() => {
            try {
                const g = window.__GAME.game;
                const parts = [];
                g.startNewGame('knight');
                parts.push(`boot=${g.state === 'PLAYING'}`);
                for (let i = 0; i < 200; i++) g.update();
                parts.push(`frames=${g.gameTime}`);
                g.waveNumber = 2;
                g.waveTimer = CONFIG.BOSS_SPAWN_FRAME;
                g.update();
                const boss = g.enemies.find(e => e.isBoss);
                parts.push(`boss=${!!boss}`);
                if (boss) { boss.hp = 1; g.damageEnemy(boss, 1); }
                parts.push(`bossDead=${!g.enemies.some(e => e.isBoss)}`);
                parts.push(`state=${g.state}`);
                document.title = `AUTOTEST OK ${parts.join(' ')}`;
            } catch (e) {
                document.title = `AUTOTEST FAIL: ${e.message}`;
            }
        }, 150);
    }
});
