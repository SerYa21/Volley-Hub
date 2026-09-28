import {BUILTIN_EXERCISES,KINDS,catalogWithCustom,normalize} from './catalog.js';
import {loadState,saveState,waitForWrites} from './storage.js';
import {looksLikeLegacy,convertLegacy,isValidV2} from './legacy.js';
import {authorizeCalendar,readUpcomingCalendar} from './calendar.js';
import {uid,localDate,dateLabel,defaultState,exerciseFor,sessionFor,createWorkout,createVolley,entryFromCatalog,addExerciseToWorkout,makeCustomExercise,completedSetCount,totalSetCount,firstPending,formatSet,scoreMatch,rankCatalog,upcomingEvents,FOCUS_TAGS} from './model.js';

let state;
let route='today';
let currentId=null;
let focus=null;
let picker={replaceId:null,query:'',equipment:'Tout',mode:'workout'};
let journalQuery='';
let pendingImport=null;
let undoAction=null;
let toastTimer;
let saveVersion=0;
let restInterval;
let pendingCalendar=[];

const main=document.getElementById('main');
const sheetRoot=document.getElementById('sheet-root');
const statusEl=document.getElementById('save-status');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const numeric=value=>value===''||value==null?'':String(value);
const statusText={planned:'Prévu',active:'En cours',completed:'Terminé',legacy:'À vérifier'};
const typeText={workout:'Musculation',team:'Pratique d’équipe',solo:'Pratique individuelle',match:'Match',tournament:'Tournoi',note:'Note'};
const iconFor={workout:'◆',team:'●',solo:'◇',match:'◈',tournament:'★',note:'✎'};

function toast(message,undo=null){
  const el=document.getElementById('toast');
  undoAction=undo;
  el.innerHTML=esc(message)+(undo?` <button type="button" data-action="undo" style="color:#ffda9b;background:none;border:0;font-weight:800;min-height:40px">Annuler</button>`:'');
  el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.classList.remove('show');undoAction=null},undo?9000:3500);
}
function save(){
  const version=++saveVersion;statusEl.textContent='Enregistrement…';statusEl.classList.remove('error');
  saveState(state).then(()=>{if(version===saveVersion)statusEl.textContent='Enregistré ✓'}).catch(error=>{
    statusEl.textContent='Non enregistré';statusEl.classList.add('error');toast(`Erreur de sauvegarde : ${error.message}`);
  });
}
function change(fn,rerender=true){fn();save();if(rerender)render()}
function closeSheet(){sheetRoot.innerHTML='';document.body.classList.remove('sheet-open')}
function openSheet(title,body){
  sheetRoot.innerHTML=`<div class="sheet-backdrop" data-action="close-sheet"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Fermer">×</button></div>${body}</section></div>`;
  document.body.classList.add('sheet-open');
  sheetRoot.querySelector('.sheet-close').focus();
}
function badge(status){return `<span class="badge ${status==='completed'?'done':status}">${esc(statusText[status]||status)}</span>`}
function nav(tab){route=tab;currentId=null;focus=null;closeSheet();render();window.scrollTo(0,0)}
function openSession(id){
  const session=sessionFor(state,id);if(!session)return;
  currentId=id;state.activeSessionId=session.status==='active'?id:state.activeSessionId;
  route=session.type==='workout'?'workout':'volley';focus=session.type==='workout'?firstPending(session):null;
  closeSheet();render();window.scrollTo(0,0);
}
function sessionName(session){return session.title||typeText[session.type]||'Séance'}
function shortLocation(location){return String(location||'').split(',')[0].trim()}
function linkedSession(eventId){return state.sessions.find(s=>s.eventId===eventId)}
function legacyLocalAvailable(){try{return looksLikeLegacy(JSON.parse(localStorage.getItem('sessionsByDate')||'null'))}catch{return false}}

function render(){
  document.querySelectorAll('[data-nav]').forEach(button=>{
    const active=button.dataset.nav===(route==='workout'||route==='volley'?'today':route);
    button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');
  });
  main.innerHTML=route==='today'?renderToday():route==='calendar'?renderCalendar():route==='journal'?renderJournal():route==='settings'?renderSettings():route==='workout'?renderWorkout():renderVolley();
  updateRestLabel();
}

function renderToday(){
  const today=localDate();
  const active=state.sessions.find(s=>s.id===state.activeSessionId&&s.status==='active');
  const next=upcomingEvents(state)[0];
  const recent=state.sessions.filter(s=>s.date<=today).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,3);
  return `<div class="hero"><p class="eyebrow">${esc(dateLabel(today,{weekday:'long',day:'numeric',month:'long'}))}</p><h1>Prêt pour la séance ?</h1><p class="subtle">Commence, valide chaque série et reprends exactement où tu t’es arrêté.</p></div>
  ${active?`<section class="card important"><p class="eyebrow">En cours</p><h2>${esc(sessionName(active))}</h2><p class="subtle">${active.type==='workout'?`${completedSetCount(active)} séries validées`:'Séance de volley en cours'}</p><button class="button primary wide" data-action="open-session" data-id="${esc(active.id)}">Reprendre la séance</button></section>`:''}
  <div class="section-head"><h2>Démarrer</h2></div><div class="quick-actions">
    <button class="button primary" data-action="choose-template">◆ Musculation</button>
    <button class="button" data-action="new-volley" data-type="team">● Équipe</button>
    <button class="button" data-action="new-volley" data-type="solo">◇ Individuel</button>
    <button class="button" data-action="choose-volley-type">★ Match / tournoi</button>
  </div>
  <div class="section-head"><h2>À venir</h2><button class="text-button" data-nav="calendar">Agenda</button></div>
  ${next?`<section class="card important"><div class="between"><div><strong>${esc(next.title)}</strong><div class="event-meta">${esc(dateLabel(next.date))}${next.startTime?' · '+esc(next.startTime):''}${next.location?' · '+esc(shortLocation(next.location)):''}</div></div><span class="badge planned">Prévu</span></div><div class="button-row mt">${linkedSession(next.id)?`<button class="button" data-action="open-session" data-id="${esc(linkedSession(next.id).id)}">Ouvrir la séance</button>`:`<button class="button" data-action="log-event" data-id="${esc(next.id)}">Consigner cet événement</button>`}</div></section>`:
    `<div class="empty">Aucun événement à venir dans Volley Hub. Tu peux en ajouter dans l’agenda ou connecter Google dans les réglages.</div>`}
  <div class="section-head"><h2>Récent</h2><button class="text-button" data-nav="journal">Tout voir</button></div>
  ${recent.length?`<div class="stack">${recent.map(s=>`<button class="journal-item" data-action="open-session" data-id="${esc(s.id)}"><div class="between"><strong>${esc(sessionName(s))}</strong>${badge(s.status)}</div><span class="subtle">${esc(dateLabel(s.date,{day:'numeric',month:'short'}))} · ${esc(typeText[s.type])}</span></button>`).join('')}</div>`:'<div class="empty">Ton historique apparaîtra ici après la première séance.</div>'}`;
}

