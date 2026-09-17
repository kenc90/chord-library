const SONG_STORAGE_KEY = 'guitar-chords-library-song-draft';

let song = { title: '', keys: [], bpm: '', lyricsHtml: '', referenceShapes: {} };
let savedSelection = null;
let pendingChordRange = null;
let editingAnnotation = null;
let pendingKeys = [];
// A chord label currently being dragged along its lyric line, and the click that follows the
// drop (which must not open the editor).
let chordDrag = null;
let suppressLabelClick = false;

const SONG_KEYS = ['C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'Eb', 'Ebm', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'Ab', 'Abm', 'A', 'Am', 'Bb', 'Bbm', 'B', 'Bm'];

const CHORD_CHOICES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].flatMap(note => [note, `${note}m`, `${note}7`, `${note}maj7`, `${note}m7`, `${note}sus4`]);

// Semitones from the root for every suffix CHORD_CHOICES offers, so a chord can be tested
// against the song key without looking up a voicing.
const CHORD_CHOICE_INTERVALS = {
    '': [0, 4, 7],
    'm': [0, 3, 7],
    '7': [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    'm7': [0, 3, 7, 10],
    'sus4': [0, 5, 7]
};

function chordDiagram(chordName, shapeIndex = 0) {
    const shape = getChordShapes(chordName)[shapeIndex];
    if (!shape) return '';
    // Keep the renderer's per-string note labels; widen/heighten the canvas so the
    // reference diagram's own chord-note summary (chordNotesSvg) sits below them.
    const svg = renderChordDiagram(shape)
        .replace('class="chord-diagram"', 'class="chord-diagram reference-diagram"')
        .replace('viewBox="0 0 120 170"', 'viewBox="0 0 130 188"')
        .replace('<svg ', `<svg aria-label="${chordName} chord diagram" `);
    return svg.replace('</svg>', `${chordNotesSvg(shape)}</svg>`);
}

// Standard tuning open-string notes (low E to high E)
const CHORD_REFERENCE_OPEN_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];

// Pitch classes of those same strings, spelled out instead of looked up in
// NOTE_REFERENCE_NOTES because that table is declared further down the file.
const OPEN_STRING_PITCH_CLASSES = [4, 9, 2, 7, 11, 4];
const NOTE_LETTER_PITCH_CLASSES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function shapeBassPitchClass(shape) {
    // Voicing frets are absolute fret numbers, so the sounding bass is simply the lowest
    // string that is played at all (muted strings carry -1).
    const index = shape.frets.findIndex(fret => fret >= 0);
    if (index === -1) return null;
    return (OPEN_STRING_PITCH_CLASSES[index] + shape.frets[index]) % 12;
}

function getSongScaleNotes() {
    const scaleNotes = new Set();
    song.keys.forEach(key => {
        const isMinor = key.endsWith('m');
        const root = isMinor ? key.slice(0, -1) : key;
        const rootIndex = NOTE_REFERENCE_NOTES.indexOf(root);
        if (rootIndex === -1) return;
        const intervals = (isMinor ? NOTE_REFERENCE_SCALES.minor : NOTE_REFERENCE_SCALES.major).intervals;
        intervals.forEach(interval => scaleNotes.add(NOTE_REFERENCE_NOTES[(rootIndex + interval) % 12]));
    });
    return scaleNotes;
}

function chordNotesSvg(shape) {
    const notes = [];
    shape.frets.forEach((fret, i) => {
        if (fret < 0) return;
        const openIndex = CHORD_REFERENCE_OPEN_NOTES[i];
        const openNoteIndex = NOTE_REFERENCE_NOTES.indexOf(openIndex);
        notes.push(NOTE_REFERENCE_NOTES[(openNoteIndex + fret) % 12]);
    });
    const uniqueNotes = [...new Set(notes)];
    const scaleNotes = getSongScaleNotes();
    const charWidth = 9;
    const gap = 6;
    const totalWidth = uniqueNotes.reduce((sum, note) => sum + note.length * charWidth, 0) + gap * (uniqueNotes.length - 1);
    let cursor = 65 - totalWidth / 2;
    const text = uniqueNotes.map(note => {
        const inScale = scaleNotes.has(note);
        const width = note.length * charWidth;
        const x = cursor + width / 2;
        cursor += width + gap;
        const tooltip = inScale ? '' : `<title>${t('noteNotInKey')}</title>`;
        return `<g class="reference-diagram-note${inScale ? '' : ' out-of-scale'}"${inScale ? '' : ` data-tooltip="${t('noteNotInKey')}"`}><text x="${x}" y="180" text-anchor="middle" dominant-baseline="middle">${tooltip}${note}</text></g>`;
    }).join('');
    return text;
}

function getChordShapes(chordName) {
    const [parentName, bassName] = String(chordName).split('/');
    const shapes = collectChordShapes(parentName);
    const bassPc = bassName ? NOTE_REFERENCE_NOTES.indexOf(bassName) : -1;
    if (bassPc === -1) return shapes;
    const inversions = buildInversions(parentName, bassPc, shapes);
    // The library keeps no inversions, so they get derived from the parent shapes. When even
    // that is impossible (a suffix with no known formula), the plain chord is the least wrong
    // diagram to show - those notes still belong to the chord.
    return inversions.length ? inversions : shapes;
}

// Pitch classes of a chord plus the tones a voicing may not drop: the root, the note that
// names its quality (3rd, or the sus note, or the 5th of a power chord) and, from four notes
// up, the top note as well (7th / 6th / 9th).
function chordToneInfo(chordName) {
    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;
    const rootPc = NOTE_REFERENCE_NOTES.indexOf(match[1]);
    const intervals = CHORD_CHOICE_INTERVALS[match[2]];
    if (rootPc === -1 || !intervals) return null;
    const essentialIndexes = intervals.length >= 4 ? [0, 1, intervals.length - 1] : [0, 1];
    return {
        pcs: new Set(intervals.map(interval => (rootPc + interval) % 12)),
        essential: new Set(essentialIndexes.map(index => (rootPc + intervals[index]) % 12))
    };
}

