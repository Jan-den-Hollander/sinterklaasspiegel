/**
 * Sinterklaas Spiegel — v1
 * Bisschopsmijter SVG · Speelgoed-krans · Rijmpjes · Verlanglijstje
 * Schoentje zetten · Quiz · Aftellen tot 5 december · Pakjesavond confetti
 */
import { useState, useRef, useEffect } from 'react';
import { Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── API sleutel ───────────────────────────────────────────────────────────
const ENV_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_KEY) || '';

// ── Retry helper ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
async function fetchWithRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))
      ]);
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const isRetryable = err?.message?.includes('timeout') || err?.message?.includes('503') || err?.message?.includes('overloaded');
      if (isLast || !isRetryable) throw err;
      await sleep(attempt * 1500);
    }
  }
}

// ── TTS ───────────────────────────────────────────────────────────────────
const getVoices = () => new Promise(resolve => {
  const v = window.speechSynthesis.getVoices();
  if (v.length) { resolve(v); return; }
  window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
});

async function speakWithFallback(text, onEnd = () => {}) {
  if (!text) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const voices = await getVoices();
  const pick = voices.find(v => v.lang.startsWith('nl') && /male|man/i.test(v.name))
    || voices.find(v => v.lang.startsWith('nl'))
    || voices[0];
  const utt = new SpeechSynthesisUtterance(text);
  if (pick) utt.voice = pick;
  utt.lang = 'nl-NL';
  utt.rate = 0.82; utt.pitch = 0.88; // diepe, plechtige sint-stem
  utt.onend = onEnd; utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
  setTimeout(() => { try { window.speechSynthesis.cancel(); } catch {} }, text.length * 75 + 4000);
}

// ── Countdown tot 5 december ──────────────────────────────────────────────
function getCountdown() {
  const now = new Date();
  const year = now.getFullYear();
  let pakjes = new Date(year, 11 - 1, 5, 18, 0, 0); // 5 dec 18:00
  if (now > pakjes) pakjes = new Date(year + 1, 11 - 1, 5, 18, 0, 0);
  const diff = pakjes - now;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const isPakjesAvond = diff <= 0 || (now.getMonth() === 11 && now.getDate() === 5);
  return { days, hours, mins, secs, isPakjesAvond };
}

// ── Quiz vragen ───────────────────────────────────────────────────────────
const QUIZ = [
  { q: 'Hoe heet het paard van Sinterklaas?', answers: ['Amerigo', 'Tornado', 'Blixem', 'Domino'], correct: 0 },
  { q: 'Uit welk land komt Sinterklaas?', answers: ['Spanje', 'Italië', 'Portugal', 'Griekenland'], correct: 0 },
  { q: 'Wat zijn de helpers van Sinterklaas?', answers: ['Zwarte Pieten', 'Elfen', 'Kabouters', 'Dwergen'], correct: 0 },
  { q: 'Op welke datum is Pakjesavond?', answers: ['5 december', '6 december', '25 december', '1 december'], correct: 0 },
  { q: 'Wat leg je in je schoen voor Sinterklaas?', answers: ['Een wortel', 'Een appel', 'Een banaan', 'Een koekje'], correct: 0 },
];

// ── Modi ──────────────────────────────────────────────────────────────────
const MODE = { HOME: 'home', RIJM: 'rijm', VERLANG: 'verlang', SCHOEN: 'schoen', QUIZ: 'quiz', TELLER: 'teller' };

// ── Prompts ───────────────────────────────────────────────────────────────
const buildRijmPrompt = (name, age, wish) =>
  `Je bent Sinterklaas zelf — waardig, hartelijk, met humor. Schrijf een persoonlijk Sinterklaas-rijmpje voor ${name} (${age} jaar) die graag ${wish} wil.
Stijl: klassiek AABB rijmschema, 8 regels, kindvriendelijk, warm en feestelijk.
Eindig met: "Ho ho ho, goedenacht!" of vergelijkbaar.
Antwoord ALLEEN als JSON zonder markdown:
{"rijm":"...","intro":"Een kort welkomstwoord van Sint (1 zin, persoonlijk)"}`;

const buildVerlangPrompt = (name, wishes) =>
  `Je bent Sinterklaas. ${name} heeft de volgende wensen: ${wishes}.
Reageer op elk verlanglijstje-item met een korte, grappige reactie van Sint.
Sluit af met een bemoedigend woord.
Antwoord ALLEEN als JSON zonder markdown:
{"reacties":[{"wens":"...","reactie":"..."}],"slotwoord":"..."}`;

const buildSchoenPrompt = (name, items) =>
  `Je bent Sinterklaas. ${name} heeft het volgende in het schoentje gelegd: ${items}.
Reageer warm, grappig en kindvriendelijk alsof je dit net hebt ontdekt via de schoorsteen.
Antwoord ALLEEN als JSON zonder markdown:
{"bericht":"... (2-3 zinnen, persoonlijk en grappig)","gekregen":"wat het kind morgen misschien krijgt (1 verrassing, raadselachtig omschreven)"}`;

