// Prepare the user's standing NPC artwork for the order-page stall vignette.
// Remove only edge-connected checker backgrounds; preserve clothing and faces.
import { readFileSync, writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const jobs = [
 ['Pixel_art_NPC_standing_0e33d816_2K.jpg', 'stall-man-batik.png'],
 ['Pixel_art_NPC_standing_1c3cea45_2K.jpg', 'stall-man-bag.png'],
 ['Woman_holding_market_basket_sprite_bce4b993_2K.jpg', 'stall-woman-basket.png'],
];
for (const [source, destination] of jobs) {
 const {width:w,height:h,data}=jpeg.decode(readFileSync(`../Assets/folder/${source}`),{useTArray:true});
 const background=new Uint8Array(w*h), removed=new Uint8Array(w*h);
 const queue=new Int32Array(w*h);
 for(let i=0;i<w*h;i++){
  const r=data[i*4],g=data[i*4+1],b=data[i*4+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
  background[i]=max-min<Math.max(18,max*.12)&&(r+g+b)/3>65?1:0;
 }
 let head=0,tail=0;
 const add=i=>{if(!removed[i]&&background[i]){removed[i]=1;queue[tail++]=i;}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
 for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w;if(x>0)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<w*(h-1))add(i+w);}
 // Retain the main character, excluding any disconnected corner marks.
 const visited=new Uint8Array(w*h);let largest=[];
 for(let start=0;start<w*h;start++){
  if(removed[start]||visited[start])continue;
  head=0;tail=1;queue[0]=start;visited[start]=1;
  const push=i=>{if(!removed[i]&&!visited[i]){visited[i]=1;queue[tail++]=i;}};
  while(head<tail){const i=queue[head++],x=i%w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<w*(h-1))push(i+w);}
  if(tail>largest.length)largest=queue.slice(0,tail);
 }
 const keep=new Uint8Array(w*h);let left=w,top=h,right=0,bottom=0;
 for(const i of largest){keep[i]=1;left=Math.min(left,i%w);right=Math.max(right,i%w);top=Math.min(top,Math.floor(i/w));bottom=Math.max(bottom,Math.floor(i/w));}
 const scale=96/(bottom-top+1),width=Math.round((right-left+1)*scale);
 const out=new PNG({width,height:96});
 for(let y=0;y<96;y++)for(let x=0;x<width;x++){
  let r=0,g=0,b=0,n=0,count=0;
  for(let sy=top+Math.floor(y/scale);sy<=Math.min(bottom,top+Math.floor((y+1)/scale));sy++)for(let sx=left+Math.floor(x/scale);sx<=Math.min(right,left+Math.floor((x+1)/scale));sx++){
   count++;const i=sy*w+sx;if(!keep[i])continue;n++;r+=data[i*4];g+=data[i*4+1];b+=data[i*4+2];
  }
  if(n>count*.5){const i=(y*width+x)*4;out.data[i]=Math.round(r/n);out.data[i+1]=Math.round(g/n);out.data[i+2]=Math.round(b/n);out.data[i+3]=255;}
 }
 writeFileSync(`public/assets/scene/${destination}`,PNG.sync.write(out));
 console.log(`${destination}: ${width}x96`);
}
