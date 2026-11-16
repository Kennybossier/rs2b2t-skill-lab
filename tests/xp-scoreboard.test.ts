import {expect,test} from 'bun:test';
import {scoreHourlyRecords} from '../public/xp-scoreboard.js';

test('scores all skill boards by placement, aggregates by player, and breaks total ties by name',()=>{
    const player=(name:string)=>({name,slug:name.toLowerCase()});
    const board=(...names:string[])=>({leaders:names.map(player)});
    expect(scoreHourlyRecords([board('A','B','C','D','E','Excluded'),board('E','D','B'),board('F'),board()]).map(p=>[p.name,p.points])).toEqual([
        ['B',7],['D',6],['E',6],['A',5],['F',5],['C',3]
    ]);
    expect(scoreHourlyRecords([])).toEqual([]);
});
