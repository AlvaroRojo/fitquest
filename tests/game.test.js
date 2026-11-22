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
  const sections = ['adventure', 'character', 'statistics', 'paragon', 'store', 'achievements', 'packs', 'battle', 'dungeons', 'torment'];
  assert.deepEqual([...html.matchAll(/data-section="([^"]+)"/g)].map(match => match[1]), sections);
  assert.match(html, /data-section="adventure"[^>]*>📜 Misiones<\/button>/);
  assert.match(html, /id="tab-adventure"[^>]*aria-selected="true"/);
  assert.match(html, /<section id="adventure" role="tabpanel" aria-labelledby="tab-adventure">/);
  const panels = Object.fromEntries([...sections,'skills','passives','prestige'].map(id => [id, { hidden: !['adventure','skills'].includes(id) }]));
  panels['prestige-scroll']={dataset:{},scrollWidth:900,clientWidth:300,scrollHeight:900,clientHeight:300};
  const element = dataset => ({
    dataset, attributes: {}, handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { focused = this; },
  });
  let focused;
  const tabs = sections.map(section => element({ section }));
  const paragonTabs = ['skills','passives','prestige'].map(paragon => element({ paragon }));
  const context = vm.createContext({
    document: {
      querySelectorAll: selector => {
        if(selector==='.navigation [role="tab"]') return tabs;
        assert.equal(selector, '.paragon-tabs [role="tab"]');
        return paragonTabs;
      },
    },
    $: id => panels[id],
    render: () => {},
    renderPrestige: () => {},
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
  assert.equal(panels.torment.hidden, false);
  tabs.at(-1).handlers.keydown({ key: 'Home', preventDefault() {} });
  assert.equal(focused, tabs[0]);
  assert.equal(panels.adventure.hidden, false);
  for(const selectedTab of paragonTabs){
    selectedTab.handlers.click();
    for(const tab of paragonTabs){
      assert.equal(tab.attributes['aria-selected'],String(tab===selectedTab));
      assert.equal(panels[tab.dataset.paragon].hidden,tab!==selectedTab);
    }
  }
  paragonTabs[2].handlers.keydown({key:'Home',preventDefault(){}});
  assert.equal(focused,paragonTabs[0]);
  assert.equal(panels.skills.hidden,false);
});

test('hero status animates actual gains without animating initial or unchanged values', () => {
  const g=game();
  g.run(`const elements=Object.fromEntries(['hero-status','lvl','coins','streak','xpbar','xp-progress','xptxt'].map(id=>[id,{
    textContent:'',style:{},attributes:{},offsetWidth:1,
    classList:{values:new Set(),add(name){this.values.add(name)},remove(name){this.values.delete(name)}},
    setAttribute(name,value){this.attributes[name]=value}
  }]));const $=id=>elements[id];S=fresh();`);
  g.run(script.slice(script.indexOf('let previousStatus=null;'),script.indexOf('function render(liveOnly=')));
  assert.equal(g.run(`(() => {
    renderStatus();
    if(elements['lvl'].classList.values.size || elements['coins'].classList.values.size ||
       elements['xp-progress'].attributes['aria-valuenow']!=='0') return false;
    S.xp=50;S.coins=4;S.streak=1;renderStatus();
    if(!elements['coins'].classList.values.has('status-gain') ||
       !elements['streak'].classList.values.has('status-gain') ||
       !elements['xptxt'].classList.values.has('status-gain') ||
       elements['xp-progress'].attributes['aria-valuetext']!=='50 de 100 XP') return false;
    for(const element of Object.values(elements)) element.classList.values.clear();
    renderStatus();
    if(Object.values(elements).some(element=>element.classList.values.size)) return false;
    S.level=2;S.xp=0;renderStatus();
    if(!elements['hero-status'].classList.values.has('level-up') || !elements['lvl'].classList.values.has('status-gain')) return false;
    for(const element of Object.values(elements)) element.classList.values.clear();
    S=fresh();renderStatus();
    return !Object.values(elements).some(element=>element.classList.values.size);
  })()`),true);
});

test('migrates existing saves without changing equipment or progress', () => {
  const old = {
    level: 5, xp: 20, coins: 77, owned: ['sword_0_0'],
    eq: { sword: 'sword_0_0' }, streak: 1, kills: 2,
    done: { squat: 5 }, bonus: {}, monsterHp: 40, log: [],
    active: ['squat', 'push', 'plank'], completedToday: 0,
  };
  const g = game(old);
  g.run('save()');
  const saved = g.saved();
  assert.equal(saved.coins, 77);
  assert.equal(saved.eq.sword, 'sword_0_0');
  assert.equal(saved.done.squat, 5);
  assert.equal(saved.missionKills, 2);
  assert.ok(Math.abs(saved.monsterHp / 56 - 40 / 72) < 1e-10);
  assert.ok(Math.abs(saved.xp / g.run('xpNeeded(5)') - 20 / 244) < .005);
  assert.equal(saved.autoKills, 0);
  assert.equal(saved.autoMonsterHp, 50);
  assert.equal(saved.totalMissions, 0);
  assert.deepEqual(saved.attributes,{dmg:0,xp:0,coin:0});
  g.run('unlockAchievements(); save()');
  assert.ok(g.saved().achievements.includes('kill1'));
  assert.ok(g.saved().achievements.includes('level5'));
  assert.ok(g.saved().coins > saved.coins);
});

test('attribute training validates type and cost and continues past the old cap', () => {
  const g=game();
  g.run(`for(let i=ACHIEVEMENTS.length-1;i>=0;i--) if(ACHIEVEMENTS[i].id.startsWith('hero-attributes-')) ACHIEVEMENTS.splice(i,1)`);
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=99;
    if(trainAttribute('dmg') || trainAttribute('toString')) return false;
    S.coins=100;
    if(!trainAttribute('dmg') || S.coins!==0 || bonus('dmg')!==1.01)return false;
    S.coins=100000;
    for(let i=1;i<20;i++) if(!trainAttribute('dmg'))return false;
    const remaining=S.coins,cost=attributeCost(20);
    if(!trainAttribute('dmg') || S.coins!==remaining-cost || S.attributes.dmg!==21) return false;
    save(); return true;
  })()`),true);
  const saved=g.saved();
  const reloaded=game(saved);
  assert.equal(reloaded.run('S.attributes.dmg'),21);
  assert.equal(reloaded.run("bonus('dmg')"),1.21);
});

test('training does not show success notices but retains failure feedback', () => {
  assert.match(script, /\$\('attribute-status'\)\.textContent=improved\?'':'No se puede mejorar este atributo\.'/);
  assert.doesNotMatch(script, /aumentado a \$\{S\.attributes\[stat\]\}/);
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

test('equipment, upgrades, achievements, skills and passives combine in every combat mode', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const earned=['kill1','missions-1','missions-2','missions-3'];
    const achievements=ACHIEVEMENTS.filter(a=>earned.includes(a.id));
    ACHIEVEMENTS.splice(0,ACHIEVEMENTS.length,...achievements);
    S=fresh();S.level=120;S.attributes={dmg:10,xp:20,coin:30};
    S.owned=['sword_0_0','shield_0_0','boots_0_0'];
    S.eq={sword:'sword_0_0',shield:'shield_0_0',boots:'boots_0_0'};
    S.upgrades={sword_0_0:2,shield_0_0:1,boots_0_0:3};S.forgeRanks={dmg:3,xp:4,coin:5};
    S.achievements=earned;S.skills={might:2,learning:3,fortune:4,prosperity:1,salvage:1,treasure:1,seeker:1};S.skillStyle='seeker';
    S.passives={war1:2,sage1:2,wealth1:3,hunt1:5,hunt2:5,hunt3:3};S.subclass='champion';
    S.battleUpgrades={damage:3,speed:0,loot:0};S.battleUpdated=Date.now();
    Math.random=()=>.99;
    if(!validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    if(Math.abs(bonus('dmg')-1.304)>1e-8 || Math.abs(bonus('xp')-1.692)>1e-8 || Math.abs(bonus('coin')-2.004)>1e-8) return false;
    S.active=['squat','push','plank','abs','jack','lunge'];S.targets.squat=20;S.monsterHp=1000000;
    const xp=S.xp,coins=S.coins;completeMission(byId('squat'));
    if(Math.abs(S.monsterHp-(1000000-20*1.304))>1e-8 ||
       S.xp-xp!==Math.round(20*1.692)+Math.round(30*1.692) || S.coins-coins!==Math.round(10*2.004)) return false;
    S.autoMonsterHp=1000000;S.battleUpdated=1000;settleBattle(11000);
    if(Math.abs(S.autoMonsterHp-(1000000-5*1.304))>1e-8) return false;
    S.tower.floor=100;S.tower.keys=1;S.tower.hp=1000;S.tower.torment=0;
    if(!attackTower('2026-01-05') || Math.abs(S.tower.hp-(1000-24*1.304))>1e-8) return false;
    S.weeklyBoss.hp=180;S.weeklyBoss.torment=0;
    return attackWeeklyBoss('2026-01-05') && Math.abs(S.weeklyBoss.hp-(180-40*1.304))<1e-8;
  })()`),true);
});

test('every ranked skill and passive contributes its advertised effect', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const value=stat=>stat==='crit'?criticalChance():stat==='critDamage'?criticalBonus():
      stat==='materials'?materialReward(1000):(bonus(stat)-1)*100;
    for(const [nodes,field] of [[SKILLS,'skills'],[PASSIVES,'passives']]){
      for(const node of Object.values(nodes)){
        if(node.style) continue;
        S=fresh();const before=value(node.stat);
        S[field][node.id]=2;
        const expected=node.amount*2*(node.stat==='materials'?10:1);
        if(Math.abs(value(node.stat)-before-expected)>1e-8) return false;
      }
    }
    return true;
  })()`),true);
});

test('ancestral branch masteries provide distinct combat, loot and offline effects', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.passives={war5:4,hunt5:4,wealth5:4,sage5:4};
    const boss=WEEKLY_BOSSES[1];
    if(effectiveBossResistance(boss,180,180,0,true)!==.1||offlineLimit()!==OFFLINE_LIMIT) return false;
    S.passives={war5:5,hunt5:5,wealth5:5,sage5:5};
    if(Math.abs(effectiveBossResistance(boss,180,180,0,false)-.075)>1e-10 ||
       Math.abs(effectiveBossResistance(boss,180,180,0,true)-.0375)>1e-10 ||
       offlineLimit()!==12*60*60*1000) return false;
    S.skillStyle='hunter';if(effectiveBossResistance(boss,180,180,0,true)!==0) return false;
    S.skillStyle=null;Math.random=()=>0;
    S.encounter={kind:'elite',species:0,maxHp:40,torment:0};S.monsterHp=1;hit(1);
    if(S.materials!==6) return false;
    S.autoMonsterHp=1000000000;S.battleUpdated=1000;
    return settleBattle(1000+24*60*60*1000).ticks===4320;
  })()`),true);
});

test('daily stock respects level, remains stable through reload and records sold offers', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=5; S.coins=10000;
    if(!ensureShopStock() || S.shopStock.offers.length!==10 ||
      new Set(S.shopStock.offers).size!==10 || S.shopStock.offers.some(id=>ITEM[id].lvl>5))return false;
    const offers=JSON.stringify(S.shopStock.offers);
    S.level=15; if(ensureShopStock() || JSON.stringify(S.shopStock.offers)!==offers)return false;
    const id=S.shopStock.offers[0];
    const equipment=JSON.stringify(S.eq);
    if(!buyDailyItem(id) || buyDailyItem(id) || !S.shopStock.sold.includes(id))return false;
    if(!S.owned.includes(id) || JSON.stringify(S.eq)!==equipment)return false;
    S.owned=S.owned.filter(item=>item!==id);
    if(buyDailyItem(id))return false;
    save(); return true;
  })()`),true);
  const old=g.saved(), reloaded=game(old);
  assert.equal(reloaded.run('ensureShopStock()'),false);
  assert.deepEqual(reloaded.saved().shopStock,old.shopStock);
  assert.equal(reloaded.run("ensureShopStock('2099-01-02')"),true);
  assert.equal(reloaded.run('S.shopStock.level'),15);
  assert.equal(reloaded.run('S.shopStock.sold.length'),0);
});

test('store uses the new name and only shows forge failure messages', () => {
  assert.match(html, /data-section="store"[^>]*>🛒 Tienda<\/button>/);
  assert.match(script, /\$\('shop-status'\)\.textContent=bought\?'':'No se puede comprar esta mejora\.'/);
  assert.match(script, /const bought=buyDailyItem\(it\.id\);save\(\);render\(\);if\(!bought\)\$\('shop-status'\)\.textContent='No se puede comprar esta oferta\.'/);
  assert.match(script, /function renderShop\(\)\{[\s\S]*?\$\('shop-status'\)\.textContent='';/);
});

test('daily shop uses weighted rarities among eligible tiers', () => {
  const g=game();
  const counts=Array.from(g.run(`(() => {
    let seed=1234567; Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
    S=fresh(); S.level=15; const counts=[0,0,0,0];
    for(let i=0;i<2000;i++){S.shopStock=null;ensureShopStock();for(const id of S.shopStock.offers)counts[ITEM[id].tier]++}
    return counts;
  })()`));
  assert.equal(counts.reduce((a,b)=>a+b,0),20000);
  for(const [count,weight] of counts.map((count,i)=>[count,[.60/.99,.25/.99,.11/.99,.03/.99][i]])) {
    assert.ok(Math.abs(count/20000-weight)<.02, `Unexpected counts: ${counts}`);
  }
});

test('weekly forge permits ten increasingly costly purchases and applies to equipped stats', () => {
  const g=game();
  g.run(`for(let i=ACHIEVEMENTS.length-1;i>=0;i--) if(ACHIEVEMENTS[i].id.startsWith('forge-ranks-')) ACHIEVEMENTS.splice(i,1)`);
  assert.equal(g.run(`(() => {
    const RealDate=Date; let clock=RealDate.UTC(2026,0,4,12);
    Date=class extends RealDate {
      constructor(...args){if(args.length) super(...args);else super(clock)}
      static now(){return clock}
    };
    S=fresh(); S.coins=149;
    if(buyForgeUpgrade('toString') || buyForgeUpgrade('dmg'))return false;
    S.coins=10000;
    if(!buyForgeUpgrade('dmg') || S.coins!==9850 || forgeCost()!==250)return false;
    if(statBreakdown('dmg').forge!==0)return false;
    S.owned=['sword_0_0'];placeItem('sword_0_0','sword');
    if(statBreakdown('dmg').forge!==1 || Math.abs(bonus('dmg')-1.06)>1e-8)return false;
    for(let i=1;i<10;i++) if(!buyForgeUpgrade('xp'))return false;
    const remaining=S.coins;
    if(buyForgeUpgrade('coin') || S.coins!==remaining || S.forgeWeekPurchases!==10 || forgeCost()!==1150)return false;
    clock+=86400000;
    if(!buyForgeUpgrade('dmg') || S.coins!==remaining-1150 || S.forgeRanks.dmg!==2 || S.forgeWeekPurchases!==1)return false;
    delete S.eq.sword;
    if(statBreakdown('dmg').forge!==0)return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run('S.forgeRanks.dmg'),2);
  assert.equal(restored.run('S.forgeLastWeek'),'2026-01-05');
  assert.equal(restored.run('S.forgeWeekPurchases'),1);
});

