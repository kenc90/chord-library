// Common Progression Library - time-tested chord progressions shown in any key.
// NOTES and CHORDS are provided by app.js, which is loaded before this file.

// Chord shapes are sourced from the shared chord-library data (CHORDS in app.js)
// so every diagram here matches the library exactly.
const CHORD_SHAPES = Object.fromEntries(
    Object.values(CHORDS).flat().map(chord => [chord.name, chord])
);

// The two supported tonalities. Each progression lists scale degrees 1-7; the
// chord for a degree is spelled from the mode's intervals and its triad quality
// from the mode's diatonic chord table (maj / min / dim).
const PROG_MODES = {
    major: { intervals: [0, 2, 4, 5, 7, 9, 11], triads: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'] },
    minor: { intervals: [0, 2, 3, 5, 7, 8, 10], triads: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'] },
};

const NUMERAL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// How each chord quality is spelled in a chord name and shown as a Roman numeral.
const QUALITY = {
    maj:  { suffix: '',     roman: d => NUMERAL[d - 1] },
    min:  { suffix: 'm',    roman: d => NUMERAL[d - 1].toLowerCase() },
    dim:  { suffix: 'dim',  roman: d => NUMERAL[d - 1].toLowerCase() + '°' },
    dom7: { suffix: '7',    roman: d => NUMERAL[d - 1] + '7' },
    maj7: { suffix: 'maj7', roman: d => NUMERAL[d - 1] + 'maj7' },
    min7: { suffix: 'm7',   roman: d => NUMERAL[d - 1].toLowerCase() + '7' },
};

// Each progression lists its degrees as { d: scale degree 1-7, qual? }. With no
// explicit qual the triad quality is derived from the current mode, so the same
// progression re-colours correctly in major and minor. Steps that carry an
// explicit qual are 7th chords used by the jazz progressions, which are marked
// majorOnly because their minor forms need chords outside the library.
const PROGRESSIONS = [
    {
        id: 'pop-anthem',
        tag: { en: 'Pop / Rock', 'zh-Hant': '流行 / 搖滾', 'zh-Hans': '流行 / 摇滚' },
        steps: [{ d: 1 }, { d: 5 }, { d: 6 }, { d: 4 }],
        title: { en: 'The Pop Anthem', 'zh-Hant': '流行聖歌進行', 'zh-Hans': '流行圣歌进行' },
        desc: {
            en: 'The most ubiquitous four-chord loop in modern music. Bright, soaring and endlessly sing-along — it never resolves, so it can loop forever.',
            'zh-Hant': '現代音樂最常見的四和弦循環。明亮、高亢且極易跟唱；因為不會解決，可以無限循環。',
            'zh-Hans': '现代音乐中最常见的四和弦循环。明亮、高亢且极易跟唱；因为不会解决，可以无限循环。',
        },
        examples: ['Let It Be — The Beatles', 'No Woman No Cry — Bob Marley', 'With or Without You — U2'],
    },
    {
        id: 'emotional-pop',
        tag: { en: 'Pop / Ballad', 'zh-Hant': '流行 / 抒情曲', 'zh-Hans': '流行 / 抒情曲' },
        steps: [{ d: 6 }, { d: 4 }, { d: 1 }, { d: 5 }],
        title: { en: 'Emotional Pop (Minor-Start)', 'zh-Hant': '感性流行（小調起手）', 'zh-Hans': '感性流行（小调起手）' },
        desc: {
            en: 'The same chords as the Pop Anthem but starting on the minor vi, giving a wistful, bittersweet lift into the major I. A ballad staple.',
            'zh-Hant': '與流行聖歌相同的和弦，但從小調 vi 開始，带出一種惆悵而苦甜的向上張力，最終落在大調 I。抒情曲常用。',
            'zh-Hans': '与流行圣歌相同的和弦，但从小调 vi 开始，带来一种惆怅而苦甜的向上张力，最终落在大调 I。抒情曲常用。',
        },
        examples: ['The Unforgiven — Metallica', 'Hemorrhage (In His Arms) — Bon Jovi', 'Everybody Hurts — R.E.M.'],
    },
    {
        id: 'doowop-50s',
        tag: { en: "50s / Doo-Wop", 'zh-Hant': '50 年代 / 嘟賦譜', 'zh-Hans': '50 年代 / 嘟喔谱' },
        steps: [{ d: 1 }, { d: 6 }, { d: 4 }, { d: 5 }],
        title: { en: "50s Doo-Wop", 'zh-Hant': '50 年代嘟賦譜', 'zh-Hans': '50 年代嘟喔谱' },
        desc: {
            en: 'The nostalgic "I–vi–IV–V" changes behind a generation of love songs. Warm, romantic and instantly familiar.',
            'zh-Hant': '一代情歌背後的經典「I–vi–IV–V」和弦。溫暖、浪漫且令人倍感熟悉。',
            'zh-Hans': '一代情歌背后的经典「I–vi–IV–V」和弦。温暖、浪漫且令人倍感熟悉。',
        },
        examples: ['Stand by Me — Ben E. King', 'Unchained Melody — Righteous Brothers', 'Earth Angel — Penguins'],
    },
    {
        id: 'twelve-bar',
        tag: { en: 'Blues / Rock & Roll', 'zh-Hant': '藍調 / 搖滾', 'zh-Hans': '蓝调 / 摇滚' },
        steps: [{ d: 1 }, { d: 4 }, { d: 5 }],
        title: { en: 'I–IV–V (12-Bar Blues)', 'zh-Hant': 'I–IV–V（十二小節藍調）', 'zh-Hans': 'I–IV–V（十二小节蓝调）' },
        desc: {
            en: 'The three-chord backbone of blues, early rock & roll and countless jam songs. Usually stretched across the 12-bar form: I I I I / IV IV I I / V IV I V.',
            'zh-Hant': '藍調、早期搖滾與無數即興曲目的三和弦骨架。通常以十二小節形式展開：I I I I / IV IV I I / V IV I V。',
            'zh-Hans': '蓝调、早期摇滚与无数即兴曲目的三和弦骨架。通常以十二小节形式展开：I I I I / IV IV I I / V IV I V。',
        },
        examples: ['La Bamba — Ritchie Valens', 'Hound Dog — Elvis Presley', 'Johnny B. Goode — Chuck Berry'],
    },
    {
        id: 'jazz-251',
        tag: { en: 'Jazz', 'zh-Hant': '爵士', 'zh-Hans': '爵士' },
        majorOnly: true,
        steps: [{ d: 2, qual: 'min7' }, { d: 5, qual: 'dom7' }, { d: 1, qual: 'maj7' }],
        title: { en: 'ii–V–I (Jazz Cadence)', 'zh-Hant': 'ii–V–I（爵士終止式）', 'zh-Hans': 'ii–V–I（爵士终止式）' },
        desc: {
            en: 'The essential jazz turnaround. Roots fall in fourths and each seventh chord pulls smoothly into the next, resolving home to the I. The foundation of bebop and standards.',
            'zh-Hant': '爵士的核心循環。根音以四度下行，每個七和弦都平滑地牽引到下一個，最終解決回 I。是咆勃爵士與標準曲目的基石。',
            'zh-Hans': '爵士的核心循环。根音以四度下行，每个七和弦都平滑地牵引到下一个，最终解决回 I。是比波普与标准曲目的基石。',
        },
        examples: ['Autumn Leaves', 'Fly Me to the Moon', 'All the Things You Are'],
    },
    {
        id: 'jazz-turnaround',
        tag: { en: 'Jazz / Rhythm', 'zh-Hant': '爵士 / 節奏和聲', 'zh-Hans': '爵士 / 节奏和声' },
        majorOnly: true,
        steps: [{ d: 6, qual: 'min7' }, { d: 2, qual: 'min7' }, { d: 5, qual: 'dom7' }, { d: 1, qual: 'maj7' }],
        title: { en: 'vi–ii–V–I (Rhythm Changes)', 'zh-Hant': 'vi–ii–V–I（節奏和聲進行）', 'zh-Hans': 'vi–ii–V–I（节奏和声进行）' },
        desc: {
            en: 'A loop of falling fifths — the minor vi simply precedes the classic ii–V–I. The driving cadence of Gershwin\'s "I Got Rhythm" and countless swing tunes.',
            'zh-Hant': '一连串下行五度的循環——小調 vi 只是接在經典 ii–V–I 之前。盖希文《I Got Rhythm》與無數摇摆乐曲的推進式終止。',
            'zh-Hans': '一连串下行五度的循环——小调 vi 只是接在经典 ii–V–I 之前。格什温《I Got Rhythm》与无数摇摆乐曲的推进式终止。',
        },
        examples: ['I Got Rhythm — George Gershwin', 'Oleo — Sonny Rollins', 'Cotton Tail — Duke Ellington'],
    },
    {
        id: 'royal-road',
        tag: { en: 'J-Pop / City Pop', 'zh-Hant': 'J-Pop / 城市流行', 'zh-Hans': 'J-Pop / 城市流行' },
        steps: [{ d: 4 }, { d: 5 }, { d: 3 }, { d: 6 }],
        title: { en: 'Royal Road', 'zh-Hant': '王道進行（Royal Road）', 'zh-Hans': '王道进行（Royal Road）' },
        desc: {
            en: 'The beloved Japanese "kodō" progression. Starting on IV and landing on vi, it feels cinematic, yearning and sophisticated — a signature of anime themes and City Pop.',
            'zh-Hant': '日本人鍾愛的「王道」進行。從 IV 開始落在 vi，聽起來充满电影感、渴望而精緻——動畫主題曲與城市流行的招牌色彩。',
            'zh-Hans': '日本人钟爱的「王道」进行。从 IV 开始落在 vi，听起来充满电影感、渴望而精致——动画主题曲与城市流行的招牌色彩。',
        },
        examples: ['Plastic Love — Mariya Takeuchi', 'Koi — Miyazaki Ayaka', 'Lemon — Kenshi Yonezu'],
    },
    {
        id: 'canon',
        tag: { en: 'Classical / Baroque Pop', 'zh-Hant': '古典 / 巴洛克流行', 'zh-Hans': '古典 / 巴洛克流行' },
        steps: [{ d: 1 }, { d: 5 }, { d: 6 }, { d: 3 }, { d: 4 }, { d: 1 }, { d: 4 }, { d: 5 }],
        title: { en: 'Canon Progression', 'zh-Hant': '卡農進行', 'zh-Hans': '卡农进行' },
        desc: {
            en: 'The descending ground bass of Pachelbel\'s Canon in D, in eight beats. Stately and lyrical, it underpins countless pop ballads and wedding arrangements.',
            'zh-Hant': '帕赫貝爾《D 大調卡農》以八拍展開的下行固定低音。莊重而抒情，支撐著無數流行抒情曲與婚禮編曲。',
            'zh-Hans': '帕赫贝尔《D 大调卡农》以八拍展开的下行固定低音。庄重而抒情，支撑着无数流行抒情曲与婚礼编曲。',
        },
        examples: ['Canon in D — Pachelbel', 'Boulevard of Broken Dreams — Green Day', 'Basket Case — Green Day'],
    },
];

// State — persist the selected key and tonality so the page reopens as left.
const PROG_KEY_STORAGE = 'guitar-chords-library-prog-key';
const PROG_MODE_STORAGE = 'guitar-chords-library-prog-mode';

function loadProgKey() {
    try {
        const saved = parseInt(localStorage.getItem(PROG_KEY_STORAGE), 10);
        return Number.isInteger(saved) && saved >= 0 && saved < NOTES.length ? saved : 0;
    } catch {
        return 0;
    }
}

function loadProgMode() {
    try {
        return localStorage.getItem(PROG_MODE_STORAGE) === 'minor' ? 'minor' : 'major';
    } catch {
        return 'major';
    }
}

function saveProgSelection() {
    try {
        localStorage.setItem(PROG_KEY_STORAGE, String(currentProgKey));
        localStorage.setItem(PROG_MODE_STORAGE, currentProgMode);
    } catch {
        // Ignore write failures (e.g. storage disabled or full).
    }
}

let currentProgKey = loadProgKey();
let currentProgMode = loadProgMode();

// Resolve a {degree, qual?} step to a chord name and Roman numeral in the key.
function stepToChord(step) {
    const mode = PROG_MODES[currentProgMode];
    const root = (currentProgKey + mode.intervals[step.d - 1]) % 12;
    const qual = step.qual || mode.triads[step.d - 1];
    return { name: NOTES[root] + QUALITY[qual].suffix, roman: QUALITY[qual].roman(step.d) };
}

function localized(field) {
    const lang = getLanguage();
    return field[lang] || field.en;
}

// Render the key and tonality selectors once.
function renderSelectors() {
    const keyContainer = document.getElementById('prog-key-buttons');
    keyContainer.innerHTML = NOTES.map((note, i) =>
        `<button class="prog-key-btn${i === currentProgKey ? ' active' : ''}" type="button" data-key="${i}">${note}</button>`
    ).join('');
    keyContainer.querySelectorAll('.prog-key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentProgKey = parseInt(btn.dataset.key, 10);
            keyContainer.querySelectorAll('.prog-key-btn').forEach(b =>
                b.classList.toggle('active', parseInt(b.dataset.key, 10) === currentProgKey));
            renderProgressions();
            saveProgSelection();
        });
    });

    const modeContainer = document.getElementById('prog-mode-buttons');
    modeContainer.innerHTML = ['major', 'minor'].map(mode =>
        `<button class="prog-mode-btn${mode === currentProgMode ? ' active' : ''}" type="button" data-mode="${mode}">${t(mode)}</button>`
    ).join('');
    modeContainer.querySelectorAll('.prog-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentProgMode = btn.dataset.mode;
            modeContainer.querySelectorAll('.prog-mode-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.mode === currentProgMode));
            renderProgressions();
            saveProgSelection();
        });
    });
}

