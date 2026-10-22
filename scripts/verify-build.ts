import {strict as assert} from 'node:assert';
const manifest=await Bun.file('dist/data/manifest.json').json();
assert.ok(manifest.ranges.length);assert.ok(manifest.characters.length>=400);
const html=await Bun.file('dist/index.html').text(),js=await Bun.file('dist/xp.js').text();
assert.ok(html.includes('href="./xp.css"'));assert.ok(html.includes('src="./xp.js"'));
assert.ok(!html.includes('127.0.0.1'));assert.ok(!js.includes('localStorage'));assert.ok(!js.includes('/api/xp/'));
for(const range of manifest.ranges){
 const overview=await Bun.file(`dist/data/overview-${range}.json`).json();
 const players=await Bun.file(`dist/data/characters-${range}.json`).json();
 assert.equal(overview.boards.length,19);assert.equal(overview.running,false);
 assert.equal(overview.boards.find((b:any)=>b.skill==='herblore').baseline,375000);
 assert.ok(Object.keys(players).length>=300);
 const rik=players.rik;assert.ok(rik);assert.equal(rik.timeToMax.skills.length,19);
 assert.ok(rik.timeToMax.hours>0);assert.ok(rik.timeToMax.totalEhp>0);
}
const alltime=await Bun.file('dist/data/alltime.json').json();
assert.ok(alltime.scannedDays>=31564);assert.equal(alltime.boards.length,19);
console.log(JSON.stringify({verified:true,characters:manifest.characters.length,ranges:manifest.ranges,scanDays:alltime.scannedDays}));