test('migration preserves today’s offers and prior weekly purchase', () => {
  const first=game();
  first.run(`S=fresh(); S.level=5; S.shopStock={day:today(),level:1,offers:ITEMS.filter(i=>i.lvl===1).slice(0,8).map(i=>i.id),sold:[]};
    S.shopStock.sold.push(S.shopStock.offers[0]); S.forgeLastWeek=weekStart(today()); S.forgeRanks.dmg=1;
    delete S.forgeWeek; delete S.forgeWeekPurchases; save()`);
  const old=first.saved(),g=game(old);
  assert.equal(g.run('S.forgeWeekPurchases'),1);
  assert.equal(g.run('ensureShopStock()'),true);
  assert.deepEqual(Array.from(g.run('S.shopStock.offers.slice(0,8)')),old.shopStock.offers);
  assert.deepEqual(Array.from(g.run('S.shopStock.sold')),old.shopStock.sold);
  assert.equal(g.run('S.shopStock.offers.length'),10);
  assert.equal(g.run('S.shopStock.offers.every(id=>ITEM[id].lvl===1)'),true);
});

test('global statistics use saved counters and all defeated monsters', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.totalMissions=12; S.kills=27; S.missionKills=5; S.autoKills=18;
    S.activeDays=8; S.challengeClears=2; S.packsOpened=4; S.achievements=['kill1','mission1'];
    S.weeklyRewards=3; S.streak=5; S.owned=['sword_0_0','shield_0_0'];
    const stats=globalStats();
    return stats.missions===12 && stats.kills===27 && stats.days===8 &&
      stats.dungeons===2 && stats.arena===18 && stats.packs===4 && stats.achievements===2 &&
      stats.chapters===3 && stats.streak===5 && Object.keys(stats).length===9;
  })()`),true);
});

test('expanded statistics render grouped saved metrics and escape persisted text', () => {
  const g=game();
  g.run(`const output={};const $=()=>output;
    S=fresh();S.level=12;S.xp=50;S.lastActive='<img src=x>';S.autoKills=8;
    S.owned=['sword_0_0'];S.packsOpened=3;S.achievements=['kill1'];`);
  g.run(script.slice(script.indexOf('const statNumber='),script.indexOf('function journeyMarkup(){')));
  const markup=g.run('renderStatistics();output.innerHTML');
  assert.ok((markup.match(/class="overview-stat"/g)||[]).length>=60);
  assert.match(markup,/Combate y desafíos/);
  assert.match(markup,/Equipo y colección/);
  assert.match(markup,/Ofertas restantes/);
  assert.match(markup,/Evolución[\s\S]*?500/);
  assert.match(markup,/&lt;img src=x&gt;/);
  assert.doesNotMatch(markup,/<img src=x>/);
});

test('character inventory hides equipped items and filters only by type', () => {
  assert.match(html, /class="inventory-summary"><p id="materials"><\/p><small>/);
  assert.match(html, /#inventory\{display:grid;grid-template-columns:repeat\(auto-fill/);
  assert.match(html, /#inventory\{[^}]*margin-top:14px/);
  assert.doesNotMatch(html, /id="inventory-equipped"/);
  assert.match(script, /inventoryAvailable\(S\.owned,type\)/);
  assert.match(script, /b\.className=it\?'slot is-equipped':'slot'/);
});

test('character displays combat stats and global progress has its own menu', () => {
  assert.match(html, /id="hero-stats"/);
  assert.match(html, /id="tab-statistics"/);
  assert.match(script, /\['Victorias de arena',S\.autoKills\]/);
  assert.match(script, /function renderHeroStats\(\)[\s\S]*?effectiveStatLabel\(stat\)/);
  assert.doesNotMatch(html, /id="bonuses"/);
});

test('character and global stats display effective specialization bonuses and cycling bosses', () => {
  const g=game();
  g.run(`const outputs={};const $=id=>outputs[id]??={};
    S=fresh();S.attributes={dmg:100,xp:10,coin:0};S.skillStyle='berserker';
    S.weeklyBoss.index=12;`);
  g.run(script.slice(script.indexOf('const statNumber='),script.indexOf('function journeyMarkup(){')));
  const hero=g.run(`renderHeroStats();outputs['hero-stats'].innerHTML`);
  const global=g.run(`renderStatistics();outputs['statistics-content'].innerHTML`);
  assert.match(hero,/Poder<\/small><strong>\+160 %/);
  assert.match(hero,/Sabiduría<\/small><strong>-12 %/);
  assert.match(global,/Bonificación de daño<\/small><strong>\+160 %/);
  assert.match(global,/Bonificación de experiencia<\/small><strong>-12 %/);
  assert.match(global,/Bonificación de monedas<\/small><strong>-20 %/);
  assert.match(global,/Boss actual<\/small><strong>Colmillo de la noche/);
  g.run(`S.skillStyle='hunter';renderStatistics();renderHeroStats()`);
  assert.match(g.run(`outputs['statistics-content'].innerHTML`),/Bonificación de daño<\/small><strong>\+70 %/);
  assert.match(g.run(`outputs['hero-stats'].innerHTML`),/Crítico<\/small><strong>15 %/);
  g.run(`S.skillStyle='seeker';renderStatistics()`);
  const seeker=g.run(`outputs['statistics-content'].innerHTML`);
  assert.match(seeker,/Bonificación de daño<\/small><strong>\+60 %/);
  assert.match(seeker,/Bonificación de experiencia<\/small><strong>\+32 %/);
  assert.match(seeker,/Bonificación de monedas<\/small><strong>\+20 %/);
});

test('inventory excludes equipped instances but retains unequipped copies and rarity order', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.owned=['sword_0_0','shield_5_0','sword_0_0#1','helmet_1_0','arms_4_0','ring_6_0'];
    S.eq={sword:'sword_0_0',arms:'arms_4_0'};
    if(JSON.stringify(inventoryAvailable(S.owned))!==JSON.stringify(['ring_6_0','shield_5_0','helmet_1_0','sword_0_0#1'])) return false;
    if(JSON.stringify(inventoryAvailable(S.owned,'sword'))!==JSON.stringify(['sword_0_0#1'])) return false;
    delete S.eq.sword;
    return JSON.stringify(inventoryAvailable(S.owned,'sword'))===JSON.stringify(['sword_0_0','sword_0_0#1']) &&
      S.owned[0]==='sword_0_0';
  })()`),true);
});

test('changing inventory pages scrolls to the updated bottom in both directions', () => {
  const calls=[];
  const context=vm.createContext({
    inventoryPage:1,dismantleConfirm:'item',
    renderChar:()=>calls.push('render'),
    document:{documentElement:{scrollHeight:2400}},
    window:{scrollTo:options=>calls.push({top:options.top,behavior:options.behavior})},
  });
  vm.runInContext(script.slice(script.indexOf('function changeInventoryPage('),script.indexOf("$('inventory-prev').onclick")),context);
  vm.runInContext('changeInventoryPage(1); changeInventoryPage(-1)',context);
  assert.equal(vm.runInContext('inventoryPage',context),1);
  assert.equal(vm.runInContext('dismantleConfirm',context),null);
  assert.deepEqual(calls,['render',{top:2400,behavior:'auto'},'render',{top:2400,behavior:'auto'}]);
});

test('hero power follows equipment, upgrades, attributes and arena upgrades', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); if(heroPower()!==1 || heroEvolution(heroPower())!==1)return false;
    S.level=5; S.attributes={dmg:3,xp:4,coin:5};
    S.owned=['sword_0_0']; S.eq.sword='sword_0_0'; S.upgrades.sword_0_0=2;
    S.battleUpgrades={damage:2,speed:1,loot:3};
    if(heroPower()!==5+3+4+5+ITEM.sword_0_0.pct+2+6)return false;
    const power=heroPower(); delete S.eq.sword;
    return heroPower()===power-ITEM.sword_0_0.pct-2 &&
      heroEvolution(1)===1 && heroEvolution(10)===1 && heroEvolution(11)===2 &&
      heroEvolution(4990)===499 && heroEvolution(4991)===500 && heroEvolution(100000)===500;
  })()`),true);
});

test('all 500 hero evolutions have visually distinct artwork', () => {
  const g=game();
  const hero=script.slice(script.indexOf('function heroArt(){'),script.indexOf('const navigationButtons='));
  g.run(hero);
  assert.equal(g.run(`(() => {
    S=fresh(); const images=new Set();
    for(let i=1;i<=500;i++){
      S.level=1+(i-1)*10;
      const art=heroArt().replace(/aria-label="[^"]*"/,'');
      if(images.has(art)) return false;
      images.add(art);
    }
    return images.size===500 && heroArt().includes('evolución 500 de 500');
  })()`),true);
});

test('training improves autobattle and tower damage without changing mission targets', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=100; S.battleUpdated=1000;
    const targetBefore=missionTarget(byId(S.active[0]));
    if(!trainAttribute('dmg'))return false;
    settleBattle(11000);
    if(Math.abs(S.autoMonsterHp-47.98)>1e-8)return false;
    S.tower.keys=1; S.tower.hp=100; S.tower.torment=0;
    if(!attackTower('2026-01-01'))return false;
    return Math.abs(S.tower.hp-75.76)<1e-8 &&
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
    ACHIEVEMENTS.length=0;
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
    ACHIEVEMENTS.length=0;
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

test('mission board omits rest controls and exercise customization', () => {
  const board = html.match(/<h2>📜 Tablón de encargos[\s\S]*?<\/div>\s*<div class="card" id="journey">/)[0];
  assert.doesNotMatch(board, /Reglas y bienestar|Elige una misión/);
  assert.doesNotMatch(html, /Tu ejercicio real es el daño/);
  assert.doesNotMatch(html, /id="rest"|\$\('rest'\)/);
  assert.doesNotMatch(board, /personalizar ejercicios|mission-scale|exercise-options|rest-day|rest-status|Descansos esta semana/i);
});

test('inventory removes bulk selection but keeps per-item dismantling', () => {
  const character=html.match(/<section id="character"[\s\S]*?<\/section>/)?.[0]||'';
  const renderer=script.slice(script.indexOf('function renderChar(){'),script.indexOf('function equip('));
  assert.doesNotMatch(character+renderer,/dismantle-selected|Desmantelar selección|Seleccionar|checkbox/);
  assert.match(script, /destroy\.onclick=/);
  assert.ok(character);
});

test('daily store shows item level and current torment without date, with a separate forge limit banner', () => {
  assert.match(html, /id="shop-context"/);
  assert.doesNotMatch(html, /id="shop-date"/);
  assert.match(script, /Nivel de objetos: \$\{S\.shopStock\.level\} · Tormento actual: \$\{TORMENTS\[S\.torment\]\.name\}/);
  assert.match(html, /id="forge-title"[\s\S]*?<\/div>\s*<div class="forge-week-banner" id="forge-week"/);
  assert.match(html, /#statistics-content\{display:grid/);
});

test('mission board omits manual changes and the visible activity log', () => {
  assert.doesNotMatch(html, /id="log"|<h2>Registro<\/h2>|\$\('log'\)|Cambiar misión/);
  assert.match(html, /id="mission-status"[^>]*role="status"/);
  assert.match(script, /const next=randomMission\(S\.active\)/);
});

test('journey places milestones under chapter progress and reset at the bottom', () => {
  assert.match(html, /id="journey">[\s\S]*?id="weekly-progress"><\/div>\s*<\/div>\s*<div class="reset-footer">[\s\S]*?<button id="reset"[^>]*>Reiniciar partida<\/button>[\s\S]*?<\/section>/);
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
    ACHIEVEMENTS.length=0;
    S=fresh(); S.missionKills=4; S.kills=4;
    S.encounter={kind:'lucky',species:0,maxHp:40,torment:0}; S.monsterHp=3;
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

test('arena upgrades preserve old saves and validate costs and speed cap', () => {
  const first=game();
  first.run("S=fresh(); S.coins=100; S.autoKills=3; S.autoMonsterHp=20; delete S.battleUpgrades; save()");
  const g=game(first.saved());
  g.run(`for(let i=ACHIEVEMENTS.length-1;i>=0;i--) if(['arena-ranks-','arena-victories-'].some(prefix=>ACHIEVEMENTS[i].id.startsWith(prefix))) ACHIEVEMENTS.splice(i,1)`);
  assert.equal(g.run(`(() => {
    if(S.autoKills!==3 || S.autoMonsterHp!==20 || battleDamage()!==2 || battleInterval()!==10000 || battleLoot()!==1) return false;
    S.battleUpdated=1000;
    if(buyBattleUpgrade('invalid',1000) || buyBattleUpgrade('speed',1000) || S.coins!==100) return false;
    if(!buyBattleUpgrade('damage',1000) || S.coins!==0 || battleDamage()!==3 || battleUpgradeCost('damage')!==150) return false;
    S.coins=100000;
    for(let i=0;i<20;i++) if(!buyBattleUpgrade('speed',1000)) return false;
    const coins=S.coins;
    if(battleInterval()!==2000 || buyBattleUpgrade('speed',1000) || S.coins!==coins) return false;
    if(!buyBattleUpgrade('loot',1000) || battleLoot()!==1.1) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run('S.battleUpgrades.speed'),20);
  assert.equal(restored.run('S.battleUpgrades.damage'),1);
  assert.equal(restored.run('S.battleUpgrades.loot'),1);
});

