import source from '../data/2004tracker-skill-rates.json';

export const RATE_SOURCE='https://github.com/R-Dson/2004Tracker/blob/main/data/skill_rates.json';
export const MAX_XP=13_034_431;
type Interval={min_level:number;max_level:number;rate:number;method:string};
const definitions=source.skills as Record<string,Interval[]>;
const key=(skill:string)=>skill==='runecraft'?'Runecrafting':skill[0].toUpperCase()+skill.slice(1);
export function xpAtLevel(level:number){
    let points=0;
    for(let n=1;n<Math.min(99,level);n++)points+=Math.floor(n+300*2**(n/7));
    return Math.floor(points/4);
}
// Use the fastest applicable method; carry the preceding rate through source gaps
// (Cooking 35–40). Level boundaries are exact XP thresholds, without overlaps.
export function trackerBands(skill:string){
    const intervals=definitions[key(skill)]??[];
    return Array.from({length:98},(_,i)=>{
        const level=i+1,active=intervals.filter(r=>r.min_level<=level&&level<r.max_level);
        const preceding=intervals.filter(r=>r.min_level<=level).sort((a,b)=>b.min_level-a.min_level||b.rate-a.rate)[0];
        const chosen=active.sort((a,b)=>b.rate-a.rate)[0]??preceding;
        return chosen?{from:xpAtLevel(level),to:xpAtLevel(level+1),level,rate:chosen.rate,method:chosen.method,carried:!active.length}:null;
    }).filter((b):b is NonNullable<typeof b>=>b!==null);
}
const cached=new Map<string,ReturnType<typeof trackerBands>>();
function bands(skill:string){if(!cached.has(skill))cached.set(skill,trackerBands(skill));return cached.get(skill)!;}
export function trackerRate(skill:string,xp:number){
    const rows=bands(skill);
    return (rows.find(b=>xp<b.to)??rows.at(-1))?.rate??null;
}
export function trackerHours(skill:string,from:number,to:number):number|null{
    if(to<=from)return 0;
    const rows=bands(skill);if(!rows.length)return null;
    let hours=0;
    for(const b of rows)hours+=Math.max(0,Math.min(to,b.to)-Math.max(0,from,b.from))/b.rate;
    if(to>MAX_XP)hours+=(to-Math.max(from,MAX_XP))/rows.at(-1)!.rate;
    return hours;
}
export function trackerSkill(skill:string,xp:number,gains:number|null=null){
    const remainingXp=Math.max(0,MAX_XP-xp),passive=skill==='hitpoints';
    return {remainingXp,referenceRate:trackerRate(skill,xp),hoursTo99:passive?0:trackerHours(skill,xp,MAX_XP),passive,
        ehp:passive?null:trackerHours(skill,0,xp),gainedEhp:passive||gains===null?null:trackerHours(skill,Math.max(0,xp-gains),xp)};
}
export function trackerEstimate<T extends {skill:string;xp:number;gains:number|null}>(skills:T[]){
    const rows=skills.map(s=>({...s,...trackerSkill(s.skill,s.xp,s.gains)}));
    const missingSkills=rows.filter(s=>s.hoursTo99===null).map(s=>s.skill);
    const knownHours=rows.reduce((sum,s)=>sum+(s.hoursTo99??0),0);
    return {targetXp:MAX_XP,hours:missingSkills.length?null:knownHours,knownHours,missingSkills,
        skillsMaxed:rows.filter(s=>!s.remainingXp).length,remainingXp:rows.reduce((sum,s)=>sum+s.remainingXp,0),
        totalEhp:rows.reduce((sum,s)=>sum+(s.ehp??0),0),gainedEhp:rows.every(s=>s.passive||s.gainedEhp!==null)?rows.reduce((sum,s)=>sum+(s.gainedEhp??0),0):null,skills:rows};
}
export function trackerMethods(skill:string){
    const rows=bands(skill),groups:{minLevel:number;maxLevel:number;rate:number;method:string;carried:boolean}[]=[];
    for(const b of rows){
        const last=groups.at(-1);
        if(last&&last.rate===b.rate&&last.method===b.method&&last.carried===b.carried)last.maxLevel=b.level+1;
        else groups.push({minLevel:b.level,maxLevel:b.level+1,rate:b.rate,method:b.method,carried:b.carried});
    }
    return groups;
}
