// ==========================================================================
// FLAPPY CROW 3D - THE OBSIDIAN GAUNTLET
// High-Fidelity 3D Corvid Flight Game Engine using Three.js & Web Audio API
// ==========================================================================

(() => {
    'use strict';

    // --------------------------------------------------------------------------
    // CONFIGURATION & CONSTANTS
    // --------------------------------------------------------------------------
    const CONFIG = {
        world: {
            gravity: 27.0,
            jumpImpulse: 9.6,
            gameSpeed: 16.5,
            pipeSpawnInterval: 1.8,  // seconds between arches
            pipeGapSize: 7.0,        // vertical gap for crow clearance
            pipeRadius: 1.8,
            pipeCollarRadius: 2.2,
            archWallWidth: 16.0,     // lateral gate wings
            groundY: -8.0,
            ceilingY: 14.0,
            trackZStart: -125,       // where obstacles spawn
            trackZEnd: 24            // where obstacles despawn
        },
        crow: {
            radius: 0.95,
            maxTiltUp: 0.55,         // radians (pitch up on flap)
            maxTiltDown: 0.75,       // radians (pitch down on dive)
            rotationSpeed: 7.5,
            normalFlapSpeed: 4.2,
            boostFlapSpeed: 16.5
        },
        audio: {
            masterVolume: 0.35
        }
    };

    // --------------------------------------------------------------------------
    // THEMES DEFINITIONS
    // --------------------------------------------------------------------------
    const THEMES = [
        {
            id: 'twilight',
            name: 'TWILIGHT MIST',
            skyTop: 0x140e2b,
            skyBottom: 0x44244d,
            fogColor: 0x1f122c,
            fogDensity: 0.014,
            groundColor: 0x1a1528,
            pipeColor: 0x2d253a,
            pipeAccent: 0xa855f7,
            pipeAccentGlow: 0xd8b4fe,
            lightColor: 0xffd29d,
            lightIntensity: 1.15,
            ambientColor: 0x5a486e
        },
        {
            id: 'midnight',
            name: 'MIDNIGHT REALM',
            skyTop: 0x030611,
            skyBottom: 0x0f172a,
            fogColor: 0x090e1e,
            fogDensity: 0.016,
            groundColor: 0x0b111e,
            pipeColor: 0x1e293b,
            pipeAccent: 0x38bdf8,
            pipeAccentGlow: 0x7dd3fc,
            lightColor: 0xc7d2fe,
            lightIntensity: 0.95,
            ambientColor: 0x312e81
        },
        {
            id: 'golden',
            name: 'GOLDEN DAWN',
            skyTop: 0x2e1834,
            skyBottom: 0xf59e0b,
            fogColor: 0x6b2e10,
            fogDensity: 0.013,
            groundColor: 0x382310,
            pipeColor: 0x45352c,
            pipeAccent: 0xfbbf24,
            pipeAccentGlow: 0xfde68a,
            lightColor: 0xffedd5,
            lightIntensity: 1.3,
            ambientColor: 0x7c2d12
        },
        {
            id: 'crimson',
            name: 'BLOOD ECLIPSE',
            skyTop: 0x160408,
            skyBottom: 0x881337,
            fogColor: 0x3b0712,
            fogDensity: 0.015,
            groundColor: 0x1e0a10,
            pipeColor: 0x38151c,
            pipeAccent: 0xf43f5e,
            pipeAccentGlow: 0xfda4af,
            lightColor: 0xfecdd3,
            lightIntensity: 1.25,
            ambientColor: 0x4c0519
        }
    ];

    // --------------------------------------------------------------------------
    // AUDIO ENGINE (Zero-dependency Web Audio API Procedural Synthesizer)
    // --------------------------------------------------------------------------
    class ProceduralAudioEngine {
        constructor() {
            this.ctx = null;
            this.isMuted = false;
            this.windNode = null;
            this.gainNode = null;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
                this.gainNode = this.ctx.createGain();
                this.gainNode.gain.setValueAtTime(CONFIG.audio.masterVolume, this.ctx.currentTime);
                this.gainNode.connect(this.ctx.destination);
                this.startAmbientWind();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        toggleMute() {
            this.isMuted = !this.isMuted;
            if (this.gainNode && this.ctx) {
                this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : CONFIG.audio.masterVolume, this.ctx.currentTime);
            }
            return !this.isMuted;
        }

        // Authentic Corvid Call ("Caw! Caw!")
        playCrowCaw() {
            if (this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;

            // Dual Formant filters for crow vocal tract acoustics (~850Hz & ~1900Hz)
            const bp1 = this.ctx.createBiquadFilter();
            bp1.type = 'bandpass';
            bp1.frequency.setValueAtTime(840, now);
            bp1.Q.setValueAtTime(4.2, now);

            const bp2 = this.ctx.createBiquadFilter();
            bp2.type = 'bandpass';
            bp2.frequency.setValueAtTime(1880, now);
            bp2.Q.setValueAtTime(3.8, now);

            // Carrier tone with realistic downward inflection
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(310, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.36);

            // Noise burst for the characteristic corvid throat rasp
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.22, now);

            const cawGain = this.ctx.createGain();
            cawGain.gain.setValueAtTime(0, now);
            cawGain.gain.linearRampToValueAtTime(0.38, now + 0.04);
            cawGain.gain.exponentialRampToValueAtTime(0.01, now + 0.36);

            osc.connect(bp1);
            noise.connect(noiseGain);
            noiseGain.connect(bp2);

            bp1.connect(cawGain);
            bp2.connect(cawGain);
            cawGain.connect(this.gainNode);

            osc.start(now);
            noise.start(now);
            osc.stop(now + 0.38);
            noise.stop(now + 0.38);
        }

        // Wing Flap Air Displacement Whoosh
        playFlap() {
            if (this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;

            const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.75;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, now);
            filter.frequency.exponentialRampToValueAtTime(700, now + 0.07);
            filter.frequency.exponentialRampToValueAtTime(90, now + 0.18);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.32, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.gainNode);

            noise.start(now);
            noise.stop(now + 0.19);
        }

        // Crystal Bell Score Chime
        playScore() {
            if (this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

            gain.gain.setValueAtTime(0.32, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(this.gainNode);

            osc.start(now);
            osc.stop(now + 0.46);
        }

        // Shiny Trinket / Gem Pickup Arpeggio
        playTrinket() {
            if (this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;

            const notes = [783.99, 1046.50, 1318.51, 1567.98]; // G5, C6, E6, G6
            notes.forEach((freq, idx) => {
                const noteTime = now + idx * 0.05;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0.28, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

                osc.connect(gain);
                gain.connect(this.gainNode);

                osc.start(noteTime);
                osc.stop(noteTime + 0.3);
            });
        }

        // Low Punch Impact Sound
        playHit() {
            if (this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);

            gain.gain.setValueAtTime(0.65, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

            osc.connect(gain);
            gain.connect(this.gainNode);

            osc.start(now);
            osc.stop(now + 0.4);
        }

        // Subtle Ambient Wind Drone
        startAmbientWind() {
            if (this.windNode) return;
            const bufferSize = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(210, this.ctx.currentTime);
            filter.Q.setValueAtTime(1.4, this.ctx.currentTime);

            const windGain = this.ctx.createGain();
            windGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

            noise.connect(filter);
            filter.connect(windGain);
            windGain.connect(this.gainNode);

            noise.start();
            this.windNode = noise;
        }
    }

    // --------------------------------------------------------------------------
    // CROW 3D MESH BUILDER
    // --------------------------------------------------------------------------
    function createCrowMesh() {
        const crowGroup = new THREE.Group();

        // Sleek obsidian / charcoal corvid plumage with subtle iridescence
        const featherMaterial = new THREE.MeshStandardMaterial({
            color: 0x121319,
            roughness: 0.28,
            metalness: 0.35,
            flatShading: false
        });

        // Glossy beak and talon keratin material
        const beakMaterial = new THREE.MeshStandardMaterial({
            color: 0x0c0d10,
            roughness: 0.18,
            metalness: 0.45
        });

        // Corvid eye material
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0x040407,
            roughness: 0.1,
            metalness: 0.9
        });

        // Cornea glint / amber ring
        const glintMaterial = new THREE.MeshBasicMaterial({
            color: 0x38bdf8
        });

        // 1. Torso & Breast (Streamlined avian body)
        const bodyGeo = new THREE.SphereGeometry(0.88, 18, 14);
        bodyGeo.scale(0.8, 0.72, 1.45);
        const bodyMesh = new THREE.Mesh(bodyGeo, featherMaterial);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        crowGroup.add(bodyMesh);

        // 2. Neck & Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.48, -0.92);

        const headGeo = new THREE.SphereGeometry(0.54, 16, 14);
        headGeo.scale(0.74, 0.85, 1.08);
        const headMesh = new THREE.Mesh(headGeo, featherMaterial);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        // Crow Forehead / Tuft
        const tuftGeo = new THREE.ConeGeometry(0.18, 0.42, 6);
        tuftGeo.rotateX(Math.PI / 4);
        const tuftMesh = new THREE.Mesh(tuftGeo, featherMaterial);
        tuftMesh.position.set(0, 0.42, 0.1);
        headGroup.add(tuftMesh);

        // Nasal Bristles (corvid signature at base of beak)
        const bristleGeo = new THREE.ConeGeometry(0.24, 0.35, 7);
        bristleGeo.rotateX(-Math.PI / 2.2);
        const bristleMesh = new THREE.Mesh(bristleGeo, featherMaterial);
        bristleMesh.position.set(0, 0.1, -0.48);
        headGroup.add(bristleMesh);

        // 3. Characteristic Curved Crow Beak
        // Upper Beak
        const upperBeakGeo = new THREE.ConeGeometry(0.23, 1.12, 10);
        upperBeakGeo.rotateX(-Math.PI / 2);
        upperBeakGeo.scale(0.68, 0.65, 1.0);
        const upperBeak = new THREE.Mesh(upperBeakGeo, beakMaterial);
        upperBeak.position.set(0, -0.04, -0.85);
        upperBeak.rotation.x = 0.12; // downcurve hook
        upperBeak.castShadow = true;
        headGroup.add(upperBeak);

        // Lower Beak
        const lowerBeakGeo = new THREE.ConeGeometry(0.19, 0.92, 8);
        lowerBeakGeo.rotateX(-Math.PI / 2);
        lowerBeakGeo.scale(0.62, 0.45, 1.0);
        const lowerBeak = new THREE.Mesh(lowerBeakGeo, beakMaterial);
        lowerBeak.position.set(0, -0.16, -0.76);
        headGroup.add(lowerBeak);

        // 4. Beady Eyes with Catchlight
        [-1, 1].forEach(side => {
            const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMaterial);
            eyeMesh.position.set(side * 0.33, 0.12, -0.26);
            headGroup.add(eyeMesh);

            const glintMesh = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), glintMaterial);
            glintMesh.position.set(side * 0.38, 0.15, -0.33);
            headGroup.add(glintMesh);
        });

        crowGroup.add(headGroup);

        // 5. Articulated Multi-Segment Wings (Left & Right)
        const wings = [];

        [-1, 1].forEach(side => {
            const wingRoot = new THREE.Group();
            wingRoot.position.set(side * 0.55, 0.22, 0.06);

            // Upper wing bone / coverts
            const upperWingGeo = new THREE.BoxGeometry(0.85, 0.11, 0.7);
            const upperWing = new THREE.Mesh(upperWingGeo, featherMaterial);
            upperWing.position.set(side * 0.42, 0, 0);
            upperWing.castShadow = true;
            wingRoot.add(upperWing);

            // Elbow & Forearm articulation
            const elbow = new THREE.Group();
            elbow.position.set(side * 0.85, 0, 0.1);

            // Primary flight feather blades (fanned wingtips)
            const featherBlades = new THREE.Group();
            for (let f = 0; f < 5; f++) {
                const bladeGeo = new THREE.BoxGeometry(0.32, 0.04, 1.25 - f * 0.16);
                const blade = new THREE.Mesh(bladeGeo, featherMaterial);
                blade.position.set(side * 0.52, 0, (f - 2) * 0.18);
                blade.rotation.y = side * (0.16 + f * 0.08);
                blade.castShadow = true;
                featherBlades.add(blade);
            }
            elbow.add(featherBlades);

            wingRoot.add(elbow);
            crowGroup.add(wingRoot);

            wings.push({
                root: wingRoot,
                elbow: elbow,
                side: side
            });
        });

        // 6. Tail Feathers (Wedge fan)
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.16, 1.18);

        for (let t = -3; t <= 3; t++) {
            const tailFeatherGeo = new THREE.BoxGeometry(0.25, 0.035, 1.4);
            const tailFeather = new THREE.Mesh(tailFeatherGeo, featherMaterial);
            tailFeather.position.set(0, 0, 0.7);
            tailFeather.rotation.y = t * 0.095;
            tailFeather.rotation.x = -0.15;
            tailFeather.castShadow = true;
            tailGroup.add(tailFeather);
        }
        crowGroup.add(tailGroup);

        // 7. Tucked Claws & Legs (Flight aerodynamic stance)
        [-0.24, 0.24].forEach(x => {
            const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.5, 6);
            legGeo.rotateX(Math.PI / 3);
            const leg = new THREE.Mesh(legGeo, beakMaterial);
            leg.position.set(x, -0.46, 0.38);
            crowGroup.add(leg);
        });

        // Crow uniform scaling
        crowGroup.scale.set(0.92, 0.92, 0.92);

        return {
            group: crowGroup,
            wings: wings,
            head: headGroup,
            tail: tailGroup
        };
    }

    // --------------------------------------------------------------------------
    // PARTICLE ENGINE (Feathers & Sparkles)
    // --------------------------------------------------------------------------
    class ParticleEngine {
        constructor(scene) {
            this.scene = scene;
            this.particles = [];

            this.featherGeo = new THREE.PlaneGeometry(0.26, 0.58);
            this.featherMat = new THREE.MeshBasicMaterial({
                color: 0x181922,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95
            });

            this.goldSparkleMat = new THREE.MeshBasicMaterial({
                color: 0xfbbf24,
                transparent: true,
                opacity: 1
            });

            this.cyanSparkleMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 1
            });

            this.sparkleGeo = new THREE.OctahedronGeometry(0.2, 0);
        }

        spawnFeatherBurst(pos, count = 10) {
            for (let i = 0; i < count; i++) {
                const mat = this.featherMat.clone();
                const mesh = new THREE.Mesh(this.featherGeo, mat);
                mesh.position.copy(pos);
                mesh.rotation.set(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                );

                const angle = Math.random() * Math.PI * 2;
                const speed = 1.4 + Math.random() * 3.6;

                this.scene.add(mesh);
                this.particles.push({
                    mesh: mesh,
                    material: mat,
                    vx: Math.cos(angle) * speed * 0.6,
                    vy: Math.sin(angle) * speed * 0.5 + 1.2,
                    vz: (Math.random() - 0.5) * speed,
                    rotSpeedX: (Math.random() - 0.5) * 8,
                    rotSpeedY: (Math.random() - 0.5) * 8,
                    rotSpeedZ: (Math.random() - 0.5) * 8,
                    life: 1.0,
                    decay: 0.65 + Math.random() * 0.4
                });
            }
        }

        spawnSparkleBurst(pos, isCyan = false, count = 14) {
            const matBase = isCyan ? this.cyanSparkleMat : this.goldSparkleMat;
            for (let i = 0; i < count; i++) {
                const mat = matBase.clone();
                const mesh = new THREE.Mesh(this.sparkleGeo, mat);
                mesh.position.copy(pos);

                const theta = Math.random() * Math.PI * 2;
                const phi = (Math.random() - 0.5) * Math.PI;
                const speed = 3.6 + Math.random() * 4.2;

                this.scene.add(mesh);
                this.particles.push({
                    mesh: mesh,
                    material: mat,
                    vx: Math.cos(phi) * Math.cos(theta) * speed,
                    vy: Math.sin(phi) * speed + 1.0,
                    vz: Math.cos(phi) * Math.sin(theta) * speed,
                    rotSpeedX: (Math.random() - 0.5) * 12,
                    rotSpeedY: (Math.random() - 0.5) * 12,
                    rotSpeedZ: 0,
                    life: 1.0,
                    decay: 1.2 + Math.random() * 0.8
                });
            }
        }

        update(dt) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= p.decay * dt;

                p.mesh.position.x += p.vx * dt;
                p.mesh.position.y += p.vy * dt;
                p.mesh.position.z += p.vz * dt;

                p.vy -= 4.2 * dt;
                p.mesh.rotation.x += p.rotSpeedX * dt;
                p.mesh.rotation.y += p.rotSpeedY * dt;
                p.mesh.rotation.z += p.rotSpeedZ * dt;

                p.material.opacity = Math.max(0, p.life);

                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.material.dispose();
                    this.particles.splice(i, 1);
                }
            }
        }

        clearAll() {
            this.particles.forEach(p => {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.material.dispose();
            });
            this.particles = [];
        }
    }

    // --------------------------------------------------------------------------
    // MAIN GAME CLASS
    // --------------------------------------------------------------------------
    class FlappyCrow3DGame {
        constructor() {
            this.canvas = document.getElementById('webglCanvas');
            this.audio = new ProceduralAudioEngine();

            // Game State
            this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
            this.score = 0;
            this.trinkets = 0;
            this.highScore = Number(localStorage.getItem('flappyCrow3D_best')) || 0;
            this.totalFlaps = 0;

            // Camera Modes: 'CHASE', 'SIDE', 'COCKPIT'
            this.cameraModes = ['CHASE', 'SIDE', 'COCKPIT'];
            this.cameraModeIndex = 0;

            // Themes
            this.currentThemeIndex = 0;

            // Physics state
            this.crowPos = new THREE.Vector3(0, 0, 0);
            this.crowVelY = 0;
            this.crowRotationX = 0;
            this.wingCycle = 0;
            this.flappingBoost = 0;

            // Obstacles & Environment
            this.pipes = [];
            this.sceneryObjects = [];
            this.clouds = [];
            this.spawnTimer = 0;

            // Cache UI Elements
            this.ui = {
                score: document.getElementById('scoreDisplay'),
                trinket: document.getElementById('trinketDisplay'),
                hudBest: document.getElementById('hudBestDisplay'),
                camLabel: document.getElementById('camModeLabel'),
                themeLabel: document.getElementById('themeModeLabel'),
                audioIcon: document.getElementById('audioIcon'),
                hud: document.getElementById('hud'),
                startScreen: document.getElementById('startScreen'),
                pauseScreen: document.getElementById('pauseScreen'),
                gameOverScreen: document.getElementById('gameOverScreen'),
                finalScore: document.getElementById('finalScoreVal'),
                bestScore: document.getElementById('bestScoreVal'),
                finalTrinkets: document.getElementById('finalTrinketsVal'),
                rankVal: document.getElementById('rankVal'),
                newBestBanner: document.getElementById('newBestBanner'),
                touchGuide: document.getElementById('touchGuide'),
                startBtn: document.getElementById('startBtn'),
                resumeBtn: document.getElementById('resumeBtn'),
                restartBtn: document.getElementById('restartBtn'),
                camToggleBtn: document.getElementById('camToggleBtn'),
                themeToggleBtn: document.getElementById('themeToggleBtn'),
                audioToggleBtn: document.getElementById('audioToggleBtn'),
                pauseToggleBtn: document.getElementById('pauseToggleBtn'),
                changeCamBtnGameOver: document.getElementById('changeCamBtnGameOver')
            };

            this.initThree();
            this.initEnvironment();
            this.initCrow();
            this.initParticles();
            this.initEvents();
            this.updateThemeVisuals();

            // Set initial UI
            this.ui.hudBest.textContent = this.highScore;

            // Clock for delta time
            this.clock = new THREE.Clock();

            // Start main render loop
            this.animate = this.animate.bind(this);
            requestAnimationFrame(this.animate);
        }

        // ----------------------------------------------------------------------
        // THREE.JS SCENE SETUP
        // ----------------------------------------------------------------------
        initThree() {
            this.scene = new THREE.Scene();
            const width = window.innerWidth;
            const height = window.innerHeight;

            this.camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 400);

            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            // Lights
            this.ambientLight = new THREE.AmbientLight(0x5a486e, 0.9);
            this.scene.add(this.ambientLight);

            this.dirLight = new THREE.DirectionalLight(0xffd29d, 1.25);
            this.dirLight.position.set(16, 32, 22);
            this.dirLight.castShadow = true;
            this.dirLight.shadow.mapSize.width = 1024;
            this.dirLight.shadow.mapSize.height = 1024;
            this.dirLight.shadow.camera.near = 10;
            this.dirLight.shadow.camera.far = 90;
            this.dirLight.shadow.camera.left = -22;
            this.dirLight.shadow.camera.right = 22;
            this.dirLight.shadow.camera.top = 22;
            this.dirLight.shadow.camera.bottom = -22;
            this.scene.add(this.dirLight);

            // Colored rim light following the crow for dramatic gothic sheen
            this.crowLight = new THREE.PointLight(0xa855f7, 1.8, 22);
            this.crowLight.position.set(0, 2, 4);
            this.scene.add(this.crowLight);

            // Fog
            this.scene.fog = new THREE.FogExp2(0x1f122c, 0.014);
        }

        // ----------------------------------------------------------------------
        // ENVIRONMENT (Endless Terrain, Clouds, Moon & Gothic Props)
        // ----------------------------------------------------------------------
        initEnvironment() {
            // 1. Endless Scrolling Ground
            const groundGeo = new THREE.PlaneGeometry(100, 260, 24, 48);
            groundGeo.rotateX(-Math.PI / 2);

            this.groundMaterial = new THREE.MeshStandardMaterial({
                color: 0x1a1528,
                roughness: 0.9,
                metalness: 0.1,
                flatShading: true
            });

            this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
            this.groundMesh.position.set(0, CONFIG.world.groundY, -40);
            this.groundMesh.receiveShadow = true;
            this.scene.add(this.groundMesh);

            // 2. Flight Path Center Cobblestones
            const pathGeo = new THREE.PlaneGeometry(10, 260);
            pathGeo.rotateX(-Math.PI / 2);
            this.pathMaterial = new THREE.MeshStandardMaterial({
                color: 0x110d1c,
                roughness: 0.75
            });
            this.pathMesh = new THREE.Mesh(pathGeo, this.pathMaterial);
            this.pathMesh.position.set(0, CONFIG.world.groundY + 0.04, -40);
            this.pathMesh.receiveShadow = true;
            this.scene.add(this.pathMesh);

            // 3. Spooky Trees and Flanking Monoliths
            this.sceneryGroup = new THREE.Group();
            this.scene.add(this.sceneryGroup);
            this.initSceneryProps();

            // 4. Low-Poly Floating Volumetric Clouds
            this.cloudsGroup = new THREE.Group();
            this.scene.add(this.cloudsGroup);
            this.cloudMaterial = new THREE.MeshStandardMaterial({
                color: 0x44244d,
                roughness: 0.9,
                transparent: true,
                opacity: 0.65
            });

            for (let i = 0; i < 16; i++) {
                const cloud = this.createCloudMesh();
                cloud.position.set(
                    (Math.random() - 0.5) * 95,
                    12 + Math.random() * 15,
                    -Math.random() * 180 + 20
                );
                cloud.scale.setScalar(1.6 + Math.random() * 2.4);
                this.cloudsGroup.add(cloud);
                this.clouds.push(cloud);
            }

            // 5. Giant Distant Moon
            const moonGeo = new THREE.SphereGeometry(20, 32, 32);
            this.moonMaterial = new THREE.MeshBasicMaterial({
                color: 0xf1f5f9
            });
            this.moonMesh = new THREE.Mesh(moonGeo, this.moonMaterial);
            this.moonMesh.position.set(0, 38, -175);
            this.scene.add(this.moonMesh);
        }

        createCloudMesh() {
            const group = new THREE.Group();
            const count = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const puff = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(2.1, 1),
                    this.cloudMaterial
                );
                puff.position.set(
                    (i - count / 2) * 2.0,
                    (Math.random() - 0.5) * 1.2,
                    (Math.random() - 0.5) * 1.5
                );
                group.add(puff);
            }
            return group;
        }

        initSceneryProps() {
            const treeMat = new THREE.MeshStandardMaterial({ color: 0x100b18, roughness: 1.0 });

            for (let z = 20; z >= -190; z -= 14) {
                [-1, 1].forEach(side => {
                    const x = side * (15 + Math.random() * 6);
                    const tree = new THREE.Group();
                    tree.position.set(x, CONFIG.world.groundY, z + (Math.random() - 0.5) * 6);

                    // Trunk
                    const trunk = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.35, 0.75, 8 + Math.random() * 4, 6),
                        treeMat
                    );
                    trunk.position.y = 4.0;
                    trunk.castShadow = true;
                    tree.add(trunk);

                    // Gnarled Branches
                    for (let b = 0; b < 3; b++) {
                        const branch = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.12, 0.28, 3.8, 5),
                            treeMat
                        );
                        branch.position.set(0, 5.0 + b * 1.3, 0);
                        branch.rotation.z = side * (0.65 + Math.random() * 0.4);
                        branch.rotation.y = Math.random() * Math.PI;
                        tree.add(branch);
                    }

                    this.sceneryGroup.add(tree);
                    this.sceneryObjects.push(tree);
                });
            }
        }

        // ----------------------------------------------------------------------
        // CROW INITIALIZATION
        // ----------------------------------------------------------------------
        initCrow() {
            this.crow = createCrowMesh();
            this.scene.add(this.crow.group);
            this.resetCrowPosition();
        }

        resetCrowPosition() {
            this.crowPos.set(0, 0, 0);
            this.crowVelY = 0;
            this.crowRotationX = 0;
            this.wingCycle = 0;
            this.flappingBoost = 0;
            this.crow.group.position.copy(this.crowPos);
            this.crow.group.rotation.set(0, 0, 0);
        }

        // ----------------------------------------------------------------------
        // PARTICLES
        // ----------------------------------------------------------------------
        initParticles() {
            this.particles = new ParticleEngine(this.scene);
        }

        // ----------------------------------------------------------------------
        // GOTHIC RUIN PILLARS & SHINY TRINKETS
        // ----------------------------------------------------------------------
        spawnPipePair(z) {
            const theme = THEMES[this.currentThemeIndex];
            const gap = CONFIG.world.pipeGapSize;

            // Randomize vertical opening
            const minY = CONFIG.world.groundY + 3.8;
            const maxY = CONFIG.world.ceilingY - gap - 3.2;
            const gapBottom = minY + Math.random() * (maxY - minY);
            const gapTop = gapBottom + gap;

            const pipeGroup = new THREE.Group();
            pipeGroup.position.z = z;

            const stoneMat = new THREE.MeshStandardMaterial({
                color: theme.pipeColor,
                roughness: 0.65,
                metalness: 0.3
            });

            const runeMat = new THREE.MeshStandardMaterial({
                color: theme.pipeAccent,
                emissive: theme.pipeAccent,
                emissiveIntensity: 0.8,
                roughness: 0.2
            });

            const radius = CONFIG.world.pipeRadius;
            const collarRadius = CONFIG.world.pipeCollarRadius;

            // 1. Bottom Monolith Pillar (From ground to gapBottom)
            const bottomHeight = gapBottom - CONFIG.world.groundY;
            const bottomGeo = new THREE.CylinderGeometry(radius, radius, bottomHeight, 20);
            const bottomMesh = new THREE.Mesh(bottomGeo, stoneMat);
            bottomMesh.position.y = CONFIG.world.groundY + bottomHeight / 2;
            bottomMesh.castShadow = true;
            bottomMesh.receiveShadow = true;
            pipeGroup.add(bottomMesh);

            // Bottom Rune Lip Collar
            const bottomCollar = new THREE.Mesh(
                new THREE.CylinderGeometry(collarRadius, collarRadius, 1.1, 20),
                runeMat
            );
            bottomCollar.position.y = gapBottom - 0.55;
            bottomCollar.castShadow = true;
            pipeGroup.add(bottomCollar);

            // 2. Top Monolith Pillar (From gapTop to ceiling)
            const topHeight = CONFIG.world.ceilingY + 12 - gapTop;
            const topGeo = new THREE.CylinderGeometry(radius, radius, topHeight, 20);
            const topMesh = new THREE.Mesh(topGeo, stoneMat);
            topMesh.position.y = gapTop + topHeight / 2;
            topMesh.castShadow = true;
            topMesh.receiveShadow = true;
            pipeGroup.add(topMesh);

            // Top Rune Lip Collar
            const topCollar = new THREE.Mesh(
                new THREE.CylinderGeometry(collarRadius, collarRadius, 1.1, 20),
                runeMat
            );
            topCollar.position.y = gapTop + 0.55;
            topCollar.castShadow = true;
            pipeGroup.add(topCollar);

            // 3. Side Archway Buttresses (Frames the path)
            [-1, 1].forEach(side => {
                const wingGeo = new THREE.BoxGeometry(CONFIG.world.archWallWidth, bottomHeight, 1.2);
                const wing = new THREE.Mesh(wingGeo, stoneMat);
                wing.position.set(side * (radius + CONFIG.world.archWallWidth / 2 + 0.2), CONFIG.world.groundY + bottomHeight / 2, 0);
                wing.castShadow = true;
                pipeGroup.add(wing);

                const topWingGeo = new THREE.BoxGeometry(CONFIG.world.archWallWidth, topHeight, 1.2);
                const topWing = new THREE.Mesh(topWingGeo, stoneMat);
                topWing.position.set(side * (radius + CONFIG.world.archWallWidth / 2 + 0.2), gapTop + topHeight / 2, 0);
                topWing.castShadow = true;
                pipeGroup.add(topWing);
            });

            // 4. Shiny Trinket (Gold Coin or Blue Soul Gem)
            let trinketMesh = null;
            const hasTrinket = Math.random() < 0.7; // 70% spawn chance
            if (hasTrinket) {
                const isGem = Math.random() < 0.4;
                const trinketMat = new THREE.MeshStandardMaterial({
                    color: isGem ? 0x38bdf8 : 0xfbbf24,
                    emissive: isGem ? 0x0284c7 : 0xd97706,
                    emissiveIntensity: 0.9,
                    metalness: 0.95,
                    roughness: 0.12
                });

                const geo = isGem 
                    ? new THREE.OctahedronGeometry(0.55, 0)
                    : new THREE.CylinderGeometry(0.58, 0.58, 0.16, 16);

                if (!isGem) geo.rotateX(Math.PI / 2);

                trinketMesh = new THREE.Mesh(geo, trinketMat);
                trinketMesh.position.set(0, gapBottom + gap / 2, 0);
                pipeGroup.add(trinketMesh);
            }

            this.scene.add(pipeGroup);

            this.pipes.push({
                group: pipeGroup,
                gapBottom: gapBottom,
                gapTop: gapTop,
                passed: false,
                trinket: trinketMesh,
                trinketCollected: false,
                materials: [stoneMat, runeMat]
            });
        }

        clearPipes() {
            this.pipes.forEach(p => {
                this.scene.remove(p.group);
                p.group.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                    }
                });
                p.materials.forEach(m => m.dispose());
            });
            this.pipes = [];
        }

        // ----------------------------------------------------------------------
        // THEME MANAGEMENT
        // ----------------------------------------------------------------------
        switchTheme() {
            this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
            this.updateThemeVisuals();
        }

        updateThemeVisuals() {
            const theme = THEMES[this.currentThemeIndex];
            this.ui.themeLabel.textContent = theme.name;

            // Fog & Clear color
            this.scene.fog.color.setHex(theme.fogColor);
            this.scene.fog.density = theme.fogDensity;
            this.renderer.setClearColor(theme.fogColor);

            // Dynamic Lights
            this.ambientLight.color.setHex(theme.ambientColor);
            this.dirLight.color.setHex(theme.lightColor);
            this.dirLight.intensity = theme.lightIntensity;
            this.crowLight.color.setHex(theme.pipeAccent);

            // Ground & Clouds
            this.groundMaterial.color.setHex(theme.groundColor);
            this.cloudMaterial.color.setHex(theme.skyBottom);

            // Moon color
            if (theme.id === 'crimson') {
                this.moonMaterial.color.setHex(0xf43f5e);
            } else if (theme.id === 'golden') {
                this.moonMaterial.color.setHex(0xfef08a);
            } else {
                this.moonMaterial.color.setHex(0xf1f5f9);
            }
        }

        // ----------------------------------------------------------------------
        // CAMERA MODES & SMOOTH TRACKING
        // ----------------------------------------------------------------------
        toggleCameraMode() {
            this.cameraModeIndex = (this.cameraModeIndex + 1) % this.cameraModes.length;
            const mode = this.cameraModes[this.cameraModeIndex];
            this.ui.camLabel.textContent = mode + ' CAM';
        }

        updateCamera(dt) {
            const mode = this.cameraModes[this.cameraModeIndex];
            const crow = this.crowPos;

            if (mode === 'CHASE') {
                // Third-person chase camera behind crow looking down gauntlet
                const targetCamX = crow.x * 0.35;
                const targetCamY = crow.y * 0.45 + 2.3;
                const targetCamZ = crow.z + 7.8;

                this.camera.position.x += (targetCamX - this.camera.position.x) * 6.5 * dt;
                this.camera.position.y += (targetCamY - this.camera.position.y) * 6.5 * dt;
                this.camera.position.z += (targetCamZ - this.camera.position.z) * 6.5 * dt;

                this.camera.lookAt(crow.x * 0.15, crow.y * 0.75 + 0.6, -26);
            } else if (mode === 'SIDE') {
                // Classic 2.5D Flappy Bird side view with depth perspective
                const targetCamX = 22.0;
                const targetCamY = crow.y * 0.75 + 0.8;
                const targetCamZ = -1.5;

                this.camera.position.x += (targetCamX - this.camera.position.x) * 6.5 * dt;
                this.camera.position.y += (targetCamY - this.camera.position.y) * 6.5 * dt;
                this.camera.position.z += (targetCamZ - this.camera.position.z) * 6.5 * dt;

                this.camera.lookAt(0, crow.y * 0.75, -1.5);
            } else if (mode === 'COCKPIT') {
                // First-person view through crow's eyes looking forward
                this.camera.position.set(crow.x, crow.y + 0.48, crow.z - 0.75);
                this.camera.lookAt(crow.x, crow.y + 0.48 + this.crowRotationX * 8, crow.z - 22);
            }
        }

        // ----------------------------------------------------------------------
        // INPUT HANDLING & ACTIONS
        // ----------------------------------------------------------------------
        initEvents() {
            // Window Resize
            window.addEventListener('resize', () => {
                const w = window.innerWidth;
                const h = window.innerHeight;
                this.camera.aspect = w / h;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(w, h);
            });

            // Keyboard
            window.addEventListener('keydown', (e) => {
                if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                    e.preventDefault();
                    this.onFlapAction();
                } else if (e.code === 'KeyC') {
                    this.toggleCameraMode();
                } else if (e.code === 'KeyT') {
                    this.switchTheme();
                } else if (e.code === 'KeyM') {
                    this.toggleAudio();
                } else if (e.code === 'KeyP' || e.code === 'Escape') {
                    this.togglePause();
                }
            });

            // Pointer / Mouse / Touch Flap
            this.canvas.addEventListener('pointerdown', (e) => {
                if (e.target === this.canvas) {
                    this.onFlapAction();
                }
            });

            // Button Listeners
            this.ui.startBtn.addEventListener('click', () => this.onFlapAction());
            this.ui.resumeBtn.addEventListener('click', () => this.togglePause());
            this.ui.restartBtn.addEventListener('click', () => this.restartGame());
            this.ui.camToggleBtn.addEventListener('click', () => this.toggleCameraMode());
            this.ui.changeCamBtnGameOver.addEventListener('click', () => this.toggleCameraMode());
            this.ui.themeToggleBtn.addEventListener('click', () => this.switchTheme());
            this.ui.audioToggleBtn.addEventListener('click', () => this.toggleAudio());
            this.ui.pauseToggleBtn.addEventListener('click', () => this.togglePause());
        }

        toggleAudio() {
            const active = this.audio.toggleMute();
            this.ui.audioIcon.textContent = active ? '🔊' : '🔇';
        }

        togglePause() {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
                this.ui.pauseScreen.classList.remove('hidden');
            } else if (this.state === 'PAUSED') {
                this.state = 'PLAYING';
                this.ui.pauseScreen.classList.add('hidden');
                this.clock.getDelta(); // flush delta
            }
        }

        onFlapAction() {
            this.audio.init();

            if (this.state === 'START') {
                this.startGame();
                this.flap();
            } else if (this.state === 'PLAYING') {
                this.flap();
            } else if (this.state === 'GAMEOVER') {
                this.restartGame();
            }
        }

        startGame() {
            this.state = 'PLAYING';
            this.score = 0;
            this.trinkets = 0;
            this.totalFlaps = 0;
            this.ui.score.textContent = '0';
            this.ui.trinket.textContent = '0';

            this.ui.startScreen.classList.add('hidden');
            this.ui.gameOverScreen.classList.add('hidden');
            this.ui.hud.classList.remove('hidden');

            this.clearPipes();
            this.spawnTimer = 0.6; // First obstacle arrives swiftly

            this.audio.playCrowCaw();
        }

        flap() {
            if (this.state !== 'PLAYING') return;

            this.crowVelY = CONFIG.world.jumpImpulse;
            this.flappingBoost = 1.0;
            this.totalFlaps++;

            this.audio.playFlap();

            // Shed a few feathers on flap
            this.particles.spawnFeatherBurst(this.crowPos, 3);
        }

        // ----------------------------------------------------------------------
        // GAME OVER & STATS
        // ----------------------------------------------------------------------
        triggerGameOver() {
            if (this.state !== 'PLAYING') return;

            this.state = 'GAMEOVER';
            this.audio.playHit();
            this.audio.playCrowCaw();

            // Feather burst on collision
            this.particles.spawnFeatherBurst(this.crowPos, 22);

            let isNewBest = false;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('flappyCrow3D_best', this.highScore);
                this.ui.hudBest.textContent = this.highScore;
                isNewBest = true;
            }

            // Calculate Corvid Rank
            let rank = 'FLEDGLING';
            if (this.score >= 40) rank = 'CORVID KING 👑';
            else if (this.score >= 25) rank = 'SHADOW RAVEN 🦅';
            else if (this.score >= 15) rank = 'OBSIDIAN ROOK';
            else if (this.score >= 7) rank = 'CLEVER JACKDAW';

            this.ui.finalScore.textContent = this.score;
            this.ui.bestScore.textContent = this.highScore;
            this.ui.finalTrinkets.textContent = this.trinkets;
            this.ui.rankVal.textContent = rank;

            if (isNewBest) {
                this.ui.newBestBanner.classList.remove('hidden');
            } else {
                this.ui.newBestBanner.classList.add('hidden');
            }

            setTimeout(() => {
                this.ui.gameOverScreen.classList.remove('hidden');
            }, 450);
        }

        restartGame() {
            this.resetCrowPosition();
            this.clearPipes();
            this.particles.clearAll();
            this.startGame();
        }

        // ----------------------------------------------------------------------
        // MAIN UPDATE CYCLE
        // ----------------------------------------------------------------------
        update(dt) {
            // Idle floating animation on Start screen
            if (this.state === 'START') {
                const t = performance.now() * 0.003;
                this.crowPos.y = Math.sin(t) * 0.45;
                this.crow.group.position.copy(this.crowPos);
                this.updateCrowWings(dt, false);
                this.updateScenery(dt * 0.25);
                this.updateCamera(dt);
                return;
            }

            if (this.state === 'PAUSED') return;

            // 1. Crow Physics
            if (this.state === 'PLAYING') {
                this.crowVelY -= CONFIG.world.gravity * dt;
                this.crowPos.y += this.crowVelY * dt;

                // Ceiling clamp
                if (this.crowPos.y > CONFIG.world.ceilingY) {
                    this.crowPos.y = CONFIG.world.ceilingY;
                    this.crowVelY = 0;
                }

                // Ground hit
                if (this.crowPos.y - CONFIG.crow.radius <= CONFIG.world.groundY) {
                    this.crowPos.y = CONFIG.world.groundY + CONFIG.crow.radius;
                    this.triggerGameOver();
                }

                // Aerodynamic Crow Pitch:
                // Pitch up (+X) on ascent, Pitch down (-X) on dive
                const targetRotX = this.crowVelY > 0
                    ? THREE.MathUtils.lerp(0, CONFIG.crow.maxTiltUp, this.crowVelY / CONFIG.world.jumpImpulse)
                    : THREE.MathUtils.lerp(0, -CONFIG.crow.maxTiltDown, -this.crowVelY / 22);

                this.crowRotationX += (targetRotX - this.crowRotationX) * CONFIG.crow.rotationSpeed * dt;
                this.crow.group.rotation.x = this.crowRotationX;

                // Wing Flap Animation
                this.updateCrowWings(dt, true);
            } else if (this.state === 'GAMEOVER') {
                // Tumble to ground
                if (this.crowPos.y > CONFIG.world.groundY + CONFIG.crow.radius) {
                    this.crowVelY -= CONFIG.world.gravity * dt;
                    this.crowPos.y += this.crowVelY * dt;
                    this.crow.group.rotation.z += 5.5 * dt;
                }
            }

            this.crow.group.position.copy(this.crowPos);
            this.crowLight.position.set(this.crowPos.x, this.crowPos.y + 1.2, this.crowPos.z + 2.5);

            // 2. Obstacles Update
            if (this.state === 'PLAYING') {
                this.updatePipes(dt);
            }

            // 3. Scenery & Cloud Scrolling
            this.updateScenery(dt);

            // 4. Particles
            this.particles.update(dt);

            // 5. Camera update
            this.updateCamera(dt);
        }

        updateCrowWings(dt, isPlaying) {
            const flapSpeed = this.flappingBoost > 0 
                ? CONFIG.crow.boostFlapSpeed 
                : CONFIG.crow.normalFlapSpeed;

            this.wingCycle += dt * flapSpeed;
            if (this.flappingBoost > 0) {
                this.flappingBoost = Math.max(0, this.flappingBoost - dt * 2.8);
            }

            const wingAngle = Math.sin(this.wingCycle) * 0.75;

            // Animate wings
            this.crow.wings.forEach(w => {
                w.root.rotation.z = w.side * wingAngle;
                w.root.rotation.x = Math.cos(this.wingCycle) * 0.15;
                w.elbow.rotation.z = w.side * Math.max(0, -wingAngle * 0.65);
            });

            // Tail feather tilt responding to pitch
            this.crow.tail.rotation.x = -this.crowRotationX * 0.5 - 0.15;
        }

        updatePipes(dt) {
            const speed = CONFIG.world.gameSpeed;

            // Spawn new obstacles
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnPipePair(CONFIG.world.trackZStart);
                this.spawnTimer = CONFIG.world.pipeSpawnInterval;
            }

            // Move existing obstacles towards +Z
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const p = this.pipes[i];
                p.group.position.z += speed * dt;

                // Rotate shiny trinket
                if (p.trinket && !p.trinketCollected) {
                    p.trinket.rotation.y += 3.6 * dt;
                    p.trinket.position.y += Math.sin(performance.now() * 0.005) * 0.004;

                    // Trinket collection
                    const distZ = Math.abs(p.group.position.z - this.crowPos.z);
                    const distY = Math.abs(p.trinket.position.y - this.crowPos.y);

                    if (distZ < 1.4 && distY < 1.6) {
                        p.trinketCollected = true;
                        p.group.remove(p.trinket);
                        this.trinkets++;
                        this.score += 3; // +3 Bonus points for shiny treasure!
                        this.ui.score.textContent = this.score;
                        this.ui.trinket.textContent = this.trinkets;
                        this.audio.playTrinket();
                        this.particles.spawnSparkleBurst(this.crowPos, true, 18);
                    }
                }

                // Check Scoring (When crow crosses obstacle plane)
                if (!p.passed && p.group.position.z > this.crowPos.z) {
                    p.passed = true;
                    this.score++;
                    this.ui.score.textContent = this.score;
                    this.audio.playScore();
                    this.particles.spawnSparkleBurst(new THREE.Vector3(0, (p.gapTop + p.gapBottom) / 2, p.group.position.z), false, 8);
                }

                // Check Collision with Archway Aperture
                const collisionZ = CONFIG.world.pipeCollarRadius + CONFIG.crow.radius * 0.65;
                if (Math.abs(p.group.position.z - this.crowPos.z) < collisionZ) {
                    const crowTop = this.crowPos.y + CONFIG.crow.radius * 0.65;
                    const crowBottom = this.crowPos.y - CONFIG.crow.radius * 0.65;

                    if (crowBottom < p.gapBottom || crowTop > p.gapTop) {
                        this.triggerGameOver();
                        return;
                    }
                }

                // Clean up off-screen obstacles
                if (p.group.position.z > CONFIG.world.trackZEnd) {
                    this.scene.remove(p.group);
                    p.group.traverse(child => {
                        if (child.isMesh) child.geometry.dispose();
                    });
                    p.materials.forEach(m => m.dispose());
                    this.pipes.splice(i, 1);
                }
            }
        }

        updateScenery(dt) {
            const speed = CONFIG.world.gameSpeed * 0.65;

            // Scroll dead trees
            this.sceneryObjects.forEach(obj => {
                obj.position.z += speed * dt;
                if (obj.position.z > 25) {
                    obj.position.z = -190 + Math.random() * 5;
                }
            });

            // Scroll clouds
            this.clouds.forEach(c => {
                c.position.z += speed * 0.45 * dt;
                if (c.position.z > 35) {
                    c.position.z = -160 - Math.random() * 40;
                    c.position.x = (Math.random() - 0.5) * 95;
                }
            });
        }

        // ----------------------------------------------------------------------
        // RENDER LOOP
        // ----------------------------------------------------------------------
        animate() {
            requestAnimationFrame(this.animate);

            const dt = Math.min(this.clock.getDelta(), 0.1);
            this.update(dt);
            this.renderer.render(this.scene, this.camera);
        }
    }

    // --------------------------------------------------------------------------
    // BOOTSTRAP
    // --------------------------------------------------------------------------
    window.addEventListener('DOMContentLoaded', () => {
        const initGame = () => {
            if (typeof THREE !== 'undefined') {
                new FlappyCrow3DGame();
            } else {
                setTimeout(initGame, 50);
            }
        };
        initGame();
    });
})();
