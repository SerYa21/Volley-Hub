// id | displayed name | entry format | equipment | search aliases
// The ID stays stable even when a displayed name changes or gains aliases.
const RAW = `
belt-squat|Belt Squat|strength|Machine|squat ceinture
bulgarian-split-squat|Bulgarian Split Squat|strength|Haltères|fente bulgare,split squat
nordic-curl|Nordic Curl|level|Poids du corps|nordic hamstring,blocs nordic
cable-rotation|Cable Rotation|strength|Câble|rotation câble,woodchop
pallof-press|Pallof Press|strength|Câble|anti rotation
leg-extension|Leg Extension|strength|Machine|extension jambes,quadriceps
hip-abduction|Hip Abduction|strength|Machine|bad girl,bad girl (abduction),abduction
copenhagen-plank|Copenhagen Plank|hold|Poids du corps|copenhague,copenhagen plank (ankle),adducteurs
standing-calf-raise|Standing Calf Raise|strength|Machine|mollets debout,calf raises
seated-calf-raise|Seated Calf Raise|strength|Machine|mollets assis
bench-press|Bench Press|strength|Barre|développé couché,bench barre
pull-up|Pull-up|strength|Poids du corps|traction,tractions lestées,pull up
dips|Dips|strength|Poids du corps|dips lestés,barres parallèles
chest-supported-tbar-row|Chest Supported T-Bar Row|strength|Machine|tirage t bar,rowing poitrine appuyée
incline-curl|Incline Curl|strength|Haltères|curl incliné
overhead-triceps-extension|Overhead Triceps Extension|strength|Câble|overhead tricep extension,extension triceps tête
lateral-cable-raise|Lateral Cable Raise|strength|Câble|élévation latérale câble
crunch-machine|Crunch Machine|strength|Machine|abdos machine
incline-db-press|Incline DB Press|strength|Haltères|incline press,développé incliné haltères
ohp|Overhead Press|strength|Barre|ohp,développé militaire
hammer-curl|Hammer Curl|strength|Haltères|curl marteau
sprint|Sprint|sprint|Terrain|accélération,course rapide
achilles-iso|Berlin Method — Achilles Iso|hold|Poids du corps|berlin method — isométrique tendon d'achille,berlin method isométrique tendon achille
pogo-jumps|Berlin Method — Pogo Jumps|jump|Plyo|pogo,berlin method sauts
approach-jump|Approach Jump|jump|Terrain|saut approche,course d'attaque
block-jump|Block Jump|jump|Terrain|saut bloc,contre
penultimate-jump|Penultimate Jump|jump|Terrain|avant dernier pas,penultimate
depth-jump|Depth Jump|jump|Plyo|drop jump,saut en contrebas
lateral-bound|Lateral Bound|jump|Plyo|bond latéral,lateral jump
trap-bar-jump|Trap Bar Jump|jump_load|Trap bar|saut trap bar
smith-squat|Smith Squat|strength|Machine|squat smith
high-bar-squat|High-Bar Squat|strength|Barre|squat high bar,squat barre haute
trap-bar-deadlift|Trap Bar Deadlift|strength|Trap bar|soulevé de terre trap bar
front-squat|Front Squat|strength|Barre|squat avant
goblet-squat|Goblet Squat|strength|Haltères|squat gobelet
hack-squat|Hack Squat|strength|Machine|hack
leg-press|Leg Press|strength|Machine|presse jambes
split-squat|Split Squat|strength|Haltères|fente statique
walking-lunge|Walking Lunge|strength|Haltères|fentes marchées
reverse-lunge|Reverse Lunge|strength|Haltères|fente arrière
step-up|Step-up|strength|Haltères|montée sur banc
single-leg-squat|Single-Leg Squat|strength|Poids du corps|pistol squat,squat unilatéral
rdl|Romanian Deadlift|strength|Barre|rdl,soulevé de terre roumain
single-leg-rdl|Single-Leg RDL|strength|Haltères|soulevé de terre unilatéral
hip-thrust|Hip Thrust|strength|Barre|poussée de hanches
glute-bridge|Glute Bridge|strength|Poids du corps|pont fessier
lying-leg-curl|Lying Leg Curl|strength|Machine|leg curl couché
seated-leg-curl|Seated Leg Curl|strength|Machine|leg curl assis
standing-leg-curl|Standing Leg Curl|strength|Machine|leg curl debout
back-extension|Back Extension|strength|Machine|extensions lombaires
adductor-machine|Hip Adduction|strength|Machine|adducteurs machine
tibialis-raise|Tibialis Raise|strength|Poids du corps|tibial antérieur
soleus-raise|Soleus Raise|strength|Machine|soléaire
ankle-inversion|Ankle Inversion|strength|Élastique|inversion cheville
ankle-eversion|Ankle Eversion|strength|Élastique|éversion cheville
ankle-dorsiflexion|Ankle Dorsiflexion|strength|Élastique|dorsiflexion cheville
push-up|Push-up|strength|Poids du corps|pompe,pompes
incline-barbell-press|Incline Barbell Press|strength|Barre|développé incliné barre
flat-db-press|Flat DB Press|strength|Haltères|développé couché haltères
smith-bench|Smith Bench Press|strength|Machine|développé couché smith
chest-press|Chest Press Machine|strength|Machine|presse pectorale
pec-deck|Pec Deck|strength|Machine|butterfly,écarté machine
cable-fly|Cable Fly|strength|Câble|écarté poulie
db-fly|DB Fly|strength|Haltères|écarté haltères
landmine-press|Landmine Press|strength|Barre|presse landmine
db-shoulder-press|DB Shoulder Press|strength|Haltères|développé épaules haltères
arnold-press|Arnold Press|strength|Haltères|presse arnold
lateral-raise|Lateral Raise|strength|Haltères|élévation latérale
rear-delt-fly|Rear Delt Fly|strength|Haltères|oiseau,deltoïde arrière
face-pull|Face Pull|strength|Câble|tirage visage
upright-row|Upright Row|strength|Câble|tirage menton
chin-up|Chin-up|strength|Poids du corps|traction supination
neutral-pull-up|Neutral-Grip Pull-up|strength|Poids du corps|traction neutre
lat-pulldown|Lat Pulldown|strength|Câble|tirage vertical
seated-cable-row|Seated Cable Row|strength|Câble|tirage horizontal poulie
barbell-row|Barbell Row|strength|Barre|rowing barre
one-arm-db-row|One-Arm DB Row|strength|Haltères|rowing haltère unilatéral
chest-supported-db-row|Chest-Supported DB Row|strength|Haltères|rowing poitrine appuyée
machine-row|Row Machine|strength|Machine|rowing machine
straight-arm-pulldown|Straight-Arm Pulldown|strength|Câble|pull over poulie
shrug|Shrug|strength|Haltères|haussement épaules
barbell-curl|Barbell Curl|strength|Barre|curl barre
db-curl|DB Curl|strength|Haltères|curl haltères
preacher-curl|Preacher Curl|strength|Machine|curl pupitre
cable-curl|Cable Curl|strength|Câble|curl poulie
triceps-pushdown|Triceps Pushdown|strength|Câble|extension triceps poulie
skull-crusher|Skull Crusher|strength|Barre|barre front
close-grip-bench|Close-Grip Bench|strength|Barre|développé couché prise serrée
plank|Plank|hold|Poids du corps|planche,gainage
side-plank|Side Plank|hold|Poids du corps|planche latérale
dead-bug|Dead Bug|strength|Poids du corps|deadbug
hanging-leg-raise|Hanging Leg Raise|strength|Poids du corps|relevé de jambes suspendu
cable-crunch|Cable Crunch|strength|Câble|crunch poulie
ab-wheel|Ab Wheel|strength|Poids du corps|roue abdominale
bird-dog|Bird Dog|strength|Poids du corps|oiseau chien
med-ball-throw|Med Ball Throw|strength|Médecine ball|lancer ballon médecine
med-ball-slam|Med Ball Slam|strength|Médecine ball|slam
box-jump|Box Jump|jump|Plyo|saut sur boîte
broad-jump|Broad Jump|jump|Plyo|saut en longueur
countermovement-jump|Countermovement Jump|jump|Plyo|cmj,saut vertical
single-leg-hop|Single-Leg Hop|jump|Plyo|saut unipodal
skater-hop|Skater Hop|jump|Plyo|patineur
hurdle-hop|Hurdle Hop|jump|Plyo|haies
drop-landing|Drop Landing|jump|Plyo|réception depuis boîte
shuffle-sprint|Shuffle Sprint|sprint|Terrain|déplacement latéral rapide
backpedal-sprint|Backpedal Sprint|sprint|Terrain|course arrière
approach-with-ball|Approach with Small Ball|jump|Terrain|course d'attaque petite balle
serve-repetitions|Serve Repetitions|reps|Terrain|services,service volley
reception-repetitions|Reception Repetitions|reps|Terrain|réceptions,manchette
attack-repetitions|Attack Repetitions|reps|Terrain|attaques,frappes
block-repetitions|Block Repetitions|reps|Terrain|blocs,contres
setting-repetitions|Setting Repetitions|reps|Terrain|passes,touches
transition-approach|Transition Approach|reps|Terrain|transition attaque
wall-slide|Wall Slide|reps|Poids du corps|glissé mural
foam-roll|Foam Roll|hold|Rouleau|automassage,foam roller
`;

