const DB_NAME='volley-hub-v2';
const STORE='documents';
const MIRROR='volley-hub-v2-latest';
let dbPromise;
let writeQueue=Promise.resolve();
let revision=0;

function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Ouverture impossible'));
  });
  return dbPromise;
}

export async function loadState(){
  const mirror=(()=>{try{return JSON.parse(localStorage.getItem(MIRROR)||'null')}catch{return null}})();
  const db=await openDB();
  const stored=await new Promise((resolve,reject)=>{
    const request=db.transaction(STORE,'readonly').objectStore(STORE).get('main');
    request.onsuccess=()=>resolve(request.result||null);
    request.onerror=()=>reject(request.error||new Error('Lecture impossible'));
  });
  const latest=(mirror?._revision||0)>(stored?._revision||0)?mirror:stored||mirror;
  revision=latest?._revision||0;
  if(mirror&&latest===mirror&&(!stored||(mirror._revision||0)>(stored._revision||0)))writeQueue=writeQueue.catch(()=>{}).then(()=>write(mirror));
  return latest;
}

function write(snapshot){
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(snapshot,'main');
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Sauvegarde impossible'));
    tx.onabort=()=>reject(tx.error||new Error('Sauvegarde interrompue'));
  }));
}

export function saveState(state){
  const snapshot=structuredClone(state);
  snapshot._revision=++revision;
  // A synchronous last-known copy protects a just-validated set if the page
  // closes before its IndexedDB transaction finishes. IndexedDB remains the
  // main store; the newer revision wins on reopen.
  try{localStorage.setItem(MIRROR,JSON.stringify(snapshot))}catch(error){
    // Continue writing to IndexedDB, and let the UI report any write failure.
    console.warn('Copie immédiate indisponible',error);
  }
  writeQueue=writeQueue.catch(()=>{}).then(()=>write(snapshot));
  return writeQueue;
}

export function waitForWrites(){return writeQueue}
