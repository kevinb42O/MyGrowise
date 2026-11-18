import {chestPose} from './chestMotion';

const unit=(value:number)=>Math.max(0,Math.min(1,value));

export type ChestPainter = (ctx: CanvasRenderingContext2D, elapsed: number, calm: boolean) => void;
export const chestPlateUrl = '/images/books/animation/fien-chest-open.webp';
export const chestInteriorUrl = '/images/books/animation/fien-chest-interior.webp';

// Coordinates follow the actual curved lid and its sloping rear hinge in the
// original 1200 × 849 book artwork. Only this patch is ever replaced.
const lidOutline = new Path2D('M382 451 C378 422 380 391 394 368 Q403 351 421 341 C523 354 692 386 873 409 Q881 426 880 455 L875 521 C720 503 542 473 382 451 Z');
const mouth = new Path2D('M383 450 435 408 875 450 860 519 Z');
const hinge = {x:421,y:341};
const angle = Math.atan2(68,452);
const ex=Math.cos(angle), ey=Math.sin(angle), nx=-ey, ny=ex;

export function makeChestPainter(source: HTMLImageElement, plate: HTMLImageElement, interior?: HTMLImageElement): ChestPainter {
  // Sample the original illustration once, not once per animation frame.
  const lid = document.createElement('canvas');
  lid.width=512;lid.height=196;
  const ink=lid.getContext('2d')!;
  ink.translate(-374,-334);
  ink.clip(lidOutline);
  ink.drawImage(source,0,0,1200,849);
  // The lock belongs to the front of the chest, not to its moving shell.
  // Borrow adjacent painted wood only inside its small overlapping cap.
  ink.save();
  ink.clip(new Path2D('M614 457 Q641 451 643 482 L611 490 Z'));
  ink.drawImage(source,64,9,1200,849);
  ink.restore();
  const underside=document.createElement('canvas');
  underside.width=lid.width;underside.height=lid.height;
  const back=underside.getContext('2d')!;
  if(interior){
    // Map the complete authored interior to the lid's sloping edges. A flat
    // rectangular draw cropped off the rim and made its braces look broken.
    back.translate(-374,-334);
    const point=(u:number,v:number)=>({
      x:(382+493*u)*(1-v)+(421+452*u)*v,
      y:(451+70*u)*(1-v)+(341+68*u)*v,
    });
    const triangle=(u0:number,v0:number,u1:number,v1:number,u2:number,v2:number)=>{
      const p=point(u0,v0),q=point(u1,v1),r=point(u2,v2);
      const sx0=u0*interior.naturalWidth,sy0=v0*interior.naturalHeight;
      const sx1=u1*interior.naturalWidth,sy1=v1*interior.naturalHeight;
      const sx2=u2*interior.naturalWidth,sy2=v2*interior.naturalHeight;
      const det=(sx1-sx0)*(sy2-sy0)-(sx2-sx0)*(sy1-sy0);
      const a=((q.x-p.x)*(sy2-sy0)-(r.x-p.x)*(sy1-sy0))/det;
      const b=((q.y-p.y)*(sy2-sy0)-(r.y-p.y)*(sy1-sy0))/det;
      const c=((r.x-p.x)*(sx1-sx0)-(q.x-p.x)*(sx2-sx0))/det;
      const d=((r.y-p.y)*(sx1-sx0)-(q.y-p.y)*(sx2-sx0))/det;
      back.save();back.beginPath();back.moveTo(p.x,p.y);back.lineTo(q.x,q.y);back.lineTo(r.x,r.y);back.closePath();back.clip();
      back.transform(a,b,c,d,p.x-a*sx0-c*sy0,p.y-b*sx0-d*sy0);
      back.drawImage(interior,0,0);back.restore();
    };
    for(let i=0;i<12;i++){
      const u=i/12,next=(i+1)/12;
      triangle(u,0,next,0,u,1);triangle(next,0,next,1,u,1);
    }
  }else{
    back.drawImage(lid,0,0);
    back.globalCompositeOperation='source-atop';
    back.fillStyle='#51418d';back.globalAlpha=.74;
    back.fillRect(0,0,512,196);
  }

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
    const rotation=(calm?1:pose.open)*1.65;
    const depth=Math.cos(rotation)-1.12*Math.sin(rotation);
    // The painted crown sits above the real (occluded) rear hinge.
    // As it rolls back, register that edge to the open plate's rear rim.
    const opened=calm?1:pose.open;
    const progress=unit(opened/.35);
    const registration=progress*progress*(3-2*progress);
    const axis=angle+(Math.atan2(42,440)-angle)*registration;
    const ux=Math.cos(axis),uy=Math.sin(axis),vx=-uy,vy=ux;
    const length=1-.033*registration;
    const a=length*ux*ex+depth*vx*nx;
    const b=length*uy*ex+depth*vy*nx;
    const c=length*ux*ey+depth*vx*ny;
    const d=length*uy*ey+depth*vy*ny;
    const pivotX=hinge.x+14*registration,pivotY=hinge.y+67*registration;
    ctx.save();
    if(calm)ctx.globalAlpha=pose.open;
    ctx.transform(a,b,c,d,pivotX-a*hinge.x-c*hinge.y,pivotY-b*hinge.x-d*hinge.y);
    const reverse=unit((rotation-.64)/.22);
    ctx.save();ctx.globalAlpha=(calm?pose.open:1)*(1-reverse);
    ctx.drawImage(lid,374,334);ctx.restore();
    if(reverse>0){
      ctx.save();ctx.globalAlpha=(calm?pose.open:1)*reverse;
      ctx.drawImage(underside,374,334);ctx.restore();
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
