const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core = script.slice(0, script.indexOf('const $='));

function game(saved) {
  const storage = new Map(saved ? [['fitquest-save', JSON.stringify(saved)]] : []);
  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    alert: message => { throw new Error(message); },
    render: () => {},
  });
  vm.runInContext(core, context);
  return {
    run: code => vm.runInContext(code, context),
    saved: () => JSON.parse(storage.get('fitquest-save')),
  };
}

test('navigation starts in adventure and selects one accessible tab', () => {
  const sections = ['adventure', 'character', 'store', 'achievements', 'packs', 'battle', 'dungeons'];
  assert.deepEqual([...html.matchAll(/data-section="([^"]+)"/g)].map(match => match[1]), sections);
  assert.match(html, /id="tab-adventure"[^>]*aria-selected="true"/);
  assert.match(html, /<section id="adventure" role="tabpanel" aria-labelledby="tab-adventure">/);
  const panels = Object.fromEntries(sections.map(id => [id, { hidden: id !== 'adventure' }]));
  const element = dataset => ({
    dataset, attributes: {}, handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { focused = this; },
  });
  let focused;
  const tabs = sections.map(section => element({ section }));
  const context = vm.createContext({
    document: {
      querySelectorAll: selector => {
        assert.equal(selector, '.navigation [role="tab"]');
        return tabs;
      },
    },
    $: id => panels[id],
    render: () => {},
  });
  vm.runInContext(
    script.slice(script.indexOf('const navigationButtons='), script.indexOf('function animateHit(')) +
    script.slice(script.indexOf('for(const button of navigationButtons){', script.indexOf('function journeyMarkup(')), script.indexOf('function render(liveOnly=')),
    context,
  );
  for (const selectedTab of tabs) {
    selectedTab.handlers.click();
    for (const tab of tabs) {
      const selected = tab === selectedTab;
      assert.equal(tab.attributes['aria-selected'], String(selected));
      assert.equal(tab.tabIndex, selected ? 0 : -1);
      assert.equal(panels[tab.dataset.section].hidden, !selected);
    }
  }
  let prevented = false;
  tabs[0].handlers.keydown({ key: 'End', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(focused, tabs.at(-1));
  assert.equal(panels.dungeons.hidden, false);
  tabs.at(-1).handlers.keydown({ key: 'Home', preventDefault() {} });
  assert.equal(focused, tabs[0]);
  assert.equal(panels.adventure.hidden, false);
});

test('migrates existing saves without changing equipment or progress', () => {
  const old = {
    level: 5, xp: 20, coins: 77, owned: ['sword_0_0'],
    eq: { sword: 'sword_0_0' }, streak: 1, kills: 2,
    done: { squat: 5 }, bonus: {}, monsterHp: 40, log: [],
    active: ['squat', 'push', 'plank'], completedToday: 0,
  };
  const g = game(old);
  g.run('unlockAchievements(); save()');
  const saved = g.saved();
  assert.equal(saved.coins, 77);
  assert.equal(saved.eq.sword, 'sword_0_0');
  assert.equal(saved.done.squat, 5);
  assert.equal(saved.missionKills, 2);
  assert.ok(Math.abs(saved.monsterHp / 56 - 40 / 72) < 1e-10);
  assert.ok(Math.abs(saved.xp / 276 - 20 / 244) < .005);
  assert.equal(saved.autoKills, 0);
  assert.equal(saved.autoMonsterHp, 50);
  assert.equal(saved.totalMissions, 0);
  assert.deepEqual(saved.attributes,{dmg:0,xp:0,coin:0});
  assert.ok(saved.achievements.includes('kill1'));
  assert.ok(saved.achievements.includes('level5'));
});

test('attribute training validates type and cost and continues past the old cap', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=99;
    if(trainAttribute('dmg') || trainAttribute('toString')) return false;
    S.coins=100;
    if(!trainAttribute('dmg') || S.coins!==0 || bonus('dmg')!==1.01)return false;
    S.coins=100000;
    for(let i=1;i<20;i++) if(!trainAttribute('dmg'))return false;
    const remaining=S.coins;
    if(!trainAttribute('dmg') || S.coins!==remaining-1100 || S.attributes.dmg!==21) return false;
    save(); return true;
  })()`),true);
  const saved=g.saved();
  const reloaded=game(saved);
  assert.equal(reloaded.run('S.attributes.dmg'),21);
  assert.equal(reloaded.run("bonus('dmg')"),1.21);
});

test('stat breakdown matches gameplay bonuses from training, equipment and achievements', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.attributes.dmg=21; S.owned=['sword_0_0']; S.upgrades.sword_0_0=6;
    placeItem('sword_0_0','sword'); S.achievements=['kill1'];
    const b=statBreakdown('dmg');
    return b.attributes===21 && b.equipment===itemPercent(ITEM.sword_0_0) &&
      b.achievements===2 && b.total===b.attributes+b.equipment+b.achievements &&
      bonus('dmg')===1+b.total/100;
  })()`),true);
});

