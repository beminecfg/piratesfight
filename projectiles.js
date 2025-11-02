import {THREE_NS as THREE} from './world.js';
export const shots = [];
export const splashes = [];
export const explosions = [];
const gravity = 60;
export const muzzleSpeed = 180;
export const reloadTime = 1.2;
export function fireBroadside(ctx){
  const {aimPoint, player, forwardVec, rightVec} = ctx;
  const dir2d = aimPoint.clone().setY(0).sub(player.pos.clone().setY(0));
  if(dir2d.length()<0.001) return null;
  const f = forwardVec(player.ang);
  const r = rightVec(player.ang);
  const sideSign = Math.sign(f.clone().cross(dir2d.clone().normalize()).y);
  const side = sideSign>=0 ? "left" : "right"; // FIXED: inverted logic
  if(side==="left" && ctx.cd.left>0) return null;
  if(side==="right" && ctx.cd.right>0) return null;
  const base = player.pos.clone().add(r.clone().multiplyScalar(side==="right"?6:-6));
  const spread = (Math.random()-0.5)*0.08; // Small spread for accuracy
  const aimDir = dir2d.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0), spread);
  
  // Calculate proper ballistic trajectory
  const startY = 5.5;
  const targetY = 4.5; // Hull height
  const horizontalDist = dir2d.length();
  const horizontalSpeed = muzzleSpeed;
  const timeToTarget = horizontalDist / horizontalSpeed;
  
  // Calculate initial vertical velocity to reach target hull
  // Using: targetY = startY + vy*t - 0.5*g*t^2
  // Solve for vy: vy = (targetY - startY + 0.5*g*t^2) / t
  const verticalVel = (targetY - startY + 0.5 * gravity * timeToTarget * timeToTarget) / timeToTarget;
  
  const vel = aimDir.clone().multiplyScalar(horizontalSpeed);
  vel.y = verticalVel + (Math.random() - 0.5) * 2; // Small random variation (reduced)
  
  const shot = {p:new THREE.Vector3(base.x,startY,base.z), v:vel, mesh:null, team: player.team, firedTime: 0};
  shots.push(shot);
  if(side==="left") ctx.cd.left=reloadTime; else ctx.cd.right=reloadTime;
  return shot;
}

export function fireEnemyBroadside(enemy, target, side, forwardVec, rightVec){
  const f = forwardVec(enemy.ang);
  const r = rightVec(enemy.ang);
  
  // Predict target position
  const timeToTarget = enemy.pos.distanceTo(target.pos) / muzzleSpeed;
  const predictedPos = target.pos.clone().add(target.vel.clone().multiplyScalar(timeToTarget * 1.2));
  
  const dir2d = predictedPos.clone().setY(0).sub(enemy.pos.clone().setY(0));
  if(dir2d.length()<0.001) return null;
  
  const base = enemy.pos.clone().add(r.clone().multiplyScalar(side==="right"?6:-6));
  const spread = (Math.random()-0.5)*0.15;
  const aimDir = dir2d.clone().normalize().applyAxisAngle(new THREE.Vector3(0,1,0), spread);
  
  // Calculate ballistic trajectory
  const startY = 5.5;
  const targetY = 4.5;
  const horizontalDist = dir2d.length();
  const horizontalSpeed = muzzleSpeed * 0.95; // Slightly slower for enemies
  const ttt = horizontalDist / horizontalSpeed;
  const verticalVel = (targetY - startY + 0.5 * gravity * ttt * ttt) / ttt;
  
  const vel = aimDir.clone().multiplyScalar(horizontalSpeed);
  vel.y = verticalVel + (Math.random() - 0.5) * 5;
  
  const shot = {p:new THREE.Vector3(base.x,startY,base.z), v:vel, mesh:null, team: enemy.team, firedTime: 0};
  shots.push(shot);
  return shot;
}
export function createExplosion(x, y, z){
  explosions.push({x, y, z, r:2, a:1, t:0});
}

export function removeShot(i, scene){
  const s = shots[i];
  if(s.mesh){ 
    scene.remove(s.mesh); 
    s.mesh.geometry.dispose(); 
    s.mesh.material.dispose(); 
  }
  if(s.trail){
    s.trail.forEach(trailMesh => {
      scene.remove(trailMesh);
      trailMesh.geometry.dispose();
      trailMesh.material.dispose();
    });
  }
  if(s.shadow){
    scene.remove(s.shadow);
    s.shadow.geometry.dispose();
    s.shadow.material.dispose();
  }
  shots.splice(i,1);
}