test('arena upgrades settle old damage and preserve fractional attack progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=1000; S.battleUpdated=1000;
    if(!buyBattleUpgrade('damage',16000) || S.autoMonsterHp!==48) return false;
    if(!buyBattleUpgrade('speed',16000) || battleInterval()!==9600) return false;
    if(S.battleUpdated!==11200) return false;
    settleBattle(20799); if(S.autoMonsterHp!==48) return false;
    settleBattle(20800); return S.autoMonsterHp===45;
  })()`),true);
});

test('arena loot upgrades apply to arena coins and XP only', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=100; S.achievements=ACHIEVEMENTS.map(a=>a.id); S.battleUpgrades.loot=5;
    const coin=bonus('coin'),xp=bonus('xp');
    S.autoMonsterHp=1; hit(1,'auto');
    if(S.coins!==Math.round(10*coin*1.5) || S.xp!==Math.round(20*xp*1.5)) return false;
    S.coins=0; S.xp=0; S.monsterHp=1; hit(1,'mission');
    return S.coins===Math.round(10*coin) && S.xp===Math.round(20*xp);
  })()`),true);
});

test('upgraded arena has equivalent online and capped offline progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    function setup(){
      S=fresh(); S.battleUpgrades={damage:2,speed:20,loot:3}; S.battleUpdated=1000; unlockAchievements();
    }
    function snapshot(){return JSON.stringify([S.autoMonsterHp,S.autoKills,S.coins,S.xp,S.achievements])}
    setup(); settleBattle(61000); const offline=snapshot();
    setup(); for(let now=3000;now<=61000;now+=2000) settleBattle(now);
    if(snapshot()!==offline) return false;
    setup(); settleBattle(1000+OFFLINE_LIMIT); const capped=snapshot();
    setup(); settleBattle(1000+OFFLINE_LIMIT*2);
    return snapshot()===capped;
  })()`),true);
});

test('arena cycles through all illustrated monsters with softened health scaling', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const encounters=Array.from({length:16},(_,i)=>autoEncounter(i));
    return new Set(encounters.map(e=>e.species)).size===16 &&
      encounters[4].kind==='elite' && encounters[9].kind==='boss' &&
      autoEncounter(16).species===0 && monsterHp(9)===Math.round(50+12*9+2*9**1.7);
  })()`),true);
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

test('missions beyond six remain playable with reduced rewards and do not grant more tower keys', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;
    S=fresh(); S.active=['squat','push','plank']; S.completedToday=6;
    S.battleUpdated=Date.now(); Math.random=()=>0;
    completeMission(byId('squat'));
    return S.completedToday===7 && S.totalMissions===1 &&
      S.monsterHp===45 && S.coins===3 && S.tower.keys===0;
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
    for(let i=ACHIEVEMENTS.length-1;i>=0;i--)
      if(!['mission50','kill25'].includes(ACHIEVEMENTS[i].id)) ACHIEVEMENTS.splice(i,1);
    S=fresh(); S.eq={pants:'pants_3_0',shield:'shield_3_0'};
    S.achievements=['mission50','kill25'];
    S.autoMonsterHp=1; S.battleUpdated=1000; settleBattle(11000);
    return S.coins===12 && S.xp===24;
  })()`), true);
});

test('removed dungeon modes leave only tower and weekly bosses in the challenge portal', () => {
  assert.deepEqual([...html.matchAll(/data-dungeon-view="([^"]+)"/g)].map(match=>match[1]),['tower','bosses']);
  assert.match(html, /data-dungeon-view="tower" aria-pressed="true"/);
  assert.match(html, /id="dungeon-tower" class="expedition-section"><\/div>/);
  assert.doesNotMatch(html, /id="dungeon-(classic|level)"/);
});

test('old dungeon keys convert once and progress and earned bonuses are preserved', () => {
  const first=game();
  first.run(`S=fresh(); S.keys=3; S.dungeonClears=9; delete S.challengeClears;
    S.tower.keys=2; S.tower.floor=12; S.weeklyBoss.index=2; S.achievements=['dungeon5'];
    S.dungeonRun={id:'level-5',stage:2,hp:20,torment:0,autoUpdated:1000,rewardEnemies:3};
    S.battleUpdated=Date.now(); save()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`(() => {
    if(S.tower.keys!==5 || S.challengeClears!==9 || 'keys' in S ||
      S.tower.floor!==12 || S.weeklyBoss.index!==2 || !S.achievements.includes('dungeon5') ||
      bonus('dmg')!==1.03) return false;
    settleBattle(S.battleUpdated+10000);
    if(S.dungeonRun.hp!==20 || S.challengeClears!==9) return false;
    save(); return true;
  })()`),true);
  const reloaded=game(restored.saved());
  assert.equal(reloaded.run(`S.tower.keys===5 && S.challengeClears===9 && S.dungeonRun.hp===20`),true);
});

test('future arena, tower and boss victories advance former expedition achievements', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.achievements=ACHIEVEMENTS.filter(a=>a.id!=='dungeons-1').map(a=>a.id);
    S.monsterHp=1; hit(1);
    if(S.challengeClears!==0) return false;
    S.autoMonsterHp=1; hit(1,'auto');
    if(S.challengeClears!==1 || !S.achievements.includes('dungeons-1')) return false;
    S.tower.keys=1; S.tower.hp=1; S.tower.torment=0;
    if(!attackTower('2026-01-05') || S.challengeClears!==2 ||
      attackTower('2026-01-05')) return false;
    S.weeklyBoss.hp=1; S.weeklyBoss.torment=0;
    if(!attackWeeklyBoss('2026-01-05') || S.challengeClears!==3 ||
      attackWeeklyBoss('2026-01-05')) return false;
    save(); return true;
  })()`),true);
  assert.equal(game(g.saved()).run('S.challengeClears'),3);
});

test('first mission each day awards one separate tower key', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const RealDate=Date; let clock=RealDate.UTC(2026,0,5,12);
    Date=class extends RealDate {
      constructor(...args){if(args.length) super(...args);else super(clock)}
      static now(){return clock}
    };
    S=fresh(); Math.random=()=>0.5;
    completeMission(byId(S.active[0]));
    if(S.tower.keys!==1) return false;
    completeMission(byId(S.active[0]));
    if(S.tower.keys!==1) return false;
    clock+=86400000; S.battleUpdated=clock;
    completeMission(byId(S.active[0]));
    return S.tower.keys===2;
  })()`),true);
});

test('tower requires a key, limits attacks by day and persists health and completion', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.achievements=ACHIEVEMENTS.map(a=>a.id);
    if(attackTower('2026-01-01')) return false;
    S.tower.keys=2; S.tower.hp=24*bonus('dmg')+1; S.tower.torment=0;
    if(!attackTower('2026-01-01') || Math.abs(S.tower.hp-1)>1e-8 ||
      S.tower.keys!==1 || attackTower('2026-01-01')) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    if(!attackTower('2026-01-02') || S.tower.floor!==2 || S.tower.hp!==towerMaxHp(2) ||
      S.tower.keys!==0 || S.kills!==1) return false;
    S.tower.floor=100; S.tower.hp=1; S.tower.keys=2; S.tower.lastAttack=null; S.tower.torment=0;
    if(!attackTower('2026-01-03') || S.tower.floor!==101 || S.tower.hp!==0 ||
      attackTower('2026-01-04') || S.tower.keys!==1) return false;
    save(); return true;
  })()`),true);
  assert.equal(game(restored.saved()).run('S.tower.floor'),101);
});

test('tower optional rounds scale health and rewards without resetting earned progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.tower.floor=101;S.tower.hp=0;S.tower.keys=2;S.kills=100;
    if(!startTowerRound()||startTowerRound()||S.tower.round!==1||S.tower.hp!==39||S.kills!==100) return false;
    S.tower.torment=0;S.tower.hp=1;const coins=S.coins;
    if(!attackTower('2026-01-05')||S.coins-coins!==Math.round(25*1.25)||S.tower.floor!==2) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`S.tower.round===1&&S.tower.floor===2&&towerMaxHp(2)===42`),true);
});

test('tower round bonuses also apply to partial rewards and survive torment changes', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=20;S.battleUpdated=1000;
    S.tower.round=1;S.tower.floor=100;S.tower.hp=towerMaxHp(100);S.tower.keys=1;
    if(S.tower.hp!==336||!attackTower('2026-01-05')||S.coins!==6||S.tower.hp!==318) return false;
    selectTorment(1,1000);
    return Math.abs(S.tower.hp-556.5)<1e-8&&S.tower.rewardTorment===0;
  })()`),true);
});

test('tower achievements retain completed floors across optional rounds', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.tower.floor=101;
    const milestone=ACHIEVEMENTS.find(a=>a.id==='tower-floors-100');
    if(milestone.value(S)!==100||!startTowerRound()||milestone.value(S)!==100) return false;
    S.tower.floor=3;return milestone.value(S)===102;
  })()`),true);
});

test('optional journey rounds only count new active days and scale rewards', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.activeDays=200;claimJourneyRewards();
    if(S.weeklyRewards!==52||!startJourneyRound()||startJourneyRound()) return false;
    const coins=S.coins,materials=S.materials;
    claimJourneyRewards();if(S.weeklyRewards!==52||S.coins!==coins) return false;
    S.activeDays=203;claimJourneyRewards();if(S.weeklyRewards!==52) return false;
    S.activeDays=204;claimJourneyRewards();
    if(S.weeklyRewards!==53||S.coins-coins!==Math.round(38*1.25)||S.materials-materials!==5) return false;
    save();return true;
  })()`),true);
  assert.equal(game(g.saved()).run(`S.journeyRound===1&&S.journeyStartDays===200&&S.weeklyRewards===53`),true);
});

test('weekly bosses retain health, enforce one attack per day and advance once', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.weeklyBoss.hp=40*bonus('dmg')+1; S.weeklyBoss.torment=0;
    if(!attackWeeklyBoss('2026-01-05') || Math.abs(S.weeklyBoss.hp-1)>1e-8 ||
      attackWeeklyBoss('2026-01-05')) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    if(!attackWeeklyBoss('2026-01-12') || S.weeklyBoss.index!==1 ||
      S.weeklyBoss.hp!==WEEKLY_BOSSES[1].hp || S.kills!==1 ||
      attackWeeklyBoss('2026-01-12')) return false;
    S.weeklyBoss.index=WEEKLY_BOSSES.length-1; S.weeklyBoss.hp=1; S.weeklyBoss.torment=0;
    if(!attackWeeklyBoss('2026-01-19') || S.weeklyBoss.index!==WEEKLY_BOSSES.length ||
      S.weeklyBoss.hp!==bossBaseHp(WEEKLY_BOSSES.length) || !attackWeeklyBoss('2026-01-26')) return false;
    save(); return true;
  })()`),true);
  assert.equal(game(restored.saved()).run('S.weeklyBoss.index'),12);
});

test('weekly bosses allow three different days, reset on Monday and migrate old saves', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.weeklyBoss.hp=1000;S.weeklyBoss.torment=0;
    if(!attackWeeklyBoss('2026-01-05')||attackWeeklyBoss('2026-01-05')||
       !attackWeeklyBoss('2026-01-06')||!attackWeeklyBoss('2026-01-07')||
       attackWeeklyBoss('2026-01-11')||S.weeklyBoss.weekAttacks!==3) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`!attackWeeklyBoss('2026-01-11') && attackWeeklyBoss('2026-01-12') && S.weeklyBoss.weekAttacks===1`),true);
  const old=restored.saved();delete old.weeklyBoss.weekAttacks;delete old.weeklyBoss.lastAttackDay;
  old.weeklyBoss.lastAttackWeek='2026-01-05';
  assert.equal(game(old).run(`S.weeklyBoss.weekAttacks===1 && attackWeeklyBoss('2026-01-07') && S.weeklyBoss.weekAttacks===2`),true);
});

test('torment unlocks by level and rejects locked or invalid selections', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();
    if(TORMENTS.length!==13 || TORMENTS.some((t,i)=>i>0 &&
      (t.level!==i*10 || t.hp<=TORMENTS[i-1].hp || t.reward<=TORMENTS[i-1].reward))) return false;
    if(S.torment!==0 || selectTorment(1) || selectTorment(-1) || selectTorment('1') || selectTorment(99)) return false;
    for(let i=1;i<TORMENTS.length;i++){
      S.level=TORMENTS[i].level-1;
      if(selectTorment(i)) return false;
      S.level=TORMENTS[i].level;
      if(!selectTorment(i) || S.torment!==i) return false;
    }
    save(); return true;
  })()`),true);
  assert.equal(game(g.saved()).run('S.torment'),12);
});

