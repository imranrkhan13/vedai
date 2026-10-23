export async function notifyWaitlist(entry:{id:string;name:string;email:string;institution:string}):Promise<boolean>{
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM,to=process.env.WAITLIST_NOTIFY_TO;
 if(!key||!from||!to)return false;
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`waitlist-${entry.id}`},signal:AbortSignal.timeout(10000),body:JSON.stringify({from,to:[to],subject:'New Quesly early-access request',text:`Name: ${entry.name}\nEmail: ${entry.email}\nInstitution: ${entry.institution || 'Not specified'}\n\nThis request does not grant access. Review it before approving.`})});
  return r.ok;
 }catch{return false;}
}
