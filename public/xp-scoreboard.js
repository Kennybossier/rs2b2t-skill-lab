export function scoreHourlyRecords(boards) {
    const players = new Map();
    for (const {leaders} of boards) {
        leaders.slice(0, 5).forEach(({name, slug}, index) => {
            if (!players.has(slug)) players.set(slug, {name, slug, points: 0});
            players.get(slug).points += 5 - index;
        });
    }
    return [...players.values()].sort((a, b) =>
        b.points - a.points || a.name.localeCompare(b.name, 'en') || a.slug.localeCompare(b.slug, 'en')
    );
}
