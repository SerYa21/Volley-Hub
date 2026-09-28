import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,createWorkout,completedSetCount,entryFromCatalog,addExerciseToWorkout,scoreMatch,rankCatalog} from '../model.js';
import {convertLegacy} from '../legacy.js';

test('a planned workout copies suggestions without recording completed sets',()=>{
  const state=defaultState();
  const first=createWorkout(state,'upper-force','2026-09-20');
  const bench=first.entries.find(e=>e.exerciseId==='bench-press');
  bench.sets[0].target={reps:5,load:80};bench.sets[0].actual={reps:5,load:80};
  first.status='completed';state.sessions.push(first);
  const next=createWorkout(state,'upper-force','2026-09-28');
  const suggested=next.entries.find(e=>e.exerciseId==='bench-press');
  assert.deepEqual(suggested.sets[0].target,{reps:5,load:80});
  assert.equal(suggested.sets[0].actual,null);
  assert.equal(completedSetCount(next),0);
});

test('one-off exercise substitution uses its own history',()=>{
  const state=defaultState();
  const old=createWorkout(state,'lower-force','2026-09-20');
  old.entries.find(e=>e.exerciseId==='belt-squat').sets[0].actual={reps:4,load:95};
  old.entries.push(entryFromCatalog(state,'smith-squat','2026-09-20'));
  old.entries.at(-1).sets[0].actual={reps:4,load:110};old.status='completed';state.sessions.push(old);
  const next=createWorkout(state,'lower-force','2026-09-28');
  const belt=next.entries.find(e=>e.exerciseId==='belt-squat');
  const smith=addExerciseToWorkout(state,next,'smith-squat',belt.id);
  assert.deepEqual(smith.sets[0].target,{reps:4,load:110});
  assert.equal(next.entries.some(e=>e.exerciseId==='belt-squat'),false);
  assert.equal(state.templates[0].exerciseIds[0],'belt-squat');
});

test('legacy rows remain unverified unless the old completed checkbox was set',()=>{
  const old={'2026-09-01':[{id:'abc',type:'physique',programDay:'Upper Force',done:false,exercises:[{id:'e',name:'Traction',cat:'autre',unit:'kg',setRows:[{reps:'6',weight:'17.5'}]}]}],
    '2026-09-02':[{id:'def',type:'physique',programDay:'Lower Force',done:true,exercises:[{name:'Nordic Curl',cat:'niveau',setRows:[{reps:'4',level:'3'}]}]}]};
  const one=convertLegacy(old),two=convertLegacy(old);
  assert.deepEqual(one.sessions.map(s=>s.id),two.sessions.map(s=>s.id));
  assert.equal(one.events.length,0);
  assert.equal(one.sessions[0].status,'legacy');
  assert.equal(one.sessions[0].entries[0].sets[0].actual,null);
  assert.deepEqual(one.sessions[1].entries[0].sets[0].actual,{reps:4,level:3});
});

test('legacy volleyball dates become agenda events without inventing completed sessions',()=>{
  const old={'2026-08-03':[{id:'volley',type:'equipe',journal:'Réception solide'}],
    '2026-10-03':[{id:'tournament',type:'tournoi',eventTitle:'Tournoi local'}]};
  const imported=convertLegacy(old);
  assert.equal(imported.sessions[0].status,'completed');
  assert.equal(imported.sessions[1].status,'planned');
  assert.equal(imported.events.length,2);
  assert.equal(imported.sessions[1].eventId,imported.events[1].id);
});

test('exercise aliases search across languages and tournament draws count',()=>{
  const state=defaultState();
  assert.equal(rankCatalog(state,'fente bulgare')[0].id,'bulgarian-split-squat');
  assert.equal(rankCatalog(state,'Copenhagen Plank (ankle)')[0].id,'copenhagen-plank');
  assert.equal(scoreMatch({us:1,them:1}),'N');
  assert.equal(scoreMatch({us:null,them:null}),null);
});