// ── Mijter SVG (bisschopsmijter, rood met goud) ───────────────────────────
function MijterIcon({ size = 36 }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 60 66" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="mRed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c0001a" />
          <stop offset="50%" stopColor="#e8002a" />
          <stop offset="100%" stopColor="#8b0010" />
        </linearGradient>
        <linearGradient id="mGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" />
          <stop offset="50%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      {/* Basis band */}
      <rect x="8" y="54" width="44" height="8" rx="3" fill="url(#mGold)" />
      {/* Linker vleugel */}
      <path d="M10 54 C8 38 4 22 12 8 C16 2 22 0 30 0 C20 10 16 28 14 54Z" fill="url(#mRed)" />
      {/* Rechter vleugel */}
      <path d="M50 54 C52 38 56 22 48 8 C44 2 38 0 30 0 C40 10 44 28 46 54Z" fill="url(#mRed)" />
      {/* Gouden kruis */}
      <rect x="27" y="12" width="6" height="22" rx="1.5" fill="url(#mGold)" />
      <rect x="20" y="19" width="20" height="6" rx="1.5" fill="url(#mGold)" />
      {/* Gouden rand op band */}
      <rect x="8" y="54" width="44" height="2.5" rx="1" fill="#ffe566" opacity="0.7" />
      {/* Glinstering */}
      <circle cx="30" cy="9" r="2.5" fill="#fff8c0" opacity="0.7" />
    </svg>
  );
}

// ── Speelgoed krans SVG ───────────────────────────────────────────────────
function ptOnEllipse(cx, cy, rx, ry, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
}

const KRANS = [
  { a: 0,   e: '⭐', fs: 22, off: 10 },
  { a: 13,  e: '🎁', fs: 18, off: 4  },
  { a: 26,  e: '🍭', fs: 16, off: 8  },
  { a: 39,  e: '⭐', fs: 14, off: 2  },
  { a: 52,  e: '🧸', fs: 18, off: 10 },
  { a: 65,  e: '🍫', fs: 15, off: 3  },
  { a: 78,  e: '🎶', fs: 16, off: 8  },
  { a: 91,  e: '⭐', fs: 13, off: 1  },
  { a: 104, e: '🪀', fs: 17, off: 9  },
  { a: 117, e: '🍭', fs: 14, off: 3  },
  { a: 130, e: '🎁', fs: 19, off: 11 },
  { a: 143, e: '⭐', fs: 13, off: 2  },
  { a: 156, e: '🎠', fs: 18, off: 10 },
  { a: 169, e: '🍫', fs: 15, off: 4  },
  { a: 182, e: '⭐', fs: 22, off: 10 },
  { a: 195, e: '🎶', fs: 14, off: 3  },
  { a: 208, e: '🧸', fs: 18, off: 9  },
  { a: 221, e: '🍭', fs: 15, off: 4  },
  { a: 234, e: '⭐', fs: 13, off: 1  },
  { a: 247, e: '🎁', fs: 18, off: 10 },
  { a: 260, e: '🪁', fs: 16, off: 3  },
  { a: 273, e: '🎠', fs: 17, off: 8  },
  { a: 286, e: '⭐', fs: 13, off: 2  },
  { a: 299, e: '🍫', fs: 15, off: 9  },
  { a: 312, e: '🎶', fs: 16, off: 4  },
  { a: 325, e: '🪀', fs: 17, off: 10 },
  { a: 338, e: '⭐', fs: 13, off: 2  },
  { a: 351, e: '🎁', fs: 18, off: 8  },
];

