const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');
const trailCanvas = document.getElementById('trail-canvas');
const trailCtx = trailCanvas.getContext('2d');
const starCanvas = document.getElementById('starfield');
const starCtx = starCanvas.getContext('2d');
const transitionCanvas = document.getElementById('transition-canvas');
const transCtx = transitionCanvas.getContext('2d');
const mainContainer = document.getElementById('mainContainer');
const tiltCard = document.getElementById('tiltCard');
const tooltip = document.getElementById('tooltip');
const bgMusic = document.getElementById('bgMusic');

let mouseX = innerWidth / 2;
let mouseY = innerHeight / 2;
let cursorX = mouseX;
let cursorY = mouseY;

// === PERFORMANCE VARIABLES ===
// Stores target tilt values so we don't recalculate layout on every mouse move
let targetTiltX = 0;
let targetTiltY = 0;
let transitionAnimationId = null; // To kill old transitions

const trailParticles = [];
const interactionParticles = [];
let transitionParticles = [];

const maxTrail = 30;

// === PARTICLE SYSTEM ===
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.age = 0;
        this.maxAge = Math.random() * 20 + 20;
        this.color = color;
    }
    update() {
        this.age++;
        this.size *= 0.95;
    }
    draw() {
        const progress = this.age / this.maxAge;
        const opacity = 1 - progress;
        trailCtx.fillStyle = `rgba(${this.color}, ${opacity})`;
        trailCtx.shadowBlur = 10;
        trailCtx.shadowColor = `rgba(${this.color}, ${opacity * 0.8})`;
        trailCtx.beginPath();
        trailCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        trailCtx.fill();
    }
    dead() { return this.age >= this.maxAge; }
}

function getThemeColorRGB() {
    const theme = document.body.getAttribute('data-theme') || 'dark';
    if (theme === 'matrix') return '0,255,65';
    if (theme === 'christmas') return '255,51,102';
    if (theme === 'gold') return '255,215,0';
    if (theme === 'light') return '0,0,0';
    if (theme === 'purple') return '187,0,255';
    if (theme === 'vapor') return '0,255,255';
    if (theme === 'pink') return '255,20,147'; // Deep Pink RGB
    return '150,150,255';
}

function burstParticles(x, y, count = 20) {
    const color = getThemeColorRGB();
    for (let i = 0; i < count; i++) {
        interactionParticles.push(new Particle(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, color));
    }
}

// === OPTIMIZED TRANSITION LOGIC ===
function triggerThemeTransition() {
    const theme = document.body.getAttribute('data-theme');
    let color = getThemeColorRGB();
    let count = 120; // Reduced from 300 → much smoother
    let isMatrix = (theme === 'matrix' || theme === 'christmas');

    if (isMatrix) count = 80; // Fewer but bigger for code rain feel

    if (transitionAnimationId) {
        cancelAnimationFrame(transitionAnimationId);
        transitionAnimationId = null;
    }

    transitionParticles = [];
    transCtx.clearRect(0, 0, innerWidth, innerHeight);

    for (let i = 0; i < count; i++) {
        transitionParticles.push({
            x: Math.random() * innerWidth,
            y: -30,
            vx: (Math.random() - 0.5) * (isMatrix ? 0 : 3),
            vy: Math.random() * 4 + 2,
            size: isMatrix ? 16 : Math.random() * 3 + 2,
            char: isMatrix ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)) : null,
            color
        });
    }
    transitionCanvas.style.opacity = '1';
    animateTransition();
    if (isMatrix) initMatrixRain();
}

function animateTransition() {
    transCtx.clearRect(0, 0, innerWidth, innerHeight);
    
    // Reverse loop for better CPU performance when splicing
    for (let i = transitionParticles.length - 1; i >= 0; i--) {
        const p = transitionParticles[i];
        p.y += p.vy;
        p.x += p.vx;
        p.vy += 0.1;
        
        const opacity = 1 - p.y / innerHeight;

        if (p.char) {
            transCtx.font = p.size + 'px JetBrains Mono';
            transCtx.fillStyle = `rgba(${p.color}, ${opacity})`;
            transCtx.fillText(p.char, p.x, p.y);
        } else {
            transCtx.fillStyle = `rgba(${p.color}, ${opacity})`;
            transCtx.beginPath();
            transCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            transCtx.fill();
        }

        if (p.y > innerHeight + 30) {
            transitionParticles.splice(i, 1);
        }
    }

    if (transitionParticles.length > 0) {
        transitionAnimationId = requestAnimationFrame(animateTransition);
    } else {
        transitionCanvas.style.opacity = '0';
        transitionAnimationId = null;
    }
}