test('character inventory marks equipped items and keeps compact filterable layout', () => {
  assert.match(html, /class="inventory-summary"><p id="materials"><\/p><small>/);
  assert.match(html, /#inventory\{display:grid;grid-template-columns:repeat\(auto-fill/);
  assert.match(script, /row\.className=worn\?'inventory-item is-equipped':'inventory-item'/);
  assert.match(script, /class="equipped-badge">✓ Equipado/);
  assert.match(script, /b\.className=it\?'slot is-equipped':'slot'/);
});

test('equipped inventory items sort first without changing the saved order', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.owned=['shield_0_0','sword_0_0','helmet_0_0','ring_0_0'];
    S.eq={sword:'sword_0_0',helmet:'helmet_0_0'};
    return JSON.stringify(inventoryEquippedFirst(S.owned))===JSON.stringify(['sword_0_0','helmet_0_0','shield_0_0','ring_0_0']) &&
      S.owned[0]==='shield_0_0' &&
      inventoryEquippedFirst(['shield_0_0','helmet_0_0'])[0]==='helmet_0_0';
  })()`),true);
});

test('hero appearance tiers follow total damage power and can decrease', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); if(heroPowerTier()!==0)return false;
    S.attributes.dmg=19; if(heroPowerTier()!==0)return false;
    S.achievements=['kill1']; if(heroPowerTier()!==1)return false;
    S.attributes.dmg=58; if(heroPowerTier()!==2)return false;
    S.attributes.dmg=118; if(heroPowerTier()!==3)return false;
    S.attributes.dmg=0; return heroPowerTier()===0;
  })()`),true);
});

test('training improves autobattle and dungeon damage without changing mission targets', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=100; S.battleUpdated=1000;
    const targetBefore=missionTarget(byId(S.active[0]));
    if(!trainAttribute('dmg'))return false;
    settleBattle(11000);
    if(Math.abs(S.autoMonsterHp-47.98)>1e-8)return false;
    if(!startDungeon('crypt'))return false;
    attackDungeon();
    return Math.abs(S.dungeonRun.hp-23.88)<1e-8 &&
      missionTarget(byId(S.active[0]))===targetBefore;
  })()`),true);
});

test('mission estimate includes partial progress and reduced rewards', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.active=['squat','push','plank','abs','jack','lunge']; S.done.squat=15;
    let p=missionEstimate(byId('squat'));
    if(p.damage!==5 || p.xp!==35 || p.coins!==10)return false;
    S.completedToday=6; p=missionEstimate(byId('squat'));
    return p.damage===1.25 && p.xp===9 && p.coins===3;
  })()`),true);
});

test('six mission slots have distinct targets and matching preview and rewards', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const results=[];
    for(const index of [0,2,4]){
      S=fresh(); S.active=['push','plank','abs','jack','lunge','burpee'];
      S.active[index]='squat'; S.battleUpdated=Date.now(); S.monsterHp=500;
      const ex=byId('squat'), difficulty=missionDifficulty(ex), goal=missionTarget(ex), preview=missionEstimate(ex);
      completeMission(ex);
      if(Math.abs(S.monsterHp-(500-preview.damage))>1e-8 || S.coins!==preview.coins || S.xp!==preview.xp)return false;
      if(missionDifficulty(byId(S.active[index]))!==difficulty || S.active.length!==6)return false;
      results.push([difficulty,goal,preview.damage,preview.xp,preview.coins]);
    }
    return JSON.stringify(results)===JSON.stringify([
      ['easy',20,20,50,10],['normal',25,31.25,69,13],['hard',30,45,90,15]
    ]);
  })()`),true);
});

test('difficulty multiplies remaining exercise rewards after daily reduction', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.active=['push','plank','abs','jack','squat','burpee'];
    S.completedToday=6; S.done.squat=10; S.battleUpdated=Date.now(); S.monsterHp=500;
    const ex=byId('squat'), preview=missionEstimate(ex);
    if(preview.damage!==7.5 || preview.xp!==19 || preview.coins!==4)return false;
    completeMission(ex);
    return S.monsterHp===500-preview.damage && S.xp===preview.xp && S.coins===preview.coins;
  })()`),true);
});

