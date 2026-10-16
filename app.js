'use strict';
const A=FrameAnalysis, $=id=>document.getElementById(id);
let state=null, selected='thirds', overlay=true, busy=false;
const MAX_BYTES=30*1024*1024;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function setBusy(value){busy=value;$('file').disabled=value;$('demo').disabled=value;$('download').disabled=value;}
function visibleRows(){return state.rows.filter(([key])=>$('location').checked||!A.isLocation(key));}
function lookup(names){for(const name of names){const row=visibleRows().find(([key])=>key.split('.').pop().toLowerCase()===name.toLowerCase());if(row&&row[1])return row[1];}return 'Not embedded';}
function metrics(){
 const exposure=lookup(['ExposureTime']);const n=Number(exposure);
 return [['Author',lookup(['Artist','By-line','Creator','Author'])],['Camera',photoFacts().camera.find(([key])=>key==='Camera')?.[1]||'Not embedded'],['Lens',lookup(['LensModel','Lens'])],['ISO',lookup(['ISO','ISOSpeedRatings'])],['Aperture',lookup(['FNumber'])==='Not embedded'?'Not embedded':'f/'+lookup(['FNumber'])],['Shutter speed',n>0?(n<1?'1/'+Math.round(1/n):n)+' s':exposure],['Capture date / time',lookup(['DateTimeOriginal','DateCreated'])],['Focal length',lookup(['FocalLength'])==='Not embedded'?'Not embedded':lookup(['FocalLength'])+' mm']];
}
function renderMetadata(){
 $('summary').replaceChildren();for(const [label,value] of metrics()){const d=document.createElement('div');d.className='metric';const s=document.createElement('small'),v=document.createElement('strong');s.textContent=label;v.textContent=value;d.append(s,v);$('summary').append(d);}
 const rows=visibleRows(),q=$('search').value.toLowerCase();$('tag-count').textContent='('+rows.length+' fields)';$('metadata-body').replaceChildren();
 for(const [key,value] of rows.filter(r=>r.join(' ').toLowerCase().includes(q))){const tr=document.createElement('tr');for(const text of [key,value]){const td=document.createElement('td');td.textContent=text;tr.append(td);}$('metadata-body').append(tr);}
}
async function pngText(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),out={};
 if(bytes[0]!==137||bytes[1]!==80)return out;
 const latin=new TextDecoder('iso-8859-1'),utf8=new TextDecoder();let offset=8,count=0;
 async function inflate(data){
  if(!window.DecompressionStream)return '[Compressed text: browser decompression unavailable]';
  const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let size=0,chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();return '[Compressed text exceeds 1 MB extraction limit]';}chunks.push(value);}const joined=new Uint8Array(size);let p=0;for(const chunk of chunks){joined.set(chunk,p);p+=chunk.length;}return utf8.decode(joined);}catch{return '[Compressed text could not be decoded]';}
 }
 while(offset+12<=bytes.length&&count<200){const length=view.getUint32(offset),end=offset+8+length;if(end+4>bytes.length)break;const type=latin.decode(bytes.subarray(offset+4,offset+8));
  if(['tEXt','iTXt','zTXt'].includes(type)){count++;const data=bytes.subarray(offset+8,end),nul=data.indexOf(0);if(nul>0&&length<=2*1024*1024){const key=latin.decode(data.subarray(0,nul));let text='';
   if(type==='tEXt')text=latin.decode(data.subarray(nul+1));
   if(type==='zTXt')text=data[nul+1]===0?await inflate(data.subarray(nul+2)):'[Unknown PNG compression]';
   if(type==='iTXt'){const compressed=data[nul+1],langEnd=data.indexOf(0,nul+3),translatedEnd=data.indexOf(0,langEnd+1);if(langEnd>=0&&translatedEnd>=0)text=compressed?await inflate(data.subarray(translatedEnd+1)):utf8.decode(data.subarray(translatedEnd+1));}
   out[key+(out[key]?' #'+count:'')]=text;
  }}offset=end+4;if(type==='IEND')break;
 }return out;
}
function imageDimensions(buffer){
 const b=new Uint8Array(buffer),v=new DataView(buffer);
 if(b[0]===137&&b[1]===80&&b.length>=24)return [v.getUint32(16),v.getUint32(20)];
 if(b[0]===255&&b[1]===216){let p=2;while(p+8<b.length){if(b[p]!==255)break;let marker=b[p+1];p+=2;if(marker===216||marker===1)continue;if(marker===217||marker===218)break;const len=v.getUint16(p);if(len<2||p+len>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [v.getUint16(p+5),v.getUint16(p+3)];p+=len;}}
 if(b.length>=30&&String.fromCharCode(...b.slice(0,4))==='RIFF'){
  const type=String.fromCharCode(...b.slice(12,16));
  if(type==='VP8X')return [1+b[24]+(b[25]<<8)+(b[26]<<16),1+b[27]+(b[28]<<8)+(b[29]<<16)];
  if(type==='VP8L')return [1+((b[21]|b[22]<<8)&16383),1+((b[22]>>6|b[23]<<2|b[24]<<10)&16383)];
  if(type==='VP8 ')return [v.getUint16(26,true)&16383,v.getUint16(28,true)&16383];
 }return null;
}
async function load(file){
 if(busy||!file)return;setBusy(true);status('Reading metadata and exploring the composition…');
 let url;
 try{
  if(!/\.(jpe?g|png|webp)$/i.test(file.name))throw Error('Choose a JPEG, PNG or WebP image.');
  if(file.size>MAX_BYTES)throw Error('This file is larger than 30 MB. Choose a smaller image.');
  const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer);
  if(!((bytes[0]===255&&bytes[1]===216)||(bytes[0]===137&&bytes[1]===80)||(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')))throw Error('The file contents are not a supported image.');
  const dims=imageDimensions(buffer);if(dims&&dims[0]*dims[1]>40e6)throw Error('This image exceeds 40 megapixels. Resize it before opening.');
  url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();
  if(img.naturalWidth*img.naturalHeight>40e6)throw Error('This image exceeds 40 megapixels. Resize it before opening.');
  const notices=[];let meta={};
  if(window.exifr){try{meta=await exifr.parse(buffer,{tiff:true,exif:true,gps:true,xmp:true,iptc:true,icc:true,jfif:true,ihdr:true,userComment:true,mergeOutput:false,reviveValues:false})||{};}catch{notices.push('The metadata parser could not read some embedded fields.');}}else notices.push('Metadata library unavailable. Re-download the complete project.');
  const text=await pngText(buffer);if(Object.keys(text).length)meta.PNGText=text;
  const rows=A.flatten(meta);rows.unshift(['File.Name',file.name],['File.Size',file.size+' bytes'],['File.Dimensions',img.naturalWidth+' × '+img.naturalHeight],['File.Modified',new Date(file.lastModified).toISOString()+' (file timestamp, not capture time)']);
  const sample=document.createElement('canvas'),ratio=Math.min(1,256/Math.max(img.naturalWidth,img.naturalHeight));sample.width=Math.max(4,Math.round(img.naturalWidth*ratio));sample.height=Math.max(4,Math.round(img.naturalHeight*ratio));const sc=sample.getContext('2d',{willReadFrequently:true});sc.fillStyle='#fff';sc.fillRect(0,0,sample.width,sample.height);sc.drawImage(img,0,0,sample.width,sample.height);
  const analysis=A.analyze(sc.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);
  state={img,rows,file,analysis,origin:A.origin(rows),notices};selected=analysis.best;overlay=!!selected;$('toggle').textContent=overlay?'Overlay on':'Overlay off';$('toggle').setAttribute('aria-pressed',String(overlay));$('toggle').disabled=!selected;$('all-guides').checked=false;$('guide-library').hidden=true;$('show-guides').setAttribute('aria-expanded','false');$('show-guides').textContent='Explore all composition guides ＋';$('rules').replaceChildren();$('search').value='';$('location').checked=false;
  $('results').hidden=false;$('empty-notes').hidden=true;$('filename').textContent=file.name;$('dimensions').textContent=img.naturalWidth+' × '+img.naturalHeight+' px · '+(file.size/1024/1024).toFixed(2)+' MB';
  renderOrigin();renderRules();renderMetadata();draw();
  status(notices.length?notices.join(' '):'Analysis complete. Explore the guides and download your report.',!!notices.length);
 }catch(error){status(error.message||'This image could not be decoded. Try another JPEG, PNG or WebP.',true);}finally{if(url)URL.revokeObjectURL(url);setBusy(false);$('file').value='';}
}
function photoFacts(){return A.photoFacts(visibleRows());}
function renderOrigin(){
 const o=state.origin,facts=photoFacts();
 $('origin-title').textContent=o.title;$('origin-summary').textContent=o.summary;$('origin-details').replaceChildren();
 for(const [key,value] of [...facts.identity,...facts.camera.filter(([key])=>['Camera','Lens','ISO','Aperture','Shutter speed','Focal length'].includes(key)),['AI tool mentioned',o.tools],['AI generation time',o.generatedAt]]){
  const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;$('origin-details').append(dt,dd);
 }
 $('camera-more').hidden=!facts.camera.length;$('camera-data').replaceChildren();
 for(const [key,value] of facts.camera){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;$('camera-data').append(dt,dd);}
 $('evidence').replaceChildren();for(const text of o.evidence){const li=document.createElement('li');li.textContent=text;$('evidence').append(li);}
}
function ruleLabel(rule){return rule.manual?'Manual exploration':state.analysis.signal<=3?'Too little contrast':state.analysis.matches.includes(rule.id)?'Suggested alignment':'Explore this guide';}
function renderRules(){
 const rule=A.rules.find(r=>r.id===selected);
 $('selection-label').textContent=selected===state.analysis.best?(state.analysis.matches.includes(selected)?'BEST MEASURED MATCH':'CLOSEST GEOMETRIC GUIDE'):'YOUR SELECTED GUIDE';
 $('rule-title').textContent=rule?rule.name:'No clear composition match';
 $('rule-explanation').textContent=rule?rule.explanation:'This image has too little contrast for a useful automatic selection. Explore the guides below to choose one yourself.';
 $('rule-observation').textContent=rule?(rule.manual?'Reference overlay only. No automatic detection for this rule.':state.analysis.signal<=3?'There is too little contrast for useful automatic suggestions.':state.analysis.observations[selected]):'';
 $('overlay-label').textContent=rule?rule.name:'Original image';
 if(!$('guide-library').hidden)renderGallery();
}
function renderGallery(){
 $('rules').replaceChildren();
 for(const rule of A.rules){
  const card=document.createElement('article');card.className='guide-card'+(selected===rule.id?' active':'');
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',rule.name+' guide on your photograph');paint(canvas,rule.id,true,640);
  const body=document.createElement('div');body.className='guide-body';
  const label=document.createElement('p');label.className='eyebrow';label.textContent=ruleLabel(rule);
  const title=document.createElement('h3');title.textContent=rule.name;
  const description=document.createElement('p');description.textContent=rule.explanation;
  const observation=document.createElement('p');observation.className='muted';observation.textContent=rule.manual?'Illustrative reference; select and compare with your subject.':state.analysis.signal<=3?'Too little contrast for automatic analysis.':state.analysis.observations[rule.id];
  const button=document.createElement('button');button.className='text-button';button.textContent=selected===rule.id?'Selected ✓':'Use this guide →';button.setAttribute('aria-pressed',String(selected===rule.id));button.setAttribute('aria-label','Use '+rule.name+' guide');
  button.addEventListener('click',()=>{selected=rule.id;overlay=true;$('toggle').disabled=false;$('toggle').textContent='Overlay on';$('toggle').setAttribute('aria-pressed','true');renderRules();draw();});
  body.append(label,title,description,observation,button);card.append(canvas,body);$('rules').append(card);
 }
}
function paint(canvas,id,show=true,maxSize=1600){
 const img=state.img,r=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*r);canvas.height=Math.round(img.naturalHeight*r);const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);if(!show)return;
 ctx.strokeStyle='#dcff9d';ctx.fillStyle='rgba(212,244,151,.18)';ctx.lineWidth=Math.max(1.5,Math.min(w,h)/360);ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=3;
 const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1*w,y1*h);ctx.lineTo(x2*w,y2*h);ctx.stroke();};
 if(id==='thirds'||id==='golden'){for(const p of id==='thirds'?[1/3,2/3]:[.382,.618]){line(p,0,p,1);line(0,p,1,p);}}
 if(id==='center'){line(.5,0,.5,1);line(0,.5,1,.5);ctx.beginPath();ctx.ellipse(w/2,h/2,w*.12,h*.12,0,0,Math.PI*2);ctx.stroke();}
 if(id==='symmetry')line(.5,0,.5,1);
 if(id==='diagonals'){line(0,0,1,1);line(0,1,1,0);}
 if(id==='horizon'){ctx.setLineDash([8,8]);line(0,1/3,1,1/3);line(0,2/3,1,2/3);ctx.setLineDash([]);line(0,state.analysis.horizon,1,state.analysis.horizon);}
 if(id==='space'){const z=state.analysis.space;const x=z<3?z/3:0,y=z>=3?(z-3)/3:0;ctx.fillRect(x*w,y*h,z<3?w/3:w,z>=3?h/3:h);ctx.strokeRect(x*w,y*h,z<3?w/3:w,z>=3?h/3:h);}
 if(id==='leading'){line(0,1,.5,.35);line(1,1,.5,.35);line(.25,1,.5,.35);line(.75,1,.5,.35);}
 if(id==='spiral'){ctx.beginPath();const scale=Math.min(w,h)*.48;for(let i=0;i<=500;i++){const t=i/500*Math.PI*5,rad=scale*Math.exp(-Math.log(1.618)/(Math.PI/2)*t),x=w*.5+rad*Math.cos(t),y=h*.5+rad*Math.sin(t);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
 if(id==='framing')ctx.strokeRect(w*.15,h*.15,w*.7,h*.7);
 if(id==='patterns'){ctx.setLineDash([8,6]);for(let i=1;i<6;i++)line(i/6,0,i/6,1);ctx.setLineDash([]);}
 if(id==='triangle'){line(.5,.16,.15,.84);line(.15,.84,.85,.84);line(.85,.84,.5,.16);}
}
function draw(){paint($('photo'),selected,overlay);}
async function download(){
 if(!state||busy)return;
 if(!window.jspdf||!window.FrameFonts||!window.FrameReport){status('Report files are missing. Re-download the complete project.',true);return;}
 setBusy(true);status('Designing your photo report…');
 try{
  await new Promise(resolve=>setTimeout(resolve,30));
  const report=FrameReport.create({file:state.file,img:state.img,origin:state.origin,facts:photoFacts(),rows:visibleRows(),notices:state.notices,includeLocation:$('location').checked,rules:$('all-guides').checked?A.rules:A.rules.filter(r=>r.id===selected),ruleLabel,observation:rule=>rule.manual?'Illustrative guide. Placement is a reference, not automatic detection.':state.analysis.signal<=3?'Too little contrast for an automatic suggestion.':state.analysis.observations[rule.id],paint});
  report.save(state.file.name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]/gi,'_')+'-frame-report.pdf');
  status('Your redesigned PDF is ready.');
 }catch(error){status('PDF export failed: '+error.message,true);}finally{setBusy(false);}
}
function demo(){const c=document.createElement('canvas');c.width=1200;c.height=800;const g=c.getContext('2d');const sky=g.createLinearGradient(0,0,0,800);sky.addColorStop(0,'#8ba7a5');sky.addColorStop(.66,'#e4ddbd');sky.addColorStop(1,'#809584');g.fillStyle=sky;g.fillRect(0,0,1200,800);g.fillStyle='#f9e8b8';g.beginPath();g.arc(800,265,53,0,Math.PI*2);g.fill();g.fillStyle='#778c7c';g.beginPath();g.moveTo(0,470);g.lineTo(180,300);g.lineTo(420,500);g.lineTo(650,380);g.lineTo(900,540);g.lineTo(1200,420);g.lineTo(1200,800);g.lineTo(0,800);g.fill();g.fillStyle='#304f43';g.beginPath();g.moveTo(0,580);g.bezierCurveTo(400,450,650,680,1200,530);g.lineTo(1200,800);g.lineTo(0,800);g.fill();g.fillStyle='#a7b195';g.beginPath();g.moveTo(460,800);g.quadraticCurveTo(740,640,805,540);g.quadraticCurveTo(820,650,700,800);g.fill();g.fillStyle='#223f35';g.fillRect(393,430,14,160);for(let i=0;i<3;i++){g.beginPath();g.moveTo(400,320+i*45);g.lineTo(330-i*12,465+i*45);g.lineTo(470+i*12,465+i*45);g.fill();}c.toBlob(blob=>load(new File([blob],'sample-illustration.png',{type:'image/png'})),'image/png');}
$('file').addEventListener('change',e=>load(e.target.files[0]));$('demo').addEventListener('click',demo);$('download').addEventListener('click',()=>{if(state&&!busy)$('export-dialog').showModal();});$('search').addEventListener('input',renderMetadata);$('location').addEventListener('change',()=>{renderMetadata();renderOrigin();});$('toggle').addEventListener('click',()=>{overlay=!overlay;$('toggle').textContent='Overlay '+(overlay?'on':'off');$('toggle').setAttribute('aria-pressed',String(overlay));draw();});
for(const type of ['dragenter','dragover'])$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.add('drag');});
for(const type of ['dragleave','drop'])$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.remove('drag');});$('dropzone').addEventListener('drop',e=>load(e.dataTransfer.files[0]));

$('show-guides').addEventListener('click',()=>{const show=$('guide-library').hidden;$('guide-library').hidden=!show;$('show-guides').setAttribute('aria-expanded',String(show));$('show-guides').textContent=show?'Hide composition guides −':'Explore all composition guides ＋';if(show)renderGallery();});
for(const id of ['close-export','cancel-export'])$(id).addEventListener('click',()=>$('export-dialog').close());
$('export-form').addEventListener('submit',event=>{event.preventDefault();$('export-dialog').close();download();});
