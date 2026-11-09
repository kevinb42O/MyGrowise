import {chestPose} from './chestMotion';

const unit=(value:number)=>Math.max(0,Math.min(1,value));

export type ChestPainter = (ctx: CanvasRenderingContext2D, elapsed: number, calm: boolean) => void;
export const chestPlateUrl = '/images/books/animation/fien-chest-open.webp';

// Coordinates follow the actual curved lid and its sloping rear hinge in the
// original 1200 × 849 book artwork. Only this patch is ever replaced.
const lidOutline = new Path2D('M383 450 C376 424 379 393 390 374 Q397 361 405 355 L873 410 Q880 428 878 455 L874 520 Z');
const mouth = new Path2D('M383 450 435 408 875 450 860 519 Z');
const hinge = {x:405,y:355};
const angle = Math.atan2(55,468);
const ex=Math.cos(angle), ey=Math.sin(angle), nx=-ey, ny=ex;

export function makeChestPainter(source: HTMLImageElement, plate: HTMLImageElement): ChestPainter {
  // Sample the original illustration once, not once per animation frame.
  const lid = document.createElement('canvas');
  lid.width=512;lid.height=180;
  const ink=lid.getContext('2d')!;
  ink.translate(-374,-347);
  ink.clip(lidOutline);
  ink.drawImage(source,0,0,1200,849);
  const underside=document.createElement('canvas');
  underside.width=lid.width;underside.height=lid.height;
  const back=underside.getContext('2d')!;
  back.drawImage(lid,0,0);
  back.globalCompositeOperation='source-atop';
  const wood=back.createLinearGradient(0,0,0,180);
  wood.addColorStop(0,'#7364bb');wood.addColorStop(.55,'#51418d');wood.addColorStop(1,'#352955');
  back.globalAlpha=.87;
  back.fillStyle=wood;back.fillRect(0,0,512,180);

  return (ctx,elapsed,calm) => {
    const pose=chestPose(elapsed);
    if(pose.open<=0 && pose.unlock<=0)return;
    ctx.save();
    // The painted backdrop is clipped to the old lid; every other pixel of
    // the original page, including Fien, her text and the cart, stays intact.
    ctx.save();
    ctx.globalAlpha=calm?pose.open:1;
    ctx.clip(lidOutline);
    ctx.drawImage(plate,0,0,1200,849);
    ctx.restore();

    // Light comes from inside the mouth, beneath the hinged lid.
    ctx.save();
    ctx.clip(mouth);
    const light=ctx.createRadialGradient(625,485,4,625,475,235);
    light.addColorStop(0,'#fff3b4');light.addColorStop(.28,'#ffd16b');light.addColorStop(1,'#ffb64700');
    ctx.globalAlpha=pose.light*.72;
    ctx.fillStyle=light;ctx.fillRect(380,390,510,140);
    ctx.restore();

    // Rotate around the illustrated rear hinge, retaining its perspective.
    // A calm-mode user gets a dissolve to the open pose instead of movement.
    const rotation=(calm?1:pose.open)*1.87;
    const depth=Math.cos(rotation)-.42*Math.sin(rotation);
    const a=ex*ex+depth*nx*nx,b=ex*ey+depth*nx*ny;
    const c=b,d=ey*ey+depth*ny*ny;
    ctx.save();
    if(calm)ctx.globalAlpha=pose.open;
    // The arched shell has height above its hinge plane. Its ridge travels
    // down as it rotates back, keeping the painted rear edge on the rim.
    const arch=32*(1-depth);
    ctx.transform(a,b,c,d,hinge.x-a*hinge.x-c*hinge.y+nx*arch,hinge.y-b*hinge.x-d*hinge.y+ny*arch);
    ctx.drawImage(lid,374,347);
    const reverse=Math.max(0,Math.min(1,(rotation-1.04)/.24));
    if(reverse>0){
      ctx.save();ctx.globalAlpha=(calm?pose.open:1)*reverse;
      ctx.drawImage(underside,374,347);ctx.restore();
    }
    // Warm spill catches the underside instead of a detached halo.
    if(rotation>1.02){
      ctx.clip(lidOutline);
      ctx.globalAlpha=(calm?pose.open:1)*pose.light*.23;
      ctx.fillStyle='#ffd48b';ctx.fillRect(374,347,512,180);
    }
    ctx.restore();

    // A few deliberate motes rise from the cavity after it opens.
    for(let i=0;i<9;i++){
      const age=elapsed-.65-i*.12;
      if(age<0)continue;
      const life=unit(age/2.7), fade=Math.sin(life*Math.PI)*pose.light;
      const x=485+i*38+Math.sin(i*2.7+age*1.6)*(calm?0:9);
      const y=465+(x-620)*.13-(calm?24:life*145);
      ctx.globalAlpha=fade*.8;ctx.fillStyle=i%3?'#fff1b0':'#e5d5ff';
      const radius=i%3?1.7:2.8;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    // The lock gives instant feedback before the heavier lid starts moving.
    ctx.globalAlpha=pose.unlock*.55;
    const keyLight=ctx.createRadialGradient(620,552,0,620,552,40);
    keyLight.addColorStop(0,'#fff2b0');keyLight.addColorStop(1,'#ffe49900');
    ctx.fillStyle=keyLight;ctx.fillRect(580,512,80,80);
    ctx.restore();
  };
}
