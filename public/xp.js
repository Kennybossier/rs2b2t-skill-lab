const $ = s => document.querySelector(s);
const fmt = (n,d=0) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = s => s === 'runecraft' ? 'Runecrafting' : s[0].toUpperCase()+s.slice(1);
const skills = ['attack','defence','strength','hitpoints','ranged','prayer','magic','cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing','mining','herblore','agility','thieving','runecraft'];
const initials = ['AT','DE','ST','HP','RA','PR','MA','CO','WC','FL','FI','FM','CR','SM','MI','HE','AG','TH','RC'];
let snapshot=null,player=null,range='7',pollTimer,searchVersion=0,allTime=null;
const hours=new Map();
const link = p => `<button class="player-link" data-player="${esc(p.slug)}">${esc(p.name)}</button>`;
const windowTime = r => `${new Date(r.from).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}–${new Date(r.to).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC`;
import {snapshotApi,loadManifest} from './snapshot-api.js';
async function api(path,method='GET') {return snapshotApi(path,range,method);}
function tableRows(rows,cols) {
    return `<table><thead><tr>${cols.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
const MAX_XP = 13034431;
const fmtHours = h => h == null ? '—' : h === 0 ? 'Maxed' : h < 1 ? `${Math.ceil(h * 60)} min` : `${fmt(h,1)} h`;
function getReference(skill) {
    if(snapshot)return snapshot.boards?.find(b=>b.skill===skill)?.baseline??null;
    return player?.referenceRates?.[skill]??null;
}
function render() {
    if(!snapshot)return;
    $('#status').textContent=snapshot.error ? `${snapshot.phase}: ${snapshot.error} Use Refresh to retry.` : `${snapshot.phase} · ${snapshot.playerCount} characters · 2004Tracker level-based rates · player data as of ${new Date(snapshot.updatedAt).toLocaleString()}`;
    $('#refresh').disabled=snapshot.running||snapshot.recordsRunning;
    $('#records').disabled=Boolean(allTime?.running);
    $('#records').textContent=allTime?.running?'Scanning all-time history…':allTime?.complete?'Scan all-time again':allTime?.startedAt?'Resume all-time scan':'Scan all-time top 5 XP/h';
    $('#alltime-pause').hidden=true; $('#records').hidden=true;
    const progress=allTime?.progress;
    $('#scan-progress').hidden=!allTime?.startedAt||!progress;
    if(progress){
        $('#scan-progress-stage').textContent=`${allTime.complete?'': 'Published checkpoint · '}${progress.label}`;
        $('#scan-progress-percent').textContent=`${fmt(progress.percent,1)}%`;
        $('#alltime-progress').value=progress.percent;
        $('#alltime-progress').setAttribute('aria-valuetext',`${fmt(progress.percent,1)}% · ${progress.current} of ${progress.total}`);
        $('#scan-progress-note').textContent=`${fmt(progress.checkedDays)} / ${fmt(progress.totalDays)} queued player-days checked · ${fmt(progress.historiesIndexed)} / ${fmt(progress.historiesTotal)} histories indexed${progress.stage==='indexing'?' · day totals grow as histories are indexed':''}`;
    }
    $('#alltime-status').textContent=allTime?.startedAt?`All-time scan: ${allTime.phase} · ${allTime.discoveredSkills}/19 skills · ${allTime.overallPlayers?.length||0}/40 overall total-level players included · ${allTime.playerCount} skill/player pairs · ${allTime.scannedDays} historical player-days checked${allTime.unavailableDays?' · '+allTime.unavailableDays+' days without hourly data':''}${allTime.error?' · '+allTime.error:''}`:'Start the all-time scan to compare observed hourly records. Progress is saved and can be resumed.';
    $('#coverage').textContent=snapshot.running?'Collecting':'Sampled players';
    $('#totals').className='';
    $('#totals').innerHTML=snapshot.leaders.length?tableRows(snapshot.leaders.map((p,i)=>`<tr><td>${i+1}</td><td>${link(p)}</td><td>${p.skillsMaxed} / 19</td><td class="ehp">${fmtHours(p.hoursToMax)}</td></tr>`),['#','Character','99s','Hours left']):'<p class="loading">Waiting for character data…</p>';
    $('#rank-note').textContent=`Estimated among ${snapshot.playerCount} inspected characters. Lower hours means closer to all 99s. Efficiency rates use the linked 2004Tracker table and do not depend on scan progress.`;
    const expanded=new Set([...document.querySelectorAll('.skill-card details[open]')].map(d=>d.closest('article').dataset.skill));
    $('#skills').innerHTML=skills.map((skill,i)=>{
        const b=snapshot.boards.find(b=>b.skill===skill),history=allTime?.boards?.find(b=>b.skill===skill),rate=getReference(skill);
        const record=history?.leaders.length?tableRows(history.leaders.map((r,j)=>`<tr><td>${j+1}</td><td>${link(r)}<small>${new Date(r.from).toLocaleDateString('en-GB',{timeZone:'UTC'})} · ${new Date(r.from).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</small></td><td><strong>${fmt(r.xp)}</strong></td></tr>`),['#','Character / record date','XP/h']):`<span class="muted">${allTime?.running?'Scanning historical hours…':'Run the all-time scan above'}</span>`;
        const progress=b?tableRows(b.leaders.slice(0,10).map((p,j)=>{
            const hours=p.hoursTo99;
            return `<tr><td>${j+1}</td><td>${link(p)}</td><td>${fmt(p.xp)}</td><td class="ehp">${p.passive&&p.remainingXp?'Passive':fmtHours(hours)}</td></tr>`;
        }),['#','Character','XP','To 99']):'<p class="muted">Waiting for the public ranking…</p>';
        return `<article class="skill-card" data-skill="${skill}"><div class="skill-head"><div class="skill-title"><span class="skill-icon" aria-hidden="true">${initials[i]}</span><h3>${title(skill)}</h3></div><span class="muted small">${String(i+1).padStart(2,'0')}</span></div><div class="metric"><strong>${skill==='hitpoints'?'Passive':fmt(rate)}</strong><span class="unit">${skill==='hitpoints'?'alongside combat':'XP / h at 98–99'}</span><p>2004Tracker · level-based efficiency rates</p><details><summary>Efficiency rates by level</summary>${b?.methods?.length?tableRows(b.methods.map(m=>`<tr><td>${m.minLevel}–${m.maxLevel}</td><td>${fmt(m.rate)}</td><td>${esc(m.method)}${m.carried?' (carried forward through source gap)':''}</td></tr>`),['Levels','XP/h','Method']):'<p class="small muted">No Hitpoints rate in the source; trained passively alongside combat.</p>'}</details></div><div class="record"><span class="label">TOP 5 BEST XP/h · ALL-TIME</span>${record}<small>${history?.players||0} contenders · ${history?.scannedDays||0} historical days checked · ${allTime?.complete?'retained history scanned':'partial results'} · sampled players</small></div><details ${expanded.has(skill)?'open':''}><summary>Top 10 XP holders · ${title(skill)}</summary>${progress}</details></article>`;
    }).join('');
    filterSkills();
    $('#updated').textContent=`updated ${new Date(Math.max(snapshot.updatedAt,allTime?.updatedAt||0)).toLocaleString()}`;
    if(player)renderPlayer();
}
function renderPlayer() {
    const p=player;
    const estimate=p.timeToMax;
    const rows=estimate.skills.map(s=>({...s,remaining:s.remainingXp,reference:s.referenceRate,hoursLeft:s.hoursTo99}));
    const missing=rows.filter(s=>s.hoursLeft===null),knownHours=estimate.knownHours;
    const totalHours=estimate.hours,remaining=estimate.remainingXp;
    const maxed=estimate.skillsMaxed,completion=(1-remaining/(MAX_XP*rows.length))*100;
    const panel=$('#character');panel.hidden=false;
    panel.innerHTML=`<div class="char-title"><div><div class="eyebrow">TIME TO MAX · ALL 19 SKILLS</div><h2>${esc(p.name)}</h2></div><button id="close-character" aria-label="Close character report">✕</button></div><div class="char-stats"><div class="time-to-max"><strong>${fmtHours(totalHours)}</strong><span>Estimated training time to max</span></div><div><strong>${maxed} / 19</strong><span>Skills at level 99</span></div><div><strong>${fmt(remaining)}</strong><span>XP still needed</span></div><div><strong>${fmt(estimate.totalEhp,1)}</strong><span>Efficient hours played</span></div></div><div class="max-progress"><div><span>${fmt(completion,1)}% of XP toward all 99s</span><span>Target: 13,034,431 XP per skill</span></div><progress max="100" value="${completion}" aria-label="XP progress toward level 99 in every skill"></progress></div>${missing.length?`<p class="small error">Total pending: ${missing.map(s=>title(s.skill)).join(', ')} ${missing.length===1?'has a':'have'} missing source rate. Known skills total ${fmt(knownHours,1)} h.</p>`:''}<div class="table-scroll"><table class="character-table"><thead><tr><th>Skill</th><th>Level</th><th>XP to 99</th><th>Current rate XP/h</th><th>Hours to 99</th><th>EHP</th><th>Your avg XP/h</th><th>Pace</th><th>Best 1h · all-time</th></tr></thead><tbody>${rows.map(s=>{
        const record=hours.get(`${p.slug}:${s.skill}`);
        const hour=record==='loading'?'Loading…':record?.error?`<span title="${esc(record.error)}">Not in snapshot</span>`:record!==undefined?(record?`<span title="${esc(windowTime(record))}">${fmt(record.xp)} XP</span>`:'No full window'):`<button data-hour="${s.skill}">Check hour ↗</button>`;
        return `<tr><td>${title(s.skill)}</td><td>${s.level}</td><td>${fmt(s.remaining)}</td><td>${s.passive?'Passive':fmt(s.reference)}</td><td class="ehp">${s.passive&&s.remaining?'Alongside combat':fmtHours(s.hoursLeft)}</td><td>${fmt(s.ehp,1)}</td><td title="${fmt(s.gains)} XP / ${fmt(s.hours,1)} reported skill hours">${fmt(s.rate)}</td><td class="pace">${s.rate!==null&&s.reference?fmt(s.rate/s.reference,2)+'×':'—'}</td><td>${hour}</td></tr>`;
    }).join('')}</tbody></table></div><p class="muted small">Hours to 99 adds remaining XP ÷ rate separately across each level band in the <a href="https://github.com/R-Dson/2004Tracker/blob/main/data/skill_rates.json" target="_blank" rel="noreferrer">2004Tracker rate table</a>. EHP integrates earned XP across those same bands; post-99 XP uses the final rate. Hitpoints has no source rate: it adds no EHP or separate training hours, assuming it is trained alongside combat. Bonus XP deductions, supply and banking time are excluded. Your average XP/h uses the selected ${range}-day activity window.</p>`;
}

function filterSkills(){const query=$('#skill-filter').value.trim().toLowerCase();document.querySelectorAll('.skill-card').forEach(el=>el.hidden=!title(el.dataset.skill).toLowerCase().includes(query));}
async function poll() {
    clearTimeout(pollTimer);const requestedRange=range;
    try{const [data,records]=await Promise.all([api('overview'),api('alltime')]);if(requestedRange!==range)return;snapshot=data;allTime=records;render();}
    catch(e){$('#status').textContent=e.message;}
    pollTimer=setTimeout(poll,snapshot?.running||snapshot?.recordsRunning||allTime?.running?2500:30000);
}
async function search(name) {
    const version=++searchVersion;
    $('#notice').textContent=`Looking up ${name}…`;
    try{
        const data=await api(`character?name=${encodeURIComponent(name)}`);
        if(version!==searchVersion)return;
        player=data;$('#name').value=data.name;$('#notice').textContent='';renderPlayer();
        history.replaceState(null,'',`?name=${encodeURIComponent(data.name)}&range=${range}`);
        $('#character').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){if(version===searchVersion)$('#notice').textContent=e.message;}
}
$('#search').addEventListener('submit',e=>{e.preventDefault();search($('#name').value);});
$('#range').addEventListener('change',()=>{range=$('#range').value;searchVersion++;snapshot=null;$('#status').textContent='Loading reference window…';$('#skills').innerHTML='';$('#totals').textContent='Loading…';if(player)search(player.name);poll();});
$('#skill-filter').addEventListener('input',filterSkills);
$('#refresh').addEventListener('click',async()=>{try{$('#refresh').disabled=true;hours.clear();snapshot=await api('refresh','POST');render();if(player)search(player.name);poll();}catch(e){$('#notice').textContent=e.message;$('#refresh').disabled=false;}});
$('#records').addEventListener('click',async()=>{try{$('#records').disabled=true;allTime=await api(`alltime?action=${allTime?.complete?'restart':'start'}`,'POST');render();poll();}catch(e){$('#notice').textContent=e.message;$('#records').disabled=false;}});
$('#alltime-pause').addEventListener('click',async()=>{try{allTime=await api('alltime?action=pause','POST');render();poll();}catch(e){$('#notice').textContent=e.message;}});
document.addEventListener('click',async e=>{
    const target=e.target.closest('button');if(!target)return;
    if(target.dataset.player)search(target.dataset.player.replace(/_/g,' '));
    if(target.id==='close-character'){player=null;searchVersion++;$('#character').hidden=true;$('#notice').textContent='';history.replaceState(null,'',`?range=${range}`);}
    if(target.dataset.hour&&player){
        const skill=target.dataset.hour,slug=player.slug,key=`${slug}:${skill}`;
        hours.set(key,'loading');renderPlayer();
        try{hours.set(key,(await api(`hour?name=${encodeURIComponent(slug)}&skill=${skill}`)).record);}catch(e){hours.set(key,{error:e.message});}
        if(player?.slug===slug)renderPlayer();
    }
});
const params=new URLSearchParams(location.search);
try {
 const manifest=await loadManifest();
 const requested=params.get('range')||'7';
 range=manifest.ranges.includes(requested)?requested:manifest.ranges[0];
 $('#range').value=range;
 for(const option of $('#range').options)option.disabled=!manifest.ranges.includes(option.value);
 $('#characters').innerHTML=manifest.characters.map(p=>`<option value="${esc(p.name)}"></option>`).join('');
 $('#snapshot-note').textContent=`Public snapshot: ${new Date(manifest.builtAt).toLocaleString()} · ${manifest.characters.length} searchable characters. Player data dates appear below. Updates run every 6 hours.${manifest.warning?' '+manifest.warning:''}`;
 poll();if(params.get('name'))search(params.get('name'));
}catch(error){$('#status').textContent=error.message;}
