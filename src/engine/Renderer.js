// src/engine/Renderer.js — All canvas drawing (main view + minimap).
// Stateless w.r.t. game logic: it receives a render snapshot and draws it.

import { LOCAL_ASSETS_CONFIG } from '../data.js';
import { ACTIVE_STATES, CONFIG } from '../config.js';

export class Renderer {
    constructor(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.miniCanvas = minimapCanvas;
        this.miniCtx = minimapCanvas.getContext('2d');
        this.images = {};
        this._preload();
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.miniCanvas.width = 160;
        this.miniCanvas.height = 160;
    }

    _preload() {
        Object.keys(LOCAL_ASSETS_CONFIG).forEach(key => {
            const img = new Image();
            img.src = LOCAL_ASSETS_CONFIG[key];
            img.onload = () => { this.images[key] = img; };
            img.onerror = () => { this.images[key] = null; };
        });
    }

    get(key) {
        return this.images[key] || null;
    }

    // ---------------------------------------------------------------- draw
    drawHeroSprite(ctx, heroType, radius) {
        const img = this.get(heroType);
        if (img) {
            const size = radius * 2.8;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            return;
        }
        // Procedural fallback (matches original art style).
        if (heroType === 'knight') {
            ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#6366f1'; ctx.beginPath(); ctx.arc(0, -2, radius * 0.5, 0, Math.PI, true); ctx.fill();
            ctx.fillStyle = '#38bdf8'; ctx.fillRect(-6, -2, 12, 3);
        } else if (heroType === 'mage') {
            ctx.fillStyle = '#581c87'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.fillStyle = '#f0abfc'; ctx.beginPath(); ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2); ctx.fill();
        } else if (heroType === 'ranger') {
            ctx.fillStyle = '#831843'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2.5; ctx.stroke();
        } else if (heroType === 'reaper') {
            ctx.fillStyle = '#064e3b'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2.5; ctx.stroke();
        }
    }

    drawEnemySprite(ctx, e) {
        const img = this.get(e.type === 'boss' ? 'boss' : e.type);
        ctx.save();
        ctx.translate(e.x, e.y);
        if (img) {
            const size = e.radius * 2.6;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
        }
        if (e.isElite) {
            ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, e.radius + 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }

    // ---------------------------------------------------------------- view
        render(snapshot) {
        const { ctx, canvas } = this;
                const { camera, player, enemies, projectiles, drops, particles, floatingTexts, mouse, state } = snapshot;

        if (!player) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        // Ground
        const img = this.get('ground');
        if (img) {
            const pattern = ctx.createPattern(img, 'repeat');
            ctx.fillStyle = pattern;
            ctx.fillRect(
                camera.x - canvas.width / camera.zoom,
                camera.y - canvas.height / camera.zoom,
                (canvas.width * 2) / camera.zoom,
                (canvas.height * 2) / camera.zoom
            );
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 1;
            const gridSize = 80;
            const startX = Math.floor((camera.x - canvas.width / camera.zoom) / gridSize) * gridSize;
            const endX = Math.floor((camera.x + canvas.width / camera.zoom) / gridSize) * gridSize;
            const startY = Math.floor((camera.y - canvas.height / camera.zoom) / gridSize) * gridSize;
            const endY = Math.floor((camera.y + canvas.height / camera.zoom) / gridSize) * gridSize;
            for (let x = startX; x <= endX; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke(); }
            for (let y = startY; y <= endY; y += gridSize) { ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke(); }
        }

                // Drops
        drops.forEach(d => {
            ctx.save();
            ctx.fillStyle = d.color; ctx.shadowColor = d.color; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(d.x, d.y, d.type === 'xp' ? 4.5 : 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // Particles
        particles.forEach(pt => {
            ctx.save();
            ctx.globalAlpha = Math.min(1, pt.life / 24);
            ctx.fillStyle = pt.color; ctx.shadowColor = pt.color; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // Projectiles
        projectiles.forEach(p => {
            ctx.save();
            if (p.type === 'bullet') {
                ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
            } else if (p.type === 'arc') {
                ctx.strokeStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 18; ctx.lineWidth = 7;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, p.angle - 0.7, p.angle + 0.7); ctx.stroke();
            }
            ctx.restore();
        });

        // Orbiters (Escudos Giratorios / Aegis)
        player.weapons.forEach(w => {
            if (w.type === 'orbit' && w.orbiters) {
                const orbColor = w.isEvolved ? '#f59e0b' : '#818cf8';
                w.orbiters.forEach(o => {
                    ctx.save();
                    ctx.fillStyle = orbColor; ctx.shadowColor = orbColor; ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });
            }
        });

        // Enemies
        enemies.forEach(e => this.drawEnemySprite(ctx, e));

        // Player
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        this.drawHeroSprite(ctx, player.heroType, player.radius);
        ctx.restore();

        // Floating Texts
        floatingTexts.forEach(ft => {
            ctx.save();
            ctx.font = `bold ${ft.size}px Orbitron`;
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = ft.life / ft.maxLife;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        });

        ctx.restore();

        // Crosshair Cursor
        if (ACTIVE_STATES.has(state)) {
            ctx.save();
            const primary = player.weapons.find(w => w.isPrimary);
            let cdPct = 1.0;
            if (primary) {
                cdPct = Math.min(1.0, primary.timer / (primary.cooldown * player.cooldownMultiplier));
            }
            ctx.strokeStyle = cdPct >= 1.0 ? '#38bdf8' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI * 2 * cdPct); ctx.stroke();
            ctx.fillStyle = mouse.isDown ? '#f43f5e' : '#ffffff';
            ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Boss fight screen tint
        if (state === 'BOSS_FIGHT') {
            ctx.fillStyle = 'rgba(220,38,38,0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    renderMinimap(player, enemies) {
        const { miniCtx, miniCanvas } = this;
        const mapScale = 0.04;
        const cx = miniCanvas.width / 2;
        const cy = miniCanvas.height / 2;

        miniCtx.fillStyle = '#020617';
        miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

        miniCtx.fillStyle = '#22c55e';
        miniCtx.beginPath(); miniCtx.arc(cx, cy, 3.5, 0, Math.PI * 2); miniCtx.fill();

        enemies.forEach(e => {
            const mx = cx + (e.x - player.x) * mapScale;
            const my = cy + (e.y - player.y) * mapScale;
            if (mx >= 0 && mx <= miniCanvas.width && my >= 0 && my <= miniCanvas.height) {
                miniCtx.fillStyle = e.isBoss ? '#facc15' : (e.isElite ? '#c084fc' : '#ef4444');
                miniCtx.beginPath();
                miniCtx.arc(mx, my, e.isBoss ? 5 : (e.isElite ? 3 : 2), 0, Math.PI * 2);
                miniCtx.fill();
            }
        });
    }
}
    


