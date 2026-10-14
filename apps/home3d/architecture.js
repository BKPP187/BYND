(function (H) {
    'use strict';
    function bake(group) {
        const T=ByndHomeEngine, batches=new Map(),owned=new Map();group.updateMatrixWorld(true);
        const meshes=[];group.traverse(n=>{if(n.isMesh&&!n.isInstancedMesh&&!n.material.transparent)meshes.push(n);});
        for(const mesh of meshes){
            if(!owned.has(mesh.material))owned.set(mesh.material,{materials:new Set(),textures:new Set()});
            const resources=owned.get(mesh.material);for(const m of mesh.userData.ownedMaterials||[])resources.materials.add(m);for(const t of mesh.userData.ownedTextures||[])resources.textures.add(t);if(mesh.userData.ownedMaterial)resources.materials.add(mesh.userData.ownedMaterial);if(mesh.userData.ownedTexture)resources.textures.add(mesh.userData.ownedTexture);
            const source=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),flat=source.index?source.toNonIndexed():source;if(flat!==source)source.dispose();
            if(!flat.attributes.uv)flat.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(flat.attributes.position.count*2),2));
            if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(flat);mesh.geometry.dispose();for(const geometry of mesh.userData.renderLods||[])if(geometry!==mesh.geometry)geometry.dispose();mesh.removeFromParent();
        }
        for(const [material,list]of batches){
            const geometry=new T.BufferGeometry();for(const name of ['position','normal','uv']){
                const size=name==='uv'?2:3,length=list.reduce((n,g)=>n+g.attributes[name].array.length,0),array=new Float32Array(length);let offset=0;
                for(const g of list){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}geometry.setAttribute(name,new T.BufferAttribute(array,size));
            }
            list.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometry.computeBoundingBox();const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;if(material.emissive?.getHex())mesh.userData.luminousMaterial=material;const resources=owned.get(material);mesh.userData.ownedMaterials=[...resources.materials];mesh.userData.ownedTextures=[...resources.textures];group.add(mesh);
        }
    }
    function exterior(materials,home,cutaway=false) {
        const T=ByndHomeEngine,root=new T.Group(),facade=new T.Group(),roofs=new T.Group();root.name='villa-exterior';facade.name='villa-facade';roofs.name='villa-pitched-roof';root.add(facade,roofs);facade.visible=!cutaway;
        const cream=materials.get('matte_ceramic','#ece4d1'),trim=materials.get('milky_plastic','#fff3df'),wood=materials.get('soft_wood','#a88c65'),sage=materials.get('matte_ceramic','#7f977e'),stone=materials.get('matte_ceramic','#bfb69f');
        const tile=materials.surface({pattern:'roof_tiles',base:'#879381',ink:'#748373',secondary:'#a8afa0'},7.4,12.4,'roof');
        const box=(g,s,p,m=trim)=>H.Shapes.rounded(g,s,p,m,.015);
        box(facade,[15.05,.26,11.8],[-.1,-.07,-2.05],stone);
        for(let level=0;level<H.Villa.levelCount;level++){
            const y=level*3.2;
            for(const x of [-7.4,7.2])box(facade,[.16,3.2,11.6],[x,y+1.6,-2.1],cream);
            for(const z of [-7.8,3.6])box(facade,[14.65,3.2,.16],[-.1,y+1.6,z],cream);
            for(const x of [-7.5,-.1,7.3])for(const z of [-7.85,3.66])box(facade,[.20,3.2,.22],[x,y+1.6,z]);
            for(const h of [.2,.78,3.05])box(facade,[15,.08,.22],[-.1,y+h,3.69],h===.78?wood:trim);
            for(const x of [-7.49,7.29])for(const h of [.2,3.05])box(facade,[.22,.08,11.85],[x,y+h,-2.1]);
            for(const x of [-4.1,3.9]){windowArch(facade,[x,y+.38,3.72],0,1.85,2.15,materials);windowArch(facade,[x,y+.72,-7.93],Math.PI,1.65,1.8,materials);}
            for(const x of [-7.5,7.3])for(const z of [-5,.8])windowArch(facade,[x,y+.72,z],x<0?-Math.PI/2:Math.PI/2,1.65,1.8,materials);
        }
        // Two gabled wings, with recessed porch and a smaller dormer in each
        // roof. A cutaway keeps just rear roof strips above the visible rooms.
        for(const x of [-4.1,3.9]){
            roofWing(roofs,x,cutaway?-7.3:-2.08,7.65,cutaway?1.35:12.45,6.42,1.95,tile);
            if(!cutaway){
                for(const z of [3.82,-8.04]){const triangle=new T.BufferGeometry(),vertices=z>0?[x-3.82,6.42,z,x+3.82,6.42,z,x,8.37,z]:[x-3.82,6.42,z,x,8.37,z,x+3.82,6.42,z];triangle.setAttribute('position',new T.Float32BufferAttribute(vertices,3));triangle.computeVertexNormals();const gable=new T.Mesh(triangle,cream);facade.add(gable);}
                windowArch(facade,[x,6.57,3.87],0,.85,1.15,materials);
                for(const sign of [-1,1]){const verge=box(facade,[4.35,.10,.12],[x+sign*1.91,7.4,3.9],wood);verge.rotation.z=-sign*Math.atan(1.95/3.82);}
            }
            for(const sign of [-1,1])box(roofs,[.09,.10,cutaway?1.45:12.6],[x+sign*3.84,6.42,cutaway?-7.3:-2.08],wood);
            if(!cutaway){const dormer=new T.Group();dormer.position.set(x+1.2,7.0,-1.5);facade.add(dormer);box(dormer,[1.3,1.05,.9],[0,.45,0],cream);windowArch(dormer,[0,0,.48],0,.8,.85,materials);roofWing(roofs,x+1.2,-1.5,1.6,1.3,8.0,.42,tile);}
        }
        box(facade,[6.6,.20,1.7],[-4.1,.15,4.45],wood);
        for(const x of [-6.9,-1.3]){box(facade,[.20,2.8,.20],[x,1.7,4.8],trim);box(facade,[.37,.13,.37],[x,.40,4.8],stone);}
        for(let i=0;i<3;i++)box(facade,[2.8,.12,.40],[-4.1,.17-i*.065,5.2+i*.30],stone);
        box(facade,[6.9,.15,1.9],[-4.1,3.03,4.5],wood);
        for(const [x,z]of [[-6.7,4.55],[-1.5,4.55],[1.25,4.3],[6.5,4.3]]){
            box(facade,[.35,.44,.35],[x,.39,z],wood);const bulb=box(facade,[.20,.27,.20],[x,.78,z],materials.glow('#ffedc6',.25));bulb.userData.luminousMaterial=bulb.material;box(facade,[.30,.055,.30],[x,.95,z],wood);
        }
        box(roofs,[.7,1.35,.65],[5.9,7.25,-5.5],stone);box(roofs,[.85,.12,.80],[5.9,7.95,-5.5],trim);
        const lower=H.Villa.plan('living_room'),upper=H.Villa.plan('bedroom');
        if(!cutaway)for(const p of [lower,upper])for(const n of p.nodes.filter(n=>['garden','balcony','terrace','greenhouse'].includes(n.id))){const shell=H.Villa.shell(n,p,materials,home);bake(shell);root.add(shell);}
        vines(root,materials,cutaway);
        bake(facade);bake(roofs);root.userData.architecture={design:'botanical-cottage-v1',cutaway,levels:H.Villa.levelCount};return root;
    }
    function windowArch(parent,position,rotation,width,height,materials){
        const T=ByndHomeEngine,g=new T.Group();g.position.fromArray(position);g.rotation.y=rotation;parent.add(g);
        const shape=new T.Shape(),r=width/2,shoulder=height-r;shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,shoulder);shape.absarc(0,shoulder,r,0,Math.PI,false);shape.closePath();
        const pane=new T.Mesh(new T.ShapeGeometry(shape,12),materials.glow('#d4e6cb',.18));pane.position.z=.014;pane.userData.luminousMaterial=pane.material;g.add(pane);
        const outline=[new T.Vector3(-r,0,.04),new T.Vector3(-r,shoulder,.04)];for(let i=0;i<=16;i++){const a=Math.PI-i/16*Math.PI;outline.push(new T.Vector3(Math.cos(a)*r,shoulder+Math.sin(a)*r,.04));}outline.push(new T.Vector3(r,0,.04));
        const frame=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(outline),32,.045,6,false),materials.get('soft_wood','#a88c65'));g.add(frame);
        const part=(s,p)=>H.Shapes.rounded(g,s,p,materials.get('milky_plastic','#fff3df'),.009);part([.05,height-.06,.05],[0,height/2,.055]);part([width,.05,.05],[0,height*.43,.055]);part([width+.18,.09,.20],[0,-.04,.02]);
    }
    function roofWing(parent,x,z,width,depth,y,rise,material){
        const T=ByndHomeEngine,positions=[],uv=[],normal=[];
        const a=[x-width/2,y,z-depth/2],b=[x+width/2,y,z-depth/2],c=[x+width/2,y,z+depth/2],d=[x-width/2,y,z+depth/2],e=[x,y+rise,z-depth/2],f=[x,y+rise,z+depth/2];
        for(const triangle of [[a,d,e],[d,f,e],[e,f,b],[f,c,b]])for(const p of triangle){positions.push(...p);uv.push((p[0]-x)/width+.5,(p[2]-z)/depth+.5);}
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const mesh=new T.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
    }
    function vines(root,materials,cutaway){
        const T=ByndHomeEngine,count=cutaway?120:260,leaves=new T.InstancedMesh(new T.SphereGeometry(1,7,5),materials.get('sage','#7b9b6d'),count),pose=new T.Object3D();leaves.name='villa-climbing-leaves';
        for(let i=0;i<count;i++){
            if(i%3===0){const x=i%2?-7.25:7.1;pose.position.set(x+Math.sin(i)*.15,.3+(i%44)*.15,3.9+Math.cos(i)*.18);}
            else{const x=-7.4+(i%61)*.245;pose.position.set(x,6.45+Math.sin(i)*.18,cutaway?-7.9:3.95+Math.cos(i)*.1);}
            pose.scale.set(.12,.065,.18);pose.rotation.set(.3,Math.sin(i)*2,i*.7);pose.updateMatrix();leaves.setMatrixAt(i,pose.matrix);
        }leaves.castShadow=true;leaves.computeBoundingSphere();root.add(leaves);
    }
    H.Architecture={exterior,bake};
})(window.ByndHome3D);