export function updateShots(dt, scene){
  for(let i=shots.length-1;i>=0;i--){
    const s=shots[i];
    s.firedTime += dt;
    s.v.y -= gravity*dt;
    s.p.addScaledVector(s.v, dt);
    if(s.p.y<=0){
      splashes.push({x:s.p.x, z:s.p.z, r:4, a:1}); // Smaller splash
      removeShot(i, scene);
    }
  }
  for(let i=splashes.length-1;i>=0;i--){
    const sp=splashes[i];
    sp.r += 60*dt;
    sp.a -= 0.8*dt;
    if(sp.a<=0) splashes.splice(i,1);
  }
  for(let i=explosions.length-1;i>=0;i--){
    const ex=explosions[i];
    ex.t += dt;
    ex.r += 40*dt;
    ex.a -= 1.5*dt;
    if(ex.a<=0) explosions.splice(i,1);
  }
}
const projGeo = new THREE.SphereGeometry(0.8,12,12);
const projMat = new THREE.MeshStandardMaterial({color:0x333333, metalness:0.7, roughness:0.4});

export function renderProjectiles(scene){
  for(const s of shots){
    if(!s.mesh){ 
      s.mesh = new THREE.Mesh(projGeo, projMat); 
      scene.add(s.mesh);
      
      // Create trajectory trail
      s.trail = [];
      for(let i=0; i<8; i++){
        const trailGeo = new THREE.SphereGeometry(0.3 - i * 0.03, 6, 6);
        const trailMat = new THREE.MeshBasicMaterial({
          color: 0xff4444,
          transparent: true,
          opacity: 0.6 - i * 0.07
        });
        const trailMesh = new THREE.Mesh(trailGeo, trailMat);
        scene.add(trailMesh);
        s.trail.push(trailMesh);
      }
      
      // Create shadow on water - subtle
      const shadowGeo = new THREE.CircleGeometry(1.2, 16);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      });
      s.shadow = new THREE.Mesh(shadowGeo, shadowMat);
      s.shadow.rotation.x = -Math.PI/2;
      s.shadow.position.y = 0.2;
      scene.add(s.shadow);
    }
    s.mesh.position.set(s.p.x, Math.max(0.5,s.p.y), s.p.z);
    
    // Update shadow position on water
    if(s.shadow){
      s.shadow.position.x = s.p.x;
      s.shadow.position.z = s.p.z;
      // Fade shadow based on height - very subtle
      const heightFactor = Math.min(1, s.p.y / 30);
      s.shadow.material.opacity = 0.08 + heightFactor * 0.12;
      s.shadow.scale.setScalar(0.8 + heightFactor * 0.4);
    }
    
    // Update trail positions
    if(s.trail){
      const vel = s.v.clone().normalize();
      for(let i=0; i<s.trail.length; i++){
        const dist = (i + 1) * 1.5;
        const trailPos = s.p.clone().sub(vel.clone().multiplyScalar(dist));
        s.trail[i].position.set(trailPos.x, Math.max(0.3, trailPos.y), trailPos.z);
      }
    }
  }
  
  // Render explosions as particle systems
  for(const ex of explosions){
    if(!ex.mesh){
      const particleCount = 30;
      const positions = new Float32Array(particleCount * 3);
      for(let i=0; i<particleCount; i++){
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 3;
        const height = Math.random() * 4;
        positions[i*3] = Math.cos(angle) * dist;
        positions[i*3+1] = height;
        positions[i*3+2] = Math.sin(angle) * dist;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 2.5,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      ex.mesh = new THREE.Points(geo, mat);
      ex.mesh.position.set(ex.x, ex.y, ex.z);
      scene.add(ex.mesh);
    }
    ex.mesh.material.opacity = ex.a;
    const s = 1 + ex.t * 2;
    ex.mesh.scale.set(s, s, s);
  }
  
  // Clean up removed explosions
  for(let i=explosions.length; i<scene.children.length; i++){
    const child = scene.children[i];
    if(child.isPoints && !explosions.find(e => e.mesh === child)){
      scene.remove(child);
      child.geometry.dispose();
      child.material.dispose();
    }
  }
}