test('torment sanctuary displays unlocks and saves the selected difficulty', () => {
  const elements=Object.fromEntries(['torment-current','torment-hp','torment-reward','torment-target',
    'torment-options','torment-status'].map(id=>[id,{textContent:''}]));
  const box=elements['torment-options'];
  box.children=[];
  box.replaceChildren=()=>{box.children=[]};
  box.appendChild=child=>box.children.push(child);
  box.contains=child=>box.children.includes(child);
  box.addEventListener=(type,handler)=>{box.handler=handler};
  box.querySelector=()=>null;
  const state={level:10,torment:0};
  let saves=0;
  const context=vm.createContext({
    S:state,
    TORMENTS:[{name:'Normal',level:1,hp:1,reward:1},{name:'Tormento I',level:10,hp:1.75,reward:1.4},{name:'Tormento II',level:20,hp:2.5,reward:1.8}],
    combatReward:index=>[1,1.785,2.6][index],
    document:{activeElement:null,createElement:()=>({dataset:{},setAttribute(name,value){this[name]=value}})},
    $:id=>elements[id],
    selectTorment:index=>{if(state.level<[1,10,20][index]) return false;state.torment=index;return true},
    save:()=>{saves++},
    render:()=>vm.runInContext('renderTorment()',context),
  });
  vm.runInContext(script.slice(script.indexOf('function renderTorment(){'),script.indexOf('function renderBattleUpgrades(){')),context);
  vm.runInContext('renderTorment()',context);
  assert.equal(elements['torment-current'].textContent,'Normal');
  assert.equal(box.children.length,3);
  assert.equal(box.children[0]['aria-pressed'],'true');
  assert.equal(box.children[1].disabled,false);
  assert.equal(box.children[2].disabled,true);
  assert.match(box.children[2].innerHTML,/Nivel 20/);
  const click=option=>box.handler({target:{closest:()=>option}});
  click(box.children[2]);
  assert.equal(saves,0);
  click(box.children[1]);
  assert.equal(saves,1);
  assert.equal(state.torment,1);
  assert.equal(elements['torment-current'].textContent,'Tormento I');
  assert.equal(elements['torment-hp'].textContent,'×1.75');
  assert.equal(elements['torment-reward'].textContent,'×1.4');
  assert.equal(elements['torment-target'].textContent,'Sin aumento');
  assert.match(box.children[1].innerHTML,/ejercicio sin aumento/);
  assert.equal(box.children[1]['aria-pressed'],'true');
  assert.match(elements['torment-status'].textContent,/Tormento I aplicado a todo el juego/);
  state.level=20;
  vm.runInContext('renderTorment()',context);
  click(box.children[2]);
  assert.equal(state.torment,2);
  click(box.children[0]);
  assert.equal(state.torment,0);
});

test('changing torment updates rewards without changing active mission targets or progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    Math.random=()=>0.5; S=fresh(); S.level=120;
    S.achievements=ACHIEVEMENTS.map(a=>a.id);
    const ex=byId(S.active[0]),original=missionTarget(ex);
    S.done[ex.id]=3;
    if(!selectTorment(12) || missionTarget(ex)!==original ||
       S.done[ex.id]!==3 || S.missionTorments[ex.id]!==12 ||
       missionEstimate(ex).coins!==Math.round(10*bonus('coin')*DIFFICULTIES[missionDifficulty(ex)].reward*22.5)) return false;
    for(let i=0;i<20;i++){selectTorment(1);selectTorment(12)}
    selectTorment(0);save();
    return missionTarget(ex)===original && S.done[ex.id]===3;
  })()`),true);
  assert.equal(game(g.saved()).run('S.done[S.active[0]]'),3);
});

test('mission monsters immediately scale health and rewards with torment', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    Math.random=()=>0.5; S=fresh(); S.level=120; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.monsterHp=25;
    selectTorment(12);
    if(S.encounter.torment!==12 || S.encounter.maxHp!==4250 || S.monsterHp!==2125) return false;
    S.monsterHp=1;hit(1);
    if(S.coins!==Math.round(10*bonus('coin')) || S.encounter.torment!==12) return false;
    const max=S.encounter.maxHp;S.monsterHp=max/3;
    selectTorment(0);selectTorment(12);
    return S.encounter.maxHp===max && Math.abs(S.monsterHp-max/3)<1e-8;
  })()`),true);
});

test('changing torment settles pending arena progress before switching', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=120; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.battleUpdated=1000; S.autoMonsterHp=20;
    const damage=battleDamage();
    if(!selectTorment(12,11000) || S.autoMonsterHp!==(20-damage)*85 || S.autoTorment!==12) return false;
    S.autoMonsterHp=1;
    const highCoins=Math.round(10*bonus('coin'));
    settleBattle(21000);
    if(S.coins!==highCoins || S.autoTorment!==12 ||
      Math.abs(S.autoMonsterHp-(autoMaxHp(1,12)-(damage-1)))>1e-8) return false;
    selectTorment(0,21000); S.autoMonsterHp=1;
    const coins=S.coins,expected=Math.round(12*bonus('coin'));
    settleBattle(31000);
    return S.coins-coins===expected && S.autoTorment===0 &&
      Math.abs(S.autoMonsterHp-(autoMaxHp(2,0)-(damage-1)))<1e-8;
  })()`),true);
});

test('higher torment improves eligible pack odds without unlocking higher-level items', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    for(const level of [1,5,10,15,20,30,40]){
      for(const pack of PACKS){
        const low=packOdds(pack,level,0),high=packOdds(pack,level,12);
        if(Math.abs(high.reduce((a,b)=>a+b,0)-1)>1e-12 ||
          high.some((p,i)=>level<TIER_LVL[i] && p!==0)) return false;
        for(let tier=1;tier<high.length;tier++){
          if(high.slice(tier).reduce((a,b)=>a+b,0)+1e-12<
            low.slice(tier).reduce((a,b)=>a+b,0)) return false;
        }
      }
    }
    return packOdds(PACKS[0],40,12)[6]>packOdds(PACKS[0],40,0)[6];
  })()`),true);
});

test('shop changes offers per torment without resetting purchases or rerolling', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=120; S.coins=1000000; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    const day=today(); ensureShopStock(day);
    const original=S.shopStock.offers.slice(),bought=original[0];
    if(!buyDailyItem(bought)) return false;
    selectTorment(12);ensureShopStock(day);
    const high=S.shopStock.offers.slice();
    if(S.shopStock.torment!==12 || high[0]!==bought || !S.shopStock.sold.includes(bought) ||
       new Set(high).size!==10 || buyDailyItem(bought)) return false;
    selectTorment(0);ensureShopStock(day);
    if(JSON.stringify(S.shopStock.offers)!==JSON.stringify(original)) return false;
    selectTorment(12);ensureShopStock(day);
    if(JSON.stringify(S.shopStock.offers)!==JSON.stringify(high)) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    ensureShopStock();const before=JSON.stringify(S.shopStock.offers);
    selectTorment(0);ensureShopStock();selectTorment(12);ensureShopStock();
    return JSON.stringify(S.shopStock.offers)===before && Object.keys(S.shopStock.soldSlots).length===1;
  })()`),true);
});

test('switching shop torment cannot reset the ten daily purchase slots', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;S.coins=10000000;S.achievements=ACHIEVEMENTS.map(a=>a.id);
    for(let i=0;i<10;i++){
      selectTorment(i%2?12:0);ensureShopStock();
      const offer=S.shopStock.offers.find(id=>!S.shopStock.sold.includes(id));
      if(!offer || !buyDailyItem(offer)) return false;
    }
    for(const torment of [0,1,6,12]){
      selectTorment(torment);ensureShopStock();
      if(S.shopStock.offers.length!==10 || S.shopStock.offers.some(id=>!S.shopStock.sold.includes(id))) return false;
    }
    return S.shopStock.sold.length===10 && Object.keys(S.shopStock.soldSlots).length===10;
  })()`),true);
});

test('skill points accrue retroactively with two points total every tenth level', () => {
  const first=game();
  assert.equal(first.run(`(() => {
    S=fresh();S.level=10;S.battleUpdated=1000;
    if(skillPoints()!==11 || unlockSkill('blade',1000)) return false;
    for(let i=0;i<5;i++) if(!unlockSkill('might',1000)) return false;
    if(!unlockSkill('blade',1000) || skillPoints()!==5 || statBreakdown('dmg').skills!==13) return false;
    S.level=20;
    if(skillPoints()!==16) return false;
    save();return true;
  })()`),true);
  assert.equal(game(first.saved()).run(`skillPoints()===16 && S.skills.might===5 && S.skills.blade===1`),true);
});

test('passive tree grants retroactive independent points and enforces rank prerequisites', () => {
  const old=game();
  old.run(`S=fresh();S.level=70;delete S.passives;delete S.subclass;S.battleUpdated=1000;save()`);
  const restored=game(old.saved());
  assert.equal(restored.run(`(() => {
    if(passivePoints()!==21 || skillPoints()!==77 || !validateBackup({format:'fitquest-save',version:1,state:${JSON.stringify(old.saved())}})) return false;
    S.level=49;if(passivePoints()!==0 || unlockPassive('war1',1000)) return false;
    S.level=50;if(passivePoints()!==1 || unlockPassive('war2',1000) || !unlockPassive('war1',1000) || unlockPassive('war1',1000)) return false;
    S.level=70;for(let i=0;i<2;i++) if(!unlockPassive('war1',1000)) return false;
    return unlockPassive('war2',1000) && passiveSpent()===4 && passivePoints()===17 && statBreakdown('dmg').passives===13;
  })()`),true);
});

test('passive subclasses can change without redistribution, affect gameplay and persist', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=69;S.battleUpdated=1000;
    if(chooseSubclass('champion',1000)) return false;
    for(const id of ['war1','war2','war3','war4']) for(let i=0;i<5;i++) if(!unlockPassive(id,1000)) return false;
    if(!chooseSubclass('champion',1000) || chooseSubclass('champion',1000) || statBreakdown('dmg').passives!==90) return false;
    if(battleDamage()!==3.8 || !validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    if(S.subclass!=='champion' || passivePoints()!==0 || statBreakdown('dmg').passives!==90) return false;
    const ranks=JSON.stringify(S.passives);
    if(!chooseSubclass('oracle',1000)||S.subclass!=='oracle'||JSON.stringify(S.passives)!==ranks||
       passivePoints()!==0||statBreakdown('dmg').passives!==60||statBreakdown('xp').passives!==20) return false;
    save();
    resetPassives(1000);
    if(S.subclass!==null || passivePoints()!==20) return false;
    for(const id of ['hunt1','hunt2','hunt3','hunt4']) for(let i=0;i<5;i++) if(!unlockPassive(id,1000)) return false;
    if(!chooseSubclass('assassin',1000) || criticalChance()!==20 || criticalBonus()!==75) return false;
    resetPassives(1000);
    for(const id of ['wealth1','wealth2','wealth3','wealth4']) for(let i=0;i<5;i++) if(!unlockPassive(id,1000)) return false;
    if(!chooseSubclass('oracle',1000) || materialReward(100)!==135 || statBreakdown('xp').passives!==20) return false;
    save();return true;
  })()`),true);
  assert.equal(game(restored.saved()).run(`S.subclass==='oracle' && passivePoints()===0 && materialReward(100)===135`),true);
});

test('subclass descriptions use percent signs and successful actions do not show upgrade messages', () => {
  const g=game();
  assert.equal(g.run(`Object.values(PASSIVE_CLASSES).every(item=>item.description.includes('%')&&!item.description.includes('puntos porcentuales'))`),true);
  const renderer=script.slice(script.indexOf('function renderPassives(){'),script.indexOf('function renderTorment(){'));
  assert.doesNotMatch(renderer,/seleccionada\.|mejorada a/);
  assert.match(renderer,/No se puede seleccionar esta subclase/);
});

test('switching subclass settles pending combat with the previous bonuses and persists', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=69;S.battleUpdated=1000;
    S.passives={war1:5,war2:5,war3:5,war4:5};S.subclass='champion';S.autoMonsterHp=1000;
    const before=battleDamage();
    if(chooseSubclass('missing',11000)||S.battleUpdated!==1000) return false;
    if(!chooseSubclass('oracle',11000)||Math.abs(S.autoMonsterHp-(1000-before))>1e-8||
       battleDamage()>=before||passiveSpent()!==20) return false;
    save();return true;
  })()`),true);
  assert.equal(game(g.saved()).run(`S.subclass==='oracle'&&passiveSpent()===20`),true);
});

