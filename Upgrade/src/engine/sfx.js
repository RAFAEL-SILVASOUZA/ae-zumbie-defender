/**
 * SFX — efeitos sonoros sintetizados via WebAudio (zero assets).
 * Sons curtos e discretos, com limite global por janela de tempo para não
 * virar "metralhadora sonora" em rounds cheios ou em velocidade 100x.
 *
 * API: SFX.unlock() (no primeiro gesto do usuário), SFX.play(nome),
 *      SFX.setMuted(bool).
 */
const SFX = {
    _ctx: null,
    _master: null,
    _muted: false,
    _noiseBuf: null,
    _windowStart: 0,
    _windowCount: 0,
    _lastByName: {},
    _MIN_GAP_MS: 55,      // intervalo mínimo entre 2 sons do MESMO nome
    _MAX_PER_WINDOW: 6,   // máximo de sons num ciclo de 150ms
    _WINDOW_MS: 150,

    unlock() {
        if (this._ctx) { if (this._ctx.state === 'suspended') this._ctx.resume(); return; }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this._ctx = new AC();
            this._master = this._ctx.createGain();
            this._master.gain.value = 0.5;
            this._master.connect(this._ctx.destination);
            // buffer de ruído branco pré-gerado (1s)
            const len = this._ctx.sampleRate;
            this._noiseBuf = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
            const data = this._noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        } catch (e) { /* sem áudio disponível */ }
    },

    setMuted(m) { this._muted = m; },

    _now() { return this._ctx ? this._ctx.currentTime * 1000 : performance.now(); },

    _gate(name) {
        if (!this._ctx || this._muted || this._ctx.state !== 'running') return false;
        const now = this._now();
        if (now - (this._lastByName[name] || -1e9) < this._MIN_GAP_MS) return false;
        if (now - this._windowStart >= this._WINDOW_MS) { this._windowStart = now; this._windowCount = 0; }
        if (this._windowCount >= this._MAX_PER_WINDOW) return false;
        this._windowCount++;
        this._lastByName[name] = now;
        return true;
    },

    // ---------- blocos de síntese ----------
    _noise(dur, filterType, f0, f1, vol, decay) {
        const t = this._ctx.currentTime;
        const src = this._ctx.createBufferSource();
        src.buffer = this._noiseBuf;
        src.loop = true;
        const flt = this._ctx.createBiquadFilter();
        flt.type = filterType;
        flt.frequency.setValueAtTime(f0, t);
        flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        flt.Q.value = 1;
        const g = this._ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * (decay || 1));
        src.connect(flt); flt.connect(g); g.connect(this._master);
        src.start(t); src.stop(t + dur + 0.02);
    },

    _tone(type, f0, f1, dur, vol, delay) {
        const t = this._ctx.currentTime + (delay || 0);
        const osc = this._ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const g = this._ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g); g.connect(this._master);
        osc.start(t); osc.stop(t + dur + 0.02);
    },

    // ---------- catálogo ----------
    play(name) {
        if (!this._ctx || this._muted || this._ctx.state !== 'running') return;
        if (!this._gate(name)) return;
        switch (name) {
            case 'shot':       // tiro curto de pistola/metralhadora
                this._noise(0.07, 'bandpass', 2600, 900, 0.16);
                this._tone('square', 260, 120, 0.05, 0.05);
                break;
            case 'bigshot':    // foguete/radar (tiro "pesado")
                this._noise(0.14, 'lowpass', 1400, 300, 0.22);
                this._tone('sawtooth', 180, 70, 0.1, 0.12);
                break;
            case 'zap':        // tesla
                this._tone('sawtooth', 1400, 180, 0.12, 0.10);
                this._noise(0.1, 'highpass', 3000, 1500, 0.10);
                break;
            case 'boom':       // explosão
                this._noise(0.45, 'lowpass', 900, 60, 0.5);
                this._tone('sine', 110, 35, 0.35, 0.35);
                break;
            case 'splat':      // impacto em zumbi
                this._noise(0.08, 'lowpass', 900, 250, 0.16);
                break;
            case 'zdie':       // zumbi morrendo (gorgorejo descendente)
                this._tone('sawtooth', 240, 55, 0.28, 0.12);
                this._noise(0.2, 'lowpass', 700, 150, 0.14, 0.7);
                break;
            case 'coin':       // dinheiro
                this._tone('sine', 950, 950, 0.07, 0.10);
                this._tone('sine', 1420, 1420, 0.09, 0.10, 0.06);
                break;
            case 'build':      // torre colocada
                this._tone('sine', 150, 90, 0.12, 0.22);
                this._noise(0.1, 'lowpass', 600, 200, 0.14);
                break;
            case 'upgrade':    // torre melhorada (blip ascendente)
                this._tone('sine', 520, 780, 0.09, 0.12);
                this._tone('sine', 780, 1170, 0.1, 0.10, 0.07);
                break;
            case 'laser':      // parede laser queimando
                this._tone('sawtooth', 90, 130, 0.14, 0.08);
                this._noise(0.12, 'bandpass', 4000, 2500, 0.07);
                break;
            case 'magic':      // mago
                this._tone('sine', 620, 180, 0.18, 0.10);
                this._tone('triangle', 900, 320, 0.15, 0.06, 0.03);
                break;
            case 'round':      // começo de round
                this._tone('square', 220, 220, 0.1, 0.10);
                this._tone('square', 330, 330, 0.12, 0.10, 0.1);
                break;
            case 'sell':       // vender torre
                this._tone('sine', 700, 400, 0.12, 0.10);
                break;
            default:
                this._noise(0.08, 'bandpass', 2000, 800, 0.12);
        }
    }
};
// scripts clássicos com `const` não criam propriedade em window — expõe
// explicitamente para os guards `window.SFX` das entidades funcionarem
window.SFX = SFX;
