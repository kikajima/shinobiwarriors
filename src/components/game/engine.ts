'use client';
import { net } from './net';
import { InputController } from './input';
import { audio } from './audio';
import { buildCharSprites, buildMonsterSprites, buildNpcSprites, PIX_SCALE } from './sprites';
import type { GameArt } from './assets';
import { drawGame } from './renderer';
import { EL_LIST, type ElementId, type FxData, type DmgData, type SnapshotData, type WelcomeData, type YouState, maxHpOf, TILE } from './types';
export interface Entity {
    id: number; kind: 'player' | 'monster'; n: string; lv: number; el?: ElementId; pal: number; t?: string;
    hp: number; hpPct: number; dir: number;
    ax: number; ay: number; at: number; bx: number; by: number; bt: number;
    x: number; y: number; moving: boolean; animT: number; lastSnapLocal: number; flashUntil: number; lastHp: number;
}
interface Projectile {
    id: number; sx: number; sy: number; vx: number; vy: number; k: number; snapT: number; trailT: number;
}
export interface Particle {
    x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
    size: number; color: string; grav: number; kind: 'dot' | 'spark' | 'rock';
}
interface FloatText { x: number; y: number; vy: number; life: number; text: string; color: string; crit: boolean }
interface SlashFx { x: number; y: number; ang: number; until: number }
interface AoeFx { x: number; y: number; r: number; el: ElementId; born: number; until: number; danger?: boolean }
interface Telegraph { x: number; y: number; r: number; until: number }
interface StreakFx { x: number; y: number; tx: number; ty: number; el: ElementId; born: number; until: number }

