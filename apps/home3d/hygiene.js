(function (H) {
    'use strict';
    const washing = ['Wash Hands', 'Wash Face'], bathing = ['Bathe', 'Shower'];
    function station(item, action) {
        const [w,d]=item.footprint;
        if(item.type==='tub'&&bathing.includes(action))return { offset:[0,action==='Bathe'?.43:.09,0],faceBack:action==='Shower' };
        if(item.type==='shower'&&action==='Shower')return { offset:[0,.145,-d/2+.40],faceBack:true };
        if(item.type==='toilet'&&action==='Use Toilet')return { offset:[0,.61,.09],faceBack:false };
        if(['sink','vanity'].includes(item.type)&&washing.includes(action))return { offset:[0,0,d/2+.23],faceBack:true,hand:[0,item.type==='vanity'?.98:.98,.05] };
        if(['vanity','mirror'].includes(item.type)&&action==='Groom')return { offset:[0,0,d/2+.30],faceBack:true };
        return null;
    }
    function fixture(item,materials) {
        if(!['tub','shower','vanity','sink','toilet'].includes(item.type))return null;
        const T=ByndHomeEngine,group=new T.Group(),[w,d]=item.footprint;
        group.name='hygiene-effects';group.visible=false;group.userData.hygiene=true;
        const water=new T.MeshStandardMaterial({color:'#b8dfeb',transparent:true,opacity:.58,roughness:.28,depthWrite:false});
        const foam=new T.MeshStandardMaterial({color:'#fcfaf2',roughness:1});group.userData.ownedMaterials=[water,foam];
        const drops=new T.InstancedMesh(new T.SphereGeometry(1,6,4),water,32);drops.name='hygiene-water';drops.frustumCulled=false;drops.raycast=()=>{};
        for(let i=0;i<32;i++)drops.setMatrixAt(i,new T.Matrix4().makeScale(.007,.014,.007));
        drops.computeBoundingBox();group.add(drops);
        if(item.type==='tub'){
            const bubbles=new T.InstancedMesh(new T.SphereGeometry(1,8,6),foam,42),matrix=new T.Matrix4(),q=new T.Quaternion();
            bubbles.name='bath-foam';bubbles.raycast=()=>{};
            for(let i=0;i<42;i++){const a=i*1.47+Math.sin(i*3.7)*.8,r=Math.sqrt((i+.5)/42)*.88,px=Math.cos(a)*r*(w/2-.10),pz=Math.sin(a)*r*(d/2-.10),c=1-r,s=.045+Math.abs(Math.sin(i*2.3))*.055;matrix.compose(new T.Vector3(px,.58+c*.07+Math.abs(Math.sin(i*5.1))*.025,pz),q,new T.Vector3(s,s*.65+Math.abs(Math.cos(i*1.7))*.02,s));bubbles.setMatrixAt(i,matrix);}group.add(bubbles);
            // An overhead shower is mounted to the bath fixture, not the avatar.
            const pipe=new T.Group();pipe.name='bath-shower-fixture';
            H.Shapes.rounded(pipe,[.035,1.45,.035],[0,1.22,-d/2+.06],materials.get('warm_metal','#a59577'),.015);
            H.Shapes.rounded(pipe,[.035,.035,d/2],[0,1.95,-d/4+.06],materials.get('warm_metal','#a59577'),.012);
            const head=new T.Mesh(new T.CylinderGeometry(.14,.14,.035,16),materials.get('warm_metal','#a59577'));head.position.set(0,1.93,.06);pipe.add(head);group.userData.fixture=pipe;
        }
        return group;
    }
    function robe(actor) {
        const T = ByndHomeEngine, height = actor.modelHeight, group = new T.Group(); group.name = 'bath-robe';
        const material = new T.MeshStandardMaterial({ color: actor.modelId === 'bunny-blue-v1' ? '#e3ebe5' : '#e9e3d7', roughness: 1, side: T.DoubleSide });
        const edge = new T.MeshStandardMaterial({ color: '#faf6ee', roughness: 1, side: T.DoubleSide }); group.userData.ownedMaterials = [material, edge];
        actor.root.updateMatrixWorld(true);
        const pelvis = actor.body.worldToLocal(actor.hips.getWorldPosition(new T.Vector3()));
        const shoulder = actor.arms.map(b => actor.body.worldToLocal(b.getWorldPosition(new T.Vector3()))).reduce((a,b) => a.add(b)).multiplyScalar(.5);
        const neck = actor.modelId === 'bunny-blue-v1' ? height * .713 : height * .794, waist = pelvis.y + height * .065;
        const hips = actor.skeleton.bones.indexOf(actor.hips), spine = actor.skeleton.bones.indexOf(actor.head.parent);
        function skin(geometry, mat, name) {
            const p = geometry.attributes.position, indices = new Uint16Array(p.count * 4), weights = new Float32Array(p.count * 4);
            for (let i = 0; i < p.count; i++) { const blend = Math.max(0, Math.min(1, (p.getY(i) - pelvis.y) / Math.max(.1, shoulder.y - pelvis.y))); indices[i*4] = hips; indices[i*4+1] = spine; weights[i*4] = 1-blend; weights[i*4+1] = blend; }
            geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices,4)); geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4)); geometry.computeVertexNormals();
            const mesh = new T.SkinnedMesh(geometry,mat); mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true; mesh.raycast = () => {}; group.add(mesh); mesh.bind(actor.skeleton, actor.meshes[0].bindMatrix.clone()); return mesh;
        }
        // Elliptical cloth follows shoulders, waist and hips. Longitudinal folds
        // and a crossed front retain fabric volume instead of a rigid cone.
        const rings = [[height*.025,.225,.135],[height*.08,.245,.145],[height*.24,.24,.148],[pelvis.y,.222,.142],[waist,.184,.118],[shoulder.y-.03,.242,.15],[shoulder.y+.035,.226,.14],[neck,.075,.077]];
        const positions=[], indices=[], segments=32;
        rings.forEach(([y,rx,rz],row) => { for(let col=0;col<=segments;col++){const a=col/segments*Math.PI*2, fold=Math.cos(a*10+row*.25)*.006*(row<4?1:.45);positions.push(pelvis.x+Math.sin(a)*(rx+fold),y,pelvis.z+Math.cos(a)*(rz+fold));if(row&&col){const n=row*(segments+1)+col;indices.push(n,n-1,n-segments-1,n-1,n-segments-2,n-segments-1);}} });
        const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);skin(geometry,material,'robe-shaped-cloth');
        const band=[];for(let row=0;row<2;row++)for(let col=0;col<=segments;col++){const a=col/segments*Math.PI*2;band.push(pelvis.x+Math.sin(a)*.19,waist+(row? .021:-.021),pelvis.z+Math.cos(a)*.127);}
        const belt=new T.BufferGeometry();belt.setAttribute('position',new T.Float32BufferAttribute(band,3));const faces=[];for(let c=0;c<segments;c++)faces.push(c,c+1,c+segments+1,c+1,c+segments+2,c+segments+1);belt.setIndex(faces);skin(belt,edge,'robe-waist-belt');
        for(const side of [-1,1]){
            const points=[[side*.055,neck,.080],[side*.13,shoulder.y+.015,.138],[-side*.035,waist,.146]],ribbon=[];
            for(const [x,y,z] of points)for(const sign of [-1,1])ribbon.push(pelvis.x+x+sign*.018,y,pelvis.z+z);
            const lapel=new T.BufferGeometry();lapel.setAttribute('position',new T.Float32BufferAttribute(ribbon,3));lapel.setIndex([0,1,2,1,3,2,2,3,4,3,5,4]);skin(lapel,edge,'robe-soft-lapel');
        }
        actor.body.add(group); group.userData.sleeves=[];
        for (const upper of actor.arms) for (const joint of [upper,upper.children[0]]) {
            const child=joint.children[0], vector=child?.isBone?child.position.clone():new T.Vector3(0,-height*.16,0), length=vector.length();
            const geometry=new T.CylinderGeometry(joint===upper?.073:.062,joint===upper?.064:.045,length*.98,16,6,true), p=geometry.attributes.position;
            for(let i=0;i<p.count;i++){const ripple=1+Math.sin(p.getY(i)/length*Math.PI*8)*.04;p.setX(i,p.getX(i)*ripple);p.setZ(i,p.getZ(i)*ripple);}geometry.computeVertexNormals();
            const sleeve=new T.Mesh(geometry,material);sleeve.position.copy(vector).multiplyScalar(.5);sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vector.normalize());sleeve.name='bath-sleeve';sleeve.castShadow=true;sleeve.raycast=()=>{};joint.add(sleeve);group.userData.sleeves.push(sleeve);
        }
        group.raycast=()=>{};return group;
    }
    function showerMotion(actor) {
        const T=ByndHomeEngine,hands=H.Cooking?.hands;if(!hands)return;
        actor.root.updateMatrixWorld(true);
        const shoulders=actor.arms.map(b=>actor.body.worldToLocal(b.getWorldPosition(new T.Vector3()))), joints=actor.arms.flatMap(b=>[b,b.children[0]]), base=joints.map(b=>b.quaternion.clone()), frames=[], errors=[];
        const center=shoulders[0].clone().add(shoulders[1]).multiplyScalar(.5);
        for(let i=0;i<16;i++){
            joints.forEach((b,k)=>b.quaternion.copy(base[k]));actor.root.updateMatrixWorld(true);
            const phase=i/16*Math.PI*2, washing=(1-Math.cos(phase))/2;
            for(let side=0;side<2;side++){
                const sign=Math.sign(shoulders[side].x-center.x)||1;
                const target=new T.Vector3(center.x+sign*(side?.10:.16)*(1-.30*washing),center.y-(side?.20:.12)-.06*Math.sin(phase+(side?Math.PI:0)),center.z+.21+.025*Math.cos(phase));
                errors.push(hands.reach(actor,side,actor.body.localToWorld(target)));
            }
            frames.push(joints.map(b=>b.quaternion.clone()));
        }
        actor.hygieneCycle={frames,reachError:Math.max(...errors),shower:true};
        joints.forEach((b,i)=>b.quaternion.copy(frames[0][i])); actor.head.rotation.x=.08;
    }
    function prepare(actor) {
        const T=ByndHomeEngine,isBath=bathing.includes(actor.action);
        actor.hygieneCycle=null;
        actor.expressions?.forEach(e=>{if(e.bath)e.bath.value=isBath?1:0;});
        let garment=actor.body.getObjectByName('bath-robe');
        if(isBath&&!garment)garment=robe(actor);
        if(garment){const showRobe=actor.action==='Shower';garment.visible=showRobe;garment.userData.sleeves.forEach(s=>{s.visible=showRobe;});}
        if(!actor.anchor?.hygiene)return;
        if(actor.action==='Bathe'){
            actor.body.position.y=-actor.modelHeight*.5;
            actor.legs.forEach(b=>{b.rotation.x=-1.15;});actor.knees.forEach(b=>{b.rotation.x=1.35;});
            actor.arms.forEach((b,i)=>{b.rotation.x=-.55;b.rotation.z=i?-.35:.35;});
            H.Expressions.meal(actor,0,.15,.8);
        }
        if(actor.action==='Shower'){showerMotion(actor);H.Expressions.meal(actor,0,.10,.85);}
        if(actor.action==='Shower'){
            actor.socks.forEach(s=>{s.visible=true;});actor.root.updateMatrixWorld(true);
            let sole=Infinity;const point=new T.Vector3();
            for(const group of actor.socks){const mesh=group.children[0];if(!mesh?.geometry)continue;for(const i of new Set(mesh.geometry.index.array)){point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);sole=Math.min(sole,point.y);}}
            if(Number.isFinite(sole))actor.root.position.y+=(actor.anchor.floorY||0)+(actor.anchor.furnitureType==='shower'?.133:.10)-sole;
        }
        if(actor.action==='Use Toilet')actor.head.rotation.x=.12;
        const hands=H.Cooking?.hands,anchor=actor.anchor.hygiene;
        if(hands&&(washing.includes(actor.action)||actor.action==='Groom')){
            const target=anchor.hand?new T.Vector3(...anchor.hand):actor.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.05,.08));
            if(anchor.hand){
                if(actor.modelId==='bunny-blue-v1')actor.body.position.z=-.08;
                actor.body.rotation.x=.20;
                const spine=actor.skeleton.bones.find(b=>b.name==='spine'||/Spine2$/.test(b.name));
                if(spine)spine.rotation.x=.15;
                actor.root.updateMatrixWorld(true);actor.skeleton.update();
                let sole=Infinity;const point=new T.Vector3();
                for(const mesh of actor.boots)for(const i of new Set(mesh.geometry.index.array)){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);sole=Math.min(sole,point.y);}
                if(Number.isFinite(sole))actor.root.position.y+=(actor.anchor.floorY||0)+.008-sole;
            }
            const frames=[],errors=[];
            for(let phase=0;phase<2;phase++){
                let point=target.clone();
                if(actor.action==='Wash Face'&&phase===1){actor.root.updateMatrixWorld(true);point=actor.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.03,0));point.add(new T.Vector3(0,0,.10).applyQuaternion(actor.root.quaternion));}
                for(let side=0;side<2;side++)errors.push(hands.reach(actor,side,point.clone().add(new T.Vector3(side?.045:-.045,phase*.025,0))));
                frames.push(actor.arms.flatMap(b=>[b.quaternion.clone(),b.children[0].quaternion.clone()]));
            }
            actor.hygieneCycle={frames,reachError:Math.max(...errors)};
        }
        actor.root.updateMatrixWorld(true);actor.skeleton.update();
    }
    function animate(actor,time,reduced) {
        const cycle=actor.hygieneCycle;if(!cycle)return;
        if(cycle.shower){const phase=reduced?0:(((time-actor.startedAt)%6800+6800)%6800)/6800*cycle.frames.length,index=Math.floor(phase),next=(index+1)%cycle.frames.length;actor.arms.flatMap(b=>[b,b.children[0]]).forEach((b,i)=>b.quaternion.copy(cycle.frames[index][i]).slerp(cycle.frames[next][i],phase-index));return;}
        const phase=reduced?0:(Math.sin((time-actor.startedAt)*.004)+1)/2;
        actor.arms.flatMap(b=>[b,b.children[0]]).forEach((b,i)=>b.quaternion.copy(cycle.frames[0][i]).slerp(cycle.frames[1][i],phase));
        if(actor.action==='Wash Face')H.Expressions.meal(actor,0,0,phase>.6?1:0);
    }
    function update(rows,actors,time,profile,reduced) {
        const T=ByndHomeEngine,matrix=new T.Matrix4(),q=new T.Quaternion();
        for(const row of rows){
            const effects=row.model.getObjectByName('hygiene-effects');if(!effects)continue;
            const actor=actors.find(a=>a.root.visible&&a.anchor?.placementId===row.placement.id&&[...bathing,...washing,'Use Toilet'].includes(a.action));
            effects.visible=!!actor;if(!actor)continue;
            const water=effects.getObjectByName('hygiene-water'),foam=effects.getObjectByName('bath-foam'),action=actor.action,[w,d]=row.item.footprint;
            if(foam)foam.visible=action==='Bathe';water.visible=action!=='Use Toilet';
            const shower=action==='Shower',origin=shower?[0,1.90,row.item.type==='shower'?-d/2+.40:.06]:row.item.type==='tub'?[w/2-.2,.87,-d/2+.20]:[0,1.10,-d*.10];
            const bottom=shower?.15:row.item.type==='tub'?.59:.88,count=profile.tier==='smooth'?8:profile.tier==='ultra'?32:18;water.count=count;
            for(let i=0;i<count;i++){
                const phase=reduced?(i+.5)/count:(time*.0018+i/count)%1,spread=shower?.13:.018;
                matrix.compose(new T.Vector3(origin[0]+Math.sin(i*2.4)*spread,origin[1]-(origin[1]-bottom)*phase,origin[2]+Math.cos(i*2.4)*spread),q,new T.Vector3(.007,shower?.028:.014,.007));water.setMatrixAt(i,matrix);
            }
            water.instanceMatrix.needsUpdate=true;water.computeBoundingBox();
        }
    }
    H.Hygiene={station,fixture,prepare,animate,update};
})(window.ByndHome3D);
