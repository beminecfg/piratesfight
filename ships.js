import {THREE_NS as THREE} from './world.js';

function bend(geom, amp){
  geom.computeBoundingBox();
  const a=geom.attributes.position, min=geom.boundingBox.min.x, max=geom.boundingBox.max.x;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i), y=a.getY(i), z=a.getZ(i);
    const u=((x-min)/(max-min))-0.5;
    const w=Math.sin(u*Math.PI)*amp;
    a.setXYZ(i,x,y,z+w);
  }
  a.needsUpdate=true;
  geom.computeVertexNormals();
  return geom;
}
function yard(len,th=0.24,color=0x222222){
  return new THREE.Mesh(new THREE.CylinderGeometry(th,th,len,10), new THREE.MeshStandardMaterial({color, metalness:0.6, roughness:0.4}));
}
function squareSail(w,h,amp){
  const pg=new THREE.PlaneGeometry(w,h,14,14);
  bend(pg,amp);
  const m=new THREE.Mesh(pg,new THREE.MeshStandardMaterial({color:0xF3F3F0, side:THREE.DoubleSide, roughness:0.96, metalness:0.03}));
  m.castShadow=true;
  return m;
}
function triSail(w,h){
  const g=new THREE.BufferGeometry();
  const v=new Float32Array([-w*0.5,0,0, w*0.5,0,0, 0,h,0]);
  g.setAttribute('position',new THREE.BufferAttribute(v,3));
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xF3F3F0, side:THREE.DoubleSide, roughness:0.96, metalness:0.03}));
  m.castShadow=true;
  return m;
}

function hullGalleon(){
  const g=new THREE.Group();
  const geom=new THREE.BoxGeometry(12.5,6.0,38.0,12,2,18);
  const a=geom.attributes.position;
  let zmin=1e9,zmax=-1e9; for(let i=0;i<a.count;i++){const z=a.getZ(i); if(z<zmin)zmin=z; if(z>zmax)zmax=z;}
  const L=zmax-zmin;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    const t=(z-zmin)/L;
    let beam=0.58+0.70*Math.sin(Math.PI*t);
    if(t<0.12) beam*=0.45+0.9*(t/0.12);
    if(t>0.88) beam*=0.75+0.25*((1-t)/0.12);
    const nx=x*beam;
    const sheer=0.35*Math.cos((t-0.1)*Math.PI);
    const ny=y+sheer+0.25*(t-0.5);
    let nz=z; if(t>0.98) nz=zmin+0.98*L;
    a.setXYZ(i,nx,ny,nz);
  }
  geom.computeVertexNormals();
  const hull=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0x3f2a1a, roughness:0.9, metalness:0.08}));
  hull.castShadow=hull.receiveShadow=true;
  hull.position.y=2.6;
  g.add(hull);
  const stripeMat=new THREE.MeshStandardMaterial({color:0xf2c232, roughness:0.5, metalness:0.2, side:THREE.DoubleSide});
  const stripeY=1.4, offX=6.1;
  const stripeL=new THREE.Mesh(new THREE.PlaneGeometry(38.2,0.36),stripeMat);
  stripeL.position.set(offX,stripeY,0); stripeL.rotation.y=Math.PI/2; g.add(stripeL);
  const stripeR=stripeL.clone(); stripeR.position.x=-offX; g.add(stripeR);
  const quarter=new THREE.Mesh(new THREE.BoxGeometry(9.0,2.0,10.5), new THREE.MeshStandardMaterial({color:0x7a5a33}));
  quarter.position.set(0,5.2,9.6); quarter.castShadow=true; g.add(quarter);
  const forecastle=new THREE.Mesh(new THREE.BoxGeometry(8.0,1.4,6.8), new THREE.MeshStandardMaterial({color:0x7a5a33}));
  forecastle.position.set(0,4.6,-10.5); forecastle.castShadow=true; g.add(forecastle);
  return g;
}
function rigGalleon(){
  const g=new THREE.Group();
  const mastMat=new THREE.MeshStandardMaterial({color:0xdddddd});
  const fore=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,22,14),mastMat); fore.position.set(-1.2,11,3.5); g.add(fore);
  const main=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.56,24,14),mastMat); main.position.set(1.2,12,-4.5); g.add(main);
  const mizzen=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,18,12),mastMat); mizzen.position.set(0.2,9.2,13.0); g.add(mizzen);
  const bowsprit=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,9,10),mastMat); bowsprit.rotation.z=-0.22; bowsprit.rotation.y=Math.PI/2; bowsprit.position.set(0,4.6,-20.2); g.add(bowsprit);
  const yaw=0.22;
  const yf1=yard(16); yf1.rotation.set(0,Math.PI/2+yaw,Math.PI/2); yf1.position.set(-1.2,11,3.5); g.add(yf1);
  const yf2=yard(12.5,0.22); yf2.rotation.set(0,Math.PI/2+yaw,Math.PI/2); yf2.position.set(-1.2,15,3.5); g.add(yf2);
  const ym1=yard(18); ym1.rotation.set(0,Math.PI/2+yaw,Math.PI/2); ym1.position.set(1.2,13.4,-4.5); g.add(ym1);
  const ym2=yard(14,0.24); ym2.rotation.set(0,Math.PI/2+yaw,Math.PI/2); ym2.position.set(1.2,17.4,-4.5); g.add(ym2);
  const sf1=squareSail(15.4,12.4,0.9); sf1.position.set(-1.2,11,3.5); sf1.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sf1);
  const sf2=squareSail(12.0,10.6,0.85); sf2.position.set(-1.2,15,3.5); sf2.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sf2);
  const sm1=squareSail(17.2,13.0,0.95); sm1.position.set(1.2,13.4,-4.5); sm1.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sm1);
  const sm2=squareSail(13.2,11.2,0.9); sm2.position.set(1.2,17.4,-4.5); sm2.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sm2);
  const spanker=triSail(8.0,9.2); spanker.position.set(0.2,10.6,13.0); spanker.rotation.y=Math.PI/2-0.4+yaw*0.5; g.add(spanker);
  const jib=triSail(7.0,6.5); jib.position.set(0.6,6.2,-17.0); jib.rotation.y=Math.PI/2.1+yaw*0.6; g.add(jib);
  return g;
}
function makeGalleon(){ const g=new THREE.Group(); g.add(hullGalleon()); g.add(rigGalleon()); return g; }

