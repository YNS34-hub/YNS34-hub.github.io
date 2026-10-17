import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {rooms} from '../src/content/catalog';
import {resolvePalaceRoute} from '../src/systems/store';
import {roomBounds,roomFootprints,keepClear} from '../src/world/collision';
import {isAdventureRoom} from '../src/worlds/presence/state';
describe('independent private-gym navigation',()=>{
 it('is a normal indoor installation with its own bookmarkable route',()=>{expect(rooms.find(room=>room.id==='private-gym')?.type).toBe('installation');expect(resolvePalaceRoute('/private-gym').roomId).toBe('private-gym');expect(isAdventureRoom('private-gym')).toBe(false);});
 it('keeps the entry and return path clear while protecting fixed training equipment',()=>{const bounds=roomBounds('private-gym');expect(bounds).toEqual([-12.1,12.1,-14.6,14.9]);const footprints=roomFootprints('private-gym');expect(footprints).toHaveLength(4);expect(footprints.every(p=>'radius'in p?p.radius>0:p.halfWidth>0&&p.halfDepth>0)).toBe(true);const entry=new Vector3(2,1.65,10.8);keepClear(entry,'private-gym',footprints);expect(entry.toArray()).toEqual([2,1.65,10.8]);});
});