test('prestige resets all but achievements, streak, activity, challenges and prestige', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=49;S.battleUpdated=1000;
    if(performPrestige(1000)) return false;
    S.level=55;S.streak=30;S.coins=500;S.materials=200;S.achievements=['mission1'];
    S.lastActive=today();S.lastActivityDay=today();S.completedToday=2;
    S.attributes.dmg=7;S.forgeRanks.dmg=2;S.battleUpgrades.damage=3;S.activeDays=30;
    S.totalMissions=50;S.packsOpened=12;S.packMisses=5;S.challengeClears=19;
    S.weeklyRewards=10;S.missionScale=50;S.exerciseEnabled=S.exerciseEnabled.slice(0,6);
    S.prestige={count:1,points:5,nodes:['dmg-1']};
    S.tower.floor=12;S.tower.keys=4;S.weeklyBoss.index=2;S.weeklyBoss.hp=10;
    S.skills.might=4;S.passives.war1=5;S.skillStyle='berserker';
    addItem('sword_0_0');addItem('shield_0_0');autoEquipItem('sword_0_0');S.upgrades.sword_0_0=3;
    S.shopStock={day:today(),level:55,torment:0,offers:['sword_0_0'],sold:['sword_0_0']};
    selectTorment(5,1000);S.done[S.active[0]]=5;
    if(!performPrestige(1000)||S.level!==1||S.xp!==0||S.torment!==0||S.autoTorment!==0||
       S.prestige.points!==10||S.prestige.count!==2||S.prestige.nodes[0]!=='dmg-1'||
       S.owned.length||Object.keys(S.eq).length||
       Object.keys(S.upgrades).length||Object.keys(S.skills).length||Object.keys(S.passives).length||
       S.skillStyle!==null||S.subclass!==null) return false;
    if(S.streak!==30||S.coins!==0||S.materials!==0||S.attributes.dmg!==0||
       S.forgeRanks.dmg!==0||S.battleUpgrades.damage!==0||S.tower.floor!==12||S.tower.keys!==4||
       S.weeklyBoss.index!==2||S.activeDays!==30||S.lastActive!==today()||S.lastActivityDay!==today()||
       S.challengeClears!==19||S.achievements.join()!=='mission1'||S.totalMissions!==0||
       S.packsOpened!==0||S.packMisses!==0||S.completedToday!==0||Object.keys(S.done).length||
       S.shopStock!==null||S.missionScale!==100||S.exerciseEnabled.length!==EXERCISES.length||
       S.weeklyRewards!==0||S.journeyStartDays!==30||S.battleUpdated!==1000) return false;
    claimJourneyRewards();if(S.weeklyRewards!==0||S.coins!==0) return false;
    if(!validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`S.level===1&&S.streak===30&&S.prestige.points===10&&S.owned.length===0&&S.journeyStartDays===30`),true);
  assert.equal(restored.run(`(() => {
    ACHIEVEMENTS.length=0;S.battleUpdated=Date.now();completeMission(byId(S.active[0]));
    return S.streak===30&&S.activeDays===30&&S.tower.keys===4&&S.weeklyRewards===0;
  })()`),true);
});

test('prestige preserves challenge progress and attack limits when returning to normal', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=80;S.battleUpdated=1000;
    S.tower={floor:20,round:0,hp:towerMaxHp(20)*.4,keys:3,lastAttack:today(),torment:0,rewardTorment:0};
    S.weeklyBoss={index:1,hp:bossBaseHp(1)*.6,lastAttackDay:today(),lastAttackWeek:weekStart(today()),
      weekAttacks:2,hits:2,torment:0,rewardTorment:0};
    selectTorment(5,1000);
    if(!performPrestige(1000)||Math.abs(S.tower.hp/towerMaxHp(20)-.4)>1e-8||
       Math.abs(S.weeklyBoss.hp/bossBaseHp(1)-.6)>1e-8||
       S.tower.torment!==0||S.weeklyBoss.torment!==0||S.tower.rewardTorment!==0||
       S.weeklyBoss.rewardTorment!==0||S.tower.keys!==3||S.weeklyBoss.hits!==2||
       attackTower(today())||attackWeeklyBoss(today())) return false;
    save();return validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
  assert.equal(game(g.saved()).run(`S.tower.floor===20&&S.tower.keys===3&&
    S.weeklyBoss.index===1&&S.weeklyBoss.weekAttacks===2`),true);
});

test('prestige nodes require connected paths and multiply bonuses and rewards', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=50;S.battleUpdated=1000;
    if(!performPrestige(1000)||S.prestige.points!==5||unlockPrestige('dmg-2',1000)||
       unlockPrestige('toString',1000)||!unlockPrestige('dmg-1',1000)||
       unlockPrestige('dmg-1',1000)||!unlockPrestige('dmg-2',1000)||!unlockPrestige('all-1',1000)) return false;
    if(Math.abs(bonus('dmg')-1.7)>1e-8||Math.abs(bonus('xp')-1.2)>1e-8||
       Math.abs(bonus('coin')-1.2)>1e-8||materialReward(100)!==120||prestigePointsAvailable()!==2) return false;
    S.activeDays=3;claimJourneyRewards(0);
    if(S.coins!==Math.round(38*1.2)||S.materials!==Math.round(4*1.2)) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`prestigePointsAvailable()===2&&Math.abs(bonus('dmg')-1.7)<1e-8&&resetPrestigeTree(1000)&&prestigePointsAvailable()===5&&bonus('dmg')===1`),true);
});

test('prestige saves migrate legacy state and reject corrupt points or paths', () => {
  const first=game();first.run(`S=fresh();delete S.prestige;save()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`(() => {
    if(S.prestige.count!==0||S.prestige.points!==0||!validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    S.prestige={count:1,points:5,nodes:['dmg-2']};
    if(validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    S.prestige.nodes=['dmg-1','dmg-1'];if(validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    S.prestige.nodes=['dmg-1'];S.prestige.points=0;
    return !validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
});

test('expanded prestige map preserves the original nodes and has reachable non-overlapping clusters', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    if(PRESTIGE_NODES.length!==330||PRESTIGE_NODES.filter(n=>n.major).length!==30||
       new Set(PRESTIGE_NODES.map(n=>n.id)).size!==330) return false;
    for(const branch of PRESTIGE_BRANCHES) for(let i=1;i<=10;i++){
      const node=PRESTIGE_BY_ID[branch.id+'-'+i];
      const amount=branch.stat==='crit'?1:branch.stat==='critDamage'?5:branch.stat==='offline'?.5:PRESTIGE_AMOUNTS[i-1];
      if(!node||node.amount!==amount||node.requires!==(i===1?null:branch.id+'-'+(i-1))||
         PRESTIGE_BY_ID[branch.id+'-extra-'+i].requires!==node.id) return false;
    }
    for(const [i,node] of PRESTIGE_NODES.entries()){
      if(node.requires&&!PRESTIGE_BY_ID[node.requires]) return false;
      const radius=node.major?29:18;
      if(node.x-radius<0||node.y-radius<0||node.x+radius>PRESTIGE_MAP_SIZE||node.y+radius>PRESTIGE_MAP_SIZE) return false;
      for(const other of PRESTIGE_NODES.slice(i+1)){
        if(Math.hypot(node.x-other.x,node.y-other.y)<radius+(other.major?29:18)) return false;
      }
    }
    ACHIEVEMENTS.length=0;S=fresh();S.battleUpdated=1000;S.prestige={count:1,points:330,nodes:[]};
    for(const node of PRESTIGE_NODES) if(!unlockPrestige(node.id,1000)) return false;
    return prestigePointsAvailable()===0&&validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
});

test('prestige links follow their prerequisites without crossing unrelated nodes or paths', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const segments=[];
    for(const node of PRESTIGE_NODES){
      const points=prestigeLinkPoints(node);
      if(points[points.length-1]!==node || (node.requires&&points[0]!==PRESTIGE_BY_ID[node.requires])) return false;
      if(node.via&&PRESTIGE_BY_ID[node.requires].requires!==node.via) return false;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
        if(!den) return false;
        for(const other of PRESTIGE_NODES){
          if(other===a||other===b) continue;
          const t=Math.max(0,Math.min(1,((other.x-a.x)*dx+(other.y-a.y)*dy)/den));
          if(Math.hypot(other.x-a.x-t*dx,other.y-a.y-t*dy)<(other.major?29:18)+1) return false;
        }
        segments.push({a,b});
      }
    }
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(let i=0;i<segments.length;i++) for(let j=i+1;j<segments.length;j++){
      const p=segments[i],q=segments[j];
      if([p.a,p.b].some(a=>[q.a,q.b].some(b=>Math.hypot(a.x-b.x,a.y-b.y)<.001))) continue;
      if(cross(p.a,p.b,q.a)*cross(p.a,p.b,q.b)<-1e-5&&
         cross(q.a,q.b,p.a)*cross(q.a,q.b,p.b)<-1e-5) return false;
    }
    return true;
  })()`),true);
});

test('prestige zoom is limited and adapts to a larger viewport', () => {
  const elements=Object.fromEntries(['prestige-scroll','prestige-canvas','prestige-map','prestige-zoom-out',
    'prestige-zoom-in','prestige-zoom-reset','prestige-tooltip'].map(id=>[id,{
    style:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(type,handler){this[type]=handler;}
  }]));
  const scroll=elements['prestige-scroll'];
  Object.assign(scroll,{clientWidth:1000,clientHeight:680,scrollLeft:900,scrollTop:900});
  let resize;
  const size=game().run('PRESTIGE_MAP_SIZE');
  const context=vm.createContext({
    $:id=>elements[id],PRESTIGE_MAP_SIZE:size,
    ResizeObserver:class {constructor(callback){resize=callback;} observe(){}}
  });
  vm.runInContext(script.slice(script.indexOf("const prestigeScroll=$('prestige-scroll');"),script.indexOf('let prestigeDrag=')),context);
  vm.runInContext('setPrestigeZoom(.1)',context);
  assert.equal(vm.runInContext('prestigeZoom',context),.5);
  assert.equal(elements['prestige-zoom-out'].disabled,true);
  assert.equal(elements['prestige-canvas'].style.width,`${size*.5}px`);
  scroll.clientWidth=size*.75;resize();
  assert.equal(vm.runInContext('prestigeZoom',context),.75);
  assert.equal(elements['prestige-canvas'].style.width,`${size*.75}px`);
  assert.equal(elements['prestige-zoom-out'].disabled,true);
  vm.runInContext('setPrestigeZoom(2)',context);
  assert.equal(vm.runInContext('prestigeZoom',context),1.5);
  assert.equal(elements['prestige-zoom-in'].disabled,true);
  scroll.clientWidth=1000;resize();
  vm.runInContext('setPrestigeZoom(.1)',context);
  assert.equal(vm.runInContext('prestigeZoom',context),.5);
});

test('ascension nodes combine distinct bonuses, enforce paths and persist through reload', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.battleUpdated=1000;S.prestige={count:1,points:100,nodes:[]};
    if(unlockPrestige('dmg-ascension-1',1000)||unlockPrestige('dmg-ascension-major',1000)) return false;
    for(let i=1;i<=10;i++) if(!unlockPrestige('dmg-'+i,1000)) return false;
    if(!unlockPrestige('dmg-major-2',1000)) return false;
    const base=prestigeMultiplier('dmg');
    for(let i=1;i<=10;i++) if(!unlockPrestige('dmg-ascension-'+i,1000)) return false;
    if(!unlockPrestige('dmg-ascension-major',1000)||
       Math.abs(prestigeMultiplier('dmg')-(base+4.75))>1e-8||criticalBonus()!==76) return false;
    for(let i=1;i<=10;i++) if(!unlockPrestige('xp-'+i,1000)) return false;
    if(!unlockPrestige('xp-major-2',1000)||!unlockPrestige('xp-ascension-1',1000)||
       offlineLimit()!==8.25*3600000) return false;
    save();return validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    if(criticalBonus()!==76||offlineLimit()!==8.25*3600000) return false;
    S.prestige.nodes=S.prestige.nodes.filter(id=>id!=='dmg-ascension-5');
    if(validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    return resetPrestigeTree(1000)&&criticalBonus()===0&&offlineLimit()===OFFLINE_LIMIT;
  })()`),true);
});