function resizeCanvases() {
    const dpi = window.devicePixelRatio || 1;
    [trailCanvas, starCanvas, transitionCanvas].forEach(c => {
        c.width = innerWidth * dpi;
        c.height = innerHeight * dpi;
        c.style.width = innerWidth + 'px';
        c.style.height = innerHeight + 'px';
        c.getContext('2d').scale(dpi, dpi);
    });
    initStars();
    initMatrixRain();
}
window.addEventListener('resize', resizeCanvases);

// === DECOUPLED MOUSE LISTENER (FIXES LAG) ===
window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Update cursor position immediately
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';

    // Add trail particle
    if (trailParticles.length < maxTrail) {
        trailParticles.push(new Particle(mouseX, mouseY, getThemeColorRGB()));
    }

    // Parallax Math (Store only, do not animate here)
    if (mainContainer.classList.contains('visible')) {
        targetTiltX = (innerWidth / 2 - mouseX) / 30;
        targetTiltY = (innerHeight / 2 - mouseY) / 30;
    }

    // Tooltip logic
    let left = mouseX + 20;
    let top = mouseY + 20;
    if (left + 160 > innerWidth) left = mouseX - 180;
    if (top + 60 > innerHeight) top = mouseY - 70;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
});

function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.3;
    cursorY += (mouseY - cursorY) * 0.3;
    cursorOutline.style.left = cursorX + 'px';
    cursorOutline.style.top = cursorY + 'px';

    trailCtx.clearRect(0, 0, innerWidth, innerHeight);
    
    // Combine arrays once instead of spreading every frame
    const allParticles = trailParticles.concat(interactionParticles);
    for (let i = allParticles.length - 1; i >= 0; i--) {
        const p = allParticles[i];
        p.update();
        p.draw();
        if (p.dead()) {
            // Remove from correct array
            const trailIdx = trailParticles.indexOf(p);
            if (trailIdx > -1) {
                trailParticles.splice(trailIdx, 1);
            } else {
                const interIdx = interactionParticles.indexOf(p);
                if (interIdx > -1) interactionParticles.splice(interIdx, 1);
            }
        }
    }

    requestAnimationFrame(animateCursor);
}

// Hover effects
document.querySelectorAll('.hover-trigger').forEach(el => {
    el.addEventListener('mouseenter', e => burstParticles(e.clientX, e.clientY, 15));
    el.addEventListener('click', e => burstParticles(e.clientX, e.clientY, 30));
});

// Tooltip events
document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', e => {
        tooltip.textContent = e.target.dataset.tooltip;
        tooltip.classList.add('visible');
        playSound('hover');
    });
    el.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    el.addEventListener('mousedown', () => playSound('click'));
});

// === AUDIO SYSTEM ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'hover') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    } else {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    }
    osc.start(); osc.stop(audioCtx.currentTime + (type === 'hover' ? 0.05 : 0.1));
}

let isWarping = false;
function enterSite() {
    // 1. Resume AudioContext
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playSound('click');

    // 2. Fade UI
    document.getElementById('overlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('overlay').style.display = 'none';
    }, 1000);

    // 3. Show Card
    isWarping = true;
    setTimeout(() => {
        isWarping = false;
        mainContainer.classList.add('visible');
        revealLinks(); 
        setTimeout(startTypewriter, 500);
    }, 800);

    // 4. Start Music
    const playIcon = document.querySelector('.music-player i');
    bgMusic.volume = 0.3;

    bgMusic.play().then(() => {
        playIcon.className = 'ph-fill ph-pause-circle';
        updateVisualizer();
    }).catch(err => {
        console.warn("Autoplay blocked, waiting for interaction");
        playIcon.className = 'ph-fill ph-play-circle';
    });
}

