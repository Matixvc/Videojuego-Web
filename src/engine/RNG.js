// src/engine/RNG.js — Seedable pseudo-random number generator (mulberry32).
// Used for deterministic "Daily Run" seeds and consistent loot across a run.

export class RNG {
    constructor(seed = (Date.now() ^ 0) >>> 0) {
        this.baseSeed = seed;
        this.state = seed;
    }

    next() {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    float(min, max) {
        return min + (max - min) * this.next();
    }

    range(min, max) {
        // inclusive integer range [min, max]
        return Math.floor(this.float(min, max + 1));
    }

    chance(p) {
        return this.next() < p;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    pick(array) {
        return array[Math.floor(this.next() * array.length)];
    }
}

// Deterministic seed from a date string (e.g. "2026-09-06").
export function seedFromDate(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
    }
    return hash === 0 ? 0x6d2b79f5 : hash;
}
