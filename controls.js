import {THREE_NS as THREE} from './world.js';

// Get safe area insets for proper touch zone detection
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

export function makeControls(camera, planeWater, fireFn, aimPoint){
  const input = {forward:false, left:false, right:false, brake:false};
  let camYaw=0, camPitch=60, dragCam=false;
  let prevMouse={x:0,y:0};
  let showAim=false;
  let camTouchId=null;
  let prevTouch={x:0,y:0};
  const raycaster = new THREE.Raycaster();

  function updateAimFromScreen(x,y){
    const nx = (x/innerWidth)*2-1;
    const ny = -(y/innerHeight)*2+1;
    raycaster.setFromCamera({x:nx,y:ny}, camera);
    const pos = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeWater, pos);
    if(pos) aimPoint.copy(pos);
  }

  addEventListener("contextmenu", e=>e.preventDefault());
  addEventListener("mousemove", e=>{
    // Always update aim point for smooth tracking
    updateAimFromScreen(e.clientX, e.clientY);
    
    if(dragCam){
      camYaw += (e.clientX - prevMouse.x)*0.3*Math.PI/180;
      camPitch = Math.min(85, Math.max(30, camPitch + (e.clientY - prevMouse.y)*0.3));
      prevMouse.x=e.clientX; prevMouse.y=e.clientY;
    }
  });
  addEventListener("mousedown", e=>{
    if(e.button===1){dragCam=true;prevMouse.x=e.clientX;prevMouse.y=e.clientY;}
    if(e.button===0){showAim=true; updateAimFromScreen(e.clientX,e.clientY);}
    if(e.button===2){fireFn();}
  });
  addEventListener("mouseup", e=>{
    if(e.button===1) dragCam=false;
    if(e.button===0){showAim=false;}
  });
  addEventListener("keydown", e=>{
    if(e.code==="KeyW") input.forward=true;
    if(e.code==="KeyS") input.brake=true;
    if(e.code==="KeyA") input.left=true;
    if(e.code==="KeyD") input.right=true;
  });
  addEventListener("keyup", e=>{
    if(e.code==="KeyW") input.forward=false;
    if(e.code==="KeyS") input.brake=false;
    if(e.code==="KeyA") input.left=false;
    if(e.code==="KeyD") input.right=false;
  });

  const leftJoy={active:false,start:{x:0,y:0},pos:{x:0,y:0},radius:70,vec:new THREE.Vector2(0,0)};
  const rightJoy={active:false,start:{x:0,y:0},pos:{x:0,y:0},radius:70,vec:new THREE.Vector2(0,0)};
  let leftId=null, rightId=null;
  
  // Pinch zoom
  let pinchDist = 0;
  let touches = {};

  function joyStart(id,x,y){
    // Check if in spectator mode
    if(window.freeCameraMode){
      if(camTouchId===null){
        camTouchId=id; prevTouch.x=x; prevTouch.y=y;
      }
      return;
    }
    
    const safeArea = getSafeAreaInsets();
    const safeWidth = innerWidth - safeArea.left - safeArea.right;
    // Mobile: larger center zone (25%-75%) for easier camera control
    const leftZoneEnd = safeArea.left + safeWidth * 0.25;
    const rightZoneStart = safeArea.left + safeWidth * 0.75;
    
    // Левая треть экрана - джойстик движения (НЕЗАВИСИМО от других)
    if(x < leftZoneEnd && leftId===null){ 
      leftId=id; leftJoy.active=true; leftJoy.start.x=x; leftJoy.start.y=y; leftJoy.pos.x=x; leftJoy.pos.y=y; leftJoy.vec.set(0,0); 
      return;
    }
    // Правая треть экрана - джойстик стрельбы (НЕЗАВИСИМО от других)
    if(x > rightZoneStart && rightId===null){ 
      rightId=id; rightJoy.active=true; rightJoy.start.x=x; rightJoy.start.y=y; rightJoy.pos.x=x; rightJoy.pos.y=y; rightJoy.vec.set(0,0); 
      return;
    }
    // Средняя треть экрана - управление камерой
    // Работает если: джойстики не активны ИЛИ активен только левый джойстик (движение + камера)
    const inCenterZone = x >= leftZoneEnd && x <= rightZoneStart;
    if(inCenterZone && camTouchId===null){
      // Разрешаем управление камерой если:
      // - Ничего не активно
      // - ИЛИ активен только левый джойстик (движение + камера одновременно)
      if((leftId===null && rightId===null) || (leftId!==null && rightId===null)){
        camTouchId=id; prevTouch.x=x; prevTouch.y=y;
      }
    }
  }
  function joyMove(id,x,y){
    if(id===camTouchId){
      if(window.freeCameraMode && window.freeCameraPos){
        // Spectator mode - move camera position
        const dx = x - prevTouch.x;
        const dy = y - prevTouch.y;
        const moveSpeed = 0.8;
        const camRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), window.freeCameraYaw || 0);
        const camFwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), window.freeCameraYaw || 0);
        
        window.freeCameraPos.add(camRight.multiplyScalar(-dx * moveSpeed));
        window.freeCameraPos.add(camFwd.multiplyScalar(dy * moveSpeed));
        
        // Keep within boundaries
        const boundary = (window.mapSize || 2000) - 100;
        window.freeCameraPos.x = Math.max(-boundary, Math.min(boundary, window.freeCameraPos.x));
        window.freeCameraPos.z = Math.max(-boundary, Math.min(boundary, window.freeCameraPos.z));
      } else {
        // Normal camera rotation
        camYaw += (x - prevTouch.x)*0.3*Math.PI/180;
        camPitch = Math.min(85, Math.max(30, camPitch + (y - prevTouch.y)*0.3));
      }
      prevTouch.x=x; prevTouch.y=y;
      return;
    }
    const J = (id===leftId)?leftJoy:(id===rightId)?rightJoy:null; if(!J) return;
    const dx=x-J.start.x, dy=y-J.start.y;
    const v=new THREE.Vector2(dx,dy);
    const d=Math.min(J.radius, v.length());
    if(v.length()>0){ v.setLength(d); }
    J.pos.x = J.start.x + v.x; J.pos.y = J.start.y + v.y;
    // Инвертируем Y для правильного направления (вверх на экране = положительное Y)
    J.vec.set((J.pos.x-J.start.x)/J.radius, -(J.pos.y-J.start.y)/J.radius);
    
    // aimPoint will be updated in main loop using joystick screen position
  }
  function joyEnd(id){
    if(id===leftId){ leftId=null; leftJoy.active=false; leftJoy.vec.set(0,0); }
    if(id===rightId){ 
      // Only fire if joystick was moved significantly from center
      const magnitude = rightJoy.vec.length();
      rightId=null; 
      rightJoy.active=false; 
      rightJoy.vec.set(0,0);
      if(magnitude > 0.3){ // Threshold to prevent accidental firing
        fireFn(); 
      }
    }
    if(id===camTouchId){ camTouchId=null; }
  }

  addEventListener("touchstart", e=>{
    // Update touches
    for(const t of e.changedTouches){ 
      touches[t.identifier] = {x: t.clientX, y: t.clientY};
    }
    
    const touchIds = Object.keys(touches);
    
    // Check for pinch zoom (2 fingers) - ONLY if:
    // 1. Both touches in center third
    // 2. NO joysticks are active (to allow movement + camera control)
    if(touchIds.length === 2 && leftId === null && rightId === null){
      const t1 = touches[touchIds[0]];
      const t2 = touches[touchIds[1]];
      
      // Check if both touches are in center zone (25%-75%)
      const centerStart = innerWidth * 0.25;
      const centerEnd = innerWidth * 0.75;
      const inCenter1 = t1.x >= centerStart && t1.x <= centerEnd;
      const inCenter2 = t2.x >= centerStart && t2.x <= centerEnd;
      
      if(inCenter1 && inCenter2){
        // Both in center, no joysticks - enable pinch zoom
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        pinchDist = Math.sqrt(dx*dx + dy*dy);
        e.preventDefault();
        return;
      }
    }
    
    // Reset pinch if not 2 fingers or joysticks active
    if(touchIds.length !== 2 || leftId !== null || rightId !== null){
      pinchDist = 0;
    }
    
    // Process touches as joysticks (allows multiple simultaneous)
    for(const t of e.changedTouches){ 
      joyStart(t.identifier, t.clientX, t.clientY); 
    }
  }, {passive:false});
  
  addEventListener("touchmove", e=>{
    // Update touches
    for(const t of e.changedTouches){ 
      touches[t.identifier] = {x: t.clientX, y: t.clientY};
    }
    
    const touchIds = Object.keys(touches);
    
    // Pinch zoom - ONLY if:
    // 1. Both touches in center
    // 2. NO joysticks active
    // 3. pinchDist was initialized
    if(touchIds.length === 2 && pinchDist > 0 && leftId === null && rightId === null){
      const t1 = touches[touchIds[0]];
      const t2 = touches[touchIds[1]];
      
      // Check if both touches are in center zone (25%-75%)
      const centerStart = innerWidth * 0.25;
      const centerEnd = innerWidth * 0.75;
      const inCenter1 = t1.x >= centerStart && t1.x <= centerEnd;
      const inCenter2 = t2.x >= centerStart && t2.x <= centerEnd;
      
      if(inCenter1 && inCenter2){
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const newDist = Math.sqrt(dx*dx + dy*dy);
        
        const delta = newDist - pinchDist;
        if(window.cameraDistance !== undefined){
          window.cameraDistance = Math.max(100, Math.min(400, window.cameraDistance - delta * 0.5));
        }
        
        pinchDist = newDist;
        e.preventDefault();
        return;
      }
    }
    
    // If joysticks became active, disable pinch
    if(leftId !== null || rightId !== null){
      pinchDist = 0;
    }
    
    // Process touches as joysticks (allows multiple simultaneous)
    for(const t of e.changedTouches){ 
      joyMove(t.identifier, t.clientX, t.clientY); 
    }
  }, {passive:false});
  
  addEventListener("touchend", e=>{
    for(const t of e.changedTouches){ 
      delete touches[t.identifier];
      joyEnd(t.identifier); 
    }
    pinchDist = 0;
  });
  
  addEventListener("touchcancel", e=>{
    for(const t of e.changedTouches){ 
      delete touches[t.identifier];
      joyEnd(t.identifier); 
    }
    pinchDist = 0;
  });

  addEventListener("touchstart", e=>{
    // Update touches
    for(const t of e.changedTouches){ 
      touches[t.identifier] = {x: t.clientX, y: t.clientY};
    }
    
    // Check for pinch zoom (2 fingers)
    const touchIds = Object.keys(touches);
    if(touchIds.length === 2){
      const t1 = touches[touchIds[0]];
      const t2 = touches[touchIds[1]];
      const dx = t2.x - t1.x;
      const dy = t2.y - t1.y;
      pinchDist = Math.sqrt(dx*dx + dy*dy);
    } else {
      for(const t of e.changedTouches){ joyStart(t.identifier, t.clientX, t.clientY); }
    }
  }, {passive:false});
  
  addEventListener("touchmove", e=>{
    // Update touches
    for(const t of e.changedTouches){ 
      touches[t.identifier] = {x: t.clientX, y: t.clientY};
    }
    
    const touchIds = Object.keys(touches);
    
    // Pinch zoom
    if(touchIds.length === 2){
      const t1 = touches[touchIds[0]];
      const t2 = touches[touchIds[1]];
      const dx = t2.x - t1.x;
      const dy = t2.y - t1.y;
      const newDist = Math.sqrt(dx*dx + dy*dy);
      
      if(pinchDist > 0){
        const delta = newDist - pinchDist;
        if(window.cameraDistance !== undefined){
          window.cameraDistance = Math.max(100, Math.min(400, window.cameraDistance - delta * 0.5));
        }
      }
      pinchDist = newDist;
      e.preventDefault();
    } else {
      for(const t of e.changedTouches){ joyMove(t.identifier, t.clientX, t.clientY); }
    }
  }, {passive:false});
  
  addEventListener("touchend", e=>{
    for(const t of e.changedTouches){ 
      delete touches[t.identifier];
      joyEnd(t.identifier); 
    }
    pinchDist = 0;
  });
  
  addEventListener("touchcancel", e=>{
    for(const t of e.changedTouches){ 
      delete touches[t.identifier];
      joyEnd(t.identifier); 
    }
    pinchDist = 0;
  });

  return {input, cam:{yaw:camYaw,pitch:camPitch}, setCam:(yaw,pitch)=>{camYaw=yaw;camPitch=pitch;}, getCam:()=>({yaw:camYaw,pitch:camPitch}), showAimRef:()=>showAim, leftJoy, rightJoy};
}
