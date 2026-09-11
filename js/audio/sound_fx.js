// ==========================================================================
// Command & Conquer RTS - Procedural Sound Effects (Web Audio API)
// ==========================================================================

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.speechEnabled = 'speechSynthesis' in window;
    this.helicopterGain = null;
    this.helicopterSource = null;
    this.isHelicopterPlaying = false;
    
    // Lazy init on first user gesture
    this.initAudioContext = this.initAudioContext.bind(this);
    window.addEventListener('click', this.initAudioContext, { once: true });
    window.addEventListener('keydown', this.initAudioContext, { once: true });
  }

  initAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx && this.enabled;
  }

  // --- UI Sounds ---

  playClick() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.04);
  }

  playSelect() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1200, now + 0.04);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playOrder() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.setValueAtTime(940, now + 0.05);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playPlaceBuilding() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // Low mechanical impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);

    // Hydraulic hiss
    this.playNoiseBurst(0.25, 600, 0.2);
  }

  // --- Combat Sounds ---

  // Machine Gun Burst (for Machine Gunner, 4x4 Gunner, MG Turret, Helicopter)
  playMachineGun() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    for (let i = 0; i < 3; i++) {
      const burstTime = now + (i * 0.07);
      // Punchy tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, burstTime);
      osc.frequency.exponentialRampToValueAtTime(80, burstTime + 0.05);
      gain.gain.setValueAtTime(0.2, burstTime);
      gain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.05);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(burstTime);
      osc.stop(burstTime + 0.05);

      // Noise crack
      setTimeout(() => {
        this.playNoiseBurst(0.04, 1800, 0.25);
      }, i * 70);
    }
  }

  // Grenade Launcher Launch & Detonation
  playGrenadeLaunch() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // Thump launch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
    
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Rocket Launch (Rocket Soldier, Rocket Turret)
  playRocketLaunch() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // Rocket hiss & ignition
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.35);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);

    this.playNoiseBurst(0.3, 900, 0.25);
  }

  // Battle Tank Cannon Fire
  playTankCannon() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // Sub-bass heavy thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);
    
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // Explosive muzzle blast
    this.playNoiseBurst(0.35, 750, 0.45);
  }

  // Explosion (Unit / Structure destroyed or missile impact)
  playExplosion(isLarge = false) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const duration = isLarge ? 0.7 : 0.4;
    
    // Deep boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isLarge ? 120 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + duration);
    
    gain.gain.setValueAtTime(isLarge ? 0.7 : 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    // Heavy rumble noise
    this.playNoiseBurst(duration, isLarge ? 400 : 650, isLarge ? 0.55 : 0.35);
  }

  // Harrier Jet Flyby & Airstrike
  playJetAirstrike() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // High velocity jet roar with doppler shift
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(180, now + 1.8);
    
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1.8);

    // Carpet bomb sequence
    setTimeout(() => this.playExplosion(false), 500);
    setTimeout(() => this.playExplosion(true), 750);
    setTimeout(() => this.playExplosion(true), 1000);
  }

  // High-Tech Laser Beam (for Laser Colossus and Laser Turret)
  playLaserSound() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // High resonant beam zap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(8, now);
    
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);

    // Deep sub-pulse
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.3);
  }

  // Building Captured Chime
  playCaptureSound() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    // High-tech electronic chime
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.08;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });

    this.speak('Building captured');
  }

  // Ore Harvester Drill / Mining
  playMiningSound() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.1);
    osc.frequency.linearRampToValueAtTime(160, now + 0.2);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Power Low Emergency Klaxon
  playPowerAlert() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.setValueAtTime(440, now + 0.15);
    osc.frequency.setValueAtTime(650, now + 0.3);
    osc.frequency.setValueAtTime(440, now + 0.45);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Noise Burst generator helper
  playNoiseBurst(duration, filterFreq = 1000, volume = 0.2) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - (i / bufferSize));
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  // Tactical Voice / Radio Chatter Announcer
  speak(message, priority = false) {
    console.log(`[EVA Radio]: "${message}"`);
    
    // Play distinctive tactical radio chirp first
    this.playSelect();
    
    if (this.speechEnabled) {
      try {
        window.speechSynthesis.cancel(); // Don't queue up a backlog of old voices
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.volume = 0.85;
        
        // Find English voice
        const voices = window.speechSynthesis.getVoices();
        const engVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (engVoice) utterance.voice = engVoice;
        
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        // Fallback: Web Speech API error ignored
      }
    }
  }
}

// Global Sound Instance
window.soundFX = new SoundEffects();