test('mission rewards show XP without approximation mark and gold in G', () => {
  assert.ok(script.includes('${preview.xp}</span> XP'));
  assert.ok(script.includes('${preview.coins}</span> G'));
  assert.ok(!script.includes('~${preview.xp}'));
});

test('old missions are retained and six unique slots survive reload', () => {
  const first=game();
  first.run(`S=fresh(); S.active=['squat','push','plank']; S.done.squat=5;
    S.targets.squat=20; S.coins=21; delete S.missionDifficultyVersion; delete S.legacyMissions; save()`);
  const migrated=game(first.saved());
  assert.deepEqual(Array.from(migrated.run('S.active.slice(0,3)')),['squat','push','plank']);
  assert.equal(migrated.run('S.active.length'),6);
  assert.equal(migrated.run('new Set(S.active).size'),6);
  assert.equal(migrated.run("missionDifficulty(byId('plank'))"),'legacy');
  assert.equal(migrated.run("missionTarget(byId('squat'))"),20);
  assert.equal(migrated.run('S.done.squat'),5);
  assert.equal(migrated.run('S.coins'),21);
  migrated.run('save()');
  const reloaded=game(migrated.saved());
  assert.deepEqual(reloaded.saved().active,migrated.saved().active);
  assert.equal(reloaded.run("missionDifficulty(byId('plank'))"),'legacy');
  reloaded.run("S.battleUpdated=Date.now(); completeMission(byId('plank'))");
  assert.equal(reloaded.run('S.active.length'),6);
  assert.equal(reloaded.run('missionDifficulty(byId(S.active[2]))'),'normal');
});

test('active mission targets and partial progress persist across day changes', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); const ex=byId(S.active[4]), original=missionTarget(ex);
    S.done[ex.id]=1; S.level=30; S.day='2000-01-01'; S.completedToday=6;
    rollDay(); save();
    return S.completedToday===0 && S.done[ex.id]===1 && missionTarget(ex)===original;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run('S.done[S.active[4]]'),1);
  assert.equal(restored.run('S.targets[S.active[4]]'),g.run('S.targets[S.active[4]]'));
});

test('mission board omits guidance text and weekly rest control', () => {
  const board = html.match(/<h2>📜 Tablón de encargos[\s\S]*?<\/div>\s*<div class="card" id="journey">/)[0];
  assert.doesNotMatch(board, /Reglas y bienestar|Elige una misión/);
  assert.doesNotMatch(html, /Tu ejercicio real es el daño/);
  assert.doesNotMatch(html, /id="rest"|\$\('rest'\)/);
});

test('mission board omits manual changes and the visible activity log', () => {
  assert.doesNotMatch(html, /id="log"|<h2>Registro<\/h2>|\$\('log'\)|Cambiar misión/);
  assert.match(html, /id="mission-status"[^>]*role="status"/);
  assert.match(script, /const next=randomMission\(S\.active\)/);
});

test('journey places milestones under chapter progress and reset at the bottom', () => {
  assert.match(html, /id="journey">[\s\S]*?id="weekly-progress"><\/div>\s*<div class="reset-footer"><button id="reset"[^>]*>Reiniciar partida<\/button><\/div>\s*<\/div>\s*<\/section>/);
  assert.equal((html.match(/id="reset"/g) || []).length, 1);
  assert.match(script, /class="chapter-progress"><h3>[\s\S]*?class="bar mis"[\s\S]*?class="milestones"/);
});

