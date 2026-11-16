import {mkdir} from 'node:fs/promises';
import {parseBoard, type Player} from '../src/xpAnalytics';

const path = 'state/xp-analytics-cache.json';
const file = Bun.file(path);
const snapshot = await (await file.exists() ? file : Bun.file('seed/xp-analytics-cache.json')).json() as {
    snapshots: {players: Player[]}[];
};
const missing = new Set(snapshot.snapshots.flatMap(s => s.players)
    .filter(p => p.hoursOnline === undefined).map(p => p.slug));
if (!missing.size) process.exit(0);

const playtime = new Map<string, number>();
const seen = new Set<string>();
for (let page = 1; page <= 100 && playtime.size < missing.size; page++) {
    try {
        await Bun.sleep(150);
        const response = await fetch(`https://rs2b2t.com/progress?range=all&skill=overall&sort=level&dir=desc&page=${page}`, {
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = parseBoard(await response.text(), 'overall').filter(row => !seen.has(row.slug));
        if (!rows.length) break;
        for (const row of rows) {
            seen.add(row.slug);
            if (missing.has(row.slug) && row.hours !== null && row.hours > 0) playtime.set(row.slug, row.hours);
        }
    } catch (error) {
        console.warn('Playtime backfill stopped:', error);
        break;
    }
}
if (playtime.size) {
    for (const {players} of snapshot.snapshots) {
        for (const player of players) {
            if (player.hoursOnline === undefined && playtime.has(player.slug)) player.hoursOnline = playtime.get(player.slug);
        }
    }
    await mkdir('state', {recursive: true});
    await Bun.write(path, JSON.stringify(snapshot));
}
console.log(`Filled lifetime playtime for ${playtime.size} of ${missing.size} characters.`);