const INTERP_DELAY = 105;
const PLAYER_SPEED = 175;
const BASIC_CD = 550;
const POTION_CD = 9000;
const VIEW_RADIUS = 1080;
export interface HudState {
    hp: number; mh: number; ch: number; mc: number; xp: number; need: number;
    lvl: number; gold: number; pot: number;
    cds: Array<{ left: number; total: number }>;
    zoneName: string; safe: boolean;
    mission: { name: string; need: number; prog: number } | null;
    dead: boolean;
    boss: { n: string; pct: number } | null;
    target: { n: string; lv: number; pct: number } | null;
    interact: 'fonte' | 'loja' | null;
    fps: number;
    selfMoving: boolean;
}
const OBJ_FOOTPRINT = {
    tree: [1, 1], tree2: [1, 1], deadtree: [1, 1], rock: [1, 1],
    fence: [1, 1], post: [1, 1], lantern: [1, 1], sign: [1, 1],
    house: [3, 2], shop: [3, 2], fountain: [2, 2],
};
export class GameEngine {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    welcome: WelcomeData;
    input: InputController;
    map: WelcomeData['map'];
    walkGrid: Uint8Array;
    objRender: { k: string; x: number; y: number; sortY: number }[] = [];
    minimapBase: HTMLCanvasElement | null = null;
    entities = new Map<number, Entity>();
    projectiles = new Map<number, Projectile>();
    particles: Particle[] = [];
    floatTexts: FloatText[] = [];
    slashes: SlashFx[] = [];
    aoes: AoeFx[] = [];
    telegraphs: Telegraph[] = [];
    streaks: StreakFx[] = [];
    selfId: number;
    el: ElementId;
    selfX: number;
    selfY: number;
    selfDir = 0;
    selfMoving = false;
    you: YouState | null = null;
    localCdEnds: number[] = [0, 0, 0, 0, 0, 0];
    serverCdEnds: number[] = [0, 0, 0, 0, 0, 0];
    basicNext = 0;
    camX = 0;
    camY = 0;
    zoom = 2;
    shake = 0;
    timeOffset = 0;
    tiles: Record<string, HTMLCanvasElement[]>;
    chars = new Map<string, HTMLCanvasElement[][]>();
    playerArt: Partial<Record<ElementId, HTMLCanvasElement[][]>>;
    rosterMeta = new Map<number, WelcomeData['roster'][number]>();
    monsters: Record<string, HTMLCanvasElement[][]>;
    objects: Record<string, HTMLCanvasElement>;
    npc: HTMLCanvasElement[][];
    zoneName = 'Vila da Folha';
    zoneSafe = true;
    targetId: number | null = null;
    online = 1;
    onZoneChange: ((name: string, safe: boolean) => void) | null = null;
    private raf = 0;
    private lastFrame = 0;
    private lastMoveSent = 0;
    private lastZoneCheck = 0;
    private lastTargetCheck = 0;
    private fpsFrames = 0;
    private fpsTime = 0;
    private fps = 60;
    private running = false;
    private dmgFlash = 0;
    constructor(canvas: HTMLCanvasElement, welcome: WelcomeData, input: InputController, art: GameArt) {
        this.objRender = [];
        this.minimapBase = null;
        this.entities = new Map();
        this.projectiles = new Map();
        this.particles = [];
        this.floatTexts = [];
        this.slashes = [];
        this.aoes = [];
        this.telegraphs = [];
        this.streaks = [];
        this.selfDir = 0;
        this.selfMoving = false;
        this.you = null;
        this.localCdEnds = [0, 0, 0, 0, 0, 0];
        this.serverCdEnds = [0, 0, 0, 0, 0, 0];
        this.basicNext = 0;
        this.camX = 0;
        this.camY = 0;
        this.zoom = 2;
        this.shake = 0;
        this.timeOffset = 0;
        this.chars = new Map();
        this.rosterMeta = new Map();
        this.zoneName = 'Vila da Folha';
        this.zoneSafe = true;
        this.targetId = null;
        this.online = 1;
        this.onZoneChange = null;
        this.raf = 0;
        this.lastFrame = 0;
        this.lastMoveSent = 0;
        this.lastZoneCheck = 0;
        this.lastTargetCheck = 0;
        this.fpsFrames = 0;
        this.fpsTime = 0;
        this.fps = 60;
        this.running = false;
        this.dmgFlash = 0;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.welcome = welcome;
        this.input = input;
        this.map = welcome.map;
        this.selfId = welcome.id;
        this.el = welcome.self.el;
        this.selfX = welcome.self.x;
        this.selfY = welcome.self.y;
        this.camX = this.selfX;
        this.camY = this.selfY;

        // O jogador local não depende do primeiro snapshot para existir
        // visualmente. O welcome já contém posição/elemento/nível e o roster
        // contém a paleta sorteada pelo servidor.
        for (const player of welcome.roster) this.rosterMeta.set(player.id, player);
        const selfMeta = this.rosterMeta.get(this.selfId);
        const selfPal = selfMeta?.pal ?? 0;
        const initialHp = maxHpOf(welcome.self.lv);
        this.entities.set(this.selfId, {
            id: this.selfId,
            kind: 'player',
            n: welcome.self.n,
            lv: welcome.self.lv,
            el: welcome.self.el,
            pal: selfPal,
            hp: initialHp,
            hpPct: 100,
            dir: 0,
            ax: this.selfX,
            ay: this.selfY,
            at: welcome.t - 50,
            bx: this.selfX,
            by: this.selfY,
            bt: welcome.t,
            x: this.selfX,
            y: this.selfY,
            moving: false,
            animT: 0,
            lastSnapLocal: performance.now(),
            flashUntil: 0,
            lastHp: initialHp,
        });
        const { w, h } = this.map;
        this.walkGrid = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (this.map.tiles[y][x] === 'w')
                    this.walkGrid[y * w + x] = 1;
            }
        }
        for (const o of this.map.objects) {
            const [fw, fh] = OBJ_FOOTPRINT[o.k] || [1, 1];
            for (let oy = 0; oy < fh; oy++)
                for (let ox = 0; ox < fw; ox++)
                    this.walkGrid[(o.y + oy) * w + (o.x + ox)] = 1;
            this.objRender.push({ k: o.k, x: o.x, y: o.y, sortY: (o.y + fh) * TILE });
        }
        this.tiles = art.tiles;
        this.playerArt = art.players;
        this.monsters = buildMonsterSprites();
        this.objects = art.objects;
        this.npc = buildNpcSprites();
        this.charSprites(this.el, 0);
        this.resize();
    }
    charSprites(el: ElementId, pal: number): HTMLCanvasElement[][] {
        const key = `${el}:${pal}`;
        let s = this.chars.get(key);
        if (!s) {
            const atlasFrames = this.playerArt[el];
            // Durante o piloto GBA priorizamos confiabilidade. A variação por
            // paleta volta depois que o contrato visual estiver validado.
            s = atlasFrames ?? buildCharSprites(el, pal);
            this.chars.set(key, s);
        }
        return s;
    }
    walkAt(px, py) {
        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);
        if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h)
            return false;
        return this.walkGrid[ty * this.map.w + tx] === 0;
    }
    canStand(x, y) {
        return (this.walkAt(x - 7, y - 2) && this.walkAt(x + 7, y - 2) &&
            this.walkAt(x - 7, y + 11) && this.walkAt(x + 7, y + 11) &&
            this.walkAt(x, y + 5));
    }
    serverNow() { return Date.now() + this.timeOffset; }
    zoneOf(x, y) {
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        for (const z of this.map.zones) {
            if (z.n === 'Arredores da Vila') continue;
            if (tx >= z.x1 && tx <= z.x2 && ty >= z.y1 && ty <= z.y2) return { n: z.n, safe: !!z.safe };
        }
        return { n: 'Arredores da Vila', safe: false };
    }
    start() {
        if (this.running) return;
        this.running = true; this.lastFrame = performance.now();
        const loop = (now) => { if (!this.running) return; this.frame(now); this.raf = requestAnimationFrame(loop); };
        this.raf = requestAnimationFrame(loop);
    }
    stop() { this.running = false; cancelAnimationFrame(this.raf); }
    resize() {
        const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
        this.zoom = Math.max(1.4, Math.min(2.2, rect.width / 620));
        this.ctx.imageSmoothingEnabled = false;
    }
    applySnapshot(snap: SnapshotData) {
        var _a; const localT = performance.now(); const sampleOff = snap.t - Date.now();
        if (this.timeOffset === 0) this.timeOffset = sampleOff; else this.timeOffset += (sampleOff - this.timeOffset) * 0.06;
        this.you = snap.you; this.serverCdEnds = snap.you.cds.map((ms) => (ms > 0 ? localT + ms : 0));
        const nfMap = new Map(); for (const nf of snap.nf) nfMap.set(nf.id, nf);
        const touch = (id, x, y, dir, t) => {
            let e = this.entities.get(id);
            if (!e) {
                const nf = nfMap.get(id);
                const roster = this.rosterMeta.get(id);
                if (nf?.k === 'm') {
                    e = { id, kind:'monster', n:nf.n||'Monstro', lv:nf.lv, pal:0, t:nf.t||'bandido', hp:100,hpPct:100,dir:0,ax:x,ay:y,at:t-50,bx:x,by:y,bt:t,x,y,moving:false,animT:0,lastSnapLocal:localT,flashUntil:0,lastHp:100 };
                } else {
                    const player = nf?.k === 'p' ? nf : roster;
                    if (!player) return undefined;
                    const lv = player.lv;
                    const el = player.el || 'fogo';
                    const pal = player.pal ?? 0;
                    e = { id, kind:'player', n:player.n||'???', lv, el, pal, hp:maxHpOf(lv), hpPct:100, dir:0, ax:x, ay:y, at:t-50, bx:x, by:y, bt:t, x,y,moving:false,animT:0,lastSnapLocal:localT,flashUntil:0,lastHp:maxHpOf(lv) };
                }
                this.entities.set(id,e);
            } else {
                e.ax=e.bx;e.ay=e.by;e.at=e.bt;e.bx=x;e.by=y;e.bt=t;
                if(e.at===0){e.ax=x;e.ay=y;e.at=t-50;}
                const nf=nfMap.get(id);
                if(nf){
                    e.lv=nf.lv;
                    if(nf.k==='p'){
                        e.n=nf.n||e.n;e.el=nf.el||e.el;e.pal=nf.pal??e.pal;
                        this.rosterMeta.set(id,{id,n:e.n,lv:nf.lv,el:e.el||'fogo',pal:e.pal});
                    } else {e.n=nf.n||e.n;e.t=nf.t||e.t;}
                }
            }
            e.dir=dir;e.lastSnapLocal=localT;return e;
        };
        for(const row of snap.p){const e=touch(row[0],row[1],row[2],row[3],snap.t);if(!e)continue;if(Number.isFinite(row[5]))e.lv=row[5];const newHp=row[4];if(newHp<e.lastHp)e.flashUntil=performance.now()+130;e.lastHp=newHp;e.hp=newHp;e.hpPct=Math.max(0,Math.min(100,newHp/maxHpOf(e.lv)*100));}
        for(const row of snap.m){const e=touch(row[0],row[1],row[2],row[3],snap.t);if(!e)continue;const pct=row[4];if(pct<e.lastHp)e.flashUntil=performance.now()+130;e.lastHp=pct;e.hpPct=pct;}
        const selfEnt=this.entities.get(this.selfId);if(selfEnt)selfEnt.lv=snap.you.lvl;const selfRow=snap.p.find(r=>r[0]===this.selfId);if(selfRow&&!((_a=this.you)===null||_a===void 0?void 0:_a.dm)){const dx=selfRow[1]-this.selfX,dy=selfRow[2]-this.selfY;if(Math.hypot(dx,dy)>72){this.selfX=selfRow[1];this.selfY=selfRow[2];}}
        const seenPr=new Set();for(const row of snap.pr){seenPr.add(row[0]);const p=this.projectiles.get(row[0]);if(p){p.sx=row[1];p.sy=row[2];p.vx=row[3];p.vy=row[4];p.k=row[5];p.snapT=localT;}else this.projectiles.set(row[0],{id:row[0],sx:row[1],sy:row[2],vx:row[3],vy:row[4],k:row[5],snapT:localT,trailT:0});}
        for(const[id,p]of[...this.projectiles])if(!seenPr.has(id)&&localT-p.snapT>250)this.projectiles.delete(id);
        for(const[id,e]of[...this.entities])if(id!==this.selfId&&localT-e.lastSnapLocal>1600)this.entities.delete(id);
    }
    applyFx(fx: FxData) {
        const now=performance.now(),el=fx.el||'fogo';
        switch(fx.k){case'cast':this.burst(fx.x,fx.y,8,el,60);audio.play('skill');break;case'slash':{const ang=Math.atan2((fx.ty||fx.y)-fx.y,(fx.tx||fx.x)-fx.x);this.slashes.push({x:fx.x,y:fx.y,ang,until:now+170});audio.play('hit');break;}case'aoe':this.aoes.push({x:fx.x,y:fx.y,r:fx.r||130,el,born:now,until:now+480});this.burst(fx.x,fx.y,26,el,170,(fx.r||130)*.55);this.shake=Math.max(this.shake,5);audio.play('skill');break;case'dash':this.streaks.push({x:fx.x,y:fx.y,tx:fx.tx||fx.x,ty:fx.ty||fx.y,el,born:now,until:now+300});this.burst(fx.x,fx.y,14,el,120);audio.play('skill');break;case'heal':this.burstHeal(fx.x,fx.y);audio.play('pot');break;case'lvl':this.burstLvl(fx.x,fx.y);audio.play('lvl');break;case'death':this.burstDeath(fx.x,fx.y,!!fx.boss);audio.play('death');break;case'pdeath':this.burstDeath(fx.x,fx.y,false);audio.play('death');break;case'mhit':this.burst(fx.x,fx.y,6,'fogo',70);audio.play('monster');break;case'slamwarn':this.telegraphs.push({x:fx.x,y:fx.y,r:fx.r||135,until:now+950});break;case'slam':this.aoes.push({x:fx.x,y:fx.y,r:fx.r||135,el:'terra',born:now,until:now+500,danger:true});this.burst(fx.x,fx.y,30,'terra',200,90);this.shake=Math.max(this.shake,13);audio.play('crit');break;}
    }
    applyDmg(d: DmgData) { const now=performance.now(),color=d.h?'#7dff7d':d.c?'#ffd23e':d.tp?'#ff6060':'#ffffff';this.floatTexts.push({x:d.x+(Math.random()-.5)*18,y:d.y,vy:-52,life:950,text:String(d.v),color,crit:!!d.c});if(d.c)audio.play('crit');if(d.tp&&Math.hypot(d.x-this.selfX,d.y-this.selfY)<60){this.dmgFlash=now+260;this.shake=Math.max(this.shake,4);} }
    setOnline(n){this.online=n;} setSelfPos(x,y){this.selfX=x;this.selfY=y;this.camX=x;this.camY=y;}
    elColors(el){const map={fogo:['#ffdf8a','#ffb347','#ff6b35','#e6392b'],agua:['#dff6ff','#9bd9f6','#4aa8e0','#2f7fb5'],raio:['#ffffff','#fff3a3','#ffd23e','#a8e02e'],vento:['#eaffde','#b8e986','#8ecf5a','#5ba832'],terra:['#d9c39a','#b09468','#8a6d3f','#6b4f2a']};return map[el]||map.fogo;}
    burst(x,y,n,el,speed,spread=0){const cols=this.elColors(el);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=speed*(.35+Math.random()*.75),r=spread?Math.random()*spread:0;this.particles.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:350+Math.random()*350,maxLife:700,size:2+Math.random()*3,color:cols[Math.floor(Math.random()*cols.length)],grav:130,kind:'dot'});}}
    burstHeal(x,y){for(let i=0;i<14;i++)this.particles.push({x:x+(Math.random()-.5)*26,y:y+(Math.random()-.5)*20,vx:(Math.random()-.5)*20,vy:-40-Math.random()*45,life:500+Math.random()*300,maxLife:800,size:2+Math.random()*2,color:['#7dff7d','#b8ffB8','#4ade80'][Math.floor(Math.random()*3)],grav:-20,kind:'dot'});}
    burstLvl(x,y){for(let i=0;i<34;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*130;this.particles.push({x,y:y+8,vx:Math.cos(a)*s,vy:Math.sin(a)*s-110,life:600+Math.random()*500,maxLife:1100,size:2+Math.random()*3,color:['#ffe066','#ffd23e','#fff3b0','#f97316'][Math.floor(Math.random()*4)],grav:240,kind:'spark'});}}
    burstDeath(x,y,boss){const cols=boss?['#e8e4da','#c03030','#8a2020','#5a6a4e']:['#b8b2a8','#8f897d','#6a6a72','#4a4a52'],n=boss?46:24;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*110;this.particles.push({x:x+(Math.random()-.5)*18,y:y+(Math.random()-.5)*24,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:450+Math.random()*450,maxLife:900,size:2+Math.random()*3,color:cols[Math.floor(Math.random()*cols.length)],grav:200,kind:'rock'});}}
    getAim(){if(this.input.hasRecentMouse()){const rect=this.canvas.getBoundingClientRect();return{x:this.camX+(this.input.state.aimX-rect.width/2)/this.zoom,y:this.camY+(this.input.state.aimY-rect.height/2)/this.zoom};}const t=this.findTarget(620);if(t)return{x:t.x,y:t.y-6};const d=[[0,1],[0,-1],[-1,0],[1,0]][this.selfDir]||[0,1];return{x:this.selfX+d[0]*190,y:this.selfY+d[1]*190};}
    findTarget(range: number): Entity | null {let best: Entity | null=null,bestD=Infinity;for(const e of this.entities.values()){if(e.kind!=='monster'||e.id===this.selfId)continue;const d=Math.hypot(e.x-this.selfX,e.y-this.selfY);if(d<range&&d<bestD){best=e;bestD=d;}}return best;}
    basicAttack(){var _a;const now=performance.now();if(now<this.basicNext||((_a=this.you)===null||_a===void 0?void 0:_a.dm))return;this.basicNext=now+BASIC_CD;const aim=this.getAim();net.attack(aim.x,aim.y);this.slashes.push({x:this.selfX,y:this.selfY,ang:Math.atan2(aim.y-this.selfY,aim.x-this.selfX),until:now+170});if(Math.abs(aim.x-this.selfX)>Math.abs(aim.y-this.selfY))this.selfDir=aim.x>this.selfX?3:2;else this.selfDir=aim.y>this.selfY?0:1;}
    castSkill(idx){var _a;const now=performance.now();if((_a=this.you)===null||_a===void 0?void 0:_a.dm)return;const s=this.welcome.skills[idx];if(!s||now<this.localCdEnds[1+idx])return;if(this.you&&this.you.ch<s.ch){this.floatTexts.push({x:this.selfX,y:this.selfY-34,vy:-40,life:800,text:'Chakra insuficiente!',color:'#9bd9f6',crit:false});return;}this.localCdEnds[1+idx]=now+s.cd;if(this.you)this.you.ch-=s.ch;const aim=this.getAim();net.skill(idx,aim.x,aim.y);if(Math.abs(aim.x-this.selfX)>Math.abs(aim.y-this.selfY))this.selfDir=aim.x>this.selfX?3:2;else this.selfDir=aim.y>this.selfY?0:1;}
    drinkPotion(){var _a;if((_a=this.you)===null||_a===void 0?void 0:_a.dm)return;net.potion();} interact(){net.interact();}
    frame(now){var _a,_b,_c;const dt=Math.min(.1,(now-this.lastFrame)/1000);this.lastFrame=now;this.fpsFrames++;this.fpsTime+=dt;if(this.fpsTime>=.5){this.fps=Math.round(this.fpsFrames/this.fpsTime);this.fpsFrames=0;this.fpsTime=0;}const dead=!!((_a=this.you)===null||_a===void 0?void 0:_a.dm);if(!this.walkAt(this.selfX,this.selfY)){const ctx0=Math.floor(this.selfX/TILE),cty0=Math.floor(this.selfY/TILE);outer:for(let r=1;r<=3;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const tx=(ctx0+dx)*TILE+16,ty=(cty0+dy)*TILE+16;if(this.walkAt(tx,ty)&&this.canStand(tx,ty)){this.selfX=tx;this.selfY=ty;break outer;}}}if(!dead&&this.input.enabled){const mv=this.input.computeMove();if(mv.x!==0||mv.y!==0){const step=PLAYER_SPEED*dt,nx=this.selfX+mv.x*step,ny=this.selfY+mv.y*step;if(this.canStand(nx,this.selfY))this.selfX=nx;if(this.canStand(this.selfX,ny))this.selfY=ny;this.selfMoving=true;if(Math.abs(mv.x)>Math.abs(mv.y))this.selfDir=mv.x>0?3:2;else this.selfDir=mv.y>0?0:1;}else this.selfMoving=false;if(this.input.state.attackHeld)this.basicAttack();}else this.selfMoving=false;if(now-this.lastMoveSent>90){this.lastMoveSent=now;net.move(Math.round(this.selfX),Math.round(this.selfY),this.selfDir);}const rt=this.serverNow()-INTERP_DELAY;for(const e of this.entities.values()){if(e.id===this.selfId){e.x=this.selfX;e.y=this.selfY;e.dir=this.selfDir;e.moving=this.selfMoving;}else{if(e.bt>e.at){const f=Math.max(0,Math.min(1,(rt-e.at)/(e.bt-e.at)));e.x=e.ax+(e.bx-e.ax)*f;e.y=e.ay+(e.by-e.ay)*f;}else{e.x=e.bx;e.y=e.by;}e.moving=Math.hypot(e.bx-e.ax,e.by-e.ay)>2.2;}if(e.moving)e.animT+=dt;}for(const p of this.projectiles.values()){const el=EL_LIST[Math.floor(p.k/4)]||'fogo';if(now-p.trailT>28){p.trailT=now;const cols=this.elColors(el);this.particles.push({x:p.sx+p.vx*(now-p.snapT)/1000,y:p.sy+p.vy*(now-p.snapT)/1000,vx:(Math.random()-.5)*26,vy:(Math.random()-.5)*26-12,life:220+Math.random()*160,maxLife:380,size:2+Math.random()*2.4,color:cols[Math.floor(Math.random()*cols.length)],grav:0,kind:'dot'});}}
        for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt*1000;if(p.life<=0){this.particles.splice(i,1);continue;}p.vy+=p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}if(this.particles.length>900)this.particles.splice(0,this.particles.length-900);for(let i=this.floatTexts.length-1;i>=0;i--){const f=this.floatTexts[i];f.life-=dt*1000;if(f.life<=0){this.floatTexts.splice(i,1);continue;}f.y+=f.vy*dt;f.vy*=.96;}this.slashes=this.slashes.filter(s=>s.until>now);this.aoes=this.aoes.filter(s=>s.until>now);this.telegraphs=this.telegraphs.filter(s=>s.until>now);this.streaks=this.streaks.filter(s=>s.until>now);const k=Math.min(1,dt*5.2);this.camX+=(this.selfX-this.camX)*k;this.camY+=(this.selfY-this.camY)*k;const viewW=this.canvas.clientWidth/this.zoom,viewH=this.canvas.clientHeight/this.zoom,worldW=this.map.w*TILE,worldH=this.map.h*TILE;if(viewW<worldW)this.camX=Math.max(viewW/2,Math.min(worldW-viewW/2,this.camX));else this.camX=worldW/2;if(viewH<worldH)this.camY=Math.max(viewH/2,Math.min(worldH-viewH/2,this.camY));else this.camY=worldH/2;if(this.shake>0)this.shake=Math.max(0,this.shake-dt*34);if(Math.random()<.06&&!dead){const f=this.map.fountain;if(Math.hypot(f.x-this.selfX,f.y-this.selfY)<130)this.particles.push({x:f.x+(Math.random()-.5)*44,y:f.y+(Math.random()-.5)*30,vx:0,vy:-26-Math.random()*20,life:600,maxLife:600,size:1.6,color:'#9bd9f6',grav:0,kind:'dot'});}if(now-this.lastZoneCheck>300){this.lastZoneCheck=now;const z=this.zoneOf(this.selfX,this.selfY);if(z.n!==this.zoneName){this.zoneName=z.n;this.zoneSafe=z.safe;(_b=this.onZoneChange)===null||_b===void 0?void 0:_b.call(this,z.n,z.safe);}}if(now-this.lastTargetCheck>200){this.lastTargetCheck=now;const t=this.findTarget(620);this.targetId=(_c=t===null||t===void 0?void 0:t.id)!==null&&_c!==void 0?_c:null;}drawGame(this,now);}
    buildHud(): HudState {var _a,_b,_c,_d,_e,_f,_g,_h,_j,_k;const you=this.you,missions=this.welcome.missions,mi=you?missions[you.mi]:undefined;let boss: { n: string; pct: number } | null=null,target: { n: string; lv: number; pct: number } | null=null;for(const e of this.entities.values()){if(e.kind!=='monster')continue;const d=Math.hypot(e.x-this.selfX,e.y-this.selfY);if(e.t==='boss'&&d<850)boss={n:e.n,pct:e.hpPct};if(e.id===this.targetId&&d<850)target={n:e.n,lv:e.lv,pct:e.hpPct};}const now=performance.now(),cdTotals=[BASIC_CD,...this.welcome.skills.map(s=>s.cd),POTION_CD],cds: Array<{ left: number; total: number }>=[];for(let i=0;i<6;i++){const local=this.localCdEnds[i]>0?this.localCdEnds[i]-now:0,server=this.serverCdEnds[i]>0?this.serverCdEnds[i]-now:0;cds.push({left:Math.max(0,Math.max(local,server)),total:cdTotals[i]});}let interact: 'fonte' | 'loja' | null=null;if(!(you===null||you===void 0?void 0:you.dm)){if(Math.hypot(this.map.fountain.x-this.selfX,this.map.fountain.y-this.selfY)<100)interact='fonte';else if(Math.hypot(this.map.shopNpc.x-this.selfX,this.map.shopNpc.y-this.selfY)<100)interact='loja';}return{hp:(_a=you===null||you===void 0?void 0:you.hp)!==null&&_a!==void 0?_a:100,mh:(_b=you===null||you===void 0?void 0:you.mh)!==null&&_b!==void 0?_b:100,ch:(_c=you===null||you===void 0?void 0:you.ch)!==null&&_c!==void 0?_c:55,mc:(_d=you===null||you===void 0?void 0:you.mc)!==null&&_d!==void 0?_d:55,xp:(_e=you===null||you===void 0?void 0:you.xp)!==null&&_e!==void 0?_e:0,need:(_f=you===null||you===void 0?void 0:you.need)!==null&&_f!==void 0?_f:70,lvl:(_g=you===null||you===void 0?void 0:you.lvl)!==null&&_g!==void 0?_g:1,gold:(_h=you===null||you===void 0?void 0:you.gold)!==null&&_h!==void 0?_h:0,pot:(_j=you===null||you===void 0?void 0:you.pot)!==null&&_j!==void 0?_j:0,cds,zoneName:this.zoneName,safe:this.zoneSafe,mission:mi?{name:mi.name,need:mi.need,prog:(_k=you===null||you===void 0?void 0:you.mp)!==null&&_k!==void 0?_k:0}:null,dead:!!(you===null||you===void 0?void 0:you.dm),boss,target,interact,fps:this.fps,selfMoving:this.selfMoving};}
    get damageFlashUntil(){return this.dmgFlash;}
    buildMinimapBase(){const S=2,c=document.createElement('canvas');c.width=this.map.w*S;c.height=this.map.h*S;const ctx=c.getContext('2d')!,tileColors={'.':'#5e9a4a',',':'#569244','"':'#5e9a4a',g:'#4e8a3a',s:'#d2ba82',p:'#c9a06a',c:'#8a857c',w:'#3d7fb0'};for(let y=0;y<this.map.h;y++)for(let x=0;x<this.map.w;x++){ctx.fillStyle=tileColors[this.map.tiles[y][x]]||'#5e9a4a';ctx.fillRect(x*S,y*S,S,S);}for(const o of this.map.objects){const colors={tree:'#2e5a20',tree2:'#2e5a20',deadtree:'#6a5a4a',rock:'#76767e',house:'#7a5a3a',shop:'#c03030',fountain:'#7db8dd',fence:'#9a7a5a',post:'#8a6a4a',lantern:'#f0d060',sign:'#9a7a5a'};ctx.fillStyle=colors[o.k]||'#333';ctx.fillRect(o.x*S,o.y*S,S,S);}ctx.strokeStyle='#f0d06088';ctx.lineWidth=1;ctx.strokeRect(23*S,23*S,19*S,19*S);return c;}
    ensureMinimapBase(){if(!this.minimapBase)this.minimapBase=this.buildMinimapBase();return this.minimapBase;}
    renderMinimap(canvas: HTMLCanvasElement){const base=this.ensureMinimapBase(),ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0,canvas.width,canvas.height);const S=canvas.width/(this.map.w*2),dot=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x*32*S,y*32*S,r,0,Math.PI*2);ctx.fill();};for(const e of this.entities.values()){if(e.kind==='monster'){if(e.t==='boss')dot(e.x,e.y,3.5,'#e6392b');else dot(e.x,e.y,1.6,'#d64545aa');}else if(e.id!==this.selfId)dot(e.x,e.y,2,'#f5f2ea');}dot(this.selfX,this.selfY,3,'#f97316');}
    get pixScale(){return PIX_SCALE;}
}
