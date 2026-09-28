import {findExerciseByName,normalize} from './catalog.js';

const TYPE_MAP={physique:'workout',technique:'solo',equipe:'team',match:'match',tournoi:'tournament'};
const TEMPLATE_MAP={'Lower Force':'lower-force','Upper Force':'upper-force','Power Sprint':'power-sprint','Upper Hypertrophy':'upper-hypertrophy'};
const CAT_KIND={quad:'strength',ischio:'strength',autre:'strength',jump:'jump',sprint:'sprint',isometrique:'hold',niveau:'level'};
const pickNumber=value=>value===''||value==null?null:(Number.isFinite(Number(value))?Number(value):null);
const makeId=()=>crypto.randomUUID();

export function looksLikeLegacy(data){
  const keys=data&&typeof data==='object'&&!Array.isArray(data)?Object.keys(data):[];
  return keys.length>0 && keys.every(key=>/^\d{4}-\d{2}-\d{2}$/.test(key)&&Array.isArray(data[key]));
}

export function convertLegacy(data){
  if(!looksLikeLegacy(data)) throw new Error('Le fichier ne correspond pas au format V1.');
  const sessions=[];
  const events=[];
  const customExercises=[];
  const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for(const [date,oldSessions] of Object.entries(data).sort(([a],[b])=>a.localeCompare(b))){
    for(const [sessionIndex,old] of oldSessions.entries()){
      if(!TYPE_MAP[old?.type]) continue;
      const type=TYPE_MAP[old.type];
      const hasVolleyContent=!!(String(old.journal||'').trim()||old.durationMin||old.focusTags?.length||
        old.matches?.some(match=>pickNumber(match.us)!==null&&pickNumber(match.them)!==null));
      const status=type==='workout'?(old.done===true?'completed':date>=today?'planned':'legacy'):
        (date>today?'planned':hasVolleyContent?'completed':date===today?'planned':'legacy');
      const base={id:`v1:${date}:${old.id||sessionIndex}`,type,date,title:type==='workout'?(old.programDay||'Musculation'):(old.eventTitle||''),status,
        note:String(old.journal||''),source:'v1',createdAt:new Date().toISOString()};
      if(type==='workout'){
        base.templateId=TEMPLATE_MAP[old.programDay]||null;
        base.entries=(old.exercises||[]).map(ex=>{
          const name=String(ex.name||'Exercice').trim();
          const kind=CAT_KIND[ex.cat]||'strength';
          let match=findExerciseByName(name,customExercises);
          if(!match || match.kind!==kind){
            match=customExercises.find(item=>normalize(item.name)===normalize(name)&&item.kind===kind);
            if(!match){match={id:`custom-v1-${kind}-${normalize(name).replace(/\s+/g,'-')}`,name,kind,equipment:'Autre',aliases:[],custom:true};customExercises.push(match)}
          }
          const sourceRows=ex.setRows?.length?ex.setRows:[{}];
          return {id:makeId(),exerciseId:match.id,name,kind,unit:ex.unit==='lbs'?'lbs':'kg',bodyweight:!!ex.bodyweight,
            invertRecord:!!ex.invertRecord,note:'',sets:sourceRows.map(row=>{
              const value={};
              for(const key of ['reps','load','height','distance','seconds','level','negatives']){
                const original=key==='load'?row.weight:row[key];
                const n=pickNumber(original);
                if(n!==null) value[key]=n;
              }
              return {id:makeId(),target:value,actual:old.done===true?{...value}:null,skipped:false,note:String(row.notes||'')};
            })};
        });
      }else{
        base.focusTags=Array.isArray(old.focusTags)?old.focusTags.filter(t=>typeof t==='string'):[];
        base.shoeIds=[];
        base.drills=[];
        base.matches=[];
        base.durationMin=pickNumber(old.durationMin);
        if(type==='tournament'){
          base.poolSets=Number(old.poolSets)||2;
          base.matches=(old.matches||[]).map(m=>({id:makeId(),phase:m.phase==='playoff'?'playoff':'pool',opponent:String(m.opponent||''),
            us:pickNumber(m.us),them:pickNumber(m.them),legacyResult:m.result||''}));
        }
        const eventId=`v1-event:${date}:${old.id||sessionIndex}`;
        base.eventId=eventId;
        events.push({id:eventId,source:'v1',date,title:base.title||({team:'Pratique d’équipe',solo:'Pratique individuelle',match:'Match',tournament:'Tournoi'}[type]),
          startTime:'',location:'',status:'confirmed'});
      }
      sessions.push(base);
    }
  }
  return {sessions,events,customExercises,importedCount:sessions.length,uncertainCount:sessions.filter(s=>s.status==='legacy').length};
}

export function isValidV2(data){return data?.schemaVersion===2 && Array.isArray(data.sessions) && Array.isArray(data.shoes) && Array.isArray(data.templates) && Array.isArray(data.customExercises)}
