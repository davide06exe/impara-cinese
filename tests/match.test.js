// Esegui con:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../js/match.js');

test('applyTone mette il segno sulla vocale giusta', () => {
  assert.equal(M.applyTone('hao', 3), 'hǎo');
  assert.equal(M.applyTone('hui', 2), 'huí');
  assert.equal(M.applyTone('liu', 2), 'liú');
  assert.equal(M.applyTone('xie', 4), 'xiè');
  assert.equal(M.applyTone('shuo', 1), 'shuō');
  assert.equal(M.applyTone('nv', 3), 'nǚ');
  assert.equal(M.applyTone('ma', 5), 'ma');
  assert.equal(M.applyTone('zhong', 1), 'zhōng');
});

test('numeri -> segni', () => {
  assert.equal(M.numbersToMarks('ni3hao3'), 'nǐhǎo');
  assert.equal(M.numbersToMarks('Zhong1wen2'), 'zhōngwén');
  assert.equal(M.numbersToMarks('nu:3'), 'nǚ');
  assert.equal(M.numbersToMarks('peng2you5'), 'péngyou');
});

test('parseSyllables', () => {
  const tones = (s) => M.parseSyllables(s).map((x) => x.tone);
  assert.deepEqual(tones('gōngchéngshī'), [1, 2, 1]);
  assert.deepEqual(tones('Zhōngwén'), [1, 2]);
  assert.deepEqual(tones('qù nǎr a'), [4, 3, 0]);
  assert.deepEqual(tones('wǎnshang hǎo'), [3, 0, 3]);
  assert.equal(M.parseSyllables('xyz'), null);
});

test('checkPinyin: segni, numeri, spazi, maiuscole', () => {
  assert.equal(M.checkPinyin('nǐhǎo', 'nǐhǎo').status, 'correct');
  assert.equal(M.checkPinyin('ni3hao3', 'nǐhǎo').status, 'correct');
  assert.equal(M.checkPinyin('Nǐ Hǎo', 'nǐhǎo').status, 'correct');
  assert.equal(M.checkPinyin('wan3shang hao3', 'wǎnshang hǎo').status, 'correct');
  assert.equal(M.checkPinyin('nv3', 'nǚ').status, 'correct');
  assert.equal(M.checkPinyin('', 'nǐ').status, 'empty');
  assert.equal(M.checkPinyin('wo3', 'nǐ').status, 'wrong');
});

test('checkPinyin: toni mancanti', () => {
  assert.equal(M.checkPinyin('nihao', 'nǐhǎo').status, 'toneOnly');
  assert.equal(M.checkPinyin('ni2hao3', 'nǐhǎo').status, 'toneOnly');
  assert.equal(M.checkPinyin('nihao', 'nǐhǎo', { ignoreTones: true }).status, 'correct');
  assert.equal(M.checkPinyin('nu', 'nǚ', { ignoreTones: true }).status, 'correct');
  assert.equal(M.checkPinyin('nu', 'nǚ').status, 'toneOnly');
});

test('sandhi del terzo tono', () => {
  assert.deepEqual(M.sandhiVariants('nǐhǎo'), ['níhǎo']);
  assert.deepEqual(M.sandhiVariants('wǎngyǒu'), ['wángyǒu']);
  assert.deepEqual(M.sandhiVariants('wǒmen'), []);
  assert.equal(M.checkPinyin('níhǎo', 'nǐhǎo', { sandhi: true }).status, 'correct');
  assert.equal(M.checkPinyin('níhǎo', 'nǐhǎo').status, 'toneOnly');
});

test('letture alternative', () => {
  assert.equal(M.checkPinyin('liǎo', 'le', { alts: ['liǎo'] }).status, 'correct');
  assert.equal(M.checkPinyin('shui2', 'shéi', { alts: ['shuí'] }).status, 'correct');
});

test('compareSyllables', () => {
  const r = M.compareSyllables('ni3hao', 'nǐhǎo');
  assert.deepEqual(r.map((x) => x.state), ['ok', 'tone']);
  const w = M.compareSyllables('wo3hao3', 'nǐhǎo');
  assert.deepEqual(w.map((x) => x.state), ['wrong', 'ok']);
  assert.equal(M.compareSyllables('ni3', 'nǐhǎo'), null);
});

test('checkMeaning', () => {
  const persona = ['persona', 'essere umano'];
  assert.equal(M.checkMeaning('persona', persona).status, 'correct');
  assert.equal(M.checkMeaning('Una persona!', persona).status, 'correct');
  assert.equal(M.checkMeaning('persnoa', persona).status, 'correct'); // scambio di lettere
  assert.equal(M.checkMeaning('cavallo', persona).status, 'wrong');
  assert.equal(M.checkMeaning('', persona).status, 'empty');
  const cult = ['scrittura', 'lingua', 'cultura'];
  assert.equal(M.checkMeaning('scrittura, lingua', cult).status, 'correct');
  assert.equal(M.checkMeaning('scrittura e cultura', cult).status, 'correct');
  const mix = M.checkMeaning('scrittura, cavallo', cult);
  assert.equal(mix.status, 'wrong');
  assert.equal(mix.partial, 1);
  assert.equal(M.checkMeaning('giu', ['giù', 'sotto']).status, 'correct'); // accenti
  assert.equal(M.checkMeaning('casa', ['cosa']).status, 'wrong'); // parole corte: niente tolleranza
  assert.equal(M.checkMeaning('amica', ['amico'], ['amica']).status, 'correct'); // sinonimi extra
});

test('catalogo: tutti i pinyin sono validi e gli id unici', () => {
  const file = path.join(__dirname, '..', 'data', 'catalogo.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = new Set();
  for (const e of data.entries) {
    assert.ok(!ids.has(e.id), 'id duplicato ' + e.id);
    ids.add(e.id);
    const syl = M.parseSyllables(e.pinyin);
    assert.ok(syl && syl.length > 0, 'pinyin non valido: ' + e.hanzi + ' ' + e.pinyin);
    assert.equal(M.checkPinyin(e.pinyin, e.pinyin).status, 'correct');
    for (const a of e.altPinyin) assert.ok(M.parseSyllables(a), 'alt non valido ' + a);
    assert.ok(e.answers.length > 0, 'nessuna risposta per ' + e.hanzi);
    assert.equal(M.checkMeaning(e.meaning.split(',')[0], e.answers).status, 'correct');
  }
  for (const c of data.compounds) {
    assert.ok(M.parseSyllables(c.pinyin), 'pinyin composto ' + c.hanzi);
    for (const p of c.parts) if (p.pinyin) assert.ok(M.parseSyllables(p.pinyin), 'parte ' + p.hanzi);
  }
});