export const BUILTIN_EXERCISES = RAW.trim().split('\n').map(line => {
  const [id, name, kind, equipment, aliases] = line.split('|');
  return {id, name, kind, equipment, aliases: aliases ? aliases.split(',') : [], custom:false};
});

export const KINDS = {
  strength:{label:'Force', fields:[['reps','Rép.'],['load','Charge']]},
  jump:{label:'Sauts', fields:[['reps','Sauts'],['height','Hauteur (cm)']]},
  jump_load:{label:'Sauts lestés', fields:[['reps','Sauts'],['load','Charge']]},
  sprint:{label:'Sprint', fields:[['reps','Rép.'],['distance','Distance (m)']]},
  hold:{label:'Tenue', fields:[['seconds','Secondes'],['load','Charge']]},
  level:{label:'Niveau / blocs', fields:[['reps','Rép.'],['level','Niveau / blocs'],['negatives','Nég.']]},
  reps:{label:'Répétitions', fields:[['reps','Rép.']]}
};

export const DEFAULT_TEMPLATES = [
  {id:'lower-force',name:'Lower Force',exerciseIds:['belt-squat','bulgarian-split-squat','nordic-curl','cable-rotation','pallof-press','leg-extension','hip-abduction','copenhagen-plank','standing-calf-raise']},
  {id:'upper-force',name:'Upper Force',exerciseIds:['crunch-machine','lateral-cable-raise','bench-press','pull-up','dips','cable-rotation','chest-supported-tbar-row','incline-curl','overhead-triceps-extension','pallof-press']},
  {id:'power-sprint',name:'Power Sprint',exerciseIds:['sprint','achilles-iso','pogo-jumps','approach-jump','block-jump','penultimate-jump','depth-jump','lateral-bound']},
  {id:'upper-hypertrophy',name:'Upper Hypertrophy',exerciseIds:['incline-db-press','pull-up','ohp','dips','cable-rotation','chest-supported-tbar-row','hammer-curl','pallof-press','overhead-triceps-extension']}
];

export function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim()}
export function catalogWithCustom(custom=[]){return [...BUILTIN_EXERCISES,...custom]}
export function findExerciseByName(name,custom=[]){const key=normalize(name);return catalogWithCustom(custom).find(ex=>normalize(ex.name)===key || ex.aliases.some(alias=>normalize(alias)===key))}
