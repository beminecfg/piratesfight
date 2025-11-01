import {worldToScreen, rr} from './utils.js';
import {splashes, reloadTime} from './projectiles.js';

let mouseX = 0;
let mouseY = 0;

// Track mouse position
if(typeof window !== 'undefined'){
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}

// Get safe area insets for iOS
function getSafeAreaInsets() {
  const insets = {top: 0, right: 0, bottom: 0, left: 0};
  
  if(typeof getComputedStyle !== 'undefined' && document.documentElement){
    const style = getComputedStyle(document.documentElement);
    insets.top = parseInt(style.getPropertyValue('--sat') || 
                         style.getPropertyValue('env(safe-area-inset-top)') || '0');
    insets.right = parseInt(style.getPropertyValue('--sar') || 
                           style.getPropertyValue('env(safe-area-inset-right)') || '0');
    insets.bottom = parseInt(style.getPropertyValue('--sab') || 
                            style.getPropertyValue('env(safe-area-inset-bottom)') || '0');
    insets.left = parseInt(style.getPropertyValue('--sal') || 
                          style.getPropertyValue('env(safe-area-inset-left)') || '0');
  }
  
  // Fallback for iOS detection
  if(insets.top === 0 && /iPhone|iPad|iPod/.test(navigator.userAgent)){
    // Assume notch for newer iPhones in landscape
    if(window.innerWidth > window.innerHeight && window.innerWidth >= 812){
      insets.left = 44;
      insets.right = 44;
    }
    // Portrait mode
    else if(window.innerHeight >= 812){
      insets.top = 44;
      insets.bottom = 34;
    }
  }
  
  return insets;
}

export function drawHUD(hud, h2d, camera, state){
  hud.width = innerWidth; hud.height = innerHeight;
  const w=hud.width, h=hud.height;
  const safeArea = getSafeAreaInsets();
  drawTopBar(h2d,w,h,state,safeArea);
  
  // Draw enemy HP bars in 3D world
  if(state.enemies){
    drawEnemyHPBars(h2d, camera, hud, state);
  }
  
  // Draw hit indicators on screen
  if(state.hitIndicator){
    drawHitIndicator(h2d, camera, hud, state);
  }
  
  // Draw broadside arcs around ship
  drawBroadsideArcs(h2d, camera, hud, state);
  
  if(state.showAim){
    // Use joystick position for mobile, mouse for desktop
    let targetX = mouseX;
    let targetY = mouseY;
    if(state.rightJoy && state.rightJoy.active){
      // Convert aimPoint from world to screen coordinates
      const aimScreenPos = worldToScreen(camera, hud, state.aimPoint);
      targetX = aimScreenPos.x;
      targetY = aimScreenPos.y;
    }
    drawAimingLine(h2d, camera, hud, state, targetX, targetY);
  }
  
  for(const sp of splashes){
    const p = worldToScreen(camera, hud, state.vec3(sp.x,0,sp.z));
    h2d.beginPath(); h2d.arc(p.x,p.y,sp.r,0,Math.PI*2);
    h2d.strokeStyle=`rgba(255,255,255,${sp.a*0.6})`; h2d.lineWidth=2; h2d.stroke();
  }
  
  // Draw death screen
  if(state.player.sinking){
    drawDeathScreen(h2d, w, h, state, safeArea);
  }
  
  drawJoysticks(h2d,state,safeArea);
}

function drawHitIndicator(h2d, camera, hud, state){
  const shipPos = worldToScreen(camera, hud, state.player.pos);
  
  // Calculate direction to attacker
  if(state.hitIndicator.attackerPos){
    const attackerScreen = worldToScreen(camera, hud, state.hitIndicator.attackerPos);
    const dx = attackerScreen.x - shipPos.x;
    const dy = attackerScreen.y - shipPos.y;
    const angleToAttacker = Math.atan2(dy, dx);
    
    // Draw small arc pointing to attacker
    const arcRadius = 360; // Far from ship
    const arcAngle = Math.PI * 0.15; // 2x smaller (was 0.25)
    const centerAngle = angleToAttacker;
    const startAngle = centerAngle - arcAngle/2;
    const endAngle = centerAngle + arcAngle/2;
    
    h2d.beginPath();
    h2d.arc(shipPos.x, shipPos.y, arcRadius, startAngle, endAngle);
    h2d.strokeStyle = `rgba(255,50,50,${state.hitIndicator.opacity})`;
    h2d.lineWidth = 5;
    h2d.stroke();
  }
}

