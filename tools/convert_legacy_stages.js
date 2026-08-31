#!/usr/bin/env node
'use strict';

// waves.js의 검증된 레거시 타임라인을 Stage JSON v1 초안으로 옮긴다.
// Stage 1~3은 수작업 스테이지 재구성이 시작되어 이 도구가 덮어쓰지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const wavesSource = fs.readFileSync(path.join(root, 'js/waves.js'), 'utf8');
const context = vm.createContext({ console, Math });
for (const name of ['Boss', 'BossMongsil', 'BossSsing', 'BossChorong', 'BossBuu', 'BossUreu', 'BossHwii']) {
  context[name] = function BossStub() {};
}
vm.runInContext(`${wavesSource}\nglobalThis.__legacyStages = [
  STAGE1_TIMELINE, STAGE2_TIMELINE, STAGE3_TIMELINE, STAGE4_TIMELINE,
  STAGE5_TIMELINE, STAGE6_TIMELINE, STAGE7_TIMELINE,
];`, context, { filename: 'js/waves.js' });

const META = {
  stage1: { name: '산호 초입', seed: 1001, boss: 'pangpang', bossName: '팡팡', sections: ['도입', '압박', '혼합과 파밍'] },
  stage4: { name: '심해 협곡', seed: 4004, boss: 'chorong', bossName: '초롱', dark: 0.86, sections: ['어둠 적응', '협곡 깊이', '심해 러시'] },
  stage5: { name: '난파선 묘지', seed: 5005, boss: 'buu', bossName: '부우', dark: 0.3, sections: ['잔해 사이로', '유령의 시간', '좁아지는 묘지'] },
  stage6: { name: '폭풍 수면', seed: 6006, boss: 'ureu', bossName: '우르릉', storm: 1, sections: ['바람이 분다', '폭풍 속으로', '뇌우'] },
  stage7: { name: '용궁 앞바다', seed: 7007, boss: 'hwii', bossName: '휘이', storm: 0.55, sections: ['여명', '총력', '문 앞'] },
};

const KIND_NAMES = {
  fish: '물고기', jelly: '해파리', ray: '가오리', turret: '산호 포대',
  lantern: '등불해파리', viper: '독니고기', ghost: '유령 물고기', big: '대물',
};
const MOVEMENT = { 1: 'straight', 2: 'sine', 3: 'enter-pause-exit', 4: 'u-turn', 5: 'tracking', 6: 'turret-scroll', 7: 'current-surf' };
const WEAPON = { 0: 'none', 1: 'legacy-aimed', 2: 'legacy-ring', 3: 'legacy-drop', 4: 'legacy-mine', 5: 'legacy-death-shot' };
const ENTRY = { 1: 'right-to-left', 2: 'top-to-bottom', 3: 'bottom-to-top', 4: 'diagonal', 5: 'left-to-right' };
const FORMATION = { 1: 'single', 2: 'column', 3: 'v', 4: 'wall-gap', 5: 'surround-ring', 6: 'column' };

function addDependency(dependencies, category, id) {
  if (id && !dependencies[category].includes(id)) dependencies[category].push(id);
}

function environmentItems(stageId, meta, duration, dependencies) {
  const items = [{
    id: `${stageId.replace('stage', 's')}-scroll-base`, type: 'environment', name: '기본 스크롤',
    timing: { domain: 'time', start: 0, duration },
    payload: { pluginId: 'scroll-speed', params: { curve: [{ at: 0, value: 1 }, { at: duration, value: 1 }] } },
  }];
  addDependency(dependencies, 'itemPlugins', 'scroll-speed');
  if (meta.dark) {
    items.push({
      id: `${stageId.replace('stage', 's')}-darkness`, type: 'environment', name: '수중 암전',
      timing: { domain: 'time', start: 0, duration },
      payload: { pluginId: 'darkness', params: { target: meta.dark, responseRate: 1.2 } },
    });
    addDependency(dependencies, 'itemPlugins', 'darkness');
  }
  if (meta.storm) {
    items.push({
      id: `${stageId.replace('stage', 's')}-storm`, type: 'environment', name: '폭풍 해류',
      timing: { domain: 'time', start: 0, duration },
      payload: {
        pluginId: 'storm-current',
        params: {
          scale: meta.storm, surfaceBoundaryY: 58, drawSurfaceWaves: true, drawCurrentIndicator: true,
          current: { xAmplitude: 70, xAngularFrequency: 0.45, yAmplitude: 26, yAngularFrequency: 0.85 },
          influence: {
            player: { x: 1, y: 1 }, pointerTarget: { x: 0.6, y: 0.6 },
            enemyProjectile: { x: 0.75, y: 0.6 }, currentSurfEnemy: { x: 1.4, y: 0.6 },
          },
        },
      },
    });
    addDependency(dependencies, 'itemPlugins', 'storm-current');
  }
  return items;
}

