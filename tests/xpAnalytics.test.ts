import {test,expect} from 'bun:test';
import {bestHour,ehp,parseBoard,parsePlayer,referenceRate,sampleReference,SKILLS,skillName,handleXpRoute,historicalDays,joinHistoryEdges,topFiveHours,selectOverallTop40,addOverallContenders,topFiveMedian,estimateTimeToMax,MAX_SKILL_XP,scanProgress} from '../src/xpAnalytics';
const stat=(gains:number,hours:number|null,rate:number|null=100)=>({skill:'mining',xp:5000,level:20,gains,hours,rate});
test('reference rate is hours-weighted and excludes missing and tiny denominators',()=>{
    const ref=referenceRate([stat(100,1),stat(1800,9),stat(10000,.1),stat(900,null),stat(10,2,null),stat(0,4)]);
    expect(ref).toEqual({baseline:190,sample:2,hours:10});
    expect(ehp(1900,ref.baseline)).toBe(10);expect(ehp(1900,null)).toBeNull();
    expect(referenceRate([stat(1,null)]).baseline).toBeNull();
});
test('skill training time takes precedence; missing combat time has an explicit online proxy',()=>{
    expect(sampleReference([stat(1000,2,500)],[stat(1000,100,10)]).baseline).toBe(500);
    expect(sampleReference([stat(1000,2,500)],[stat(1000,100,10)]).referenceKind).toBe('skill');
    expect(sampleReference([stat(1000,null,null)],[stat(1000,100,10)])).toEqual({baseline:10,hours:100,sample:1,referenceKind:'online'});
    expect(sampleReference([],[]).baseline).toBeNull();
});
test('parses per-skill and overall leaderboard columns without mixing hours and rates',()=>{
    const row='<td>1</td><td><a href="/progress/a_b">A &amp; B</a></td>';
    const data='<td>99</td><td>13,000,000</td><td>+1,900</td><td>190</td><td>10.0</td>';
    const a=parseBoard(`<table width=100%><tr><td><table class=pg-table><tr>${row}${data}</tr></table></td></tr></table>`,'mining')[0];
    const b=parseBoard(`<table class="pg-table"><tr>${row}<td>Mining</td>${data}</tr></table>`,'overall')[0];
    expect(a.name).toBe('A & B');expect(a.hours).toBe(10);expect(a.rate).toBe(190);expect(b.xp).toBe(a.xp);
    expect(()=>parseBoard('<html>Maintenance</html>','mining')).toThrow();
    const missing=parseBoard(`<table class=pg-table><tr>${row}<td>99</td><td>5000</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></table>`,'mining')[0];
    expect(missing.gains).toBeNull();expect(missing.xp).toBe(5000);
    expect(ehp(null,190)).toBeNull();
});
test('character parser preserves missing rates and requires all 19 skills',()=>{
    const rows=SKILLS.map(s=>`<tr><td>${skillName(s)}</td><td>1</td><td>10</td><td>0</td><td>0</td><td>&mdash;</td><td>&mdash;</td></tr>`).join('');
    const p=parsePlayer(`<h1>Test</h1><table class=pg-skills>${rows}</table>`,'test');
    expect(p.skills).toHaveLength(19);expect(p.skills[0].rate).toBeNull();expect(p.skills[18].skill).toBe('runecraft');
    expect(()=>parsePlayer('<h1>Not found</h1>','test')).toThrow();
});
function chart(times:number[],xp:number[],bucket='hour') {
    return `<figure data-tmin="1000000000000" data-tspan="7200000" data-bucket="${bucket}" data-ml="56" data-w="820"><polyline data-v="${xp.join(',')}" points="${times.map(t=>`${(56+t/120*752).toFixed(1)},50`).join(' ')}"></figure>`;
}
test('one-hour record uses complete windows, not extrapolated burst rates',()=>{
    const result=bestHour(chart([0,15,30,45,60,75,90],[0,900,1000,1100,1200,1300,1400]));
    expect(result?.xp).toBe(1200);expect(result?.samples).toBe(5);
    expect(bestHour(chart([0,15],[0,10000]))).toBeNull();
    expect(bestHour(chart([0,60],[0,10000]))).toBeNull();
});
test('one-hour record excludes resets, daily data and gaps, and preserves real zero XP',()=>{
    expect(bestHour(chart([0,30,60],[0,500,20]))).toBeNull();
    expect(bestHour(chart([0,30,60],[0,10,20],'day'))).toBeNull();
    expect(bestHour(chart([0,30,60],[100,100,100]))?.xp).toBe(0);
});
test('public adapter rejects invalid parameters and methods before fetching',async()=>{
    for(const path of ['overview?range=all','character?name=bad%2Fname','hour?name=Clint&skill=unknown']){
        expect((await handleXpRoute(new Request('http://localhost/api/xp/'+path))).status).toBe(400);
    }
    expect((await handleXpRoute(new Request('http://localhost/api/xp/refresh'))).status).toBe(405);
    expect((await handleXpRoute(new Request('http://localhost/api/xp/unknown'))).status).toBe(404);
});
test('historical scan includes old active dates and neighbours without going before tracking began',()=>{
    const t=Date.parse('2026-08-01T00:00:00Z'),day=86400000;
    const dates=historicalDays([{t,xp:0},{t:t+day,xp:0},{t:t+day*2,xp:100},{t:t+day*3,xp:100}]);
    expect(dates).toContain('2026-08-02');expect(dates).toContain('2026-08-03');expect(dates).toContain('2026-08-04');
    expect(dates).not.toContain('2026-07-31');
});
test('all-time hourly record joins adjacent dates across midnight, in either scan order',()=>{
    const p=(time:string,xp:number)=>({t:Date.parse(time+'Z'),xp});
    const a={points:[p('2026-08-01T23:30:00',1000),p('2026-08-01T23:45:00',1100)],tolerance:1000};
    const b={points:[p('2026-08-02T00:00:00',1300),p('2026-08-02T00:15:00',1700),p('2026-08-02T00:30:00',2000)],tolerance:1000};
    const first={};expect(joinHistoryEdges(first,'2026-08-01',a)).toBeNull();
    expect(joinHistoryEdges(first,'2026-08-02',b)?.xp).toBe(1000);
    const reverse={};joinHistoryEdges(reverse,'2026-08-02',b);
    expect(joinHistoryEdges(reverse,'2026-08-01',a)?.xp).toBe(1000);
});
test('all-time list returns five players by their best positive hour and keeps old dates',()=>{
    const players=Array.from({length:7},(_,i)=>({name:`P${i}`,slug:`p${i}`,skill:'mining',best:{xp:i*100,from:Date.parse('2026-08-01'),to:Date.parse('2026-08-01')+3600000,samples:5}}));
    const top=topFiveHours(players,'mining');expect(top).toHaveLength(5);expect(top[0].name).toBe('P6');expect(top[4].xp).toBe(200);
    expect(top[0].from).toBe(Date.parse('2026-08-01'));expect(topFiveHours(players,'fishing')).toEqual([]);
});
test('overall roster includes precisely ranks 1–40 across both leaderboard pages',()=>{
    const rows=Array.from({length:42},(_,i)=>({name:`P${i}`,slug:`p${i}`,level:1900-i}));
    const roster=selectOverallTop40([rows.slice(0,21),rows.slice(21)]);
    expect(roster).toHaveLength(40);expect(roster[20].slug).toBe('p20');expect(roster[39].slug).toBe('p39');
    expect(roster.some(p=>p.slug==='p40')).toBe(false);
    expect(()=>selectOverallTop40([rows.slice(0,20),rows.slice(0,20)])).toThrow();
});
test('overall players enter all 19 skill scans once, preserving records and progress on overlap',()=>{
    const roster=Array.from({length:40},(_,i)=>({name:`P${i}`,slug:`p${i}`,level:1900-i}));
    const prior={name:'P0',slug:'p0',skill:'mining',days:['2026-08-01'],next:1,best:{xp:123,from:0,to:3600000,samples:5},edges:{}};
    const players=[prior];
    expect(addOverallContenders(players,roster)).toBe(759);
    expect(players).toHaveLength(40*19);
    for(const skill of SKILLS)expect(players.filter(p=>p.skill===skill)).toHaveLength(40);
    expect(players.find(p=>p.skill==='mining'&&p.slug==='p0')).toBe(prior);
    expect(prior.next).toBe(1);expect(prior.best.xp).toBe(123);
    expect(addOverallContenders(players,roster)).toBe(0);expect(players).toHaveLength(760);
});
test('efficiency rate is the median of exactly the top five positive finite hourly rates',()=>{
    expect(topFiveMedian([100,10000,200,400,300,50])).toBe(300);
    expect(topFiveMedian([100,200,300,400])).toBeNull();
    expect(topFiveMedian([100,200,300,400,0,-1,NaN,Infinity])).toBeNull();
});
test('time to max uses remaining XP and the reference rate; post-99 XP and personal rate do not affect it',()=>{
    const skills=[{...stat(0,null,999999),skill:'mining',xp:MAX_SKILL_XP-1000},{...stat(0,null),skill:'cooking',xp:MAX_SKILL_XP+1000000}];
    const result=estimateTimeToMax(skills,{mining:100,cooking:200});
    expect(result.hours).toBe(10);expect(result.remainingXp).toBe(1000);expect(result.skillsMaxed).toBe(1);
    expect(result.skills[1].hoursTo99).toBe(0);expect(result.skills[1].remainingXp).toBe(0);
    expect(estimateTimeToMax([{...skills[0],xp:MAX_SKILL_XP-1}],{mining:10}).hours).toBe(.1);
});
test('missing rates make the total unavailable only for unfinished skills',()=>{
    const result=estimateTimeToMax([{...stat(0,null),skill:'mining',xp:MAX_SKILL_XP-1000},{...stat(0,null),skill:'prayer',xp:0},{...stat(0,null),skill:'cooking',xp:MAX_SKILL_XP}],{mining:100,prayer:null,cooking:null});
    expect(result.hours).toBeNull();expect(result.knownHours).toBe(10);expect(result.missingSkills).toEqual(['prayer']);
    const maxed=estimateTimeToMax(SKILLS.map(skill=>({...stat(0,null),skill,xp:MAX_SKILL_XP})),{});
    expect(maxed.hours).toBe(0);expect(maxed.skillsMaxed).toBe(19);expect(maxed.remainingXp).toBe(0);
});
test('scan progress reports contender discovery, indexing and actual queued-day completion separately',()=>{
    const candidate=(days:string[]|null,next=0)=>({skill:'mining',name:'P',slug:'p',days,next,best:null,edges:{}});
    expect(scanProgress({players:[],discoveredSkills:0,complete:false}).percent).toBe(0);
    const discovery=scanProgress({players:[],discoveredSkills:5,complete:false});
    expect(discovery.stage).toBe('discovery');expect(discovery.total).toBe(19);
    const indexing=scanProgress({players:[candidate(['a','b'],1),candidate(null)],discoveredSkills:19,complete:false});
    expect(indexing.stage).toBe('indexing');expect(indexing.percent).toBe(50);expect(indexing.checkedDays).toBe(1);
    const scanning=scanProgress({players:[candidate(['a','b'],1),candidate(['a','b'],1)],discoveredSkills:19,complete:false});
    expect(scanning.stage).toBe('days');expect(scanning.percent).toBe(50);expect(scanning.totalDays).toBe(4);
    const finished={players:[candidate(['a'],1)],discoveredSkills:19,complete:false};
    expect(scanProgress(finished).percent).toBe(99.9);
    expect(scanProgress({...finished,complete:true}).percent).toBe(100);
});
