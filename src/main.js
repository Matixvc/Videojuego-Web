// src/main.js — Application entry point.
// Wires up all subsystems (Renderer, SoundEngine, SaveSystem, Game, UIManager),
// binds input and kicks off the main loop. Run as an ES module (see index.html).

import { Renderer } from './engine/Renderer.js';
import { SoundEngine } from './engine/SoundEngine.js';
import { SaveSystem } from './store/SaveSystem.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { GAME_STATES } from './config.js';

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
});