function drawDeathScreen(h2d, w, h, state, safeArea){
  // NO overlay - keep screen clear for spectating
  
  // "You sunk!" text at bottom (accounting for safe area)
  const bottomY = h - 120 - safeArea.bottom;
  h2d.font = 'bold 36px sans-serif';
  h2d.textAlign = 'center';
  h2d.textBaseline = 'middle';
  h2d.fillStyle = '#ff4444';
  h2d.strokeStyle = '#000000';
  h2d.lineWidth = 4;
  h2d.strokeText('You sunk!', w/2, bottomY);
  h2d.fillText('You sunk!', w/2, bottomY);
  
  // Respawn button at bottom
  const btnW = 200, btnH = 50;
  const btnX = w/2 - btnW/2;
  const btnY = bottomY + 50;
  
  h2d.fillStyle = '#44aa44';
  h2d.strokeStyle = '#ffffff';
  h2d.lineWidth = 3;
  rr(h2d, btnX, btnY, btnW, btnH, 8);
  h2d.fill();
  h2d.stroke();
  
  h2d.font = 'bold 22px sans-serif';
  h2d.fillStyle = '#ffffff';
  h2d.fillText('Respawn', w/2, btnY + btnH/2);
  
  // Store button bounds for click detection globally
  window.respawnButtonBounds = {x: btnX, y: btnY, w: btnW, h: btnH};
}

function drawBroadsideArcs(h2d, camera, hud, state){
  // Arcs are now in 3D world, nothing to draw here in 2D
}

function drawAimingLine(h2d, camera, hud, state, mouseX, mouseY){
  const shipPos = worldToScreen(camera, hud, state.player.pos);
  
  // Use direct mouse position in 2D screen space
  const dx = mouseX - shipPos.x;
  const dy = mouseY - shipPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if(dist < 0.1) return;
  
  // FIXED length - always 250 pixels
  const fixedLength = 250;
  const endX = shipPos.x + (dx / dist) * fixedLength;
  const endY = shipPos.y + (dy / dist) * fixedLength;
  
  // Draw solid aiming line following mouse - thin
  h2d.strokeStyle = 'rgba(0,255,128,0.7)';
  h2d.lineWidth = 1.5;
  h2d.beginPath();
  h2d.moveTo(shipPos.x, shipPos.y);
  h2d.lineTo(endX, endY);
  h2d.stroke();
}
function drawShipIcon(h2d, x, y, size, shipType){
  h2d.save();
  h2d.translate(x, y);
  h2d.fillStyle = "rgba(255,255,255,0.8)";
  h2d.strokeStyle = "rgba(255,255,255,0.9)";
  h2d.lineWidth = 2;
  
  if(shipType === "galleon"){
    // Circle
    h2d.beginPath();
    h2d.arc(0, 0, size, 0, Math.PI * 2);
    h2d.fill();
    h2d.stroke();
  } else if(shipType === "brig"){
    // Square
    h2d.fillRect(-size, -size, size*2, size*2);
    h2d.strokeRect(-size, -size, size*2, size*2);
  } else if(shipType === "lugger"){
    // Triangle
    h2d.beginPath();
    h2d.moveTo(0, -size);
    h2d.lineTo(size, size);
    h2d.lineTo(-size, size);
    h2d.closePath();
    h2d.fill();
    h2d.stroke();
  }
  h2d.restore();
}