// === THEMES ===
const themes = ['dark', 'light', 'gold', 'matrix', 'pink'];
let currentThemeIndex = 0;
const themeIcons = {
    dark: 'ph-moon-stars',
    light: 'ph-sun',
    gold: 'ph-crown',
    matrix: 'ph-code',
    christmas: 'ph-snowflake',
    purple: 'ph-lightning',
    vapor: 'ph-palette',
    pink: 'ph-heart'
};

function setTheme(newTheme) {
    document.body.setAttribute('data-theme', newTheme);
    document.getElementById('themeIcon').className = `ph-fill ${themeIcons[newTheme] || 'ph-moon-stars'}`;
    playSound('click');
    triggerThemeTransition();
}

function toggleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    setTheme(themes[currentThemeIndex]);
}

// === HOTKEYS ===
let typed = '';
const themeKeys = {
    '1': 'dark',
    '2': 'light', 
    '3': 'gold',
    '4': 'matrix',
    '5': 'christmas',
    '6': 'purple',
    '7': 'vapor',
    '8': 'pink'
};

document.addEventListener('keydown', e => {
    if (themeKeys[e.key]) {
        setTheme(themeKeys[e.key]);
        return;
    }
    
    if (e.code === 'Space' && document.getElementById('mainContainer').classList.contains('visible')) {
        e.preventDefault();
        toggleMusic();
        return;
    }
    
    // Easter Egg Words
    typed += e.key.toLowerCase();
    if (typed.length > 10) typed = typed.slice(-10);
    if (typed.includes('purple')) { setTheme('purple'); typed = ''; }
    else if (typed.includes('wave')) { setTheme('vapor'); typed = ''; }
    else if (typed.includes('void')) { createVoidEffect(); typed = ''; }
});

// PFP Easter Egg
let pfpClicks = 0;
document.getElementById('pfpClick').addEventListener('click', () => {
    pfpClicks++;
    if (pfpClicks >= 5) {
        setTheme('christmas');
        pfpClicks = 0;
    }
});

// UI Text Effects
const textToType = "Professional UI Designer for Hire. Contact me, let's work.";
let typeIndex = 0;
function startTypewriter() {
    const el = document.getElementById("typewriter");
    if (typeIndex < textToType.length) {
        el.innerHTML += textToType.charAt(typeIndex);
        typeIndex++;
        setTimeout(startTypewriter, 50);
    }
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
function hackerEffect(el) {
    let iterations = 0;
    const original = el.dataset.value;
    const interval = setInterval(() => {
        el.innerText = original.split("").map((l, i) => i < iterations ? original[i] : letters[Math.floor(Math.random() * letters.length)]).join("");
        if (iterations >= original.length) clearInterval(interval);
        iterations += 1 / 3;
    }, 30);
}

function copyDiscord() {
    navigator.clipboard.writeText('@ui.void');
    const hint = document.getElementById('copyHint');
    hint.innerHTML = '<i class="ph-bold ph-check"></i>';
    hint.style.opacity = '1';
    setTimeout(() => {
        hint.innerHTML = '<i class="ph ph-copy"></i>';
        hint.style.opacity = '0';
    }, 2000);
}

// === MATRIX RAIN ===
const matrixChars = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:",./<>?';
let matrixDrops = [];
let matrixFontSize = 14;
let matrixColumns;

function initMatrixRain() {
    const baseFontSize = 14;
    matrixFontSize = innerWidth < 600 ? 12 : baseFontSize;
    matrixColumns = Math.floor(starCanvas.width / matrixFontSize);
    matrixDrops = [];
    for (let i = 0; i < matrixColumns; i++) {
        matrixDrops[i] = Math.floor(Math.random() * -100);
    }
}

function drawMatrixRain() {
    const theme = document.body.getAttribute('data-theme');
    if (theme !== 'matrix' && theme !== 'christmas') return;

    starCtx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Slightly stronger fade
    starCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);

    let color = theme === 'matrix' ? '#0f0' : '#f36';
    starCtx.font = matrixFontSize + 'px JetBrains Mono';
    const trailLength = 5; // Reduced from 8 for better performance

    for (let i = 0; i < matrixDrops.length; i++) {
        const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
        const x = i * matrixFontSize;
        let y = matrixDrops[i] * matrixFontSize;

        starCtx.fillStyle = color;
        starCtx.fillText(text, x, y);

        let trailColor = theme === 'matrix' ? '0,255,0' : '255,51,102';
        for (let j = 1; j < trailLength; j++) {
            if (y - j * matrixFontSize > 0) {
                const trailOpacity = 0.12 - (j * 0.02);
                if (trailOpacity <= 0) break; // Stop drawing invisible trails
                starCtx.fillStyle = `rgba(${trailColor}, ${trailOpacity})`;
                starCtx.fillText(text, x, y - j * matrixFontSize);
            }
        }

        let speed = isWarping ? 12 : 1;
        matrixDrops[i] += speed;
        if (matrixDrops[i] * matrixFontSize > starCanvas.height && Math.random() > 0.975) {
            matrixDrops[i] = 0;
        }
    }
}