// Render all progression cards for the current key and tonality.
function renderProgressions() {
    const container = document.getElementById('progressions');
    if (!container) return;

    // Jazz 7th progressions are major-only; hide them in a minor tonality.
    const visible = PROGRESSIONS.filter(prog => !(prog.majorOnly && currentProgMode === 'minor'));

    container.innerHTML = visible.map(prog => {
        const chords = prog.steps.map(stepToChord);

        const chips = chords.map(chord => `
            <button class="prog-chip" type="button" data-chord="${chord.name}" title="${t('chordShape')}">
                <span class="prog-chip-roman">${chord.roman}</span>
                <span class="prog-chip-name">${chord.name}</span>
            </button>
        `).join('');

        const diagrams = chords.map(chord => {
            const shape = CHORD_SHAPES[chord.name];
            return `
                <div class="prog-diagram-card" data-chord="${chord.name}" title="${t('chordShape')}">
                    <div class="prog-diagram-name">${chord.name}</div>
                    ${shape
                        ? `<div class="prog-diagram">${renderChordDiagram(shape)}</div>`
                        : `<div class="prog-diagram-missing">${t('shapeUnavailable')}</div>`}
                    <div class="prog-diagram-roman">${chord.roman}</div>
                </div>
            `;
        }).join('');

        const songLinks = prog.examples.map(song => {
            const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`;
            return `<a href="${url}" target="_blank" rel="noopener" class="song-link">${song}</a>`;
        }).join(', ');

        return `
            <article class="prog-card">
                <header class="prog-card-head">
                    <div class="prog-card-title">
                        <h3>${localized(prog.title)}</h3>
                        <span class="prog-tag">${localized(prog.tag)}</span>
                    </div>
                </header>
                <p class="prog-card-desc">${localized(prog.desc)}</p>
                <div class="prog-chips">${chips}</div>
                <div class="prog-diagrams">${diagrams}</div>
                <p class="prog-examples"><strong>${t('progExamples')}:</strong> ${songLinks}</p>
            </article>
        `;
    }).join('');

    container.querySelectorAll('.prog-chip, .prog-diagram-card').forEach(el => {
        el.addEventListener('click', () => showProgChordModal(el.dataset.chord));
    });
}

// Show a single chord in the modal (large diagram + fret/finger info).
function showProgChordModal(chordName) {
    const modal = document.getElementById('chord-modal');
    const titleEl = document.getElementById('chord-modal-title');
    const bodyEl = document.getElementById('chord-modal-body');

    const chord = CHORD_SHAPES[chordName];
    if (!chord) return;

    titleEl.textContent = chordName;
    bodyEl.innerHTML = `
        <div class="chord-shape-display">
            ${renderChordDiagram(chord)}
            <div class="chord-info">
                <div class="chord-frets">Frets: ${chord.frets.map(f => f === -1 ? 'x' : f).join(' ')}</div>
                <div class="chord-fingers">Fingers: ${chord.fingers.map(f => f || '-').join(' ')}</div>
            </div>
        </div>
    `;
    modal.classList.add('active');
}

function closeProgChordModal() {
    document.getElementById('chord-modal').classList.remove('active');
}

// Event listeners
document.getElementById('chord-modal').addEventListener('click', e => {
    if (e.target.id === 'chord-modal') closeProgChordModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProgChordModal();
});

// Scroll-to-top button appears once the page is scrolled down.
const progScrollTopBtn = document.getElementById('scroll-to-top');
if (progScrollTopBtn) {
    window.addEventListener('scroll', () => {
        progScrollTopBtn.classList.toggle('visible', window.scrollY > 300);
    });
}

document.addEventListener('languagechange', () => {
    renderSelectors();
    renderProgressions();
});

// Initial render
renderSelectors();
renderProgressions();