test('all mission creatures have full-body artwork and a mapped biome', () => {
  const species = script.slice(script.indexOf('const MISSION_MONSTERS ='), script.indexOf('const ENCOUNTER_TYPES ='));
  const artwork = script.slice(script.indexOf('function missionMonsterArt('), script.indexOf('function heroArt('));
  const context = vm.createContext({});
  vm.runInContext(species + artwork, context);
  const result = vm.runInContext(`(() => {
    const biomes=new Set(), bodies=new Set();
    for(let i=0;i<MISSION_MONSTERS.length;i++){
      const e={kind:'normal',species:i};
      const svg=missionMonsterArt(e);
      if(svg.includes('undefined') || !svg.includes('class="creature-body"')) return false;
      bodies.add(svg); biomes.add(encounterBiome(e));
    }
    return bodies.size===16 && biomes.size===5 &&
      encounterBiome({kind:'lucky',species:0})==='forest' &&
      encounterBiome({kind:'event',species:0})==='void' &&
      !missionMonsterArt({kind:'lucky',species:0}).includes('undefined');
  })()`, context);
  assert.equal(result,true);
  assert.match(html, /<title>FitQuest<\/title>/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
  assert.doesNotMatch(html, /class="game-header"/);
  assert.match(html, /data-kind="boss"\] \.boss-flames\{display:block\}/);
});

test('previously recorded rest still protects streak during migration', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); const now=new Date();
    const yesterday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
    const twoDaysAgo=new Date(now.getFullYear(),now.getMonth(),now.getDate()-2);
    const date=d=>\`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,'0')}-\${String(d.getDate()).padStart(2,'0')}\`;
    S.day=date(yesterday); S.lastRest=date(yesterday); S.lastActive=date(twoDaysAgo); S.streak=3;
    rollDay(); return S.streak===3;
  })()`),true);
});

test('mission damage preview and actual damage include all character modifiers', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.active=['squat','push','plank']; S.done.squat=15;
    S.eq={sword:'sword_3_0'}; S.attributes.dmg=10; S.achievements=['mission10'];
    S.streak=5; S.battleUpdated=Date.now();
    const preview=missionEstimate(byId('squat'));
    const expected=5*bonus('dmg')*streakMult();
    if(Math.abs(preview.damage-expected)>1e-8 || expected<=5)return false;
    completeMission(byId('squat'));
    return Math.abs(S.monsterHp-(50-expected))<1e-8;
  })()`),true);
});

test('encounter selection gives scheduled elite and boss and bounded random events', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    Math.random=()=>0;
    const goblin=nextEncounter(1),elite=nextEncounter(5),boss=nextEncounter(10);
    if(goblin.kind!=='lucky' || elite.kind!=='elite' || boss.kind!=='boss')return false;
    if(goblin.maxHp!==Math.round(missionMonsterHp(1)*.8))return false;
    Math.random=()=>.07;
    const event=nextEncounter(1);
    if(event.kind!=='event')return false;
    Math.random=()=>.5;
    const normal=nextEncounter(1);
    return normal.kind==='normal' && normal.maxHp===Math.round(missionMonsterHp(1)*MISSION_MONSTERS[normal.species].hp);
  })()`),true);
});