function waveItem(stageNumber, waveIndex, source, dependencies) {
  const prefix = `s${stageNumber}-w${String(waveIndex).padStart(3, '0')}`;
  const entryId = ENTRY[source.D ?? 1] || 'right-to-left';
  const formationId = FORMATION[source.F ?? 1] || 'single';
  const movementId = MOVEMENT[source.M ?? 1] || 'straight';
  const weaponId = WEAPON[source.S ?? 0] || 'none';
  addDependency(dependencies, 'enemyKinds', source.kind);
  addDependency(dependencies, 'entryPresets', entryId);
  addDependency(dependencies, 'formationPresets', formationId);
  addDependency(dependencies, 'movementPresets', movementId);
  addDependency(dependencies, 'weaponPresets', weaponId);

  const count = Math.max(1, Number(source.n) || 1);
  const interval = ['v', 'wall-gap', 'surround-ring'].includes(formationId) ? 0 : Math.max(0, Number(source.gap) || 0);
  const entry = { presetId: entryId, x: source.x ?? (entryId === 'diagonal' ? 0.75 : 0.5), y: source.y ?? 0.5 };
  if (entryId === 'diagonal') entry.params = { vertical: source.dir === 'up' ? 'up' : 'down' };
  const formation = { presetId: formationId };
  if (formationId === 'wall-gap') {
    formation.params = {
      slotCount: count + 1, gapSlots: 2, gapStartRange: [1, Math.max(1, count - 2)],
      topPadding: 40, bottomPadding: 20,
    };
  } else if (formationId === 'surround-ring') {
    formation.params = { radius: source.radius ?? 300, angleJitter: 0.25 };
  }
  const movement = { presetId: movementId };
  if (movementId === 'sine' || movementId === 'current-surf') {
    movement.params = { amplitude: source.amp ?? 0, frequency: source.freq ?? 3 };
  } else if (movementId === 'enter-pause-exit') {
    movement.params = { targetX: source.targetX ?? 0.68, pauseDuration: source.pauseDur ?? 2.2 };
  }
  const weapon = { presetId: weaponId };
  if (source.fireInt !== undefined) weapon.interval = source.fireInt;
  if (weaponId === 'legacy-ring') weapon.params = { count: source.ringN ?? 8 };

  return {
    id: prefix,
    type: 'wave',
    name: `${KIND_NAMES[source.kind] || source.kind} 웨이브 ${String(waveIndex).padStart(2, '0')}`,
    timing: { domain: 'time', start: source.t, duration: (count - 1) * interval },
    payload: {
      enemy: { kind: source.kind, hp: source.hp, speed: source.spd },
      spawn: { count, interval }, entry, formation, movement, weapon,
    },
  };
}

function wreckItem(stageNumber, index, source, dependencies) {
  addDependency(dependencies, 'itemPlugins', 'wreck-corridor');
  const side = source.side === 'top' ? 'top' : 'bottom';
  return {
    id: `s${stageNumber}-wreck-${String(index).padStart(2, '0')}`,
    type: 'hazard', name: `${side === 'top' ? '상단' : '하단'} 난파선 ${Math.round((source.frac ?? 0.4) * 100)}%`,
    timing: { domain: 'time', start: source.t, duration: +(1100 / source.spd).toFixed(3) },
    payload: { pluginId: 'wreck-corridor', params: {
      side, heightFraction: source.frac ?? 0.4, speed: source.spd, width: 74, indestructible: true,
    } },
  };
}

