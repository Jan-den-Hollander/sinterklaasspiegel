/**
 * Sinterklaas Spiegel — v5
 * Gemini logica 1-op-1 overgenomen van werkende Fate spiegel (v11b):
 *  - Zelfde localStorage sleutel: 'magic_mirror_gemini_key'
 *  - Zelfde fetchWithRetry / model fallback: gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash
 *  - Fallback boodschap als alle modellen falen — Sint reageert ALTIJD
 *  - Quiz antwoorden geshuffeld
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ── API — zelfde sleutel als Fate spiegel ─────────────────────────────────
const ENV_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_KEY) || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const STORAGE_KEY = 'magic_mirror_gemini_key'; // identiek aan Fate spiegel

// ── Retry helper — identiek aan Fate spiegel ──────────────────────────────
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const isRetryable = ['timeout','503','overloaded','network','429'].some(s => err?.message?.includes(s));
      if (isLast || !isRetryable) throw err;
      await sleep(attempt * 1500);
    }
  }
}

// ── Gemini tekst aanroep met model-fallback — identiek aan Fate spiegel ───
async function callGemini(apiKey, prompt) {
  let lastErr;
  for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const resp = await fetchWithRetry(() =>
        fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 800 },
          }),
        }).then(async r => {
          const json = await r.json();
          if (!r.ok) throw new Error(json?.error?.message || `HTTP ${r.status}`);
          return json;
        })
      );
      if (resp.error) throw new Error(resp.error.message || 'Gemini fout');
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return raw.replace(/```json|```/g, '').trim();
    } catch (err) {
      lastErr = err;
      // probeer volgend model
    }
  }
  throw lastErr;
}

// ── TTS — zelfde als Fate spiegel ─────────────────────────────────────────
const getVoices = () => new Promise(resolve => {
  const v = window.speechSynthesis.getVoices();
  if (v.length) { resolve(v); return; }
  window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
});

async function speak(text, onEnd = () => {}) {
  if (!text) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const voices = await getVoices();
  const pick = voices.find(v => v.lang.startsWith('nl') && /male|man/i.test(v.name))
    || voices.find(v => v.lang.startsWith('nl')) || voices[0];
  const utt = new SpeechSynthesisUtterance(text);
  if (pick) utt.voice = pick;
  utt.lang = 'nl-NL'; utt.rate = 0.82; utt.pitch = 0.88;
  utt.onend = onEnd; utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
  setTimeout(() => { try { window.speechSynthesis.cancel(); } catch {} }, text.length * 75 + 4000);
}

// ── Countdown ─────────────────────────────────────────────────────────────
function getCountdown() {
  const now = new Date(), year = now.getFullYear();
  let d = new Date(year, 11, 5, 18, 0, 0);
  if (now > d) d = new Date(year + 1, 11, 5, 18, 0, 0);
  const diff = d - now;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
    isPakjesAvond: diff <= 0,
  };
}

// ── Fallback boodschappen — Sint reageert ALTIJD ──────────────────────────
function buildSintFallback(name) {
  const reacties = [
    `Lieve ${name}, Sint heeft jouw brief gelezen en weet precies wat jij nodig hebt! Wacht maar rustig af — Piet is al bezig met de zakken vullen. Fijn Sinterklaasfeest! 🎁`,
    `Beste ${name}, Sint heeft in zijn grote boek gelezen dat jij een heel braaf kind bent dit jaar! Dat wordt zeker beloond op Pakjesavond. Vol verwachting klopt ons hart! ⭐`,
    `Ha ${name}! Sint weet al lang wat jij wenst — hij heeft het immers opgeschreven in zijn grote boek. Zet je schoen maar klaar, dan hoor je het gauw! 🌙`,
  ];
  return reacties[Math.floor(Math.random() * reacties.length)];
}

function buildVerlangFallback(name) {
  return {
    reacties: [{ wens: 'jouw wens', reactie: `Sint heeft jouw verlanglijstje persoonlijk gelezen, ${name}! Hij schrijft hem zorgvuldig in het grote boek: "Een hele mooie wens,Ik doe mijn best, maar wees niet teleurgesteld als het niet lukt en je iets anders krijgt misschien 🥁👋!"` }],
    slotwoord: `Fijn Sinterklaasfeest, lieve ${name}! Vol verwachting klopt ons hart! 🎁`,
    _isFallback: true,
  };
}

function buildSchoenFallback(name, items) {
  return {
    bericht: `Wat lief, ${name}! Sint heeft jouw schoentje gevonden met ${items} erin. Piet riep meteen: "Kijk, wat een braaf kind!" Sint glimlachte en noteerde jouw naam in zijn gouden boek.`,
    gekregen: `Morgen vind je misschien wel iets heel bijzonders in je schoen — iets dat je al lang wenste... 🌟`,
    _isFallback: true,
  };
}

// ── Quiz met Fisher-Yates shuffle ─────────────────────────────────────────
const RAW_QUIZ = [
  { q: 'Hoe heet het paard van Sinterklaas?',        correct: 'Amerigo',                    wrong: ['Tornado', 'Blixem', 'Domino'] },
  { q: 'Uit welk land komt Sinterklaas op de boot?', correct: 'Spanje',                      wrong: ['Italië', 'Portugal', 'Griekenland'] },
  { q: 'Op welke datum is Pakjesavond?',             correct: '5 december',                  wrong: ['6 december', '25 december', '1 december'] },
  { q: 'Wat leg je in je schoen voor Sint?',         correct: 'Een wortel voor het paard',   wrong: ['Een appel', 'Een snoepje', 'Een koekje'] },
  { q: 'Hoe heet het boek van Sinterklaas?',         correct: 'Het grote boek',              wrong: ['Het gouden boek', 'Het rode boek', 'Het dikke boek'] },
];

function shuffleQuiz() {
  return RAW_QUIZ.map(q => {
    const all = [q.correct, ...q.wrong];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return { q: q.q, answers: all, correct: all.indexOf(q.correct) };
  });
}

const MODE = { HOME: 'home', RIJM: 'rijm', VERLANG: 'verlang', SCHOEN: 'schoen', QUIZ: 'quiz', TELLER: 'teller' };

// ── Prompts ───────────────────────────────────────────────────────────────
const buildRijmPrompt = (name, age, wish) =>
  `Je bent Sinterklaas zelf — waardig, hartelijk, met humor voor kinderen. Schrijf een persoonlijk Sinterklaas-rijmpje voor ${name} (${age} jaar) die graag ${wish} wil.
Stijl: klassiek AABB rijmschema, 8 regels, kindvriendelijk. Gebruik NOOIT "ho ho ho".
Eindig met een plechtige zin zoals "Fijn Sinterklaasfeest, lieve ${name}!"
Antwoord ALLEEN als JSON zonder markdown of uitleg:
{"rijm":"regel1\\nregel2\\nregel3\\nregel4\\nregel5\\nregel6\\nregel7\\nregel8","intro":"Een kort welkomstwoord van Sint (1 zin, persoonlijk, geen ho ho ho)"}`;

const buildVerlangPrompt = (name, wishes) =>
  `Je bent Sinterklaas. ${name} heeft de volgende wensen: ${wishes}.
Reageer op elk item met een korte grappige reactie. Gebruik NOOIT "ho ho ho".
Antwoord ALLEEN als JSON zonder markdown of uitleg:
{"reacties":[{"wens":"...","reactie":"..."}],"slotwoord":"..."}`;

const buildSchoenPrompt = (name, items) =>
  `Je bent Sinterklaas. ${name} heeft het volgende in het schoentje gelegd: ${items}.
Reageer warm, grappig en kindvriendelijk. Gebruik NOOIT "ho ho ho".
Antwoord ALLEEN als JSON zonder markdown of uitleg:
{"bericht":"2-3 zinnen persoonlijk en grappig","gekregen":"wat het kind misschien krijgt, raadselachtig omschreven in 1 zin"}`;

// ── Mijter SVG — geel/goud met rode panelen ───────────────────────────────
function MijterSVG({ size = 44 }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130"
      style={{ display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.55))' }}>
      <defs>
        <linearGradient id="mY1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" /><stop offset="45%" stopColor="#d4a017" /><stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
        <linearGradient id="mY2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff0a0" /><stop offset="100%" stopColor="#c49a0c" />
        </linearGradient>
        <linearGradient id="mRd" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c8001e" /><stop offset="100%" stopColor="#8b0010" />
        </linearGradient>
      </defs>
      <path d="M18 100 C14 78 6 52 10 24 C14 8 28 0 50 0 C34 14 26 42 22 100Z" fill="url(#mY1)" />
      <path d="M82 100 C86 78 94 52 90 24 C86 8 72 0 50 0 C66 14 74 42 78 100Z" fill="url(#mY2)" />
      <path d="M22 98 C20 76 16 54 20 32 C24 18 34 8 50 2 C38 14 30 36 28 98Z" fill="url(#mRd)" opacity="0.85" />
      <path d="M78 98 C80 76 84 54 80 32 C76 18 66 8 50 2 C62 14 70 36 72 98Z" fill="url(#mRd)" opacity="0.72" />
      <rect x="20" y="52" width="60" height="12" rx="4" fill="url(#mY1)" />
      <rect x="44" y="16" width="12" height="76" rx="4" fill="url(#mY1)" />
      <circle cx="50" cy="60" r="7" fill="#c8001e" stroke="#ffe566" strokeWidth="2" />
      <circle cx="50" cy="60" r="4" fill="#ff3355" opacity="0.6" />
      <circle cx="50" cy="38" r="4" fill="#c8001e" stroke="#ffe566" strokeWidth="1.5" />
      <circle cx="50" cy="25" r="3" fill="#c8001e" stroke="#ffe566" strokeWidth="1.2" />
      <circle cx="30" cy="58" r="3.5" fill="#c8001e" stroke="#ffe566" strokeWidth="1.5" />
      <circle cx="70" cy="58" r="3.5" fill="#c8001e" stroke="#ffe566" strokeWidth="1.5" />
      <circle cx="50" cy="76" r="3" fill="#c8001e" stroke="#ffe566" strokeWidth="1.2" />
      <rect x="8" y="100" width="84" height="14" rx="5" fill="url(#mY1)" />
      <path d="M22 114 L16 130 L24 130 L28 114Z" fill="url(#mRd)" />
      <path d="M78 114 L84 130 L76 130 L72 114Z" fill="url(#mRd)" />
      <rect x="8" y="100" width="84" height="4" rx="2" fill="#fff0a0" opacity="0.4" />
      <circle cx="50" cy="4" r="3" fill="#fff8c0" opacity="0.8" />
    </svg>
  );
}

// ── Sint Frame ────────────────────────────────────────────────────────────
function SintFrame({ W = 270, H = 330 }) {
  const cx = W / 2, cy = H / 2;
  const rx = cx - 10, ry = cy - 10;

  function ptE(angleDeg, orx = rx, ory = ry) {
    const a = (angleDeg - 90) * Math.PI / 180;
    return [cx + orx * Math.cos(a), cy + ory * Math.sin(a)];
  }

  const slingerPts = Array.from({ length: 73 }, (_, i) => {
    const ang = i * 5;
    const wave = (i % 2 === 0) ? 5 : -3;
    const [x, y] = ptE(ang, rx - 5 + wave, ry - 5 + wave);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const KRANS = [
    { a:0,e:'⭐',fs:21,off:13 },{ a:13,e:'🍊',fs:16,off:5 },{ a:26,e:'🎁',fs:16,off:11 },
    { a:39,e:'🍊',fs:14,off:3 },{ a:52,e:'⭐',fs:13,off:9 },{ a:65,e:'🍭',fs:15,off:5 },
    { a:78,e:'🍊',fs:15,off:12 },{ a:91,e:'🧸',fs:16,off:3 },{ a:104,e:'⭐',fs:12,off:8 },
    { a:117,e:'🍊',fs:15,off:4 },{ a:130,e:'🎁',fs:17,off:12 },{ a:143,e:'🍫',fs:14,off:3 },
    { a:156,e:'⭐',fs:13,off:9 },{ a:169,e:'🍊',fs:15,off:4 },{ a:182,e:'⭐',fs:21,off:13 },
    { a:195,e:'🎶',fs:13,off:4 },{ a:208,e:'🍊',fs:16,off:11 },{ a:221,e:'🎁',fs:15,off:3 },
    { a:234,e:'⭐',fs:12,off:9 },{ a:247,e:'🍊',fs:15,off:5 },{ a:260,e:'🍭',fs:14,off:12 },
    { a:273,e:'🍊',fs:15,off:3 },{ a:286,e:'⭐',fs:12,off:8 },{ a:299,e:'🍫',fs:14,off:5 },
    { a:312,e:'🎁',fs:15,off:11 },{ a:325,e:'🍊',fs:15,off:4 },{ a:338,e:'⭐',fs:12,off:8 },
    { a:351,e:'🧸',fs:15,off:4 },
  ];

  const OVERHANGERS = [
    { a:22,e:'🍃',fs:11,off:-8 },{ a:55,e:'🌿',fs:10,off:-6 },{ a:88,e:'🍃',fs:11,off:-9 },
    { a:120,e:'🌿',fs:10,off:-5 },{ a:155,e:'🍃',fs:11,off:-8 },{ a:188,e:'🌿',fs:10,off:-6 },
    { a:222,e:'🍃',fs:11,off:-9 },{ a:255,e:'🌿',fs:10,off:-5 },{ a:290,e:'🍃',fs:11,off:-8 },
    { a:325,e:'🌿',fs:10,off:-7 },{ a:38,e:'🍊',fs:12,off:-4 },{ a:108,e:'🍊',fs:11,off:-5 },
    { a:200,e:'🍊',fs:12,off:-4 },{ a:310,e:'🍊',fs:11,off:-5 },
  ];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:2 }}>
      <defs>
        <linearGradient id="fG1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff0a0" /><stop offset="20%" stopColor="#d4a017" />
          <stop offset="55%" stopColor="#c8920e" /><stop offset="80%" stopColor="#f0c040" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="fG2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" /><stop offset="100%" stopColor="#c8920e" />
        </linearGradient>
        <linearGradient id="fRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c8001e" /><stop offset="100%" stopColor="#8b0010" />
        </linearGradient>
        <filter id="fGlow"><feGaussianBlur stdDeviation="4" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        <filter id="fSh"><feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1a0008" floodOpacity="0.6"/></filter>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx+7} ry={ry+7} fill="none" stroke="rgba(120,0,12,0.18)" strokeWidth="18"/>
      <path d={slingerPts.join(' ')+'Z'} fill="none" stroke="rgba(212,160,23,0.32)" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round"/>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="url(#fG1)" strokeWidth="7"/>
      <ellipse cx={cx} cy={cy} rx={rx-10} ry={ry-10} fill="none" stroke="url(#fG2)" strokeWidth="1.5" opacity="0.45"/>
      {KRANS.map((p,i) => { const [px,py]=ptE(p.a,rx+p.off,ry+p.off); return <text key={`k${i}`} x={px} y={py} fontSize={p.fs} textAnchor="middle" dominantBaseline="middle" filter="url(#fSh)" style={{userSelect:'none'}}>{p.e}</text>; })}
      {OVERHANGERS.map((p,i) => { const [px,py]=ptE(p.a,rx+p.off,ry+p.off); return <text key={`o${i}`} x={px} y={py} fontSize={p.fs} textAnchor="middle" dominantBaseline="middle" style={{userSelect:'none'}} opacity="0.82">{p.e}</text>; })}
      {[30,60,120,150,210,240,300,330].map((ang,i) => { const [ex,ey]=ptE(ang,rx+22,ry+22); return <text key={`s${i}`} x={ex} y={ey} fontSize="8" textAnchor="middle" dominantBaseline="middle" fill="#ffe566" opacity="0.5" style={{userSelect:'none'}}>✦</text>; })}
      <circle cx={cx} cy={16} r={30} fill="url(#fG1)" filter="url(#fGlow)"/>
      <circle cx={cx} cy={16} r={26} fill="#6a0008"/>
      <circle cx={cx} cy={16} r={24} fill="rgba(100,0,8,0.5)"/>
      <path d={`M${cx-11} 34 C${cx-13} 26 ${cx-16} 17 ${cx-12} 9 C${cx-10} 4 ${cx-5} 2 ${cx} 2 C${cx-5} 7 ${cx-8} 16 ${cx-10} 34Z`} fill="url(#fG1)"/>
      <path d={`M${cx+11} 34 C${cx+13} 26 ${cx+16} 17 ${cx+12} 9 C${cx+10} 4 ${cx+5} 2 ${cx} 2 C${cx+5} 7 ${cx+8} 16 ${cx+10} 34Z`} fill="#d4a017"/>
      <rect x={cx-9} y={17} width="18" height="5" rx="2" fill="#5a0006"/>
      <rect x={cx-2.5} y={5} width="5" height="26" rx="2" fill="#5a0006"/>
      <rect x={cx-12} y={33} width="24" height="5" rx="2" fill="url(#fG1)"/>
      <line x1={cx} y1={46} x2={cx} y2={cy-ry} stroke="url(#fG1)" strokeWidth="2.5" opacity="0.72"/>
      <circle cx={cx} cy={47} r={3.5} fill="url(#fG1)"/>
      {[false,true].map((flip,fi) => { const bx=flip?cx+66:cx-66; return <g key={fi} transform={`translate(${bx},${H-86}) ${flip?'scale(-1,1)':''}`}><line x1="12" y1="20" x2="12" y2="58" stroke="url(#fG1)" strokeWidth="5" strokeLinecap="round"/><path d="M12 20 C12 6 22 2 22 10 C22 18 14 20 11 16" fill="none" stroke="url(#fG1)" strokeWidth="5" strokeLinecap="round"/><circle cx="22" cy="10" r="4" fill="#d4a017" stroke="#ffe566" strokeWidth="1.5"/></g>; })}
      <text x={cx-54} y={H-24} fontSize="16" textAnchor="middle" dominantBaseline="middle" filter="url(#fSh)" style={{userSelect:'none'}}>📖</text>
      <text x={cx+54} y={H-24} fontSize="16" textAnchor="middle" dominantBaseline="middle" filter="url(#fSh)" style={{userSelect:'none'}}>🥁</text>
      <path d={`M${cx-52} ${H-16} Q${cx} ${H-2} ${cx+52} ${H-16}`} fill="none" stroke="url(#fG1)" strokeWidth="2.5"/>
      <circle cx={cx} cy={H-2} r={5.5} fill="url(#fG1)"/>
      {[-30,30].map((dx,i) => <circle key={i} cx={cx+dx} cy={H-12} r={3.5} fill="#d4a017" opacity="0.78"/>)}
      {[0,90,180,270].map((ang,i) => { const [ex,ey]=ptE(ang,rx+18,ry+18); return <g key={i}><circle cx={ex} cy={ey} r={5.5} fill="url(#fRed)" stroke="#d4a017" strokeWidth="1.5"/><circle cx={ex} cy={ey} r={2.5} fill="#ff5070" opacity="0.6"/></g>; })}
    </svg>
  );
}

// ── Achtergrond ───────────────────────────────────────────────────────────
const STARS = Array.from({length:45},(_,i)=>({id:i,x:Math.random()*100,y:Math.random()*100,size:1+Math.random()*2.5,delay:Math.random()*5,dur:2+Math.random()*4}));
const PEPERS = Array.from({length:10},(_,i)=>({id:i,x:10+Math.random()*80,y:10+Math.random()*80,delay:Math.random()*3,dur:2.5+Math.random()*2}));
const CONFETTI = Array.from({length:30},(_,i)=>({id:i,x:Math.random()*100,delay:Math.random()*3,dur:2+Math.random()*3,color:['#c0001a','#d4a017','#f5e642','#ffffff','#e8a000'][i%5],size:6+Math.random()*8}));

// ── Gedeelde stijlen ──────────────────────────────────────────────────────
const bubble = { background:'linear-gradient(160deg,rgba(42,5,8,0.98),rgba(22,3,5,0.99))', border:'2px solid rgba(212,160,23,0.45)', borderRadius:18, padding:'14px 16px', boxShadow:'0 8px 28px rgba(0,0,0,0.65), 0 0 20px rgba(140,0,20,0.1)' };
const btnG = { padding:'10px 22px', borderRadius:24, background:'linear-gradient(135deg,#8B6914,#d4a017,#f5e642,#d4a017,#8B6914)', backgroundSize:'200% auto', border:'none', color:'#1a0500', fontWeight:700, fontSize:13, fontFamily:"'IM Fell English', serif", cursor:'pointer', letterSpacing:'0.05em', boxShadow:'0 4px 18px rgba(212,160,23,0.4)' };
const btnR = { padding:'10px 18px', borderRadius:24, background:'linear-gradient(135deg,#6b0010,#a0001a,#c0001a)', border:'none', color:'#fff8f0', fontWeight:700, fontSize:13, fontFamily:"'IM Fell English', serif", cursor:'pointer', letterSpacing:'0.05em', boxShadow:'0 4px 18px rgba(140,0,20,0.4)' };
const inp = { background:'rgba(100,0,12,0.12)', border:'1px solid rgba(212,160,23,0.32)', borderRadius:12, padding:'9px 13px', color:'#f5e642', fontSize:14, fontFamily:"'IM Fell English', serif", outline:'none', width:'100%', marginBottom:8 };

// ── Countdown ─────────────────────────────────────────────────────────────
function CountdownDisplay() {
  const [cd,setCd]=useState(getCountdown());
  useEffect(()=>{const t=setInterval(()=>setCd(getCountdown()),1000);return()=>clearInterval(t);},[]);
  if(cd.isPakjesAvond) return (
    <motion.div initial={{scale:0.8}} animate={{scale:1}} style={{textAlign:'center',padding:'16px 0'}}>
      <div style={{fontSize:44,marginBottom:8}}>🎁</div>
      <h2 style={{color:'#f5e642',fontSize:18,margin:'0 0 6px',fontFamily:"'IM Fell English', serif"}}>Het is Pakjesavond!</h2>
      <p style={{color:'rgba(245,230,66,0.65)',fontSize:13,margin:0,fontStyle:'italic'}}>Vol verwachting klopt ons hart! 🌙</p>
      <div style={{position:'fixed',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:0}}>
        {CONFETTI.map(c=><div key={c.id} style={{position:'absolute',left:`${c.x}%`,top:'-20px',width:c.size,height:c.size,background:c.color,borderRadius:'50%',animation:`confettiFall ${c.dur}s linear ${c.delay}s infinite`}}/>)}
      </div>
    </motion.div>
  );
  return (
    <div>
      <p style={{color:'rgba(212,160,23,0.6)',fontSize:11,textAlign:'center',letterSpacing:'0.14em',textTransform:'uppercase',margin:'0 0 12px',fontStyle:'italic'}}>🌙 Aftellen tot Pakjesavond — 5 december 🌙</p>
      <div style={{display:'flex',gap:8,justifyContent:'center'}}>
        {[{val:cd.days,label:'dagen'},{val:cd.hours,label:'uur'},{val:cd.mins,label:'min'},{val:cd.secs,label:'sec'}].map(({val,label})=>(
          <div key={label} style={{background:'linear-gradient(160deg,rgba(130,0,14,0.28),rgba(70,0,8,0.2))',border:'1.5px solid rgba(212,160,23,0.35)',borderRadius:12,padding:'10px 10px',minWidth:52,textAlign:'center'}}>
            <div style={{color:'#f5e642',fontSize:22,fontWeight:700,fontFamily:"'IM Fell English', serif",lineHeight:1}}>{String(val).padStart(2,'0')}</div>
            <div style={{color:'rgba(212,160,23,0.55)',fontSize:9,letterSpacing:'0.1em',marginTop:3}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quiz ──────────────────────────────────────────────────────────────────
function QuizMode({onBack}) {
  const [quiz]=useState(()=>shuffleQuiz());
  const [qi,setQi]=useState(0);
  const [score,setScore]=useState(0);
  const [chosen,setChosen]=useState(null);
  const [done,setDone]=useState(false);
  const q=quiz[qi];
  const pick=(i)=>{
    if(chosen!==null)return;
    setChosen(i);
    if(i===q.correct)setScore(s=>s+1);
    setTimeout(()=>{if(qi+1<quiz.length){setQi(qi+1);setChosen(null);}else setDone(true);},1300);
  };
  const verdict=score>=4?'⭐ Uitstekend! Sint is zeer trots op jou!':score>=3?'🎁 Heel goed! Je weet veel van Sint!':score>=2?'🍊 Aardig! Je leert het snel!':'📖 Oefenen maar! Sint heeft nog veel te vertellen!';
  if(done) return (
    <div style={bubble}>
      <div style={{textAlign:'center',padding:'8px 0'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:10}}><MijterSVG size={38}/></div>
        <p style={{color:'#f5e642',fontSize:16,margin:'0 0 4px',fontFamily:"'IM Fell English', serif"}}>{score} van de {quiz.length} goed!</p>
        <p style={{color:'rgba(245,230,66,0.72)',fontSize:13,fontStyle:'italic',margin:'0 0 14px'}}>{verdict}</p>
        <button onClick={onBack} style={btnR}>← Terug naar Sint</button>
      </div>
    </div>
  );
  return (
    <motion.div key={qi} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}>
      <div style={bubble}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <MijterSVG size={22}/>
          <p style={{color:'rgba(212,160,23,0.55)',fontSize:10,margin:0,letterSpacing:'0.12em'}}>VRAAG {qi+1} / {quiz.length} · {score} punt{score!==1?'en':''}</p>
        </div>
        <p style={{color:'#f5e642',fontSize:14,margin:'0 0 14px',lineHeight:1.6,fontFamily:"'IM Fell English', serif"}}>👑 {q.q}</p>
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {q.answers.map((a,i)=>{
            let bg='rgba(212,160,23,0.07)',border='rgba(212,160,23,0.2)',color='rgba(245,230,66,0.82)';
            if(chosen!==null){if(i===q.correct){bg='rgba(34,139,34,0.25)';border='#228B22';color='#90EE90';}else if(i===chosen){bg='rgba(160,0,20,0.25)';border='#c0001a';color='#ff9999';}}
            return <button key={i} onClick={()=>pick(i)} style={{padding:'9px 14px',borderRadius:10,textAlign:'left',background:bg,border:`1px solid ${border}`,color,fontSize:13,cursor:'pointer',fontFamily:"'IM Fell English', serif",transition:'all 0.2s'}}>{['A','B','C','D'][i]}. {a}</button>;
          })}
        </div>
        <button onClick={onBack} style={{...btnR,marginTop:12,padding:'7px 14px',fontSize:11}}>← Stoppen</button>
      </div>
    </motion.div>
  );
}

// ── Rijm mode ─────────────────────────────────────────────────────────────
function RijmMode({apiKey,onBack}) {
  const [name,setName]=useState('');
  const [age,setAge]=useState('');
  const [wish,setWish]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [speaking,setSpeaking]=useState(false);

  const go=async()=>{
    if(!name||!age||!wish){setErr('Vul naam, leeftijd én wens in ✨');return;}
    if(!apiKey){setErr('Stel eerst een API sleutel in! 🔑');return;}
    setLoading(true);setErr('');setResult(null);
    try {
      const raw=await callGemini(apiKey,buildRijmPrompt(name,age,wish));
      const data=JSON.parse(raw);
      setResult(data);setSpeaking(true);
      speak((data.intro||'')+' '+(data.rijm||''),()=>setSpeaking(false));
    } catch {
      // Fallback — Sint reageert altijd
      const fallbackTekst=buildSintFallback(name);
      setResult({intro:'Sint spreekt tot jou:',rijm:fallbackTekst,_isFallback:true});
      setSpeaking(true);
      speak(fallbackTekst,()=>setSpeaking(false));
    }
    setLoading(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%'}}>
      <div style={bubble}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <MijterSVG size={26}/>
          <p style={{color:'#f5e642',fontSize:14,margin:0,fontFamily:"'IM Fell English', serif"}}>Sint schrijft een persoonlijk rijmpje!</p>
        </div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Naam van het kind..." style={inp}/>
        <input value={age} onChange={e=>setAge(e.target.value)} placeholder="Leeftijd (bijv. 7)..." style={inp} inputMode="numeric"/>
        <input value={wish} onChange={e=>setWish(e.target.value)} placeholder="Grootste wens (bijv. een fiets)..." style={inp}/>
        {err&&<p style={{color:'#ff9999',fontSize:12,margin:'0 0 8px'}}>{err}</p>}
        <div style={{display:'flex',gap:8,marginTop:4}}>
          <button onClick={onBack} style={{...btnR,padding:'9px 14px',fontSize:12}}>← Terug</button>
          <button onClick={go} disabled={loading} style={{...btnG,flex:1}}>{loading?'✨ Sint schrijft...':'🖊️ Schrijf mijn rijmpje!'}</button>
        </div>
      </div>
      <AnimatePresence>
        {result&&(
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} style={bubble}>
            {result.intro&&<p style={{color:'#d4a017',fontSize:13,fontStyle:'italic',margin:'0 0 10px',lineHeight:1.6}}>"{result.intro}"</p>}
            <div style={{background:'rgba(130,0,12,0.12)',border:'1px solid rgba(212,160,23,0.15)',borderRadius:12,padding:'12px 14px'}}>
              {(result.rijm||'').split('\n').map((line,i)=>(
                <p key={i} style={{color:'#f5e642',fontSize:13,margin:'0 0 4px',fontFamily:"'IM Fell English', serif",fontStyle:'italic',lineHeight:1.8}}>{line}</p>
              ))}
            </div>
            {result._isFallback&&<p style={{color:'rgba(212,160,23,0.4)',fontSize:10,marginTop:8,fontStyle:'italic'}}>✦ Sint spreekt vanuit zijn magisch geheugen ✦</p>}
            <button onClick={()=>{setSpeaking(true);speak((result.intro||'')+' '+(result.rijm||''),()=>setSpeaking(false));}}
              style={{marginTop:10,background:'none',border:'none',color:'rgba(212,160,23,0.55)',cursor:'pointer',fontSize:13}}>
              🔊 {speaking?'Sint spreekt...':'Opnieuw voorlezen'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Verlang mode ──────────────────────────────────────────────────────────
function VerlangMode({apiKey,onBack}) {
  const [name,setName]=useState('');
  const [wishes,setWishes]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');

  const go=async()=>{
    if(!name||!wishes){setErr('Vertel je naam en wensen! ✨');return;}
    if(!apiKey){setErr('Stel eerst een API sleutel in! 🔑');return;}
    setLoading(true);setErr('');setResult(null);
    try {
      const raw=await callGemini(apiKey,buildVerlangPrompt(name,wishes));
      const data=JSON.parse(raw);
      setResult(data);
    } catch {
      setResult(buildVerlangFallback(name));
    }
    setLoading(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%'}}>
      <div style={bubble}>
        <p style={{color:'#f5e642',fontSize:14,margin:'0 0 12px',fontFamily:"'IM Fell English', serif"}}>📜 Dicteer je verlanglijstje aan Sint!</p>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Jouw naam..." style={inp}/>
        <textarea value={wishes} onChange={e=>setWishes(e.target.value)} placeholder="Mijn wensen: een fiets, lego, een boek..." rows={3} style={{...inp,resize:'vertical'}}/>
        {err&&<p style={{color:'#ff9999',fontSize:12,margin:'0 0 8px'}}>{err}</p>}
        <div style={{display:'flex',gap:8,marginTop:4}}>
          <button onClick={onBack} style={{...btnR,padding:'9px 14px',fontSize:12}}>← Terug</button>
          <button onClick={go} disabled={loading} style={{...btnG,flex:1}}>{loading?'📜 Sint leest mee...':'📬 Stuur naar Sint!'}</button>
        </div>
      </div>
      <AnimatePresence>
        {result&&(
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} style={bubble}>
            <p style={{color:'rgba(212,160,23,0.55)',fontSize:10,margin:'0 0 10px',letterSpacing:'0.12em',textTransform:'uppercase'}}>✦ Sint heeft je lijst gelezen ✦</p>
            {result.reacties?.map((r,i)=>(
              <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:'1px solid rgba(212,160,23,0.1)'}}>
                <p style={{color:'#d4a017',fontSize:12,margin:'0 0 3px',fontWeight:700}}>🍊 {r.wens}</p>
                <p style={{color:'rgba(245,230,66,0.78)',fontSize:13,fontStyle:'italic',margin:0,lineHeight:1.6}}>"{r.reactie}"</p>
              </div>
            ))}
            {result.slotwoord&&<p style={{color:'#f5e642',fontSize:13,margin:'8px 0 0',fontFamily:"'IM Fell English', serif",lineHeight:1.6}}>👑 {result.slotwoord}</p>}
            {result._isFallback&&<p style={{color:'rgba(212,160,23,0.4)',fontSize:10,marginTop:8,fontStyle:'italic'}}>✦ Sint spreekt vanuit zijn magisch geheugen ✦</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Schoen mode ───────────────────────────────────────────────────────────
function SchoenMode({apiKey,onBack}) {
  const [name,setName]=useState('');
  const [items,setItems]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [speaking,setSpeaking]=useState(false);

  const go=async()=>{
    if(!name||!items){setErr('Vertel wat je in je schoen hebt gelegd! 👟');return;}
    if(!apiKey){setErr('Stel eerst een API sleutel in! 🔑');return;}
    setLoading(true);setErr('');setResult(null);
    try {
      const raw=await callGemini(apiKey,buildSchoenPrompt(name,items));
      const data=JSON.parse(raw);
      setResult(data);setSpeaking(true);
      speak(data.bericht||'',()=>setSpeaking(false));
    } catch {
      const fallback=buildSchoenFallback(name,items);
      setResult(fallback);setSpeaking(true);
      speak(fallback.bericht,()=>setSpeaking(false));
    }
    setLoading(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%'}}>
      <div style={bubble}>
        <p style={{color:'#f5e642',fontSize:14,margin:'0 0 12px',fontFamily:"'IM Fell English', serif"}}>👟 Zet je schoen! Wat leg jij erin?</p>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Jouw naam..." style={inp}/>
        <input value={items} onChange={e=>setItems(e.target.value)} placeholder="Een wortel, een tekening, water..." style={inp}/>
        {err&&<p style={{color:'#ff9999',fontSize:12,margin:'0 0 8px'}}>{err}</p>}
        <div style={{display:'flex',gap:8,marginTop:4}}>
          <button onClick={onBack} style={{...btnR,padding:'9px 14px',fontSize:12}}>← Terug</button>
          <button onClick={go} disabled={loading} style={{...btnG,flex:1}}>{loading?'🎅 Sint kijkt...':'🥕 Zet mijn schoen!'}</button>
        </div>
      </div>
      <AnimatePresence>
        {result&&(
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} style={bubble}>
            <p style={{color:'#f5e642',fontSize:14,margin:'0 0 10px',fontFamily:"'IM Fell English', serif",lineHeight:1.7}}>👑 {result.bericht}</p>
            {result.gekregen&&(
              <div style={{background:'rgba(212,160,23,0.07)',border:'1px solid rgba(212,160,23,0.2)',borderRadius:10,padding:'9px 12px',marginTop:6}}>
                <p style={{color:'#d4a017',fontSize:11,margin:'0 0 4px',letterSpacing:'0.1em'}}>🎁 MISSCHIEN MORGEN IN JE SCHOEN:</p>
                <p style={{color:'rgba(245,230,66,0.72)',fontSize:12,fontStyle:'italic',margin:0,lineHeight:1.6}}>{result.gekregen}</p>
              </div>
            )}
            {result._isFallback&&<p style={{color:'rgba(212,160,23,0.4)',fontSize:10,marginTop:8,fontStyle:'italic'}}>✦ Sint spreekt vanuit zijn magisch geheugen ✦</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Home menu ─────────────────────────────────────────────────────────────
function HomeMenu({onSelect}) {
  const items=[
    {id:MODE.RIJM,icon:'🖊️',label:'Mijn Rijmpje',sub:'Sint schrijft speciaal voor jou'},
    {id:MODE.VERLANG,icon:'📜',label:'Verlanglijstje',sub:'Vertel jouw wensen aan Sint'},
    {id:MODE.SCHOEN,icon:'👟',label:'Schoen Zetten',sub:'Wat leg jij erin voor Piet?'},
    {id:MODE.QUIZ,icon:'👑',label:'Sinterklaas Quiz',sub:'5 vragen — hoe goed ken jij Sint?'},
    {id:MODE.TELLER,icon:'🌙',label:'Aftellen',sub:'Vol verwachting klopt ons hart!'},
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%'}}>
      {items.map((item,i)=>(
        <motion.button key={item.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
          onClick={()=>onSelect(item.id)}
          style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:14,background:'linear-gradient(135deg,rgba(100,0,12,0.32),rgba(55,0,7,0.24))',border:'1.5px solid rgba(212,160,23,0.3)',cursor:'pointer',textAlign:'left',boxShadow:'0 2px 14px rgba(0,0,0,0.38)',width:'100%'}}>
          <span style={{fontSize:24,minWidth:34,textAlign:'center'}}>{item.icon}</span>
          <div style={{flex:1}}>
            <p style={{color:'#f5e642',fontSize:14,margin:0,fontFamily:"'IM Fell English', serif",fontWeight:700}}>{item.label}</p>
            <p style={{color:'rgba(212,160,23,0.52)',fontSize:11,margin:0,fontStyle:'italic'}}>{item.sub}</p>
          </div>
          <span style={{color:'rgba(212,160,23,0.45)',fontSize:18}}>›</span>
        </motion.button>
      ))}
    </div>
  );
}

// ── API Key modal ─────────────────────────────────────────────────────────
function ApiKeyModal({current,onSave,onClose}) {
  const [val,setVal]=useState(current);
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.93)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'linear-gradient(160deg,#200008,#0e0003)',border:'2px solid rgba(212,160,23,0.45)',borderRadius:20,padding:24,maxWidth:320,width:'92%',boxShadow:'0 8px 40px rgba(0,0,0,0.9)'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:10}}><MijterSVG size={40}/></div>
        <h2 style={{margin:'0 0 6px',fontSize:17,color:'#f5e642',textAlign:'center',fontFamily:"'IM Fell English', serif",fontWeight:400}}>🔑 Gemini API Sleutel</h2>
        <p style={{margin:'0 0 4px',fontSize:11,color:'rgba(245,230,66,0.42)',textAlign:'center',lineHeight:1.6}}>
          Dezelfde sleutel als de andere spiegels.<br/>Wordt alleen op dit apparaat opgeslagen.
        </p>
        <p style={{margin:'0 0 14px',fontSize:11,textAlign:'center'}}>
          Nog geen sleutel?{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
            style={{color:'#d4a017',textDecoration:'underline',cursor:'pointer'}}>
            Haal hem hier op bij Google AI Studio →
          </a>
        </p>
        <input type="password" value={val} onChange={e=>setVal(e.target.value)} placeholder="AIza..." style={{...inp,textAlign:'center',marginBottom:14}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'9px',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:12,fontFamily:"'IM Fell English', serif"}}>Annuleer</button>
          <button onClick={()=>onSave(val)} style={{flex:1,padding:'9px',background:'linear-gradient(135deg,#c0001a,#e8002a)',border:'none',borderRadius:10,color:'#fff8f0',fontWeight:700,cursor:'pointer',fontSize:12,fontFamily:"'IM Fell English', serif"}}>Opslaan</button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Hoofd component ───────────────────────────────────────────────────────
export default function SinterklasSpiegel() {
  const [mode,setMode]=useState(MODE.HOME);
  const [isSpeaking,setIsSpeaking]=useState(false);
  const [showKeyModal,setShowKeyModal]=useState(false);
  const [apiKey,setApiKey]=useState(()=>{
    if(ENV_KEY)return ENV_KEY;
    try{return localStorage.getItem(STORAGE_KEY)||'';}catch{return '';}
  });
  const videoRef=useRef(null);
  const streamRef=useRef(null);

  useEffect(()=>{
    (async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});streamRef.current=stream;if(videoRef.current)videoRef.current.srcObject=stream;}catch{}})();
    return()=>streamRef.current?.getTracks().forEach(t=>t.stop());
  },[]);

  useEffect(()=>{
    const t=setTimeout(()=>{setIsSpeaking(true);speak('Vol verwachting klopt ons hart! Welkom bij de Sinterklaas Spiegel!',()=>setIsSpeaking(false));},1200);
    return()=>clearTimeout(t);
  },[]);

  const saveKey=(k)=>{
    setApiKey(k);
    try{localStorage.setItem(STORAGE_KEY,k);}catch{}
    setShowKeyModal(false);
  };

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      <div style={S.bg}/><div style={S.bgNight}/>
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {STARS.map(s=><div key={s.id} style={{position:'absolute',left:`${s.x}%`,top:`${s.y}%`,width:s.size,height:s.size,borderRadius:'50%',background:'#fff8f0',animation:`starTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`}}/>)}
      </div>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
          <MijterSVG size={32}/>
          <h1 style={S.title}>Sinterklaas Spiegel</h1>
          <MijterSVG size={32}/>
        </div>
        <p style={S.subtitle}>🌙 Vol verwachting klopt ons hart 🌙</p>
      </header>
      <div style={S.mirrorWrap}>
        <SintFrame W={270} H={330}/>
        <div style={S.mirrorGlass}>
          <video ref={videoRef} autoPlay playsInline muted style={S.video}/>
          {mode!==MODE.HOME&&(
            <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',borderRadius:'50% 50% 47% 47%',zIndex:3}}>
              {PEPERS.map(p=><div key={p.id} style={{position:'absolute',left:`${p.x}%`,top:`${p.y}%`,fontSize:11,animation:`peper ${p.dur}s ease-in-out ${p.delay}s infinite`,userSelect:'none'}}>🍊</div>)}
            </div>
          )}
          {isSpeaking&&<div style={{position:'absolute',inset:-4,borderRadius:'50% 50% 47% 47%',border:'3px solid #c0001a',animation:'speakRing 1s ease-in-out infinite',pointerEvents:'none',zIndex:4}}/>}
        </div>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}} style={S.sintBadge}>✦ Welkom bij Sint ✦</motion.div>
      </div>
      <div style={S.content}>
        <AnimatePresence mode="wait">
          {mode===MODE.HOME&&<motion.div key="home" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{width:'100%'}}><HomeMenu onSelect={setMode}/></motion.div>}
          {mode===MODE.RIJM&&<motion.div key="rijm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{width:'100%'}}><RijmMode apiKey={apiKey} onBack={()=>setMode(MODE.HOME)}/></motion.div>}
          {mode===MODE.VERLANG&&<motion.div key="verlang" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{width:'100%'}}><VerlangMode apiKey={apiKey} onBack={()=>setMode(MODE.HOME)}/></motion.div>}
          {mode===MODE.SCHOEN&&<motion.div key="schoen" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{width:'100%'}}><SchoenMode apiKey={apiKey} onBack={()=>setMode(MODE.HOME)}/></motion.div>}
          {mode===MODE.QUIZ&&<motion.div key="quiz" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{width:'100%'}}><QuizMode onBack={()=>setMode(MODE.HOME)}/></motion.div>}
          {mode===MODE.TELLER&&<motion.div key="teller" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{width:'100%'}}><div style={bubble}><CountdownDisplay/><div style={{textAlign:'center',marginTop:14}}><button onClick={()=>setMode(MODE.HOME)} style={{...btnR,fontSize:12}}>← Terug naar Sint</button></div></div></motion.div>}
        </AnimatePresence>
      </div>
      {!ENV_KEY&&<button onClick={()=>setShowKeyModal(true)} style={S.btnKey}>🔑 {apiKey?'Gemini sleutel ✓':'API sleutel instellen'}</button>}
      <AnimatePresence>{showKeyModal&&<ApiKeyModal current={apiKey} onSave={saveKey} onClose={()=>setShowKeyModal(false)}/>}</AnimatePresence>
    </div>
  );
}

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap');
  *{box-sizing:border-box;}
  input::placeholder,textarea::placeholder{color:rgba(245,230,66,0.28);}
  textarea{font-family:'IM Fell English',serif;color:#f5e642;background:transparent;}
  button:active{opacity:0.82;transform:scale(0.98);}
  @keyframes starTwinkle{0%,100%{opacity:0.12;transform:scale(1);}50%{opacity:0.9;transform:scale(1.5);}}
  @keyframes speakRing{0%,100%{opacity:0.28;transform:scale(1);}50%{opacity:1;transform:scale(1.04);}}
  @keyframes mirrorPulse{0%,100%{box-shadow:0 0 30px rgba(140,0,15,0.22),0 0 60px rgba(212,160,23,0.06),inset 0 0 28px rgba(0,0,0,0.65);}50%{box-shadow:0 0 54px rgba(140,0,15,0.44),0 0 95px rgba(212,160,23,0.14),inset 0 0 28px rgba(0,0,0,0.65);}}
  @keyframes titleShimmer{0%,100%{text-shadow:0 0 10px rgba(192,0,26,0.45),0 2px 4px rgba(0,0,0,0.85);}50%{text-shadow:0 0 24px rgba(245,230,66,0.72),0 0 44px rgba(192,0,26,0.38),0 2px 4px rgba(0,0,0,0.85);}}
  @keyframes peper{0%,100%{opacity:0;transform:translateY(0) scale(0.8);}40%{opacity:0.75;}50%{opacity:0.35;transform:translateY(-10px) scale(1.1);}80%{opacity:0.55;}}
  @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1;}100%{transform:translateY(110vh) rotate(720deg);opacity:0;}}
`;

const S={
  app:{minHeight:'100vh',background:'#020006',color:'#f0e8d0',fontFamily:"'IM Fell English',serif",display:'flex',flexDirection:'column',alignItems:'center',padding:'0 0 52px',position:'relative',overflow:'hidden'},
  bg:{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,background:'radial-gradient(ellipse at 50% 0%,rgba(90,0,14,0.65) 0%,rgba(6,0,16,0.97) 55%,#020006 100%)'},
  bgNight:{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,background:'radial-gradient(ellipse at 10% 95%,rgba(18,8,0,0.4) 0%,transparent 50%),radial-gradient(ellipse at 90% 95%,rgba(18,8,0,0.4) 0%,transparent 50%)'},
  header:{width:'100%',maxWidth:480,padding:'18px 16px 8px',display:'flex',flexDirection:'column',alignItems:'center',position:'relative',zIndex:10},
  title:{margin:0,fontSize:20,fontWeight:700,color:'#f5e642',animation:'titleShimmer 3.5s ease-in-out infinite',letterSpacing:'0.04em'},
  subtitle:{margin:'3px 0 0',fontSize:11,color:'rgba(212,160,23,0.45)',letterSpacing:'0.1em',fontStyle:'italic'},
  mirrorWrap:{position:'relative',width:270,height:330,display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,marginBottom:10},
  mirrorGlass:{position:'absolute',top:18,left:22,width:226,height:290,borderRadius:'50% 50% 47% 47%',overflow:'hidden',background:'linear-gradient(160deg,#110006 0%,#040002 100%)',animation:'mirrorPulse 4.5s ease-in-out infinite',zIndex:1},
  video:{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)',filter:'brightness(0.78) contrast(1.08) saturate(0.7)'},
  sintBadge:{position:'absolute',bottom:-10,left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,rgba(70,0,10,0.97),rgba(35,0,5,0.97))',border:'1px solid rgba(212,160,23,0.44)',borderRadius:20,padding:'4px 20px',fontSize:12,color:'#f5e642',whiteSpace:'nowrap',zIndex:10,letterSpacing:'0.08em',boxShadow:'0 2px 12px rgba(0,0,0,0.55)'},
  content:{width:'100%',maxWidth:430,padding:'0 12px',display:'flex',flexDirection:'column',alignItems:'center',gap:10,position:'relative',zIndex:20},
  btnKey:{marginTop:18,padding:'6px 16px',background:'transparent',border:'1px solid rgba(212,160,23,0.15)',borderRadius:20,fontSize:10,color:'rgba(212,160,23,0.4)',letterSpacing:'0.1em',cursor:'pointer',position:'relative',zIndex:20,fontFamily:"'IM Fell English',serif"},
};
