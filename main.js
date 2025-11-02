import {makeRenderer, makeScene, makeCamera, addWater, islandAt, spawnIslands, addMapBorder, updateMapBorderOpacity, createShipWaterEffects, updateShipWaterEffects, THREE_NS as THREE} from './world.js';
import { makeShip, forwardVec, rightVec, updateShip, SHIP_KINDS } from './ships.js?v=galleon-switch';
import {shots, splashes, fireBroadside, updateShots, renderProjectiles, reloadTime, createExplosion, removeShot, fireEnemyBroadside} from './projectiles.js';
import {drawHUD} from './hud.js';
import {makeControls} from './controls.js';

let modelKind = "galleon";

function buildShip(kind){
  const obj = makeShip(kind);
  obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  obj.userData.shipType = kind; // Store ship type
  return obj;
}

const canvas = document.getElementById("game") || (()=>{const c=document.createElement("canvas");c.id="game";document.body.appendChild(c);return c;})();
const hud = document.getElementById("hud") || (()=>{const c=document.createElement("canvas");c.id="hud";document.body.appendChild(c);c.style.position='fixed';c.style.left='0';c.style.top='0';c.style.pointerEvents='none';return c;})();
const h2d = hud.getContext("2d");

const renderer = makeRenderer(canvas);
const scene = makeScene();
const camera = makeCamera();
addWater(scene);

// Spawn random islands
const mapSize = 2000;
const islands = spawnIslands(scene, 8, mapSize);

// Add red border around map perimeter
addMapBorder(scene, mapSize);

const player = {obj: buildShip(modelKind), pos: new THREE.Vector3(), vel: new THREE.Vector3(), ang:0, team:"ally", hp:100, maxHp:100, sinking: false, sinkTime: 0};
scene.add(player.obj);
player.waterEffects = createShipWaterEffects(player.obj, scene);

let hitIndicator = null; // {side: 'left'/'right', opacity: 1, life: 0.6, attackerPos: Vector3}
// Make these global for touch controls access
window.freeCameraMode = false;
window.freeCameraPos = new THREE.Vector3();
window.freeCameraYaw = 0;
window.freeCameraPitch = 60;
window.mapSize = mapSize;

let freeCameraMode = false;
let freeCameraPos = window.freeCameraPos;
let freeCameraYaw = 0;
let freeCameraPitch = 60;

const enemies=[];
for(let i=0;i<3;i++){
  const kind = SHIP_KINDS[i%SHIP_KINDS.length];
  const e={
    obj:buildShip(kind), 
    pos:new THREE.Vector3((i-1)*180+160,0,-300-i*140), 
    vel:new THREE.Vector3(), 
    ang:0, 
    team:"enemy", 
    hp:100, 
    maxHp:100,
    cd: {left: 0, right: 0},
    ai: {
      state: 'approach', // approach, broadside, evade, circle
      stateTime: 0,
      targetSide: Math.random() > 0.5 ? 'left' : 'right',
      lastDodge: 0,
      preferredDistance: 100 + Math.random() * 80
    },
    sinking: false,
    sinkTime: 0
  };
  scene.add(e.obj);
  // Don't create water effects with reload arcs for enemies
  const enemyEffects = {
    bowWaves: [],
    wake: [],
    reflection: null,
    reloadArcs: {left: null, right: null} // No reload arcs for enemies
  };
  
  // Create water effects manually without reload arcs
  const ship = e.obj;
  
  // Bow waves
  for(let j=0; j<6; j++){
    const curve = new THREE.EllipseCurve(0, 0, 2, 3, 0, Math.PI, false, 0);
    const points = curve.getPoints(24);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      linewidth: 3
    });
    const wave = new THREE.Line(geo, mat);
    wave.rotation.x = -Math.PI/2;
    wave.visible = false;
    scene.add(wave);
    enemyEffects.bowWaves.push({mesh: wave, life: 0, offset: j * 0.12});
  }
  
  // Wake trails
  for(let j=0; j<10; j++){
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(1, 3, 1.5, 6);
    shape.lineTo(-1.5, 6);
    shape.quadraticCurveTo(-1, 3, 0, 0);
    
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe0f0f8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const trail = new THREE.Mesh(geo, mat);
    trail.rotation.x = -Math.PI/2;
    trail.visible = false;
    scene.add(trail);
    enemyEffects.wake.push({mesh: trail, life: 0, side: j % 2 === 0 ? -1 : 1, index: Math.floor(j/2)});
  }
  
  // Reflection
  const reflection = ship.clone();
  reflection.scale.set(1, -0.4, 1);
  reflection.position.y = -0.8;
  reflection.traverse(child => {
    if(child.isMesh && child.material){
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.2;
      child.material.color = new THREE.Color(0x2a4d6d);
      child.material.depthWrite = false;
    }
  });
  scene.add(reflection);
  enemyEffects.reflection = reflection;
  
  e.waterEffects = enemyEffects;
  enemies.push(e);
}

