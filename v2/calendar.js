// Browser-only, read-only Google Calendar connection. The access token stays in
// memory and must be renewed after expiry; no client secret or refresh token is
// stored in this PWA. A future server component can provide background sync.
let gisPromise;
let accessToken='';

function loadGIS(){
  if(gisPromise)return gisPromise;
  gisPromise=new Promise((resolve,reject)=>{
    if(window.google?.accounts?.oauth2){resolve();return}
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('Connexion Google indisponible. Vérifie le réseau.'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

export async function authorizeCalendar(clientId){
  if(!clientId?.trim())throw new Error('Renseigne ton identifiant OAuth Google dans Réglages.');
  await loadGIS();
  return new Promise((resolve,reject)=>{
    const client=window.google.accounts.oauth2.initTokenClient({
      client_id:clientId.trim(),scope:'https://www.googleapis.com/auth/calendar.events.readonly',
      callback:response=>{
        if(response.error){reject(new Error(response.error_description||response.error));return}
        accessToken=response.access_token;resolve(accessToken);
      },error_callback:error=>reject(new Error(error.message||'Autorisation Google interrompue.'))
    });
    client.requestAccessToken({prompt:accessToken?'':'consent'});
  });
}

export async function readUpcomingCalendar(token,months=12){
  const start=new Date();start.setDate(start.getDate()-14);
  const end=new Date();end.setMonth(end.getMonth()+months);
  const events=[];let pageToken='';
  do{
    const params=new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',showDeleted:'true',maxResults:'250'});
    if(pageToken)params.set('pageToken',pageToken);
    const response=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error(response.status===401?'Autorisation expirée. Reconnecte Google Agenda.':`Google Agenda : erreur ${response.status}.`);
    const data=await response.json();events.push(...(data.items||[]));pageToken=data.nextPageToken||'';
  }while(pageToken);
  return events.map(item=>{
    const startValue=item.start?.dateTime||item.start?.date||item.originalStartTime?.dateTime||item.originalStartTime?.date||'';
    const date=item.start?.dateTime?new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Toronto'}).format(new Date(item.start.dateTime)):startValue.slice(0,10);
    const startTime=item.start?.dateTime?new Date(item.start.dateTime).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit',timeZone:'America/Toronto'}):'';
    return {id:`google:${item.id}`,googleId:item.id,source:'google',title:item.summary||'Sans titre',date,startTime,
      location:item.location||'',description:item.description||'',status:item.status==='cancelled'?'cancelled':'confirmed',lastSynced:new Date().toISOString()};
  }).filter(item=>item.date);
}