// === STARS & BACKGROUND LOOP ===
let stars = [];
class Star {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * starCanvas.width;
        this.y = Math.random() * starCanvas.height;
        this.size = Math.random() * 1.5;
        this.speedY = Math.random() * 0.3 + 0.1;
        this.opacity = Math.random();
    }
    update() {
        let speed = isWarping ? 25 : this.speedY;
        this.y -= speed;
        if (this.y < 0) this.reset();
        this.opacity += (Math.random() - 0.5) * 0.02;
        this.opacity = Math.max(0, Math.min(1, this.opacity));
    }
    draw() {
        const theme = document.body.getAttribute('data-theme') || 'dark';
        if (theme === 'matrix' || theme === 'christmas') return;
        let color = (theme === 'light') ? '0,0,0' : '255,255,255';
        if (theme === 'pink') color = '255,20,147'; 
        
        starCtx.fillStyle = `rgba(${color}, ${this.opacity})`;
        starCtx.beginPath();
        if (isWarping) starCtx.fillRect(this.x, this.y, 2, 40);
        else starCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        starCtx.fill();
    }
}

function initStars() { stars = Array.from({length: 150}, () => new Star()); }

function animateBackground() {
    const theme = document.body.getAttribute('data-theme') || 'dark';
    const isCardVisible = mainContainer.classList.contains('visible');
    
    if (theme === 'matrix' || theme === 'christmas') {
        drawMatrixRain();
    } else {
        starCtx.clearRect(0, 0, innerWidth, innerHeight);
        stars.forEach(s => { s.update(); s.draw(); });
    }
    requestAnimationFrame(animateBackground);
}

// === LIQUID SHINE EFFECT ===
tiltCard.addEventListener('mousemove', e => {
    const rect = tiltCard.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    tiltCard.style.setProperty('--mouse-x', `${x}%`);
    tiltCard.style.setProperty('--mouse-y', `${y}%`);
});

// === AUDIO VISUALIZER ===
const audio = document.getElementById('bgMusic');
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

// Safe Audio Connection
try {
    const source = audioCtx.createMediaElementSource(bgMusic);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
} catch (e) {
    console.log("Audio source likely already connected");
}

const bars = document.querySelectorAll('.bar');
let visualizerAnimationId;
let lastBarUpdate = 0;

