let manifest,loading;
const loaded=new Map();
export async function loadManifest(force=false){
 if(force){manifest=null;loaded.clear();}
 if(manifest)return manifest;
 if(loading)return loading;
 loading=fetch('./data/manifest.json',{cache:'no-store'}).then(async r=>{
  if(!r.ok)throw new Error('The public snapshot is unavailable. Please reload shortly.');
  return manifest=await r.json();
 }).finally(()=>loading=null);
 return loading;
}
async function json(file){
 const m=await loadManifest();
 if(!loaded.has(file))loaded.set(file,fetch(`./data/${file}?v=${m.builtAt}`).then(async r=>{
  if(!r.ok)throw new Error('This data file is unavailable in the published snapshot.');return r.json();
 }).catch(e=>{loaded.delete(file);throw e;}));
 return loaded.get(file);
}
export async function snapshotApi(path,range,method='GET'){
 const url=new URL(path,'https://snapshot.invalid/'),operation=url.pathname.slice(1);
 if(operation==='refresh'){await loadManifest(true);return json(`overview-${range}.json`);}
 if(method!=='GET')throw new Error('Data collection runs on GitHub Actions; visitors can view the published snapshot.');
 if(operation==='overview')return json(`overview-${range}.json`);
 if(operation==='alltime')return json('alltime.json');
 if(operation==='character'){
  const slug=(url.searchParams.get('name')??'').trim().toLowerCase().replace(/ /g,'_');
  if(!/^[a-z0-9_]{1,12}$/.test(slug))throw new Error('Use a character name of 1–12 letters, numbers or spaces.');
  const players=await json(`characters-${range}.json`);
  if(!Object.hasOwn(players,slug))throw new Error('Character not present in this activity-window snapshot. Try another window or wait for the next data update.');
  return players[slug];
 }
 if(operation==='hour'){
  const records=await json('hours.json'),key=`${url.searchParams.get('name')}:${url.searchParams.get('skill')}`;
  if(!Object.hasOwn(records,key))throw new Error('This character/skill is not included in the scanned snapshot.');
  return {record:records[key]};
 }
 throw new Error('Unknown snapshot request.');
}