function shapePitchClasses(frets) {
    return frets
        .map((fret, string) => (fret < 0 ? null : (OPEN_STRING_PITCH_CLASSES[string] + fret) % 12))
        .filter(pitchClass => pitchClass !== null);
}

// Every sounding note has to be one of the chord's own tones, or the new bass note itself -
// C/D is spelled over a D that is not a C chord tone - and no essential tone may be missing.
function spellsChord(frets, tones, bassPc) {
    const pcs = new Set(shapePitchClasses(frets));
    return [...pcs].every(pc => tones.pcs.has(pc) || pc === bassPc)
        && [...tones.essential].every(pc => pcs.has(pc));
}

function buildInversions(chordName, bassPc, parentShapes) {
    const tones = chordToneInfo(chordName);
    if (!tones) return [];
    const exact = parentShapes.filter(shape => shapeBassPitchClass(shape) === bassPc);
    const derived = parentShapes.flatMap(shape => deriveBassVoicings(shape.frets, bassPc, tones, chordName));
    const unique = new Map();
    [...exact, ...derived].forEach(shape => unique.set(shape.frets.join(','), shape));
    // Lowest position first, so the comfortable open inversion is the one shown by default.
    return [...unique.values()].sort((a, b) => Math.max(0, ...a.frets) - Math.max(0, ...b.frets));
}

// Three ways to move a shape's bass note: reach down onto a free lower string, refret the
// string that already carries it, or drop that string and let the next one take over the bass.
function deriveBassVoicings(frets, bassPc, tones, chordName) {
    const results = [];
    const lowest = frets.findIndex(fret => fret >= 0);
    if (lowest === -1) return results;
    const fretFor = string => ((bassPc - OPEN_STRING_PITCH_CLASSES[string]) % 12 + 12) % 12;
    // Playable by one hand: four fretted notes at most, all inside a single five-fret window.
    const reachable = values => {
        const positive = values.filter(value => value > 0);
        return new Set(positive).size <= 4
            && (!positive.length || Math.max(...positive) - Math.min(...positive) <= 4);
    };
    const accept = (string, fret) => {
        const voicing = [...frets];
        voicing[string] = fret;
        if (!reachable(voicing)) return;
        // Two notes are an interval, not a chord.
        if (voicing.filter(value => value >= 0).length < 3) return;
        if (spellsChord(voicing, tones, bassPc)) results.push({ name: chordName, frets: voicing, fingers: deriveFingers(voicing) });
    };
    for (let string = 0; string < lowest; string += 1) accept(string, fretFor(string));
    accept(lowest, fretFor(lowest));
    const trimmed = [...frets];
    let index = lowest;
    while (index !== -1) {
        trimmed[index] = -1;
        const next = trimmed.findIndex(value => value >= 0);
        if (next === -1 || !reachable(trimmed) || trimmed.filter(value => value >= 0).length < 3) break;
        if (!spellsChord(trimmed, tones, bassPc)) break;
        if ((OPEN_STRING_PITCH_CLASSES[next] + trimmed[next]) % 12 === bassPc) {
            const inversion = [...trimmed];
            results.push({ name: chordName, frets: inversion, fingers: deriveFingers(inversion) });
        }
        index = next;
    }
    return results;
}

// These inversions are all simple one-fret-per-finger shapes, so the lower the fret the lower
// the finger, and a fret two strings share is the same finger barring them.
function deriveFingers(voicing) {
    const distinct = [...new Set(voicing.filter(value => value > 0))].sort((a, b) => a - b);
    return voicing.map(value => (value > 0 ? distinct.indexOf(value) + 1 : 0));
}

function collectChordShapes(chordName) {
    const primaryShape = Object.values(CHORDS).flat().find(chord => chord.name === chordName);
    const alternateShapes = CHORD_VOICINGS[chordName] || [];
    return primaryShape ? [primaryShape, ...alternateShapes.filter(shape => shape.frets.join(',') !== primaryShape.frets.join(','))] : alternateShapes;
}

function saveSong() {
    localStorage.setItem(SONG_STORAGE_KEY, JSON.stringify(song));
}

function loadSong() {
    try {
        const savedSong = JSON.parse(localStorage.getItem(SONG_STORAGE_KEY));
        if (typeof savedSong?.lyricsHtml === 'string') {
            song = { title: String(savedSong.title || ''), keys: normalizeKeys(savedSong.keys ?? savedSong.key), bpm: String(savedSong.bpm || ''), lyricsHtml: savedSong.lyricsHtml, referenceShapes: savedSong.referenceShapes || {} };
        } else if (savedSong?.lines?.length) {
            song = {
                title: String(savedSong.title || ''), keys: [], bpm: '', referenceShapes: {},
                lyricsHtml: savedSong.lines.map(line => `<div>${escapeHtml(String(line.lyrics || ''))}</div>`).join('')
            };
        }
    } catch {
        localStorage.removeItem(SONG_STORAGE_KEY);
    }
}

function normalizeLyricsHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('div, p').forEach(line => {
        if (!line.textContent.trim() && !line.querySelector('.chord-annotation')) line.remove();
    });
    return template.innerHTML;
}