function updateVisualizer() {
    // 1. Pause Logic
    if (bgMusic.paused) {
        cancelAnimationFrame(visualizerAnimationId);
        return;
    }

    analyser.getByteFrequencyData(dataArray);

    const bandCount = bars.length;
    const frequencyOffset = 1;
    const step = Math.floor((bufferLength - frequencyOffset) / bandCount);
    const now = Date.now();
    const shouldUpdateShadow = now - lastBarUpdate > 100; // Update shadows every 100ms instead of every frame

    bars.forEach((bar, i) => {
        // === CALCULATE HEIGHT ===
        let sum = 0;
        for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j + frequencyOffset] || 0;
        }
        const avg = sum / step;
        
        let height = Math.max(8, Math.pow(avg / 255, 1.4) * 160);
        if (height > 100) height = 100;
        bar.style.height = `${height}%`;

        // === THEME EFFECTS (Throttled) ===
        const theme = document.body.getAttribute('data-theme') || 'dark';

        if (shouldUpdateShadow) {
            if (theme === 'matrix' || theme === 'christmas') {
                bar.style.opacity = 0.4 + (avg / 255) * 0.6;
            } else if (theme === 'purple') {
                const glow = 5 + (avg / 255) * 20; 
                bar.style.boxShadow = `0 0 ${glow}px #bb00ff`;
            } else if (theme === 'vapor') {
                bar.style.opacity = 0.6 + (avg / 255) * 0.4;
            } else if (theme === 'pink') {
                // Soft Pink Glow
                bar.style.boxShadow = `0 0 ${8 + (avg / 255) * 15}px rgba(255, 105, 180, 0.6)`;
            }
        }
    });

    if (shouldUpdateShadow) lastBarUpdate = now;
    visualizerAnimationId = requestAnimationFrame(updateVisualizer);
}

function toggleMusic() {
    const musicPlayer = document.querySelector('.music-player');
    const playIcon = musicPlayer.querySelector('i');
    
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (bgMusic.paused) {
        bgMusic.play().then(() => {
            playIcon.className = 'ph-fill ph-pause-circle'; 
            updateVisualizer();
        });
    } else {
        bgMusic.pause();
        playIcon.className = 'ph-fill ph-play-circle';
        cancelAnimationFrame(visualizerAnimationId);
        bars.forEach(bar => {
            bar.style.height = '10%'; 
            bar.style.boxShadow = 'none';
        });
    }
}
document.querySelector('.music-player').addEventListener('click', toggleMusic);

function revealLinks() {
    const links = document.querySelectorAll('.link-btn');
    links.forEach((link, i) => {
        link.style.opacity = '0';
        link.style.transform = 'translateY(20px)';
        setTimeout(() => {
            link.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            link.style.opacity = '1';
            link.style.transform = 'translateY(0)';
        }, i * 150);
    });
}

function createVoidEffect() {
    const voidParticles = [];
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    
    for (let i = 0; i < 100; i++) {
        const angle = (Math.PI * 2 * i) / 100;
        voidParticles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            life: 100
        });
    }
    
    function animateVoid() {
        transCtx.clearRect(0, 0, innerWidth, innerHeight);
        transitionCanvas.style.opacity = '1';
        
        voidParticles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            
            const opacity = p.life / 100;
            transCtx.fillStyle = `rgba(${getThemeColorRGB()}, ${opacity})`;
            transCtx.beginPath();
            transCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            transCtx.fill();
            
            if (p.life <= 0) voidParticles.splice(i, 1);
        });
        
        if (voidParticles.length > 0) requestAnimationFrame(animateVoid);
        else transitionCanvas.style.opacity = '0';
    }
    animateVoid();
}

let lastBeat = 0;
function checkBeat() {
    analyser.getByteFrequencyData(dataArray);
    const bass = dataArray.slice(0, 10).reduce((a, b) => a + b) / 10;
    
    if (bass > 200 && Date.now() - lastBeat > 300) {
        lastBeat = Date.now();
        burstParticles(Math.random() * innerWidth, Math.random() * innerHeight, 30);
    }
    requestAnimationFrame(checkBeat);
}
bgMusic.addEventListener('play', () => { checkBeat(); });

// Accessibility
document.querySelectorAll('.link-btn, .theme-toggle').forEach(el => {
    el.setAttribute('tabindex', '0');
    el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
        }
    });
});

// Initialization
resizeCanvases();
animateCursor();
initStars();
initMatrixRain();
animateBackground();

// === VIEW COUNTER ===
function initializeViewCounter() {
    const viewCountElement = document.getElementById('viewCount');
    const views = localStorage.getItem('uivoidViews');
    let viewCount = views ? parseInt(views) : 0;
    
    // Increment on page load
    viewCount++;
    localStorage.setItem('uivoidViews', viewCount);
    
    // Display with formatting (e.g., 1,234)
    viewCountElement.textContent = viewCount.toLocaleString();
}