function boltItem(stageNumber, index, source, dependencies) {
  addDependency(dependencies, 'itemPlugins', 'lightning-strike');
  return {
    id: `s${stageNumber}-bolt-${String(index).padStart(2, '0')}`,
    type: 'hazard', name: `물속 번개 ${String(index).padStart(2, '0')}`,
    timing: { domain: 'time', start: source.t, duration: 1.3 },
    payload: { pluginId: 'lightning-strike', params: {
      xRatio: source.bolt, width: 46, telegraphDuration: 0.9, strikeDuration: 0.4,
    } },
  };
}

function convert(stageNumber, timeline) {
  const stageId = `stage${stageNumber}`;
  const meta = META[stageId];
  const bossAt = timeline.find(item => item.boss).t;
  const warningAt = timeline.find(item => item.warning).t;
  const dependencies = {
    enemyKinds: [], entryPresets: [], formationPresets: [], movementPresets: [], weaponPresets: [],
    barragePatterns: [], itemPlugins: [], terrainObjects: [], terrainProfiles: [], bosses: [meta.boss],
  };
  const items = environmentItems(stageId, meta, bossAt, dependencies);
  let waveIndex = 0;
  let wreckIndex = 0;
  let boltIndex = 0;
  for (const source of timeline) {
    if (source.kind === 'wreck') items.push(wreckItem(stageNumber, ++wreckIndex, source, dependencies));
    else if (source.kind) items.push(waveItem(stageNumber, ++waveIndex, source, dependencies));
    else if (source.bolt !== undefined) items.push(boltItem(stageNumber, ++boltIndex, source, dependencies));
  }
  addDependency(dependencies, 'itemPlugins', 'boss-warning');
  addDependency(dependencies, 'itemPlugins', 'boss-start');
  items.push({
    id: `s${stageNumber}-boss-warning`, type: 'cue', name: '보스 경고',
    timing: { domain: 'time', start: warningAt, duration: bossAt - warningAt },
    payload: { pluginId: 'boss-warning', params: {
      message: '!! 뭔가 다가온다 !!', color: '#ff8f8f', screenShake: 0.6, soundId: 'warn',
    } },
  });
  items.push({
    id: `s${stageNumber}-boss-start`, type: 'boss', name: `${meta.bossName} 등장`,
    timing: { domain: 'time', start: bossAt, duration: 0 },
    payload: { pluginId: 'boss-start', bossId: meta.boss },
  });
  const sectionStarts = [0, 35, 76, warningAt];
  const sectionEnds = [35, 76, warningAt, bossAt];
  const sectionNames = [...meta.sections, '보스 진입'];
  return {
    format: 'pixel-wave-stage', schemaVersion: 1, registryVersion: 1, draft: true,
    id: stageId, name: meta.name, seed: meta.seed,
    timeline: { duration: bossAt, endBehavior: 'boss-start' },
    viewport: { width: 960, height: 540 },
    background: { presetId: stageId, baseScrollSpeed: 45, scrollScale: 1 },
    difficultyProfileId: 'legacy-diffs-v1',
    sections: sectionStarts.map((start, index) => ({
      id: index === 3 ? 'boss-entry' : `act-${index + 1}`,
      name: sectionNames[index], start, end: sectionEnds[index],
    })),
    dependencies,
    items,
  };
}

for (const stageNumber of [4, 5, 6, 7]) {
  const output = path.join(root, 'docs/stage-editor', `stage${stageNumber}.v1.draft.json`);
  fs.writeFileSync(output, `${JSON.stringify(convert(stageNumber, context.__legacyStages[stageNumber - 1]), null, 2)}\n`, 'utf8');
  console.log(path.relative(root, output));
}