test('special rewards and overflow damage use the defeated and next encounters', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.missionKills=4; S.kills=4;
    S.encounter={kind:'lucky',species:0,maxHp:40}; S.monsterHp=3;
    Math.random=()=>0; hit(5);
    const elite=S.encounter;
    return S.missionKills===5 && S.kills===5 && S.coins===90 && S.xp===48 &&
      S.materials===3 && elite.kind==='elite' && S.monsterHp===elite.maxHp-2;
  })()`),true);
});

test('new encounter persists on reload and legacy migration preserves current health', () => {
  const g=game();
  g.run(`S=fresh(); S.missionKills=9; S.encounter={kind:'event',species:8,maxHp:123}; S.monsterHp=37.5; save()`);
  const reloaded=game(g.saved());
  assert.deepEqual(reloaded.saved().encounter,{kind:'event',species:8,maxHp:123});
  assert.equal(reloaded.run('S.monsterHp'),37.5);
  const old=g.saved(); delete old.encounter;
  const migrated=game(old);
  assert.equal(migrated.run('S.monsterHp'),37.5);
  assert.equal(migrated.run('S.encounter.maxHp'),migrated.run('missionMonsterHp(9)'));
  assert.equal(migrated.run('S.encounter.species'),1);
});

test('migration settles only active legacy battle time on the original monster', () => {
  const base = {
    level:1, xp:0, coins:0, owned:[], eq:{}, streak:0, kills:0,
    done:{}, bonus:{}, monsterHp:50, log:[], active:['squat','push','plank'],
    completedToday:0, battleUpdated:Date.now()-20000,
  };
  const active = game({ ...base, autoBattle:true });
  const paused = game({ ...base, autoBattle:false });
  assert.equal(active.run('S.monsterHp'), 46);
  assert.equal(paused.run('S.monsterHp'), 50);
  assert.equal(active.run('S.autoMonsterHp'), 50);
  assert.equal(paused.run('S.autoMonsterHp'), 50);
});

test('offline progress is capped at eight hours without affecting mission monsters', () => {
  const g = game();
  const capped = JSON.parse(g.run(`(() => {
    const end=1000000000;
    function run(gap){ S=fresh(); S.battleUpdated=end-gap; settleBattle(end);
      return {kills:S.autoKills,hp:S.autoMonsterHp,coins:S.coins,xp:S.xp}; }
    return JSON.stringify([run(OFFLINE_LIMIT),run(OFFLINE_LIMIT*10)]);
  })()`));
  assert.deepEqual(capped[0], capped[1]);
  assert.equal(g.run(`(() => { S=fresh(); S.battleUpdated=100;
    settleBattle(100000); return S.monsterHp; })()`), 50);
});

test('battle keeps fractional intervals and achievements provide permanent bonuses', () => {
  const g = game();
  assert.equal(g.run(`(() => { S=fresh(); S.battleUpdated=1000;
    settleBattle(6000); settleBattle(11000); return S.autoMonsterHp; })()`), 48);
  assert.equal(g.run(`(() => { S=fresh(); S.kills=24; S.missionKills=24;
    S.monsterHp=1; hit(1); return S.achievements.includes('kill25') && bonus('xp')>1; })()`), true);
});

test('offline battle applies newly unlocked bonuses just like live ticks', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.kills=0; S.autoMonsterHp=1; S.battleUpdated=1000;
    settleBattle(101000);
    const offline=JSON.stringify([S.autoMonsterHp,S.coins,S.kills,S.xp,S.achievements]);
    S=fresh(); S.kills=0; S.autoMonsterHp=1; S.battleUpdated=1000;
    for(let i=1;i<=10;i++) settleBattle(1000+i*10000);
    return JSON.stringify([S.autoMonsterHp,S.coins,S.kills,S.xp,S.achievements])===offline;
  })()`), true);
});

test('missions remain unlimited and targets do not change mid-mission', () => {
  const g = game();
  assert.equal(g.run(`(() => { S=fresh(); S.completedToday=5;
    const ex=byId(S.active[0]), original=missionTarget(ex);
    S.level=30; if(missionTarget(ex)!==original) return false;
    S.done[ex.id]=original-1; completeMission(ex);
    const first=S.totalMissions;
    completeMission(byId(S.active[1]));
    return S.completedToday===7 && S.totalMissions===first+1 && S.active.length===6;
  })()`), true);
});

test('missions reward only the remaining legacy progress, once', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.active=['squat','push','plank']; S.done.squat=15;
    S.battleUpdated=Date.now(); completeMission(byId('squat'));
    return S.xp===35 && S.monsterHp===45 && S.autoMonsterHp===50 &&
      S.completedToday===1 && S.totalMissions===1;
  })()`), true);
});

test('missions beyond six remain playable with reduced rewards and do not roll more keys', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.active=['squat','push','plank']; S.completedToday=6;
    S.battleUpdated=Date.now(); Math.random=()=>0;
    completeMission(byId('squat'));
    return S.completedToday===7 && S.totalMissions===1 &&
      S.monsterHp===45 && S.coins===3 && S.keys===0 && S.keyPity===0;
  })()`), true);
});

test('legacy completed mission at former limit is replaced without duplicate reward', () => {
  const first=game();
  first.run(`S=fresh(); S.active=['squat','push','plank']; S.done.squat=20;
    S.bonus.squat=1; S.completedToday=6; S.coins=40;
    delete S.unlimitedMissionsVersion; save();`);
  const second=game(first.saved());
  assert.equal(second.run(`S.active.includes('squat')`),false);
  assert.equal(second.run('S.coins'),40);
  assert.equal(second.run('S.completedToday'),6);
});