function renderCalendar(){
  const today=localDate();
  const events=state.events.filter(e=>e.date>=today&&e.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date)||String(a.startTime||'').localeCompare(String(b.startTime||'')));
  const weeks=new Map();for(const item of events){if(!weeks.has(item.date))weeks.set(item.date,[]);weeks.get(item.date).push(item)}
  return `<p class="eyebrow">Planning</p><h1>Agenda</h1><p class="subtle">Les dates restent des événements prévus. Une séance n’est enregistrée que lorsque tu la consignes.</p>
  <div class="button-row"><button class="button primary" data-action="new-event">+ Ajouter un événement</button><button class="button" data-action="sync-google">↻ Google Agenda</button></div>
  <p class="hint mt">${state.calendar.lastSynced?`Dernière actualisation Google : ${esc(new Date(state.calendar.lastSynced).toLocaleString('fr-CA'))}.`:state.calendar.seededAt?`Dates de volley relevées dans Google Agenda le ${esc(dateLabel(state.calendar.seededAt,{day:'numeric',month:'long',year:'numeric'}))}. Actualise pour voir les changements.`:''}</p>
  <div class="section-head"><h2>Les prochaines dates</h2></div>
  ${events.length?`<div class="stack">${[...weeks.entries()].map(([date,items])=>`<section><h3 class="timeline-day">${esc(dateLabel(date))}</h3><div class="stack">${items.map(event=>{
    const linked=linkedSession(event.id);
    return `<div class="card compact event-row"><div class="date-tile"><strong>${esc(date.slice(8,10))}</strong><span>${esc(dateLabel(date,{month:'short'}))}</span></div><div class="row-main"><div class="row-title">${esc(event.title)}</div><div class="event-meta">${event.startTime?esc(event.startTime):'Toute la journée'}${event.location?' · '+esc(shortLocation(event.location)):''}${event.source==='google'?' · Google':''}</div></div><button class="button small-btn" data-action="${linked?'open-session':'log-event'}" data-id="${esc(linked?.id||event.id)}">${linked?'Ouvrir':'Consigner'}</button></div>`}).join('')}</div></section>`).join('')}</div>`:'<div class="empty">Aucune date importée. Ajoute un événement ou connecte ton agenda.</div>'}`;
}

function renderJournal(){
  const entries=state.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
  const q=normalize(journalQuery);const filtered=entries.filter(s=>!q||normalize([sessionName(s),s.note,(s.focusTags||[]).join(' '),s.entries?.map(e=>e.name).join(' ')].join(' ')).includes(q));
  return `<p class="eyebrow">Historique</p><h1>Journal</h1><div class="field"><label class="form-label" for="journal-search">Chercher une séance ou une note</label><input id="journal-search" data-input="journal-search" type="search" placeholder="Ex. attaque, Nordic, réception" value="${esc(journalQuery)}"></div>
  <div id="journal-results">${journalList(filtered)}</div>`;
}
function journalList(items){return items.length?`<div class="stack">${items.map(s=>`<button class="journal-item" data-action="open-session" data-id="${esc(s.id)}"><div class="between"><strong>${esc(sessionName(s))}</strong>${badge(s.status)}</div><span class="subtle">${esc(dateLabel(s.date,{weekday:'short',day:'numeric',month:'short'}))} · ${esc(typeText[s.type])}</span>${s.note?`<div class="small muted">${esc(s.note.slice(0,120))}${s.note.length>120?'…':''}</div>`:''}</button>`).join('')}</div>`:'<div class="empty">Aucune séance trouvée.</div>'}

function renderSettings(){
  const activeShoes=state.shoes.filter(s=>!s.archived);const archived=state.shoes.filter(s=>s.archived);
  return `<p class="eyebrow">Personnaliser et protéger</p><h1>Réglages</h1>
  <section class="card"><h2>Rotation de chaussures</h2><p class="subtle">Elles apparaissent uniquement dans tes séances de volley.</p>
  <div class="stack">${activeShoes.map(shoe=>`<div class="between"><strong>${esc(shoe.name)}</strong><button class="text-button" data-action="edit-shoe" data-id="${esc(shoe.id)}">Modifier</button></div>`).join('')||'<p class="subtle">Aucune paire active.</p>'}</div>
  <button class="button mt" data-action="add-shoe">+ Ajouter une paire</button>${archived.length?`<p class="hint mt">${archived.length} paire(s) archivées · <button class="text-button" data-action="manage-shoes">Gérer</button></p>`:''}</section>
  <section class="card mt"><h2>Programmes</h2><p class="subtle">Une modification ponctuelle pendant la séance ne change pas ton programme habituel.</p>
  ${state.templates.map(t=>`<div class="between"><span><strong>${esc(t.name)}</strong><br><small class="muted">${t.exerciseIds.length} exercices</small></span><button class="text-button" data-action="edit-template" data-id="${esc(t.id)}">Modifier</button></div>`).join('')}
  <button class="button mt" data-action="new-template">+ Nouveau programme</button></section>
  <section class="card mt"><h2>Google Agenda</h2><p class="subtle">Lecture seule. Les événements importés restent disponibles hors ligne après une synchronisation.</p>
  <div class="field"><label class="form-label" for="google-client">Identifiant OAuth de l’app Google</label><input id="google-client" data-input="google-client" type="text" autocomplete="off" placeholder="…apps.googleusercontent.com" value="${esc(state.calendar.clientId)}"></div>
  <div class="field"><label class="form-label" for="google-keywords">Mots pour proposer les événements de volley</label><input id="google-keywords" data-input="google-keywords" type="text" value="${esc(state.calendar.keywords.join(', '))}"></div>
  <button class="button" data-action="sync-google">Connecter / actualiser</button><p class="hint mt">Le connecteur ChatGPT n’autorise pas automatiquement cette app. La connexion dans cette version web demande un identifiant OAuth Google et une nouvelle autorisation après expiration de la session. Une synchronisation en arrière-plan nécessitera un serveur.</p></section>
  <section class="card mt"><h2>Sauvegarde</h2><p class="subtle">L’export contient les séances, programmes, chaussures et réglages. Garde une copie dans Fichiers ou iCloud Drive.</p>
  <div class="button-row"><button class="button primary" data-action="export">Exporter</button><button class="button" data-action="import">Importer V1, V2 ou dates</button></div>
  ${legacyLocalAvailable()?'<button class="text-button" data-action="preview-local-v1">Importer les données V1 détectées sur cet appareil</button>':''}
  <p class="hint mt">${state.meta.lastBackupAt?`Dernier export lancé : ${esc(new Date(state.meta.lastBackupAt).toLocaleString('fr-CA'))}.`:'Aucun export enregistré dans cette version.'} Le navigateur ne peut pas confirmer que le fichier a bien été conservé : vérifie sa présence dans Fichiers.</p>
  <button class="text-button" data-action="storage-info">État du stockage</button></section>
  <p class="hint mt">Volley Hub V2 · ${BUILTIN_EXERCISES.length} exercices de départ · sauvegarde locale hors ligne.</p>`;
}

