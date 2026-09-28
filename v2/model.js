import {BUILTIN_EXERCISES,DEFAULT_TEMPLATES,catalogWithCustom,findExerciseByName,normalize} from './catalog.js';

export const uid=()=>crypto.randomUUID();
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function dateLabel(ds,opts={weekday:'long',day:'numeric',month:'long'}){return new Date(`${ds}T12:00:00`).toLocaleDateString('fr-CA',opts)}
export function defaultState(){return {schemaVersion:2,sessions:[],events:[],customExercises:[],templates:structuredClone(DEFAULT_TEMPLATES),
  shoes:[{id:'wow-808-5-v2',name:'Way of Wade 808 5 v2',archived:false},{id:'sky-elite-ff4',name:'ASICS Sky Elite FF 4',archived:false}],
  favorites:['belt-squat','bulgarian-split-squat','nordic-curl','bench-press','pull-up','dips','approach-jump','block-jump'],
  recentExercises:[],activeSessionId:null,calendar:{clientId:'',keywords:['volley','ltvq','tournoi','match','pratique'],lastSynced:null,seededAt:null},
  meta:{createdAt:new Date().toISOString(),lastBackupAt:null,legacyImportedAt:null}}}

export function exerciseFor(state,id){return catalogWithCustom(state.customExercises).find(item=>item.id===id)}
export function sessionFor(state,id){return state.sessions.find(session=>session.id===id)}
export function recentCompletedEntry(state,exerciseId,beforeDate=localDate()){
  const candidates=state.sessions.filter(s=>s.type==='workout'&&s.status==='completed'&&s.date<=beforeDate).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
  for(const session of candidates){const entry=session.entries?.find(item=>item.exerciseId===exerciseId && item.sets?.some(row=>row.actual));if(entry)return entry}
  return null;
}
export function entryFromCatalog(state,exerciseId,date=localDate()){
  const exercise=exerciseFor(state,exerciseId);
  if(!exercise)throw new Error('Exercice introuvable');
  const previous=recentCompletedEntry(state,exerciseId,date);
  const oldValues=previous?.sets.filter(row=>row.actual).map(row=>structuredClone(row.actual))||[];
  const targets=oldValues.length?oldValues:Array.from({length:3},()=>({}));
  return {id:uid(),exerciseId,name:exercise.name,kind:exercise.kind,unit:previous?.unit||'kg',note:'',
    sets:targets.map(target=>({id:uid(),target,actual:null,skipped:false,note:''}))};
}
export function createWorkout(state,templateId,date=localDate()){
  const template=state.templates.find(t=>t.id===templateId);
  const ids=template?.exerciseIds||[];
  return {id:uid(),type:'workout',date,title:template?.name||'Séance libre',templateId:templateId||null,status:'planned',
    entries:ids.map(id=>entryFromCatalog(state,id,date)),note:'',createdAt:new Date().toISOString(),source:'v2'};
}
export function createVolley(type,date=localDate(),event=null){
  const title=event?.title||({team:'Pratique d’équipe',solo:'Pratique individuelle',match:'Match',tournament:'Tournoi',note:'Note'}[type]||'Volley');
  return {id:uid(),type,date,title,status:'planned',eventId:event?.id||null,shoeIds:[],focusTags:[],drills:[],note:'',durationMin:null,
    matches:['match','tournament'].includes(type)?[]:undefined,poolSets:type==='tournament'?2:undefined,createdAt:new Date().toISOString(),source:'v2'};
}
export function addExerciseToWorkout(state,session,exerciseId,replaceEntryId=null){
  const entry=entryFromCatalog(state,exerciseId,session.date);
  if(replaceEntryId){const index=session.entries.findIndex(item=>item.id===replaceEntryId);if(index>=0)session.entries.splice(index,1,entry);else session.entries.push(entry)}
  else session.entries.push(entry);
  state.recentExercises=[exerciseId,...state.recentExercises.filter(id=>id!==exerciseId)].slice(0,20);
  return entry;
}
export function makeCustomExercise(state,name,kind='strength',equipment='Autre'){
  const trimmed=name.trim();if(!trimmed)throw new Error('Donne un nom à l’exercice.');
  const existing=findExerciseByName(trimmed,state.customExercises);
  if(existing && existing.kind===kind)return existing;
  const item={id:`custom-${uid()}`,name:trimmed,kind,equipment,aliases:[],custom:true};state.customExercises.push(item);return item;
}
export function completedSetCount(session){return (session.entries||[]).reduce((n,entry)=>n+entry.sets.filter(row=>!!row.actual).length,0)}
export function totalSetCount(session){return (session.entries||[]).reduce((n,entry)=>n+entry.sets.length,0)}
export function firstPending(session){
  for(let ei=0;ei<(session.entries||[]).length;ei++)for(let si=0;si<session.entries[ei].sets.length;si++){
    const row=session.entries[ei].sets[si];if(!row.actual&&!row.skipped)return {ei,si};
  }
  return null;
}
export function formatSet(kind,value={},unit='kg'){
  if(!value || Object.keys(value).length===0)return 'À saisir';
  const n=(k)=>value[k]??'—';
  if(kind==='hold')return `${n('seconds')} s${value.load!=null?` · ${value.load} ${unit==='lbs'?'lb':'kg'}`:''}`;
  if(kind==='level')return `${n('reps')} rép. · ${n('level')} bloc${Number(value.level)>1?'s':''}${value.negatives?` · ${value.negatives} nég.`:''}`;
  if(kind==='jump')return `${n('reps')} saut${Number(value.reps)>1?'s':''}${value.height!=null?` · ${value.height} cm`:''}`;
  if(kind==='sprint')return `${n('reps')} × ${n('distance')} m`;
  if(kind==='reps')return `${n('reps')} répétitions`;
  return `${n('reps')} × ${value.load==null?'—':value.load} ${unit==='lbs'?'lb':'kg'}`;
}
export function scoreMatch(match){
  if(match.us==null||match.them==null)return null;
  return match.us>match.them?'V':match.us<match.them?'D':'N';
}
export function rankCatalog(state,query='',equipment='Tout'){
  const q=normalize(query);
  return catalogWithCustom(state.customExercises).filter(ex=>{
    if(equipment!=='Tout'&&ex.equipment!==equipment)return false;
    return !q||[ex.name,ex.equipment,...ex.aliases].some(value=>normalize(value).includes(q));
  }).sort((a,b)=>{
    const score=ex=>(state.favorites.includes(ex.id)?100:0)+(state.recentExercises.includes(ex.id)?30-state.recentExercises.indexOf(ex.id):0)+(q&&normalize(ex.name).startsWith(q)?50:0);
    return score(b)-score(a)||a.name.localeCompare(b.name);
  });
}

export function upcomingEvents(state,from=localDate()){
  return state.events.filter(e=>e.date>=from && e.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date)||String(a.startTime||'').localeCompare(String(b.startTime||'')));
}

export const FOCUS_TAGS=['Attaque','Réception','Bloc','Défense','Service','Passe','Transition'];