function hullBrig(){
  const g=new THREE.Group();
  const geom=new THREE.BoxGeometry(9.0,4.0,28.8,10,2,16);
  const a=geom.attributes.position;
  let zmin=1e9,zmax=-1e9; for(let i=0;i<a.count;i++){const z=a.getZ(i); if(z<zmin)zmin=z; if(z>zmax)zmax=z;}
  const L=zmax-zmin;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i), y=a.getY(i), z=a.getZ(i);
    const t=(z-zmin)/L;
    let beam=0.60+0.56*Math.sin(Math.PI*t);
    if(t<0.16) beam*=0.50+0.9*(t/0.16);
    if(t>0.88) beam*=0.80+0.20*((1-t)/0.12);
    const nx=x*beam;
    const ny=y+0.18*Math.cos((t-0.1)*Math.PI);
    let nz=z; if(t>0.97) nz=zmin+0.97*L;
    a.setXYZ(i,nx,ny,nz);
  }
  geom.computeVertexNormals();
  const hull=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0x7a4f2b, roughness:0.85, metalness:0.08}));
  hull.castShadow=hull.receiveShadow=true; hull.position.y=2.0; g.add(hull);
  const stripeMat=new THREE.MeshStandardMaterial({color:0xf2c232, roughness:0.5, metalness:0.2, side:THREE.DoubleSide});
  const stripeL=new THREE.Mesh(new THREE.PlaneGeometry(28.8,0.34),stripeMat); stripeL.position.set(4.55,1.2,0); stripeL.rotation.y=Math.PI/2; g.add(stripeL);
  const stripeR=stripeL.clone(); stripeR.position.x=-4.55; g.add(stripeR);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(8.2,0.9,21.6),new THREE.MeshStandardMaterial({color:0x8b6a3f}));
  deck.position.set(0,3.1,-0.4); deck.castShadow=true; g.add(deck);
  return g;
}
function rigBrig(){
  const g=new THREE.Group();
  const mastMat=new THREE.MeshStandardMaterial({color:0xdddddd});
  const fore=new THREE.Mesh(new THREE.CylinderGeometry(0.40,0.40,17.0,12),mastMat); fore.position.set(-0.9,8.6,4.0); g.add(fore);
  const main=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.46,19.0,12),mastMat); main.position.set(0.9,9.2,-4.0); g.add(main);
  const mizzen=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,13.0,10),mastMat); mizzen.position.set(0.2,6.6,11.6); g.add(mizzen);
  const bowsprit=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,6.8,8),mastMat); bowsprit.rotation.z=-0.22; bowsprit.rotation.y=Math.PI/2; bowsprit.position.set(0,3.8,-15.4); g.add(bowsprit);
  const yaw=0.22;
  const yF=yard(12.0); yF.rotation.set(0,Math.PI/2+yaw,Math.PI/2); yF.position.set(-0.9,8.6,4.0); g.add(yF);
  const yM=yard(11.2); yM.rotation.set(0,Math.PI/2+yaw,Math.PI/2); yM.position.set(0.9,9.2,-4.0); g.add(yM);
  const yB=yard(8.2,0.22); yB.rotation.set(0,Math.PI/2+yaw,Math.PI/2); yB.position.set(0.2,6.6,11.6); g.add(yB);
  const sF=squareSail(11.6,9.8,0.8); sF.position.set(-0.9,8.6,4.0); sF.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sF);
  const sM=squareSail(10.8,9.8,0.8); sM.position.set(0.9,9.2,-4.0); sM.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sM);
  const sSpanker=triSail(6.2,6.6); sSpanker.position.set(0.2,7.1,11.6); sSpanker.rotation.y=Math.PI/2-0.35+yaw*0.5; g.add(sSpanker);
  const sJib=triSail(5.2,5.0); sJib.position.set(0.5,5.0,-13.2); sJib.rotation.y=Math.PI/2.1+yaw*0.6; g.add(sJib);
  return g;
}
function makeBrig(){ const g=new THREE.Group(); g.add(hullBrig()); g.add(rigBrig()); return g; }

