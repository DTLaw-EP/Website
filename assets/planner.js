(function(){
'use strict';

var STORAGE_KEY = 'dtlaw_planner_v1';
var RELATIONS = ['Spouse or partner','Child','Step-child','Ex-spouse','Parent','Sibling','Friend or chosen family','Other'];
var nextId = 1000;

function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function money(n){ return '$' + Math.round(n||0).toLocaleString(); }
function newId(){ return nextId++; }

function defaultState(){
  return {
    family: [],
    executorId: null,
    estateValue: 500000,
    relStatus: 'Married',
    divorceStage: 'Not yet filed',
    hasPriorKids: false,
    income: [],
    expenses: [],
    business: { has:false, name:'', value:0, succession:'None' },
    goals: [],
    priorities: [],
    checklist: [
      { id: newId(), text:'Will', done:false },
      { id: newId(), text:'Financial power of attorney', done:false },
      { id: newId(), text:'Health care power of attorney and living will', done:false },
      { id: newId(), text:'Beneficiary designations reviewed', done:false },
      { id: newId(), text:'Guardian or trustee nominations documented', done:false }
    ]
  };
}

function exampleState(){
  var s = defaultState();
  var jane = newId(), alex = newId(), maya = newId();
  s.family = [
    { id: jane, name:'Jane', rel:'Spouse or partner', pct:40, minor:false, sn:false, trustee:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: alex, name:'Alex', rel:'Child', pct:10, minor:false, sn:true, trustee:maya, concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: maya, name:'Maya', rel:'Child', pct:50, minor:false, sn:false, trustee:'', concerns:{money:true,substance:false,relStability:false,other:false}, note:'' }
  ];
  s.executorId = jane;
  s.estateValue = 500000;
  s.relStatus = 'Remarried or repartnered';
  s.hasPriorKids = true;
  s.income = [{id:newId(),name:'Salary',amt:7000},{id:newId(),name:'Side business',amt:800}];
  s.expenses = [{id:newId(),name:'Housing',amt:2200},{id:newId(),name:'Debt payments',amt:400},{id:newId(),name:'Childcare',amt:900}];
  s.business = { has:true, name:'Family bakery', value:150000, succession:'None' };
  var d1 = new Date(); d1.setFullYear(d1.getFullYear()+2);
  var d2 = new Date(); d2.setFullYear(d2.getFullYear()+15);
  s.goals = [
    { id:newId(), name:'Home down payment', target:60000, current:10000, date: d1.toISOString().slice(0,7) },
    { id:newId(), name:'College fund', target:80000, current:0, date: d2.toISOString().slice(0,7) }
  ];
  return s;
}

var state = load();

function load(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    var parsed = JSON.parse(raw);
    var maxId = 999;
    (function scan(o){
      if(Array.isArray(o)) o.forEach(scan);
      else if(o && typeof o==='object'){ if(typeof o.id==='number' && o.id>maxId) maxId=o.id; Object.values(o).forEach(scan); }
    })(parsed);
    nextId = maxId+1;
    return parsed;
  }catch(e){ return defaultState(); }
}
function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}

function hasConcern(p){ return p.concerns.money||p.concerns.substance||p.concerns.relStability||p.concerns.other; }
function needsTrust(p){ return p.minor||p.sn||hasConcern(p); }

