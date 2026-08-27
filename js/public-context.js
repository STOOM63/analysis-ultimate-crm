window.AU = window.AU || {};
AU.publicContext = (()=>{
  async function fetchJson(path, fallback){
    try{
      const r=await fetch(path,{cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const x=await r.json();
      return x && typeof x==='object' ? x : fallback;
    }catch(e){
      return {...fallback,error:String(e)};
    }
  }

  async function load(){
    const [ctx,hist]=await Promise.all([
      fetchJson('data/public-context.json',{schema_version:null,generated_at:null,works:[],parking:[],weather:[],source_health:[],status:'unavailable'}),
      fetchJson('data/public-context-history.json',{schema_version:1,snapshots:[]})
    ]);
    ctx.history=Array.isArray(hist?.snapshots)?hist.snapshots:[];
    return ctx;
  }

  function pearson(xs,ys){
    if(xs.length<8||xs.length!==ys.length)return null;
    const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
    let num=0,dx=0,dy=0;
    for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;num+=a*b;dx+=a*a;dy+=b*b}
    return dx&&dy?num/Math.sqrt(dx*dy):null;
  }
  function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
  function ageHours(iso){
    if(!iso)return null; const t=new Date(iso).getTime(); if(!Number.isFinite(t))return null;
    return Math.max(0,(Date.now()-t)/3600000);
  }
  function sourceSummary(ctx){
    const rows=Array.isArray(ctx?.source_health)?ctx.source_health:[];
    const ok=rows.filter(x=>x?.ok).length;
    const total=rows.length;
    const api=ctx?.clermont_api?.health||{};
    const age=ageHours(ctx?.generated_at);
    const stale=age!==null&&age>36;
    let level='good';
    if(!api.ok||stale||ctx?.status==='partial')level='watch';
    if(ctx?.status==='unavailable'||(!api.ok&&ok===0))level='bad';
    return {ok,total,ratio:total?ok/total:0,apiOk:!!api.ok,apiLatency:api.latency_ms??null,totalDatasets:api.total_datasets??null,ageHours:age,stale,level,status:ctx?.status||'unavailable'};
  }
  function parkingSummary(ctx){
    const rows=(ctx?.parking||[]).filter(x=>Number.isFinite(Number(x?.occupancy_pct)));
    if(!rows.length)return null;
    const rates=rows.map(x=>Number(x.occupancy_pct));
    const sorted=[...rows].sort((a,b)=>Number(b.occupancy_pct)-Number(a.occupancy_pct));
    return {records:rows.length,avgOccupancy:avg(rates),maxOccupancy:Number(sorted[0].occupancy_pct),mostOccupied:sorted[0],high:rows.filter(x=>Number(x.occupancy_pct)>=85).length};
  }
  function apiDatasetSummary(ctx){
    const api=ctx?.clermont_api||{};
    const known=Array.isArray(api.known_datasets)?api.known_datasets:[];
    const relevant=Array.isArray(api.discovered_relevant_datasets)?api.discovered_relevant_datasets:[];
    const candidates=Array.isArray(api.candidate_fetch_status)?api.candidate_fetch_status:[];
    return {known,relevant,candidates,knownOk:known.filter(x=>x?.ok).length,candidateOk:candidates.filter(x=>x?.ok).length};
  }

  function correlate(model,ctx){
    if(!ctx) return {matches:[],status:'unavailable',weather:null,source:null,parking:null,apiDatasets:null};
    const matches=[]; const zones=model.geoIntelligence?.zones||[];
    for(const z of zones.filter(x=>x.impactScore>=25)){
      const token=String(z.worksSector||'').toUpperCase();
      const works=(ctx.works||[]).filter(w=>String(w.sector||'').toUpperCase()===token);
      if(works.length){
        const apiCount=works.filter(w=>w.source_type==='clermont_api').length;
        matches.push({zone:z.name,worksSector:z.worksSector,impactScore:z.impactScore,works:works.slice(0,16),quality:apiCount?'api+contextual':'contextual',apiCount,pageCount:works.length-apiCount});
      }
    }
    const weatherBy=new Map((ctx.weather||[]).map(w=>[w.date,w])); const pairs=[];
    for(const d of model.daily||[]){
      const w=weatherBy.get(d.dateKey);
      if(w&&Number.isFinite(Number(w.precipitation_mm)))pairs.push({ca:d.caTTC,tickets:d.tickets,rain:Number(w.precipitation_mm),temp:Number(w.temperature_mean)});
    }
    let weather=null;
    if(pairs.length>=20){
      const rain=pairs.map(x=>x.rain), ca=pairs.map(x=>x.ca), tickets=pairs.map(x=>x.tickets);
      const wet=pairs.filter(x=>x.rain>=3),dry=pairs.filter(x=>x.rain<1);
      weather={days:pairs.length,rainCaCorrelation:pearson(rain,ca),rainVisitsCorrelation:pearson(rain,tickets),wetAvgCA:avg(wet.map(x=>x.ca)),dryAvgCA:avg(dry.map(x=>x.ca)),wetAvgVisits:avg(wet.map(x=>x.tickets)),dryAvgVisits:avg(dry.map(x=>x.tickets))};
    }
    const source=sourceSummary(ctx);
    const parking=parkingSummary(ctx);
    const apiDatasets=apiDatasetSummary(ctx);
    const findings=[];
    if(!source.apiOk) findings.push({level:'warning',title:'API Clermont Métropole indisponible lors de la dernière synchronisation',text:'Analysis Ultimate conserve le dernier contexte valide et les pages officielles de secours. Les analyses commerciales locales continuent normalement.'});
    if(source.stale) findings.push({level:'warning',title:'Contexte public ancien',text:`Dernière synchronisation il y a environ ${Math.round(source.ageHours)} h. Le moteur réduit la confiance accordée aux explications externes.`});
    if(parking?.high) findings.push({level:'info',title:'Stationnement métropolitain sous tension',text:`${parking.high} parc(s) dépassent 85 % d’occupation au dernier relevé API. Ce signal est contextuel et ne prouve pas un impact sur la boutique.`});
    return {matches,status:ctx.status||'ok',weather,source,parking,apiDatasets,findings,generatedAt:ctx.generated_at||null,history:ctx.history||[]};
  }
  return {load,correlate};
})();
