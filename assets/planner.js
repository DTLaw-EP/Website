(function(){
'use strict';

var STORAGE_KEY = 'dtlaw_planner_v1';
var RELATIONS = ['Spouse or partner','Child','Step-child','Ex-spouse','Parent','Sibling','In-law','Niece or nephew','Grandchild','Aunt or uncle','Cousin','Friend or chosen family','Other'];
var CHILD_RELS = ['Child','Step-child'];
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
    assets: [],
    debts: [],
    businesses: [],
    goals: [],
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
  var jane = newId(), alex = newId(), maya = newId(), sam = newId(), brother = newId(), sil = newId(), niece = newId();
  s.family = [
    { id: jane, name:'Jane', age:42, rel:'Spouse or partner', pct:25, minor:false, sn:false, trustee:'', via:'', partnerOf:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: alex, name:'Alex', age:22, rel:'Child', pct:10, minor:false, sn:true, trustee:maya, via:'', partnerOf:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: sam, name:'Sam', age:9, rel:'Child', pct:10, minor:true, sn:false, trustee:maya, via:'', partnerOf:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: maya, name:'Maya', age:20, rel:'Child', pct:40, minor:false, sn:false, trustee:'', via:'', partnerOf:'', concerns:{money:true,substance:false,relStability:false,other:false}, note:'' },
    { id: brother, name:'Brother', age:45, rel:'Sibling', pct:5, minor:false, sn:false, trustee:'', via:'', partnerOf:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: sil, name:'Sister in law', age:43, rel:'In-law', pct:5, minor:false, sn:false, trustee:'', via:'', partnerOf:brother, concerns:{money:false,substance:false,relStability:false,other:false}, note:'' },
    { id: niece, name:'Niece', age:12, rel:'Niece or nephew', pct:5, minor:true, sn:false, trustee:maya, via:brother, partnerOf:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:'' }
  ];
  s.executorId = jane;
  s.estateValue = 500000;
  s.relStatus = 'Remarried or repartnered';
  s.hasPriorKids = true;
  s.income = [{id:newId(),name:'Salary',amt:7000},{id:newId(),name:'Side business',amt:800}];
  s.expenses = [{id:newId(),name:'Housing',amt:2200},{id:newId(),name:'Debt payments',amt:400},{id:newId(),name:'Childcare',amt:900}];
  s.assets = [{id:newId(),name:'Home equity',amt:180000},{id:newId(),name:'Retirement accounts',amt:220000},{id:newId(),name:'Savings',amt:40000}];
  s.debts = [{id:newId(),name:'Mortgage balance',amt:160000}];
  s.businesses = [{id:newId(),name:'Family bakery',value:150000,succession:'None'}];
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
    /* migrate older saved shapes from before businesses/assets/debts existed */
    if(parsed.business && !parsed.businesses){
      parsed.businesses = parsed.business.has ? [{ id:newId(), name:parsed.business.name||'', value:parsed.business.value||0, succession:parsed.business.succession||'None' }] : [];
      delete parsed.business;
    }
    if(!parsed.businesses) parsed.businesses = [];
    if(!parsed.assets) parsed.assets = [];
    if(!parsed.debts) parsed.debts = [];
    (parsed.family||[]).forEach(function(p){ if(p.via===undefined) p.via=''; if(p.partnerOf===undefined) p.partnerOf=''; if(p.age===undefined) p.age=null; });
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
document.body.addEventListener('click', function(e){
  var btn = e.target.closest('[data-goto]');
  if(!btn) return;
  goToStep(btn.dataset.goto);
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
document.getElementById('btn-email').addEventListener('click', function(){
  var lines = ['DT Law family plan simulation', ''];
  lines.push(document.getElementById('plan-summary').textContent.trim());
  lines.push('');
  lines.push('Checklist:');
  state.checklist.forEach(function(c){ lines.push('- ['+(c.done?'x':' ')+'] '+c.text); });
  lines.push('');
  lines.push('This is a starting point for a conversation, not legal advice, and does not create an attorney-client relationship.');
  var body = encodeURIComponent(lines.join('\n'));
  var subject = encodeURIComponent('My DT Law family plan simulation');
  window.location.href = 'mailto:yung@dtlaw-ep.com?subject='+subject+'&body='+body;
});

/* ---------------- generic list wiring ---------------- */
function wireList(container, getArr, opts){
  container.addEventListener('change', function(e){
    var field = e.target.dataset.field;
    if(!field) return;
    var idEl = e.target.closest('[data-id]');
    if(!idEl) return;
    var arr = getArr();
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
    if(opts && opts.onItemChange) opts.onItemChange(item, field, arr);
    save(); renderAll();
  });
  container.addEventListener('click', function(e){
    var rm = e.target.closest('[data-remove]');
    if(!rm) return;
    var arr = getArr();
    var idEl = rm.closest('[data-id]');
    var id = Number(idEl.dataset.id);
    var idx = arr.findIndex(function(x){ return x.id===id; });
    if(idx>-1) arr.splice(idx,1);
    if(opts && opts.onRemove) opts.onRemove(id);
    save(); renderAll();
  });
}
wireList(document.getElementById('family-list'), function(){ return state.family; }, {
  onRemove: function(id){
    state.family.forEach(function(p){ if(p.trustee===id) p.trustee=''; if(p.via===id) p.via=''; if(p.partnerOf===id) p.partnerOf=''; });
    if(state.executorId===id) state.executorId = state.family[0] ? state.family[0].id : null;
  },
  onItemChange: function(item, field, arr){
    if(field==='pct'){
      var othersTotal = arr.reduce(function(s,p){ return s + (p===item?0:p.pct); },0);
      if(othersTotal + item.pct > 100) item.pct = Math.max(0, 100-othersTotal);
    }
    if(field==='via'){ item.via = item.via ? Number(item.via) : ''; }
    if(field==='partnerOf'){ item.partnerOf = item.partnerOf ? Number(item.partnerOf) : ''; }
    if(field==='age'){
      item.age = Math.min(120, item.age);
      item.minor = item.age < 18;
    }
    if(field==='rel' && (CHILD_RELS.indexOf(item.rel)>-1 || item.rel==='Spouse or partner')){ item.via=''; item.partnerOf=''; }
  }
});
wireList(document.getElementById('income-list'), function(){ return state.income; });
wireList(document.getElementById('expense-list'), function(){ return state.expenses; });
wireList(document.getElementById('assets-list'), function(){ return state.assets; });
wireList(document.getElementById('debts-list'), function(){ return state.debts; });
wireList(document.getElementById('businesses-list'), function(){ return state.businesses; });
wireList(document.getElementById('goals-list'), function(){ return state.goals; });
wireList(document.getElementById('checklist'), function(){ return state.checklist; });

document.getElementById('trustee-rows').addEventListener('change', function(e){
  var sel = e.target.closest('select[data-trustee-for]');
  if(!sel) return;
  var pid = Number(sel.dataset.trusteeFor);
  var p = state.family.find(function(x){ return x.id===pid; });
  if(p){ p.trustee = sel.value ? Number(sel.value) : ''; save(); renderAll(); }
});

/* ---------------- step 1: family ---------------- */
function addPersonFromForm(){
  var nameEl = document.getElementById('np-name');
  var name = nameEl.value.trim();
  if(!name){ nameEl.style.borderColor = '#9C3B2E'; return; }
  nameEl.style.borderColor = '';
  var ageEl = document.getElementById('np-age');
  var age = ageEl.value==='' ? null : Math.max(0, Math.min(120, Number(ageEl.value)));
  state.family.push({
    id:newId(), name:name, age:age, rel:document.getElementById('np-rel').value, pct:0,
    minor: age!==null ? age<18 : document.getElementById('np-minor').checked, sn:document.getElementById('np-sn').checked,
    trustee:'', via:'', partnerOf:'', concerns:{money:false,substance:false,relStability:false,other:false}, note:''
  });
  nameEl.value='';
  ageEl.value='';
  document.getElementById('np-minor').checked=false;
  document.getElementById('np-sn').checked=false;
  save(); renderAll();
}
document.getElementById('btn-add-person').addEventListener('click', addPersonFromForm);
document.getElementById('np-name').addEventListener('keydown', function(e){
  if(e.key==='Enter'){ e.preventDefault(); addPersonFromForm(); }
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
  var isOther = CHILD_RELS.indexOf(p.rel)===-1 && p.rel!=='Spouse or partner';
  var viaOptions = state.family.filter(function(o){ return o.id!==p.id; });
  return '<div class="pl-card" data-id="'+p.id+'">' +
    '<div class="pl-card-top">' +
      '<input type="text" class="pl-input-sm" data-field="name" value="'+esc(p.name)+'" placeholder="Name" aria-label="Name">' +
      '<input type="number" class="pl-input-sm" style="width:70px" data-field="age" min="0" max="120" placeholder="Age" value="'+(p.age===null||p.age===undefined?'':p.age)+'" aria-label="Age">' +
      '<select class="pl-input-sm" data-field="rel" aria-label="Relationship">' + RELATIONS.map(function(r){ return '<option '+(p.rel===r?'selected':'')+'>'+r+'</option>'; }).join('') + '</select>' +
      '<input type="number" class="pl-input-sm" style="width:64px" data-field="pct" min="0" max="100" value="'+p.pct+'" aria-label="Share percent"> %' +
      '<span class="pl-card-sub">'+money(state.estateValue*p.pct/100)+'</span>' +
      '<label class="pl-check"><input type="checkbox" data-field="minor" '+(p.minor?'checked':'')+'>Minor</label>' +
      '<label class="pl-check"><input type="checkbox" data-field="sn" '+(p.sn?'checked':'')+'>Special needs</label>' +
      '<button class="pl-remove" data-remove type="button" aria-label="Remove '+esc(p.name)+'">Remove</button>' +
    '</div>' +
    (isOther ? '<div class="pl-field-row" style="margin:8px 0 0;"><label style="min-width:150px;">Connected through</label><select data-field="via"><option value="">Not sure / none</option>' +
      viaOptions.map(function(o){ return '<option value="'+o.id+'" '+(p.via===o.id?'selected':'')+'>'+esc(o.name)+'</option>'; }).join('') + '</select></div>' +
      '<div class="pl-field-row" style="margin:4px 0 0;"><label style="min-width:150px;">Partner / spouse of</label><select data-field="partnerOf"><option value="">Not paired with anyone here</option>' +
      viaOptions.filter(function(o){ return CHILD_RELS.indexOf(o.rel)===-1 && o.rel!=='Spouse or partner'; }).map(function(o){ return '<option value="'+o.id+'" '+(p.partnerOf===o.id?'selected':'')+'>'+esc(o.name)+'</option>'; }).join('') + '</select></div>' : '') +
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
  if(state.family.length && pctTotal<100) flags.push({ok:false,text:pctTotal+'% of the estate is allocated so far. Assign the remaining '+(100-pctTotal)+'% to finish.'});
  state.family.forEach(function(p){
    if(p.minor && !p.trustee) flags.push({ok:false,text:esc(p.name)+' is a minor set to inherit directly. Illinois law doesn\'t allow that — choose a trustee above.'});
    if(p.sn && !p.trustee) flags.push({ok:false,text:esc(p.name)+' is flagged special needs but has no trustee. A trust protects benefits eligibility.'});
    if(hasConcern(p) && !p.trustee) flags.push({ok:false,text:esc(p.name)+' has a flagged concern. Consider a trust with staggered distributions instead of an outright gift.'});
    if(p.sn && p.trustee) flags.push({ok:true,text:esc(p.name)+'’s share routes through its own special needs trust, keeping benefits eligibility intact.'});
  });
  if(state.family.length && !state.executorId) flags.push({ok:false,text:'No executor chosen yet.'});
  renderFlags('family-flags', flags);
}

var SLOT = 150, MAX_PER_ROW = Math.max(1, Math.floor(680/SLOT)), ROW_PITCH = 134, BOX_W = 130, BOX_H = 44, TRUST_H = 42;

/* groups items into slots: people needing an ordinary (minor or spendthrift-style) trust
   who share both the same connection point and the same trustee are merged into one
   shared-trust slot. A special needs trust is never pooled with anyone else, regardless
   of trustee, because it requires its own precise statutory language (760 ILCS 3/509)
   and pooling it with another beneficiary's trust would misrepresent the structure. */
function buildSlots(items){
  var groups = {};
  var solo = [];
  items.forEach(function(it){
    if(it.p.sn && it.p.trustee){
      solo.push({ source:it.source, dashed:it.dashed, trustee:it.p.trustee, snt:true, members:[it.p] });
    } else if(needsTrust(it.p) && it.p.trustee){
      var key = it.sourceKey+'|'+it.p.trustee;
      (groups[key] = groups[key] || { source:it.source, dashed:it.dashed, trustee:it.p.trustee, members:[] }).members.push(it.p);
    } else {
      solo.push({ source:it.source, dashed:it.dashed, trustee: needsTrust(it.p) ? null : undefined, snt: it.p.sn, members:[it.p] });
    }
  });
  return Object.keys(groups).map(function(k){ return groups[k]; }).concat(solo);
}

/* lays out slots in rows that wrap once a row would get too crowded, drawing a shared
   trust box per slot when needed and fanning out to each member below it. returns the
   bottom-most y used and a map of personId -> {cx, bottomY} for downstream connections */
function renderFlow(slots, startY, peopleAll, labelFn){
  var out = '';
  var posMap = {};
  var rows = [];
  for(var i=0;i<slots.length;i+=MAX_PER_ROW){ rows.push(slots.slice(i,i+MAX_PER_ROW)); }
  var y = startY;
  var maxY = startY;
  rows.forEach(function(rowSlots){
    var slotW = 680/rowSlots.length;
    rowSlots.forEach(function(slot, i){
      var cx = slotW*i + slotW/2;
      var hasTrust = slot.trustee!==undefined;
      out += '<path d="M'+slot.source.x+','+slot.source.y+' C '+slot.source.x+','+(y-10)+' '+cx+','+(y-10)+' '+cx+','+y+'" class="'+(slot.dashed?'pl-line-dashed':'pl-line')+'"/>';
      var by = y;
      if(hasTrust){
        var tName = slot.trustee ? peopleAll.find(function(o){ return o.id===slot.trustee; }) : null;
        var boxW = Math.min(140, slotW-10);
        var trustLabel = slot.snt ? 'Special needs trust' : (slot.members.length>1 ? 'Shared trust' : 'Trust');
        out += '<rect x="'+(cx-boxW/2)+'" y="'+by+'" width="'+boxW+'" height="'+TRUST_H+'" rx="4" fill="var(--gold)"/>' +
          '<text x="'+cx+'" y="'+(by+17)+'" text-anchor="middle" class="pl-t" style="fill:var(--forest-deep)">'+trustLabel+'</text>' +
          '<text x="'+cx+'" y="'+(by+33)+'" text-anchor="middle" class="pl-ts" style="fill:var(--forest-deep)">Trustee: '+(tName?esc(tName.name):'none set')+'</text>';
        by += TRUST_H+10;
        out += '<path d="M'+cx+','+(by-10)+' L'+cx+','+by+'" class="pl-line"/>';
      }
      var spacing = Math.max(78, Math.min(BOX_W+6, slotW/slot.members.length));
      var memberW = spacing-6;
      slot.members.forEach(function(p, mi){
        var mx = cx - (slot.members.length-1)*spacing/2 + mi*spacing;
        if(slot.members.length>1){ out += '<path d="M'+cx+','+(by-8)+' L'+mx+','+by+'" class="pl-line"/>'; }
        var fontPx = memberW<100 ? 11 : 13;
        var fs = memberW<100 ? ' style="font-size:11px"' : '';
        var moneyOnly = money(state.estateValue*p.pct/100);
        var fullSub = moneyOnly+' ('+esc(labelFn(p))+')';
        var sub = fullSub.length <= memberW/(fontPx*0.55) ? fullSub : moneyOnly;
        out += '<rect x="'+(mx-memberW/2)+'" y="'+by+'" width="'+memberW+'" height="'+BOX_H+'" rx="4" fill="var(--white)" stroke="var(--line)"/>' +
          '<text x="'+mx+'" y="'+(by+17)+'" text-anchor="middle" class="pl-t"'+fs+'>'+esc(p.name)+'</text>' +
          '<text x="'+mx+'" y="'+(by+32)+'" text-anchor="middle" class="pl-ts"'+fs+'>'+sub+'</text>';
        posMap[p.id] = { x: mx, y: by+BOX_H };
      });
      maxY = Math.max(maxY, by+BOX_H);
    });
    y += ROW_PITCH;
  });
  return { svg: out, bottomY: maxY, posMap: posMap };
}

/* lays out partnered pairs (e.g. a sibling and their spouse) as two boxes side by side
   with a union point below, so anyone "connected through" either partner branches from
   the pair together rather than from one parent alone. returns posMap entries under BOTH
   partner ids pointing to the same union point. */
function layoutPairs(pairs, source, startY){
  var out = '';
  var posMap = {};
  var pairSlot = SLOT*1.7;
  var perRow = Math.max(1, Math.floor(680/pairSlot));
  var rows = [];
  for(var i=0;i<pairs.length;i+=perRow){ rows.push(pairs.slice(i,i+perRow)); }
  var y = startY, maxY = startY;
  rows.forEach(function(rowPairs){
    var slotW = 680/rowPairs.length;
    rowPairs.forEach(function(pair, i){
      var cx = slotW*i + slotW/2;
      out += '<path d="M'+source.x+','+source.y+' C '+source.x+','+(y-10)+' '+cx+','+(y-10)+' '+cx+','+y+'" class="pl-line-dashed"/>';
      var boxW = Math.max(85, Math.min(120, slotW/2-8));
      var ax = cx-boxW/2-3, bx = cx+boxW/2+3;
      [[ax,pair.a],[bx,pair.b]].forEach(function(pair2){
        var x=pair2[0], p=pair2[1];
        var fs = boxW<100 ? ' style="font-size:11px"' : '';
        out += '<rect x="'+(x-boxW/2)+'" y="'+y+'" width="'+boxW+'" height="'+BOX_H+'" rx="4" fill="var(--white)" stroke="var(--line)"/>' +
          '<text x="'+x+'" y="'+(y+17)+'" text-anchor="middle" class="pl-t"'+fs+'>'+esc(p.name)+'</text>' +
          '<text x="'+x+'" y="'+(y+32)+'" text-anchor="middle" class="pl-ts"'+fs+'>'+esc(p.rel)+'</text>';
      });
      out += '<path d="M'+(ax+boxW/2)+','+(y+BOX_H/2)+' L'+(bx-boxW/2)+','+(y+BOX_H/2)+'" class="pl-line"/>';
      var unionY = y+BOX_H+10;
      posMap[pair.a.id] = { x:cx, y:unionY };
      posMap[pair.b.id] = { x:cx, y:unionY };
      maxY = Math.max(maxY, unionY);
    });
    y += ROW_PITCH;
  });
  return { svg: out, bottomY: maxY, posMap: posMap };
}

function drawFamilyDiagram(){
  var svg = document.getElementById('family-diagram');
  var people = state.family;
  if(people.length===0){ svg.innerHTML = ''; svg.setAttribute('viewBox','0 0 680 60'); return; }
  var spouse = people.find(function(p){ return p.rel==='Spouse or partner'; });
  var children = people.filter(function(p){ return CHILD_RELS.indexOf(p.rel)>-1; });
  var others = people.filter(function(p){ return p!==spouse && CHILD_RELS.indexOf(p.rel)===-1; });

  var parts = '<rect x="170" y="15" width="120" height="40" rx="4" fill="var(--forest)"/><text x="230" y="39" text-anchor="middle" class="pl-t-on-dark">You</text>';
  var unionX = 230;
  var posMap = {};
  if(spouse){
    parts += '<rect x="330" y="15" width="120" height="40" rx="4" fill="var(--forest)"/><text x="390" y="34" text-anchor="middle" class="pl-t-on-dark">'+esc(spouse.name)+'</text><text x="390" y="49" text-anchor="middle" class="pl-ts-on-dark">Spouse or partner</text>';
    parts += '<path d="M290,35 L330,35" class="pl-line"/>';
    unionX = 310;
    posMap[spouse.id] = { x:390, y:55 };
  }
  parts += '<path d="M'+unionX+',55 L'+unionX+',70" class="pl-line"/>';

  var childItems = children.map(function(p){ return { p:p, source:{x:unionX,y:70}, dashed:false, sourceKey:'children' }; });
  var childFlow = renderFlow(buildSlots(childItems), 90, people, function(p){ return p.rel; });
  parts += childFlow.svg;
  Object.assign(posMap, childFlow.posMap);
  var nextY = childFlow.bottomY + 50;

  /* find partner pairs among "others" so their shared dependents branch from a union
     point between them, not from one partner alone */
  var pairedIds = {};
  var pairList = [];
  others.forEach(function(p){
    if(pairedIds[p.id] || !p.partnerOf) return;
    var q = others.find(function(o){ return o.id===p.partnerOf; });
    if(q && !pairedIds[q.id]){
      pairList.push({ a:p, b:q });
      pairedIds[p.id] = true; pairedIds[q.id] = true;
    }
  });
  var pairFlow = { svg:'', bottomY: nextY, posMap:{} };
  if(pairList.length){
    pairFlow = layoutPairs(pairList, { x:unionX, y:70 }, nextY);
    parts += pairFlow.svg;
    Object.assign(posMap, pairFlow.posMap);
    nextY = pairFlow.bottomY + 50;
  }

  var remainingOthers = others.filter(function(p){ return !pairedIds[p.id]; });
  var otherItems = remainingOthers.map(function(p){
    var src = (p.via && posMap[p.via]) ? posMap[p.via] : { x: unionX, y: 70 };
    return { p:p, source: src, dashed:true, sourceKey: 'via'+(p.via||'none') };
  });
  var otherFlow = renderFlow(buildSlots(otherItems), nextY, people, function(p){
    var via = p.via && people.find(function(o){ return o.id===p.via; });
    return via ? p.rel+' of '+via.name : p.rel;
  });
  parts += otherFlow.svg;

  svg.innerHTML = parts;
  svg.setAttribute('viewBox', '0 0 680 '+Math.max(220, (others.length ? otherFlow.bottomY : childFlow.bottomY) + 20));
}

/* ---------------- step 2: your picture ---------------- */
document.getElementById('rel-status').addEventListener('change', function(e){ state.relStatus = e.target.value; save(); renderAll(); });
document.getElementById('div-stage').addEventListener('change', function(e){ state.divorceStage = e.target.value; save(); renderAll(); });
document.getElementById('has-prior-kids').addEventListener('change', function(e){ state.hasPriorKids = e.target.checked; save(); renderAll(); });

document.getElementById('btn-add-income').addEventListener('click', function(){ state.income.push({id:newId(),name:'',amt:0}); save(); renderAll(); });
document.getElementById('btn-add-expense').addEventListener('click', function(){ state.expenses.push({id:newId(),name:'',amt:0}); save(); renderAll(); });
document.getElementById('btn-add-asset').addEventListener('click', function(){ state.assets.push({id:newId(),name:'',amt:0}); save(); renderAll(); });
document.getElementById('btn-add-debt').addEventListener('click', function(){ state.debts.push({id:newId(),name:'',amt:0}); save(); renderAll(); });
document.getElementById('btn-add-business').addEventListener('click', function(){ state.businesses.push({id:newId(),name:'',value:0,succession:'None'}); save(); renderAll(); });
document.getElementById('btn-add-goal').addEventListener('click', function(){
  state.goals.push({id:newId(),name:'',target:0,current:0,date:new Date().toISOString().slice(0,7)}); save(); renderAll();
});

function valRow(r, suffix){
  return '<div class="pl-card" data-id="'+r.id+'" style="flex-direction:row;display:flex;align-items:center;gap:8px;">' +
    '<input type="text" class="pl-input-flex" data-field="name" value="'+esc(r.name)+'" placeholder="Name">' +
    '<span class="pl-muted">$</span><input type="number" class="pl-input-sm" style="width:90px" data-field="amt" value="'+r.amt+'">' +
    (suffix ? '<span class="pl-muted">'+suffix+'</span>' : '') +
    '<button class="pl-remove" data-remove type="button" aria-label="Remove">Remove</button>' +
  '</div>';
}
function bizRow(b){
  return '<div class="pl-card" data-id="'+b.id+'" style="flex-direction:row;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
    '<input type="text" class="pl-input-flex" data-field="name" value="'+esc(b.name)+'" placeholder="Business name">' +
    '<span class="pl-muted">Value $</span><input type="number" class="pl-input-sm" style="width:110px" data-field="value" value="'+(b.value||'')+'">' +
    '<select class="pl-input-sm" data-field="succession">' + ['None','Informal plan','Documented plan'].map(function(s){ return '<option '+(b.succession===s?'selected':'')+'>'+s+'</option>'; }).join('') + '</select>' +
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

  document.getElementById('income-list').innerHTML = state.income.map(function(r){ return valRow(r,'/mo'); }).join('') || '<div class="pl-col-empty">No income sources yet.</div>';
  document.getElementById('expense-list').innerHTML = state.expenses.map(function(r){ return valRow(r,'/mo'); }).join('') || '<div class="pl-col-empty">No expenses yet.</div>';
  document.getElementById('assets-list').innerHTML = state.assets.map(function(r){ return valRow(r,''); }).join('') || '<div class="pl-col-empty">No assets listed yet.</div>';
  document.getElementById('debts-list').innerHTML = state.debts.map(function(r){ return valRow(r,''); }).join('') || '<div class="pl-col-empty">No debts listed yet.</div>';
  document.getElementById('businesses-list').innerHTML = state.businesses.map(bizRow).join('') || '<div class="pl-col-empty">No businesses added yet.</div>';

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

  var totalAssets = state.assets.reduce(function(s,r){ return s+r.amt; },0);
  var totalDebts = state.debts.reduce(function(s,r){ return s+r.amt; },0);
  var netWorth = totalAssets-totalDebts;
  document.getElementById('m-assets').textContent = money(totalAssets);
  document.getElementById('m-debts').textContent = money(totalDebts);
  var nwEl = document.getElementById('m-networth');
  nwEl.textContent = money(netWorth);
  nwEl.style.color = netWorth<0 ? '#9C3B2E' : 'var(--ink)';

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
  if(totalDebts>0 && netWorth<0) flags.push({ok:false,text:'Debts currently exceed assets by '+money(-netWorth)+'. Worth discussing how this affects what\'s available to distribute.'});
  state.businesses.forEach(function(b){
    if(b.succession==='None') flags.push({ok:false,text:(esc(b.name)||'A business')+' has no succession plan. This affects how it\'s handled in your estate plan.'});
    if(b.succession==='Documented plan') flags.push({ok:true,text:(esc(b.name)||'A business')+' already has a documented succession plan in place.'});
  });
  renderFlags('picture-flags', flags);
}

/* ---------------- suggested next steps (shown on the plan page) ---------------- */
function computeSuggestions(){
  var s = [];
  state.family.forEach(function(p){
    if(needsTrust(p) && !p.trustee){
      var text, detail;
      if(p.sn){
        text = 'Set up a special needs trust for '+p.name;
        detail = 'A third-party special needs trust keeps this share from counting against SSI or Medicaid eligibility. It needs its own precise terms — it can’t be pooled with a sibling’s trust, and an inheritance this size shouldn’t go into an ABLE account instead.';
      } else if(p.minor){
        text = 'Set up a trust for '+p.name+' (minor beneficiary)';
        detail = 'Illinois law doesn’t allow a minor to inherit property directly — a trustee manages it until they’re of age.';
      } else {
        text = 'Consider a trust with staggered distributions for '+p.name;
        detail = 'Staggered distributions through a trust help protect the inheritance given the concern you flagged.';
      }
      s.push({key:'trust-'+p.id, text:text, detail:detail, cat:'Trust'});
    }
  });
  if(state.family.length && !state.executorId){
    s.push({key:'executor', text:'Choose an executor', detail:'Someone needs legal authority to settle your estate — pay debts, file paperwork, and distribute assets.', cat:'Documents'});
  }
  if(state.relStatus==='Married, separated' || state.relStatus==='Divorce in progress'){
    s.push({key:'divorce-docs', text:'Update beneficiary designations, power of attorney, and health care proxy', detail:'Until the divorce is final, an estranged spouse may still have authority as your agent or beneficiary.', cat:'Documents'});
  }
  if(state.relStatus==='Divorced'){
    s.push({key:'ex-beneficiary', text:'Remove your ex-spouse from beneficiary designations', detail:'Illinois revokes an ex-spouse’s share of a will automatically, but not beneficiary designations on insurance or retirement accounts.', cat:'Documents'});
  }
  if(state.relStatus==='Remarried or repartnered' && state.hasPriorKids){
    s.push({key:'blended-trust', text:'Set up a trust to protect children from a prior relationship', detail:'A QTIP or life insurance trust can provide for your spouse during their lifetime while still guaranteeing the remainder reaches your children, rather than your spouse’s estate or a new spouse.', cat:'Trust'});
  }
  if(state.relStatus==='Unmarried partner (cohabiting)'){
    s.push({key:'partner-will', text:'Name your partner in a will or trust', detail:'Illinois intestacy law gives unmarried partners no automatic inheritance rights at all.', cat:'Documents'});
  }
  state.businesses.forEach(function(b){
    if(b.succession==='None'){
      s.push({key:'biz-succession-'+b.id, text:'Start a succession plan for '+(b.name||'your business'), detail:'Without a plan, what happens to the business after you’re gone is left to default probate rules.', cat:'Business'});
    }
  });
  return s;
}
function renderSuggestions(){
  var suggestions = computeSuggestions();
  document.getElementById('pri-suggestions-wrap').style.display = suggestions.length ? '' : 'none';
  document.getElementById('pri-suggestions').innerHTML = suggestions.map(function(s){
    return '<div class="pl-card">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span class="pl-tag pl-tag-'+s.cat+'">'+s.cat+'</span>' +
        '<span style="flex:1;font-size:13.5px;font-weight:500;">'+esc(s.text)+'</span>' +
      '</div>' +
      (s.detail ? '<div class="pl-muted" style="font-size:12.5px;margin-top:4px;">'+esc(s.detail)+'</div>' : '') +
    '</div>';
  }).join('');
}

/* ---------------- step 4: the plan ---------------- */
function renderPlan(){
  renderSuggestions();
  var svg = document.getElementById('plan-diagram');
  var people = state.family;
  if(people.length===0){
    svg.innerHTML = '';
    svg.setAttribute('viewBox','0 0 680 60');
    document.getElementById('plan-summary').textContent = 'Add your family in step 1 to see your plan summary here.';
  } else {
    var items = people.map(function(p){ return { p:p, source:{x:340,y:50}, dashed:false, sourceKey:'estate' }; });
    var flow = renderFlow(buildSlots(items), 80, people, function(p){ return p.pct+'%'; });
    var parts = '<rect x="280" y="10" width="120" height="40" rx="4" fill="var(--forest)"/><text x="340" y="34" text-anchor="middle" class="pl-t-on-dark">Your estate</text>';
    parts += flow.svg;
    svg.innerHTML = parts;
    svg.setAttribute('viewBox', '0 0 680 '+Math.max(180, flow.bottomY+20));

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
  renderPlan();
}
renderAll();
})();