/* ---------------- navigation ---------------- */
var tabsEl = document.getElementById('step-tabs');
tabsEl.addEventListener('click', function(e){
  var btn = e.target.closest('.step-tab');
  if(!btn) return;
  goToStep(btn.dataset.step);
});
function goToStep(step){
  document.querySelectorAll('.step-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.step===step); });
  document.querySelectorAll('.step-panel').forEach(function(p){ p.classList.toggle('active', p.dataset.panel===step); });
  window.scrollTo({top:0, behavior:'smooth'});
}

document.getElementById('btn-example').addEventListener('click', function(){
  state = exampleState(); save(); renderAll();
});
document.getElementById('btn-reset').addEventListener('click', function(){
  if(!confirm('Clear everything you\'ve entered and start over?')) return;
  state = defaultState(); save(); renderAll();
});
document.getElementById('btn-print').addEventListener('click', function(){ window.print(); });

/* ---------------- generic list wiring ---------------- */
function wireList(container, arr, opts){
  container.addEventListener('change', function(e){
    var field = e.target.dataset.field;
    if(!field) return;
    var idEl = e.target.closest('[data-id]');
    if(!idEl) return;
    var item = arr.find(function(x){ return x.id === Number(idEl.dataset.id); });
    if(!item) return;
    var val = e.target.type==='checkbox' ? e.target.checked : e.target.value;
    if(e.target.type==='number') val = Math.max(0, Number(val)||0);
    if(field.indexOf('.')>-1){
      var parts = field.split('.');
      item[parts[0]][parts[1]] = val;
    } else {
      item[field] = val;
    }
    save(); renderAll();
  });
  container.addEventListener('click', function(e){
    var rm = e.target.closest('[data-remove]');
    if(!rm) return;
    var idEl = rm.closest('[data-id]');
    var id = Number(idEl.dataset.id);
    var idx = arr.findIndex(function(x){ return x.id===id; });
    if(idx>-1) arr.splice(idx,1);
    if(opts && opts.onRemove) opts.onRemove(id);
    save(); renderAll();
  });
}
wireList(document.getElementById('family-list'), state.family, { onRemove: function(id){
  state.family.forEach(function(p){ if(p.trustee===id) p.trustee=''; });
  if(state.executorId===id) state.executorId = state.family[0] ? state.family[0].id : null;
}});
wireList(document.getElementById('income-list'), state.income);
wireList(document.getElementById('expense-list'), state.expenses);
wireList(document.getElementById('goals-list'), state.goals);
wireList(document.getElementById('checklist'), state.checklist);

document.getElementById('trustee-rows').addEventListener('change', function(e){
  var sel = e.target.closest('select[data-trustee-for]');
  if(!sel) return;
  var pid = Number(sel.dataset.trusteeFor);
  var p = state.family.find(function(x){ return x.id===pid; });
  if(p){ p.trustee = sel.value ? Number(sel.value) : ''; save(); renderAll(); }
});

/* ---------------- step 1: family ---------------- */
document.getElementById('btn-add-person').addEventListener('click', function(){
  var nameEl = document.getElementById('np-name');
  var name = nameEl.value.trim();
  if(!name){ nameEl.style.borderColor = '#9C3B2E'; return; }
  nameEl.style.borderColor = '';
  state.family.push({
    id:newId(), name:name, rel:document.getElementById('np-rel').value, pct:0,
    minor:document.getElementById('np-minor').checked, sn:document.getElementById('np-sn').checked,
    trustee:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:''
  });
  nameEl.value='';
  document.getElementById('np-minor').checked=false;
  document.getElementById('np-sn').checked=false;
  save(); renderAll();
});
document.getElementById('executor-sel').addEventListener('change', function(e){
  state.executorId = e.target.value ? Number(e.target.value) : null;
  save(); renderAll();
});
document.getElementById('estate-val').addEventListener('change', function(e){
  state.estateValue = Math.max(0, Number(e.target.value)||0);
  save(); renderAll();
});

function personRow(p){
  return '<div class="pl-card" data-id="'+p.id+'">' +
    '<div class="pl-card-top">' +
      '<input type="text" class="pl-input-sm" data-field="name" value="'+esc(p.name)+'" placeholder="Name" aria-label="Name">' +
      '<select class="pl-input-sm" data-field="rel" aria-label="Relationship">' + RELATIONS.map(function(r){ return '<option '+(p.rel===r?'selected':'')+'>'+r+'</option>'; }).join('') + '</select>' +
      '<input type="number" class="pl-input-sm" style="width:64px" data-field="pct" min="0" max="100" value="'+p.pct+'" aria-label="Share percent"> %' +
      '<span class="pl-card-sub">'+money(state.estateValue*p.pct/100)+'</span>' +
      '<label class="pl-check"><input type="checkbox" data-field="minor" '+(p.minor?'checked':'')+'>Minor</label>' +
      '<label class="pl-check"><input type="checkbox" data-field="sn" '+(p.sn?'checked':'')+'>Special needs</label>' +
      '<button class="pl-remove" data-remove type="button" aria-label="Remove '+esc(p.name)+'">Remove</button>' +
    '</div>' +
    '<div class="pl-concerns">' +
      '<span class="pl-muted">Concerns:</span>' +
      '<label class="pl-check"><input type="checkbox" data-field="concerns.money" '+(p.concerns.money?'checked':'')+'>Spending or debt</label>' +
      '<label class="pl-check"><input type="checkbox" data-field="concerns.substance" '+(p.concerns.substance?'checked':'')+'>Substance use</label>' +
      '<label class="pl-check"><input type="checkbox" data-field="concerns.relStability" '+(p.concerns.relStability?'checked':'')+'>Relationship stability</label>' +
      '<label class="pl-check"><input type="checkbox" data-field="concerns.other" '+(p.concerns.other?'checked':'')+'>Other</label>' +
    '</div>' +
    '<input type="text" class="pl-note" data-field="note" placeholder="Private note (stays in your browser only)" value="'+esc(p.note)+'">' +
  '</div>';
}

function renderFamily(){
  var list = document.getElementById('family-list');
  list.innerHTML = state.family.map(personRow).join('') || '<div class="pl-col-empty">No family members yet. Add the first one below.</div>';

  var execSel = document.getElementById('executor-sel');
  execSel.innerHTML = state.family.map(function(p){ return '<option value="'+p.id+'" '+(state.executorId===p.id?'selected':'')+'>'+esc(p.name)+'</option>'; }).join('');
  if(state.family.length===0) execSel.innerHTML = '<option value="">Add a family member first</option>';

  var estateValEl = document.getElementById('estate-val');
  if(document.activeElement!==estateValEl) estateValEl.value = state.estateValue;

  var flagged = state.family.filter(needsTrust);
  document.getElementById('trustee-rows').innerHTML = flagged.map(function(p){
    return '<div class="pl-field-row"><label>Trustee for '+esc(p.name)+'</label><select data-trustee-for="'+p.id+'">' +
      '<option value="">Choose someone</option>' +
      state.family.filter(function(o){ return o.id!==p.id; }).map(function(o){ return '<option value="'+o.id+'" '+(p.trustee===o.id?'selected':'')+'>'+esc(o.name)+'</option>'; }).join('') +
      '</select></div>';
  }).join('');

  drawFamilyDiagram();

  var pctTotal = state.family.reduce(function(s,p){ return s+p.pct; },0);
  var flags = [];
  if(state.family.length && pctTotal!==100) flags.push({ok:false,text:'Shares add up to '+pctTotal+'%, not 100%.'});
  state.family.forEach(function(p){
    if(p.minor && !p.trustee) flags.push({ok:false,text:esc(p.name)+' is a minor set to inherit directly. Illinois law doesn\'t allow that — choose a trustee above.'});
    if(p.sn && !p.trustee) flags.push({ok:false,text:esc(p.name)+' is flagged special needs but has no trustee. A trust protects benefits eligibility.'});
    if(hasConcern(p) && !p.trustee) flags.push({ok:false,text:esc(p.name)+' has a flagged concern. Consider a trust with staggered distributions instead of an outright gift.'});
    if(p.sn && p.trustee) flags.push({ok:true,text:esc(p.name)+'’s share routes through a trust, keeping benefits eligibility intact.'});
  });
  if(state.family.length && !state.executorId) flags.push({ok:false,text:'No executor chosen yet.'});
  renderFlags('family-flags', flags);
}

function drawFamilyDiagram(){
  var svg = document.getElementById('family-diagram');
  var people = state.family;
  if(people.length===0){ svg.innerHTML = ''; return; }
  var spouse = people.find(function(p){ return p.rel==='Spouse or partner'; });
  var children = people.filter(function(p){ return p.rel==='Child'||p.rel==='Step-child'; });
  var others = people.filter(function(p){ return p!==spouse && p.rel!=='Child' && p.rel!=='Step-child'; });
  var parts = '<rect x="170" y="15" width="120" height="40" rx="4" fill="var(--forest)"/><text x="230" y="39" text-anchor="middle" class="pl-t-on-dark">You</text>';
  var unionX = 230;
  if(spouse){
    parts += '<rect x="330" y="15" width="120" height="40" rx="4" fill="var(--forest)"/><text x="390" y="34" text-anchor="middle" class="pl-t-on-dark">'+esc(spouse.name)+'</text><text x="390" y="49" text-anchor="middle" class="pl-ts-on-dark">Spouse or partner</text>';
    parts += '<path d="M290,35 L330,35" class="pl-line"/>';
    unionX = 310;
  }
  parts += '<path d="M'+unionX+',55 L'+unionX+',70" class="pl-line"/>';

  function col(p, cx, topY, dashed){
    parts += '<path d="M'+unionX+',70 '+(dashed ? 'L'+cx+',70' : 'C '+unionX+','+(topY-10)+' '+cx+','+(topY-10)+' '+cx+','+topY)+'" class="'+(dashed?'pl-line-dashed':'pl-line')+'"/>';
    var y = topY;
    var nt = needsTrust(p);
    if(nt){
      var tName = people.find(function(o){ return o.id===p.trustee; });
      parts += '<rect x="'+(cx-65)+'" y="'+y+'" width="130" height="42" rx="4" fill="var(--gold)"/>' +
        '<text x="'+cx+'" y="'+(y+17)+'" text-anchor="middle" class="pl-t" style="fill:var(--forest-deep)">Trust</text>' +
        '<text x="'+cx+'" y="'+(y+33)+'" text-anchor="middle" class="pl-ts" style="fill:var(--forest-deep)">Trustee: '+(tName?esc(tName.name):'none set')+'</text>';
      y += 52;
      parts += '<path d="M'+cx+','+(y-10)+' L'+cx+','+y+'" class="pl-line"/>';
    }
    parts += '<rect x="'+(cx-65)+'" y="'+y+'" width="130" height="44" rx="4" fill="var(--white)" stroke="var(--line)"/>' +
      '<text x="'+cx+'" y="'+(y+17)+'" text-anchor="middle" class="pl-t">'+esc(p.name)+'</text>' +
      '<text x="'+cx+'" y="'+(y+32)+'" text-anchor="middle" class="pl-ts">'+money(state.estateValue*p.pct/100)+' ('+p.rel+')</text>';
  }
  var cw = 680/Math.max(children.length,1);
  children.forEach(function(p,i){ col(p, cw*i+cw/2, 90, false); });
  var ow = 680/Math.max(others.length,1);
  others.forEach(function(p,i){ col(p, ow*i+ow/2, 270, true); });
  svg.innerHTML = parts;
}

/* ---------------- step 2: your picture ---------------- */
document.getElementById('rel-status').addEventListener('change', function(e){ state.relStatus = e.target.value; save(); renderAll(); });
document.getElementById('div-stage').addEventListener('change', function(e){ state.divorceStage = e.target.value; save(); renderAll(); });
document.getElementById('has-prior-kids').addEventListener('change', function(e){ state.hasPriorKids = e.target.checked; save(); renderAll(); });
document.getElementById('has-biz').addEventListener('change', function(e){ state.business.has = e.target.checked; save(); renderAll(); });

document.getElementById('btn-add-income').addEventListener('click', function(){ state.income.push({id:newId(),name:'',amt:0}); save(); renderAll(); });
document.getElementById('btn-add-expense').addEventListener('click', function(){ state.expenses.push({id:newId(),name:'',amt:0}); save(); renderAll(); });
document.getElementById('btn-add-goal').addEventListener('click', function(){
  state.goals.push({id:newId(),name:'',target:0,current:0,date:new Date().toISOString().slice(0,7)}); save(); renderAll();
});

document.getElementById('biz-fields').addEventListener('change', function(e){
  var f = e.target.dataset.bizField;
  if(!f) return;
  state.business[f] = e.target.type==='number' ? Math.max(0,Number(e.target.value)||0) : e.target.value;
  save(); renderAll();
});

function amtRow(kind, arr, r){
  return '<div class="pl-card" data-id="'+r.id+'" style="flex-direction:row;display:flex;align-items:center;gap:8px;">' +
    '<input type="text" class="pl-input-flex" data-field="name" value="'+esc(r.name)+'" placeholder="Name">' +
    '<span class="pl-muted">$</span><input type="number" class="pl-input-sm" style="width:90px" data-field="amt" value="'+r.amt+'"><span class="pl-muted">/mo</span>' +
    '<button class="pl-remove" data-remove type="button" aria-label="Remove">Remove</button>' +
  '</div>';
}

function renderPicture(){
  document.getElementById('div-stage-row').style.display = (state.relStatus==='Divorce in progress'||state.relStatus==='Married, separated') ? '' : 'none';
  var relSel = document.getElementById('rel-status');
  if(document.activeElement!==relSel) relSel.value = state.relStatus;
  var divSel = document.getElementById('div-stage');
  if(document.activeElement!==divSel) divSel.value = state.divorceStage;
  document.getElementById('has-prior-kids').checked = state.hasPriorKids;
  document.getElementById('has-biz').checked = state.business.has;

  document.getElementById('income-list').innerHTML = state.income.map(function(r){ return amtRow('income', state.income, r); }).join('') || '<div class="pl-col-empty">No income sources yet.</div>';
  document.getElementById('expense-list').innerHTML = state.expenses.map(function(r){ return amtRow('expense', state.expenses, r); }).join('') || '<div class="pl-col-empty">No expenses yet.</div>';

  document.getElementById('biz-fields').style.display = state.business.has ? '' : 'none';
  if(state.business.has){
    document.getElementById('biz-fields').innerHTML =
      '<input type="text" class="pl-input-sm" data-biz-field="name" placeholder="Business name" value="'+esc(state.business.name)+'">' +
      '<input type="number" class="pl-input-sm" data-biz-field="value" placeholder="Estimated value" value="'+(state.business.value||'')+'">' +
      '<select class="pl-input-sm" data-biz-field="succession">' + ['None','Informal plan','Documented plan'].map(function(s){ return '<option '+(state.business.succession===s?'selected':'')+'>'+s+'</option>'; }).join('') + '</select>';
  }

  document.getElementById('goals-list').innerHTML = state.goals.map(function(g){
    var today = new Date();
    var months = Math.max(0, (new Date(g.date+'-01') - today)/(1000*60*60*24*30.44));
    var remaining = Math.max(0, g.target - g.current);
    var perMonth = months>0.5 ? remaining/months : remaining;
    var pct = g.target>0 ? Math.min(100, Math.round(g.current/g.target*100)) : 0;
    return '<div class="pl-goal-card" data-id="'+g.id+'">' +
      '<div class="pl-goal-top">' +
        '<input type="text" placeholder="Goal name" value="'+esc(g.name)+'" data-field="name" style="width:150px;">' +
        '<span class="pl-muted">Target $</span><input type="number" value="'+g.target+'" data-field="target" style="width:90px;">' +
        '<span class="pl-muted">Saved $</span><input type="number" value="'+g.current+'" data-field="current" style="width:90px;">' +
        '<span class="pl-muted">By</span><input type="month" value="'+g.date+'" data-field="date" style="width:130px;">' +
        '<button class="pl-remove" data-remove type="button" style="margin-left:auto;" aria-label="Remove">Remove</button>' +
      '</div>' +
      '<div class="pl-progress-track"><div class="pl-progress-fill-inner" style="width:'+pct+'%"></div></div>' +
      '<div class="pl-goal-note">'+pct+'% saved · needs about '+money(perMonth)+'/mo to reach the goal on time</div>' +
    '</div>';
  }).join('') || '<div class="pl-col-empty">No goals yet.</div>';

  var totalIncome = state.income.reduce(function(s,r){ return s+r.amt; },0);
  var totalExpenses = state.expenses.reduce(function(s,r){ return s+r.amt; },0);
  var net = totalIncome-totalExpenses;
  document.getElementById('m-income').textContent = money(totalIncome);
  document.getElementById('m-expenses').textContent = money(totalExpenses);
  var netEl = document.getElementById('m-net');
  netEl.textContent = money(net);
  netEl.style.color = net<0 ? '#9C3B2E' : 'var(--ink)';

  var goalNeed = state.goals.reduce(function(s,g){
    var months = Math.max(0.5,(new Date(g.date+'-01')-new Date())/(1000*60*60*24*30.44));
    return s + Math.max(0,g.target-g.current)/months;
  },0);

  var flags = [];
  if(state.relStatus==='Married, separated' || state.relStatus==='Divorce in progress'){
    flags.push({ok:false,text:'Update your beneficiary designations, power of attorney, and health care proxy now. Divorce isn’t final yet, so an estranged spouse likely still has authority and stands to inherit.'});
  }
  if(state.relStatus==='Divorced'){
    flags.push({ok:false,text:'Confirm your ex-spouse is removed from life insurance and retirement account beneficiaries. Illinois automatically revokes an ex-spouse’s share of a will at divorce, but that rule doesn’t reach beneficiary designations — those need to be changed separately.'});
  }
  if(state.relStatus==='Remarried or repartnered' && state.hasPriorKids){
    flags.push({ok:false,text:'Without planning, assets left outright to a new spouse can end up entirely under their control, leaving nothing guaranteed for children from a prior relationship. A trust can provide for your spouse while still protecting a share for your children.'});
  }
  if(state.relStatus==='Unmarried partner (cohabiting)'){
    flags.push({ok:false,text:'Illinois intestacy law gives an unmarried partner no automatic inheritance rights. Without a will or trust naming them, your partner would receive nothing if something happened to you.'});
  }
  if(net<0) flags.push({ok:false,text:'Expenses exceed income by '+money(-net)+'/mo. This limits what\'s available for savings goals or estate funding.'});
  if(goalNeed>Math.max(net,0) && state.goals.length) flags.push({ok:false,text:'Your goals need about '+money(goalNeed)+'/mo combined, more than your '+money(Math.max(net,0))+'/mo available. Consider adjusting timelines or amounts.'});
  if(state.business.has && state.business.succession==='None') flags.push({ok:false,text:(esc(state.business.name)||'Your business')+' has no succession plan. This affects how the business is handled in your estate plan.'});
  if(state.business.has && state.business.succession==='Documented plan') flags.push({ok:true,text:(esc(state.business.name)||'Your business')+' already has a documented succession plan in place.'});
  renderFlags('picture-flags', flags);
}

/* ---------------- step 3: priorities ---------------- */
document.getElementById('btn-add-priority').addEventListener('click', function(){
  var t = document.getElementById('np-pri-text');
  var text = t.value.trim();
  if(!text){ t.style.borderColor='#9C3B2E'; return; }
  t.style.borderColor='';
  state.priorities.push({ id:newId(), text:text, cat:document.getElementById('np-pri-cat').value, pri:document.getElementById('np-pri-pri').value });
  t.value='';
  save(); renderAll();
});

function computeSuggestions(){
  var s = [];
  state.family.forEach(function(p){
    if(needsTrust(p) && !p.trustee){
      var text = p.sn ? 'Set up a special needs trust for '+p.name
                : p.minor ? 'Set up a trust for '+p.name+' (minor beneficiary)'
                : 'Consider a trust with staggered distributions for '+p.name;
      s.push({key:'trust-'+p.id, text:text, cat:'Trust'});
    }
  });
  if(state.family.length && !state.executorId) s.push({key:'executor', text:'Choose an executor', cat:'Documents'});
  if(state.relStatus==='Married, separated' || state.relStatus==='Divorce in progress'){
    s.push({key:'divorce-docs', text:'Update beneficiary designations, power of attorney, and health care proxy', cat:'Documents'});
  }
  if(state.relStatus==='Divorced'){
    s.push({key:'ex-beneficiary', text:'Remove your ex-spouse from beneficiary designations', cat:'Documents'});
  }
  if(state.relStatus==='Remarried or repartnered' && state.hasPriorKids){
    s.push({key:'blended-trust', text:'Set up a trust to protect children from a prior relationship', cat:'Trust'});
  }
  if(state.relStatus==='Unmarried partner (cohabiting)'){
    s.push({key:'partner-will', text:'Name your partner in a will or trust — Illinois law won’t do it for you', cat:'Documents'});
  }
  if(state.business.has && state.business.succession==='None'){
    s.push({key:'biz-succession', text:'Start a succession plan for '+(state.business.name||'your business'), cat:'Business'});
  }
  return s;
}
document.getElementById('pri-suggestions').addEventListener('click', function(e){
  var btn = e.target.closest('[data-add-suggestion]');
  if(!btn) return;
  var card = btn.closest('[data-suggest-key]');
  var key = card.dataset.suggestKey;
  var sug = computeSuggestions().find(function(s){ return s.key===key; });
  if(!sug) return;
  state.priorities.push({ id:newId(), text:sug.text, cat:sug.cat, pri:'short', sourceKey:key });
  save(); renderAll();
});
function renderSuggestions(){
  var existingKeys = state.priorities.map(function(p){ return p.sourceKey; }).filter(Boolean);
  var suggestions = computeSuggestions().filter(function(s){ return existingKeys.indexOf(s.key)===-1; });
  document.getElementById('pri-suggestions-wrap').style.display = suggestions.length ? '' : 'none';
  document.getElementById('pri-suggestions').innerHTML = suggestions.map(function(s){
    return '<div class="pl-card" style="display:flex;align-items:center;gap:10px;" data-suggest-key="'+s.key+'">' +
      '<span class="pl-tag pl-tag-'+s.cat+'">'+s.cat+'</span>' +
      '<span style="flex:1;font-size:13.5px;">'+s.text+'</span>' +
      '<button class="btn btn-sm" data-add-suggestion type="button">Add</button>' +
    '</div>';
  }).join('');
}

function priorityCard(i){
  return '<div class="pl-pcard" data-id="'+i.id+'">' +
    '<div class="pl-pcard-top"><span class="pl-tag pl-tag-'+i.cat+'">'+i.cat+'</span><button class="pl-remove" data-remove type="button" aria-label="Remove">×</button></div>' +
    '<div class="pl-pcard-text">'+esc(i.text)+'</div>' +
    '<select data-field="pri"><option value="now" '+(i.pri==='now'?'selected':'')+'>Now</option><option value="short" '+(i.pri==='short'?'selected':'')+'>Short term</option><option value="long" '+(i.pri==='long'?'selected':'')+'>Long term</option></select>' +
  '</div>';
}
function renderPriorities(){
  renderSuggestions();
  ['now','short','long'].forEach(function(k){
    var items = state.priorities.filter(function(i){ return i.pri===k; });
    document.getElementById('col-'+k).innerHTML = items.map(priorityCard).join('') || '<div class="pl-col-empty">Nothing here yet.</div>';
  });
}
['col-now','col-short','col-long'].forEach(function(id){
  wireList(document.getElementById(id), state.priorities);
});

/* ---------------- step 4: the plan ---------------- */
function renderPlan(){
  var svg = document.getElementById('plan-diagram');
  var people = state.family;
  if(people.length===0){
    svg.innerHTML = '';
    document.getElementById('plan-summary').textContent = 'Add your family in step 1 to see your plan summary here.';
  } else {
    var cw = 680/people.length;
    var parts = '<rect x="280" y="10" width="120" height="40" rx="4" fill="var(--forest)"/><text x="340" y="34" text-anchor="middle" class="pl-t-on-dark">Your estate</text>';
    people.forEach(function(p,i){
      var cx = cw*i+cw/2;
      parts += '<path d="M340,50 L'+cx+',70" class="pl-line"/>';
      var y = 80;
      var nt = needsTrust(p);
      if(nt){
        var tName = people.find(function(o){ return o.id===p.trustee; });
        parts += '<rect x="'+(cx-65)+'" y="'+y+'" width="130" height="42" rx="4" fill="var(--gold)"/>' +
          '<text x="'+cx+'" y="'+(y+17)+'" text-anchor="middle" class="pl-t" style="fill:var(--forest-deep)">Trust</text>' +
          '<text x="'+cx+'" y="'+(y+33)+'" text-anchor="middle" class="pl-ts" style="fill:var(--forest-deep)">Trustee: '+(tName?esc(tName.name):'none set')+'</text>';
        y += 52;
        parts += '<path d="M'+cx+','+(y-10)+' L'+cx+','+y+'" class="pl-line"/>';
      }
      parts += '<rect x="'+(cx-65)+'" y="'+y+'" width="130" height="44" rx="4" fill="var(--white)" stroke="var(--line)"/>' +
        '<text x="'+cx+'" y="'+(y+17)+'" text-anchor="middle" class="pl-t">'+esc(p.name)+'</text>' +
        '<text x="'+cx+'" y="'+(y+32)+'" text-anchor="middle" class="pl-ts">'+money(state.estateValue*p.pct/100)+' ('+p.pct+'%)</text>';
    });
    svg.innerHTML = parts;

    var sentences = people.map(function(p){
      var amt = money(state.estateValue*p.pct/100);
      if(needsTrust(p)){
        var tName = people.find(function(o){ return o.id===p.trustee; });
        return esc(p.name)+' receives '+amt+' ('+p.pct+'%) in a trust'+(tName?' managed by '+esc(tName.name):'')+'.';
      }
      return esc(p.name)+' receives '+amt+' ('+p.pct+'%) outright as '+p.rel.toLowerCase()+'.';
    });
    var execName = people.find(function(p){ return p.id===state.executorId; });
    document.getElementById('plan-summary').innerHTML = 'Your estate is valued at '+money(state.estateValue)+'. ' + sentences.join(' ') + (execName ? ' '+esc(execName.name)+' is named as executor.' : ' No executor is named yet.');
  }

  document.getElementById('checklist').innerHTML = state.checklist.map(function(c){
    return '<label class="pl-checkitem'+(c.done?' done':'')+'" data-id="'+c.id+'"><input type="checkbox" data-field="done" '+(c.done?'checked':'')+'><span>'+esc(c.text)+'</span></label>';
  }).join('');
  var done = state.checklist.filter(function(c){ return c.done; }).length;
  var pctDone = state.checklist.length ? Math.round(done/state.checklist.length*100) : 0;
  document.getElementById('checklist-pct').textContent = done+' of '+state.checklist.length+' complete ('+pctDone+'%)';
  document.getElementById('checklist-bar').style.width = pctDone+'%';
}

/* ---------------- shared flags renderer ---------------- */
function renderFlags(elId, flags){
  var el = document.getElementById(elId);
  el.innerHTML = flags.map(function(f){
    return '<div class="pl-flag'+(f.ok?' pl-flag-ok':'')+'">'+f.text+'</div>';
  }).join('') || '<div class="pl-col-empty">No issues found.</div>';
}

/* ---------------- render all ---------------- */
function renderAll(){
  renderFamily();
  renderPicture();
  renderPriorities();
  renderPlan();
}
renderAll();
})();
