'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function animation(){const context=vm.createContext({window:{ByndHome3D:{}}});vm.runInContext(fs.readFileSync('apps/home3d/animation.js','utf8'),context);return context.window.ByndHome3D.Animation;}
test('circular clearance accepts clear corners while swept paths still reject edge and corner collisions',()=>{
 const A=animation(),blocks=[{x:0,z:0,width:1,depth:1}],size=[6,6],r=.52;
 assert.equal(A.clear({x:.89,z:.89},blocks,size,r),true,'round avatar clears the corner that an expanded square incorrectly blocked');
 assert.equal(A.clear({x:.8,z:.8},blocks,size,r),false);
 assert.equal(A.segmentClear({x:-2,z:1.1},{x:2,z:1.1},blocks,size,r),true);
 assert.equal(A.segmentClear({x:-2,z:.9},{x:2,z:.9},blocks,size,r),false);
 assert.equal(A.segmentClear({x:.2,z:1.2},{x:1.2,z:.2},blocks,size,r),false,'endpoints are free but swept hull hits corner');
 assert.equal(A.segmentClear({x:.6,z:1.4},{x:1.4,z:.6},blocks,size,r),true);
});
test('blocked tap targets choose a nearby reachable point with bounded movement and never cross a wall',()=>{
 const A=animation(),size=[6,6],blocks=[{x:0,z:0,width:1,depth:1}],start={x:2,z:1.5},requested={x:.95,z:0};
 const target=A.destination(start,requested,blocks,size,.52);assert.ok(target);assert.ok(Math.hypot(target.x-requested.x,target.z-requested.z)<=.651);assert.equal(A.clear(target,blocks,size,.52),true);
 const route=A.path(start,target,blocks,size,.52);let previous=start;for(const p of route){assert.ok(A.segmentClear(previous,p,blocks,size,.52));previous=p;}
 assert.equal(A.destination(start,{x:0,z:0},blocks,size,.52),null,'a tap deep inside solid furniture cannot snap arbitrarily far');
 const wall=[{x:0,z:0,width:.1,depth:6}];assert.equal(A.destination({x:-2,z:0},{x:2,z:0},wall,size,.52),null,'a free but disconnected target cannot cross a partition');
 assert.equal(A.destination(start,{x:NaN,z:0},blocks,size,.52),null);
});
test('a near-edge tap stays within its intended villa room instead of snapping through a partition',()=>{
 const A=animation(),size=[8,6];size.regions=[{x:-2,z:0,width:4,depth:6},{x:2,z:0,width:4,depth:6}];
 const blocks=[{x:0,z:0,width:.09,depth:6}],requested={x:-.13,z:0},target=A.destination({x:-2,z:0},requested,blocks,size,.52);
 assert.ok(target&&target.x<-.56);assert.ok(Math.hypot(target.x-requested.x,target.z-requested.z)<=.651);
});
