/* A typeset, browser-only photo report. Fonts are bundled for offline export. */
window.FrameReport={create(data){
 const doc=new jspdf.jsPDF({unit:'pt',format:'a4',compress:true});
 doc.addFileToVFS('Frame-Regular.ttf',FrameFonts.regular);doc.addFont('Frame-Regular.ttf','Frame','normal');
 doc.addFileToVFS('Frame-Bold.ttf',FrameFonts.bold);doc.addFont('Frame-Bold.ttf','Frame','bold');
 doc.setProperties({title:'Frame photo report - '+data.file.name,author:'Frame',subject:'Embedded photo information and composition exploration',creator:'Frame by Ege Kıyıcı'});
 const W=595.28,H=841.89,M=40,CW=W-2*M,BOTTOM=785;
 const ink='#20252b',muted='#737b85',accent='#456b58',line='#e2e8e2',wash='#f2f5f2';
 let y=0,section='PHOTO REPORT',pageCount=0;
 function font(size=10,bold=false,color=ink){doc.setFont('Frame',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);}
 function text(value,x,top,size=10,bold=false,color=ink){
  font(size,bold,color);
  // Retain scripts outside Noto Sans's coverage through a high-resolution local-font fallback.
  if(/[^\u0000-\u2fff\ua000-\ua7ff]/u.test(String(value))){
   const c=document.createElement('canvas'),ctx=c.getContext('2d'),scale=3;ctx.font=(bold?'bold ':'')+(size*scale)+'px Arial';c.width=Math.max(1,Math.ceil(ctx.measureText(String(value)).width)+6);c.height=Math.ceil(size*scale*1.6);ctx.font=(bold?'bold ':'')+(size*scale)+'px Arial';ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(String(value),0,0);doc.addImage(c.toDataURL('image/png'),'PNG',x,top,c.width/scale,c.height/scale);
  }else doc.text(String(value),x,top+size*.82);
 }
 function wrap(value,width=CW,size=10,bold=false){font(size,bold);return doc.splitTextToSize(String(value),width);}
 function rule(top){doc.setDrawColor(line);doc.setLineWidth(.6);doc.line(M,top,W-M,top);}
 function page(label){
  if(pageCount++)doc.addPage();section=label;y=88;
  doc.setFillColor('#ffffff');doc.rect(0,0,W,H,'F');
  doc.setDrawColor(ink);doc.setLineWidth(1.15);
  for(const x of [M+5,M+15])doc.line(x,27,x,47);
  for(const yy of [32,42])doc.line(M,yy,M+20,yy);
  text('frame.',M+29,26,22,true);text(label,W-M-145,35,8,true,muted);rule(62);
 }
 function ensure(height){if(y+height>BOTTOM)page(section+' / CONTINUED');}
 function paragraph(value,size=10,color=ink,width=CW,x=M){
  const lines=wrap(value,width,size);for(const lineText of lines){ensure(size*1.55);text(lineText,x,y,size,false,color);y+=size*1.55;}y+=8;
 }
 function heading(label,subtitle){ensure(70);text(label,M,y,28,true);y+=39;if(subtitle)paragraph(subtitle,9,muted);y+=5;}
 function label(value){ensure(32);text(value.toUpperCase(),M,y,8,true,accent);y+=23;}
 function image(id,overlay,height){
  const canvas=document.createElement('canvas');data.paint(canvas,id,overlay,2400);
  const scale=Math.min(CW/canvas.width,height/canvas.height),pw=canvas.width*scale,ph=canvas.height*scale;
  ensure(ph+30);doc.setFillColor(wash);doc.roundedRect(M,y,CW,ph+18,8,8,'F');
  doc.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',M+(CW-pw)/2,y+9,pw,ph,undefined,'FAST');y+=ph+30;
 }
 function table(rows,{keyWidth=145,size=9,padding=18,gap=18}={}){
  let index=0;
  for(const [key,raw] of rows){
   const str=String(raw),value=str.length>12000?str.slice(0,12000)+' [PDF value shortened after 12,000 characters; complete extracted value remains in the app.]':str;
   const keyLines=wrap(key,keyWidth-20,size,true),valueLines=wrap(value,CW-keyWidth-24,size);
   let offset=0,total=Math.max(keyLines.length,valueLines.length);
   while(offset<total){
    ensure(38);const available=Math.max(1,Math.floor((BOTTOM-y-padding)/(size*1.5))),count=Math.min(total-offset,available),height=count*size*1.5+padding;
    if(index%2===0){doc.setFillColor(wash);doc.roundedRect(M,y,CW,height,4,4,'F');}
    for(let i=0;i<count;i++){
     if(keyLines[offset+i])text(keyLines[offset+i],M+12,y+padding/2+i*size*1.5,size,true,muted);
     else if(offset>0&&i===0)text('(continued)',M+12,y+padding/2,size,false,muted);
     if(valueLines[offset+i])text(valueLines[offset+i],M+keyWidth,y+padding/2+i*size*1.5,size,false,ink);
    }
    y+=height;offset+=count;if(offset<total)page(section+' / CONTINUED');
   }index++;
  }y+=gap;
 }
 page('PHOTO REPORT');
 heading('A closer look.',data.file.name);
 image(null,false,310);
 text('ORIGINAL IMAGE',M,y,8,true,muted);text(data.img.naturalWidth+' × '+data.img.naturalHeight+' px',W-M-100,y,8,false,muted);y+=28;
 label('The story behind the image');
 const camera=data.facts.camera.find(([k])=>k==='Camera');
 table([...data.facts.identity,...(camera?[camera]:[])],{size:9.5});
 const settings=data.facts.camera.filter(([k])=>['ISO','Aperture','Shutter speed','Focal length'].includes(k));
 if(settings.length){ensure(58);const cell=CW/settings.length;for(let i=0;i<settings.length;i++){text(settings[i][0].toUpperCase(),M+i*cell,y,7,true,muted);text(settings[i][1],M+i*cell,y+16,11,true);}y+=52;}
 paragraph('Author, rights and capture time are embedded claims, not independently verified. Missing information cannot be recovered from this file.',8,muted);
 for(let i=0;i<data.rules.length;i++){
  const r=data.rules[i];page('COMPOSITION / '+String(i+1).padStart(2,'0'));heading(r.name,data.ruleLabel(r));
  image(r.id,true,405);
  label('How to read the guide');paragraph(r.explanation,11);
  ensure(80);doc.setFillColor(wash);doc.roundedRect(M,y,CW,5,2,2,'F');y+=20;
  label('In this image');paragraph(data.observation(r),10,ink);
  paragraph('Geometric alignment is a visual suggestion. It does not establish the photographer\'s intent or a validated classification.',8.5,muted);
 }
 page('ORIGIN & CAMERA');heading('Evidence & equipment.','What the file records, and what remains unknown.');
 label('Origin assessment');paragraph(data.origin.title,15,accent);paragraph(data.origin.summary,10);
 table([['AI tool mentioned',data.origin.tools],['AI generation time',data.origin.generatedAt]]);
 for(const evidence of data.origin.evidence)paragraph('• '+evidence,9,muted);
 for(const notice of data.notices)paragraph('Extraction note: '+notice,9,muted);
 label('Recorded camera data');
 if(data.facts.camera.length)table(data.facts.camera);else paragraph('No supported camera settings are embedded in this file.',10,muted);
 paragraph('Metadata can be copied, edited or removed. Camera tags do not prove human origin; tool mentions do not prove AI generation. Signed Content Credentials are not verified.',8.5,muted);
 page('METADATA INDEX');heading('The complete details.',data.rows.length+' extracted fields');
 paragraph(data.includeLocation?'Recognised location fields are included.':'Recognised location fields are excluded. Free text and image content may still reveal identifying information.',9,muted);
 paragraph('Capture dates are shown as embedded. File modification time is separate from the time the photograph was taken. Unsupported metadata may not be extracted.',8.5,muted);
 const groups=new Map();for(const row of data.rows){const group=row[0].includes('.')?row[0].split('.')[0]:'Other';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row);}
 for(const [group,rows] of groups){ensure(55);label(group==='File'?'File information':group+' metadata');table(rows,{keyWidth:180,size:8.5,padding:10,gap:8});}
 const total=doc.getNumberOfPages(),created=new Date().toISOString().slice(0,10);
 for(let i=1;i<=total;i++){doc.setPage(i);rule(805);text('FRAME  /  '+created,M,816,7,false,muted);text('Ege Kıyıcı @2026',240,816,7,false,muted);text(String(i).padStart(2,'0')+' / '+String(total).padStart(2,'0'),W-M-38,816,7,false,muted);}
 return doc;
}};