function SintFrame({ W = 270, H = 330 }) {
  const cx = W / 2, cy = H / 2;
  const rx = cx - 10, ry = cy - 10;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      <defs>
        <linearGradient id="sG1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff0a0" />
          <stop offset="25%" stopColor="#d4a017" />
          <stop offset="55%" stopColor="#b8860b" />
          <stop offset="80%" stopColor="#f0c040" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id="sG2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" />
          <stop offset="50%" stopColor="#c49a0c" />
          <stop offset="100%" stopColor="#f5e642" />
        </linearGradient>
        <filter id="sGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <filter id="eShadow">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1a0005" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Rode achtergrondellips — bisschopsmantel sfeer */}
      <ellipse cx={cx} cy={cy} rx={rx + 4} ry={ry + 4}
        fill="none" stroke="rgba(160,0,20,0.18)" strokeWidth="12" />

      {/* Gouden hoofdrand */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke="url(#sG1)" strokeWidth="6" />
      <ellipse cx={cx} cy={cy} rx={rx - 8} ry={ry - 8}
        fill="none" stroke="url(#sG2)" strokeWidth="1.5" opacity="0.55" />

      {/* Speelgoed krans */}
      {KRANS.map((p, i) => {
        const [px, py] = ptOnEllipse(cx, cy, rx + p.off, ry + p.off, p.a);
        return (
          <text key={i} x={px} y={py}
            fontSize={p.fs} textAnchor="middle" dominantBaseline="middle"
            filter="url(#eShadow)" style={{ userSelect: 'none' }}>
            {p.e}
          </text>
        );
      })}

      {/* Mijter medaillon bovenaan */}
      <circle cx={cx} cy={14} r={26} fill="url(#sG1)" filter="url(#sGlow)" />
      <circle cx={cx} cy={14} r={22} fill="#1a0005" />
      <circle cx={cx} cy={14} r={20} fill="rgba(160,0,20,0.15)" />
      {/* Mijter tekening in medaillon */}
      <g transform={`translate(${cx - 11}, 3)`}>
        {/* Kleine mijter SVG */}
        <path d="M4 22 C3 15 1 8 5 3 C7 1 9 0 11 0 C8 4 7 11 6 22Z" fill="#c0001a" />
        <path d="M18 22 C19 15 21 8 17 3 C15 1 13 0 11 0 C14 4 15 11 16 22Z" fill="#c0001a" />
        <rect x="3" y="22" width="16" height="3" rx="1" fill="#d4a017" />
        <rect x="9.5" y="5" width="3" height="11" rx="1" fill="#d4a017" />
        <rect x="6" y="9" width="10" height="3" rx="1" fill="#d4a017" />
      </g>
      <line x1={cx} y1={40} x2={cx} y2={cy - ry}
        stroke="url(#sG1)" strokeWidth="2.5" opacity="0.7" />
      <circle cx={cx} cy={41} r={3.5} fill="url(#sG1)" />

      {/* Onderkant sierrand */}
      <path d={`M${cx - 45} ${H - 18} Q${cx} ${H - 4} ${cx + 45} ${H - 18}`}
        fill="none" stroke="url(#sG1)" strokeWidth="2.5" />
      <circle cx={cx} cy={H - 4} r={5} fill="url(#sG1)" />
      {[-26, 26].map((dx, i) =>
        <circle key={i} cx={cx + dx} cy={H - 14} r={3} fill="#d4a017" opacity="0.7" />)}

      {/* Rode sierbolletjes op de hoeken */}
      {[0, 90, 180, 270].map((ang, i) => {
        const [ex, ey] = ptOnEllipse(cx, cy, rx + 16, ry + 16, ang);
        return <circle key={i} cx={ex} cy={ey} r={4} fill="#c0001a" stroke="#d4a017" strokeWidth="1.2" opacity="0.7" />;
      })}
    </svg>
  );
}

// ── Sterren achtergrond ───────────────────────────────────────────────────
const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  size: 1 + Math.random() * 2.5,
  delay: Math.random() * 5, dur: 2 + Math.random() * 4,
}));

// ── Pepernoten deeltjes ───────────────────────────────────────────────────
const PEPERS = Array.from({ length: 12 }, (_, i) => ({
  id: i, x: 10 + Math.random() * 80, y: 10 + Math.random() * 80,
  delay: Math.random() * 3, dur: 2 + Math.random() * 2,
}));

// ── Confetti voor pakjesavond ─────────────────────────────────────────────
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  id: i, x: Math.random() * 100,
  delay: Math.random() * 3, dur: 2 + Math.random() * 3,
  color: ['#c0001a', '#d4a017', '#f5e642', '#ffffff', '#228B22'][i % 5],
  size: 6 + Math.random() * 8,
}));

