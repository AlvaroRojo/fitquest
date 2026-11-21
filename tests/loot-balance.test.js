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

test('twenty misses guarantee the next eligible pack globally and persist', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=15;S.coins=10000;S.achievements=ACHIEVEMENTS.map(a=>a.id);
    Math.random=()=>0;
    for(let i=0;i<20;i++){
      const result=drawPack(i%2?'silver':'basic');
      if(!result || result.tier!==0 || S.packMisses!==i+1) return false;
    }
    save();return true;
  })()`), true);
  const restored = game(g.saved());
  assert.equal(restored.run(`(() => {
    if(S.packMisses!==20) return false;
    const result=drawPack('gold');
    return result.tier===3 && S.packMisses===0;
  })()`), true);
});

test('effective odds condition only unlocked high tiers and preserve ordinary odds otherwise', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    for(const level of [1,14,15,20,30,40]){
      for(const pack of PACKS){
        const base=packOdds(pack,level,12);
        const ordinary=effectivePackOdds(pack,level,12,19);
        const guaranteed=effectivePackOdds(pack,level,12,20);
        if(ordinary.some((p,i)=>p!==base[i])) return false;
        if(level<15){
          if(guaranteed.some((p,i)=>p!==base[i])) return false;
        }else{
          const high=base.slice(3).reduce((a,b)=>a+b,0);
          if(guaranteed.some((p,i)=>Math.abs(p-(i<3?0:base[i]/high))>1e-12)) return false;
          if(Math.abs(guaranteed.reduce((a,b)=>a+b,0)-1)>1e-12) return false;
        }
        if(guaranteed.some((p,i)=>level<TIER_LVL[i] && p!==0)) return false;
      }
    }
    return true;
  })()`), true);
});

test('pre-unlock packs remain accessible and failures do not change guarantee progress', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh();S.coins=10000;S.achievements=ACHIEVEMENTS.map(a=>a.id);
    Math.random=()=>0;
    for(let i=0;i<22;i++) if(!drawPack('basic')) return false;
    if(S.packMisses!==20 || drawPack('silver') || S.packMisses!==20) return false;
    S.coins=0;
    if(drawPack('basic') || drawPack('missing') || S.packMisses!==20) return false;
    S.level=15;S.coins=100;
    return drawPack('basic').tier===3 && S.packMisses===0;
  })()`), true);
});

test('naturally finding a high rarity resets the global counter', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=40;S.coins=10000;S.packMisses=19;
    S.achievements=ACHIEVEMENTS.map(a=>a.id);
    Math.random=()=>0.9999999999999999;
    return drawPack('arcane').tier===6 && S.packMisses===0;
  })()`), true);
});

test('crafting costs more than dismantling, respects unlocks and creates independent copies', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    S=fresh();S.level=1;S.materials=10000;Math.random=()=>0;
    if(CRAFT_COST.some((cost,tier)=>cost<=TIER_FRAGMENTS[tier] || (tier && cost<=CRAFT_COST[tier-1]))) return false;
    const before=S.materials;
    if(craftItem('sword',1)||craftItem('missing',0)||craftItem('sword',-1)||
       craftItem('sword',0.5)||S.materials!==before) return false;
    const a=craftItem('sword',0),b=craftItem('sword',0);
    if(a.id===b.id||a.g!=='sword'||a.tier!==0||b.g!=='sword'||b.tier!==0) return false;
    if(!dismantle(a.id)||S.materials!==before-2*CRAFT_COST[0]+TIER_FRAGMENTS[0]) return false;
    S.level=40;
    for(let tier=0;tier<TIER_NAMES.length;tier++){
      const item=craftItem('ring',tier);
      if(!item||item.g!=='ring'||item.tier!==tier) return false;
    }
    S.materials=0;
    if(craftItem('sword',0)) return false;
    save();return true;
  })()`), true);
  const restored = game(g.saved());
  assert.equal(restored.run(`S.owned.includes('sword_0_0#1') && S.owned.filter(id=>itemById(id)?.g==='ring').length===7`), true);
});

test('forge controls show unlocked costs and save a crafted item immediately', () => {
  assert.match(html, /<label for="craft-type">/);
  assert.match(html, /<label for="craft-tier">/);
  const g = game();
  g.run(`
    const elements={};
    function element(tag='div'){
      return {tag,children:[],dataset:{},textContent:'',value:'',disabled:false,
        appendChild(child){this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value},
        replaceChildren(){this.children=[];if(this.tag==='select')this.value=''},
        setAttribute(){},
        set innerHTML(value){this.children=[]}, get innerHTML(){return ''}
      };
    }
    const $=id=>elements[id]??=(element(id==='craft-type'||id==='craft-tier'?'select':'div'));
    const document={createElement:tag=>element(tag)};
    S=fresh();S.level=5;S.materials=60;Math.random=()=>0;
  `);
  g.run(script.slice(script.indexOf('function renderShop(){'), script.indexOf('function renderAchievements(){')));
  assert.equal(g.run(`(() => {
    renderShop();
    const tier=$('craft-tier'),button=$('craft-button');
    if(tier.children.length!==2 || !tier.children[1].textContent.includes('30 fragmentos')) return false;
    tier.value='1';tier.onchange();
    if(!$('craft-info').textContent.includes('Desmantelar: 5') || button.disabled) return false;
    button.onclick();
    return S.materials===30 && S.owned.length===1 && itemById(S.owned[0]).tier===1 &&
      $('craft-status').textContent.includes('añadido al inventario');
  })()`), true);
  assert.equal(g.saved().materials, 30);
});