function focused(session){
  if(focus&&session.entries[focus.ei]?.sets?.[focus.si])return focus;
  focus=firstPending(session);return focus;
}
function currentDraft(row){return row.draft||row.actual||row.target||{}}
function renderWorkout(){
  const session=sessionFor(state,currentId);if(!session)return `<div class="empty">Séance introuvable.</div>`;
  const count=completedSetCount(session),total=totalSetCount(session),point=focused(session);
  const current=point?session.entries[point.ei]:null;const set=point?current.sets[point.si]:null;
  return `<div class="workout-top"><div><button class="text-button" data-nav="today">← Aujourd’hui</button><p class="eyebrow">${esc(dateLabel(session.date))}</p><h1>${esc(sessionName(session))}</h1></div>${badge(session.status)}</div>
  ${session.status==='legacy'?'<p class="hint">Ancienne entrée : les chiffres préremplis ne sont pas présumés réalisés. Valide uniquement les séries dont tu es sûr.</p>':''}
  <p class="subtle">${count} série${count>1?'s':''} validée${count>1?'s':''} · ${total} prévue${total>1?'s':''}</p><div class="progress-line" aria-label="${count} séries validées sur ${total}"><span style="width:${total?Math.round(100*count/total):0}%"></span></div>
  ${current?`<section id="focus-card" class="card exercise-focus mt"><div class="ex-heading"><div><p class="eyebrow">Exercice ${point.ei+1} / ${session.entries.length}</p><h2>${esc(current.name)}</h2><p class="small muted">Série ${point.si+1} / ${current.sets.length}${current.unit==='lbs'?' · lb':' · kg'}</p></div><button class="button icon-btn" data-action="exercise-menu" aria-label="Options de l’exercice">⋯</button></div>
    <div class="set-list">${current.sets.map((row,i)=>`<button type="button" class="set-line ${i===point.si?'current ':''}${row.actual?'done ':''}${row.skipped?'skipped':''}" data-action="focus-set" data-ei="${point.ei}" data-si="${i}"><span class="set-index">${i+1}.</span><span class="set-value">${esc(formatSet(current.kind,row.actual||row.target,current.unit))}</span><span class="set-status">${row.actual?'✓':row.skipped?'Passée':i===point.si?'À faire':'Prévu'}</span></button>`).join('')}</div>
    ${renderSetFields(current,set)}
    <div class="button-row set-actions"><button class="button primary" data-action="complete-set">${set.actual?'Mettre à jour':'✓ Valider la série'}</button><button class="button" data-action="skip-set">${set.skipped?'Rétablir':'Passer'}</button></div>
    <div class="button-row mt"><button class="text-button" data-action="add-set">+ Série</button>${set.actual?'<button class="text-button" data-action="undo-set">Annuler cette série</button>':''}<button class="text-button" data-action="rest-timer">Repos 90 s <span id="rest-label"></span></button></div>
  </section>`:`<section class="card important mt"><h2>${session.entries.length?'Toutes les séries sont traitées':'Ajoute ton premier exercice'}</h2><p class="subtle">Tu peux encore ajouter une série, un exercice ou corriger une valeur.</p><button class="button primary" data-action="pick-exercise">+ Ajouter un exercice</button></section>`}
  <div class="section-head"><h2>Exercices</h2><button class="text-button" data-action="pick-exercise">+ Ajouter</button></div>
  <div class="exercise-overview">${session.entries.map((entry,ei)=>`<button class="overview-row ${point?.ei===ei?'current':''}" data-action="focus-exercise" data-ei="${ei}"><span aria-hidden="true">${entry.sets.every(r=>r.actual||r.skipped)?'✓':'○'}</span><span class="grow">${esc(entry.name)}</span><small class="muted">${entry.sets.filter(r=>r.actual).length}/${entry.sets.length}</small></button>`).join('')}</div>
  <div class="section-head"><h2>Note de séance</h2></div><div class="field"><label class="form-label" for="workout-note">Facultatif</label><textarea id="workout-note" data-input="session-note" placeholder="Un ressenti ou une consigne à retrouver plus tard…">${esc(session.note)}</textarea></div>
  <div class="button-row"><button class="button primary" data-action="finish-session">${session.status==='completed'?'Séance terminée ✓':'Terminer la séance'}</button><button class="button" data-action="session-menu">Options</button></div>`;
}
function renderSetFields(entry,row){
  const kind=KINDS[entry.kind]||KINDS.strength;const value=currentDraft(row);
  return `<div class="field-grid">${kind.fields.map(([key,label])=>`<div class="field"><label class="form-label" for="set-${key}">${esc(label)}${key==='load'?` (${entry.unit==='lbs'?'lb':'kg'})`:''}</label><input id="set-${key}" data-input="set-field" data-field="${key}" inputmode="decimal" type="number" step="any" min="0" value="${esc(numeric(value[key]))}" placeholder="—"></div>`).join('')}</div><p class="hint mt">Proposition : ${esc(formatSet(entry.kind,row.target,entry.unit))}. Seule la validation compte comme réalisée.</p>`;
}

function renderVolley(){
  const session=sessionFor(state,currentId);if(!session)return `<div class="empty">Séance introuvable.</div>`;
  const event=state.events.find(e=>e.id===session.eventId);
  if(session.status==='planned')return `<button class="text-button" data-nav="calendar">← Agenda</button><p class="eyebrow">${esc(dateLabel(session.date))}</p><h1>${esc(sessionName(session))}</h1>${badge('planned')}
    <section class="card important mt"><h2>Séance à venir</h2><p class="subtle">${event?.startTime?esc(event.startTime)+' · ':''}${event?.location?esc(event.location):'Lieu à confirmer'}</p><p>Les exercices et chaussures seront consignés quand tu commenceras la séance.</p><button class="button primary wide" data-action="start-planned">Commencer cette séance</button></section><button class="text-button mt" data-action="session-menu">Options</button>`;
  const shoes=session.shoeIds.map(id=>state.shoes.find(shoe=>shoe.id===id)?.name).filter(Boolean);
  const completed=session.drills.filter(d=>d.done).length;
  return `<button class="text-button" data-nav="today">← Aujourd’hui</button><div class="between"><div><p class="eyebrow">${esc(dateLabel(session.date))}</p><h1>${esc(sessionName(session))}</h1></div>${badge(session.status)}</div>
  ${event?`<div class="card compact mb0"><div class="small muted">${event.startTime?esc(event.startTime)+' · ':''}${event.location?esc(event.location):'Lieu à confirmer'}${event.source==='google'?' · Google Agenda':''}</div></div>`:''}
  <div class="section-head"><h2>Chaussures</h2></div><button class="shoe-button" data-action="shoe-picker"><div><strong>${shoes.length?esc(shoes.join(' + ')):'Associer une paire'}</strong><span>${shoes.length?'Modifier la sélection':'Facultatif · un toucher dans ta rotation'}</span></div><span aria-hidden="true">›</span></button>
  <div class="section-head"><h2>Travail effectué</h2><button class="text-button" data-action="pick-drill">+ Exercice</button></div>
  ${session.drills.length?`<div class="stack">${session.drills.map(drill=>`<div class="card compact between"><button class="button icon-btn ${drill.done?'primary':''}" data-action="toggle-drill" data-id="${esc(drill.id)}" aria-label="${drill.done?'Marquer non fait':'Marquer fait'}">${drill.done?'✓':'○'}</button><div class="grow"><strong>${esc(drill.name)}</strong>${drill.count!=null?`<div class="small muted">${esc(drill.count)} répétitions</div>`:''}</div><button class="button icon-btn" data-action="edit-drill" data-id="${esc(drill.id)}" aria-label="Modifier">⋯</button></div>`).join('')}</div><p class="hint mt">${completed} exercice${completed>1?'s':''} marqué${completed>1?'s':''} comme fait.</p>`:'<p class="subtle">Ajoute les exercices qui t’intéressent. Une note seule convient aussi.</p>'}
  <div class="section-head"><h2>Points travaillés</h2></div><div class="chips">${FOCUS_TAGS.map(tag=>`<button class="chip ${session.focusTags.includes(tag)?'selected':''}" data-action="toggle-tag" data-tag="${esc(tag)}" aria-pressed="${session.focusTags.includes(tag)}">${esc(tag)}</button>`).join('')}</div>
  ${['match','tournament'].includes(session.type)?renderTournament(session):''}
  <div class="section-head"><h2>Ressenti / notes</h2></div><div class="field"><label class="form-label" for="volley-note">Facultatif, en une phrase si tu veux</label><textarea id="volley-note" data-input="session-note" placeholder="Ce qui a marché, ce que tu veux reprendre…">${esc(session.note)}</textarea></div>
  <div class="button-row"><button class="button primary" data-action="finish-session">${session.status==='completed'?'Séance terminée ✓':'Terminer la séance'}</button><button class="button" data-action="session-menu">Options</button></div>`;
}
function renderTournament(session){
  const scored=session.matches.filter(m=>scoreMatch(m));const result={V:0,N:0,D:0};scored.forEach(m=>result[scoreMatch(m)]++);
  return `<div class="section-head"><h2>${session.type==='match'?'Résultat':'Matchs'}</h2><span class="small muted">${result.V}V · ${result.N}N · ${result.D}D</span></div>
    <div class="stack">${session.matches.map(m=>`<div class="card compact"><div class="between"><strong>${esc(m.opponent||'Adversaire à saisir')}</strong><span class="badge ${scoreMatch(m)?'done':'planned'}">${scoreMatch(m)||'À jouer'}</span></div><div class="small muted">${m.phase==='playoff'?'Éliminatoires':'Poule'}${scoreMatch(m)?` · ${m.us}–${m.them}`:''}</div><button class="text-button" data-action="edit-match" data-id="${esc(m.id)}">Modifier le score</button></div>`).join('')}</div>
    <button class="button mt" data-action="add-match">+ Match</button>`;
}

