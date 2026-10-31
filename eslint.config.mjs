/* ESLint (flat config) dla Popal.
 *
 * Gra to klasyczne <script>-y bez systemu budowania: moduły świadomie
 * współdzielą zmienne globalne (ładowane są w ścisłej kolejności z game.html).
 * Dlatego:
 *  - sourceType: 'script' (NIE module),
 *  - włączone są tylko reguły poprawności (no-undef, no-dupe-keys, …),
 *  - reguły stylu i no-unused-vars są wyłączone — kod jest w minimalistycznym
 *    stylu i to jest zamierzone.
 *
 * PROJECT_GLOBALS to umowne API gry: globalne nazwy tworzone przez
 * wcześniejsze moduły lub inline-skrypty game.html i używane w późniejszych.
 * Lista wygenerowana automatycznie (skan no-undef).
 * WAŻNE: gdy dodajesz NOWĄ globalną nazwę, dopisz ją tutaj — w przeciwnym
 * razie literówka w jej użyciu zostanie wychwycona przez no-undef.
 */
import js from '@eslint/js';
import globals from 'globals';

const PROJECT_GLOBALS = {
  $: 'writable', ANI: 'writable', B: 'writable', BALL: 'writable',
  BCOL: 'writable', BIO: 'writable', BLDBLK: 'writable', BLDC: 'writable',
  BLDY: 'writable', Co: 'writable', Cy: 'writable', DLOOK: 'writable',
  DUR: 'readonly', PW: 'readonly',
  EL: 'writable', EM: 'writable', FOOD: 'writable', FUR: 'writable',
  H: 'writable', HC: 'writable', HPM: 'writable', IT: 'writable',
  KIT: 'writable', NPCS: 'writable', P: 'writable', PALMODEL: 'writable',
  PSFX: 'writable', R: 'writable', R2: 'writable', RC: 'writable',
  S: 'writable', SK: 'writable', SZ: 'writable', Sound: 'writable',
  T: 'writable', TC: 'writable', THREE: 'writable', TOOLS: 'writable',
  TT: 'writable', XPM: 'writable', XPT: 'writable', add: 'writable',
  addI: 'writable', addPal: 'writable', addXp: 'writable', ang: 'writable',
  bagS: 'writable', bagW: 'writable', ballHtml: 'writable', buildHero: 'writable',
  bushes: 'writable', cam: 'writable', campLv: 'writable', campPts: 'writable',
  ccAcc: 'writable', ccO: 'writable', ccRow: 'writable', ccSel: 'writable',
  ccShow: 'writable', cenFree: 'writable', cf: 'writable', chAny: 'writable',
  chCount: 'writable', chNearFor: 'writable', chNearest: 'writable', chStore: 'writable',
  chTake: 'writable', cnt: 'writable', colBlocked: 'writable', colList: 'writable',
  colPal: 'writable', colPalStep: 'writable', colR: 'writable', colStep: 'writable',
  coolF: 'writable', dlgX: 'writable', dmg: 'writable', drawAv: 'writable', ec: 'writable',
  drawCrit: 'writable', dropGrave: 'writable', dropLoot: 'writable', elM: 'writable',
  elTip: 'writable', eq: 'writable', eqUp: 'writable', fbDb: 'writable',
  fbU: 'writable', fellB: 'writable', firebase: 'writable', fl: 'writable',
  flash: 'writable', gHit: 'writable', gXp: 'writable', hasSave: 'writable',
  heroAct: 'writable', hp2: 'writable', hpMax: 'writable', hud: 'writable',
  inv: 'writable', invCap: 'writable', invWt: 'writable', isNight: 'writable',
  itemW: 'writable', ivO: 'writable', ivOpen: 'writable', ivR: 'writable',
  ivTab: 'writable', jid: 'writable', jm: 'writable', joy: 'writable',
  jx: 'writable', jy: 'writable', kn: 'writable', look: 'writable',
  menuO: 'writable', mkBush: 'writable', mkFurnace: 'writable', mkPal: 'writable',
  mkRock: 'writable', mkShroom: 'writable', mkTree: 'writable', mmHide: 'writable',
  msg: 'writable', myPid: 'writable', nearKitchen: 'writable', nearest: 'writable',
  outl: 'writable', palAI: 'writable', palCap: 'writable', palCarry: 'writable',
  palDefend: 'writable', palLoad: 'writable', palOn: 'writable', palShown: 'writable',
  palTeam: 'writable', palToggle: 'writable', palWork: 'writable', palXp: 'writable',
  palXpNeed: 'writable', pals: 'writable', pathD: 'writable', pdmToggle: 'writable',
  pfO: 'writable', pfTab: 'writable', pit: 'writable', pl: 'writable',
  plBallMat: 'writable', plBurst: 'writable', plDeath: 'writable', plIcon: 'writable',
  plIconSrc: 'writable', plPlace: 'writable', plWind: 'writable', plv: 'writable',
  pname: 'writable', pwSw: 'writable', pwUp: 'writable', res: 'writable',
  respawnB: 'writable', rn: 'writable', rocks: 'writable', rs: 'writable',
  save: 'writable', sc: 'writable', selP: 'writable', shrooms: 'writable',
  spawn: 'writable', spawnWild: 'writable', spdF: 'writable', st: 'writable',
  started: 'writable', sun: 'writable', trees: 'writable', wCatch: 'writable',
  wPalLv: 'writable', wXp: 'writable', wild: 'writable', xp: 'writable',
  xpN: 'writable', zsc: 'writable',
};

export default [
  {
    ignores: ['site/three.min.js', 'node_modules/'],
  },
  {
    files: ['site/src/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        THREE: 'writable',
        ...PROJECT_GLOBALS,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      /* Architektura gry: moduły deklarują i mutują wspólne globalne
         (kolejność ładowania z game.html gwarantuje poprawność). */
      'no-redeclare': 'off',
      'no-global-assign': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-cond-assign': 'off',
      'no-useless-escape': 'off',
    },
  },
];
