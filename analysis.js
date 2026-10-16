/* Pure analysis functions, shared by the browser and Node tests. */
(function (root) {
  'use strict';
  const rules = [
    {id:'thirds',name:'Rule of thirds',symbol:'⊞',explanation:'The frame is divided into nine equal rectangles. Subjects near the intersections and horizons near the horizontal thirds can create an off-centre balance.'},
    {id:'golden',name:'Golden ratio grid',symbol:'φ',explanation:'Lines at approximately 38.2% and 61.8% of the frame form a golden ratio grid. Compare important edges and subjects with these lines. This is a grid, not a detected golden spiral.'},
    {id:'center',name:'Central composition',symbol:'⊙',explanation:'Placing a focal point near the centre can create a direct, stable composition. The crosshair and central region help compare the subject with the centre of the frame.'},
    {id:'symmetry',name:'Bilateral symmetry',symbol:'↔',explanation:'A central vertical axis helps compare the left and right halves. Similar brightness on both sides can suggest symmetry, but matching brightness does not mean matching objects.'},
    {id:'diagonals',name:'Diagonal composition',symbol:'⤢',explanation:'Corner-to-corner diagonals can suggest movement and depth. The analysis checks whether strong edges fall near these two diagonals; it does not identify the meaning of the objects.'},
    {id:'horizon',name:'Horizontal structure',symbol:'≡',explanation:'The solid line marks the strongest horizontal brightness transition. Dashed thirds offer a comparison. The transition may be a skyline, an object edge, or something else—not necessarily a horizon.'},
    {id:'space',name:'Negative space',symbol:'◻',explanation:'The tinted region is the least textured third of this image. Low texture can indicate room around a subject, but it may also be a blurred or flat object.'},
    {id:'leading',name:'Leading lines',symbol:'⋀',manual:true,explanation:'Compare visible roads, rails, shorelines and other edges with these illustrative converging guides. The lines are a manual reference, not detected paths or a measured vanishing point.'},
    {id:'spiral',name:'Golden spiral',symbol:'◎',manual:true,explanation:'This golden logarithmic spiral is a reference for exploring a curved visual path toward a focal area. Its placement is fixed; the app does not detect a spiral or infer that one was used.'},
    {id:'framing',name:'Frame within a frame',symbol:'▣',manual:true,explanation:'Look for doorways, branches, windows or foreground objects enclosing your subject. The inset rectangle is illustrative; identifying a natural frame requires your interpretation.'},
    {id:'patterns',name:'Repetition & rhythm',symbol:'▥',manual:true,explanation:'Repeated forms, textures and intervals can guide the eye. Use the evenly spaced guides to inspect repetition; this app does not recognise repeated semantic objects.'},
    {id:'triangle',name:'Triangles & balance',symbol:'△',manual:true,explanation:'Three visual anchors can form a stable or dynamic triangle. Compare the illustrative triangle with the main objects. Their identity and the photographer’s intent are not automatically inferred.'}
  ];
  function format(value) {
    if(value instanceof Date) return isNaN(value)?'Invalid date':value.toISOString().replace('T',' ').replace('.000Z',' (parser date; timezone not established)');
    if(ArrayBuffer.isView(value)) return '[Binary data: '+value.byteLength+' bytes]';
    if(typeof value==='object' && value!==null) return JSON.stringify(value);
    return String(value ?? '');
  }
  function flatten(obj,prefix='',out=[]) {
    for(const [key,value] of Object.entries(obj||{})) {
      const path=prefix?prefix+'.'+key:key;
      if(value && typeof value==='object' && !Array.isArray(value) && !(value instanceof Date) && !ArrayBuffer.isView(value)) flatten(value,path,out);
      else out.push([path,format(value)]);
    }
    return out;
  }
  function isLocation(key){return /gps|latitude|longitude|location|sublocation|city|province|country|address|geotag/i.test(key);}
  function origin(rows) {
    const toolRules=[['Midjourney',/\bmidjourney\b/i],['DALL·E',/\bdall[\s·._-]*e\b/i],['Stable Diffusion',/stable[ _-]*diffusion|\bsd[ _-]*xl\b/i],['Adobe Firefly',/\bfirefly\b/i],['FLUX',/\bflux[. _-]?(?:1|2|dev|schnell|pro)\b/i],['ComfyUI',/\bcomfyui\b/i],['AUTOMATIC1111',/automatic1111/i],['InvokeAI',/invokeai/i],['NovelAI',/novelai/i]];
    const evidence=[], tools=[];
    const relevant=rows.filter(([key])=>/software|creator|tool|source|comment|description|parameter|prompt|workflow|model|generator|credit/i.test(key));
    for(const [name,re] of toolRules){const matches=relevant.filter(([,v])=>re.test(v));if(matches.length){tools.push(name);evidence.push(name+' mentioned in '+matches.map(([k])=>k).join(', '));}}
    const synthetic=rows.filter(([k,v])=>/DigitalSourceType/i.test(k)&&/trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia/i.test(v));
    if(synthetic.length)evidence.push('DigitalSourceType declares AI-generated or AI-composited content.');
    if(relevant.some(([,v])=>/Steps:\s*\d+[\s\S]*Sampler:[\s\S]*Seed:/i.test(v))) evidence.push('Diffusion-style generation parameters are embedded.');
    const camera=rows.some(([k,v])=>/(^|\.)(Make|Model|LensModel)$/.test(k)&&v);
    if(camera)evidence.push('Camera or lens metadata is present; it can be copied or edited.');
    const ai=tools.length||synthetic.length||evidence.some(v=>v.startsWith('Diffusion'));
    return {title:ai?'AI-related clues found':camera?'Camera metadata found':'Origin undetermined',summary:ai?'Embedded text refers to generative tools or synthetic content. It may describe generation, editing, or a copied tag; authorship is not verified.':camera?'The file contains camera-related tags. This supports a possible photographic workflow, but cannot rule out AI generation or editing.':'No supported origin clues were found. This does not establish whether the image was photographed or generated.',tools:tools.join(', ')||'Not established',generatedAt:'Not established — embedded dates do not verify generation time',evidence};
  }
  function analyze(pixels,w,h){
    const gray=new Float64Array(w*h),edge=new Float64Array(w*h), rowEnergy=new Float64Array(h);
    for(let i=0;i<gray.length;i++)gray[i]=.2126*pixels[i*4]+.7152*pixels[i*4+1]+.0722*pixels[i*4+2];
    let total=0,sx=0,sy=0,mirror=0, third=0,golden=0,diagonal=0;const zones=Array(6).fill(0);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,dx=gray[i+1]-gray[i-1],dy=gray[i+w]-gray[i-w],e=Math.hypot(dx,dy),nx=x/(w-1),ny=y/(h-1);
      edge[i]=e;total+=e;sx+=e*nx;sy+=e*ny;rowEnergy[y]+=Math.abs(dy);
      mirror+=Math.abs(gray[i]-gray[y*w+w-1-x]);
      const near=(v,lines)=>Math.min(...lines.map(l=>Math.abs(v-l)));
      if(Math.min(near(nx,[1/3,2/3]),near(ny,[1/3,2/3]))<.045)third+=e;
      if(Math.min(near(nx,[.382,.618]),near(ny,[.382,.618]))<.045)golden+=e;
      if(Math.min(Math.abs(nx-ny),Math.abs(nx+ny-1))<.065)diagonal+=e;
      zones[Math.min(2,Math.floor(nx*3))]+=e;zones[3+Math.min(2,Math.floor(ny*3))]+=e;
    }
    const cx=total?sx/total:.5,cy=total?sy/total:.5,signal=total/((w-2)*(h-2));
    let horizon=1;for(let y=2;y<h-1;y++)if(rowEnergy[y]>rowEnergy[horizon])horizon=y;
    const z=zones.indexOf(Math.min(...zones));
    const scores={thirds:total?third/total:0,golden:total?golden/total:0,center:Math.max(0,1-Math.hypot(cx-.5,cy-.5)*2.8),symmetry:Math.max(0,1-mirror/((w-2)*(h-2)*80)),diagonals:total?diagonal/total:0,horizon:total?Math.min(1,rowEnergy[horizon]/total*8):0,space:total?Math.max(0,1-zones[z]/(total/3)):0};
    const thresholds={thirds:.43,golden:.43,center:.88,symmetry:.82,diagonals:.36,horizon:.38,space:.65};
    const observations={thirds:Math.round(scores.thirds*100)+'% of edge energy is near the thirds grid.',golden:Math.round(scores.golden*100)+'% of edge energy is near the golden grid.',center:'Contrast-weighted centre: '+Math.round(cx*100)+'% across, '+Math.round(cy*100)+'% down. Multiple subjects can average to the centre.',symmetry:'Left/right brightness similarity is a rough pixel comparison, not object recognition.',diagonals:Math.round(scores.diagonals*100)+'% of edge energy is near the diagonals.',horizon:'Strongest horizontal transition: '+Math.round(horizon/h*100)+'% down the image.',space:'Lowest edge density: '+['left third','middle vertical third','right third','top third','middle horizontal third','bottom third'][z]+'.'};
    // Compare excess above each rule's own threshold, rather than incomparable raw scores.
    const ranked=Object.keys(scores).sort((a,b)=>(scores[b]-thresholds[b])/(1-thresholds[b])-(scores[a]-thresholds[a])/(1-thresholds[a]));
    const matches=ranked.filter(k=>signal>3&&scores[k]>=thresholds[k]);
    return {scores,cx,cy,horizon:horizon/h,space:z,signal,observations,matches,best:signal>3?ranked[0]:null};
  }
  function photoFacts(rows){
    const find=(names)=>{for(const name of names){const row=rows.find(([k,v])=>(name.includes('.')?k.toLowerCase()===name.toLowerCase():k.split('.').pop().toLowerCase()===name.toLowerCase())&&v);if(row){try{const values=JSON.parse(row[1]);if(Array.isArray(values))return values.join(', ');}catch{}return row[1];}}return 'Not embedded';};
    const capture=find(['DateTimeOriginal','DateCreated']);
    const offset=find(['OffsetTimeOriginal']);
    const time=find(['TimeCreated']);
    const identity=[['Photographer / author',find(['Artist','By-line','Creator','Author'])],['Copyright / rights',find(['ifd0.Copyright','iptc.CopyrightNotice','dc.rights.value','dc.rights','xmp.Rights','xmp.Copyright','CopyrightNotice',...(!rows.some(([k])=>/^(crs|icc)\./i.test(k))?['Copyright']:[])])],['Date & time taken',capture==='Not embedded'?capture:capture+(time!=='Not embedded'&&!/\d{2}:\d{2}:\d{2}/.test(capture)?' '+time:'')+(offset!=='Not embedded'?' (UTC'+offset+')':/Z$|[+-]\d{2}:\d{2}$/.test(capture)?'':' (timezone not embedded)')]];
    const camera=[];
    const make=find(['Make']),model=find(['Model']);
    if(make!=='Not embedded'||model!=='Not embedded')camera.push(['Camera',(model!=='Not embedded'&&make!=='Not embedded'&&model.toLowerCase().startsWith(make.toLowerCase())?model:[make,model].filter(v=>v!=='Not embedded').join(' '))]);
    const fields=[['Lens',['LensModel','Lens']],['ISO',['ISO','ISOSpeedRatings']],['Aperture',['FNumber']],['Shutter speed',['ExposureTime']],['Focal length',['FocalLength']],['35mm equivalent',['FocalLengthIn35mmFormat','FocalLengthIn35mmFilm']],['Exposure compensation',['ExposureCompensation','ExposureBiasValue']],['Exposure program',['ExposureProgram']],['Exposure mode',['ExposureMode']],['Metering mode',['MeteringMode']],['White balance',['WhiteBalance']],['Flash',['Flash']],['Camera owner',['CameraOwnerName']],['Body serial number',['BodySerialNumber','SerialNumber']],['Lens serial number',['LensSerialNumber']],['Lens manufacturer',['LensMake']],['Maximum aperture',['MaxApertureValue']],['Light source',['LightSource']],['Digital zoom',['DigitalZoomRatio']],['Focus distance',['SubjectDistance']],['Scene capture type',['SceneCaptureType']]];
    for(const [label,names] of fields){let value=find(names);if(value==='Not embedded')continue;if(label==='Aperture')value='f/'+value;if(label==='Shutter speed'&&Number(value)>0)value=(Number(value)<1?'1/'+Math.round(1/Number(value)):value)+' s';if(label==='Focal length'||label==='35mm equivalent')value+=' mm';camera.push([label,value]);}
    // Preserve other decoded exposure/camera fields without duplicating the curated labels.
    const known=new Set(['Make','Model',...fields.flatMap(([,names])=>names)].map(k=>k.toLowerCase()));
    for(const [key,value] of rows){const leaf=key.split('.').pop();if(!known.has(leaf.toLowerCase())&&!isLocation(key)&&/lens|camera|exposure|aperture|shutter|focal|flash|metering|whitebalance|sensitivity|focus/i.test(leaf)){camera.push([leaf.replace(/([a-z])([A-Z])/g,'$1 $2'),value]);known.add(leaf.toLowerCase());}}
    return {identity,camera};
  }
  const api={rules,format,flatten,isLocation,origin,analyze,photoFacts};root.FrameAnalysis=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
