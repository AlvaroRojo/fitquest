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

test('attribute training validates type, cost and cap and preserves stats on reload', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=99;
    if(trainAttribute('dmg') || trainAttribute('toString')) return false;
    S.coins=100;
    if(!trainAttribute('dmg') || S.coins!==0 || bonus('dmg')!==1.01)return false;
    S.coins=100000;
    for(let i=1;i<20;i++) if(!trainAttribute('dmg'))return false;
    const remaining=S.coins;
    if(trainAttribute('dmg') || S.coins!==remaining || S.attributes.dmg!==20) return false;
    save(); return true;
  })()`),true);
  const saved=g.saved();
  const reloaded=game(saved);
  assert.equal(reloaded.run('S.attributes.dmg'),20);
  assert.equal(reloaded.run("bonus('dmg')"),1.2);
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
    S=fresh(); S.done.squat=15;
    let p=missionEstimate(byId('squat'));
    if(p.damage!==5 || p.xp!==35 || p.coins!==10)return false;
    S.completedToday=6; p=missionEstimate(byId('squat'));
    return p.damage===1.25 && p.xp===9 && p.coins===3;
  })()`),true);
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
    return S.completedToday===7 && S.totalMissions===first+1 && S.active.length===3;
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

test('upgrades consume fragments, apply to equipped stats, cap at five and are lost on dismantle', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.owned=['sword_0_0']; S.materials=100;
    if(!placeItem('sword_0_0','sword')) return false;
    const before=bonus('dmg');
    for(let i=0;i<5;i++) if(!upgradeItem('sword_0_0')) return false;
    if(S.materials!==45 || upgradeItem('sword_0_0') || Math.abs(bonus('dmg')-before-.05)>1e-8) return false;
    if(dismantle('sword_0_0')) return false;
    delete S.eq.sword;
    return dismantle('sword_0_0') && S.upgrades.sword_0_0===undefined && S.materials===47;
  })()`),true);
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
