// Cloudflare Pages Function. Both /internal/* and /api/artist-brief MUST be protected
// by a Cloudflare Access application; this function additionally verifies the JWT.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function authorized(request,env){
 const token=request.headers.get("Cf-Access-Jwt-Assertion");
 if(!token||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)return false;
 try{
  const [header,payload,signature]=token.split(".");
  if(!header||!payload||!signature)return false;
  const decode=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
  const h=JSON.parse(new TextDecoder().decode(decode(header)));
  const p=JSON.parse(new TextDecoder().decode(decode(payload)));
  if(h.alg!=="RS256"||!h.kid||p.aud?.includes(env.ACCESS_AUD)!==true||p.iss!==env.ACCESS_TEAM_DOMAIN.replace(/\/$/,"")||p.exp<=Math.floor(Date.now()/1000)||p.nbf>Math.floor(Date.now()/1000))return false;
  const keys=await fetch(env.ACCESS_TEAM_DOMAIN.replace(/\/$/,"")+"/cdn-cgi/access/certs").then(r=>r.json());
  const jwk=keys.keys?.find(k=>k.kid===h.kid);if(!jwk)return false;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(signature),new TextEncoder().encode(header+"."+payload));
 }catch{return false}
}
export async function onRequestPost({request,env}){
 if(!await authorized(request,env))return json({error:"Unauthorized"},401);
 if(!env.RESEND_API_KEY||!env.BRIEF_FROM_EMAIL)return json({error:"Email service not configured"},503);
 const length=Number(request.headers.get("content-length")||0);if(length>30000)return json({error:"Payload too large"},413);
 let input;try{input=await request.json()}catch{return json({error:"Invalid JSON"},400)}
 const answers=input?.answers;
 if(!answers||typeof answers!=="object"||Array.isArray(answers)||Object.keys(answers).length>80)return json({error:"Invalid answers"},400);
 const respondent=typeof input.respondent==="string"?input.respondent.slice(0,120):"";
 const lines=[];
 for(const [key,value] of Object.entries(answers)){
  if(!/^[a-zA-Z0-9_-]{1,40}$/.test(key))continue;
  const v=Array.isArray(value)?value.slice(0,20).map(x=>String(x).slice(0,300)).join(", "):String(value).slice(0,1500);
  lines.push(key+": "+v);
 }
 const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.BRIEF_FROM_EMAIL,to:["admin@imaginedrecords.nl"],subject:"Nieuwe Artist Creation Brief"+(respondent?" — "+respondent:""),text:"Nieuwe inzending Artist Creation Brief\n\nNaam: "+(respondent||"Niet opgegeven")+"\n\n"+lines.join("\n\n")})});
 if(!result.ok){console.error("Email provider failed",result.status);return json({error:"Delivery failed; retry later"},502)}
 return json({ok:true});
}