initializeViewCounter();

// === TIER SWITCHING ===
const tierData = {
    starter: {
        badge: 'Starter',
        title: 'Starter UI Package',
        subtitle: 'UI/UX',
        features: [
            'Advanced animations, premium effects',
            '1 week & a half turn around',
            '1 revision',
            'Project updates via Discord, X, & Email',
            'Basic Project Management Support',
            'Weekly Progress meetings'
        ],
        price: '$500',
        period: '/ project'
    },
    hero: {
        badge: 'Hero',
        title: 'Hero UI Package',
        subtitle: 'UI/UX',
        features: [
            'Sleek, stylish designs, detailed visuals, and animations',
            '2 weeks turn around',
            '2 revisions',
            'Project updates via Discord, X, & Email',
            'Expert Project Management',
            'Weekly Progress Meetings'
        ],
        price: '$1,200',
        period: '/ project'
    },
    premium: {
        badge: 'Premium',
        title: 'Warrior UI Package',
        subtitle: 'UI/UX',
        features: [
            'Premium design with advanced interactions',
            '3 weeks turn around',
            '3 revisions',
            'Project updates via Discord, X, & Email',
            'Premium Project Management',
            'Bi-weekly Progress Meetings'
        ],
        price: '$2,400',
        period: '/ project'
    },
    professional: {
        badge: 'Professional',
        title: 'Konquer UI Package',
        subtitle: 'UI/UX - HOT',
        features: [
            'Full-featured, modern, and sleek, industry-standard visuals',
            '2 Months Turnaround',
            '5 Revisions',
            'Project Updates via Socials, Slack & Email',
            'Expert Project Management',
            'Weekly Progress Meetings'
        ],
        price: '$5,000',
        period: '/ project'
    }
};

function updateTierCard(tierKey) {
    const tier = tierData[tierKey];
    const card = document.getElementById('pricingCardContent');
    const body = document.body;
    
    if (!tier) return;
    
    const featuresList = tier.features.map(feature => 
        `<li><i class="ph ph-check"></i> ${feature}</li>`
    ).join('');
    
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${tier.title}</h3>
            <p class="card-subtitle">${tier.subtitle}</p>
        </div>
        <div class="card-content">
            <ul class="features-list">
                ${featuresList}
            </ul>
        </div>
        <div class="card-footer">
            <div class="price">
                <span class="price-amount">${tier.price}</span>
                <span class="price-period">${tier.period}</span>
            </div>
            <button class="book-btn hover-trigger" data-tooltip="Lock in your Price">Lock in your Price</button>
        </div>
    `;
    
    // Apply shake animation when selecting Konquer tier
    if (tierKey === 'professional') {
        card.classList.remove('shake');
        void card.offsetWidth; // Trigger reflow to restart animation
        card.classList.add('shake');
    } else {
        card.classList.remove('shake');
    }
}

// Tab switching functionality
document.querySelectorAll('.tier-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tierKey = tab.getAttribute('data-tier');
        
        // Update active tab
        document.querySelectorAll('.tier-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update card content
        updateTierCard(tierKey);
    });
});

// === NAVIGATION FUNCTIONS ===
function scrollToHome() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function scrollToPricing() {
    const pricingSection = document.querySelector('.pricing-section');
    if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function openTermsOfService() {
    const tosModal = document.getElementById('tosModal');
    const tosOverlay = document.getElementById('tosOverlay');
    
    tosOverlay.classList.add('active');
    tosModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTermsOfService() {
    const tosModal = document.getElementById('tosModal');
    const tosOverlay = document.getElementById('tosOverlay');
    
    tosModal.classList.remove('active');
    
    // Wait for animation to complete before hiding overlay
    setTimeout(() => {
        tosOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }, 600);
}

function scrollToContact() {
    // Contact section will be implemented next
    console.log('Contact section - coming soon');
}

// Close ToS modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const tosOverlay = document.getElementById('tosOverlay');
        if (tosOverlay.classList.contains('active')) {
            closeTermsOfService();
        }
    }
});