const cfg = {maxSpeed:255, accelF:140, brakeF:45, turnRate:1.7, waterDrag:0.985};
const planeWater = new THREE.Plane(new THREE.Vector3(0,1,0),0);
const aimPoint = new THREE.Vector3();
const cd = {left:0,right:0};

// Camera zoom - make it global for mobile pinch
window.cameraDistance = 280; // Initial camera distance (increased for better view)
const minCameraDistance = 100;
const maxCameraDistance = 400;

// Collision detection helpers
function circleCollision(x1, z1, r1, x2, z2, r2){
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.sqrt(dx*dx + dz*dz);
  return dist < (r1 + r2);
}

function handleShipIslandCollision(ship, island){
  const dx = ship.pos.x - island.x;
  const dz = ship.pos.z - island.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  const shipRadius = 12;
  
  if(dist < island.r + shipRadius){
    // Push ship away from island
    const pushDist = (island.r + shipRadius) - dist;
    const nx = dx / dist;
    const nz = dz / dist;
    ship.pos.x += nx * pushDist;
    ship.pos.z += nz * pushDist;
    // Dampen velocity
    ship.vel.multiplyScalar(0.5);
  }
}

function checkCollisions(){
  const shipRadius = 12;
  const cannonballRadius = 0.6;
  
  // Check ship-island collisions
  for(const ship of [player, ...enemies]){
    // Skip collision for sinking ships
    if(ship.sinking) continue;
    
    for(const island of islands){
      handleShipIslandCollision(ship, island);
    }
    
    // Keep ships within map bounds
    const boundary = mapSize - 50;
    if(ship.pos.x < -boundary) ship.pos.x = -boundary;
    if(ship.pos.x > boundary) ship.pos.x = boundary;
    if(ship.pos.z < -boundary) ship.pos.z = -boundary;
    if(ship.pos.z > boundary) ship.pos.z = boundary;
  }
  
  // Check cannonball collisions
  for(let i = shots.length - 1; i >= 0; i--){
    const shot = shots[i];
    let hitSomething = false;
    
    // Check cannonball-ship collisions
    for(const ship of [player, ...enemies]){
      // Don't hit the ship that fired it (for at least 0.3 seconds)
      if(shot.team === ship.team && shot.firedTime < 0.3) continue;
      // Don't hit sinking ships
      if(ship.sinking) continue;
      
      if(circleCollision(shot.p.x, shot.p.z, cannonballRadius, ship.pos.x, ship.pos.z, shipRadius)){
        // Hit a ship! Snap cannonball to hull height
        const hullHeight = 4.5; // Ship hull center height
        shot.p.y = hullHeight;
        shot.v.set(0, 0, 0); // Stop movement
        
        ship.hp -= 10;
        
        // Show hit indicator for player only
        if(ship === player){
          // Find which enemy fired this shot
          let attackerPos = shot.p.clone();
          for(const enemy of enemies){
            if(shot.team === enemy.team){
              attackerPos = enemy.pos.clone();
              break;
            }
          }
          
          const shipRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ship.ang);
          const toHit = new THREE.Vector3(shot.p.x - ship.pos.x, 0, shot.p.z - ship.pos.z);
          const hitSide = shipRight.dot(toHit) > 0 ? 'right' : 'left';
          hitIndicator = {side: hitSide, opacity: 1.0, life: 0.6, attackerPos};
        }
        
        createExplosion(shot.p.x, hullHeight, shot.p.z);
        removeShot(i, scene);
        hitSomething = true;
        
        // Check if ship is destroyed
        if(ship.hp <= 0){
          ship.hp = 0;
          if(!ship.sinking){
            ship.sinking = true;
            ship.sinkTime = 0;
          }
        }
        break;
      }
    }
    
    if(hitSomething) continue;
    
    // Check cannonball-island collisions
    for(const island of islands){
      if(shot.p.y < 20 && circleCollision(shot.p.x, shot.p.z, cannonballRadius, island.x, island.z, island.r)){
        // Hit an island
        createExplosion(shot.p.x, Math.max(0.5, shot.p.y), shot.p.z);
        removeShot(i, scene);
        break;
      }
    }
  }
}

