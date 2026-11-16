// @ts-nocheck
/**
 * Taalkeuze NL / DE voor Sinterklaas Spiegel
 * © Jan den Hollander — jandenhollander@duck.com
 * Laat App.tsx ongemoeid: vertaalt tekst, plaatshouders, stem en Gemini-antwoorden.
 */
const KEY = 'sint_spiegel_taal';

const lang = (() => {
  try { const s = localStorage.getItem(KEY); if (s === 'de' || s === 'nl') return s; } catch {}
  return (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'nl';
})();

const DE: Record<string, string> = {
  // kop en menu
  'Sinterklaas Spiegel': 'Nikolaus-Spiegel',
  '🌙 Vol verwachting klopt ons hart 🌙': '🌙 Lasst uns froh und munter sein 🌙',
  '✦ Welkom bij Sint ✦': '✦ Willkommen beim Nikolaus ✦',
  'Mijn Rijmpje': 'Mein Gedicht',
  'Sint schrijft speciaal voor jou': 'Der Nikolaus schreibt extra für dich',
  'Verlanglijstje': 'Wunschzettel',
  'Vertel jouw wensen aan Sint': 'Erzähl dem Nikolaus deine Wünsche',
  'Schoen Zetten': 'Stiefel hinstellen',
  'Wat leg jij erin voor Piet?': 'Was legst du hinein für Knecht Ruprecht?',
  'Pietenradar': 'Piet-Radar',
  'Eerst door papa of mama in te stellen': 'Erst von Mama oder Papa einrichten (niederländische Seite)',
  'Sinterklaas Quiz': 'Nikolaus-Quiz',
  '5 vragen — hoe goed ken jij Sint?': '5 Fragen – wie gut kennst du den Nikolaus?',
  'Aftellen': 'Countdown',
  'Vol verwachting klopt ons hart!': 'Lasst uns froh und munter sein!',
  'Stuur een briefkaart': 'Eine Karte schicken',
  'Samen met papa of mama: maak, app of print': 'Zusammen mit Mama oder Papa: basteln, App oder Druck',
  // rijmpje
  'Sint schrijft een persoonlijk rijmpje!': 'Der Nikolaus schreibt ein persönliches Gedicht!',
  'Naam van het kind...': 'Name des Kindes...',
  'Leeftijd (bijv. 7)...': 'Alter (z. B. 7)...',
  'Grootste wens (bijv. een fiets)...': 'Größter Wunsch (z. B. ein Fahrrad)...',
  'Vul naam, leeftijd én wens in ✨': 'Trag Name, Alter und Wunsch ein ✨',
  'Stel eerst een API sleutel in! 🔑': 'Stell zuerst einen API-Schlüssel ein! 🔑',
  '← Terug': '← Zurück',
  '✨ Sint schrijft...': '✨ Der Nikolaus schreibt...',
  '🖊️ Schrijf mijn rijmpje!': '🖊️ Schreib mein Gedicht!',
  '✦ Sint spreekt vanuit zijn magisch geheugen ✦': '✦ Der Nikolaus spricht aus seinem magischen Gedächtnis ✦',
  'Sint spreekt...': 'Der Nikolaus spricht...',
  'Opnieuw voorlezen': 'Nochmal vorlesen',
  // verlanglijstje
  '📜 Dicteer je verlanglijstje aan Sint!': '📜 Diktiere dem Nikolaus deinen Wunschzettel!',
  'Jouw naam...': 'Dein Name...',
  'Mijn wensen: een fiets, lego, een boek...': 'Meine Wünsche: ein Fahrrad, Lego, ein Buch...',
  'Vertel je naam en wensen! ✨': 'Sag deinen Namen und deine Wünsche! ✨',
  '📜 Sint leest mee...': '📜 Der Nikolaus liest mit...',
  '📬 Stuur naar Sint!': '📬 An den Nikolaus schicken!',
  '✦ Sint heeft je lijst gelezen ✦': '✦ Der Nikolaus hat deine Liste gelesen ✦',
  // schoen
  '👟 Zet je schoen! Wat leg jij erin?': '👟 Stell deinen Stiefel hin! Was legst du hinein?',
  'Een wortel, een tekening, water...': 'Ein Apfel, ein Bild, ein Keks...',
  'Vertel wat je in je schoen hebt gelegd! 👟': 'Sag, was du in deinen Stiefel gelegt hast! 👟',
  '🎅 Sint kijkt...': '🎅 Der Nikolaus schaut...',
  '🥕 Zet mijn schoen!': '🥕 Stiefel hinstellen!',
  '🎁 MISSCHIEN MORGEN IN JE SCHOEN:': '🎁 VIELLEICHT MORGEN IN DEINEM STIEFEL:',
  // quiz
  'VRAAG': 'FRAGE', ' punt': ' Punkt', 'en': 'e',
  ' van de ': ' von ', ' goed!': ' richtig!',
  '← Terug naar Sint': '← Zurück zum Nikolaus',
  '← Stoppen': '← Beenden',
  '⭐ Uitstekend! Sint is zeer trots op jou!': '⭐ Hervorragend! Der Nikolaus ist sehr stolz auf dich!',
  '🎁 Heel goed! Je weet veel van Sint!': '🎁 Sehr gut! Du weißt viel über den Nikolaus!',
  '🍊 Aardig! Je leert het snel!': '🍊 Ganz ordentlich! Du lernst schnell!',
  '📖 Oefenen maar! Sint heeft nog veel te vertellen!': '📖 Weiter üben! Der Nikolaus hat noch viel zu erzählen!',
  'Hoe heet het paard van Sinterklaas?': 'Wie heißt das Pferd vom Nikolaus?',
  'Blixem': 'Blitz',
  'Uit welk land komt Sinterklaas op de boot?': 'Aus welchem Land kommt der Nikolaus mit dem Schiff?',
  'Spanje': 'Spanien', 'Italië': 'Italien', 'Griekenland': 'Griechenland',
  'Op welke datum is Pakjesavond?': 'An welchem Datum ist Bescherungsabend?',
  '5 december': '5. Dezember', '6 december': '6. Dezember', '25 december': '25. Dezember', '1 december': '1. Dezember',
  'Wat leg je in je schoen voor Sint?': 'Was legst du für den Nikolaus in deinen Stiefel?',
  'Een wortel voor het paard': 'Eine Karotte für das Pferd', 'Een appel': 'Einen Apfel', 'Een snoepje': 'Ein Bonbon', 'Een koekje': 'Einen Keks',
  'Hoe heet het boek van Sinterklaas?': 'Wie heißt das Buch vom Nikolaus?',
  'Het grote boek': 'Das große Buch', 'Het gouden boek': 'Das goldene Buch', 'Het rode boek': 'Das rote Buch', 'Het dikke boek': 'Das dicke Buch',
  // aftellen
  '🌙 Aftellen tot Pakjesavond — 5 december 🌙': '🌙 Countdown bis Nikolausabend — 5. Dezember 🌙',
  'dagen': 'Tage', 'uur': 'Std', 'min': 'Min', 'sec': 'Sek',
  'Het is Pakjesavond!': 'Heute ist Nikolausabend!',
  'Vol verwachting klopt ons hart! 🌙': 'Lasst uns froh und munter sein! 🌙',
  // voet en sleutel
  '📷 Camera uitzetten': '📷 Kamera ausschalten',
  '📷 Camera aanzetten': '📷 Kamera einschalten',
  'Gemini sleutel ✓': 'Gemini-Schlüssel ✓',
  'API sleutel instellen': 'API-Schlüssel einstellen',
  '🔑 Gemini API Sleutel': '🔑 Gemini API-Schlüssel',
  'Dezelfde sleutel als de andere spiegels.': 'Derselbe Schlüssel wie bei den anderen Spiegeln.',
  'Wordt alleen op dit apparaat opgeslagen.': 'Wird nur auf diesem Gerät gespeichert.',
  'Nog geen sleutel?': 'Noch keinen Schlüssel?',
  'Haal hem hier op bij Google AI Studio →': 'Hier bei Google AI Studio holen →',
  'Annuleer': 'Abbrechen', 'Opslaan': 'Speichern',
  'Vrij gebruik · niet-commercieel · ongewijzigd': 'Freie Nutzung · nicht-kommerziell · unverändert',
  'ℹ️ Licentie': 'ℹ️ Lizenz', 'Sluiten': 'Schließen',
};

const WELCOME = {
  'Vol verwachting klopt ons hart! Welkom bij de Sinterklaas Spiegel!':
    'Lasst uns froh und munter sein! Willkommen beim Nikolaus-Spiegel!',
};

const PREFIX =
  'WICHTIG: Schreibe die gesamte Antwort auf Deutsch. Du bist der Nikolaus (nicht Sinterklaas); sein Helfer heißt Knecht Ruprecht (nicht Piet). ' +
  'Übersetze alle niederländischen Formulierungen der folgenden Anweisungen sinngemäß ins Deutsche, auch die Schlusszeile ("Einen schönen Nikolaustag, liebe/r NAME!"). ' +
  'Reime müssen auf Deutsch reimen; der Wunsch steht auf Deutsch am Ende einer Zeile. ' +
  'Die JSON-Schlüssel (rijm, intro, reacties, wens, reactie, slotwoord, bericht, gekregen) bleiben exakt unverändert.\n\n';

function switchTo(l) {
  try { localStorage.setItem(KEY, l); } catch {}
  location.reload();
}

function buttons() {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:6px;right:6px;z-index:100000;display:flex;gap:4px;font-family:sans-serif;';
  [['nl', '🇳🇱 NL'], ['de', '🇩🇪 DE']].forEach(([l, label]) => {
    const b = document.createElement('button');
    b.textContent = label;
    const on = l === lang;
    b.style.cssText = 'padding:4px 9px;border-radius:14px;font-size:11px;cursor:pointer;border:1px solid rgba(212,160,23,0.6);' +
      (on ? 'background:#d4a017;color:#160900;font-weight:700;' : 'background:rgba(2,0,6,0.8);color:#f5e642;');
    b.onclick = () => { if (!on) switchTo(l); };
    box.appendChild(b);
  });
  document.body.appendChild(box);
}

function translateTree() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const v = n.nodeValue;
    const t = v.trim();
    const k = DE[v] !== undefined ? v : t;
    if (DE[k] !== undefined && (k === v || t)) {
      const out = k === v ? DE[k] : v.replace(t, DE[t]);
      if (out !== v) n.nodeValue = out;
    }
  }
  document.querySelectorAll('[placeholder]').forEach((el) => {
    const p = el.getAttribute('placeholder');
    if (DE[p]) el.setAttribute('placeholder', DE[p]);
  });
}

function start() {
  document.documentElement.lang = lang;
  buttons();
  if (lang !== 'de') return;
  document.title = 'Nikolaus-Spiegel 🎁';
  let queued = false;
  const run = () => { queued = false; translateTree(); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  translateTree();

  // Stem: Duitse stem en Duitse tekst voor de begroeting
  const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak = (utt) => {
    if (WELCOME[utt.text]) utt.text = WELCOME[utt.text];
    utt.lang = 'de-DE';
    utt.voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('de')) || null;
    origSpeak(utt);
  };

  // Gemini: Duitse instructie vooraan elke prompt
  const origFetch = window.fetch.bind(window);
  window.fetch = (url, init) => {
    try {
      if (String(url).includes('generativelanguage.googleapis.com') && init && typeof init.body === 'string') {
        const b = JSON.parse(init.body);
        const p = b.contents[0].parts[0];
        if (!p.text.startsWith('WICHTIG')) p.text = PREFIX + p.text;
        init = { ...init, body: JSON.stringify(b) };
      }
    } catch {}
    return origFetch(url, init);
  };
}

if (document.body) start(); else window.addEventListener('DOMContentLoaded', start);