test('celestial executioner improves tower and boss damage without changing arena damage', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.battleUpdated=1000;S.prestige={count:1,points:20,nodes:[]};
    for(let i=1;i<=10;i++) if(!unlockPrestige('critDamage-'+i,1000)) return false;
    if(!unlockPrestige('critDamage-major-2',1000)||!unlockPrestige('critDamage-ascension-1',1000)||
       prestigeMultiplier('challengeDamage')!==1.25||battleDamage()!==2) return false;
    S.tower.floor=50;S.tower.hp=towerMaxHp(50);S.tower.torment=0;S.tower.keys=1;
    const towerHp=S.tower.hp;
    if(!attackTower('2026-01-05')||Math.abs(S.tower.hp-(towerHp-30))>1e-8) return false;
    const boss=bossFor(S.weeklyBoss.index),hp=bossBaseHp(S.weeklyBoss.index);
    const expected=50*(1-effectiveBossResistance(boss,hp,hp,0,false));
    if(!attackWeeklyBoss('2026-01-05')||Math.abs(S.weeklyBoss.hp-(hp-expected))>1e-8) return false;
    return resetPrestigeTree(1000)&&challengeDamage(24)===24&&battleDamage()===2;
  })()`),true);
});

test('prestige saves containing all previous nodes remain valid and keep their effects', () => {
  const g=game();
  g.run(`S=fresh();S.prestige={count:1,points:230,nodes:PRESTIGE_NODES.filter(node=>!node.effects).map(node=>node.id)};save()`);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    if(!validateBackup({format:'fitquest-save',version:1,state:S})||S.prestige.nodes.length!==220||
       prestigePointsAvailable()!==10||prestigeValue('crit')!==19||
       prestigeValue('critDamage')!==120||prestigeValue('offline')!==9.5) return false;
    return unlockPrestige('dmg-ascension-1',1000)&&prestigePointsAvailable()===9;
  })()`),true);
});

test('legacy prestige saves retain bonuses and new nodes require their original paths', () => {
  const old=game();
  old.run(`S=fresh();S.battleUpdated=1000;S.prestige={count:1,points:110,nodes:PRESTIGE_BRANCHES.flatMap(b=>Array.from({length:10},(_,i)=>b.id+'-'+(i+1)))};save()`);
  const restored=game(old.saved());
  assert.equal(restored.run(`(() => {
    ACHIEVEMENTS.length=0;
    if(!validateBackup({format:'fitquest-save',version:1,state:S})||prestigePointsAvailable()!==10||
       Math.abs(prestigeMultiplier('dmg')-23.8)>1e-8||prestigeValue('crit')!==10||
       prestigeValue('critDamage')!==50||prestigeValue('offline')!==5) return false;
    if(!unlockPrestige('dmg-extra-1',1000)||!unlockPrestige('dmg-major-1',1000)||
       !unlockPrestige('crit-extra-1',1000)||!unlockPrestige('critDamage-major-1',1000)||
       !unlockPrestige('arenaDamage-major-2',1000)||!unlockPrestige('arenaLoot-extra-1',1000)||
       !unlockPrestige('offline-extra-1',1000)||!unlockPrestige('offline-major-1',1000)) return false;
    if(Math.abs(prestigeMultiplier('dmg')-24.9)>1e-8||prestigeValue('crit')!==10.5||
       prestigeValue('critDamage')!==70||prestigeMultiplier('arenaDamage')!==14.2||
       Math.abs(prestigeMultiplier('arenaLoot')-12.5)>1e-8||prestigeValue('offline')!==6.25) return false;
    save();return validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
  const reloaded=game(restored.saved());
  assert.equal(reloaded.run(`(() => {
    if(prestigePointsAvailable()!==2||prestigeValue('offline')!==6.25) return false;
    if(!resetPrestigeTree(1000)||prestigePointsAvailable()!==110||
       unlockPrestige('dmg-extra-1',1000)||unlockPrestige('dmg-major-1',1000)) return false;
    S.prestige.nodes=['dmg-extra-1'];return !validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
});

test('repeated prestige accumulates points and completed branches stack multiplicatively', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=150;S.battleUpdated=1000;
    if(!performPrestige(1000)||S.prestige.points!==15||performPrestige(1000)) return false;
    S.level=150;if(!performPrestige(1000)||S.prestige.points!==30||S.prestige.count!==2) return false;
    for(const node of PRESTIGE_NODES.filter(node=>['dmg','xp','coin','materials','all'].includes(node.stat)&&
      Number(node.id.split('-')[1])<=6)) if(!unlockPrestige(node.id,1000)) return false;
    if(prestigePointsAvailable()!==0||Math.abs(bonus('dmg')-8)>1e-8||
       Math.abs(bonus('xp')-8)>1e-8||Math.abs(bonus('coin')-8)>1e-8||
       materialReward(100)!==800||heroPower()<=1) return false;
    return validateBackup({format:'fitquest-save',version:1,state:S});
  })()`),true);
});

test('expanded prestige bonuses affect combat, loot and offline time and survive reload', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=200;S.battleUpdated=1000;
    if(!performPrestige(1000)) return false;
    for(const id of ['crit-1','crit-2','critDamage-1','arenaDamage-1','arenaLoot-1','offline-1'])
      if(!unlockPrestige(id,1000)) return false;
    if(criticalChance()!==2||criticalBonus()!==5||battleDamage()!==2.4||
       battleLoot()!==1.2||offlineLimit()!==8.5*3600000||bonus('dmg')!==1) return false;
    S.level=100;S.skills={precision:20,impact:5,execution:5,deadeye:1,hunter:1};S.passives.hunt1=5;S.skillStyle='hunter';
    if(criticalChance()!==44) return false;
    S.skills.focus=20;S.passives.hunt2=3;S.passives.hunt3=5;
    if(criticalChance()!==69) return false;
    for(let i=3;i<=10;i++) if(!unlockPrestige('crit-'+i,1000)) return false;
    if(criticalChance()!==75||!validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    save();return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`criticalChance()===75&&battleDamage()===2*.85*1.2&&offlineLimit()===8.5*3600000`),true);
  assert.equal(restored.run(`resetPrestigeTree(1000)&&criticalChance()===67&&battleLoot()===1&&offlineLimit()===OFFLINE_LIMIT`),true);
});

test('passive backup validation rejects locked, invalid or overspent progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=60;const backup=()=>({format:'fitquest-save',version:1,state:S});
    S.passives={war2:1};if(validateBackup(backup())) return false;
    S.passives={war1:6};if(validateBackup(backup())) return false;
    S.passives={war1:5,hunt1:5,wealth1:2};if(validateBackup(backup())) return false;
    S.passives={war1:5};S.subclass='oracle';if(validateBackup(backup())) return false;
    S.subclass='unknown';if(validateBackup(backup())) return false;
    S.passives={war1:1};S.subclass=null;S.level=49;
    return !validateBackup(backup());
  })()`),true);
});

test('passive upgrades settle arena progress before applying bonuses and affect challenge attacks', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=50;S.battleUpdated=1000;S.autoMonsterHp=50;S.tower.keys=1;
    if(!unlockPassive('war1',11000) || Math.abs(S.autoMonsterHp-48)>1e-8) return false;
    if(Math.abs(battleDamage()-2.06)>1e-8) return false;
    S.tower.hp=100;S.tower.torment=0;
    if(!attackTower('2026-01-05') || Math.abs(S.tower.hp-(100-24*1.03))>1e-8) return false;
    resetPassives(21000);
    return Math.abs(S.autoMonsterHp-(48-2.06))<1e-8 && battleDamage()===2 && passivePoints()===1;
  })()`),true);
});

test('critical and fragment skills affect combat and rewards', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=20;S.battleUpdated=1000;
    for(let i=0;i<5;i++) unlockSkill('precision',1000);
    unlockSkill('impact',1000);
    for(let i=0;i<5;i++) unlockSkill('fortune',1000);
    for(let i=0;i<5;i++) unlockSkill('prosperity',1000);
    unlockSkill('salvage',1000);
    if(criticalChance()!==5 || materialReward(100)!==102) return false;
    Math.random=()=>0;
    if(Math.abs(criticalDamage(100)-153)>1e-8) return false;
    Math.random=()=>0.5;
    return criticalDamage(100)===100;
  })()`),true);
});

test('new nodes require five ranks but legacy unlocked nodes remain usable and restorable', () => {
  const first=game();
  first.run(`S=fresh();S.level=30;S.skills={might:1,blade:1,fury:1,legend:1,berserker:1};S.skillStyle='berserker';save()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`(() => {
    if(!validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    if(!unlockSkill('legend')||S.skills.legend!==2||S.skillStyle!=='berserker') return false;
    resetSkills();
    if(!unlockSkill('might') || unlockSkill('blade')) return false;
    for(let i=1;i<5;i++) if(!unlockSkill('might')) return false;
    return unlockSkill('blade') && !unlockSkill('fury');
  })()`),true);
});

test('critical feedback reports only actual critical damage for manual and arena attacks', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=30;S.skills.precision=20;S.tower.keys=1;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    Math.random=()=>0;let damage=null;
    if(!attackTower('2026-01-05',value=>damage=value) || damage!==24*bonus('dmg')*1.5) return false;
    const result=settleBattle(11000);
    if(result.ticks!==1 || result.lastCritical!==battleDamage()*1.5) return false;
    Math.random=()=>.99;damage=null;
    if(!attackWeeklyBoss('2026-01-05',value=>damage=value) || damage!==null) return false;
    return settleBattle(21000).lastCritical===null;
  })()`),true);
});

test('skill specializations, critical cap and refunds preserve arena timing and points', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=200;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    for(const id of ['precision','impact','focus','execution','deadeye']){
      const count=id==='precision'||id==='focus'?20:id==='deadeye'?18:5;
      for(let i=0;i<count;i++) if(!unlockSkill(id,1000)) return false;
    }
    if(criticalChance()!==75 || !unlockSkill('hunter',1000) || S.skillStyle!=='hunter' ||
       criticalChance()!==75 || criticalBonus()!==65) return false;
    const hunter=bonus('dmg');
    if(!selectSkillStyle(null,1000) || hunter>=bonus('dmg') || selectSkillStyle('berserker',1000)) return false;
    const total=S.level+Math.floor(S.level/10);
    if(!selectSkillStyle('hunter',1000)) return false;
    resetSkills(11000);
    return S.autoMonsterHp<autoMaxHp(S.autoKills,S.autoTorment) && S.skillStyle===null &&
      skillPoints()===total && Object.keys(S.skills).length===0;
  })()`),true);
});

test('hunter criticals pierce boss resistance and seeker can duplicate mission fragments', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.skills={precision:1,impact:1,focus:1,execution:1,deadeye:1,hunter:1};
    S.skillStyle='hunter';S.weeklyBoss.index=3;S.weeklyBoss.hp=650;S.weeklyBoss.torment=0;
    Math.random=()=>0;
    const damage=40*bonus('dmg')*(1.5+criticalBonus()/100);
    if(!attackWeeklyBoss('2026-01-05') || Math.abs(S.weeklyBoss.hp-(650-damage))>1e-8) return false;
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.skills={fortune:1,prosperity:1,salvage:1,treasure:1,seeker:1};S.skillStyle='seeker';
    S.encounter={kind:'elite',species:0,maxHp:100,torment:0};S.monsterHp=1;hit(1);
    return S.materials===materialReward(2)*2;
  })()`),true);
});

test('arena health migration keeps saved health percentage once', () => {
  const first=game();
  first.run(`S=fresh();S.autoKills=1000;S.autoTorment=2;S.torment=2;S.level=20;
    S.autoMonsterHp=oldArenaHp(1000)*TORMENTS[2].hp*.37;delete S.arenaBalanceVersion;save()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`Math.abs(S.autoMonsterHp/autoMaxHp(1000,2)-.37)<1e-10 && S.arenaBalanceVersion===1`),true);
  restored.run('save()');
  assert.equal(game(restored.saved()).run(`Math.abs(S.autoMonsterHp/autoMaxHp(1000,2)-.37)<1e-10`),true);
});

test('level curve migration preserves the level and XP fraction exactly once', () => {
  const first=game();
  first.run(`S=fresh();S.level=80;S.xp=Math.floor(oldXpNeeded(80)*.4);delete S.levelBalanceVersion;save()`);
  const saved=first.saved(),restored=game(saved);
  const expected=Math.round(saved.xp / restored.run('oldXpNeeded(80)') * restored.run('xpNeeded(80)'));
  assert.equal(restored.run('S.level'),80);
  assert.equal(restored.run('S.xp'),expected);
  restored.run('save()');
  assert.equal(game(restored.saved()).run('S.xp'),expected);
});

test('upgrade costs grow faster without reducing existing ranks or early affordability', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();
    if(attributeCost(0)!==100 || attributeCost(1)!==150 || attributeCost(100)<=5100) return false;
    S.battleUpgrades.damage=100;
    if(battleUpgradeCost('damage')<=5100 || battleDamage()!==102) return false;
    S.battleUpgrades.speed=1;
    return battleUpgradeCost('speed')===375;
  })()`),true);
});

test('combat reward per enemy health rises with torment and divine drops remain rare', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    for(let i=1;i<TORMENTS.length;i++) if(combatReward(i)/TORMENTS[i].hp<=combatReward(i-1)/TORMENTS[i-1].hp) return false;
    const normal=packOdds(PACKS[3],120,0)[6],high=packOdds(PACKS[3],120,12)[6];
    return normal===.015 && high>normal && high<.033 && monsterHp(1000)<500000 && monsterHp(1000)>100000;
  })()`),true);
});

test('partial challenge rewards are proportional to damage and respect attack limits', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    S.tower.floor=100;S.tower.hp=towerMaxHp(100);S.tower.keys=2;
    const before=S.tower.hp,damage=24*bonus('dmg'),coin=bonus('coin');
    if(!attackTower('2026-01-05') || S.coins!==Math.floor(520*coin*.2*damage/before)) return false;
    const coins=S.coins;if(attackTower('2026-01-05')||S.coins!==coins) return false;
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    selectTorment(12,1000);const max=Math.round(180*TORMENTS[12].hp),hit=40*bonus('dmg');
    if(!attackWeeklyBoss('2026-01-05')||S.coins!==Math.floor(250*bonus('coin')*.2*hit/max*combatReward(12))) return false;
    const prior=S.coins;return !attackWeeklyBoss('2026-01-05') && S.coins===prior;
  })()`),true);
});