function renderReference() {
    const chordNames = [...new Set([...document.querySelectorAll('.chord-label')].map(label => label.dataset.chord))];
    const reference = document.getElementById('chord-reference');
    document.getElementById('reference-count').textContent = chordNames.length;
    reference.innerHTML = chordNames.length
        ? chordNames.map(name => {
            const shapes = getChordShapes(name);
            const selectedIndex = Math.min(song.referenceShapes[name] || 0, shapes.length - 1);
            const clickableClass = shapes.length > 1 ? ' shape-switchable' : '';
            const diagram = chordDiagram(name, selectedIndex);
            const diagramControl = shapes.length > 1 ? `<button class="shape-diagram-btn" type="button" data-chord="${name}" aria-label="Switch ${name} chord shape" title="Switch chord shape">${diagram}</button>` : diagram;
            return `<div class="reference-chord${clickableClass}"><div class="reference-chord-name">${name}</div>${diagramControl}</div>`;
        }).join('')
        : `<p class="empty-reference">${t('emptyChordReference')}</p>`;
    reference.querySelectorAll('.shape-diagram-btn').forEach(button => {
        button.addEventListener('click', () => openShapePicker(button.dataset.chord));
    });
}

let pickerChord = null;
let pickerReadOnly = false;
let pickerTrigger = null;