function templatePicker(){
  openSheet('Choisir une séance',`<p class="subtle">Tes programmes restent distincts de la séance que tu vas faire.</p><div class="sheet-scroll">${state.templates.map(t=>`<button class="pick-row" data-action="start-template" data-id="${esc(t.id)}"><span class="pick-icon">◆</span><span class="grow"><strong>${esc(t.name)}</strong><small>${t.exerciseIds.length} exercices · valeurs proposées depuis tes séances terminées</small></span><span>›</span></button>`).join('')}</div><button class="button wide mt" data-action="start-template" data-id="">Séance libre</button>`);
}
function volleyTypePicker(eventId=null){
  openSheet('Quel type de séance ?',`<div class="sheet-scroll">${['team','solo','match','tournament'].map(type=>`<button class="pick-row" data-action="start-volley" data-type="${type}" data-event-id="${esc(eventId||'')}"><span class="pick-icon">${iconFor[type]}</span><strong class="grow">${typeText[type]}</strong><span>›</span></button>`).join('')}</div>`);
}
function exercisePicker(mode='workout',replaceId=null){
  picker={mode,replaceId,query:'',equipment:'Tout'};
  openSheet(mode==='drill'?'Ajouter un exercice volley':mode==='template'?'Ajouter au programme':replaceId?'Remplacer l’exercice':'Ajouter un exercice',
    `<label class="form-label" for="exercise-search">Chercher en français ou en anglais</label><input class="search-field" id="exercise-search" data-input="exercise-search" type="search" autocomplete="off" placeholder="Nom ou matériel…"><div class="picker-filters" id="picker-filters"></div><div class="sheet-scroll" id="picker-results"></div><button class="button wide mt" data-action="custom-exercise">+ Créer un exercice</button>`);
  renderPickerResults();document.getElementById('exercise-search').focus();
}
function renderPickerResults(){
  const filters=document.getElementById('picker-filters');const results=document.getElementById('picker-results');if(!filters||!results)return;
  const equipment=['Tout','Terrain','Plyo','Poids du corps','Barre','Haltères','Machine','Câble','Trap bar','Autre'];
  filters.innerHTML=equipment.map(item=>`<button class="chip ${picker.equipment===item?'selected':''}" data-action="picker-filter" data-equipment="${esc(item)}">${esc(item)}</button>`).join('');
  const matches=rankCatalog(state,picker.query,picker.equipment).filter(ex=>picker.mode!=='drill'||['jump','jump_load','sprint','reps','hold','strength'].includes(ex.kind));
  results.innerHTML=matches.length?matches.slice(0,80).map(ex=>`<div class="pick-row"><button class="text-button grow" style="text-align:left;color:var(--ink)" data-action="select-exercise" data-id="${esc(ex.id)}"><strong>${esc(ex.name)}</strong><small>${esc(ex.equipment)} · ${esc(KINDS[ex.kind]?.label||'Exercice')}</small></button><button class="button icon-btn" data-action="toggle-favorite" data-id="${esc(ex.id)}" aria-label="${state.favorites.includes(ex.id)?'Retirer des favoris':'Ajouter aux favoris'}" style="border:0;background:none;color:var(--gold)">${state.favorites.includes(ex.id)?'★':'☆'}</button></div>`).join(''):'<div class="empty">Aucun résultat. Tu peux créer cet exercice.</div>';
}
function customExerciseSheet(){
  const suggested=picker.query;
  openSheet('Nouvel exercice',`<div class="field"><label class="form-label" for="custom-name">Nom</label><input id="custom-name" type="text" value="${esc(suggested)}" placeholder="Ex. Squat pause"></div>
    <div class="field-grid"><div class="field"><label class="form-label" for="custom-kind">Saisie</label><select id="custom-kind">${Object.entries(KINDS).map(([key,v])=>`<option value="${key}">${esc(v.label)}</option>`).join('')}</select></div><div class="field"><label class="form-label" for="custom-equipment">Matériel</label><select id="custom-equipment">${['Autre','Terrain','Plyo','Poids du corps','Barre','Haltères','Machine','Câble','Trap bar','Élastique'].map(v=>`<option>${esc(v)}</option>`).join('')}</select></div></div><p class="hint mt">Tu pourras le retrouver ensuite dans la recherche et tes favoris.</p><button class="button primary wide mt" data-action="save-custom-exercise">Ajouter à la séance</button>`);
  document.getElementById('custom-name').focus();
}
function exerciseMenu(){
  const session=sessionFor(state,currentId),point=focused(session),entry=point&&session.entries[point.ei];if(!entry)return;
  openSheet(entry.name,`<button class="pick-row" data-action="replace-exercise"><strong class="grow">Remplacer pour cette séance</strong><span>›</span></button>
    <button class="pick-row" data-action="move-exercise" data-dir="-1" ${point.ei===0?'disabled':''}><strong class="grow">Monter dans la séance</strong></button>
    <button class="pick-row" data-action="move-exercise" data-dir="1" ${point.ei===session.entries.length-1?'disabled':''}><strong class="grow">Descendre dans la séance</strong></button>
    <button class="pick-row" data-action="toggle-unit"><strong class="grow">Unité : ${entry.unit==='lbs'?'lb':'kg'}</strong><span>Changer</span></button>
    <button class="pick-row" data-action="remove-exercise"><strong class="grow" style="color:var(--rust)">Retirer de cette séance</strong></button>`);
}
function sessionMenu(){
  const session=sessionFor(state,currentId);if(!session)return;
  openSheet('Options de la séance',`${session.type==='workout'?`<button class="pick-row" data-action="save-as-template"><strong class="grow">Enregistrer ces exercices dans le programme</strong><span>›</span></button>`:''}
    <button class="pick-row" data-action="change-session-date"><strong class="grow">Changer la date</strong><span>${esc(session.date)}</span></button>
    <button class="pick-row" data-action="delete-session"><strong class="grow" style="color:var(--rust)">Supprimer la séance</strong><span>Annulable</span></button>`);
}
function shoePicker(){
  const session=sessionFor(state,currentId),active=state.shoes.filter(shoe=>!shoe.archived);
  openSheet('Chaussures portées',`<p class="subtle">Sélectionne une paire ; touche une deuxième paire si tu en as changé pendant la séance.</p>
    ${active.length?active.map(shoe=>`<button class="pick-row" data-action="toggle-shoe" data-id="${esc(shoe.id)}"><span class="pick-icon">${session.shoeIds.includes(shoe.id)?'✓':'◇'}</span><strong class="grow">${esc(shoe.name)}</strong><span>${session.shoeIds.includes(shoe.id)?'Portée':''}</span></button>`).join(''):'<div class="empty">Ajoute une paire à ta rotation.</div>'}
    <div class="button-row mt"><button class="button" data-action="clear-shoes">Aucune paire notée</button><button class="button" data-action="add-shoe">+ Ajouter une paire</button></div><button class="button primary wide mt" data-action="close-sheet">Terminé</button>`);
}
function shoeEditor(id=null){
  const shoe=state.shoes.find(item=>item.id===id);
  openSheet(shoe?'Modifier la paire':'Ajouter une paire',`<div class="field"><label class="form-label" for="shoe-name">Modèle / coloris</label><input id="shoe-name" type="text" value="${esc(shoe?.name||'')}" placeholder="Ex. Way of Wade 12"></div>
    <button class="button primary wide" data-action="save-shoe" data-id="${esc(id||'')}">Enregistrer</button>${shoe?`<button class="text-button ${shoe.archived?'':'danger'} mt" data-action="archive-shoe" data-id="${esc(id)}">${shoe.archived?'Remettre dans la rotation':'Retirer de la rotation'}</button><p class="hint">Ses anciennes séances garderont cette paire.</p>`:''}`);
  document.getElementById('shoe-name').focus();
}
function manageShoes(){openSheet('Toutes les chaussures',state.shoes.map(shoe=>`<button class="pick-row" data-action="edit-shoe" data-id="${esc(shoe.id)}"><strong class="grow">${esc(shoe.name)}</strong><small>${shoe.archived?'Archivée':'Dans la rotation'}</small></button>`).join('')+`<button class="button wide mt" data-action="add-shoe">+ Ajouter</button>`)}
function templateEditor(id=null){
  const t=state.templates.find(item=>item.id===id);if(!t){openSheet('Nouveau programme',`<div class="field"><label class="form-label" for="new-template-name">Nom du programme</label><input id="new-template-name" type="text" placeholder="Ex. Lower puissance"></div><button class="button primary wide" data-action="create-template">Créer</button>`);return}
  openSheet(t.name,`<div class="field"><label class="form-label" for="template-name">Nom</label><input id="template-name" data-id="${esc(id)}" type="text" value="${esc(t.name)}"></div><div class="sheet-scroll">${t.exerciseIds.map((eid,i)=>`<div class="pick-row"><strong class="grow">${i+1}. ${esc(exerciseFor(state,eid)?.name||'Exercice inconnu')}</strong><button class="button icon-btn" data-action="remove-template-exercise" data-id="${esc(id)}" data-index="${i}" aria-label="Retirer">×</button></div>`).join('')}</div>
    <button class="button wide mt" data-action="add-template-exercise" data-id="${esc(id)}">+ Ajouter un exercice</button><button class="button primary wide mt" data-action="save-template-name" data-id="${esc(id)}">Enregistrer le nom</button>`);
}
function eventEditor(){
  openSheet('Nouvel événement',`<div class="field"><label class="form-label" for="event-title">Titre</label><input id="event-title" type="text" placeholder="Ex. Tournoi LTVQ 3"></div><div class="field-grid"><div class="field"><label class="form-label" for="event-date">Date</label><input id="event-date" type="date" value="${localDate()}"></div><div class="field"><label class="form-label" for="event-time">Heure, si connue</label><input id="event-time" type="time"></div></div><div class="field mt"><label class="form-label" for="event-location">Lieu, si connu</label><input id="event-location" type="text"></div><button class="button primary wide" data-action="save-event">Ajouter à l’agenda</button>`);
}
function matchEditor(id=null){
  const session=sessionFor(state,currentId),m=session.matches.find(item=>item.id===id)||{phase:'pool',opponent:'',us:null,them:null};
  openSheet(id?'Modifier le match':'Ajouter un match',`<div class="field"><label class="form-label" for="match-opponent">Adversaire</label><input id="match-opponent" type="text" value="${esc(m.opponent)}"></div><div class="field"><label class="form-label" for="match-phase">Phase</label><select id="match-phase"><option value="pool" ${m.phase==='pool'?'selected':''}>Poule</option><option value="playoff" ${m.phase==='playoff'?'selected':''}>Éliminatoires</option></select></div>
    <div class="field-grid"><div class="field"><label class="form-label" for="match-us">Nos sets</label><input id="match-us" type="number" min="0" inputmode="numeric" value="${esc(numeric(m.us))}"></div><div class="field"><label class="form-label" for="match-them">Leurs sets</label><input id="match-them" type="number" min="0" inputmode="numeric" value="${esc(numeric(m.them))}"></div></div>
    <p class="hint mt">Laisse le score vide si ce match n’a pas encore été joué.</p><button class="button primary wide" data-action="save-match" data-id="${esc(id||'')}">Enregistrer</button>${id?`<button class="text-button danger" data-action="remove-match" data-id="${esc(id)}">Supprimer ce match</button>`:''}`);
}
function drillEditor(id){
  const drill=sessionFor(state,currentId).drills.find(item=>item.id===id);
  openSheet(drill.name,`<div class="field"><label class="form-label" for="drill-count">Nombre de répétitions, si tu le connais</label><input id="drill-count" type="number" min="0" inputmode="numeric" value="${esc(numeric(drill.count))}" placeholder="Facultatif"></div><div class="field"><label class="form-label" for="drill-note">Note</label><input id="drill-note" type="text" value="${esc(drill.note||'')}" placeholder="Facultatif"></div><button class="button primary wide" data-action="save-drill" data-id="${esc(id)}">Enregistrer</button><button class="text-button danger" data-action="remove-drill" data-id="${esc(id)}">Retirer l’exercice</button>`);
}