test('partial tower and boss rewards include skill, passive and subclass fragment bonuses', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    ACHIEVEMENTS.length=0;S=fresh();S.level=100;
    S.skills={salvage:5};S.passives={wealth3:5};S.subclass='oracle';
    S.attributes.dmg=500;S.tower.floor=100;S.tower.hp=224;S.tower.torment=0;S.tower.keys=1;
    if(!attackTower('2026-01-05') || S.materials!==2) return false;
    S.materials=0;S.attributes.dmg=300;S.weeklyBoss.hp=180;S.weeklyBoss.torment=0;
    return attackWeeklyBoss('2026-01-05') && S.weeklyBoss.hp===20 && S.materials===3;
  })()`),true);
});

test('mission preferences update targets without drift and preserve partial progress', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;const ex=byId(S.active[0]),initial=missionTarget(ex);S.done[ex.id]=3;
    if(!setMissionScale(50)||missionTarget(ex)!==Math.ceil(initial/2)||S.done[ex.id]!==3) return false;
    selectTorment(12);if(missionTarget(ex)!==Math.ceil(initial*.5-1e-10)) return false;
    for(let i=0;i<10;i++){setMissionScale(75);setMissionScale(50)}
    setMissionScale(100);selectTorment(0);
    if(missionTarget(ex)!==initial || S.done[ex.id]!==3 || setMissionScale(0)) return false;
    S.exerciseEnabled=EXERCISES.slice(0,7).map(ex=>ex.id);
    return S.exerciseEnabled.includes(randomMission(S.exerciseEnabled.slice(0,6),S.exerciseEnabled));
  })()`),true);
});

test('backup validation accepts exported state and rejects damaged or incompatible saves', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();const backup={format:'fitquest-save',version:1,state:JSON.parse(JSON.stringify(S))};
    if(!validateBackup(backup)) return false;
    backup.state.level=-1;if(validateBackup(backup)) return false;
    backup.state.level=1;backup.state.battleUpgrades.speed=999;if(validateBackup(backup)) return false;
    backup.state.battleUpgrades.speed=0;backup.state.skills.blade=1;if(validateBackup(backup)) return false;
    backup.state.skills={};backup.state.owned=['missing'];if(validateBackup(backup)) return false;
    backup.state.owned=[];backup.version=2;return !validateBackup(backup);
  })()`),true);
});

test('new progression counters validate while legacy saves remain importable', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();const backup={format:'fitquest-save',version:1,state:JSON.parse(JSON.stringify(S))},s=backup.state;
    for(const key of ['packMisses','journeyRound','journeyStartDays','restWeek','restDays']) delete s[key];
    delete s.tower.round;delete s.weeklyBoss.lastAttackDay;delete s.weeklyBoss.weekAttacks;
    if(!validateBackup(backup)) return false;
    s.packMisses=21;if(validateBackup(backup)) return false;
    s.packMisses=20;s.tower.round=-1;if(validateBackup(backup)) return false;
    s.tower.round=0;s.journeyRound=1;if(validateBackup(backup)) return false;
    s.journeyRound=0;s.restWeek='2026-01-05';s.restDays=['bad'];
    if(validateBackup(backup)) return false;
    s.restDays=['2026-01-05','2026-01-06'];return validateBackup(backup);
  })()`),true);
});

test('torment rewards are capped by the lowest difficulty used for enemy damage', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    hit(25);selectTorment(12,1000);S.monsterHp=1;hit(1);
    if(S.coins!==Math.round(10*bonus('coin'))) return false;
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    S.tower.floor=100;S.tower.hp=towerMaxHp(100);S.tower.keys=2;if(!attackTower('2026-01-05')) return false;
    selectTorment(12,1000);S.tower.hp=1;const coins=S.coins;
    if(!attackTower('2026-01-06')||S.coins-coins!==Math.round(520*bonus('coin'))) return false;
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);S.battleUpdated=1000;
    selectTorment(12,1000);S.monsterHp=1;hit(1);
    return S.coins===Math.round(10*bonus('coin')*combatReward(12));
  })()`),true);
});

test('bosses have distinct resistance conditions and cycle to stronger new encounters', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const opening=WEEKLY_BOSSES[1],alternate=WEEKLY_BOSSES[2],wounded=WEEKLY_BOSSES[4];
    if(bossResistance(opening,90,100,0)!==.1||bossResistance(opening,50,100,0)!==0 ||
      bossResistance(alternate,90,100,0)!==.15||bossResistance(alternate,90,100,1)!==0 ||
      bossResistance(wounded,90,100,0)!==0||bossResistance(wounded,50,100,0)!==.2) return false;
    S=fresh();S.achievements=ACHIEVEMENTS.map(a=>a.id);S.weeklyBoss.index=WEEKLY_BOSSES.length-1;
    S.weeklyBoss.torment=0;S.weeklyBoss.hp=1;
    if(!attackWeeklyBoss('2026-01-05')) return false;
    return S.weeklyBoss.index===WEEKLY_BOSSES.length && S.weeklyBoss.hp===Math.round(WEEKLY_BOSSES[0].hp*1.5);
  })()`),true);
});

test('new mission targets use their unrounded base regardless of torment', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;selectTorment(12);
    const ex=byId(S.active[2]);
    delete S.targets[ex.id];delete S.missionTargetReferences[ex.id];
    const base=target(ex,S.level)*DIFFICULTIES[missionDifficulty(ex)].target;
    if(missionTarget(ex)!==Math.ceil(base)) return false;
    selectTorment(0);
    return missionTarget(ex)===Math.ceil(base);
  })()`),true);
});

test('legacy mission targets migrate once with references, estimates and preserved progress', () => {
  const first=game();
  first.run(`(() => {
    S=fresh();S.level=120;S.torment=12;S.missionScale=75;
    const [a,b,c]=S.active;
    S.targets[a]=48;S.missionTorments[a]=12;
    S.missionTargetReferences[a]={target:40.2,torment:0,scale:100};S.done[a]=8;
    S.targets[b]=32;S.missionTorments[b]=12;S.done[b]=23;
    S.targets[c]=40;S.missionTorments[c]=4;
    S.missionTargetReferences[c]={target:30,torment:4,scale:100};
    delete S.independentMissionTargets;save();
  })()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`(() => {
    const [a,b,c]=S.active;
    if(S.targets[a]!==31||S.targets[b]!==23||S.targets[c]!==19||
       S.done[a]!==8||S.done[b]!==23||S.missionTorments[a]!==12) return false;
    setMissionScale(100);
    if(S.targets[a]!==41||S.targets[b]!==27||S.targets[c]!==25) return false;
    setMissionScale(50);if(S.targets[b]!==23) return false;
    const missions=S.totalMissions;completeMission(byId(b));
    if(S.totalMissions!==missions+1||S.active.includes(b)) return false;
    save();return true;
  })()`),true);
  const saved=restored.saved(),again=game(saved);
  again.run('save()');
  assert.deepEqual(again.saved().targets,saved.targets);
  assert.equal(again.saved().totalMissions,saved.totalMissions);
});

test('streak survives long inactivity and increases only once per active day', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.streak=7;S.day='2020-01-01';S.lastActive='2020-01-01';
    S.battleUpdated=Date.now();S.monsterHp=1e9;
    rollDay();if(S.streak!==7) return false;
    completeMission(byId(S.active[0]));
    if(S.streak!==8||S.lastActive!==today()) return false;
    completeMission(byId(S.active[0]));
    save();return S.streak===8;
  })()`),true);
  assert.equal(game(g.saved()).run('S.streak'),8);
});

test('tower guardians apply conditional resistance and report effective critical damage', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    const dawn=towerGuardian(25,1),dusk=towerGuardian(50,1);
    if(towerGuardian(25,0)||towerGuardian(24,1)||
      bossResistance(dawn,51,100,0)!==.15||bossResistance(dawn,50,100,0)!==0||
      bossResistance(dusk,51,100,0)!==0||bossResistance(dusk,50,100,0)!==.2||
      bossResistance(towerGuardian(75,1),20,100,0)!==.12||
      bossResistance(towerGuardian(100,1),20,100,0)!==.25) return false;
    ACHIEVEMENTS.length=0;S=fresh();S.tower.round=1;S.tower.floor=100;S.tower.hp=towerMaxHp(100);
    S.tower.torment=0;S.tower.keys=2;S.skills.precision=5;Math.random=()=>0;
    let reported=0;if(!attackTower('2026-01-01',d=>reported=d)||reported!==27) return false;
    S.skillStyle='hunter';reported=0;
    return attackTower('2026-01-02',d=>reported=d)&&Math.abs(reported-35.7)<1e-8;
  })()`),true);
});

test('endgame milestones award exclusive copies once, with valid saves and ordinary loot unaffected', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=120;S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.tower.round=1;S.tower.floor=25;S.tower.hp=1;S.tower.torment=0;S.tower.keys=1;
    if(!attackTower('2026-01-01')||!S.owned.includes('tower_relic')||S.tower.floor!==26) return false;
    S.journeyRound=1;S.weeklyRewards=52;S.journeyStartDays=0;S.activeDays=52;
    const materials=S.materials;claimJourneyRewards(1);
    const ordinary=Array.from({length:13},(_,i)=>materialReward((3+Math.min(i+1,20))*1.25*TORMENTS[1].reward)).reduce((a,b)=>a+b,0);
    if(S.weeklyRewards!==65||S.materials-materials!==ordinary+materialReward(38*1.25*TORMENTS[1].reward)||
       !S.owned.includes('journey_relic')) return false;
    claimJourneyRewards(1);if(S.owned.filter(id=>itemTypeId(id)==='journey_relic').length!==1) return false;
    addItem('tower_relic');if(!autoEquipItem('tower_relic')||!dismantle('tower_relic#1')) return false;
    if(ITEMS.some(item=>item.id==='tower_relic'||item.id==='journey_relic')||
       !validateBackup({format:'fitquest-save',version:1,state:S})) return false;
    ensureShopStock();if(S.shopStock.offers.some(id=>id==='tower_relic'||id==='journey_relic')) return false;
    S.materials+=8000;
    for(let i=0;i<20;i++) if(craftItem('sword',3).id.startsWith('tower_relic')) return false;
    for(let i=0;i<100;i++) if(samplePackItem(PACKS[3]).id.startsWith('tower_relic')) return false;
    save();return true;
  })()`),true);
  const saved=g.saved(),restored=game(saved);
  assert.equal(restored.run(`S.eq.sword==='tower_relic'&&S.owned.includes('journey_relic')&&
    validateBackup({format:'fitquest-save',version:1,state:S})`),true);
  restored.run('claimJourneyRewards(1);save()');
  assert.deepEqual(restored.saved().owned,saved.owned);
});

test('a newly assigned mission and its torment are saved immediately', () => {
  const g=game();
  g.run(`S=fresh(); S.level=120; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.monsterHp=1000000; selectTorment(12); completeMission(byId(S.active[0]));`);
  const saved=g.saved(),id=saved.active[0];
  assert.equal(saved.missionTorments[id],12);
  assert.ok(saved.targets[id]>0);
  assert.equal(game(saved).run(`S.missionTorments['${id}']`),12);
});

test('torment scales journey and achievement currency but not keys or item copies', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=120; S.activeDays=3;
    claimJourneyRewards(12);
    if(S.coins!==Math.round(38*22.5) || S.materials!==Math.round(4*22.5)) return false;
    S=fresh(); S.level=120; S.totalMissions=30;
    const a=ACHIEVEMENTS.find(a=>a.id==='missions-30');
    S.achievements=ACHIEVEMENTS.filter(entry=>entry!==a).map(entry=>entry.id);
    unlockAchievements(12);
    if(S.coins!==Math.round(a.reward.coins*22.5) ||
      S.materials!==Math.round(a.reward.materials*22.5)) return false;
    const b={id:'test-reward',name:'test',goal:1,value:()=>1,stat:'xp',pct:1,
      reward:{keys:2,item:'sword_0_0'}};
    ACHIEVEMENTS.push(b); S.owned.push('sword_0_0');
    const materials=S.materials; unlockAchievements(12); ACHIEVEMENTS.pop();
    return S.tower.keys===2 && S.materials===materials && S.owned.includes('sword_0_0#1');
  })()`),true);
});