// ── Countdown display ─────────────────────────────────────────────────────
function CountdownDisplay() {
  const [cd, setCd] = useState(getCountdown());
  useEffect(() => {
    const t = setInterval(() => setCd(getCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  if (cd.isPakjesAvond) {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
        <h2 style={{ color: '#f5e642', fontSize: 22, margin: '0 0 6px', fontFamily: "'IM Fell English', serif" }}>
          Het is Pakjesavond!
        </h2>
        <p style={{ color: 'rgba(245,230,66,0.65)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
          Ho ho ho! Sinterklaas is onderweg! 🎅
        </p>
        {/* Confetti */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
          {CONFETTI.map(c => (
            <div key={c.id} style={{
              position: 'absolute', left: `${c.x}%`, top: '-20px',
              width: c.size, height: c.size,
              background: c.color, borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animation: `confettiFall ${c.dur}s linear ${c.delay}s infinite`,
            }} />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{ width: '100%', padding: '0 12px' }}>
      <p style={{ color: 'rgba(212,160,23,0.55)', fontSize: 10, textAlign: 'center',
        letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px', fontStyle: 'italic' }}>
        ✦ Aftellen tot Pakjesavond — 5 december ✦
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[
          { val: cd.days, label: 'dagen' },
          { val: cd.hours, label: 'uur' },
          { val: cd.mins, label: 'min' },
          { val: cd.secs, label: 'sec' },
        ].map(({ val, label }) => (
          <div key={label} style={{
            background: 'linear-gradient(160deg,rgba(160,0,20,0.22),rgba(100,0,10,0.18))',
            border: '1px solid rgba(212,160,23,0.32)',
            borderRadius: 12, padding: '10px 12px', minWidth: 52, textAlign: 'center',
          }}>
            <div style={{ color: '#f5e642', fontSize: 22, fontWeight: 700,
              fontFamily: "'IM Fell English', serif", lineHeight: 1 }}>
              {String(val).padStart(2, '0')}
            </div>
            <div style={{ color: 'rgba(212,160,23,0.5)', fontSize: 9,
              letterSpacing: '0.1em', marginTop: 3 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quiz component ────────────────────────────────────────────────────────
function QuizMode({ onBack }) {
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [done, setDone] = useState(false);

  const q = QUIZ[qi];

  const pick = (i) => {
    if (chosen !== null) return;
    setChosen(i);
    if (i === q.correct) setScore(s => s + 1);
    setTimeout(() => {
      if (qi + 1 < QUIZ.length) {
        setQi(qi + 1); setChosen(null);
      } else {
        setDone(true);
      }
    }, 1200);
  };

  const verdict = score >= 4 ? '🏆 Uitstekend! Sint is trots op jou!'
    : score >= 3 ? '⭐ Heel goed! Bijna alles geweten!'
    : score >= 2 ? '🎁 Aardig! Je weet al veel van Sint!'
    : '📖 Oefenen maar! Sint heeft nog veel te vertellen!';

  if (done) return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      style={{ width: '100%', padding: '0 12px' }}>
      <div style={bubbleStyle}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎅</div>
          <p style={{ color: '#f5e642', fontSize: 16, margin: '0 0 4px',
            fontFamily: "'IM Fell English', serif" }}>
            {score} van de {QUIZ.length} goed!
          </p>
          <p style={{ color: 'rgba(245,230,66,0.7)', fontSize: 13,
            fontStyle: 'italic', margin: '0 0 14px' }}>{verdict}</p>
          <button onClick={onBack} style={btnGold}>← Terug naar Sint</button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div key={qi} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      style={{ width: '100%', padding: '0 12px' }}>
      <div style={bubbleStyle}>
        <p style={{ color: 'rgba(212,160,23,0.5)', fontSize: 10, margin: '0 0 8px',
          letterSpacing: '0.12em' }}>VRAAG {qi + 1} / {QUIZ.length} · {score} punt{score !== 1 ? 'en' : ''}</p>
        <p style={{ color: '#f5e642', fontSize: 14, margin: '0 0 14px', lineHeight: 1.6,
          fontFamily: "'IM Fell English', serif" }}>🎅 {q.q}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {q.answers.map((a, i) => {
            let bg = 'rgba(212,160,23,0.07)';
            let border = 'rgba(212,160,23,0.18)';
            let color = 'rgba(245,230,66,0.75)';
            if (chosen !== null) {
              if (i === q.correct) { bg = 'rgba(34,139,34,0.22)'; border = '#228B22'; color = '#90EE90'; }
              else if (i === chosen) { bg = 'rgba(160,0,20,0.22)'; border = '#c0001a'; color = '#ff9999'; }
            }
            return (
              <button key={i} onClick={() => pick(i)} style={{
                padding: '9px 14px', borderRadius: 10, textAlign: 'left',
                background: bg, border: `1px solid ${border}`,
                color, fontSize: 13, cursor: 'pointer',
                fontFamily: "'IM Fell English', serif", transition: 'all 0.2s',
              }}>
                {['A', 'B', 'C', 'D'][i]}. {a}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Gedeelde stijlen ──────────────────────────────────────────────────────
const bubbleStyle = {
  background: 'linear-gradient(160deg,rgba(36,5,8,0.98),rgba(20,3,5,0.99))',
  border: '2px solid rgba(212,160,23,0.42)',
  borderRadius: 18, padding: '14px 16px',
  boxShadow: '0 8px 28px rgba(0,0,0,0.65), 0 0 20px rgba(160,0,20,0.08)',
};

const btnGold = {
  padding: '10px 24px', borderRadius: 24,
  background: 'linear-gradient(135deg,#8B6914,#d4a017,#f5e642,#d4a017,#8B6914)',
  backgroundSize: '200% auto', border: 'none',
  color: '#1a0500', fontWeight: 700, fontSize: 13,
  fontFamily: "'IM Fell English', serif", cursor: 'pointer',
  letterSpacing: '0.05em',
  boxShadow: '0 4px 18px rgba(212,160,23,0.4)',
};

const btnRed = {
  padding: '10px 24px', borderRadius: 24,
  background: 'linear-gradient(135deg,#6b0010,#a0001a,#c0001a,#a0001a,#6b0010)',
  border: 'none', color: '#fff8f0',
  fontWeight: 700, fontSize: 13,
  fontFamily: "'IM Fell English', serif", cursor: 'pointer',
  letterSpacing: '0.05em',
  boxShadow: '0 4px 18px rgba(160,0,20,0.4)',
};

const inputStyle = {
  background: 'rgba(160,0,20,0.07)',
  border: '1px solid rgba(212,160,23,0.32)',
  borderRadius: 12, padding: '9px 13px',
  color: '#f5e642', fontSize: 14,
  fontFamily: "'IM Fell English', serif",
  outline: 'none', width: '100%',
  marginBottom: 8,
};

// ── Rijmpje mode ──────────────────────────────────────────────────────────
function RijmMode({ apiKey, onBack }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [wish, setWish] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fetch_ = async () => {
    if (!name || !age || !wish) { setErr('Vul alles in! ✨'); return; }
    setLoading(true); setErr(''); setResult(null);
    try {
      const resp = await fetchWithRetry(() =>
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 1000,
            messages: [{ role: 'user', content: buildRijmPrompt(name, age, wish) }],
          }),
        }).then(r => r.json())
      );
      if (resp.error) throw new Error(resp.error.message);
      const raw = resp.content?.[0]?.text || '{}';
      const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setResult(data);
      setIsSpeaking(true);
      speakWithFallback((data.intro || '') + ' ' + (data.rijm || ''), () => setIsSpeaking(false));
    } catch { setErr('De spiegel reageert niet. Probeer opnieuw! ⏳'); }
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={bubbleStyle}>
        <p style={{ color: '#f5e642', fontSize: 14, margin: '0 0 12px',
          fontFamily: "'IM Fell English', serif" }}>
          🎅 Sinterklaas schrijft een persoonlijk rijmpje!
        </p>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Naam van het kind..." style={inputStyle} />
        <input value={age} onChange={e => setAge(e.target.value)}
          placeholder="Leeftijd (bijv. 7)..." style={inputStyle} inputMode="numeric" />
        <input value={wish} onChange={e => setWish(e.target.value)}
          placeholder="Grootste wens (bijv. een fiets)..." style={inputStyle} />
        {err && <p style={{ color: '#ff9999', fontSize: 12, margin: '0 0 8px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onBack} style={{ ...btnRed, padding: '9px 16px', fontSize: 12 }}>← Terug</button>
          <button onClick={fetch_} disabled={loading} style={{ ...btnGold, flex: 1 }}>
            {loading ? '✨ Even geduld...' : '🖊️ Schrijf mijn rijmpje!'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            style={bubbleStyle}>
            {isSpeaking && <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'rgba(212,160,23,0.6)', fontSize: 11 }}>🔊 Sinterklaas spreekt...</span>
            </div>}
            {result.intro && (
              <p style={{ color: '#d4a017', fontSize: 13, fontStyle: 'italic',
                margin: '0 0 10px', lineHeight: 1.6 }}>"{result.intro}"</p>
            )}
            <div style={{
              background: 'rgba(160,0,20,0.08)', border: '1px solid rgba(212,160,23,0.15)',
              borderRadius: 12, padding: '12px 14px',
            }}>
              {(result.rijm || '').split('\n').map((line, i) => (
                <p key={i} style={{ color: '#f5e642', fontSize: 13, margin: '0 0 4px',
                  fontFamily: "'IM Fell English', serif", fontStyle: 'italic', lineHeight: 1.7 }}>
                  {line}
                </p>
              ))}
            </div>
            <button onClick={() => {
              setIsSpeaking(true);
              speakWithFallback((result.intro || '') + ' ' + (result.rijm || ''), () => setIsSpeaking(false));
            }} style={{ marginTop: 10, background: 'none', border: 'none',
              color: 'rgba(212,160,23,0.5)', cursor: 'pointer', fontSize: 13 }}>
              🔊 Opnieuw voorlezen
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Verlanglijstje mode ───────────────────────────────────────────────────
function VerlangMode({ apiKey, onBack }) {
  const [name, setName] = useState('');
  const [wishes, setWishes] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fetch_ = async () => {
    if (!name || !wishes) { setErr('Vertel je naam en wensen! ✨'); return; }
    setLoading(true); setErr(''); setResult(null);
    try {
      const resp = await fetchWithRetry(() =>
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 1000,
            messages: [{ role: 'user', content: buildVerlangPrompt(name, wishes) }],
          }),
        }).then(r => r.json())
      );
      if (resp.error) throw new Error(resp.error.message);
      const raw = resp.content?.[0]?.text || '{}';
      const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setResult(data);
      const tekst = data.reacties?.map(r => `${r.wens}: ${r.reactie}`).join('. ') + '. ' + (data.slotwoord || '');
      setIsSpeaking(true);
      speakWithFallback(tekst, () => setIsSpeaking(false));
    } catch { setErr('De spiegel reageert niet. Probeer opnieuw! ⏳'); }
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={bubbleStyle}>
        <p style={{ color: '#f5e642', fontSize: 14, margin: '0 0 12px',
          fontFamily: "'IM Fell English', serif" }}>
          📜 Dicteer je verlanglijstje aan Sint!
        </p>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Jouw naam..." style={inputStyle} />
        <textarea value={wishes} onChange={e => setWishes(e.target.value)}
          placeholder="Mijn wensen: een fiets, lego, een boek..."
          rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        {err && <p style={{ color: '#ff9999', fontSize: 12, margin: '0 0 8px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onBack} style={{ ...btnRed, padding: '9px 16px', fontSize: 12 }}>← Terug</button>
          <button onClick={fetch_} disabled={loading} style={{ ...btnGold, flex: 1 }}>
            {loading ? '✨ Sint leest mee...' : '📬 Stuur naar Sint!'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            style={bubbleStyle}>
            <p style={{ color: 'rgba(212,160,23,0.55)', fontSize: 10, margin: '0 0 10px',
              letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              ✦ Sint heeft je lijst gelezen ✦
            </p>
            {result.reacties?.map((r, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <p style={{ color: '#d4a017', fontSize: 12, margin: '0 0 3px',
                  fontWeight: 700 }}>🎁 {r.wens}</p>
                <p style={{ color: 'rgba(245,230,66,0.75)', fontSize: 13,
                  fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>"{r.reactie}"</p>
              </div>
            ))}
            {result.slotwoord && (
              <p style={{ color: '#f5e642', fontSize: 13, margin: '12px 0 0',
                fontFamily: "'IM Fell English', serif", borderTop: '1px solid rgba(212,160,23,0.15)',
                paddingTop: 10, lineHeight: 1.6 }}>
                🎅 {result.slotwoord}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Schoentje mode ────────────────────────────────────────────────────────
function SchoenMode({ apiKey, onBack }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fetch_ = async () => {
    if (!name || !items) { setErr('Vertel wat je in je schoen hebt gelegd! 👟'); return; }
    setLoading(true); setErr(''); setResult(null);
    try {
      const resp = await fetchWithRetry(() =>
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 1000,
            messages: [{ role: 'user', content: buildSchoenPrompt(name, items) }],
          }),
        }).then(r => r.json())
      );
      if (resp.error) throw new Error(resp.error.message);
      const raw = resp.content?.[0]?.text || '{}';
      const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setResult(data);
      setIsSpeaking(true);
      speakWithFallback((data.bericht || '') + ' ' + (data.gekregen || ''), () => setIsSpeaking(false));
    } catch { setErr('De spiegel reageert niet. Probeer opnieuw! ⏳'); }
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={bubbleStyle}>
        <p style={{ color: '#f5e642', fontSize: 14, margin: '0 0 12px',
          fontFamily: "'IM Fell English', serif" }}>
          👟 Zet je schoen! Wat leg jij erin?
        </p>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Jouw naam..." style={inputStyle} />
        <input value={items} onChange={e => setItems(e.target.value)}
          placeholder="Een wortel, een tekening, water..." style={inputStyle} />
        {err && <p style={{ color: '#ff9999', fontSize: 12, margin: '0 0 8px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onBack} style={{ ...btnRed, padding: '9px 16px', fontSize: 12 }}>← Terug</button>
          <button onClick={fetch_} disabled={loading} style={{ ...btnGold, flex: 1 }}>
            {loading ? '🎅 Sint kijkt...' : '🥕 Zet mijn schoen!'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            style={bubbleStyle}>
            <p style={{ color: '#f5e642', fontSize: 14, margin: '0 0 10px',
              fontFamily: "'IM Fell English', serif", lineHeight: 1.7 }}>
              🎅 {result.bericht}
            </p>
            {result.gekregen && (
              <div style={{ background: 'rgba(212,160,23,0.07)',
                border: '1px solid rgba(212,160,23,0.2)',
                borderRadius: 10, padding: '9px 12px', marginTop: 8 }}>
                <p style={{ color: '#d4a017', fontSize: 11,
                  margin: '0 0 4px', letterSpacing: '0.1em' }}>🎁 MORGEN IN JE SCHOEN:</p>
                <p style={{ color: 'rgba(245,230,66,0.7)', fontSize: 12,
                  fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
                  {result.gekregen}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Home menu ─────────────────────────────────────────────────────────────
function HomeMenu({ onSelect, name }) {
  const menuItems = [
    { id: MODE.RIJM,   icon: '🖊️', label: 'Mijn Rijmpje',      sub: 'Sint schrijft speciaal voor jou' },
    { id: MODE.VERLANG, icon: '📜', label: 'Verlanglijstje',    sub: 'Vertel jouw wensen aan Sint' },
    { id: MODE.SCHOEN,  icon: '👟', label: 'Schoen Zetten',     sub: 'Wat leg jij erin voor Piet?' },
    { id: MODE.QUIZ,    icon: '❓', label: 'Sinterklaas Quiz',   sub: '5 vragen — hoe goed ken jij Sint?' },
    { id: MODE.TELLER,  icon: '⏳', label: 'Aftellen',          sub: 'Nog even en dan Pakjesavond!' },
  ];

  return (
    <div style={{ width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {menuItems.map((item, i) => (
        <motion.button key={item.id}
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          onClick={() => onSelect(item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 14,
            background: 'linear-gradient(135deg,rgba(80,0,12,0.28),rgba(40,0,6,0.22))',
            border: '1px solid rgba(212,160,23,0.25)',
            cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
          }}>
          <span style={{ fontSize: 24, minWidth: 32, textAlign: 'center' }}>{item.icon}</span>
          <div>
            <p style={{ color: '#f5e642', fontSize: 14, margin: 0,
              fontFamily: "'IM Fell English', serif", fontWeight: 700 }}>
              {item.label}
            </p>
            <p style={{ color: 'rgba(212,160,23,0.5)', fontSize: 11,
              margin: 0, fontStyle: 'italic' }}>
              {item.sub}
            </p>
          </div>
          <span style={{ marginLeft: 'auto', color: 'rgba(212,160,23,0.4)', fontSize: 16 }}>›</span>
        </motion.button>
      ))}
    </div>
  );
}

// ── Hoofd component ───────────────────────────────────────────────────────
export default function SinterklasSpiegel() {
  const [mode, setMode] = useState(MODE.HOME);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    if (ENV_KEY) return ENV_KEY;
    try { return localStorage.getItem('sint_mirror_key') || ''; } catch { return ''; }
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { }
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // Welkomstgroet bij laden
  useEffect(() => {
    const t = setTimeout(() => {
      setIsSpeaking(true);
      speakWithFallback(
        'Ho ho ho! Welkom bij de Sinterklaas Spiegel! Wat mag ik voor jou doen?',
        () => setIsSpeaking(false)
      );
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const saveKey = (k) => {
    setApiKey(k);
    try { localStorage.setItem('sint_mirror_key', k); } catch { }
    setShowKeyModal(false);
  };

  const apiKeyInjected = { ...{ apiKey } };

  return (
    <div style={S.app}>
      <style>{CSS}</style>

      {/* Nachtlucht achtergrond */}
      <div style={S.bg} />
      <div style={S.bgNight} />

      {/* Sterren */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {STARS.map(s => (
          <div key={s.id} style={{
            position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: '50%',
            background: '#fff8f0',
            animation: `starTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            boxShadow: '0 0 4px rgba(255,248,240,0.6)',
          }} />
        ))}
      </div>

      {/* Titel */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <MijterIcon size={32} />
          <h1 style={S.title}>Sinterklaas Spiegel</h1>
          <MijterIcon size={32} />
        </div>
        <p style={S.subtitle}>Ho ho ho — wat mag Sint voor jou doen?</p>
      </header>

      {/* Spiegel */}
      <div style={S.mirrorWrap}>
        <SintFrame W={270} H={330} />
        <div style={S.mirrorGlass}>
          <video ref={videoRef} autoPlay playsInline muted style={S.video} />

          {/* Pepernoten deeltjes na actie */}
          {mode !== MODE.HOME && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              overflow: 'hidden', borderRadius: '50% 50% 47% 47%', zIndex: 3 }}>
              {PEPERS.map(p => (
                <div key={p.id} style={{
                  position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
                  fontSize: 12, animation: `peper ${p.dur}s ease-in-out ${p.delay}s infinite`,
                  userSelect: 'none',
                }}>🫘</div>
              ))}
            </div>
          )}

          {/* Spreekring */}
          {isSpeaking && (
            <div style={{ position: 'absolute', inset: -4, borderRadius: '50% 50% 47% 47%',
              border: '3px solid #c0001a', animation: 'speakRing 1s ease-in-out infinite',
              pointerEvents: 'none', zIndex: 4 }} />
          )}
        </div>

        {/* Sint badge */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={S.sintBadge}>
          ✦ Welkom bij Sint ✦
        </motion.div>
      </div>

      {/* Content gebied */}
      <div style={{ width: '100%', maxWidth: 430, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>

        <AnimatePresence mode="wait">
          {mode === MODE.HOME && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%' }}>
              <HomeMenu onSelect={setMode} />
            </motion.div>
          )}

          {mode === MODE.RIJM && (
            <motion.div key="rijm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%' }}>
              <RijmMode apiKey={apiKey} onBack={() => setMode(MODE.HOME)} />
            </motion.div>
          )}

          {mode === MODE.VERLANG && (
            <motion.div key="verlang" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%' }}>
              <VerlangMode apiKey={apiKey} onBack={() => setMode(MODE.HOME)} />
            </motion.div>
          )}

          {mode === MODE.SCHOEN && (
            <motion.div key="schoen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%' }}>
              <SchoenMode apiKey={apiKey} onBack={() => setMode(MODE.HOME)} />
            </motion.div>
          )}

          {mode === MODE.QUIZ && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%' }}>
              <QuizMode onBack={() => setMode(MODE.HOME)} />
            </motion.div>
          )}

          {mode === MODE.TELLER && (
            <motion.div key="teller" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%', padding: '0 12px' }}>
              <div style={bubbleStyle}>
                <CountdownDisplay />
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button onClick={() => setMode(MODE.HOME)} style={{ ...btnRed, fontSize: 12 }}>
                    ← Terug naar Sint
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* API sleutel knop */}
      {!ENV_KEY && (
        <button onClick={() => setShowKeyModal(true)} style={S.btnKey}>
          <Key size={10} style={{ marginRight: 4 }} />
          {apiKey ? 'API sleutel ✓' : 'API sleutel instellen'}
        </button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={S.modal}
            onClick={e => e.target === e.currentTarget && setShowKeyModal(false)}>
            <div style={S.modalBox}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <MijterIcon size={40} />
              </div>
              <h2 style={S.modalTitle}>🔑 API Sleutel</h2>
              <p style={S.modalHint}>Voer je Anthropic API sleutel in.<br />Wordt alleen op dit apparaat opgeslagen.</p>
              <input type="password" id="keyInp" defaultValue={apiKey}
                placeholder="sk-ant-..." style={S.modalInput} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => setShowKeyModal(false)} style={S.modalCancel}>Annuleer</button>
                <button onClick={() => saveKey(document.getElementById('keyInp').value)}
                  style={S.modalSave}>Opslaan</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap');
  * { box-sizing: border-box; }
  input::placeholder, textarea::placeholder { color: rgba(245,230,66,0.26); }
  textarea { font-family: 'IM Fell English', serif; color: #f5e642; }

  @keyframes starTwinkle {
    0%,100% { opacity: 0.15; transform: scale(1); }
    50%     { opacity: 0.9; transform: scale(1.4); }
  }
  @keyframes speakRing {
    0%,100% { opacity: 0.3; transform: scale(1); }
    50%     { opacity: 1; transform: scale(1.05); }
  }
  @keyframes mirrorPulse {
    0%,100% { box-shadow: 0 0 28px rgba(160,0,20,0.18), 0 0 55px rgba(212,160,23,0.07), inset 0 0 26px rgba(0,0,0,0.6); }
    50%     { box-shadow: 0 0 48px rgba(160,0,20,0.38), 0 0 90px rgba(212,160,23,0.15), inset 0 0 26px rgba(0,0,0,0.6); }
  }
  @keyframes titleShimmer {
    0%,100% { text-shadow: 0 0 10px rgba(192,0,26,0.5), 0 2px 4px rgba(0,0,0,0.8); }
    50%     { text-shadow: 0 0 22px rgba(245,230,66,0.7), 0 0 40px rgba(192,0,26,0.4), 0 2px 4px rgba(0,0,0,0.8); }
  }
  @keyframes peper {
    0%,100% { opacity: 0; transform: translateY(0) rotate(0deg); }
    25% { opacity: 0.7; }
    50% { opacity: 0.3; transform: translateY(-8px) rotate(180deg); }
    75% { opacity: 0.6; }
  }
  @keyframes confettiFall {
    0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }
`;

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: '100vh', background: '#030008',
    color: '#f0e8d0', fontFamily: "'IM Fell English', serif",
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '0 0 48px', position: 'relative', overflow: 'hidden',
  },
  bg: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(80,0,12,0.6) 0%, rgba(5,0,14,0.97) 55%, #030008 100%)',
  },
  bgNight: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
    background: `
      radial-gradient(ellipse at 15% 95%, rgba(20,10,0,0.4) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 95%, rgba(20,10,0,0.4) 0%, transparent 45%)
    `,
  },
  header: {
    width: '100%', maxWidth: 480, padding: '20px 16px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    position: 'relative', zIndex: 5,
  },
  title: {
    margin: 0, fontSize: 20, fontWeight: 700,
    color: '#f5e642',
    animation: 'titleShimmer 3.5s ease-in-out infinite',
    letterSpacing: '0.04em',
  },
  subtitle: {
    margin: '2px 0 0', fontSize: 11,
    color: 'rgba(212,160,23,0.4)',
    letterSpacing: '0.12em', fontStyle: 'italic',
  },
  mirrorWrap: {
    position: 'relative', width: 270, height: 330,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 5, marginBottom: 8,
  },
  mirrorGlass: {
    position: 'absolute', top: 18, left: 22,
    width: 226, height: 290,
    borderRadius: '50% 50% 47% 47%',
    overflow: 'hidden',
    background: 'linear-gradient(160deg,#0f0008 0%,#030006 100%)',
    animation: 'mirrorPulse 4.5s ease-in-out infinite',
    zIndex: 1,
  },
  video: {
    width: '100%', height: '100%', objectFit: 'cover',
    transform: 'scaleX(-1)',
    filter: 'brightness(0.78) contrast(1.08) saturate(0.72)',
  },
  sintBadge: {
    position: 'absolute', bottom: -10, left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg,rgba(60,0,10,0.96),rgba(30,0,5,0.96))',
    border: '1px solid rgba(212,160,23,0.42)',
    borderRadius: 20, padding: '4px 18px',
    fontSize: 12, color: '#f5e642',
    whiteSpace: 'nowrap', zIndex: 10,
    letterSpacing: '0.08em',
    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
  },
  btnKey: {
    marginTop: 18, padding: '5px 14px',
    background: 'transparent',
    border: '1px solid rgba(212,160,23,0.12)',
    borderRadius: 20, fontSize: 10,
    color: 'rgba(212,160,23,0.32)',
    letterSpacing: '0.1em', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    position: 'relative', zIndex: 5,
    fontFamily: "'IM Fell English', serif",
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modalBox: {
    background: 'linear-gradient(160deg,#1a0005,#0a0003)',
    border: '2px solid rgba(212,160,23,0.42)',
    borderRadius: 20, padding: 24, maxWidth: 300, width: '90%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
  },
  modalTitle: {
    margin: '0 0 4px', fontWeight: 400, fontSize: 18,
    color: '#f5e642', textAlign: 'center',
    fontFamily: "'IM Fell English', serif",
  },
  modalHint: {
    margin: '0 0 14px', fontSize: 11, lineHeight: 1.6,
    color: 'rgba(245,230,66,0.38)', textAlign: 'center',
  },
  modalInput: {
    width: '100%', background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(212,160,23,0.24)',
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: '#f0e8d0', outline: 'none', textAlign: 'center',
    fontFamily: "'IM Fell English', serif",
  },
  modalCancel: {
    flex: 1, padding: '9px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
    color: 'rgba(255,255,255,0.28)', cursor: 'pointer', fontSize: 12,
    fontFamily: "'IM Fell English', serif",
  },
  modalSave: {
    flex: 1, padding: '9px',
    background: 'linear-gradient(135deg,#c0001a,#e8002a)',
    border: 'none', borderRadius: 10,
    color: '#fff8f0', fontWeight: 700, cursor: 'pointer',
    fontSize: 12, fontFamily: "'IM Fell English', serif",
    letterSpacing: '0.05em',
  },
};