function focusedObjects(){
  const session=sessionFor(state,currentId),point=session&&focused(session);
  return {session,point,entry:point?session.entries[point.ei]:null,row:point?session.entries[point.ei].sets[point.si]:null};
}
function startWorkout(templateId){
  const session=createWorkout(state,templateId||null);
  session.status='active';state.sessions.push(session);state.activeSessionId=session.id;save();openSession(session.id);
}
function startVolley(type,eventId=null){
  const event=state.events.find(item=>item.id===eventId);
  const existing=event&&linkedSession(event.id);if(existing){openSession(existing.id);return}
  const session=createVolley(type,event?.date||localDate(),event);session.status=event?.date>localDate()?'planned':'active';
  state.sessions.push(session);if(session.status==='active')state.activeSessionId=session.id;save();openSession(session.id);
}
function chooseEventLog(eventId){
  const event=state.events.find(item=>item.id===eventId);if(!event)return;
  const title=normalize(event.title);
  const type=/tournoi|ltvq|raijin/.test(title)?'tournament':/match/.test(title)?'match':/individuel|solo/.test(title)?'solo':/volley|pratique|entrainement|everton/.test(title)?'team':null;
  if(type)startVolley(type,eventId);else volleyTypePicker(eventId);
}
function focusAndShow(ei,si=0){
  const session=sessionFor(state,currentId);if(!session.entries[ei])return;
  const chosen=si>=0?si:Math.max(0,session.entries[ei].sets.findIndex(r=>!r.actual&&!r.skipped));
  focus={ei,si:chosen};render();document.getElementById('focus-card')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function validateSet(entry,value){
  const mainKey=entry.kind==='hold'?'seconds':'reps';
  if(!Number.isFinite(Number(value[mainKey]))||Number(value[mainKey])<=0)return `Renseigne ${mainKey==='seconds'?'la durée':'les répétitions'} avant de valider.`;
  if(entry.kind==='strength'&&value.load==null&&exerciseFor(state,entry.exerciseId)?.equipment!=='Poids du corps')return 'Renseigne la charge avant de valider.';
  return '';
}
function completeSet(){
  const {session,point,entry,row}=focusedObjects();if(!row)return;
  const value=structuredClone(currentDraft(row));const error=validateSet(entry,value);if(error){toast(error);return}
  row.actual=value;row.skipped=false;delete row.draft;session.status=session.status==='planned'||session.status==='legacy'?'active':session.status;
  const next=entry.sets[point.si+1];
  if(next&&!next.actual&&!next.skipped&&Object.keys(next.target||{}).length===0)next.target=structuredClone(value);
  state.activeSessionId=session.status==='active'?session.id:state.activeSessionId;
  focus=firstPending(session);save();render();
  document.getElementById('focus-card')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function skipSet(){
  const {session,row}=focusedObjects();if(!row)return;
  row.skipped=!row.skipped;if(row.skipped){row.actual=null;delete row.draft;focus=firstPending(session)}
  save();render();
}
function addSet(){
  const {session,point,entry,row}=focusedObjects();if(!entry)return;
  const target=structuredClone(row.actual||row.target||{});
  entry.sets.push({id:uid(),target,actual:null,skipped:false,note:''});focus={ei:point.ei,si:entry.sets.length-1};save();render();
}
function removeExercise(){
  const {session,point,entry}=focusedObjects();if(!entry)return;
  if(entry.sets.some(row=>row.actual)){
    entry.sets.forEach(row=>{if(!row.actual)row.skipped=true});closeSheet();focus=firstPending(session);save();render();toast('Séries réalisées conservées ; séries restantes passées.');return;
  }
  const index=point.ei;session.entries.splice(index,1);focus=firstPending(session);closeSheet();save();render();
  toast('Exercice retiré.',()=>{session.entries.splice(index,0,entry);focus={ei:index,si:0};save();render()});
}
function replaceExercise(id){
  const session=sessionFor(state,currentId),old=picker.replaceId&&session.entries.find(item=>item.id===picker.replaceId);
  if(old?.sets.some(row=>row.actual)){
    const index=session.entries.indexOf(old);old.sets.forEach(row=>{if(!row.actual)row.skipped=true});
    const entry=entryFromCatalog(state,id,session.date);session.entries.splice(index+1,0,entry);focus={ei:index+1,si:0};
    toast('Séries déjà faites conservées sur le premier exercice.');
  }else{
    const entry=addExerciseToWorkout(state,session,id,picker.replaceId);focus={ei:session.entries.indexOf(entry),si:0};
  }
  state.recentExercises=[id,...state.recentExercises.filter(x=>x!==id)].slice(0,20);save();closeSheet();render();
}
function convertUnit(entry){
  const from=entry.unit,to=from==='lbs'?'kg':'lbs',factor=from==='lbs'?1/2.20462:2.20462;
  for(const set of entry.sets)for(const obj of [set.target,set.actual,set.draft])if(obj&&obj.load!=null)obj.load=Math.round(Number(obj.load)*factor*10)/10;
  entry.unit=to;save();closeSheet();render();
}
function updateRestLabel(){
  const session=currentId&&sessionFor(state,currentId),label=document.getElementById('rest-label');if(!label)return;
  const seconds=Math.ceil(((session?.restUntil||0)-Date.now())/1000);
  label.textContent=seconds>0?`· ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'';
  if(seconds<=0&&restInterval){clearInterval(restInterval);restInterval=null}
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action],[data-nav]');if(!button)return;
  if(button.dataset.nav){nav(button.dataset.nav);return}
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='close-sheet'){
    if(event.target.closest('.sheet') && event.target!==button)return;
    closeSheet();return;
  }
  if(action==='undo'){const fn=undoAction;undoAction=null;document.getElementById('toast').classList.remove('show');fn?.();return}
  if(action==='choose-template'){templatePicker();return}
  if(action==='start-template'){startWorkout(id);return}
  if(action==='new-volley'){startVolley(button.dataset.type);return}
  if(action==='choose-volley-type'){volleyTypePicker();return}
  if(action==='start-volley'){startVolley(button.dataset.type,button.dataset.eventId||null);return}
  if(action==='start-planned'){const s=sessionFor(state,currentId);s.status='active';state.activeSessionId=s.id;save();render();return}
  if(action==='open-session'){openSession(id);return}
  if(action==='log-event'){chooseEventLog(id);return}
  if(action==='focus-set'){focusAndShow(Number(button.dataset.ei),Number(button.dataset.si));return}
  if(action==='focus-exercise'){focusAndShow(Number(button.dataset.ei),-1);return}
  if(action==='complete-set'){completeSet();return}
  if(action==='skip-set'){skipSet();return}
  if(action==='undo-set'){
    const {session,row}=focusedObjects();row.actual=null;row.skipped=false;session.status=session.status==='completed'?'active':session.status;state.activeSessionId=session.id;save();render();return;
  }
  if(action==='add-set'){addSet();return}
  if(action==='rest-timer'){
    const session=sessionFor(state,currentId);session.restUntil=Date.now()+90000;save();updateRestLabel();clearInterval(restInterval);restInterval=setInterval(updateRestLabel,1000);return;
  }
  if(action==='exercise-menu'){exerciseMenu();return}
  if(action==='replace-exercise'){const {entry}=focusedObjects();exercisePicker('workout',entry.id);return}
  if(action==='pick-exercise'){exercisePicker('workout');return}
  if(action==='picker-filter'){picker.equipment=button.dataset.equipment;renderPickerResults();return}
  if(action==='toggle-favorite'){
    change(()=>{state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[id,...state.favorites]},false);renderPickerResults();return;
  }
  if(action==='select-exercise'){
    if(picker.mode==='template'){
      const template=state.templates.find(t=>t.id===picker.templateId);if(template)template.exerciseIds.push(id);
      save();templateEditor(picker.templateId);render();return;
    }
    if(picker.mode==='drill'){
      const session=sessionFor(state,currentId),ex=exerciseFor(state,id);
      session.drills.push({id:uid(),exerciseId:id,name:ex.name,count:null,done:false,note:''});
      state.recentExercises=[id,...state.recentExercises.filter(x=>x!==id)].slice(0,20);
      save();closeSheet();render();return;
    }
    replaceExercise(id);return;
  }
  if(action==='custom-exercise'){customExerciseSheet();return}
  if(action==='save-custom-exercise'){
    try{const ex=makeCustomExercise(state,document.getElementById('custom-name').value,document.getElementById('custom-kind').value,document.getElementById('custom-equipment').value);save();
      if(picker.mode==='drill'){const session=sessionFor(state,currentId);session.drills.push({id:uid(),exerciseId:ex.id,name:ex.name,count:null,done:false,note:''});save();closeSheet();render()}
      else if(picker.mode==='template'){const t=state.templates.find(x=>x.id===picker.templateId);t.exerciseIds.push(ex.id);save();templateEditor(t.id);render()}
      else replaceExercise(ex.id);
    }catch(error){toast(error.message)}return;
  }
  if(action==='move-exercise'){
    const {session,point}=focusedObjects(),target=point.ei+Number(button.dataset.dir);
    if(target>=0&&target<session.entries.length){[session.entries[point.ei],session.entries[target]]=[session.entries[target],session.entries[point.ei]];focus={ei:target,si:point.si};save()}
    closeSheet();render();return;
  }
  if(action==='toggle-unit'){convertUnit(focusedObjects().entry);return}
  if(action==='remove-exercise'){removeExercise();return}
  if(action==='session-menu'){sessionMenu();return}
  if(action==='save-as-template'){
    const session=sessionFor(state,currentId);let t=state.templates.find(item=>item.id===session.templateId);
    if(!t){t={id:`template-${uid()}`,name:session.title,exerciseIds:[]};state.templates.push(t);session.templateId=t.id}
    t.exerciseIds=session.entries.map(entry=>entry.exerciseId);save();closeSheet();toast('Programme mis à jour.');return;
  }
  if(action==='change-session-date'){
    const session=sessionFor(state,currentId);openSheet('Date de la séance',`<div class="field"><label class="form-label" for="session-date">Date</label><input id="session-date" type="date" value="${esc(session.date)}"></div><button class="button primary wide" data-action="save-session-date">Enregistrer</button>`);return;
  }
  if(action==='save-session-date'){
    const date=document.getElementById('session-date').value;if(!date){toast('Choisis une date.');return}
    sessionFor(state,currentId).date=date;save();closeSheet();render();return;
  }
  if(action==='delete-session'){
    const index=state.sessions.findIndex(s=>s.id===currentId),session=state.sessions[index],oldActive=state.activeSessionId;
    state.sessions.splice(index,1);if(state.activeSessionId===session.id)state.activeSessionId=null;
    save();nav('today');toast('Séance supprimée.',()=>{state.sessions.splice(index,0,session);state.activeSessionId=oldActive;save();render()});return;
  }
  if(action==='finish-session'){
    const session=sessionFor(state,currentId);if(session.status==='completed'){toast('Cette séance est déjà terminée.');return}
    session.status='completed';if(state.activeSessionId===session.id)state.activeSessionId=null;save();render();toast('Séance terminée et enregistrée.');return;
  }
  if(action==='shoe-picker'){shoePicker();return}
  if(action==='toggle-shoe'){
    const session=sessionFor(state,currentId);session.shoeIds=session.shoeIds.includes(id)?session.shoeIds.filter(x=>x!==id):[...session.shoeIds,id];save();shoePicker();render();return;
  }
  if(action==='clear-shoes'){sessionFor(state,currentId).shoeIds=[];save();shoePicker();render();return}
  if(action==='add-shoe'){shoeEditor();return}
  if(action==='edit-shoe'){shoeEditor(id);return}
  if(action==='manage-shoes'){manageShoes();return}
  if(action==='save-shoe'){
    const name=document.getElementById('shoe-name').value.trim();if(!name){toast('Donne un nom à la paire.');return}
    if(id){const shoe=state.shoes.find(x=>x.id===id);shoe.name=name}
    else state.shoes.push({id:`shoe-${uid()}`,name,archived:false});
    save();closeSheet();render();toast('Rotation mise à jour.');return;
  }
  if(action==='archive-shoe'){const shoe=state.shoes.find(x=>x.id===id);shoe.archived=!shoe.archived;save();closeSheet();render();return}
  if(action==='pick-drill'){exercisePicker('drill');return}
  if(action==='toggle-drill'){const drill=sessionFor(state,currentId).drills.find(d=>d.id===id);drill.done=!drill.done;save();render();return}
  if(action==='edit-drill'){drillEditor(id);return}
  if(action==='save-drill'){
    const drill=sessionFor(state,currentId).drills.find(d=>d.id===id),raw=document.getElementById('drill-count').value;
    drill.count=raw===''?null:Math.max(0,Number(raw));drill.note=document.getElementById('drill-note').value.trim();save();closeSheet();render();return;
  }
  if(action==='remove-drill'){const session=sessionFor(state,currentId);session.drills=session.drills.filter(d=>d.id!==id);save();closeSheet();render();return}
  if(action==='toggle-tag'){
    const session=sessionFor(state,currentId),tag=button.dataset.tag;
    session.focusTags=session.focusTags.includes(tag)?session.focusTags.filter(t=>t!==tag):[...session.focusTags,tag];save();render();return;
  }
  if(action==='add-match'){matchEditor();return}
  if(action==='edit-match'){matchEditor(id);return}
  if(action==='save-match'){
    const session=sessionFor(state,currentId),opponent=document.getElementById('match-opponent').value.trim();
    const parseScore=key=>{const value=document.getElementById(key).value;return value===''?null:Math.max(0,Number(value))};
    const us=parseScore('match-us'),them=parseScore('match-them');if((us===null)!==(them===null)){toast('Renseigne les deux scores ou laisse les deux vides.');return}
    let match=session.matches.find(m=>m.id===id);if(!match){match={id:uid()};session.matches.push(match)}
    Object.assign(match,{opponent,phase:document.getElementById('match-phase').value,us,them});save();closeSheet();render();return;
  }
  if(action==='remove-match'){const session=sessionFor(state,currentId);session.matches=session.matches.filter(m=>m.id!==id);save();closeSheet();render();return}
  if(action==='new-event'){eventEditor();return}
  if(action==='save-event'){
    const title=document.getElementById('event-title').value.trim(),date=document.getElementById('event-date').value;
    if(!title||!date){toast('Ajoute un titre et une date.');return}
    state.events.push({id:`local:${uid()}`,source:'local',title,date,startTime:document.getElementById('event-time').value,location:document.getElementById('event-location').value.trim(),status:'confirmed'});
    save();closeSheet();render();return;
  }
  if(action==='edit-template'){templateEditor(id);return}
  if(action==='new-template'){templateEditor();return}
  if(action==='create-template'){
    const name=document.getElementById('new-template-name').value.trim();if(!name){toast('Donne un nom au programme.');return}
    const t={id:`template-${uid()}`,name,exerciseIds:[]};state.templates.push(t);save();templateEditor(t.id);render();return;
  }
  if(action==='save-template-name'){
    const t=state.templates.find(x=>x.id===id),name=document.getElementById('template-name').value.trim();if(name)t.name=name;
    save();closeSheet();render();return;
  }
  if(action==='remove-template-exercise'){const t=state.templates.find(x=>x.id===id);t.exerciseIds.splice(Number(button.dataset.index),1);save();templateEditor(id);render();return}
  if(action==='add-template-exercise'){exercisePicker('template');picker.templateId=id;return}
  if(action==='export'){await exportBackup();return}
  if(action==='import'){document.getElementById('import-file').click();return}
  if(action==='preview-local-v1'){
    try{pendingImport={kind:'v1',data:convertLegacy(JSON.parse(localStorage.getItem('sessionsByDate')))};
      openSheet('Importer les anciennes données',`<p>${pendingImport.data.importedCount} séances trouvées sur cet appareil ; ${pendingImport.data.uncertainCount} entrées à vérifier.</p><p class="hint">Les séries préremplies ne deviennent pas automatiquement réalisées.</p><button class="button primary wide" data-action="confirm-import">Ajouter à la V2</button>`);
    }catch(error){toast(error.message)}return;
  }
  if(action==='confirm-import'){await applyImport();return}
  if(action==='storage-info'){await showStorageInfo();return}
  if(action==='request-persistence'){
    const granted=await navigator.storage?.persist?.();closeSheet();toast(granted?'Stockage persistant accordé.':'Le navigateur n’a pas accordé le stockage persistant.');return;
  }
  if(action==='sync-google'){await syncGoogle();return}
  if(action==='import-google-events'){importGoogleEvents();return}
});

document.addEventListener('input',event=>{
  const input=event.target.dataset.input;if(!input||!state)return;
  if(input==='journal-search'){
    journalQuery=event.target.value;const q=normalize(journalQuery);
    const items=state.sessions.filter(s=>!q||normalize([sessionName(s),s.note,(s.focusTags||[]).join(' '),s.entries?.map(e=>e.name).join(' ')].join(' ')).includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('journal-results').innerHTML=journalList(items);return;
  }
  if(input==='exercise-search'){picker.query=event.target.value;renderPickerResults();return}
  if(input==='session-note'){sessionFor(state,currentId).note=event.target.value;save();return}
  if(input==='set-field'){
    const {row}=focusedObjects();if(!row)return;
    if(!row.draft)row.draft=structuredClone(row.actual||row.target||{});
    if(event.target.value==='')delete row.draft[event.target.dataset.field];else row.draft[event.target.dataset.field]=Number(event.target.value);
    save();return;
  }
  if(input==='google-client'){state.calendar.clientId=event.target.value.trim();save();return}
  if(input==='google-keywords'){state.calendar.keywords=event.target.value.split(',').map(s=>s.trim()).filter(Boolean);save();return}
});

document.getElementById('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
    if(file.size>20*1024*1024)throw new Error('Ce fichier est trop volumineux.');
    const data=JSON.parse(await file.text());
    if(isValidV2(data))pendingImport={kind:'v2',data};
    else if(looksLikeLegacy(data))pendingImport={kind:'v1',data:convertLegacy(data)};
    else if(data?.kind==='calendar-snapshot'&&Array.isArray(data.events)&&data.events.every(e=>typeof e.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&typeof e.title==='string'))pendingImport={kind:'dates',data};
    else throw new Error('Format de sauvegarde non reconnu.');
    const p=pendingImport;
    openSheet('Vérifier l’import',`<p><strong>${p.kind==='v1'?'Ancien format V1':p.kind==='dates'?'Dates de volley':'Sauvegarde V2'}</strong></p><p>${p.kind==='v1'?`${p.data.importedCount} séances trouvées · ${p.data.uncertainCount} anciennes entrées à vérifier. Les chiffres préremplis ne seront pas traités comme réalisés.`:p.kind==='dates'?`${p.data.events.length} dates relevées dans Google Agenda le ${esc(dateLabel(p.data.capturedAt,{day:'numeric',month:'long',year:'numeric'}))}.`:`${p.data.sessions.length} séances, ${p.data.shoes.length} chaussures et ${p.data.templates.length} programmes.`}</p>
      <p class="hint">${p.kind==='v1'?'L’import ajoute les anciennes séances à la V2. Réimporter le même fichier ne doit pas les dupliquer.':p.kind==='dates'?'Ces dates s’ajoutent à l’agenda sans créer de séances réalisées. Réimporter le fichier actualise les mêmes événements.':'Cet import remplace les données V2 actuelles. Exporte-les d’abord si tu veux les conserver.'}</p><button class="button primary wide" data-action="confirm-import">${p.kind==='v1'?'Ajouter les anciennes données':p.kind==='dates'?'Ajouter les dates':'Restaurer cette sauvegarde'}</button>`);
  }catch(error){toast(`Import impossible : ${error.message}`)}
});

async function exportBackup(){
  state.meta.lastBackupAt=new Date().toISOString();save();await waitForWrites();
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`volley-hub-v2-${localDate()}.json`;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);render();toast('Export lancé. Vérifie le fichier dans Fichiers.');
}
async function applyImport(){
  if(!pendingImport)return;
  if(pendingImport.kind==='v2')state=pendingImport.data;
  else if(pendingImport.kind==='dates'){
    for(const event of pendingImport.data.events){
      const index=state.events.findIndex(e=>e.id===event.id);
      if(index>=0){state.events[index]={...state.events[index],...event};const linked=linkedSession(event.id);if(linked&&linked.status==='planned')linked.date=event.date}
      else state.events.push(event);
    }
    state.calendar.seededAt=pendingImport.data.capturedAt;
  }
  else{
    const existing=new Set(state.sessions.map(s=>s.id));
    state.sessions.push(...pendingImport.data.sessions.filter(s=>!existing.has(s.id)));
    const eventIds=new Set(state.events.map(e=>e.id));
    state.events.push(...pendingImport.data.events.filter(e=>!eventIds.has(e.id)));
    const customIds=new Set(state.customExercises.map(ex=>ex.id));
    state.customExercises.push(...pendingImport.data.customExercises.filter(ex=>!customIds.has(ex.id)));
    state.meta.legacyImportedAt=new Date().toISOString();
  }
  pendingImport=null;save();closeSheet();nav('journal');toast('Import effectué. Vérifie quelques anciennes séances.');
}
async function showStorageInfo(){
  const estimate=await navigator.storage?.estimate?.();const persistent=await navigator.storage?.persisted?.();
  const mb=estimate?.usage?`${(estimate.usage/1024/1024).toFixed(1)} Mo utilisés`:'Capacité inconnue';
  openSheet('Stockage local',`<p>${esc(mb)}. ${persistent?'Stockage persistant accordé.':'La conservation du stockage n’est pas garantie par le navigateur.'}</p><p class="hint">Même un stockage persistant ne remplace pas une sauvegarde conservée ailleurs.</p>${!persistent?'<button class="button primary wide" data-action="request-persistence">Demander le stockage persistant</button>':''}`);
}

async function syncGoogle(){
  if(!state.calendar.clientId){nav('settings');toast('Ajoute d’abord l’identifiant OAuth Google.');return}
  statusEl.textContent='Connexion Google…';
  try{
    const token=await authorizeCalendar(state.calendar.clientId);
    const all=await readUpcomingCalendar(token);
    const words=state.calendar.keywords.map(normalize).filter(Boolean);
    const existing=new Set(state.events.filter(e=>e.source==='google').map(e=>e.id));
    pendingCalendar=all.filter(e=>existing.has(e.id)||e.status!=='cancelled'&&words.some(word=>normalize(e.title).includes(word)));
    if(!pendingCalendar.length){toast('Aucun événement correspondant aux mots choisis.');statusEl.textContent='Enregistré ✓';return}
    openSheet('Événements Google trouvés',`<p class="subtle">Choisis ceux à afficher dans Volley Hub. Les changements seront relus à la prochaine actualisation.</p><div class="sheet-scroll">${pendingCalendar.map((e,i)=>`<label class="checkline" style="height:auto;padding:7px 0;border-bottom:1px solid var(--line)"><input type="checkbox" data-calendar-index="${i}" checked><span><strong>${esc(e.title)}</strong><br><small class="muted">${esc(dateLabel(e.date,{day:'numeric',month:'short',year:'numeric'}))}${e.startTime?' · '+esc(e.startTime):''}${e.status==='cancelled'?' · Annulé':''}</small></span></label>`).join('')}</div><button class="button primary wide mt" data-action="import-google-events">Afficher les événements sélectionnés</button>`);
    statusEl.textContent='Enregistré ✓';
  }catch(error){statusEl.textContent='Connexion interrompue';toast(error.message)}
}
function importGoogleEvents(){
  const selected=[...document.querySelectorAll('[data-calendar-index]:checked')].map(input=>pendingCalendar[Number(input.dataset.calendarIndex)]);
  for(const event of selected){
    const index=state.events.findIndex(e=>e.id===event.id);
    if(index>=0){state.events[index]={...state.events[index],...event};const linked=linkedSession(event.id);if(linked&&linked.status==='planned')linked.date=event.date}
    else if(event.status!=='cancelled')state.events.push(event);
  }
  state.calendar.lastSynced=new Date().toISOString();pendingCalendar=[];save();closeSheet();render();toast(`${selected.length} événement(s) actualisé(s).`);
}

async function init(){
  try{
    const saved=await loadState();
    state=saved||defaultState();
    if(!isValidV2(state))throw new Error('Données locales incompatibles. Exporte une sauvegarde avant de continuer.');
    if(!saved)save();
    render();
    const old=localStorage.getItem('sessionsByDate');
    if(old&&!state.meta.legacyImportedAt){
      const parsed=JSON.parse(old);if(looksLikeLegacy(parsed))toast('Anciennes données détectées. Importe une sauvegarde V1 dans les réglages.');
    }
    if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Service worker',error));
  }catch(error){
    main.innerHTML=`<div class="card warning"><h1>Impossible d’ouvrir les données</h1><p>${esc(error.message)}</p><p>Essaie dans un navigateur qui autorise le stockage local.</p></div>`;
    statusEl.textContent='Stockage indisponible';statusEl.classList.add('error');
  }
}
init();
