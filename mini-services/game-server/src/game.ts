import { BASIC, CRIT_CHANCE, CRIT_MULT, MAX_LEVEL, MONSTERS, MISSIONS, BOT_NAMES, POTION, PLAYER_SPEED, SKILLS, TIPS, VILLAGE_IDS, VILLAGE_NAMES, maxChOf, maxHpOf, atkOf, xpNeedOf, } from './data';
import { DESTRUCTIBLE_HP, DESTRUCTIBLE_REGEN_MS, destroyWorldObject, restoreWorldObject, genWorld, walkable, zoneAt, VILLAGE_SPAWNS } from './world';
import { BotBrain, botGreetHuman, scheduleBotReplies, BOT_TARGET } from './bots';
import { loadBotSave, loadSave, saveBotReal, saveReal } from './persist';
const EL_LIST = ['fogo', 'agua', 'raio', 'vento', 'terra'];
const BOT_NAMES_POOL = BOT_NAMES;
const rnd = Math.random;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const dir8 = (dx, dy) => { const oct=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8; return (oct+6)%8; };
const PVP_DAMAGE_SCALE = 0.65;
const PLAYER_HIT_RADIUS = 14;
const PVP_REWARD_COOLDOWN = 3 * 60 * 1000;
export class Game {
 constructor(io){this.world=genWorld();this.players=new Map();this.monsters=new Map();this.projectiles=new Map();this.pvpRewardAt=new Map();this.destroyedWorld=new Map();this.botProfiles=new Map(Object.entries(loadBotSave()));this.lastWorldRegen=0;this.nextId=1;this.saved={};this.tickCount=0;this.lastSave=0;this.lastTip=Date.now()+60000;this.lastLifecycle=Date.now()+20000;this.io=io;this.saved=loadSave();this.spawnMonsters();this.spawnInitialBots()}
 onlineCount(){return this.players.size}
 canStand(x,y){return walkable(this.world,x-7,y-2)&&walkable(this.world,x+7,y-2)&&walkable(this.world,x-7,y+11)&&walkable(this.world,x+7,y+11)&&walkable(this.world,x,y+5)}
 findWalkableNear(x,y,radius=100){
   for(let tries=0;tries<40;tries++){
     const px=x+(rnd()-.5)*radius*2,py=y+(rnd()-.5)*radius*2;
     if(this.canStand(px,py))return{x:px,y:py};
   }
   if(this.canStand(x,y))return{x,y};
   for(let ring=16;ring<=160;ring+=16){
     for(let a=0;a<Math.PI*2;a+=Math.PI/4){
       const px=x+Math.cos(a)*ring,py=y+Math.sin(a)*ring;
       if(this.canStand(px,py))return{x:px,y:py};
     }
   }
   return{x,y};
 }
 spawnMonsters(){for(const sz of this.world.spawns){const def=MONSTERS[sz.monster];for(let i=0;i<sz.count;i++){let x=0,y=0,ok=false;for(let tries=0;tries<40&&!ok;tries++){x=(sz.x1+rnd()*(sz.x2-sz.x1)+.5)*32;y=(sz.y1+rnd()*(sz.y2-sz.y1)+.5)*32;ok=walkable(this.world,x,y)}if(!ok)continue;this.monsters.set(this.nextId,{id:this.nextId++,t:sz.monster,name:def.name,lv:def.lv,hp:def.hp,maxHp:def.hp,atk:def.atk,xp:def.xp,goldMin:def.gold[0],goldMax:def.gold[1],speed:def.speed,aggroR:def.aggro,radius:def.radius,scale:def.scale,boss:!!def.boss,respawnMs:def.respawn,x,y,spawnX:x,spawnY:y,dir:0,aggroId:null,atkAt:0,dead:false,respawnAt:0,wanderT:0,wanderDir:rnd()*Math.PI*2,wanderMoving:false,slamAt:Date.now()+4000,slamPending:null,burnUntil:0,burnNextAt:0,burnDamage:0,burnOwnerId:null,slowUntil:0,stunUntil:0})}}console.log(`[mundo] ${this.monsters.size} monstros spawnados`)}
 spawnInitialBots(){for(let i=0;i<BOT_TARGET;i++)this.addBot();console.log(`[mundo] ${BOT_TARGET} shinobis (bots) conectados`)}
 addBot(){
   const used=new Set([...this.players.values()].map(p=>p.name.toLowerCase())),pool=[];
   for(const n of BOT_NAMES_POOL)if(!used.has(n.toLowerCase()))pool.push(n);
   if(!pool.length)return null;

   const returning=pool.filter(n=>this.botProfiles.has(n.toLowerCase()));
   const name=returning.length&&rnd()<.7
     ? returning[Math.floor(rnd()*returning.length)]
     : pool[Math.floor(rnd()*pool.length)];
   const key=name.toLowerCase(),profile=this.botProfiles.get(key);

   let village=profile?.village;
   if(!village||!VILLAGE_IDS.includes(village)){
     const counts=Object.fromEntries(VILLAGE_IDS.map(v=>[v,0]));
     for(const p of this.players.values())if(p.kind==='bot')counts[p.village]=(counts[p.village]||0)+1;
     village=VILLAGE_IDS.reduce((best,v)=>counts[v]<counts[best]?v:best,VILLAGE_IDS[0]);
   }

   const el=profile?.el&&EL_LIST.includes(profile.el)?profile.el:EL_LIST[Math.floor(rnd()*EL_LIST.length)];
   const lv=Math.max(1,Math.min(MAX_LEVEL,Number(profile?.lv)||1));
   const xp=Math.max(0,Number(profile?.xp)||0);
   const home=VILLAGE_SPAWNS[village],spawn=this.findWalkableNear(home.x,home.y,100);
   const ent={
     id:this.nextId++,kind:'bot',name,el,village,pal:Number.isInteger(profile?.pal)?profile.pal:Math.floor(rnd()*64),
     lv,xp,hp:maxHpOf(lv),ch:maxChOf(lv),gold:Math.max(0,Number(profile?.gold)||80),
     pot:Math.max(0,Math.min(POTION.max,Number(profile?.pot)||POTION.start)),
     x:spawn.x,y:spawn.y,dir:0,dead:false,known:new Map(),lastMoveAt:Date.now(),lastCombatAt:0,
     cds:[0,0,0,0,0,0],mi:Math.max(0,Math.min(MISSIONS.length-1,Number(profile?.mi)||0)),
     mp:Math.max(0,Number(profile?.mp)||0),lastChatAt:0,lastHealAt:0
   };
   ent.bot=new BotBrain(this,ent);this.players.set(ent.id,ent);return ent;
 }
 rememberBot(ent){
   if(!ent||ent.kind!=='bot')return;
   this.botProfiles.set(ent.name.toLowerCase(),{
     el:ent.el,village:ent.village,pal:ent.pal,lv:ent.lv,xp:ent.xp,gold:ent.gold,pot:ent.pot,mi:ent.mi,mp:ent.mp
   });
 }
 sanitizeName(raw){let n=(raw||'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim().replace(/\s+/g,' ');return n.replace(/[^A-Za-z0-9À-ÿ_\-\. ]/g,'').slice(0,14)}
 addHuman(socket,rawName,el,requestedVillage){
   const existingId=socket.data?.pid;
   if(typeof existingId==='number'&&this.players.has(existingId))return{ok:false,error:'Você já está conectado.'};
   const name=this.sanitizeName(rawName);
   if(name.length<2)return{ok:false,error:'Nome inválido (mínimo 2 caracteres).'};
   if(!EL_LIST.includes(el))el='fogo';
   let finalName=name;
   const taken=n=>[...this.players.values()].some(p=>p.name.toLowerCase()===n.toLowerCase());
   if(taken(finalName)){
     let suffix=2;
     while(true){
       const tag=`_${suffix}`,candidate=`${name.slice(0,Math.max(2,14-tag.length))}${tag}`;
       if(!taken(candidate)){finalName=candidate;break}
       suffix++;
     }
   }
   const saved=this.saved[finalName.toLowerCase()],lv=saved?Math.max(1,Math.min(MAX_LEVEL,Number(saved.lv)||1)):1;
   const requested=VILLAGE_IDS.includes(requestedVillage)?requestedVillage:'folha';
   const village=saved?.village&&VILLAGE_IDS.includes(saved.village)?saved.village:requested;
   const home=VILLAGE_SPAWNS[village],spawn=this.findWalkableNear(home.x,home.y,20);
   const ent={id:this.nextId++,kind:'human',name:finalName,el,village,pal:Math.floor(rnd()*64),lv,xp:saved?saved.xp:0,hp:maxHpOf(lv),ch:maxChOf(lv),gold:saved?saved.gold:80,pot:saved?saved.pot:POTION.start,x:spawn.x,y:spawn.y,dir:0,dead:false,socket,known:new Map(),lastMoveAt:Date.now(),lastCombatAt:0,cds:[0,0,0,0,0,0],mi:0,mp:0,lastChatAt:0,lastHealAt:0};
   this.players.set(ent.id,ent);socket.data.pid=ent.id;
   socket.emit('welcome',{id:ent.id,t:Date.now(),online:this.players.size,self:{n:ent.name,el,village:ent.village,lv:ent.lv,xp:ent.xp,gold:ent.gold,pot:ent.pot,x:ent.x,y:ent.y},map:{w:this.world.w,h:this.world.h,tiles:this.world.tiles,objects:this.world.objects,zones:this.world.zones,fountains:this.world.fountains,fountain:this.world.fountain,shops:this.world.shops,shopNpc:this.world.shopNpc},skills:SKILLS[el].map(s=>({name:s.name,archetype:s.archetype,cd:s.cd,ch:s.ch,range:s.range})),missions:MISSIONS.map(m=>({name:m.name,monster:m.monster,need:m.need})),roster:[...this.players.values()].map(p=>({id:p.id,n:p.name,lv:p.lv,el:p.el,v:p.village,pal:p.pal}))});
   this.broadcast('pJoin',{id:ent.id,n:ent.name,lv:ent.lv,el:ent.el,v:ent.village,pal:ent.pal});this.sys(`${ent.name} entrou no jogo.`);botGreetHuman(this,ent);return{ok:true};
 }
 removeHuman(socket){const ent=this.players.get(socket.data?.pid);if(!ent)return;this.players.delete(ent.id);this.broadcast('pLeave',{id:ent.id});this.sys(`${ent.name} saiu do jogo.`);this.saved[ent.name.toLowerCase()]={el:ent.el,village:ent.village,lv:ent.lv,xp:ent.xp,gold:ent.gold,pot:ent.pot};saveReal(this.saved)}
 entOf(socket){return this.players.get(socket.data?.pid)}
 canPvp(attacker,target){
   if(!attacker||!target||attacker.id===target.id||attacker.dead||target.dead)return false;
   if(attacker.village===target.village)return false;
   return !zoneAt(this.world,attacker.x,attacker.y).safe&&!zoneAt(this.world,target.x,target.y).safe;
 }
 pvpXpReward(killer,victim,now=Date.now()){
   if(!killer||!victim||killer.village===victim.village||killer.lv>=MAX_LEVEL)return 0;
   const key=`${killer.name.toLowerCase()}>${victim.name.toLowerCase()}`,last=this.pvpRewardAt.get(key)||0;
   if(now-last<PVP_REWARD_COOLDOWN)return 0;
   this.pvpRewardAt.set(key,now);
   const levelFactor=Math.max(.5,Math.min(1.25,(victim.lv+4)/(killer.lv+4)));
   return Math.max(10,Math.round((25+victim.lv*8)*levelFactor));
 }
 destructibleAt(x,y,radius=18){
   let best=null,bestD=Infinity;
   for(const o of this.world.objects){
     if(!DESTRUCTIBLE_HP[o.k]||!Number.isFinite(o.hp)||o.hp<=0)continue;
     const cx=(o.x+.5)*32,cy=(o.y+.5)*32,d=Math.hypot(cx-x,cy-y);
     if(d<=radius+18&&d<bestD){best=o;bestD=d}
   }
   return best;
 }
 hitWorldObject(obj,base,attacker){
   if(!obj||!DESTRUCTIBLE_HP[obj.k]||!Number.isFinite(obj.hp)||obj.hp<=0)return false;
   const dmg=Math.max(1,Math.round(base*(.9+rnd()*.2))),cx=(obj.x+.5)*32,cy=(obj.y+.5)*32;
   obj.hp-=dmg;
   this.emitNear(cx,cy,900,'fx',{k:'objhit',sid:attacker?.id,el:attacker?.el||'terra',x:cx,y:cy});
   if(obj.hp<=0){
     const gone=destroyWorldObject(this.world,obj.id);
     if(gone){
       const [minMs,maxMs]=DESTRUCTIBLE_REGEN_MS[gone.k]||[240000,420000];
       const respawnAt=Date.now()+minMs+Math.floor(rnd()*(maxMs-minMs+1));
       this.destroyedWorld.set(gone.id,{obj:gone,respawnAt});
       this.broadcast('objDestroy',{id:gone.id,k:gone.k,x:gone.x,y:gone.y,respawnAt});
       this.emitNear(cx,cy,1000,'fx',{k:'objbreak',sid:attacker?.id,el:attacker?.el||'terra',x:cx,y:cy});
     }
   }
   return true;
 }
 damageWorldRadius(x,y,radius,base,attacker){
   for(const o of [...this.world.objects]){
     if(!DESTRUCTIBLE_HP[o.k]||!Number.isFinite(o.hp)||o.hp<=0)continue;
     const cx=(o.x+.5)*32,cy=(o.y+.5)*32;
     if(Math.hypot(cx-x,cy-y)<=radius+18)this.hitWorldObject(o,base,attacker);
   }
 }
 hitPlayer(target,attacker,base,mult=1,elemental=false){
   if(!this.canPvp(attacker,target))return false;
   const now=Date.now(),lightningBonus=(elemental&&attacker.el==='raio')?0.12:0,crit=rnd()<CRIT_CHANCE+lightningBonus;
   let dmg=base*mult*PVP_DAMAGE_SCALE*(.9+rnd()*.2);
   if(crit)dmg*=CRIT_MULT;
   if(target.el==='terra')dmg*=.84;
   dmg=Math.max(1,Math.round(dmg));
   target.hp-=dmg;attacker.lastCombatAt=now;target.lastCombatAt=now;
   this.emitNear(target.x,target.y,900,'dmg',{tid:target.id,x:target.x,y:target.y-30,v:dmg,c:crit?1:0,tp:1,pvp:1});
   if(target.bot)target.bot.onPvpHit(attacker);
   if(target.hp<=0)this.killPlayerPvp(target,attacker);
   return true;
 }
 killPlayerPvp(victim,killer){
   victim.hp=0;victim.dead=true;this.forgetEntity(victim.id);
   const xp=this.pvpXpReward(killer,victim);
   if(xp>0)this.gainXp(killer,xp);
   this.emitNear(victim.x,victim.y,1000,'fx',{k:'pdeath',x:victim.x,y:victim.y});
   this.broadcast('kill',{k:killer.name,klv:killer.lv,v:victim.name,mlv:victim.lv,g:0,xp,pvp:1});
   if(victim.kind==='human')victim.socket?.emit('dead',{by:killer.name});
   else victim.bot?.onDeath(killer);
 }
 broadcast(ev,payload){for(const p of this.players.values())if(p.kind==='human'&&p.socket)p.socket.emit(ev,payload)} emitNear(x,y,r,ev,payload){for(const p of this.players.values())if(p.kind==='human'&&p.socket&&Math.abs(p.x-x)<r&&Math.abs(p.y-y)<r)p.socket.emit(ev,payload)} sys(text){this.broadcast('sys',{t:text})} chatOut(ent,text){this.broadcast('chat',{id:ent.id,n:ent.name,lv:ent.lv,el:ent.el,text})} forgetEntity(id){for(const p of this.players.values())p.known.delete(id)}
 handleMove(socket,msg){
   const ent=this.entOf(socket);
   if(!ent||ent.dead)return;
   if(!isFiniteNumber(msg?.x)||!isFiniteNumber(msg?.y))return;
   const now=Date.now(),dt=Math.max(0,Math.min(250,now-ent.lastMoveAt))/1000,maxD=(PLAYER_SPEED+55)*dt+34;
   let dx=msg.x-ent.x,dy=msg.y-ent.y;
   const requestedDistance=Math.hypot(dx,dy);
   if(!Number.isFinite(requestedDistance))return;
   if(requestedDistance>maxD&&requestedDistance>0){dx=dx/requestedDistance*maxD;dy=dy/requestedDistance*maxD}
   const distance=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(distance/8)),stepX=dx/steps,stepY=dy/steps;
   for(let i=0;i<steps;i++){
     const nx=Math.max(8,Math.min(this.world.w*32-8,ent.x+stepX)),ny=Math.max(8,Math.min(this.world.h*32-8,ent.y+stepY));
     if(this.canStand(nx,ny)){ent.x=nx;ent.y=ny;continue}
     if(this.canStand(nx,ent.y))ent.x=nx;
     if(this.canStand(ent.x,ny))ent.y=ny;
     break;
   }
   ent.lastMoveAt=now;
   if(Number.isInteger(msg.dir)&&msg.dir>=0&&msg.dir<=7)ent.dir=msg.dir;
 }
 basicAttack(ent,tx,ty){if(ent.dead)return;if(!isFiniteNumber(tx)||!isFiniteNumber(ty)){tx=ent.x;ty=ent.y+1}const now=Date.now();if(now<ent.cds[0])return;let dx=tx-ent.x,dy=ty-ent.y;const d=Math.hypot(dx,dy);if(d<1){dx=0;dy=1}const ang=Math.atan2(dy,dx);ent.cds[0]=now+BASIC.cd;ent.lastCombatAt=now;this.emitNear(ent.x,ent.y,900,'fx',{k:'slash',sid:ent.id,x:ent.x,y:ent.y,tx,ty});for(const m of this.monsters.values()){if(m.dead)continue;const md=dist(m,ent);if(md>BASIC.range+m.radius)continue;const mang=Math.atan2(m.y-ent.y,m.x-ent.x);let diff=Math.abs(mang-ang);if(diff>Math.PI)diff=Math.PI*2-diff;if(diff<BASIC.arc*Math.PI/180)this.hitMonster(m,ent,atkOf(ent.lv),1)}for(const p of this.players.values()){if(!this.canPvp(ent,p))continue;const pd=dist(p,ent);if(pd>BASIC.range+PLAYER_HIT_RADIUS)continue;const pang=Math.atan2(p.y-ent.y,p.x-ent.x);let diff=Math.abs(pang-ang);if(diff>Math.PI)diff=Math.PI*2-diff;if(diff<BASIC.arc*Math.PI/180)this.hitPlayer(p,ent,atkOf(ent.lv),1,false)}}
 castSkill(ent,idx,tx,ty){if(ent.dead||idx<0||idx>3)return false;if(!isFiniteNumber(tx)||!isFiniteNumber(ty)){tx=ent.x;ty=ent.y+1}const s=SKILLS[ent.el][idx],now=Date.now();if(now<ent.cds[1+idx]||ent.ch<s.ch)return false;let dx=tx-ent.x,dy=ty-ent.y;const d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;ent.dir=dir8(nx,ny);ent.cds[1+idx]=now+s.cd;ent.ch-=s.ch;ent.lastCombatAt=now;const el=ent.el;switch(s.archetype){case'proj':this.spawnProjectile(ent,idx,nx,ny,s.speed,s.mult,false,10,s.range);this.emitNear(ent.x,ent.y,900,'fx',{k:'cast',sid:ent.id,el,x:ent.x,y:ent.y});break;case'multi':{const count=Math.max(1,s.count||3),mid=(count-1)/2;for(let i=0;i<count;i++){const a=Math.atan2(ny,nx)+(i-mid)*.18;this.spawnProjectile(ent,idx,Math.cos(a),Math.sin(a),s.speed,s.mult,false,9,s.range)}this.emitNear(ent.x,ent.y,900,'fx',{k:'cast',sid:ent.id,el,x:ent.x,y:ent.y});break;}case'line':this.spawnProjectile(ent,idx,nx,ny,s.speed,s.mult,true,15,s.range);this.emitNear(ent.x,ent.y,900,'fx',{k:'cast',sid:ent.id,el,x:ent.x,y:ent.y});break;case'dash':{const want=Math.min(s.range,d);let moved=0;const hitSet=new Set();while(moved<want){const step=Math.min(13,want-moved),nxp=ent.x+nx*step,nyp=ent.y+ny*step;if(!walkable(this.world,nxp,nyp)){const obj=this.destructibleAt(nxp,nyp,22);if(obj)this.hitWorldObject(obj,atkOf(ent.lv)*s.mult*1.15,ent);if(!walkable(this.world,nxp,nyp))break}ent.x=nxp;ent.y=nyp;moved+=step;for(const m of this.monsters.values())if(!m.dead&&!hitSet.has(m.id)&&dist(m,ent)<46+m.radius){hitSet.add(m.id);this.hitMonster(m,ent,atkOf(ent.lv),s.mult,true)}for(const p of this.players.values())if(this.canPvp(ent,p)&&!hitSet.has(p.id)&&dist(p,ent)<46+PLAYER_HIT_RADIUS){hitSet.add(p.id);this.hitPlayer(p,ent,atkOf(ent.lv),s.mult,true)}}this.emitNear(ent.x,ent.y,1100,'fx',{k:'dash',sid:ent.id,el,x:ent.x,y:ent.y,tx:ent.x+nx*60,ty:ent.y+ny*60});break}case'aoe':{const cd=Math.min(s.range,d),cx=ent.x+nx*cd,cy=ent.y+ny*cd;this.emitNear(cx,cy,1100,'fx',{k:'aoe',sid:ent.id,el,x:cx,y:cy,r:s.radius});this.damageWorldRadius(cx,cy,s.radius,atkOf(ent.lv)*s.mult,ent);for(const m of this.monsters.values())if(!m.dead&&dist(m,{x:cx,y:cy})<s.radius+m.radius)this.hitMonster(m,ent,atkOf(ent.lv),s.mult,true);for(const p of this.players.values())if(this.canPvp(ent,p)&&dist(p,{x:cx,y:cy})<s.radius+PLAYER_HIT_RADIUS)this.hitPlayer(p,ent,atkOf(ent.lv),s.mult,true);break}}return true}
 spawnProjectile(ent,idx,nx,ny,speed,mult,pierce,radius,range){const id=this.nextId++;this.projectiles.set(id,{id,owner:ent.id,x:ent.x+nx*22,y:ent.y+ny*22-6,vx:nx*speed,vy:ny*speed,k:EL_LIST.indexOf(ent.el)*4+idx,dmg:atkOf(ent.lv)*mult,pierce,radius,ttl:range/speed,hitIds:new Set()})}
 hitMonster(m,attacker,base,mult,elemental=false){
   const now=Date.now();
   const lightningBonus=(elemental&&attacker.el==='raio')?0.12:0;
   const crit=rnd()<CRIT_CHANCE+lightningBonus;
   let dmg=base*mult*(.9+rnd()*.2);
   if(crit)dmg*=CRIT_MULT;
   dmg=Math.max(1,Math.round(dmg));
   m.hp-=dmg;
   m.aggroId=attacker.id;
   attacker.lastCombatAt=now;

   if(elemental){
     switch(attacker.el){
       case'fogo':
         m.burnUntil=now+2200;
         m.burnNextAt=Math.min(m.burnNextAt||now,now+500);
         m.burnDamage=Math.max(2,Math.round(dmg*.08));
         m.burnOwnerId=attacker.id;
         break;
       case'agua':
         m.slowUntil=Math.max(m.slowUntil,now+1800);
         attacker.ch=Math.min(maxChOf(attacker.lv),attacker.ch+2);
         break;
       case'vento':{
         if(!m.boss){
           const dx=m.x-attacker.x,dy=m.y-attacker.y,d=Math.hypot(dx,dy)||1;
           const nx=m.x+dx/d*24,ny=m.y+dy/d*24;
           if(walkable(this.world,nx,ny)){m.x=nx;m.y=ny}
         }
         break;
       }
       case'terra':
         m.stunUntil=Math.max(m.stunUntil,now+(m.boss?220:520));
         break;
     }
   }

   this.emitNear(m.x,m.y,900,'dmg',{x:m.x,y:m.y-26,v:dmg,c:crit?1:0,tid:m.id});
   if(m.hp<=0)this.killMonster(m,attacker);
 }
 killMonster(m,killer){m.hp=0;m.dead=true;m.aggroId=null;m.slamPending=null;m.respawnAt=Date.now()+m.respawnMs;this.forgetEntity(m.id);this.emitNear(m.x,m.y,1000,'fx',{k:'death',x:m.x,y:m.y,boss:m.boss?1:0});const gold=m.goldMin+Math.floor(rnd()*(m.goldMax-m.goldMin+1));killer.gold+=gold;this.broadcast('kill',{k:killer.name,klv:killer.lv,v:m.name,mlv:m.lv,g:gold,xp:m.xp});this.gainXp(killer,m.xp);this.progressMission(killer,m.t)}
 gainXp(ent,xp){if(ent.lv>=MAX_LEVEL)return;ent.xp+=xp;let leveled=false;while(ent.lv<MAX_LEVEL&&ent.xp>=xpNeedOf(ent.lv)){ent.xp-=xpNeedOf(ent.lv);ent.lv++;ent.hp=maxHpOf(ent.lv);ent.ch=maxChOf(ent.lv);leveled=true}if(leveled){this.emitNear(ent.x,ent.y,1000,'fx',{k:'lvl',x:ent.x,y:ent.y});this.broadcast('lvl',{id:ent.id,lv:ent.lv,n:ent.name});if(ent.kind==='human')this.sys(`${ent.name} alcançou o nível ${ent.lv}!`);if(ent.bot)ent.bot.onLevelUp()}}
 progressMission(ent,monsterType){const mi=MISSIONS[ent.mi];if(!mi||(mi.monster!=='any'&&mi.monster!==monsterType))return;ent.mp++;if(ent.mp>=mi.need){ent.gold+=mi.gold;this.gainXp(ent,mi.xp);ent.socket?.emit('mission',{i:ent.mi,done:true,name:mi.name,gold:mi.gold,xp:mi.xp});if(ent.kind==='human')this.sys(`${ent.name} completou a missão "${mi.name}"!`);if(mi.repeat)ent.mp=0;else{ent.mi=Math.min(ent.mi+1,MISSIONS.length-1);ent.mp=0}const next=MISSIONS[ent.mi];ent.socket?.emit('mission',{i:ent.mi,name:next.name,monster:next.monster,need:next.need,prog:0});ent.bot?.onMissionAdvance()}else ent.socket?.emit('mission',{i:ent.mi,prog:ent.mp,need:mi.need,name:mi.name})}
 usePotion(ent){if(ent.dead||ent.pot<=0)return false;const now=Date.now();if(now<ent.cds[5])return false;ent.cds[5]=now+POTION.cd;ent.pot--;const heal=Math.round(maxHpOf(ent.lv)*POTION.healPct);ent.hp=Math.min(maxHpOf(ent.lv),ent.hp+heal);ent.lastCombatAt=now;this.emitNear(ent.x,ent.y,800,'dmg',{x:ent.x,y:ent.y-26,v:heal,h:1});this.emitNear(ent.x,ent.y,800,'fx',{k:'heal',x:ent.x,y:ent.y});return true}
 damagePlayer(ent,dmg,src){if(ent.dead||zoneAt(this.world,ent.x,ent.y).safe)return;if(ent.el==='terra')dmg*=.84;ent.hp-=Math.round(dmg);ent.lastCombatAt=Date.now();this.emitNear(ent.x,ent.y,900,'dmg',{tid:ent.id,x:ent.x,y:ent.y-30,v:Math.round(dmg),c:0,tp:1});if(ent.hp<=0){ent.hp=0;ent.dead=true;this.forgetEntity(ent.id);this.emitNear(ent.x,ent.y,1000,'fx',{k:'pdeath',x:ent.x,y:ent.y});if(ent.kind==='human')ent.socket?.emit('dead',{by:src.name});else ent.bot?.onDeath(src)}}
 respawnPlayer(ent){if(!ent.dead)return;ent.dead=false;ent.hp=maxHpOf(ent.lv);ent.ch=maxChOf(ent.lv);const home=VILLAGE_SPAWNS[ent.village]||VILLAGE_SPAWNS.folha,spawn=this.findWalkableNear(home.x,home.y,60);ent.x=spawn.x;ent.y=spawn.y;ent.cds=[0,0,0,0,0,0];if(ent.kind==='human')ent.socket?.emit('revived',{x:ent.x,y:ent.y})}
 handleChat(socket,msg){const ent=this.entOf(socket);if(!ent)return;const now=Date.now();if(now-ent.lastChatAt<1200)return;ent.lastChatAt=now;const text=String(msg?.text||'').slice(0,120).trim();if(!text)return;this.chatOut(ent,text);scheduleBotReplies(this,ent,text)}
 handleInteract(socket){const ent=this.entOf(socket);if(!ent||ent.dead)return;const now=Date.now(),f=this.world.fountains.find(q=>dist(ent,q)<100);if(f){if(now-ent.lastHealAt>4000){ent.lastHealAt=now;ent.hp=maxHpOf(ent.lv);ent.ch=maxChOf(ent.lv);this.emitNear(ent.x,ent.y,800,'fx',{k:'heal',x:ent.x,y:ent.y});socket.emit('sys',{t:'Você recuperou suas forças na fonte da vila.'})}return}const shop=this.world.shops.find(q=>dist(ent,q)<105);if(shop)socket.emit('shop',{open:true,name:shop.name,gold:ent.gold,pot:ent.pot,price:POTION.price})}
 handleBuyPotion(socket){const ent=this.entOf(socket);if(!ent)return;const shop=this.world.shops.find(q=>dist(ent,q)<145);if(!shop)return;if(ent.pot>=POTION.max){socket.emit('sys',{t:'Você já está carregando poções demais.'});return}if(ent.gold<POTION.price){socket.emit('sys',{t:'Ryō insuficiente! Cace monstros para ganhar mais.'});return}ent.gold-=POTION.price;ent.pot++;socket.emit('shop',{open:true,name:shop.name,gold:ent.gold,pot:ent.pot,price:POTION.price});socket.emit('sys',{t:'Poção comprada! Aperte Q para usar em combate.'})}
 tick(){const dt=.05,now=Date.now();this.tickCount++;this.updateMonsters(dt,now);this.updateProjectiles(dt);this.updateRegen(dt,now);this.updateWorldRespawns(now);for(const p of this.players.values())if(p.bot)p.bot.think(dt,now);this.updateBotLifecycle(now);this.sendSnapshots(now);if(now>this.lastTip){this.lastTip=now+90000+rnd()*60000;this.sys(TIPS[Math.floor(rnd()*TIPS.length)])}if(now-this.lastSave>30000){this.lastSave=now;for(const p of this.players.values()){if(p.kind==='human')this.saved[p.name.toLowerCase()]={el:p.el,village:p.village,lv:p.lv,xp:p.xp,gold:p.gold,pot:p.pot};else if(p.kind==='bot')this.rememberBot(p)}saveReal(this.saved);saveBotReal(Object.fromEntries(this.botProfiles))}}
 updateMonsters(dt,now){for(const m of this.monsters.values()){if(m.dead){if(now>=m.respawnAt){m.dead=false;m.hp=m.maxHp;m.aggroId=null;m.burnUntil=0;m.burnNextAt=0;m.burnDamage=0;m.burnOwnerId=null;m.slowUntil=0;m.stunUntil=0;m.x=m.spawnX+(rnd()-.5)*60;m.y=m.spawnY+(rnd()-.5)*60;if(!walkable(this.world,m.x,m.y)){m.x=m.spawnX;m.y=m.spawnY}if(m.boss)this.sys('O Zetsu Ancião surgiu no Vale do Fim!')}continue}
if(m.burnUntil>now&&m.burnOwnerId!=null&&now>=m.burnNextAt){
  m.burnNextAt=now+650;
  const owner=this.players.get(m.burnOwnerId);
  if(owner&&!owner.dead){
    const burn=Math.max(1,Math.round(m.burnDamage));
    m.hp-=burn;
    this.emitNear(m.x,m.y,900,'dmg',{x:m.x+(rnd()-.5)*10,y:m.y-24,v:burn,c:0,tid:m.id});
    if(m.hp<=0){this.killMonster(m,owner);continue}
  }
}
if(now<m.stunUntil)continue;
if(m.boss&&m.slamPending&&now>=m.slamPending.at){const sp=m.slamPending;m.slamPending=null;this.emitNear(sp.x,sp.y,1200,'fx',{k:'slam',x:sp.x,y:sp.y,r:135});for(const p of this.players.values())if(!p.dead&&dist(p,sp)<135)this.damagePlayer(p,m.atk*1.35,m)}let target=m.aggroId!=null?this.players.get(m.aggroId):undefined;if(target&&(target.dead||dist(target,m)>560||dist(target,{x:m.spawnX,y:m.spawnY})>640||zoneAt(this.world,target.x,target.y).safe)){m.aggroId=null;target=undefined}if(!m.aggroId){let best,bestD=Infinity;for(const p of this.players.values()){if(p.dead||zoneAt(this.world,p.x,p.y).safe||dist(p,{x:m.spawnX,y:m.spawnY})>460)continue;const d=dist(p,m);if(d<m.aggroR&&d<bestD){best=p;bestD=d}}if(best){m.aggroId=best.id;target=best}}if(target){const d=dist(target,m),reach=m.radius+14;if(d>reach)this.moveMonster(m,target.x,target.y,m.speed*dt);else if(now>=m.atkAt){m.atkAt=now+(m.boss?1500:1250);if(m.boss&&now>=m.slamAt){m.slamAt=now+7000;m.slamPending={x:target.x,y:target.y,at:now+950};this.emitNear(target.x,target.y,1200,'fx',{k:'slamwarn',x:target.x,y:target.y,r:135})}else{this.damagePlayer(target,m.atk*(.9+rnd()*.25),m);this.emitNear(target.x,target.y,900,'fx',{k:'mhit',x:target.x,y:target.y})}}}else{m.wanderT-=dt;if(m.wanderT<=0){m.wanderT=1.2+rnd()*3;m.wanderDir=rnd()*Math.PI*2;m.wanderMoving=rnd()<.55}const far=dist(m,{x:m.spawnX,y:m.spawnY});if(far>170)this.moveMonster(m,m.spawnX,m.spawnY,m.speed*.5*dt);else if(m.wanderMoving)this.moveMonster(m,m.x+Math.cos(m.wanderDir)*m.speed*.35*dt,m.y+Math.sin(m.wanderDir)*m.speed*.35*dt,m.speed*.35*dt)}}}
 moveMonster(m,tx,ty,step){
   if(Date.now()<m.slowUntil)step*=.52;
   const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy);
   if(d<.5)return;
   const sx=dx/d*step,sy=dy/d*step;
   if(Math.abs(dx)>Math.abs(dy))m.dir=dx>0?3:2;else m.dir=dy>0?0:1;
   if(walkable(this.world,m.x+sx,m.y+sy)){m.x+=sx;m.y+=sy}
   else if(walkable(this.world,m.x+sx,m.y))m.x+=sx;
   else if(walkable(this.world,m.x,m.y+sy))m.y+=sy;
 }
 updateProjectiles(dt){for(const pr of[...this.projectiles.values()]){pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;pr.ttl-=dt;let dead=pr.ttl<=0;const owner=this.players.get(pr.owner);if(!dead){const obj=this.destructibleAt(pr.x,pr.y,pr.radius+6);if(obj&&owner){const oid=-obj.id-1;if(!pr.hitIds.has(oid)){pr.hitIds.add(oid);this.hitWorldObject(obj,pr.dmg,owner)}if(!pr.pierce)dead=true}if(!dead&&!walkable(this.world,pr.x,pr.y))dead=true}if(!dead){for(const m of this.monsters.values())if(!m.dead&&!pr.hitIds.has(m.id)&&dist(m,pr)<m.radius+pr.radius){pr.hitIds.add(m.id);if(owner)this.hitMonster(m,owner,pr.dmg,1,true);if(!pr.pierce){dead=true;break}}if(!dead&&owner){for(const p of this.players.values()){if(!this.canPvp(owner,p)||pr.hitIds.has(p.id)||dist(p,pr)>=PLAYER_HIT_RADIUS+pr.radius)continue;pr.hitIds.add(p.id);this.hitPlayer(p,owner,pr.dmg,1,true);if(!pr.pierce){dead=true;break}}}}if(dead)this.projectiles.delete(pr.id)}}
 updateRegen(dt,now){for(const p of this.players.values()){const maxCh=maxChOf(p.lv),maxHp=maxHpOf(p.lv);if(!p.dead){p.ch=Math.min(maxCh,p.ch+5.5*dt);if(now-p.lastCombatAt>6000)p.hp=Math.min(maxHp,p.hp+2.2*dt)}}}
 worldObjectOccupied(obj){
   const cx=(obj.x+.5)*32,cy=(obj.y+.5)*32;
   for(const p of this.players.values())if(!p.dead&&Math.hypot(p.x-cx,p.y-cy)<42)return true;
   for(const m of this.monsters.values())if(!m.dead&&Math.hypot(m.x-cx,m.y-cy)<42)return true;
   return false;
 }
 updateWorldRespawns(now){
   if(now<this.lastWorldRegen)return;
   this.lastWorldRegen=now+1000;
   for(const [id,entry] of this.destroyedWorld){
     if(now<entry.respawnAt)continue;
     if(this.worldObjectOccupied(entry.obj)){
       entry.respawnAt=now+15000+Math.floor(rnd()*30001);
       continue;
     }
     if(restoreWorldObject(this.world,entry.obj)){
       this.destroyedWorld.delete(id);
       this.broadcast('objRespawn',{id:entry.obj.id,k:entry.obj.k,x:entry.obj.x,y:entry.obj.y,hp:entry.obj.hp});
       const cx=(entry.obj.x+.5)*32,cy=(entry.obj.y+.5)*32;
       this.emitNear(cx,cy,1000,'fx',{k:'objgrow',x:cx,y:cy,el:'terra'});
     }else{
       entry.respawnAt=now+15000+Math.floor(rnd()*30001);
     }
   }
 }
 updateBotLifecycle(now){if(now<this.lastLifecycle)return;this.lastLifecycle=now+25000;const bots=[...this.players.values()].filter(p=>p.kind==='bot');if(bots.length>BOT_TARGET-4&&rnd()<.55){const b=bots[Math.floor(rnd()*bots.length)];if(b&&!b.bot?.inCombat()){if(rnd()<.45)b.bot?.sayFarewell();this.rememberBot(b);this.players.delete(b.id);this.forgetEntity(b.id);this.broadcast('pLeave',{id:b.id});this.sys(`${b.name} saiu do jogo.`)}}else if(bots.length<BOT_TARGET+3&&rnd()<.6){const b=this.addBot();if(b){this.broadcast('pJoin',{id:b.id,n:b.name,lv:b.lv,el:b.el,v:b.village,pal:b.pal});this.sys(`${b.name} entrou no jogo.`);if(rnd()<.5)b.bot?.sayJoin()}}}
 sendSnapshots(now){
   const view=1080,metaRefresh=4000;
   for(const h of this.players.values()){
     if(h.kind!=='human'||!h.socket)continue;
     const p=[],m=[],pr=[],nf=[],known=h.known,visible=new Set();

     for(const e of this.players.values()){
       if(e.dead||Math.abs(e.x-h.x)>view||Math.abs(e.y-h.y)>view)continue;
       visible.add(e.id);
       p.push([e.id,Math.round(e.x),Math.round(e.y),e.dir,Math.round(e.hp),e.lv]);
       const lastMeta=known.get(e.id)||0;
       if(now-lastMeta>=metaRefresh){
         nf.push({k:'p',id:e.id,n:e.name,lv:e.lv,el:e.el,v:e.village,pal:e.pal});
         known.set(e.id,now);
       }
     }

     for(const mo of this.monsters.values()){
       if(mo.dead||Math.abs(mo.x-h.x)>view||Math.abs(mo.y-h.y)>view)continue;
       visible.add(mo.id);
       m.push([mo.id,Math.round(mo.x),Math.round(mo.y),mo.dir,Math.round(mo.hp/mo.maxHp*100)]);
       const lastMeta=known.get(mo.id)||0;
       if(now-lastMeta>=metaRefresh){
         nf.push({k:'m',id:mo.id,t:mo.t,n:mo.name,lv:mo.lv});
         known.set(mo.id,now);
       }
     }

     // Ao sair da área de interesse, esquece imediatamente. Ao voltar,
     // o cliente recebe novamente os metadados necessários para renderizar.
     for(const id of [...known.keys()])if(!visible.has(id))known.delete(id);

     for(const q of this.projectiles.values()){
       if(Math.abs(q.x-h.x)<=1400&&Math.abs(q.y-h.y)<=1400)
         pr.push([q.id,Math.round(q.x),Math.round(q.y),Math.round(q.vx),Math.round(q.vy),q.k]);
     }

     h.socket.emit('snapshot',{t:now,p,m,pr,nf,you:{
       hp:Math.round(h.hp),mh:maxHpOf(h.lv),ch:Math.round(h.ch),mc:maxChOf(h.lv),
       xp:Math.round(h.xp),need:xpNeedOf(h.lv),lvl:h.lv,gold:h.gold,pot:h.pot,
       cds:h.cds.map(c=>Math.max(0,c-now)),mi:h.mi,mp:h.mp,dm:h.dead?1:0
     }});
   }
 }

}
