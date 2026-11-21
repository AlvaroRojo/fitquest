const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core = script.slice(0, script.indexOf('const $='));

function simulate(profile) {
  let now = Date.parse('2026-01-05T12:00:00Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = vm.createContext({
    Date: Clock,
    localStorage: { getItem: () => null, setItem: () => {} },
    alert: message => { throw new Error(message); },
    render: () => {},
  });
  vm.runInContext(core, context);
  vm.runInContext(`{
    let seed=123456;
    Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
    S=fresh();
  }`, context);
  const result = {};
  for (let day = 0; day < 365; day++) {
    now = Date.parse('2026-01-05T12:00:00Z') + day * 86400000;
    if (day % 7 < profile.days) {
      vm.runInContext(`{
        settleBattle();
        const unlocked=Math.min(${profile.tormentLimit},Math.floor(S.level/10),12);
        if(unlocked!==S.torment) selectTorment(unlocked);
        for(let i=0;i<${profile.missions};i++) completeMission(byId(S.active[0]));
        for(let i=0;i<5;i++){
          for(const stat of ['damage','speed','loot']) buyBattleUpgrade(stat);
          for(const stat of ['dmg','xp','coin']) trainAttribute(stat);
        }
        const path=${JSON.stringify(profile.skills)};
        for(const id of path) while(skillPoints()>0 && unlockSkill(id)) {}
        const passivePath=${JSON.stringify(profile.passives)};
        for(const id of passivePath) while(passivePoints()>0 && unlockPassive(id)) {}
        if(!S.subclass) chooseSubclass(${JSON.stringify(profile.subclass)});
        for(const stat of ['dmg','xp','coin']) buyForgeUpgrade(stat);
        if(S.tower.floor>TOWER_FLOORS) startTowerRound();
        if(S.weeklyRewards===(S.journeyRound+1)*JOURNEY_CHAPTERS) startJourneyRound();
        let challengeTorment=unlocked;
        while(challengeTorment>0 && towerMaxHp(S.tower.floor)*TORMENTS[challengeTorment].hp>48*bonus('dmg')) challengeTorment--;
        if(S.tower.keys){selectTorment(challengeTorment);attackTower()}
        challengeTorment=unlocked;
        while(challengeTorment>0 && bossBaseHp(S.weeklyBoss.index)*TORMENTS[challengeTorment].hp>160*bonus('dmg')) challengeTorment--;
        selectTorment(challengeTorment);
        attackWeeklyBoss();
        selectTorment(unlocked);
        for(let i=0;i<3;i++){
          const pack=S.level>=30?'arcane':S.level>=15?'gold':'basic';
          const item=drawPack(pack)?.item;
          if(!item) break;
          const slots=EQ_SLOTS.filter(slot=>slot.g===item.g);
          if(slots.some(slot=>!S.eq[slot.k]) ||
             (slots.length===1 && itemPercent(item)>itemPercent(itemById(S.eq[slots[0].k])))) autoEquipItem(item.id);
        }
        const tier=TIER_NAMES.findLastIndex((_,i)=>S.level>=TIER_LVL[i]&&CRAFT_COST[i]<=S.materials/2);
        if(tier>=0){
          const group=['sword','shield','boots','chest','pants','ring','necklace','earring']
            .find(g=>!Object.values(S.eq).some(id=>itemById(id)?.g===g&&itemById(id).tier>=tier));
          if(group){const crafted=craftItem(group,tier);if(crafted) autoEquipItem(crafted.id)}
        }
      }`, context);
    }
    if ([30, 90, 365].includes(day + 1)) {
      result[day + 1] = vm.runInContext(`JSON.stringify({
        level:S.level, missions:S.totalMissions, activeDays:S.activeDays,
        arenaKills:S.autoKills, towerFloors:S.tower.round*100+S.tower.floor-1, bosses:S.weeklyBoss.index,
        torment:S.torment, coins:S.coins, materials:S.materials,
        packs:S.packsOpened, equipment:Object.keys(S.eq).length, chapters:S.weeklyRewards
      })`, context);
      result[day + 1] = JSON.parse(result[day + 1]);
    }
  }
  return result;
}

for (const profile of [
  { name: 'ocasional', days: 2, missions: 2, tormentLimit: 0, skills: ['might', 'blade', 'fury', 'legend', 'berserker'], passives: ['war1','war2','war3','war4','war5'], subclass: 'champion' },
  { name: 'regular', days: 3, missions: 3, tormentLimit: 3, skills: ['precision', 'impact', 'focus', 'execution', 'deadeye', 'hunter'], passives: ['hunt1','hunt2','hunt3','hunt4','hunt5'], subclass: 'assassin' },
  { name: 'frecuente', days: 5, missions: 4, tormentLimit: 6, skills: ['fortune', 'prosperity', 'salvage', 'treasure', 'seeker'], passives: ['wealth1','wealth2','wealth3','wealth4','wealth5'], subclass: 'oracle' },
]) {
  console.log(profile.name, JSON.stringify(simulate(profile)));
}
