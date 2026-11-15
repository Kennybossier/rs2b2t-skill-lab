import {test,expect} from 'bun:test';
import {MAX_XP,xpAtLevel,trackerRate,trackerHours,trackerSkill,trackerEstimate,trackerMethods} from '../src/xpRates';
import {SKILLS} from '../src/xpAnalytics';

test('rates switch at exact level XP thresholds and remaining time integrates each band',()=>{
    expect(xpAtLevel(1)).toBe(0);expect(xpAtLevel(2)).toBe(83);expect(xpAtLevel(99)).toBe(MAX_XP);
    const split=xpAtLevel(20);
    expect(trackerRate('attack',split-1)).toBe(10000);
    expect(trackerRate('attack',split)).toBe(25000);
    expect(trackerHours('attack',split-1000,split+1000)).toBeCloseTo(1000/10000+1000/25000,10);
    expect(trackerSkill('attack',MAX_XP-5500).hoursTo99).toBeCloseTo(.1,10);
});
test('source overlaps use fastest applicable method and gaps carry preceding rate',()=>{
    expect(trackerRate('firemaking',xpAtLevel(60))).toBe(335000);
    expect(trackerRate('cooking',xpAtLevel(37))).toBe(90000);
    expect(trackerRate('cooking',xpAtLevel(40))).toBe(150000);
    expect(trackerMethods('cooking').find(b=>b.minLevel===35)?.carried).toBe(true);
    expect(trackerRate('runecraft',0)).toBe(120000);
    expect(trackerRate('herblore',xpAtLevel(78))).toBe(375000);
});
test('EHP and remaining training time partition maxing hours; post-99 XP adds only EHP',()=>{
    const xp=xpAtLevel(53),s=trackerSkill('herblore',xp,1000);
    expect(s.ehp!+s.hoursTo99!).toBeCloseTo(trackerHours('herblore',0,MAX_XP)!,8);
    expect(s.gainedEhp).toBeCloseTo(1000/200000,10);
    expect(trackerSkill('herblore',MAX_XP+375000).ehp!-trackerSkill('herblore',MAX_XP).ehp!).toBeCloseTo(1,10);
    expect(trackerSkill('herblore',MAX_XP+375000).hoursTo99).toBe(0);
});
test('Hitpoints is explicitly passive and all other server skills have source rates',()=>{
    for(const skill of SKILLS.filter(s=>s!=='hitpoints'))expect(trackerRate(skill,0)).toBeGreaterThan(0);
    expect(trackerSkill('hitpoints',1154)).toMatchObject({passive:true,referenceRate:null,ehp:null,hoursTo99:0});
    const estimate=trackerEstimate(SKILLS.map(skill=>({skill,xp:MAX_XP,gains:0})));
    expect(estimate.hours).toBe(0);expect(estimate.skillsMaxed).toBe(19);expect(estimate.remainingXp).toBe(0);
    expect(estimate.totalEhp).toBeGreaterThan(0);
    expect(trackerHours('unknown',0,100)).toBeNull();
});