test('only the first daily mission can roll a dungeon key', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.active=['squat','push','plank']; S.battleUpdated=Date.now();
    Math.random=()=>0; completeMission(byId('squat'));
    const keys=S.keys;
    for(let i=0;i<8;i++) completeMission(byId(S.active[0]));
    return keys===1 && S.keys===1 && S.keyPity===0 && S.completedToday===9;
  })()`),true);
});

test('arena applies equipment and achievements and earns shared rewards', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.eq={sword:'sword_3_0'}; S.achievements=['mission10'];
    S.autoMonsterHp=1; S.battleUpdated=1000;
    settleBattle(11000);
    return S.autoKills===1 && S.missionKills===0 && S.monsterHp===50 &&
      S.kills===1 && S.coins>0 && S.xp>0 && S.achievements.includes('kill1') &&
      S.autoMonsterHp < monsterHp(1) && bonus('dmg')>1;
  })()`), true);
});

test('arena loot and experience use equipment and achievement bonuses', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.eq={pants:'pants_3_0',shield:'shield_3_0'};
    S.achievements=['mission50','kill25'];
    S.autoMonsterHp=1; S.battleUpdated=1000; settleBattle(11000);
    return S.coins===12 && S.xp===24;
  })()`), true);
});

test('keys have a 3% chance, a 13-day guarantee and no surplus', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); Math.random=()=>0.03; awardKey(); if(S.keys!==0||S.keyPity!==1)return false;
    Math.random=()=>0.029; awardKey(); if(S.keys!==1||S.keyPity!==0)return false;
    Math.random=()=>1; for(let i=0;i<12;i++) awardKey();
    if(S.keys!==1||S.keyPity!==12)return false;
    awardKey(); if(S.keys!==2||S.keyPity!==0)return false;
    for(let i=0;i<200;i++) awardKey();
    return S.keys===DUNGEONS.length-1 && S.keyPity===0;
  })()`), true);
});

test('dungeons require a key and activity days and unlock permanently', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.keys=1; S.activeDays=29;
    if(unlockDungeon('forest') || S.keys!==1)return false;
    S.activeDays=30;
    if(!unlockDungeon('forest') || S.keys!==0 || !S.unlockedDungeons.includes('forest'))return false;
    if(unlockDungeon('forest'))return false;
    return startDungeon('forest') && !startDungeon('forest') && S.dungeonRun.id==='forest';
  })()`), true);
});

test('dungeon progress, victory rewards and daily limits persist independently', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.battleUpdated=Date.now(); const mission=S.monsterHp,auto=S.autoMonsterHp;
    if(!startDungeon('crypt'))return false;
    let attacks=0;
    while(S.dungeonRun && attacks++<30) attackDungeon();
    const snapshot=[S.dungeonClears,S.materials,S.kills,S.monsterHp,S.autoMonsterHp];
    if(JSON.stringify(snapshot)!==JSON.stringify([1,5,3,mission,auto]))return false;
    save();
    return !startDungeon('crypt') && !attackDungeon();
  })()`), true);
  const saved=g.saved();
  assert.equal(saved.dungeonRun, null);
  assert.equal(saved.materials, 5);
  assert.ok(saved.coins > 0 && saved.xp > 0);
});

test('equipment placement validates slots and dismantling only consumes unequipped owned items', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.owned=['sword_0_0','ring_3_0'];
    if(placeItem('sword_0_0','helmet') || placeItem('sword_3_0','sword'))return false;
    if(!placeItem('sword_0_0','sword') || dismantle('sword_0_0'))return false;
    if(!placeItem('ring_3_0','ring2') || placeItem('ring_3_0','ring1'))return false;
    delete S.eq.ring2;
    return dismantle('ring_3_0') && S.materials===25 &&
      !S.owned.includes('ring_3_0') && !dismantle('ring_3_0');
  })()`), true);
});

test('upgrades continue past five, consume fragments and are lost on dismantle', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.owned=['sword_0_0']; S.materials=100;
    if(!placeItem('sword_0_0','sword')) return false;
    const before=bonus('dmg');
    for(let i=0;i<5;i++) if(!upgradeItem('sword_0_0')) return false;
    if(S.materials!==45 || !upgradeItem('sword_0_0') || S.materials!==25 ||
      Math.abs(bonus('dmg')-before-.06)>1e-8) return false;
    save();
    if(dismantle('sword_0_0')) return false;
    delete S.eq.sword;
    return dismantle('sword_0_0') && S.upgrades.sword_0_0===undefined && S.materials===27;
  })()`),true);
  const reloaded=game(g.saved());
  assert.equal(reloaded.run("upgradeLevel('sword_0_0')"),6);
  assert.ok(Math.abs(reloaded.run("bonus('dmg')")-1.11)<1e-8);
});