test('global torment migration preserves old mission targets and monster health', () => {
  const first=game();
  first.run(`S=fresh(); S.level=120; S.torment=4; S.active=['squat','push','plank','abs','jack','lunge'];
    S.targets.squat=37; S.done.squat=12; S.monsterHp=17; S.autoMonsterHp=23;
    delete S.missionTorments; delete S.autoTorment; delete S.encounter.torment; save()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`(() => {
    if(S.monsterHp!==17 || S.autoMonsterHp!==23 || S.encounter.torment!==0 ||
      S.autoTorment!==0 || S.missionTorments.squat!==0 || missionTarget(byId('squat'))!==37) return false;
    return S.done.squat===12 && S.torment===4;
  })()`),true);
});

test('tower torment changes immediately and persists health and rewards', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=40; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    S.tower.floor=50; S.tower.hp=towerMaxHp(50); S.tower.keys=2;
    selectTorment(4);
    const hp=Math.round(towerMaxHp(50)*6)-24*bonus('dmg');
    if(!attackTower('2026-01-05') || S.tower.torment!==4 || S.tower.hp!==hp) return false;
    selectTorment(0);
    if(S.tower.torment!==0 || Math.abs(S.tower.hp-hp/6)>1e-8) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    const coins=S.coins+Math.round((20+50*5)*bonus('coin'));
    const xp=S.xp+Math.round((25+50*4)*bonus('xp')),materials=S.materials+7;
    S.tower.hp=1;
    if(!attackTower('2026-01-06') || S.coins!==coins || S.xp!==xp ||
      S.materials!==materials || S.tower.floor!==51 || S.tower.torment!==null) return false;
    return true;
  })()`),true);
});

test('boss torment changes immediately but rewards cannot exceed the lowest attacked torment', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=40; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    selectTorment(2);
    const hp=Math.round(WEEKLY_BOSSES[0].hp*2.5)-40*bonus('dmg');
    if(!attackWeeklyBoss('2026-01-05') || S.weeklyBoss.torment!==2 || S.weeklyBoss.hp!==hp) return false;
    selectTorment(4);
    if(S.weeklyBoss.torment!==4 || Math.abs(S.weeklyBoss.hp-hp/450*1080)>1e-8) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`(() => {
    const coins=S.coins+Math.round(250*bonus('coin')*combatReward(2)),xp=S.xp+Math.round(180*bonus('xp')*combatReward(2));
    const materials=S.materials+Math.round(15*combatReward(2));
    S.weeklyBoss.hp=1;
    return attackWeeklyBoss('2026-01-12') && S.coins===coins && S.xp===xp &&
      S.materials===materials && S.weeklyBoss.index===1 && S.weeklyBoss.torment===null;
  })()`),true);
});

test('legacy ongoing challenges preserve health percentage when changing torment', () => {
  const first=game();
  first.run(`S=fresh(); S.level=40; S.tower.floor=50; S.tower.hp=100; S.tower.keys=1;
    S.weeklyBoss.hp=170;
    delete S.tower.torment; delete S.weeklyBoss.torment; delete S.torment; save()`);
  const restored=game(first.saved());
  assert.equal(restored.run(`(() => {
    if(S.tower.torment!==0 || S.weeklyBoss.torment!==0 ||
      S.tower.hp!==100 || S.weeklyBoss.hp!==170) return false;
    S.achievements=ACHIEVEMENTS.map(a=>a.id);
    selectTorment(4);
    const dmg=bonus('dmg');
    if(!attackTower('2026-01-05') || !attackWeeklyBoss('2026-01-05')) return false;
    return S.tower.floor===50 && S.tower.torment===4 && Math.abs(S.tower.hp-(600-24*dmg))<1e-8 &&
      S.weeklyBoss.torment===4 && Math.abs(S.weeklyBoss.hp-(1020-40*dmg))<1e-8;
  })()`),true);
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

test('automatic equipment uses empty slots first and replaces first only when full', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.owned=['ring_0_0','ring_0_1','ring_0_2','sword_0_0','sword_0_1'];
    if(autoEquipItem('ring_0_3') || autoEquipItem('invalid'))return false;
    if(!autoEquipItem('ring_0_0') || !autoEquipItem('ring_0_1'))return false;
    if(S.eq.ring1!=='ring_0_0' || S.eq.ring2!=='ring_0_1' || autoEquipItem('ring_0_0'))return false;
    if(!autoEquipItem('ring_0_2') || S.eq.ring1!=='ring_0_2' || S.eq.ring2!=='ring_0_1' || !S.owned.includes('ring_0_0'))return false;
    if(!autoEquipItem('sword_0_0') || !autoEquipItem('sword_0_1'))return false;
    save(); return S.eq.sword==='sword_0_1' && S.owned.includes('sword_0_0');
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run('S.eq.ring1'),'ring_0_2');
  assert.equal(restored.run('S.eq.ring2'),'ring_0_1');
  assert.equal(restored.run('S.eq.sword'),'sword_0_1');
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

test('new incremental achievements unlock at thresholds and survive reload', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();
    const ids=['arena-victories-10','mission-victories-5','tower-floors-2','weekly-bosses-1',
      'collection-3','forge-ranks-2','arena-ranks-2','hero-attributes-3',
      'missions-legend-7500','packs-legend-750'];
    S.achievements=ACHIEVEMENTS.map(a=>a.id).filter(id=>!ids.includes(id));
    S.autoKills=9;S.missionKills=4;S.tower.floor=2;S.weeklyBoss.index=0;
    S.owned=['sword_0_0','shield_0_0'];S.forgeRanks.dmg=1;
    S.battleUpgrades.damage=1;S.attributes.dmg=2;S.totalMissions=7499;S.packsOpened=749;
    unlockAchievements();
    if(ids.some(id=>S.achievements.includes(id))) return false;
    S.autoKills++;S.missionKills++;S.tower.floor++;S.weeklyBoss.index++;
    addItem('ring_0_0');S.forgeRanks.dmg++;S.battleUpgrades.damage++;
    S.attributes.dmg++;S.totalMissions++;S.packsOpened++;
    unlockAchievements();
    if(ids.some(id=>!S.achievements.includes(id))) return false;
    const coins=S.coins,materials=S.materials;
    unlockAchievements();
    if(S.coins!==coins || S.materials!==materials) return false;
    save();return true;
  })()`),true);
  assert.equal(game(g.saved()).run(`S.achievements.includes('tower-floors-2') && S.achievements.includes('packs-legend-750')`),true);
});

test('buying training, forge, arena upgrades and store items saves newly earned achievements', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh();S.coins=100000;S.achievements=ACHIEVEMENTS.map(a=>a.id)
      .filter(id=>!['hero-attributes-1','forge-ranks-1','arena-ranks-1','collection-1'].includes(id));
    ensureShopStock();const id=S.shopStock.offers[0];
    if(!buyDailyItem(id) || !trainAttribute('dmg') || !buyForgeUpgrade('dmg') ||
      !buyBattleUpgrade('damage')) return false;
    if(!['hero-attributes-1','forge-ranks-1','arena-ranks-1','collection-1'].every(id=>S.achievements.includes(id))) return false;
    save();return true;
  })()`),true);
  assert.equal(game(g.saved()).run(`S.achievements.includes('collection-1') && S.achievements.includes('arena-ranks-1')`),true);
});

test('pack carousel varies its path while stopping within the winning card', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    Math.random=()=>0;const first=packReelLayout(1680);
    Math.random=()=>0.999999999;const last=packReelLayout(3840);
    return first.winner-first.start===24 && last.winner-last.start===52 && first.offset===-40 && last.offset===40 &&
      first.duration===3800 && last.duration===5200 &&
      first.padding*136-64>=1680/2+40 && last.padding*136-64>=3840/2+40 &&
      Math.abs(first.offset)<64 && Math.abs(last.offset)<64;
  })()`),true);
});

test('damage roulette is removed while ordinary packs remain', () => {
  assert.doesNotMatch(html, /Ruleta de daño|wheel-stage|wheel-list|wheel-result/);
  assert.match(html, /id="pack-list"/);
  assert.match(html, /id="pack-reel"/);
});

test('365 simulated activity days produce the annual milestone', () => {
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
      clock+=86400000;
    }
    return S.activeDays===365 && S.totalMissions===365 && S.achievements.includes('days365');
  })()`), true);
});

test('three activity days a week for a year produce 52 chapters and tower keys', () => {
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
      }
      clock+=86400000;
    }
    return S.activeDays===156 && S.weeklyRewards===52 && rewardChanges===52 &&
      S.tower.keys>=156 && S.materials>0;
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
    return ITEMS.length===218 && ITEM['ring_3_1'].name==='Anillo legendario' &&
      new Set(ITEMS.map(it=>it.id)).size===ITEMS.length &&
      [0,1,2,3].every(t=>ITEMS.filter(it=>it.tier===t).length===32) &&
      [4,5,6].every(t=>ITEMS.filter(it=>it.tier===t).length===30);
  })()`),true);
});

test('pack odds exclude locked rarities, sum to one and improve with higher packs', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    for(const level of [1,5,10,15,20,30,40]){
      for(const pack of PACKS){
        const odds=packOdds(pack,level);
        if(Math.abs(odds.reduce((a,b)=>a+b,0)-1)>1e-12 ||
          odds.some((chance,tier)=>chance<0 || (level<TIER_LVL[tier] && chance!==0))) return false;
      }
      const unlocked=PACKS.filter(pack=>pack.level<=level);
      for(let i=1;i<unlocked.length;i++){
        const lower=packOdds(unlocked[i-1],level),higher=packOdds(unlocked[i],level);
        for(let tier=1;tier<TIER_NAMES.length;tier++){
          if(higher.slice(tier).reduce((a,b)=>a+b,0)+1e-12<
            lower.slice(tier).reduce((a,b)=>a+b,0)) return false;
        }
      }
    }
    return packOdds(PACKS[0],1)[0]===1 &&
      packOdds(PACKS[0],39)[6]===0 && packOdds(PACKS[0],40)[6]>0;
  })()`),true);
});

test('packs enforce level and price and retain duplicate items without refunds', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=99; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    if(openPack('basic')!==null || openPack('missing')!==null || S.coins!==99) return false;
    S.coins=1000;
    if(openPack('silver')!==null || S.coins!==1000) return false;
    S.level=10;
    Math.random=()=>0;
    if(!openPack('basic') || S.coins!==900 || S.owned[0]!=='sword_0_0' || S.packsOpened!==1) return false;
    const message=openPack('basic');
    if(!message.includes('añadido al inventario') || S.coins!==800 ||
      S.owned.length!==2 || !S.owned.includes('sword_0_0#1') || S.packsOpened!==2) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run('S.packsOpened'),2);
  assert.equal(restored.run('S.coins'),800);
  assert.equal(restored.run("S.owned.includes('sword_0_0')"),true);
  assert.equal(restored.run("S.owned.includes('sword_0_0#1')"),true);
});

test('pack draws include high unlocked tiers and retain duplicate copies', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=60; S.coins=10000; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    Math.random=()=>0.9999999999999999;
    if(!openPack('arcane') || ITEM[S.owned[0]].tier!==6 || S.coins!==8200) return false;
    if(!openPack('arcane') || S.coins!==6400 || S.owned.length!==2 || itemById(S.owned[1]).tier!==6) return false;
    S.level=39; S.owned=[];
    if(!openPack('silver') || ITEM[S.owned[0]].tier!==5) return false;
    S.materials=0;
    if(!dismantle(S.owned[0]) || S.materials!==65) return false;
    return true;
  })()`),true);
});

test('duplicate items equip, upgrade and dismantle independently and survive reload', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.level=10; S.coins=1000; S.materials=100; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    Math.random=()=>0;
    const first=drawPack('basic').item.id,second=drawPack('basic').item.id;
    if(first!=='sword_0_0' || second!=='sword_0_0#1') return false;
    if(!placeItem(first,'sword') || !upgradeItem(first) || !upgradeItem(second)) return false;
    if(!upgradeItem(first) || upgradeLevel(first)!==2 || upgradeLevel(second)!==1 ||
      itemPercent(itemById(first))!==ITEM.sword_0_0.pct+2) return false;
    if(dismantle(first) || !dismantle(second) || upgradeLevel(first)!==2 ||
      S.owned.includes(second) || !S.owned.includes(first)) return false;
    const replacement=drawPack('basic').item.id;
    if(replacement!==second || upgradeLevel(replacement)!==0) return false;
    save(); return true;
  })()`),true);
  const restored=game(g.saved());
  assert.equal(restored.run(`S.eq.sword==='sword_0_0' && upgradeLevel('sword_0_0')===2 &&
    upgradeLevel('sword_0_0#1')===0 && S.owned.includes('sword_0_0#1')`),true);
  assert.equal(restored.run(`dismantle('sword_0_0#1') && S.eq.sword==='sword_0_0' &&
    statBreakdown('dmg').equipment===ITEM.sword_0_0.pct+2`),true);
});

test('identical rings are separately equippable and a store offer can sell another copy', () => {
  const g=game();
  assert.equal(g.run(`(() => {
    S=fresh(); S.coins=1000; S.achievements=ACHIEVEMENTS.map(a=>a.id);
    addItem('ring_0_0');addItem('ring_0_0');
    if(!placeItem('ring_0_0','ring1') || !placeItem('ring_0_0#1','ring2') ||
      statBreakdown('dmg').equipment!==2*ITEM.ring_0_0.pct) return false;
    ensureShopStock();
    const existing=S.shopStock.offers.indexOf('ring_0_0');
    if(existing>0) S.shopStock.offers[existing]=S.shopStock.offers[0];
    S.shopStock.offers[0]='ring_0_0';S.shopStock.variants[S.torment]=S.shopStock.offers.slice();
    if(!buyDailyItem('ring_0_0') || buyDailyItem('ring_0_0')) return false;
    return S.owned.includes('ring_0_0#2') && S.eq.ring1==='ring_0_0' && S.eq.ring2==='ring_0_0#1';
  })()`),true);
});
