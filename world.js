import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
export const THREE_NS = THREE;

function makeSkyDome(){
  const geo=new THREE.SphereGeometry(4000,32,16,true);
  const c=document.createElement("canvas"); c.width=2; c.height=256;
  const g=c.getContext("2d");
  const grd=g.createLinearGradient(0,0,0,256);
  grd.addColorStop(0,"#7bb4e8");
  grd.addColorStop(0.5,"#a8d9ff");
  grd.addColorStop(1,"#d8f1ff");
  g.fillStyle=grd; g.fillRect(0,0,2,256);
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.ShaderMaterial({
    uniforms:{map:{value:tex}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D map; varying vec2 vUv; void main(){float y=1.0-vUv.y; vec3 col=texture2D(map,vec2(0.5,y)).rgb; gl_FragColor=vec4(col,1.0);}`,
    side:THREE.BackSide, depthWrite:false
  });
  return new THREE.Mesh(geo,mat);
}

export function makeRenderer(canvas){
  const r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  const dpr=Math.min(1.1, window.devicePixelRatio||1);
  r.setPixelRatio(dpr);
  r.setSize(innerWidth,innerHeight);
  r.shadowMap.enabled=true;
  r.physicallyCorrectLights=true;
  r.toneMapping=THREE.ACESFilmicToneMapping;
  r.toneMappingExposure=1.0;
  return r;
}

export function makeScene(){
  const scene=new THREE.Scene();
  scene.add(makeSkyDome());
  scene.fog=new THREE.Fog(0xb8e0ff,900,3200);
  const hemi=new THREE.HemisphereLight(0xd8eeff,0x5580aa,0.7);
  const sun=new THREE.DirectionalLight(0xffffff,0.9);
  sun.position.set(200,300,120);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.near=10; sun.shadow.camera.far=1600;
  sun.shadow.camera.left=-700; sun.shadow.camera.right=700;
  sun.shadow.camera.top=700; sun.shadow.camera.bottom=-700;
  scene.add(hemi,sun);
  scene.userData.sun=sun;
  return scene;
}

export function makeCamera(){
  const cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,6000);
  cam.position.set(0,140,180);
  return cam;
}

function makeWaterTex(){
  const w=512,h=512,c=document.createElement("canvas"); c.width=w; c.height=h;
  const g=c.getContext("2d");
  
  // Base water color
  g.fillStyle="#1a4d80";
  g.fillRect(0,0,w,h);
  
  // Organic noise pattern using circles and irregular shapes
  for(let i=0; i<1500; i++){
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = 2 + Math.random() * 6;
    const alpha = 0.02 + Math.random() * 0.08;
    
    // Use perlin-like noise approximation
    const nx = x / w;
    const ny = y / h;
    const noise = Math.sin(nx * 15) * Math.cos(ny * 15) + 
                  Math.sin(nx * 30) * Math.cos(ny * 30) * 0.5;
    
    const isDark = noise < 0;
    g.fillStyle = isDark ? `rgba(10,30,50,${alpha})` : `rgba(180,210,230,${alpha})`;
    
    g.beginPath();
    g.arc(x, y, size, 0, Math.PI * 2);
    g.fill();
  }
  
  // Add organic wave patterns
  for(let i=0; i<20; i++){
    g.strokeStyle = `rgba(255,255,255,${0.01 + Math.random() * 0.03})`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    
    const startY = Math.random() * h;
    const amplitude = 10 + Math.random() * 20;
    const frequency = 0.008 + Math.random() * 0.012;
    const phase = Math.random() * Math.PI * 2;
    
    for(let x=0; x<w; x+=3){
      const wave = Math.sin(x * frequency + phase) * amplitude + 
                   Math.sin(x * frequency * 2 + phase) * amplitude * 0.3;
      const y = startY + wave;
      if(x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  
  // Add some foam spots
  for(let i=0; i<50; i++){
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = 3 + Math.random() * 8;
    g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
    g.beginPath();
    // Irregular foam shape
    for(let j=0; j<6; j++){
      const angle = (j / 6) * Math.PI * 2;
      const r = size * (0.7 + Math.random() * 0.6);
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if(j === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8;
  return t;
}

export function addWater(scene){
  const tex=makeWaterTex();
  const mat=new THREE.MeshStandardMaterial({
    color:0xffffff,
    map:tex,
    roughness:0.25,
    metalness:0.08,
    envMapIntensity:1.2,
    transparent:true,
    opacity:0.99
  });
  const water=new THREE.Mesh(new THREE.PlaneGeometry(8000,8000,1,1),mat);
  water.rotation.x=-Math.PI/2;
  water.receiveShadow=false;
  water.onBeforeRender=()=>{
    const t=performance.now()*0.00004;
    tex.offset.set(t*0.18,t*0.15);
  };
  scene.add(water);
  scene.userData.water = water;
  return water;
}

export function createShipWaterEffects(ship, scene){
  const effects = {
    bowWaves: [],
    wake: [],
    reflection: null,
    reloadArcs: {left: null, right: null},
    aimLine: null
  };
  
  // Bow wave - V-shaped water displacement at bow
  for(let i=0; i<8; i++){
    const shape = new THREE.Shape();
    // V-shaped wave pattern
    shape.moveTo(0, 0);
    shape.lineTo(2.5, 4);
    shape.quadraticCurveTo(2.8, 5, 3, 6);
    shape.lineTo(-3, 6);
    shape.quadraticCurveTo(-2.8, 5, -2.5, 4);
    shape.lineTo(0, 0);
    
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const wave = new THREE.Mesh(geo, mat);
    wave.rotation.x = -Math.PI/2;
    wave.visible = false;
    scene.add(wave);
    effects.bowWaves.push({mesh: wave, life: 0, offset: i * 0.18});
  }
  
  // Wake trail - realistic V-shaped foam trails
  for(let i=0; i<12; i++){
    // Create more organic wake shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    // Curved expanding trail
    shape.bezierCurveTo(0.3, 1.5, 0.8, 3.5, 1.2, 5.5);
    shape.bezierCurveTo(1.4, 6.5, 1.5, 7.5, 1.6, 8.5);
    shape.lineTo(-1.6, 8.5);
    shape.bezierCurveTo(-1.5, 7.5, -1.4, 6.5, -1.2, 5.5);
    shape.bezierCurveTo(-0.8, 3.5, -0.3, 1.5, 0, 0);
    
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const trail = new THREE.Mesh(geo, mat);
    trail.rotation.x = -Math.PI/2;
    trail.visible = false;
    scene.add(trail);
    effects.wake.push({mesh: trail, life: 0, side: i % 2 === 0 ? -1 : 1, index: Math.floor(i/2)});
  }
  
  // Realistic reflection - flattened, darker ship with blur effect
  const reflection = ship.clone();
  reflection.scale.set(1, -0.5, 1);
  reflection.position.y = -0.5;
  reflection.traverse(child => {
    if(child.isMesh && child.material){
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.25;
      child.material.color = new THREE.Color(0x1a3d5d);
      child.material.depthWrite = false;
      child.material.fog = false;
    }
  });
  scene.add(reflection);
  effects.reflection = reflection;
  
  // Reload indicator arcs on water surface
  effects.reloadArcs.left = createReloadArc(scene, 'left');
  effects.reloadArcs.right = createReloadArc(scene, 'right');
  
  // Create 3D aim line on water surface
  effects.aimLine = createAimLine(scene);
  
  return effects;
}

function createAimLine(scene){
  const group = new THREE.Group();
  
  // Create thicker line using cylinder mesh instead of Line
  const lineGeometry = new THREE.CylinderGeometry(0.5, 0.5, 120, 8);
  lineGeometry.rotateX(Math.PI / 2); // Rotate to point forward (Z axis)
  lineGeometry.translate(0, 0, -60); // Center at origin, extends to -120
  
  // Green glowing material - brighter and more visible
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff66,
    transparent: true,
    opacity: 0.8,
    depthTest: true,
    depthWrite: false
  });
  
  const line = new THREE.Mesh(lineGeometry, lineMaterial);
  line.position.y = 0.6; // Slightly above water
  group.add(line);
  
  scene.add(group);
  group.visible = false; // Hidden by default
  
  return {group, line};
}

function createReloadArc(scene, side){
  const arcRadius = 30; // Radius around ship
  const segments = 32; // For dashed effect
  const tubeRadius = 0.7; // Thicker arcs
  
  // Define arc angle based on side - with gaps so they don't touch
  // Left side: arc on left with gap at front and back
  // Right side: arc on right with gap at front and back
  const gap = Math.PI * 0.15; // 27 degree gap
  const startAngle = side === 'left' ? Math.PI/2 + gap : -Math.PI/2 + gap;
  const endAngle = side === 'left' ? Math.PI*1.5 - gap : Math.PI/2 - gap;
  
  // Create dashed arc effect with individual segments
  const group = new THREE.Group();
  const dashCount = 16; // Number of dashes
  const angleRange = endAngle - startAngle;
  const dashAngle = angleRange / dashCount;
  const gapRatio = 0.4; // 40% gap
  
  const segments_bg = [];
  const segments_progress = [];
  
  for(let i = 0; i < dashCount; i++){
    const segStart = startAngle + i * dashAngle;
    const segEnd = segStart + dashAngle * (1 - gapRatio);
    
    // Background dash
    const bgCurve = new THREE.EllipseCurve(0, 0, arcRadius, arcRadius, segStart, segEnd, false, 0);
    const bgPoints = bgCurve.getPoints(8);
    const bgPath = new THREE.CatmullRomCurve3(
      bgPoints.map(p => new THREE.Vector3(p.x, 0, -p.y))
    );
    const bgGeo = new THREE.TubeGeometry(bgPath, 8, tubeRadius, 8, false);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x555555,
      transparent: true,
      opacity: 0.3
    });
    const bgDash = new THREE.Mesh(bgGeo, bgMat);
    group.add(bgDash);
    segments_bg.push(bgDash);
    
    // Progress dash
    const progCurve = new THREE.EllipseCurve(0, 0, arcRadius, arcRadius, segStart, segEnd, false, 0);
    const progPoints = progCurve.getPoints(8);
    const progPath = new THREE.CatmullRomCurve3(
      progPoints.map(p => new THREE.Vector3(p.x, 0, -p.y))
    );
    const progGeo = new THREE.TubeGeometry(progPath, 8, tubeRadius, 8, false);
    const progMat = new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      transparent: true,
      opacity: 0.8
    });
    const progDash = new THREE.Mesh(progGeo, progMat);
    progDash.visible = false; // Will show based on reload percent
    group.add(progDash);
    segments_progress.push({mesh: progDash, index: i});
  }
  
  group.position.y = 0.5;
  scene.add(group);
  
  return {
    group,
    segments_bg,
    segments_progress,
    arcRadius,
    startAngle,
    endAngle,
    dashCount,
    side
  };
}

export function updateShipWaterEffects(shipData, effects, dt, cdLeft, cdRight, reloadTime, isSinking, showAim, aimPoint){
  if(!effects) return;
  
  const speed = shipData.vel.length();
  const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipData.ang);
  const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipData.ang);
  
  // Update reflection
  if(effects.reflection){
    effects.reflection.position.x = shipData.pos.x;
    effects.reflection.position.z = shipData.pos.z;
    effects.reflection.rotation.y = shipData.ang;
  }
  
  // Update 3D aim line on water surface
  if(effects.aimLine){
    const shouldShow = showAim && !isSinking;
    effects.aimLine.group.visible = shouldShow;
    
    if(shouldShow && aimPoint){
      // Position line at ship (on water surface)
      effects.aimLine.group.position.set(shipData.pos.x, 0.5, shipData.pos.z);
      
      // Calculate direction to aimPoint
      const dir = new THREE.Vector3(
        aimPoint.x - shipData.pos.x,
        0,
        aimPoint.z - shipData.pos.z
      );
      const distance = dir.length();
      
      if(distance > 0.1){
        // Rotate group to point toward aimPoint
        const angle = Math.atan2(dir.x, -dir.z);
        effects.aimLine.group.rotation.y = angle;
      }
    }
  }
  
  // Hide reload arcs if sinking
  if(effects.reloadArcs.left){
    effects.reloadArcs.left.group.visible = !isSinking;
    if(!isSinking) updateReloadArc(effects.reloadArcs.left, shipData, cdLeft, reloadTime);
  }
  if(effects.reloadArcs.right){
    effects.reloadArcs.right.group.visible = !isSinking;
    if(!isSinking) updateReloadArc(effects.reloadArcs.right, shipData, cdRight, reloadTime);
  }
  
  // Don't show water effects if ship is sinking
  if(isSinking){
    effects.bowWaves.forEach(w => {
      w.mesh.visible = false;
      w.life = 0;
    });
    effects.wake.forEach(w => {
      w.mesh.visible = false;
      w.life = 0;
    });
    if(effects.reflection) effects.reflection.visible = false;
    return;
  }
  
  // Ensure reflection is visible when not sinking
  if(effects.reflection) effects.reflection.visible = true;
  
  // Update bow waves - V-shaped displacement at bow (only spawn when moving)
  if(speed > 3){
    effects.bowWaves.forEach((wave, idx) => {
      wave.life += dt;
      const spawnTime = wave.offset;
      
      if(wave.life > spawnTime && wave.life - dt <= spawnTime){
        wave.mesh.visible = true;
        const bowOffset = fwd.clone().multiplyScalar(-18);
        wave.mesh.position.set(
          shipData.pos.x + bowOffset.x,
          0.18,
          shipData.pos.z + bowOffset.z
        );
        wave.mesh.rotation.z = shipData.ang;
        wave.mesh.scale.set(1, 1, 1);
        wave.mesh.material.opacity = 0.5;
      }
      
      if(wave.mesh.visible && wave.life > spawnTime){
        const localLife = wave.life - spawnTime;
        const scale = 1 + localLife * 1.5;
        wave.mesh.scale.set(scale, scale, 1);
        wave.mesh.material.opacity = 0.5 * Math.max(0, 1 - localLife / 1.2);
        
        if(localLife >= 1.2){
          wave.mesh.visible = false;
          wave.life = 0;
        }
      }
    });
    
    // Update wake - diagonal V-shaped foam trails
    effects.wake.forEach((trail) => {
      trail.life += dt;
      const delay = 0.08 * trail.index;
      
      if(trail.life > delay){
        if(!trail.mesh.visible){
          trail.mesh.visible = true;
        }
        
        const localLife = trail.life - delay;
        const distance = 8 + trail.index * 6;
        const angleSpread = 0.35 + trail.index * 0.1;
        
        const offset = fwd.clone().multiplyScalar(distance);
        const sideOffset = side.clone().multiplyScalar(trail.side * (2 + trail.index * 1.5));
        
        trail.mesh.position.set(
          shipData.pos.x + offset.x + sideOffset.x,
          0.12,
          shipData.pos.z + offset.z + sideOffset.z
        );
        
        // Angle wake outward in V shape
        trail.mesh.rotation.y = shipData.ang + trail.side * angleSpread;
        const fadeTime = 1.5 + trail.index * 0.3;
        trail.mesh.material.opacity = 0.4 * Math.max(0, 1 - localLife / fadeTime);
        const scale = 1 + localLife * 0.5;
        trail.mesh.scale.set(scale, scale, 1);
        
        if(localLife >= fadeTime){
          trail.mesh.visible = false;
          trail.life = 0;
        }
      }
    });
  }
  
  // Continue animating existing waves even when stopped (they fade naturally)
  effects.bowWaves.forEach((wave) => {
    if(wave.mesh.visible && speed <= 3){
      // Let existing waves fade out
      wave.life += dt;
      const spawnTime = wave.offset;
      if(wave.life > spawnTime){
        const localLife = wave.life - spawnTime;
        wave.mesh.material.opacity = 0.5 * Math.max(0, 1 - localLife / 1.2);
        if(localLife >= 1.2){
          wave.mesh.visible = false;
          wave.life = 0;
        }
      }
    }
  });
  
  effects.wake.forEach((trail) => {
    if(trail.mesh.visible && speed <= 3){
      // Let existing trails fade out
      trail.life += dt;
      const delay = 0.08 * trail.index;
      if(trail.life > delay){
        const localLife = trail.life - delay;
        const fadeTime = 1.5 + trail.index * 0.3;
        trail.mesh.material.opacity = 0.4 * Math.max(0, 1 - localLife / fadeTime);
        if(localLife >= fadeTime){
          trail.mesh.visible = false;
          trail.life = 0;
        }
      }
    }
  });
}

function updateReloadArc(arc, shipData, cd, reloadTime){
  // Position arc centered on ship
  arc.group.position.x = shipData.pos.x;
  arc.group.position.z = shipData.pos.z;
  
  // Rotate arc with ship
  arc.group.rotation.y = shipData.ang;
  
  // Update progress
  const reloadPercent = 1 - (cd / reloadTime);
  const visibleDashes = Math.floor(arc.dashCount * reloadPercent);
  
  // Update which dashes are visible
  arc.segments_progress.forEach((dash) => {
    if(dash.index < visibleDashes){
      dash.mesh.visible = true;
      // Color based on ready state
      if(reloadPercent >= 1){
        dash.mesh.material.color.setHex(0x44ff44); // Green when ready
        dash.mesh.material.opacity = 0.9;
      } else {
        dash.mesh.material.color.setHex(0xffcc00); // Yellow when reloading
        dash.mesh.material.opacity = 0.7;
      }
    } else {
      dash.mesh.visible = false;
    }
  });
}

function sandTex(){
  const size=256,c=document.createElement("canvas"); c.width=c.height=size;
  const ctx=c.getContext("2d");
  const g=ctx.createLinearGradient(0,0,0,size);
  g.addColorStop(0,"#f2da9a"); g.addColorStop(1,"#d6ba77");
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  for(let i=0;i<6000;i++){const x=Math.random()*size,y=Math.random()*size,a=0.08+Math.random()*0.12; ctx.fillStyle=`rgba(120,90,50,${a})`; ctx.fillRect(x,y,1,1);}
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t;
}
function grassTex(){
  const size=256,c=document.createElement("canvas"); c.width=c.height=size;
  const ctx=c.getContext("2d");
  // Base grass color
  ctx.fillStyle="#4a7c4e";
  ctx.fillRect(0,0,size,size);
  // Add grass texture variation
  for(let i=0;i<8000;i++){
    const x=Math.random()*size,y=Math.random()*size;
    const a=0.1+Math.random()*0.2;
    const colors = ["rgba(60,100,65,","rgba(50,90,55,","rgba(70,110,75,"];
    ctx.fillStyle=pick(colors)+a+")";
    ctx.fillRect(x,y,rnd(1,2),rnd(1,2));
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t;
}
function shoreTex(){
  const s=512,c=document.createElement("canvas"); c.width=c.height=s;
  const ctx=c.getContext("2d");
  const grd=ctx.createRadialGradient(s/2,s/2, s*0.35, s/2,s/2, s*0.5);
  grd.addColorStop(0,"rgba(255,255,255,0.0)");
  grd.addColorStop(0.55,"rgba(255,255,255,0.22)");
  grd.addColorStop(0.8,"rgba(255,255,255,0.0)");
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(s/2,s/2,s/2,0,6.28318); ctx.fill();
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.anisotropy=8; return t;
}

function rnd(a,b){return a+Math.random()*(b-a)}
function rndi(a,b){return Math.floor(rnd(a,b+1))}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}

function makeTree(){
  const g=new THREE.Group();
  const scale = rnd(2.5, 3.5); // Even bigger trees
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.35*scale,0.42*scale,rnd(3.5,4.8)*scale,6),new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:0.9}));
  trunk.position.y=trunk.geometry.parameters.height/2; g.add(trunk);
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(rnd(1.8,2.4)*scale,8,8),new THREE.MeshStandardMaterial({color:pick([0x2f7d32,0x3e8f3a,0x377d41]),roughness:1}));
  leaf.position.y=trunk.geometry.parameters.height+1.2*scale; g.add(leaf);
  return g;
}
function makePalm(){
  const g=new THREE.Group();
  const scale = rnd(2.2, 3.0); // Even bigger palms
  const h=rnd(5.5,7.5)*scale;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.28*scale,0.38*scale,h,6),new THREE.MeshStandardMaterial({color:0x8b5a2b,roughness:0.9}));
  trunk.position.y=h/2; g.add(trunk);
  for(let i=0;i<6;i++){
    const leaf=new THREE.Mesh(new THREE.CapsuleGeometry(0.09*scale,2.8*scale,4,6),new THREE.MeshStandardMaterial({color:0x2a8a3a,roughness:1}));
    leaf.position.y=h; leaf.rotation.z=rnd(-0.8,-0.2); leaf.rotation.y=i*(Math.PI*2/6)+rnd(-0.2,0.2);
    g.add(leaf);
  }
  return g;
}
function makeRock(){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(0.6,1.4)), new THREE.MeshStandardMaterial({color:0x808a91,roughness:1}));
  m.scale.set(rnd(0.8,1.3),rnd(0.6,1.2),rnd(0.8,1.4));
  return m;
}
function makeWreck(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.5,6.2), new THREE.MeshStandardMaterial({color:0x4b2f18,roughness:0.95}));
  body.position.y=0.3; g.add(body);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,2.2,6), new THREE.MeshStandardMaterial({color:0x6a4930}));
  mast.position.set(rnd(-0.4,0.4),1.3,rnd(-1.2,1.2)); mast.rotation.z=rnd(0.4,1.0); g.add(mast);
  return g;
}
function makeBush(){
  const m=new THREE.Mesh(new THREE.SphereGeometry(rnd(0.5,0.9),8,8), new THREE.MeshStandardMaterial({color:pick([0x2e7d32,0x357a38,0x2f8f52]),roughness:1}));
  m.position.y=0.45;
  return m;
}

function getIslandHeight(x, z, center, r, h){
  const dx = x - center.x;
  const dz = z - center.z;
  const distFromCenter = Math.sqrt(dx*dx + dz*dz);
  if(distFromCenter > r) return 0;
  // More natural height variation
  const normalized = distFromCenter / r;
  const baseHeight = h * (1.0 - normalized * normalized);
  return baseHeight;
}

function makeGrassPatch(){
  const geometry = new THREE.PlaneGeometry(rnd(2, 5), rnd(2, 5));
  const material = new THREE.MeshStandardMaterial({
    color: pick([0x4a7c4e, 0x5a8c5e, 0x3d6b40]),
    roughness: 1,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function scatterOnIsland(group, r, center, h){
  const countTrees=rndi(3,10), countPalms=rndi(1,5), countRocks=rndi(2,7), countBush=rndi(4,12);
  const countGrass=rndi(8,16);
  
  for(let i=0;i<countTrees;i++){
    const t=makeTree(); 
    const ang=Math.random()*Math.PI*2; 
    const rad=rnd(r*0.1,r*0.7);
    const x = center.x+Math.cos(ang)*rad;
    const z = center.z+Math.sin(ang)*rad;
    const y = getIslandHeight(x, z, center, r, h);
    t.position.set(x, y, z); 
    t.rotation.y=rnd(0,Math.PI*2); 
    group.add(t);
  }
  
  for(let i=0;i<countPalms;i++){
    const p=makePalm(); 
    const ang=Math.random()*Math.PI*2; 
    const rad=rnd(r*0.15,r*0.75);
    const x = center.x+Math.cos(ang)*rad;
    const z = center.z+Math.sin(ang)*rad;
    const y = getIslandHeight(x, z, center, r, h);
    p.position.set(x, y, z); 
    p.rotation.y=rnd(0,Math.PI*2); 
    group.add(p);
  }
  
  for(let i=0;i<countRocks;i++){
    const k=makeRock(); 
    const ang=Math.random()*Math.PI*2; 
    const rad=rnd(r*0.2,r*0.8);
    const x = center.x+Math.cos(ang)*rad;
    const z = center.z+Math.sin(ang)*rad;
    const y = getIslandHeight(x, z, center, r, h);
    k.position.set(x, y + 0.3, z); 
    k.rotation.y=rnd(0,Math.PI*2); 
    group.add(k);
  }
  
  for(let i=0;i<countBush;i++){
    const b=makeBush(); 
    const ang=Math.random()*Math.PI*2; 
    const rad=rnd(r*0.1,r*0.75);
    const x = center.x+Math.cos(ang)*rad;
    const z = center.z+Math.sin(ang)*rad;
    const y = getIslandHeight(x, z, center, r, h);
    b.position.set(x, y, z); 
    b.rotation.y=rnd(0,Math.PI*2); 
    group.add(b);
  }
  
  // Add grass patches
  for(let i=0;i<countGrass;i++){
    const grass = makeGrassPatch();
    const ang=Math.random()*Math.PI*2; 
    const rad=rnd(r*0.2,r*0.8);
    const x = center.x+Math.cos(ang)*rad;
    const z = center.z+Math.sin(ang)*rad;
    const y = getIslandHeight(x, z, center, r, h);
    grass.position.set(x, y + 0.2, z);
    grass.rotation.z = rnd(0, Math.PI*2);
    group.add(grass);
  }
  
  // Wrecks on beach area
  if(Math.random()<0.45){
    const w=makeWreck(); 
    const ang=Math.random()*Math.PI*2; 
    const rad=r*0.9;
    const x = center.x+Math.cos(ang)*rad;
    const z = center.z+Math.sin(ang)*rad;
    w.position.set(x, 0.3, z); 
    w.rotation.y=rnd(0,Math.PI*2); 
    group.add(w);
  }
}

export function islandAt(scene,x,z,r=120,h=14){
  const seg=48;
  // More varied island shapes
  const shapeVariation = Math.random();
  const topRadius = r * (0.7 + Math.random() * 0.3);
  const g=new THREE.CylinderGeometry(topRadius, r, h, seg, 3, false);
  const pos=g.attributes.position;
  
  // Add unique deformations for each island
  const freq1 = 2 + Math.floor(Math.random() * 4);
  const freq2 = 3 + Math.floor(Math.random() * 5);
  const freq3 = 5 + Math.floor(Math.random() * 4);
  
  for(let i=0;i<pos.count;i++){
    const px=pos.getX(i), py=pos.getY(i), pz=pos.getZ(i);
    const ang=Math.atan2(pz,px), rad=Math.hypot(px,pz);
    
    // More varied deformation
    const k=(Math.sin(ang*freq1)*0.08 + Math.sin(ang*freq2)*0.05 + Math.sin(ang*freq3)*0.03) * (1.0 + shapeVariation);
    const nr=rad*(1.0+k);
    
    // Add some vertical variation for more organic look
    const heightFactor = (py + h/2) / h;
    const verticalNoise = Math.sin(ang * freq1) * Math.cos(ang * freq2) * 0.3 * heightFactor;
    const ny = py + verticalNoise;
    
    pos.setXYZ(i, Math.cos(ang)*nr, ny, Math.sin(ang)*nr);
  }
  g.computeVertexNormals();
  
  const island=new THREE.Group();
  // Some islands with grass, some with sand
  const hasGrass = Math.random() < 0.4; // 40% chance of grass island
  const surfaceMat = new THREE.MeshStandardMaterial({
    map: hasGrass ? grassTex() : sandTex(), 
    roughness:1, 
    metalness:0
  });
  const surface=new THREE.Mesh(g, surfaceMat);
  surface.castShadow=true; surface.receiveShadow=true;
  surface.position.set(x,h/2,z);
  surface.rotation.y=Math.random()*Math.PI*2;
  island.add(surface);
  
  const ring=new THREE.Mesh(new THREE.RingGeometry(r*0.95, r*1.18, 64), new THREE.MeshBasicMaterial({map:shoreTex(), transparent:true, depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.set(x,0.15,z);
  island.add(ring);
  
  scatterOnIsland(island,r,{x,z},h);
  scene.add(island);
  island.userData.hasGrass = hasGrass;
  return island;
}

export function spawnIslands(scene, count=6, area=2500){
  const made=[];
  const sizes = [
    {min: 60, max: 90},    // Small
    {min: 90, max: 130},   // Medium
    {min: 130, max: 180},  // Large
  ];
  
  for(let i=0;i<count;i++){
    const sizeType = pick(sizes);
    const r=rnd(sizeType.min, sizeType.max);
    const h=rnd(8, 22); // More varied heights
    const x=rnd(-area,area), z=rnd(-area,area);
    const island = islandAt(scene,x,z,r,h);
    made.push({obj: island, x, z, r});
  }
  return made;
}

export function addMapBorder(scene, size){
  const borderMat = new THREE.LineBasicMaterial({
    color: 0xff0000, 
    linewidth: 2,
    transparent: true,
    opacity: 0.15
  });
  const points = [
    new THREE.Vector3(-size, 0, -size),
    new THREE.Vector3(size, 0, -size),
    new THREE.Vector3(size, 0, size),
    new THREE.Vector3(-size, 0, size),
    new THREE.Vector3(-size, 0, -size)
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, borderMat);
  line.position.y = 1;
  line.userData.isMapBorder = true;
  scene.add(line);
  return line;
}

export function updateMapBorderOpacity(scene, cameraPos, mapSize){
  for(const child of scene.children){
    if(child.userData.isMapBorder){
      const distX = Math.max(0, Math.abs(cameraPos.x) - mapSize * 0.7);
      const distZ = Math.max(0, Math.abs(cameraPos.z) - mapSize * 0.7);
      const dist = Math.sqrt(distX*distX + distZ*distZ);
      const maxDist = mapSize * 0.3;
      const opacity = Math.min(0.6, Math.max(0.01, 1.0 - dist / maxDist));
      child.material.opacity = opacity;
    }
  }
}