test('new dungeon and material state survives reloading', () => {
  const first=game();
  first.run(`S=fresh(); S.keys=2; S.keyPity=12; S.materials=17;
    S.activeDays=30; S.unlockedDungeons.push('forest'); startDungeon('forest');
    attackDungeon(); save();`);
  const previous=first.saved();
  const second=game(previous);
  second.run('save()');
  const restored=second.saved();
  assert.equal(restored.keys,2);
  assert.equal(restored.keyPity,12);
  assert.equal(restored.materials,17);
  assert.equal(restored.activeDays,30);
  assert.deepEqual(restored.unlockedDungeons, ['crypt','forest']);
  assert.deepEqual(restored.dungeonRun, previous.dungeonRun);
});

test('multiple missions on the same day count as one activity day', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.battleUpdated=Date.now(); completeMission(byId(S.active[0]));
    completeMission(byId(S.active[0]));
    return S.totalMissions===2 && S.activeDays===1;
  })()`), true);
});

test('existing activity on migration day does not suppress new activity-day progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.lastActive=today(); S.battleUpdated=Date.now();
    completeMission(byId(S.active[0]));
    return S.activeDays===1 && S.lastActivityDay===today();
  })()`), true);
});

test('long-term milestones reward 365 non-consecutive activity days', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.activeDays=364; unlockAchievements();
    if(S.achievements.includes('days365'))return false;
    S.activeDays++; unlockAchievements();
    return S.achievements.includes('days365') && bonus('dmg')>=1.12;
  })()`), true);
});

test('365 simulated activity days produce the annual milestone and unlock all dungeons', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    const RealDate=Date; let clock=RealDate.UTC(2026,0,1,12);
    Date=class extends RealDate {
      constructor(...args){if(args.length) super(...args);else super(clock)}
      static now(){return clock}
    };
    Math.random=()=>0.999; S=fresh();
    for(let day=1;day<=365;day++){
      S.battleUpdated=clock;
      completeMission(byId(S.active[0]));
      for(const dungeon of DUNGEONS) if(dungeon.days<=S.activeDays) unlockDungeon(dungeon.id);
      clock+=86400000;
    }
    return S.activeDays===365 && S.totalMissions===365 &&
      S.unlockedDungeons.length===DUNGEONS.length && S.achievements.includes('days365');
  })()`), true);
});

test('three activity days a week for a year produce 52 chapters and enough keys', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const RealDate=Date; let clock=RealDate.UTC(2026,0,1,12);
    Date=class extends RealDate {
      constructor(...args){if(args.length) super(...args);else super(clock)}
      static now(){return clock}
    };
    Math.random=()=>0.999; S=fresh();
    let rewardChanges=0;
    for(let day=0;day<364;day++){
      if([0,2,4].includes(day%7)){
        S.battleUpdated=clock;
        const before=S.weeklyRewards;
        completeMission(byId(S.active[0]));
        if(S.weeklyRewards>before) rewardChanges++;
        for(const dungeon of DUNGEONS) if(dungeon.days<=S.activeDays) unlockDungeon(dungeon.id);
      }
      clock+=86400000;
    }
    return S.activeDays===156 && S.weeklyRewards===52 && rewardChanges===52 &&
      S.unlockedDungeons.length===DUNGEONS.length && S.materials>0;
  })()`),true);
});

test('journey migration catches up old activity days once and persists', () => {
  const first=game();
  first.run(`S=fresh(); S.activeDays=12; S.weeklyRewards=0; claimJourneyRewards(); save();`);
  const previous=first.saved();
  assert.equal(previous.weeklyRewards,4);
  const second=game(previous);
  second.run('claimJourneyRewards(); save()');
  assert.equal(second.saved().coins,previous.coins);
  assert.equal(second.saved().materials,previous.materials);
});

test('catalog retains old ids and provides distinct options in each tier', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    return ITEMS.length===128 && ITEM['ring_3_1'].name==='Anillo legendario' &&
      new Set(ITEMS.map(it=>it.id)).size===ITEMS.length &&
      [0,1,2,3].every(t=>ITEMS.filter(it=>it.tier===t).length===32);
  })()`),true);
});
