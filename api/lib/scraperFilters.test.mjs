import assert from 'node:assert/strict';
import { batePalavras, restritoAOutroPais, passaFiltro, slugTitulo } from './scraperFilters.js';
import { FILTROS } from './scraperSources.js';

// batePalavras: limite de palavra (não casa substring dentro de outra palavra)
assert.equal(batePalavras('this is for teen students', ['teen']), true);
assert.equal(batePalavras('this is for teens', ['teen']), false); // 'teen' != 'teens' (whole-word only, same as the word list having both)
assert.equal(batePalavras('eighteen candidates in the canteen', ['teen']), false);
assert.equal(batePalavras('ages 13-18 welcome', ['ages 13']), true);
assert.equal(batePalavras('ages 130 welcome', ['ages 13']), false);
console.log('ok: batePalavras respects word boundaries');

// restritoAOutroPais: sinal de abertura (Brasil/Latam/global) sempre vence a trava
assert.equal(restritoAOutroPais('Open to Brazilian citizens only', FILTROS), false);
assert.equal(restritoAOutroPais('Applicants must be a resident of the United States', FILTROS), true);
assert.equal(restritoAOutroPais('Open only to US nationals', FILTROS), true);
assert.equal(restritoAOutroPais('A great program for high schoolers everywhere', FILTROS), false);
console.log('ok: restritoAOutroPais');

// passaFiltro: caso real esperado a passar (ensino médio + financeiro + sem exclusão)
const passa = passaFiltro({
  texto: 'Fully funded summer program for high school students aged 15-18, open to all nationalities.',
}, FILTROS);
assert.equal(passa.passou, true, `esperava passar: ${passa.motivo}`);

// caso real esperado a NÃO passar (é pós-graduação, mesmo mencionando "high school" de passagem)
const naoPassa = passaFiltro({
  texto: 'Fully funded PhD program, open to all nationalities, some participants come from high school outreach.',
}, FILTROS);
assert.equal(naoPassa.passou, false, 'PhD program deveria ser excluído mesmo mencionando high school');

// caso "youth" ambíguo + marcador adulto -> derruba
const youthAdulto = passaFiltro({
  texto: 'A fully funded accelerator for young entrepreneurs aged 18-30, open to all countries.',
}, FILTROS);
assert.equal(youthAdulto.passou, false, 'accelerator adulto não deve passar só por causa de "young"');

// caso "youth" ambíguo SEM marcador adulto -> passa (gap year, por exemplo)
const youthOk = passaFiltro({
  texto: 'A free gap year program for young people aged 18-19, open to all nationalities, fully funded.',
}, FILTROS);
assert.equal(youthOk.passou, true, `gap year deveria passar: ${youthOk.motivo}`);
console.log('ok: passaFiltro');

// slugTitulo: mesma oportunidade com nomes ligeiramente diferentes -> mesmo slug
assert.equal(
  slugTitulo('The Global Youth Leadership Summit 2026'),
  slugTitulo('Global Youth Leadership Summit (GYLS)'),
);
assert.notEqual(slugTitulo('Ocean Science Bowl'), slugTitulo('Math Olympiad'));
console.log('ok: slugTitulo groups equivalent titles');

console.log('\nAll scraperFilters tests passed.');