function openShapePicker(chordName, readOnly = false) {
    pickerChord = chordName;
    pickerReadOnly = readOnly;
    pickerTrigger = document.activeElement;
    renderShapeOptions();
    document.getElementById('shape-picker-title').textContent = chordName;
    const modal = document.getElementById('shape-picker-modal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('close-shape-picker').focus();
}

function closeShapePicker() {
    const modal = document.getElementById('shape-picker-modal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pickerChord = null;
    pickerReadOnly = false;
    if (pickerTrigger?.isConnected) pickerTrigger.focus();
    pickerTrigger = null;
}

function renderShapeOptions() {
    const grid = document.getElementById('shape-picker-grid');
    const shapes = getChordShapes(pickerChord);
    const selectedIndex = Math.min(song.referenceShapes[pickerChord] || 0, shapes.length - 1);
    const hint = document.querySelector('#shape-picker-modal .shape-picker-hint');
    hint.dataset.i18n = pickerReadOnly ? 'allShapes' : 'chooseShape';
    hint.textContent = t(hint.dataset.i18n);
    grid.innerHTML = shapes.map((shape, index) => {
        const label = escapeHtml(shape.label || `${t('chordShape')} ${index + 1}`);
        const content = `<div class="shape-option-name">${label}</div>${chordDiagram(pickerChord, index)}`;
        return pickerReadOnly
            ? `<article class="shape-preview">${content}</article>`
            : `<button class="shape-option${index === selectedIndex ? ' selected' : ''}" type="button" data-index="${index}" aria-pressed="${index === selectedIndex}" title="${label}">${content}</button>`;
    }).join('') || `<p class="empty-reference">${t('shapeUnavailable')}</p>`;
    grid.querySelectorAll('.shape-option').forEach(option => option.addEventListener('click', () => {
        song.referenceShapes[pickerChord] = Number(option.dataset.index);
        saveSong();
        closeShapePicker();
        renderReference();
    }));
}

function escapeHtml(value) {
    return value.replace(/&/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function chordLabelHtml(chordName) {
    return `<button class="chord-label" type="button" contenteditable="false" data-chord="${escapeHtml(chordName)}" title="${t('chordLabelHint')}">${escapeHtml(chordName)}</button>`;
}

function createChordAnnotation(chordName) {
    const annotation = document.createElement('span');
    annotation.className = 'chord-annotation';
    annotation.innerHTML = chordLabelHtml(chordName);
    return annotation;
}

function addChord(chordName) {
    const sheet = document.getElementById('lyrics-sheet');
    if (!chordName) return;

    if (editingAnnotation) {
        if (!sheet.contains(editingAnnotation)) return;
        editingAnnotation.innerHTML = chordLabelHtml(chordName);
        syncSheet();
        renderReference();
        closeChordFinder();
        return;
    }

    if (!pendingChordRange || !sheet.contains(pendingChordRange.commonAncestorContainer)) return;

    const annotation = createChordAnnotation(chordName);
    pendingChordRange.insertNode(annotation);
    pendingChordRange.setStartAfter(annotation);
    pendingChordRange.collapse(true);
    pendingChordRange = null;
    syncSheet();
    renderReference();
    closeChordFinder();
}

// Chord row band on top of each lyric line, and the y offset used to hit-test the lyric text under it.
const CHORD_ROW_BAND_HEIGHT = 24;
const LYRIC_TEXT_HIT_OFFSET = 28;

function getChordInsertionPoint(event) {
    const sheet = document.getElementById('lyrics-sheet');
    if (event.target.closest?.('.chord-label')) return null;
    const line = event.target.closest?.('div, p');
    if (!line || line === sheet || !sheet.contains(line)) return null;

    const lineBounds = line.getBoundingClientRect();
    if (!line.textContent.trim() || event.clientY > lineBounds.top + CHORD_ROW_BAND_HEIGHT) return null;

    const caretRange = document.caretRangeFromPoint(event.clientX, lineBounds.top + LYRIC_TEXT_HIT_OFFSET);
    if (!caretRange || !sheet.contains(caretRange.commonAncestorContainer)) return null;
    return { lineBounds, caretRange };
}

// Box of the lyric character the chord anchors to, i.e. the character right after the caret.
function getChordAnchorBounds(caretRange) {
    const { startContainer, startOffset } = caretRange;
    if (startContainer.nodeType !== Node.TEXT_NODE) return null;
    const textLength = startContainer.textContent.length;
    if (!textLength) return null;

    const anchorRange = document.createRange();
    const end = startOffset < textLength ? startOffset + 1 : startOffset;
    anchorRange.setStart(startContainer, end - 1);
    anchorRange.setEnd(startContainer, end);
    const bounds = anchorRange.getBoundingClientRect();
    return bounds.width ? bounds : null;
}

function openChordFinder(event) {
    if (event.button !== 0) return;
    // Labels are handled by the click listener instead, so a press can turn into a drag first.
    const insertion = getChordInsertionPoint(event);
    if (!insertion) return;

    pendingChordRange = insertion.caretRange.cloneRange();
    editingAnnotation = null;
    openChordFinderModal();
}

function openChordFinderModal() {
    const modal = document.getElementById('chord-finder-modal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    const search = document.getElementById('chord-finder-search');
    search.value = '';
    // Every modal opens on plain chords again; a leftover bass note would silently turn the
    // next pick into a slash chord.
    document.getElementById('chord-finder-bass').value = '';
    renderChordFinderMode();
    renderChordChoices();
    search.focus();
}

function renderChordFinderMode() {
    const isEditing = Boolean(editingAnnotation);
    document.getElementById('chord-finder-title').textContent = t(isEditing ? 'updateChord' : 'chooseChord');
    document.getElementById('chord-finder-footer').hidden = !isEditing;
}

function updateSnapIndicator(event) {
    if (chordDrag?.active) return;
    const sheet = document.getElementById('lyrics-sheet');
    const insertion = getChordInsertionPoint(event);
    const anchored = insertion ? showSnapIndicator(insertion.lineBounds, insertion.caretRange) : false;
    if (!anchored) hideSnapIndicator();
    sheet.classList.toggle('chord-row-hover', anchored);
}

// Places the dashed box over the lyric character a chord would anchor to.
function showSnapIndicator(lineBounds, caretRange) {
    const indicator = document.querySelector('.chord-snap-indicator');
    const anchorBounds = indicator && getChordAnchorBounds(caretRange);
    if (!anchorBounds) {
        indicator?.classList.remove('visible');
        return false;
    }
    const sheetBounds = document.getElementById('lyrics-sheet').getBoundingClientRect();
    indicator.style.left = `${anchorBounds.left - sheetBounds.left}px`;
    indicator.style.width = `${anchorBounds.width}px`;
    indicator.style.top = `${lineBounds.top - sheetBounds.top + 3}px`;
    indicator.classList.add('visible');
    return true;
}

function hideSnapIndicator() {
    document.querySelector('.chord-snap-indicator')?.classList.remove('visible');
}

// A chord label can be picked up and slid left or right to re-anchor it to another lyric
// character. Snapping is the same hit-test the insert-on-click path uses, so a dropped chord
// lands exactly where a newly inserted one would.
const CHORD_DRAG_START = 4;

function beginChordDrag(event) {
    if (event.button !== 0) return;
    // Any fresh press clears the flag that swallows the click following a drop.
    suppressLabelClick = false;
    const label = event.target.closest?.('.chord-label');
    const annotation = label?.closest('.chord-annotation');
    const line = label?.closest('div, p');
    if (!annotation || !line) return;
    chordDrag = { annotation, line, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false, dropRange: null };
    // Capture keeps the move and up events coming even when the pointer leaves the small label.
    label.setPointerCapture?.(event.pointerId);
}

function dragChord(event) {
    if (!chordDrag || chordDrag.pointerId !== event.pointerId) return;
    if (!chordDrag.active) {
        const moved = Math.abs(event.clientX - chordDrag.startX) >= CHORD_DRAG_START
            || Math.abs(event.clientY - chordDrag.startY) >= CHORD_DRAG_START;
        if (!moved) return;
        chordDrag.active = true;
        const sheet = document.getElementById('lyrics-sheet');
        sheet.classList.add('chord-dragging');
        sheet.classList.remove('chord-row-hover');
        chordDrag.annotation.classList.add('chord-drag-source');
        // The chord travels on its own; no text selection should come along.
        window.getSelection()?.removeAllRanges();
    }
    event.preventDefault();
    // Only the horizontal position follows the pointer, so the chord stays on its own line.
    const lineBounds = chordDrag.line.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX, lineBounds.left + 1), lineBounds.right - 1);
    const caretRange = document.caretRangeFromPoint?.(x, lineBounds.top + LYRIC_TEXT_HIT_OFFSET);
    const textNode = caretRange?.startContainer;
    // Real lyric text only: never this label's own text nor another chord's, and nothing outside
    // the line the drag started on.
    if (textNode?.nodeType !== Node.TEXT_NODE || !chordDrag.line.contains(textNode) || textNode.parentElement.closest('.chord-annotation')) return;
    // Keep the last good target when there is no character to measure here, so letting go over a
    // gap still lands the chord on the nearest character that did fit.
    if (showSnapIndicator(lineBounds, caretRange)) chordDrag.dropRange = caretRange.cloneRange();
}

function endChordDrag(event, commit = true) {
    if (!chordDrag || (event && chordDrag.pointerId !== event.pointerId)) return;
    const drag = chordDrag;
    chordDrag = null;
    document.getElementById('lyrics-sheet').classList.remove('chord-dragging');
    drag.annotation.classList.remove('chord-drag-source');
    hideSnapIndicator();
    // Under the drag threshold it was just a click, which the click listener handles.
    if (!drag.active) return;
    suppressLabelClick = true;
    if (!commit || !drag.dropRange) return;
    drag.dropRange.insertNode(drag.annotation);
    syncSheet();
    renderReference();
}

// Turns whatever is in the bass field into a note name from the shared table, or '' when the
// text isn't a single pitch. Case is the user's to get wrong, so 'g' and 'f#' are fine.
function normalizeBassNote(raw) {
    const text = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
    const match = text.match(/^([a-g])([#b]?)$/i);
    if (!match) return '';
    const letter = match[1].toUpperCase();
    const typed = `${letter}${match[2]}`;
    // Keep the spelling as typed whenever the tables already carry it, so 'bb' stays Bb
    // rather than being renamed to its sharp-side enharmonic.
    const spelled = NOTE_REFERENCE_NOTES.find(note => note.toUpperCase() === typed.toUpperCase());
    if (spelled) return spelled;
    // Spellings the table has no entry for (E#, Cb, Fb, B#) resolve to their pitch class.
    const shift = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    return NOTE_REFERENCE_NOTES[((NOTE_LETTER_PITCH_CLASSES[letter] + shift) % 12 + 12) % 12];
}

function renderChordChoices() {
    const query = document.getElementById('chord-finder-search').value.trim().toLowerCase();
    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const relatedChords = song.keys.flatMap(key => {
        const isMinor = key.endsWith('m');
        const keyIndex = notes.indexOf(isMinor ? key.slice(0, -1) : key);
        if (keyIndex === -1) return [];
        return isMinor
            ? [
                `${notes[keyIndex]}m`,
                `${notes[(keyIndex + 2) % 12]}m`,
                `${notes[(keyIndex + 3) % 12]}`,
                `${notes[(keyIndex + 5) % 12]}m`,
                `${notes[(keyIndex + 7) % 12]}m`,
                `${notes[(keyIndex + 8) % 12]}`
            ]
            : [
                notes[keyIndex],
                `${notes[(keyIndex + 2) % 12]}m`,
                `${notes[(keyIndex + 4) % 12]}m`,
                notes[(keyIndex + 5) % 12],
                notes[(keyIndex + 7) % 12],
                `${notes[(keyIndex + 9) % 12]}m`
            ];
    });
    const choices = CHORD_CHOICES.filter(chord => chord.toLowerCase().includes(query));
    // Listing every slash chord is hopeless, so instead the bass field lets a note be typed in
    // and stamps it onto whatever chord gets picked: G typed + C clicked = C/G.
    const bassField = document.getElementById('chord-finder-bass');
    const bass = normalizeBassNote(bassField.value);
    const invalidBass = Boolean(bassField.value.trim()) && !bass;
    bassField.classList.toggle('invalid', invalidBass);
    bassField.setAttribute('aria-invalid', String(invalidBass));
    const bassHint = document.getElementById('chord-finder-bass-hint');
    bassHint.classList.toggle('invalid', invalidBass);
    bassHint.textContent = t(invalidBass ? 'bassInvalid' : 'bassHint');
    // A chord still belongs with the key when all of its notes are in the scale, even when
    // it is not one of the diatonic triads - Gsus4 in C, for instance. With no key picked,
    // the scale is empty and nothing passes, so the section simply does not appear.
    const keyPitchClasses = new Set([...getSongScaleNotes()].map(note => NOTE_REFERENCE_NOTES.indexOf(note)));
    const isAllNotesInKey = chord => {
        const match = chord.match(/^([A-G][#b]?)(.*)$/);
        if (!match) return false;
        const rootIndex = NOTE_REFERENCE_NOTES.indexOf(match[1]);
        const intervals = CHORD_CHOICE_INTERVALS[match[2]];
        if (rootIndex === -1 || !intervals) return false;
        return intervals.every(interval => keyPitchClasses.has((rootIndex + interval) % 12));
    };
    const related = choices.filter(chord => relatedChords.includes(chord));
    const inKeyExtras = choices.filter(chord => !relatedChords.includes(chord) && isAllNotesInKey(chord));
    const other = choices.filter(chord => !relatedChords.includes(chord) && !isAllNotesInKey(chord));
    const slashName = chord => (bass ? `${chord}/${bass}` : chord);
    const buttons = chords => chords.map(chord => {
        const name = slashName(chord);
        return `<button class="chord-choice" type="button" data-chord="${name}" title="${name}">${name}</button>`;
    }).join('');
    const section = (title, chords, modifier) => chords.length
        ? `<section class="chord-choice-section ${modifier}"><h3>${title}</h3><div class="chord-choice-grid">${buttons(chords)}</div></section>`
        : '';
    const results = document.getElementById('chord-finder-results');
    // Slash names are noticeably wider, so the grid needs to give each cell more room.
    results.classList.toggle('has-bass', Boolean(bass));
    results.innerHTML =
        section(t('relatedChords'), related, 'related-chord-section')
        + section(t('otherRelatedChords'), inKeyExtras, 'other-related-chord-section')
        + section(t('otherChords'), other, 'other-chord-section')
        || `<p class="no-chords-found">${t('noChordsFound')}</p>`;
    document.querySelectorAll('.chord-choice').forEach(button => button.addEventListener('click', () => addChord(button.dataset.chord)));
}

function closeChordFinder() {
    const modal = document.getElementById('chord-finder-modal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pendingChordRange = null;
    editingAnnotation = null;
}

function removeChord(annotation) {
    if (!annotation) return;
    const fragment = document.createDocumentFragment();
    [...annotation.childNodes].forEach(node => {
        if (!node.classList?.contains('chord-label')) fragment.appendChild(node);
    });
    annotation.replaceWith(fragment);
    syncSheet();
    renderReference();
}

// Each lyric line needs a block wrapper to get its chord row, so wrap text typed straight into the sheet.
function wrapStrayLyricLines() {
    const sheet = document.getElementById('lyrics-sheet');
    const selection = window.getSelection();
    const hasCaret = selection.rangeCount && sheet.contains(selection.getRangeAt(0).commonAncestorContainer);
    const caretRange = hasCaret ? selection.getRangeAt(0).cloneRange() : null;
    let line = null;

    [...sheet.childNodes].forEach(node => {
        const isStray = node.nodeType === Node.TEXT_NODE
            ? Boolean(node.textContent.trim())
            : node.nodeType === Node.ELEMENT_NODE && !['BR', 'DIV', 'P'].includes(node.tagName) && !node.classList.contains('chord-snap-indicator');
        if (!isStray) {
            line = null;
            return;
        }
        if (!line) {
            line = document.createElement('div');
            node.parentNode.insertBefore(line, node);
        }
        line.appendChild(node);
    });

    if (caretRange) {
        selection.removeAllRanges();
        selection.addRange(caretRange);
    }
}

function syncSheet() {
    const sheet = document.getElementById('lyrics-sheet');
    const indicator = sheet.querySelector('.chord-snap-indicator');
    indicator?.remove();
    wrapStrayLyricLines();
    song.lyricsHtml = normalizeLyricsHtml(sheet.innerHTML);
    sheet.insertAdjacentHTML('beforeend', '<span class="chord-snap-indicator" contenteditable="false"></span>');
    saveSong();
}

function rememberSelection() {
    const selection = window.getSelection();
    const sheet = document.getElementById('lyrics-sheet');
    if (selection.rangeCount && sheet.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        savedSelection = selection.getRangeAt(0).cloneRange();
    }
}

// Chords live in a row above the lyric text, so a copied selection would either lose them or
// smear their names into the words. ChordPro-style markers go on the clipboard instead:
// [Am]he[C]llo reads sensibly anywhere else and can be pasted straight back in.
// Deliberately strict, so ordinary bracketed directions like [Chorus] stay as lyrics.
const CHORD_MARKUP = /\[(?:[A-G](?:#|b)?(?:maj7|m7|min|maj|dim|aug|sus2|sus4|sus|add9|m|7|6|9|5)?(?:\/[A-G](?:#|b)?)?)\]/;
// Same pattern, global, for scanning a whole line: a /g regex keeps lastIndex between calls, so
// the stateless one above is never used for repeated matching.
const CHORD_MARKUP_ALL = new RegExp(CHORD_MARKUP.source, 'g');

// Text of a copied fragment, chords turned back into markers at the character they sit on.
function serializeLyrics(fragment) {
    const clone = fragment.cloneNode(true);
    clone.querySelectorAll('.chord-annotation').forEach(annotation => {
        const label = annotation.querySelector('.chord-label');
        annotation.replaceWith(document.createTextNode(label ? `[${label.dataset.chord}]` : ''));
    });
    let text = '';
    clone.childNodes.forEach(node => {
        // One line per lyric line; inline leftovers of a partly selected line stay joined up.
        if (/^(DIV|P)$/.test(node.nodeName) && text && !text.endsWith('\n')) text += '\n';
        text += node.textContent;
    });
    return text;
}

// A chord has no width of its own on the lyric row, so one anchored on a line's first character
// sits at a spot the mouse cannot reach: dragging to the start of the text stops inside the text
// node and leaves the annotation outside the selection. Chords sitting immediately behind the
// opening position therefore get added to the copy by hand - which is also the right reading, as
// each of them belongs to the first selected character.
function chordsAtSelectionStart(range) {
    if (range.startOffset !== 0 || range.startContainer.nodeType !== Node.TEXT_NODE) return '';
    let node = range.startContainer.previousSibling;
    let markup = '';
    while (node?.nodeType === Node.ELEMENT_NODE && node.classList.contains('chord-annotation')) {
        const label = node.querySelector('.chord-label');
        markup = `${label ? `[${label.dataset.chord}]` : ''}${markup}`;
        node = node.previousSibling;
    }
    return markup;
}

function copyLyrics(event, isCut) {
    const sheet = document.getElementById('lyrics-sheet');
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || range.isCollapsed || !sheet.contains(range.commonAncestorContainer)) return;
    const text = chordsAtSelectionStart(range) + serializeLyrics(range.cloneContents());
    // No chords in it: the browser's own copy does just as well.
    if (!CHORD_MARKUP.test(text)) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    if (!isCut) return;
    document.execCommand('delete');
    syncSheet();
    renderReference();
}

// A pasted line rebuilt into lyric text with chord annotations at their marked offsets.
function buildLyricLine(text) {
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const match of text.matchAll(CHORD_MARKUP_ALL)) {
        if (match.index > position) fragment.appendChild(document.createTextNode(text.slice(position, match.index)));
        fragment.appendChild(createChordAnnotation(match[0].slice(1, -1)));
        position = match.index + match[0].length;
    }
    if (position < text.length) fragment.appendChild(document.createTextNode(text.slice(position)));
    return fragment;
}

function insertLyricLines(lines) {
    const sheet = document.getElementById('lyrics-sheet');
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0).cloneRange();
    const node = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
    // The line the caret is on; the sheet itself doesn't count, it holds no text of its own.
    let line = node?.closest('div, p');
    if (line === sheet) line = null;
    range.deleteContents();
    const first = buildLyricLine(lines[0]);
    const inserted = [...first.childNodes];
    range.insertNode(first);
    lines.slice(1).forEach(text => {
        // Anything pasted after the first line becomes a lyric line of its own.
        const next = document.createElement('div');
        next.appendChild(buildLyricLine(text));
        if (line) line.after(next);
        else sheet.appendChild(next);
        line = next;
    });
    // Land the caret behind the pasted text so typing continues from there.
    const caret = document.createRange();
    if (line && lines.length > 1) {
        caret.selectNodeContents(line);
        caret.collapse(false);
    } else if (inserted.length) {
        caret.setStartAfter(inserted[inserted.length - 1]);
        caret.collapse(true);
    } else {
        return;
    }
    selection.removeAllRanges();
    selection.addRange(caret);
}

function pasteLyrics(event) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    // Only chord markup needs rebuilding; everything else stays a plain-text paste.
    if (!lines.some(line => CHORD_MARKUP.test(line))) {
        document.execCommand('insertText', false, text);
        return;
    }
    insertLyricLines(lines);
    syncSheet();
    renderReference();
}

function exportSong() {
    const data = JSON.stringify(song, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    link.download = `${song.title.trim() || 'song'}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

function hasSongContent() {
    const sheet = document.getElementById('lyrics-sheet');
    const hasLyrics = sheet.textContent.trim().length > 0;
    const hasTitle = song.title.trim().length > 0;
    const hasKeys = song.keys.length > 0;
    const hasBpm = song.bpm.trim().length > 0;
    return hasLyrics || hasTitle || hasKeys || hasBpm;
}

function applyImportedSong(importedSong) {
    if (typeof importedSong.lyricsHtml !== 'string') throw new Error('Invalid song');
    song = { title: String(importedSong.title || ''), keys: normalizeKeys(importedSong.keys ?? importedSong.key), bpm: String(importedSong.bpm || ''), lyricsHtml: importedSong.lyricsHtml, referenceShapes: importedSong.referenceShapes || {} };
    document.getElementById('song-title').value = song.title;
    saveSong();
    renderSong();
}

let confirmCallback = null;

function showConfirmModal(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = t('confirm');
    confirmCallback = onConfirm;
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    confirmCallback = null;
}

function showAlertModal(message) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = t('close');
    confirmCallback = null;
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function confirmModal(message) {
    return new Promise(resolve => {
        showConfirmModal(message, resolve);
    });
}

function importSongText(text) {
    try {
        const importedSong = JSON.parse(text);
        if (hasSongContent()) {
            showConfirmModal(t('confirmOverwriteSong'), () => applyImportedSong(importedSong));
        } else {
            applyImportedSong(importedSong);
        }
    } catch {
        showAlertModal(t('invalidSongFile'));
    }
}

function importSong(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importSongText(reader.result);
    reader.readAsText(file);
    event.target.value = '';
}

function newSong() {
    if (hasSongContent()) {
        showConfirmModal(t('confirmNewSong'), () => {
            song = { title: '', keys: [], bpm: '', lyricsHtml: '', referenceShapes: {} };
            saveSong();
            renderSong();
        });
    } else {
        song = { title: '', keys: [], bpm: '', lyricsHtml: '', referenceShapes: {} };
        saveSong();
        renderSong();
    }
}

function normalizeKeys(value) {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(list.filter(key => SONG_KEYS.includes(key)))];
}

function renderSongKeyButton() {
    const button = document.getElementById('song-key-btn');
    button.textContent = song.keys.length ? song.keys.join(' · ') : '-';
}

const NOTE_REFERENCE_NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_REFERENCE_SCALES = {
    major: { intervals: [0, 2, 4, 5, 7, 9, 11], types: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'] },
    minor: { intervals: [0, 2, 3, 5, 7, 8, 10], types: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'] }
};

function renderNoteReference() {
    const container = document.getElementById('note-reference');
    if (!song.keys.length) {
        container.innerHTML = `<p class="empty-reference">${t('emptyNoteReference')}</p>`;
        return;
    }
    container.innerHTML = song.keys.map(key => {
        const isMinor = key.endsWith('m');
        const root = isMinor ? key.slice(0, -1) : key;
        const rootIndex = NOTE_REFERENCE_NOTES.indexOf(root);
        if (rootIndex === -1) return '';
        const scale = isMinor ? NOTE_REFERENCE_SCALES.minor : NOTE_REFERENCE_SCALES.major;
        const notes = scale.intervals.map(interval => NOTE_REFERENCE_NOTES[(rootIndex + interval) % 12]);
        const chords = notes.map((note, i) => {
            const type = scale.types[i];
            const suffix = type === 'maj' ? '' : type === 'min' ? 'm' : 'dim';
            return `${note}${suffix}`;
        });
        return `<div class="note-key-group"><span class="note-key-name">${escapeHtml(key)}</span><div class="note-key-chips">${notes.map((note, i) => `<button class="note-chip${i === 0 ? ' root' : ''}" type="button" data-chord="${chords[i]}" aria-haspopup="dialog" aria-controls="shape-picker-modal" aria-label="${chords[i]} — ${t('allShapes')}" title="${chords[i]} — ${t('allShapes')}"><span class="note-chip-note">${note}</span><span class="note-chip-chord">${chords[i]}</span></button>`).join('')}</div></div>`;
    }).join('');
    container.querySelectorAll('.note-chip').forEach(button => {
        button.addEventListener('click', () => openShapePicker(button.dataset.chord, true));
    });
}

function renderSongKeyOptions() {
    const container = document.getElementById('song-key-options');
    container.innerHTML = SONG_KEYS.map(key => `<button class="song-key-option${pendingKeys.includes(key) ? ' selected' : ''}" type="button" data-key="${key}" aria-pressed="${pendingKeys.includes(key)}">${key}</button>`).join('');
    container.querySelectorAll('.song-key-option').forEach(option => option.addEventListener('click', () => {
        const key = option.dataset.key;
        pendingKeys = pendingKeys.includes(key) ? pendingKeys.filter(k => k !== key) : [...pendingKeys, key];
        renderSongKeyOptions();
    }));
}

function openSongKeyModal() {
    pendingKeys = [...song.keys];
    renderSongKeyOptions();
    const modal = document.getElementById('song-key-modal');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeSongKeyModal() {
    const modal = document.getElementById('song-key-modal');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    pendingKeys = [];
}

function renderSong() {
    document.getElementById('song-title').value = song.title;
    renderSongKeyButton();
    document.getElementById('song-bpm').value = song.bpm;
    song.lyricsHtml = normalizeLyricsHtml(song.lyricsHtml);
    document.getElementById('lyrics-sheet').innerHTML = song.lyricsHtml;
    wrapStrayLyricLines();
    document.getElementById('lyrics-sheet').insertAdjacentHTML('beforeend', '<span class="chord-snap-indicator" contenteditable="false"></span>');
    renderReference();
    renderNoteReference();
}

document.getElementById('song-title').addEventListener('input', event => {
    song.title = event.target.value;
    saveSong();
});
document.getElementById('song-key-btn').addEventListener('click', openSongKeyModal);
document.getElementById('close-song-key').addEventListener('click', closeSongKeyModal);
// A backdrop should only dismiss its modal when the press and the release both
// land on the backdrop itself. Otherwise a drag that starts inside the content box
// (text selection, sliders, chips) and ends over the backdrop fires a click whose
// target is the backdrop, accidentally closing the modal.
function wireBackdropClose(modalId, onClose) {
    const modal = document.getElementById(modalId);
    let pressedOnBackdrop = false;
    modal.addEventListener('mousedown', event => {
        pressedOnBackdrop = event.target === modal;
    });
    modal.addEventListener('click', event => {
        if (event.target === modal && pressedOnBackdrop) onClose();
        pressedOnBackdrop = false;
    });
}
wireBackdropClose('song-key-modal', closeSongKeyModal);
document.getElementById('clear-song-keys').addEventListener('click', () => {
    pendingKeys = [];
    renderSongKeyOptions();
});
document.getElementById('apply-song-keys').addEventListener('click', () => {
    song.keys = [...pendingKeys];
    saveSong();
    renderSongKeyButton();
    // The chord diagrams tint their notes in/out of key from the same scale, so they have to
    // be redrawn as well or they keep the previous key's red markers.
    renderReference();
    renderNoteReference();
    closeSongKeyModal();
});
document.getElementById('song-bpm').addEventListener('input', event => {
    song.bpm = event.target.value;
    saveSong();
});
document.getElementById('lyrics-sheet').addEventListener('input', () => {
    syncSheet();
    renderReference();
});
document.getElementById('lyrics-sheet').addEventListener('mouseup', rememberSelection);
document.getElementById('lyrics-sheet').addEventListener('keyup', rememberSelection);
document.getElementById('lyrics-sheet').addEventListener('paste', pasteLyrics);
document.getElementById('lyrics-sheet').addEventListener('copy', event => copyLyrics(event, false));
document.getElementById('lyrics-sheet').addEventListener('cut', event => copyLyrics(event, true));
document.getElementById('lyrics-sheet').addEventListener('mousedown', openChordFinder);
document.getElementById('lyrics-sheet').addEventListener('pointerdown', beginChordDrag);
document.getElementById('lyrics-sheet').addEventListener('pointermove', dragChord);
document.getElementById('lyrics-sheet').addEventListener('pointerup', event => endChordDrag(event));
document.getElementById('lyrics-sheet').addEventListener('pointercancel', event => endChordDrag(event, false));
// The browser would otherwise drag the label (or the selection) itself and move DOM around
// behind our back, so a press on a chord label never starts a native drag.
document.getElementById('lyrics-sheet').addEventListener('dragstart', event => {
    if (chordDrag) event.preventDefault();
});
document.getElementById('lyrics-sheet').addEventListener('click', event => {
    // A drag ends with a click on the label; that one only has to be swallowed.
    if (suppressLabelClick) {
        suppressLabelClick = false;
        return;
    }
    const label = event.target.closest?.('.chord-label');
    if (!label) return;
    event.preventDefault();
    pendingChordRange = null;
    editingAnnotation = label.closest('.chord-annotation') || label;
    openChordFinderModal();
});
document.getElementById('lyrics-sheet').addEventListener('contextmenu', event => {
    const label = event.target.closest?.('.chord-label');
    if (!label) return;
    event.preventDefault();
    removeChord(label.closest('.chord-annotation') || label);
});
document.getElementById('lyrics-sheet').addEventListener('pointermove', updateSnapIndicator);
document.getElementById('lyrics-sheet').addEventListener('pointerleave', () => {
    if (chordDrag?.active) return;
    document.getElementById('lyrics-sheet').classList.remove('chord-row-hover');
    hideSnapIndicator();
});
document.getElementById('lyrics-sheet').addEventListener('dragenter', event => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) {
        document.getElementById('lyrics-sheet').classList.add('drag-over');
    }
});
document.getElementById('lyrics-sheet').addEventListener('dragover', event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (event.dataTransfer.types.includes('Files')) {
        document.getElementById('lyrics-sheet').classList.add('drag-over');
    }
});
document.getElementById('lyrics-sheet').addEventListener('dragleave', event => {
    if (!document.getElementById('lyrics-sheet').contains(event.relatedTarget)) {
        document.getElementById('lyrics-sheet').classList.remove('drag-over');
    }
});
document.getElementById('lyrics-sheet').addEventListener('drop', event => {
    event.preventDefault();
    document.getElementById('lyrics-sheet').classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importSongText(reader.result);
    reader.readAsText(file);
});
document.getElementById('chord-finder-search').addEventListener('input', renderChordChoices);
document.getElementById('chord-finder-bass').addEventListener('input', renderChordChoices);
document.getElementById('close-chord-finder').addEventListener('click', closeChordFinder);
document.getElementById('remove-chord-btn').addEventListener('click', () => {
    const annotation = editingAnnotation;
    closeChordFinder();
    removeChord(annotation);
});
wireBackdropClose('chord-finder-modal', closeChordFinder);
document.getElementById('close-shape-picker').addEventListener('click', closeShapePicker);
wireBackdropClose('shape-picker-modal', closeShapePicker);
document.getElementById('shape-picker-modal').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeShapePicker();
        closeChordFinder();
        closeConfirmModal();
    }
});
document.getElementById('export-btn').addEventListener('click', exportSong);
document.getElementById('new-song-btn').addEventListener('click', newSong);
document.getElementById('import-input').addEventListener('change', importSong);
document.getElementById('confirm-ok').addEventListener('click', () => {
    const callback = confirmCallback;
    closeConfirmModal();
    if (callback) callback(true);
});
document.getElementById('confirm-cancel').addEventListener('click', closeConfirmModal);
document.getElementById('close-confirm').addEventListener('click', closeConfirmModal);
wireBackdropClose('confirm-modal', closeConfirmModal);
document.addEventListener('languagechange', () => {
    renderSong();
    renderChordFinderMode();
    // The finder's own strings live in renderChordChoices (hint text, section titles), so an
    // open modal has to be re-rendered rather than left half-translated.
    if (document.getElementById('chord-finder-modal').classList.contains('active')) renderChordChoices();
    if (pickerChord) renderShapeOptions();
});

loadSong();
renderSong();