function fire(){
  return fireBroadside({aimPoint, player, forwardVec, rightVec, cd});
}

const controls = makeControls(camera, planeWater, fire, aimPoint);

// Free camera controls for spectator mode
let spectatorDrag = false;
let spectatorRotate = false;
let spectatorPrevMouse = {x: 0, y: 0};

addEventListener('mouseup', (e) => {
  if(e.button === 0){
    spectatorDrag = false;
  }
  if(e.button === 1){
    spectatorRotate = false;
  }
});

addEventListener('wheel', (e) => {
  if(freeCameraMode){
    // Zoom in free camera mode
    window.cameraDistance = Math.min(maxCameraDistance, Math.max(minCameraDistance, window.cameraDistance + e.deltaY * 0.3));
    e.preventDefault();
  } else {
    // Zoom in normal mode
    window.cameraDistance = Math.min(maxCameraDistance, Math.max(minCameraDistance, window.cameraDistance + e.deltaY * 0.3));
  }
}, {passive: false});

function cleanupWaterEffects(effects, scene){
  if(!effects) return;
  if(effects.reflection) scene.remove(effects.reflection);
  effects.bowWaves.forEach(w => scene.remove(w.mesh));
  effects.wake.forEach(w => scene.remove(w.mesh));
  if(effects.reloadArcs.left) scene.remove(effects.reloadArcs.left.group);
  if(effects.reloadArcs.right) scene.remove(effects.reloadArcs.right.group);
  if(effects.aimLine) scene.remove(effects.aimLine.group);
}

// Handle respawn button clicks
hud.style.pointerEvents = 'auto';
let wasSpectatorDrag = false;

addEventListener('mousedown', (e) => {
  if(freeCameraMode){
    if(e.button === 0){
      wasSpectatorDrag = false;
      spectatorDrag = true;
      spectatorPrevMouse.x = e.clientX;
      spectatorPrevMouse.y = e.clientY;
    }
    if(e.button === 1){
      spectatorRotate = true;
      spectatorPrevMouse.x = e.clientX;
      spectatorPrevMouse.y = e.clientY;
      e.preventDefault();
    }
  }
});

addEventListener('mousemove', (e) => {
  if(freeCameraMode){
    if(spectatorDrag){
      const dx = e.clientX - spectatorPrevMouse.x;
      const dy = e.clientY - spectatorPrevMouse.y;
      
      if(Math.abs(dx) > 3 || Math.abs(dy) > 3){
        wasSpectatorDrag = true;
      }
      
      // Move camera position smoothly and slowly
      const moveSpeed = 0.8; // Slower movement
      const camRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), freeCameraYaw);
      const camFwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), freeCameraYaw);
      
      freeCameraPos.add(camRight.multiplyScalar(-dx * moveSpeed));
      freeCameraPos.add(camFwd.multiplyScalar(dy * moveSpeed));
      
      // Keep within map boundaries
      const boundary = mapSize - 100;
      freeCameraPos.x = Math.max(-boundary, Math.min(boundary, freeCameraPos.x));
      freeCameraPos.z = Math.max(-boundary, Math.min(boundary, freeCameraPos.z));
      
      spectatorPrevMouse.x = e.clientX;
      spectatorPrevMouse.y = e.clientY;
    }
    
    if(spectatorRotate){
      const dx = e.clientX - spectatorPrevMouse.x;
      const dy = e.clientY - spectatorPrevMouse.y;
      
      // Rotate camera
      freeCameraYaw += dx * 0.005;
      freeCameraPitch = Math.min(85, Math.max(10, freeCameraPitch + dy * 0.3));
      
      spectatorPrevMouse.x = e.clientX;
      spectatorPrevMouse.y = e.clientY;
    }
  }
});