function drawTopBar(h2d,w,h,state,safeArea){
  const pad=8;
  const bh=28;
  const r=12;
  // Apply safe area padding
  const x=pad + safeArea.left;
  const y=pad + safeArea.top;
  const bw=w - pad*2 - safeArea.left - safeArea.right;
  const alliesW=Math.max(120,bw*0.33);
  const enemiesW=Math.max(120,bw*0.33);
  const hpW=bw-alliesW-enemiesW;
  const gx=x,hx=gx+alliesW,ex=hx+hpW;
  const g=h2d.createLinearGradient(0,y,0,y+bh); g.addColorStop(0,"#82b9aa"); g.addColorStop(1,"#5a8d81");
  const m=h2d.createLinearGradient(0,y,0,y+bh); m.addColorStop(0,"#e56b6b"); m.addColorStop(1,"#b04848");
  const e=h2d.createLinearGradient(0,y,0,y+bh); e.addColorStop(0,"#b7a2b1"); e.addColorStop(1,"#8d7486");
  h2d.shadowColor="rgba(0,0,0,0.35)"; h2d.shadowBlur=6; h2d.shadowOffsetY=2;
  rr(h2d,x,y,bw,bh,r); h2d.fillStyle="#2a2f3a"; h2d.fill(); h2d.shadowBlur=0; h2d.shadowOffsetY=0;
  rr(h2d,gx+2,y+2,alliesW-4,bh-4,r-6); h2d.fillStyle=g; h2d.fill();
  
  // HP bar - only show current HP, empty space for damage
  const hpPercent = state.player.hp / state.player.maxHp;
  const currentHpWidth = (hpW-4) * hpPercent;
  if(currentHpWidth > 0){
    h2d.save();
    h2d.beginPath();
    rr(h2d,hx+2,y+2,currentHpWidth,bh-4,r-6);
    h2d.clip();
    rr(h2d,hx+2,y+2,hpW-4,bh-4,r-6); 
    h2d.fillStyle=m; 
    h2d.fill();
    h2d.restore();
  }
  
  rr(h2d,ex+2,y+2,enemiesW-4,bh-4,r-6); h2d.fillStyle=e; h2d.fill();
  h2d.fillStyle="rgba(0,0,0,0.25)"; h2d.fillRect(hx-1,y+4,2,bh-8); h2d.fillRect(ex-1,y+4,2,bh-8);
  
  // Draw ship type icons - transparent if dead
  if(state.player.hp <= 0 || state.player.sinking){
    h2d.globalAlpha = 0.3;
  }
  drawShipIcon(h2d, gx + alliesW/2, y + bh/2, 6, state.modelKind);
  h2d.globalAlpha = 1.0;
  
  // Draw enemy ship icons
  if(state.enemies && state.enemies.length > 0){
    const iconSpacing = enemiesW / (state.enemies.length + 1);
    state.enemies.forEach((enemy, idx) => {
      const enemyType = enemy.obj?.userData?.shipType || "galleon";
      const iconX = ex + iconSpacing * (idx + 1);
      const iconY = y + bh/2;
      
      // Make icon semi-transparent if sinking
      if(enemy.sinking || enemy.hp <= 0){
        h2d.globalAlpha = 0.3;
      }
      drawShipIcon(h2d, iconX, iconY, 5, enemyType);
      h2d.globalAlpha = 1.0; // Reset
    });
  }
  
  const fsize=bh*0.6|0; h2d.font=`bold ${fsize}px UiMono, monospace`; h2d.textAlign="center"; h2d.textBaseline="middle";
  h2d.fillStyle="#3b0f0f"; h2d.fillText(`${state.player.hp|0}/${state.player.maxHp|0}`, hx+hpW/2, y+bh/2);
  h2d.font="12px UiMono, monospace"; h2d.textAlign="left"; h2d.textBaseline="alphabetic"; h2d.fillStyle="rgba(255,255,255,0.8)";
  h2d.fillText(`FPS ${Math.round(state.fps)}`, x+10, y+bh+14);
  h2d.fillText(`V ${state.speed.toFixed(1)}`, x+80, y+bh+14);
}

function drawEnemyHPBars(h2d, camera, hud, state){
  state.enemies.forEach(enemy => {
    if(enemy.hp <= 0 || enemy.sinking) return;
    
    // Position above enemy ship - 1.5x higher
    const enemyPosAbove = state.vec3(enemy.pos.x, 42, enemy.pos.z);
    const screenPos = worldToScreen(camera, hud, enemyPosAbove);
    
    // Check if on screen
    if(screenPos.x < 0 || screenPos.x > hud.width || screenPos.y < 0 || screenPos.y > hud.height) return;
    
    const barWidth = 60;
    const barHeight = 8;
    const barX = screenPos.x - barWidth/2;
    const barY = screenPos.y;
    
    // Background (red)
    h2d.fillStyle = "rgba(220,60,60,0.8)";
    h2d.fillRect(barX, barY, barWidth, barHeight);
    
    // HP (green)
    const hpPercent = enemy.hp / enemy.maxHp;
    h2d.fillStyle = "rgba(60,220,80,0.9)";
    h2d.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    
    // Border
    h2d.strokeStyle = "rgba(0,0,0,0.6)";
    h2d.lineWidth = 1;
    h2d.strokeRect(barX, barY, barWidth, barHeight);
  });
}
function drawJoysticks(h2d,state,safeArea){
  const a=state.leftJoy; const b=state.rightJoy;
  if(a.active){
    const R=a.radius; const cx=a.start.x; const cy=a.start.y;
    h2d.beginPath(); h2d.arc(cx,cy,R,0,Math.PI*2);
    h2d.strokeStyle="rgba(255,255,255,0.25)"; h2d.lineWidth=2; h2d.stroke();
    h2d.beginPath(); h2d.arc(a.pos.x,a.pos.y,R*0.45,0,Math.PI*2);
    h2d.fillStyle="rgba(255,255,255,0.35)"; h2d.fill();
  }
  if(b.active){
    const R=b.radius; const cx=b.start.x; const cy=b.start.y;
    h2d.beginPath(); h2d.arc(cx,cy,R,0,Math.PI*2);
    h2d.strokeStyle="rgba(0,255,128,0.25)"; h2d.lineWidth=2; h2d.stroke();
    h2d.beginPath(); h2d.arc(b.pos.x,b.pos.y,R*0.45,0,Math.PI*2);
    h2d.fillStyle="rgba(0,255,128,0.35)"; h2d.fill();
  }
}
