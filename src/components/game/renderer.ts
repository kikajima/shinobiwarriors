// ============================================================
// Shinobi Online — renderizador canvas (pixel-art)
// ============================================================

'use client'

import type { GameEngine } from './engine'
import { EL_COLORS, EL_LIST, ElementId, TILE } from './types'
import { PIX_SCALE } from './sprites'

const MONSTER_SCALE: Record<string, number> = {
  bandido: 1, gennin: 1, sapo: 1.12, zetsu: 1.08, boss: 1.65,
}

function easeOut(t: number) { return 1 - (1 - t) * (1 - t) }

export function drawGame(e: GameEngine, now: number) {
  const ctx = e.ctx, canvas = e.canvas
  const dpr = canvas.width / Math.max(1, canvas.clientWidth)
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.imageSmoothingEnabled=false
  const shakeX=e.shake>0?(Math.random()-.5)*e.shake:0, shakeY=e.shake>0?(Math.random()-.5)*e.shake:0
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.translate(canvas.clientWidth/2,canvas.clientHeight/2); ctx.scale(e.zoom,e.zoom); ctx.translate(-e.camX+shakeX,-e.camY+shakeY)
  const viewW=canvas.clientWidth/e.zoom, viewH=canvas.clientHeight/e.zoom
  const left=e.camX-viewW/2-TILE, top=e.camY-viewH/2-TILE, right=e.camX+viewW/2+TILE, bottom=e.camY+viewH/2+TILE
  const tx0=Math.max(0,Math.floor(left/TILE)),ty0=Math.max(0,Math.floor(top/TILE)),tx1=Math.min(e.map.w-1,Math.ceil(right/TILE)),ty1=Math.min(e.map.h-1,Math.ceil(bottom/TILE)),waterFrame=Math.floor(now/420)%2
  for(let ty=ty0;ty<=ty1;ty++){const row=e.map.tiles[ty];for(let tx=tx0;tx<=tx1;tx++){const ch=row[tx],variants=e.tiles[ch]||e.tiles['.'];let v=variants[(tx*7+ty*13)%variants.length];if(ch==='w')v=variants[waterFrame];ctx.drawImage(v,tx*TILE,ty*TILE,TILE,TILE)}}
  for(const tg of e.telegraphs){const t=Math.max(0,Math.min(1,(tg.until-now)/950)),pulse=.5+.5*Math.sin(now/90);ctx.save();ctx.globalAlpha=.28+pulse*.18*(1-t*.4);ctx.fillStyle='#c03030';ctx.beginPath();ctx.arc(tg.x,tg.y,tg.r*(.75+.25*t),0,Math.PI*2);ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle='#e6392b';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.stroke();ctx.restore()}
  const targetEnt=e.targetId!=null?e.entities.get(e.targetId):undefined
  if(targetEnt&&targetEnt.kind==='monster'){const pulse=.6+.4*Math.sin(now/160);ctx.save();ctx.globalAlpha=.75;ctx.strokeStyle='#f0d060';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(targetEnt.x,targetEnt.y+10,18,8,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);const bob=Math.sin(now/200)*3;ctx.globalAlpha=pulse;ctx.fillStyle='#f0d060';ctx.beginPath();ctx.moveTo(targetEnt.x,targetEnt.y-38+bob);ctx.lineTo(targetEnt.x-5,targetEnt.y-46+bob);ctx.lineTo(targetEnt.x+5,targetEnt.y-46+bob);ctx.closePath();ctx.fill();ctx.restore()}
  type Item={sortY:number;draw:()=>void}; const items:Item[]=[]
  for(const o of e.objRender){const ox=o.x*TILE,oy=o.y*TILE;if(ox<left-TILE*2||ox>right+TILE*2||oy<top-TILE*4||oy>bottom+TILE*4)continue;const img=e.objects[o.k];if(!img)continue;const w=img.width/PIX_SCALE,h=img.height/PIX_SCALE,fp=FOOTPRINTS[o.k]||[1,1],dx=o.x*TILE+(fp[0]*TILE-w)/2,dy=(o.y+fp[1])*TILE-h+4;items.push({sortY:o.sortY,draw:()=>{ctx.drawImage(img,dx,dy,w,h);if(o.k==='lantern'){ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(dx+w/2,dy+4,2,dx+w/2,dy+4,34);g.addColorStop(0,'rgba(255, 208, 106, 0.30)');g.addColorStop(1,'rgba(255, 208, 106, 0)');ctx.fillStyle=g;ctx.fillRect(dx+w/2-34,dy-30,68,68);ctx.restore()}}})}
  {const np=e.map.shopNpc;if(np.x>left-60&&np.x<right+60&&np.y>top-60&&np.y<bottom+60){const img=e.npc[0][0],w=img.width/PIX_SCALE,h=img.height/PIX_SCALE;items.push({sortY:np.y+12,draw:()=>ctx.drawImage(img,np.x-w/2,np.y+12-h,w,h)})}}
  for(const ent of e.entities.values()){if(ent.id===e.selfId&&e.you?.dm)continue;if(ent.x<left-60||ent.x>right+60||ent.y<top-80||ent.y>bottom+60)continue;const frame=ent.moving?(Math.floor(ent.animT/.16)%2)+1:0,dir=Math.max(0,Math.min(3,ent.dir));let img:HTMLCanvasElement,scale=1;if(ent.kind==='player')img=e.charSprites(ent.el||'fogo',ent.pal)[dir][frame];else{const t=ent.t||'bandido';img=(e.monsters[t]||e.monsters.bandido)[dir][frame];scale=MONSTER_SCALE[t]||1}const w=img.width/PIX_SCALE*scale,h=img.height/PIX_SCALE*scale,dx=ent.x-w/2,dy=ent.y+12-h,flashing=ent.flashUntil>now;items.push({sortY:ent.y+12,draw:()=>{ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(ent.x,ent.y+10,w*.34,4.5,0,0,Math.PI*2);ctx.fill();ctx.restore();if(flashing)try{ctx.filter='brightness(2.6)'}catch{}ctx.drawImage(img,dx,dy,w,h);if(flashing)try{ctx.filter='none'}catch{}}})}
  items.sort((a,b)=>a.sortY-b.sortY);for(const it of items)it.draw()
  for(const p of e.projectiles.values()){
    const el=EL_LIST[Math.floor(p.k/4)]||'fogo',cols=EL_COLORS[el],skillIdx=p.k%4;
    const px=p.sx+p.vx*(now-p.snapT)/1000,py=p.sy+p.vy*(now-p.snapT)/1000;
    if(px<left-40||px>right+40||py<top-40||py>bottom+40)continue;
    const ang=Math.atan2(p.vy,p.vx),pulse=.85+.15*Math.sin(now/55);
    ctx.save();ctx.translate(px,py);ctx.rotate(ang);

    if(el==='fogo'){
      const rr=skillIdx===2?10:7;
      const g=ctx.createRadialGradient(2,0,1,0,0,rr*2.2);
      g.addColorStop(0,'#fff7c2');g.addColorStop(.28,cols[0]);g.addColorStop(.62,cols[2]);g.addColorStop(1,cols[3]+'00');
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,rr*2.1*pulse,rr,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=cols[2];ctx.beginPath();ctx.moveTo(-rr*2.2,0);ctx.lineTo(-rr*.6,-rr*.65);ctx.lineTo(-rr*.8,rr*.65);ctx.closePath();ctx.fill();
    }else if(el==='agua'){
      ctx.fillStyle=cols[1];ctx.strokeStyle=cols[0];ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(11,0);ctx.quadraticCurveTo(-2,-10,-11,0);ctx.quadraticCurveTo(-2,10,11,0);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.ellipse(2,-3,3.5,1.7,0,0,Math.PI*2);ctx.fill();
    }else if(el==='raio'){
      ctx.strokeStyle=cols[0];ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(-15,4);ctx.lineTo(-7,-4);ctx.lineTo(-1,3);ctx.lineTo(6,-5);ctx.lineTo(15,0);ctx.stroke();
      ctx.strokeStyle=cols[2];ctx.lineWidth=1.5;ctx.stroke();
    }else if(el==='vento'){
      ctx.strokeStyle=cols[0];ctx.lineWidth=3;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(0,0,10,-1.15,1.15);ctx.stroke();
      ctx.strokeStyle=cols[2];ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(-3,0,7,-1.05,1.05);ctx.stroke();
    }else{
      ctx.rotate(now/180);
      ctx.fillStyle=cols[2];ctx.strokeStyle=cols[0];ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(9,-2);ctx.lineTo(4,8);ctx.lineTo(-7,6);ctx.lineTo(-10,-3);ctx.lineTo(-2,-9);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=cols[0];ctx.fillRect(-3,-4,4,2);
    }
    ctx.restore();
  }
  for(const s of e.streaks){const t=Math.max(0,Math.min(1,(s.until-now)/300)),cols=EL_COLORS[s.el];ctx.save();ctx.globalAlpha=t*.85;const g=ctx.createLinearGradient(s.x,s.y,s.tx,s.ty);g.addColorStop(0,cols[2]+'00');g.addColorStop(1,cols[0]);ctx.strokeStyle=g;ctx.lineWidth=13*t;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.tx,s.ty);ctx.stroke();ctx.restore()}
  for(const s of e.slashes){const t=Math.max(0,Math.min(1,(s.until-now)/170));ctx.save();ctx.translate(s.x,s.y+4);ctx.rotate(s.ang);ctx.globalAlpha=t;ctx.strokeStyle='#ffffff';ctx.lineWidth=4.5;ctx.lineCap='round';ctx.beginPath();ctx.arc(12,0,26,-.85,.85);ctx.stroke();ctx.globalAlpha=t*.6;ctx.strokeStyle='#ffd9a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(10,0,21,-.7,.7);ctx.stroke();ctx.restore()}
  for(const a of e.aoes){const dur=a.until-a.born,t=Math.max(0,Math.min(1,(now-a.born)/dur)),rr=a.r*easeOut(t),cols=EL_COLORS[a.el];ctx.save();const g=ctx.createRadialGradient(a.x,a.y,rr*.1,a.x,a.y,rr);if(a.danger){g.addColorStop(0,'rgba(230, 57, 43, 0.30)');g.addColorStop(1,'rgba(230, 57, 43, 0)')}else{g.addColorStop(0,cols[0]+'55');g.addColorStop(.6,cols[1]+'33');g.addColorStop(1,cols[2]+'00')}ctx.fillStyle=g;ctx.beginPath();ctx.arc(a.x,a.y,rr,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1-t*.4;ctx.strokeStyle=a.danger?'#e6392b':cols[0];ctx.lineWidth=3.5*(1-t*.5);ctx.beginPath();ctx.arc(a.x,a.y,rr,0,Math.PI*2);ctx.stroke();ctx.restore()}
  for(const p of e.particles){const alpha=Math.max(0,Math.min(1,p.life/p.maxLife));ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=p.color;if(p.kind==='spark'){ctx.strokeStyle=p.color;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.05,p.y-p.vy*.05);ctx.stroke()}else if(p.kind==='rock')ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);else{ctx.beginPath();ctx.arc(p.x,p.y,p.size*.7,0,Math.PI*2);ctx.fill()}ctx.restore()}
  ctx.textAlign='center'
  for(const ent of e.entities.values()){if(ent.id===e.selfId&&e.you?.dm)continue;if(ent.x<left-60||ent.x>right+60||ent.y<top-80||ent.y>bottom+60)continue;const isSelf=ent.id===e.selfId,scaleY=MONSTER_SCALE[ent.t||'']||1,topY=ent.y+12-(ent.kind==='monster'?40*scaleY:40);if(ent.kind==='player'){const label=`Lv${ent.lv} ${ent.n}`;ctx.font='bold 11px "VT323", monospace';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,0.85)';ctx.strokeText(label,ent.x,topY);ctx.fillStyle=isSelf?'#ffb347':'#f5f2ea';ctx.fillText(label,ent.x,topY);if(ent.hpPct<99.5)drawBar(ctx,ent.x-15,topY+4,30,4,ent.hpPct/100,'#4ade80','#7a2020')}else{const isTarget=ent.id===e.targetId,damaged=ent.hpPct<99.5;if(isTarget||damaged){const label=isTarget?`${ent.n} Lv${ent.lv}`:ent.n;ctx.font='bold 11px "VT323", monospace';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,0.85)';ctx.strokeText(label,ent.x,topY);ctx.fillStyle=ent.t==='boss'?'#ff8080':'#e8c9a0';ctx.fillText(label,ent.x,topY);drawBar(ctx,ent.x-17,topY+4,34,4,ent.hpPct/100,ent.t==='boss'?'#e6392b':'#4ade80','#5a1a1a')}}}
  {const np=e.map.shopNpc;if(np.x>left&&np.x<right&&np.y>top&&np.y<bottom){ctx.font='bold 11px "VT323", monospace';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,0.85)';ctx.strokeText('Ichiraku Ramen',np.x,np.y-36);ctx.fillStyle='#ffd9a0';ctx.fillText('Ichiraku Ramen',np.x,np.y-36)}}
  for(const f of e.floatTexts){const alpha=Math.max(0,Math.min(1,f.life/500));ctx.save();ctx.globalAlpha=alpha;ctx.font=f.crit?'bold 17px "VT323", monospace':'bold 13px "VT323", monospace';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,0.9)';ctx.strokeText(f.text,f.x,f.y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);ctx.restore()}
  if(e.input.hasRecentMouse()&&!e.you?.dm){const rect=e.canvas.getBoundingClientRect(),wx=e.camX+(e.input.state.aimX-rect.width/2)/e.zoom,wy=e.camY+(e.input.state.aimY-rect.height/2)/e.zoom;ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle='#f5f2ea';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(wx,wy,7,0,Math.PI*2);ctx.moveTo(wx-11,wy);ctx.lineTo(wx-4,wy);ctx.moveTo(wx+4,wy);ctx.lineTo(wx+11,wy);ctx.moveTo(wx,wy-11);ctx.lineTo(wx,wy-4);ctx.moveTo(wx,wy+4);ctx.lineTo(wx,wy+11);ctx.stroke();ctx.restore()}
  ctx.setTransform(1,0,0,1,0,0);const W=canvas.width,H=canvas.height
  if(e.damageFlashUntil>now){const a=(e.damageFlashUntil-now)/260;ctx.save();ctx.globalAlpha=a*.28;ctx.fillStyle='#c02020';ctx.fillRect(0,0,W,H);ctx.restore()}
  const hpPct=e.you?e.you.hp/Math.max(1,e.you.mh):1
  if(hpPct<.3&&!e.you?.dm){const pulse=.5+.5*Math.sin(now/300),g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.72);g.addColorStop(0,'rgba(160, 20, 20, 0)');g.addColorStop(1,`rgba(160, 20, 20, ${.22+pulse*.16})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
}

const FOOTPRINTS:Record<string,[number,number]>={tree:[1,1],tree2:[1,1],deadtree:[1,1],rock:[1,1],fence:[1,1],post:[1,1],lantern:[1,1],sign:[1,1],house:[3,2],shop:[3,2],fountain:[2,2]}
function drawBar(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,pct:number,color:string,bg:string){ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(x-1,y-1,w+2,h+2);ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);const p=Math.max(0,Math.min(1,pct));ctx.fillStyle=color;ctx.fillRect(x,y,w*p,h)}