hud.addEventListener('click', (e) => {
  if(!player.sinking) return;
  if(wasSpectatorDrag) return; // Don't trigger click if was dragging
  
  const rect = hud.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if clicked respawn button (will be set by drawHUD)
  if(window.respawnButtonBounds){
    const btn = window.respawnButtonBounds;
    if(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h){
      respawnPlayer();
    }
  }
});

addEventListener("keydown", e=>{
  if(e.code==="Digit1"){ 
    modelKind="galleon"; 
    scene.remove(player.obj);
    cleanupWaterEffects(player.waterEffects, scene);
    player.obj=buildShip(modelKind); 
    scene.add(player.obj); 
    player.waterEffects = createShipWaterEffects(player.obj, scene);
  }
  if(e.code==="Digit2"){ 
    modelKind="brig"; 
    scene.remove(player.obj);
    cleanupWaterEffects(player.waterEffects, scene);
    player.obj=buildShip(modelKind); 
    scene.add(player.obj);
    player.waterEffects = createShipWaterEffects(player.obj, scene);
  }
  if(e.code==="Digit3"){ 
    modelKind="lugger"; 
    scene.remove(player.obj);
    cleanupWaterEffects(player.waterEffects, scene);
    player.obj=buildShip(modelKind); 
    scene.add(player.obj);
    player.waterEffects = createShipWaterEffects(player.obj, scene);
  }
});