function makeLugger(){
  const g=new THREE.Group();
  const hull=new THREE.Mesh(new THREE.BoxGeometry(7.8,3.4,22), new THREE.MeshStandardMaterial({color:0x6c4a2e, roughness:0.9}));
  hull.position.y=1.6; hull.castShadow=hull.receiveShadow=true; g.add(hull);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,14,12),new THREE.MeshStandardMaterial({color:0xdddddd}));
  mast.position.set(0.6,7.2,-1.2); g.add(mast);
  const fore=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,12,12),new THREE.MeshStandardMaterial({color:0xdddddd}));
  fore.position.set(-0.6,6.4,2.6); g.add(fore);
  const yaw=0.2;
  const yard1=yard(9.8); yard1.rotation.set(0,Math.PI/2+yaw,Math.PI/2); yard1.position.set(-0.6,6.4,2.6); g.add(yard1);
  const sail1=squareSail(9.2,8.0,0.7); sail1.position.set(-0.6,6.4,2.6); sail1.rotation.set(0,Math.PI/2+yaw,Math.PI/2); g.add(sail1);
  const sp=triSail(6.0,6.0); sp.position.set(0.6,7.2,-1.2); sp.rotation.y=Math.PI/2-0.35+yaw*0.5; g.add(sp);
  return g;
}

export const SHIP_KINDS=["galleon","brig","lugger"];
export function makeShip(kind="galleon"){
  if(kind==="galleon") return makeGalleon();
  if(kind==="brig") return makeBrig();
  return makeLugger();
}
export function forwardVec(a){return new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), a)}
export function rightVec(a){return new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), a)}
export function updateShip(s, dt, input, cfg){
  const {turnRate,accelF,maxSpeed,waterDrag}=cfg;
  
  // Initialize animation state if not exists
  if(!s.animState){
    s.animState = {
      roll: 0,
      pitch: 0,
      waveTime: Math.random() * Math.PI * 2
    };
  }
  
  let turnDirection = 0; // -1 = left, 1 = right
  
  if(input){
    if(input.left){ s.ang+=turnRate*dt; turnDirection = -1; }
    if(input.right){ s.ang-=turnRate*dt; turnDirection = 1; }
    const tmp=new THREE.Vector3(0,0,0);
    if(input.forward) tmp.z=-1;
    if(input.brake) s.vel.multiplyScalar(0.93);
    tmp.applyAxisAngle(new THREE.Vector3(0,1,0),s.ang);
    tmp.multiplyScalar(accelF*dt);
    s.vel.add(tmp);
    const up=new THREE.Vector3(0,1,0);
    const fwd=new THREE.Vector3(0,0,-1).applyAxisAngle(up,s.ang).normalize();
    const right=fwd.clone().cross(up).normalize();
    const vF=fwd.clone().multiplyScalar(s.vel.dot(fwd));
    const vR=right.clone().multiplyScalar(s.vel.dot(right));
    const sideDamp=Math.exp(-6.0*dt);
    const fwdDamp=Math.exp(-0.8*dt);
    s.vel.copy(vF.multiplyScalar(fwdDamp)).add(vR.multiplyScalar(sideDamp));
  }
  const sp=s.vel.length();
  if(sp>maxSpeed) s.vel.multiplyScalar(maxSpeed/sp);
  s.vel.multiplyScalar(waterDrag);
  s.pos.addScaledVector(s.vel,dt);
  
  // Get ship type for animation parameters
  const shipType = s.obj.userData.shipType || 'galleon';
  let rollIntensity = 0.10; // Galleon - least roll (heavy)
  let pitchIntensity = 0.12; // Galleon - most pitch (large)
  
  if(shipType === 'brig'){
    rollIntensity = 0.18; // Medium-high roll
    pitchIntensity = 0.09; // Medium pitch
  } else if(shipType === 'lugger'){
    rollIntensity = 0.25; // Most roll (light, agile)
    pitchIntensity = 0.06; // Least pitch (small)
  }
  
  // Roll animation (leaning during turns)
  const targetRoll = turnDirection * rollIntensity * Math.min(sp / 100, 1);
  s.animState.roll += (targetRoll - s.animState.roll) * 5 * dt;
  
  // Wave pitch animation (bobbing)
  s.animState.waveTime += dt * 1.2;
  const targetPitch = Math.sin(s.animState.waveTime) * pitchIntensity;
  s.animState.pitch = targetPitch;
  
  // Apply animations
  // Ensure ship stays on water surface (y = 0)
  s.obj.position.set(s.pos.x, 0, s.pos.z);
  s.pos.y = 0; // Force position to water level
  s.obj.rotation.y = s.ang;
  s.obj.rotation.z = s.animState.roll;
  s.obj.rotation.x = s.animState.pitch;
}
