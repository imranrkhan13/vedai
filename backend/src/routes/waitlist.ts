import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../services/db';
import { notifyWaitlist } from '../services/waitlistMail';
const router=Router();
const requests=new Map<string,{count:number;until:number}>();
router.post('/',async(req,res,next)=>{try{
 const ip=req.ip || 'unknown',now=Date.now();
 if(requests.size>10000)for(const [k,v] of requests)if(v.until<now)requests.delete(k);
 const hit=requests.get(ip);if(hit&&hit.until>now&&hit.count>=5)return res.status(429).json({success:false,error:'Please try again in an hour.'});
 requests.set(ip,hit&&hit.until>now?{...hit,count:hit.count+1}:{count:1,until:now+3600000});
 const p=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().toLowerCase().email().max(200),institution:z.string().trim().max(200).default('')}).safeParse(req.body);
 if(!p.success)return res.status(400).json({success:false,error:'Enter your name and a valid email.'});
 const {rows}=await getDb().query('INSERT INTO vedai_waitlist(email,name,institution) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id',[p.data.email,p.data.name,p.data.institution]);
 if(rows[0] && await notifyWaitlist({id:rows[0].id,...p.data})) await getDb().query('UPDATE vedai_waitlist SET notified_at=now() WHERE id=$1',[rows[0].id]);
 res.status(201).json({success:true,data:{saved:true,message:'Your request is saved. Access is subject to approval.'}});
}catch(e){next(e);}});
export default router;