function aiStep(dt){
  for(const e of enemies){
    if(e.hp <= 0 || e.sinking) continue;
    
    const toPlayer = player.pos.clone().sub(e.pos);
    const dist = toPlayer.length();
    const fwd = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), e.ang);
    const right = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), e.ang);
    const dir = toPlayer.clone().normalize();
    const cross = fwd.clone().cross(dir).y;
    const dot = fwd.dot(dir);
    
    e.ai.stateTime += dt;
    
    // Update cooldowns
    if(e.cd.left > 0) e.cd.left = Math.max(0, e.cd.left - dt);
    if(e.cd.right > 0) e.cd.right = Math.max(0, e.cd.right - dt);
    
    // Check for incoming shots and try to evade
    let incomingDanger = false;
    for(const shot of shots){
      if(shot.team === 'ally'){
        const shotDist = shot.p.distanceTo(e.pos);
        if(shotDist < 50 && shot.v.length() > 0){
          incomingDanger = true;
          break;
        }
      }
    }
    
    // AI State Machine
    let input = {forward: false, brake: false, left: false, right: false};
    
    if(incomingDanger && e.ai.lastDodge > 1.5){
      // Evade incoming shots
      e.ai.state = 'evade';
      e.ai.stateTime = 0;
      e.ai.lastDodge = 0;
    }
    
    e.ai.lastDodge += dt;
    
    switch(e.ai.state){
      case 'approach':
        // Get close to broadside range
        if(dist > e.ai.preferredDistance + 40){
          input.forward = true;
          input.left = cross > 0.05;
          input.right = cross < -0.05;
        } else {
          e.ai.state = 'broadside';
          e.ai.stateTime = 0;
        }
        break;
        
      case 'broadside':
        // Position for broadside attack
        const targetAngle = e.ai.targetSide === 'left' ? Math.PI/2 : -Math.PI/2;
        const playerDir = Math.atan2(toPlayer.x, toPlayer.z);
        const desiredAngle = playerDir + targetAngle;
        const angleDiff = ((desiredAngle - e.ang + Math.PI) % (Math.PI * 2)) - Math.PI;
        
        // Turn to get perpendicular to player
        if(Math.abs(angleDiff) > 0.3){
          input.left = angleDiff > 0;
          input.right = angleDiff < 0;
          input.forward = Math.abs(angleDiff) < 1.0;
        } else {
          // Maintain broadside position
          const broadsideDot = right.dot(dir);
          
          // Check if we can fire
          if(Math.abs(broadsideDot) > 0.7 && dist < 300){
            const side = broadsideDot > 0 ? 'right' : 'left';
            if(e.cd[side] <= 0){
              fireEnemyBroadside(e, player, side, forwardVec, rightVec);
              e.cd[side] = reloadTime * (1.2 + Math.random() * 0.4);
            }
          }
          
          // Adjust distance
          if(dist < e.ai.preferredDistance - 20){
            input.brake = true;
          } else if(dist > e.ai.preferredDistance + 20){
            input.forward = true;
          }
        }
        
        // Change state periodically
        if(e.ai.stateTime > 4 + Math.random() * 3){
          e.ai.state = Math.random() > 0.4 ? 'circle' : 'evade';
          e.ai.stateTime = 0;
          e.ai.targetSide = e.ai.targetSide === 'left' ? 'right' : 'left';
        }
        break;
        
      case 'circle':
        // Circle around player
        const circleDir = e.ai.targetSide === 'left' ? 1 : -1;
        input.forward = true;
        input.left = circleDir > 0;
        input.right = circleDir < 0;
        
        if(e.ai.stateTime > 2 + Math.random() * 2){
          e.ai.state = 'broadside';
          e.ai.stateTime = 0;
        }
        break;
        
      case 'evade':
        // Evasive maneuvers
        const evadeDir = Math.random() > 0.5 ? 1 : -1;
        input.forward = true;
        input.left = evadeDir > 0;
        input.right = evadeDir < 0;
        
        if(e.ai.stateTime > 1.5){
          e.ai.state = dist > 180 ? 'approach' : 'broadside';
          e.ai.stateTime = 0;
        }
        break;
    }
    
    updateShip(e, dt, input, cfg);
  }
}

function applyMobileInput(dt) {
  if(player.sinking) return; // Don't process mobile input if dead
  
  const camYaw = controls.getCam().yaw;
  const lj = controls.leftJoy;
  const v = lj.vec.clone();
  const m = v.length();
  if (m > 0.1) {
    const rx = v.x * Math.cos(camYaw) - v.y * Math.sin(camYaw);
    const rz = v.x * Math.sin(camYaw) + v.y * Math.cos(camYaw);
    const desiredDir = new THREE.Vector3(rx, 0, -rz).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.ang);
    const cross = fwd.clone().cross(desiredDir).y;
    const dot = fwd.dot(desiredDir);
    const input = { forward: dot > 0.15, brake: dot < -0.15, left: cross > 0.05, right: cross < -0.05 };
    updateShip(player, dt, input, cfg);
  }
}

function followCamera(dt){
  if(freeCameraMode){
    // Free camera controls - smoother movement with zoom
    const r = window.cameraDistance;
    const radPitch = THREE.MathUtils.degToRad(freeCameraPitch);
    const radYaw = freeCameraYaw;
    const camPos = new THREE.Vector3(
      freeCameraPos.x + Math.sin(radYaw)*r*Math.cos(radPitch),
      freeCameraPos.y + r*Math.sin(radPitch),
      freeCameraPos.z + Math.cos(radYaw)*r*Math.cos(radPitch)
    );
    camera.position.lerp(camPos, 0.1); // Slower lerp for smoother movement
    camera.lookAt(freeCameraPos.x, freeCameraPos.y, freeCameraPos.z);
  } else {
    // Normal camera follow player with zoom
    const c = controls.getCam();
    const r = window.cameraDistance;
    const radPitch = THREE.MathUtils.degToRad(c.pitch);
    const radYaw = c.yaw;
    const camPos = new THREE.Vector3(
      player.pos.x + Math.sin(radYaw)*r*Math.cos(radPitch),
      player.pos.y + r*Math.sin(radPitch),
      player.pos.z + Math.cos(radYaw)*r*Math.cos(radPitch)
    );
    camera.position.lerp(camPos,0.2);
    camera.lookAt(player.pos.x, player.pos.y, player.pos.z);
  }
}

let last=performance.now();
let fps=60;

function respawnPlayer(){
  player.hp = player.maxHp;
  player.sinking = false;
  player.sinkTime = 0;
  player.pos.set(0, 0, 0);
  player.vel.set(0, 0, 0);
  player.ang = 0;
  
  // Reset ship visual state
  player.obj.position.set(0, 0, 0);
  player.obj.rotation.set(0, 0, 0);
  
  // Make sure ship is in scene
  if(!scene.children.includes(player.obj)){
    scene.add(player.obj);
  }
  
  // Restore reflection if needed
  if(player.waterEffects?.reflection && !scene.children.includes(player.waterEffects.reflection)){
    scene.add(player.waterEffects.reflection);
  }
  
  freeCameraMode = false;
  window.freeCameraMode = false;
  hitIndicator = null;
}

function loop(now){
  const dt=Math.min(0.033,(now-last)/1000);
  last=now;
  fps=fps*0.9+(1/dt)*0.1;

  // Update hit indicator
  if(hitIndicator){
    hitIndicator.life -= dt;
    hitIndicator.opacity = Math.max(0, hitIndicator.life / 0.6);
    if(hitIndicator.life <= 0){
      hitIndicator = null;
    }
  }

  // Make player position available globally for touch controls
  window.playerPos = player.pos;

  // Don't update player if sinking or dead
  if(!player.sinking && player.hp > 0){
    updateShip(player, dt, controls.input, cfg);
    applyMobileInput(dt);
  } else if(player.sinking && !freeCameraMode && player.sinkTime > 3.0){
    // Switch to free camera AFTER sinking animation completes (3 seconds)
    freeCameraMode = true;
    window.freeCameraMode = true;
    freeCameraPos.copy(player.pos);
    window.freeCameraPos.copy(player.pos);
    freeCameraYaw = controls.getCam().yaw;
    window.freeCameraYaw = freeCameraYaw;
    freeCameraPitch = controls.getCam().pitch;
    window.freeCameraPitch = freeCameraPitch;
  }
  
  aiStep(dt);

  // Check all collisions
  checkCollisions();

  // Show aim ONLY for mouse (not for mobile joysticks)
  const showAimLine = !player.sinking && (controls.showAimRef?.() || false) && !controls.rightJoy.active;
  
  // Update aimPoint from right joystick DIRECTION every frame
  if(controls.rightJoy.active && !player.sinking){
    const camYaw = controls.getCam().yaw;
    const rv = controls.rightJoy.vec; // Vector from joystick: x = left/right, y = up/down
    
    // Use EXACT same formula as left joystick (movement) for consistency
    const rx = rv.x * Math.cos(camYaw) - rv.y * Math.sin(camYaw);
    const rz = rv.x * Math.sin(camYaw) + rv.y * Math.cos(camYaw);
    const dir = new THREE.Vector3(rx, 0, -rz);
    
    if(dir.length() > 0.01){
      dir.normalize();
      // Set aimPoint on water plane (y = 0), 120 units from player
      aimPoint.set(
        player.pos.x + dir.x * 120,
        0, // Keep on water surface
        player.pos.z + dir.z * 120
      );
    } else {
      // Joystick at center - aim forward from camera
      const camForward = new THREE.Vector3(Math.sin(camYaw), 0, -Math.cos(camYaw));
      aimPoint.set(
        player.pos.x + camForward.x * 120,
        0,
        player.pos.z + camForward.z * 120
      );
    }
  }
  // Note: for mouse aiming, aimPoint is updated in controls.js via updateAimFromScreen

  for(const s of [player, ...enemies]){
    // Animate sails
    if(!s.sailTime) s.sailTime = Math.random() * Math.PI * 2;
    s.sailTime += dt * 2.5;
    
    s.obj.traverse(child => {
      if(child.isMesh && child.material && child.material.color){
        // Check if it's a sail (white/light color)
        const r = child.material.color.r;
        const g = child.material.color.g;
        const b = child.material.color.b;
        if(r > 0.9 && g > 0.9 && b > 0.9){
          // Animate sail flutter
          const flutter = Math.sin(s.sailTime + child.position.y * 0.5) * 0.02;
          child.rotation.y = flutter;
          child.rotation.x = Math.cos(s.sailTime * 1.3 + child.position.z * 0.3) * 0.015;
        }
      }
    });
    
    s.obj.position.copy(s.pos);
    s.obj.rotation.y=s.ang;
    
    // Update sinking animation
    if(s.sinking){
      s.sinkTime += dt;
      const sinkProgress = Math.min(1, s.sinkTime / 3.0); // 3 seconds to sink
      s.obj.position.y = s.pos.y - sinkProgress * 12; // Sink 12 units down
      s.obj.rotation.x = sinkProgress * 0.4; // Tilt forward
      s.obj.rotation.z = Math.sin(s.sinkTime * 2) * sinkProgress * 0.3; // Rock side to side
      
      // Fade out reflection
      if(s.waterEffects?.reflection){
        s.waterEffects.reflection.traverse(child => {
          if(child.material) child.material.opacity = 0.2 * (1 - sinkProgress);
        });
      }
      
      // Remove ship after sinking
      if(s.sinkTime > 4){
        scene.remove(s.obj);
        if(s.waterEffects?.reflection) scene.remove(s.waterEffects.reflection);
      }
    }
    
    const cdL = s === player ? cd.left : s.cd.left;
    const cdR = s === player ? cd.right : s.cd.right;
    const showAim = s === player ? showAimLine : false;
    const aim = s === player ? aimPoint : null;
    updateShipWaterEffects(s, s.waterEffects, dt, cdL, cdR, reloadTime, s.sinking, showAim, aim);
  }

  const shotsFired = controls.consumeShots?.() || 0;
  if(shotsFired>0) fire();

  if(cd.left>0) cd.left=Math.max(0,cd.left-dt);
  if(cd.right>0) cd.right=Math.max(0,cd.right-dt);

  updateShots(dt, scene);
  renderProjectiles(scene);
  followCamera(dt);
  updateMapBorderOpacity(scene, camera.position, mapSize);
  renderer.render(scene,camera);

  const speed = player.vel.length();
  drawHUD(hud, h2d, camera, {player, fps, speed, showAim: showAimLine, aimPoint, vec3:(x,y,z)=>new THREE.Vector3(x,y,z), leftJoy:controls.leftJoy, rightJoy:controls.rightJoy, modelKind, cd, enemies, hitIndicator});

  requestAnimationFrame(loop);
}

// Handle window resize with proper pixel ratio for mobile
function handleResize(){
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Cap pixel ratio to prevent UI scaling issues on high-DPI mobile devices
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  
  // Set WebGL canvas size properly
  renderer.setSize(width, height);
  renderer.setPixelRatio(pixelRatio);
  
  // Set canvas CSS size to prevent stretching
  const canvas = renderer.domElement;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // Set HUD canvas size (actual size should match pixel ratio for crisp rendering)
  hud.width = width * pixelRatio;
  hud.height = height * pixelRatio;
  hud.style.width = width + 'px';
  hud.style.height = height + 'px';
  
  // Scale HUD context to account for pixel ratio
  const h2dContext = hud.getContext('2d');
  h2dContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

handleResize();

addEventListener("resize", handleResize);
addEventListener("orientationchange", ()=>{
  setTimeout(handleResize, 100); // iOS needs delay after orientation change
});

requestAnimationFrame(loop);
