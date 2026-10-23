import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getDb } from '../services/db';
import { requireAuth } from '../services/auth';
const router = Router();
router.use(requireAuth);
const digest = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
router.get('/me', async (req,res,next) => { try {
 const {rows}=await getDb().query('SELECT i.id,i.name,m.role FROM vedai_memberships m JOIN vedai_institutions i ON i.id=m.institution_id WHERE m.user_id=$1',[req.userId]);
 res.json({success:true,data:rows[0] || null});
} catch(e){next(e);} });
router.post('/', async(req,res,next)=>{try{
 const p=z.object({name:z.string().trim().min(2).max(120)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({success:false,error:'Enter your institution name.'});
 const {rows}=await getDb().query(`WITH school AS (
 INSERT INTO vedai_institutions(name,admin_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM vedai_memberships WHERE user_id=$2)
 RETURNING id,name), membership AS (INSERT INTO vedai_memberships(user_id,institution_id,role) SELECT $2,id,'admin' FROM school RETURNING institution_id)
 SELECT school.* FROM school JOIN membership ON membership.institution_id=school.id`,[p.data.name,req.userId]);
 if(!rows[0])return res.status(409).json({success:false,error:'You already belong to an institution.'});
 res.status(201).json({success:true,data:rows[0]});
}catch(e){next(e);}});
router.post('/accept',async(req,res,next)=>{try{
 const p=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({success:false,error:'Invalid invitation.'});
 const {rows}=await getDb().query(`WITH invitation AS (
 UPDATE vedai_invitations SET accepted_at=now() WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()
 AND email=(SELECT email FROM vedai_users WHERE id=$2) AND NOT EXISTS(SELECT 1 FROM vedai_memberships WHERE user_id=$2) RETURNING institution_id),
 member AS (INSERT INTO vedai_memberships(user_id,institution_id,role) SELECT $2,institution_id,'teacher' FROM invitation RETURNING institution_id)
 SELECT institution_id FROM member`,[digest(p.data.token),req.userId]);
 if(!rows[0])return res.status(400).json({success:false,error:'Invitation expired, already used, or intended for another email. Sign in with the invited email.'});
 res.json({success:true,data:rows[0]});
}catch(e){next(e);}});
router.use(async(req,res,next)=>{try{
 const {rows}=await getDb().query("SELECT institution_id FROM vedai_memberships WHERE user_id=$1 AND role='admin'",[req.userId]);
 if(!rows[0])return res.status(403).json({success:false,error:'School administrator access required.'});
 res.locals.institutionId=rows[0].institution_id;next();
}catch(e){next(e);}});
router.post('/invitations',async(req,res,next)=>{try{
 const p=z.object({email:z.string().trim().toLowerCase().email().max(200)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({success:false,error:'Enter a valid teacher email.'});
 const token=crypto.randomBytes(32).toString('hex');
 const {rows}=await getDb().query("INSERT INTO vedai_invitations(institution_id,email,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '7 days') RETURNING id,email,expires_at",[res.locals.institutionId,p.data.email,digest(token)]);
 res.status(201).json({success:true,data:{...rows[0],token,delivery:'link_only'}});
}catch(e){next(e);}});
router.get('/overview',async(req,res,next)=>{try{
 const db=getDb(),id=res.locals.institutionId;
 const teachers=await db.query('SELECT u.id,u.email,m.role FROM vedai_memberships m JOIN vedai_users u ON u.id=m.user_id WHERE m.institution_id=$1',[id]);
 const assignments=await db.query('SELECT id,title,subject,status,owner_id,total_marks FROM vedai_assignments WHERE institution_id=$1 ORDER BY created_at DESC',[id]);
 const students=await db.query('SELECT s.id,s.student_id,s.name,s.assignment_id,s.submitted_at,s.released,s.marks FROM vedai_classroom_students s JOIN vedai_assignments a ON a.id=s.assignment_id WHERE a.institution_id=$1',[id]);
 res.json({success:true,data:{teachers:teachers.rows,assignments:assignments.rows,students:students.rows}});
}catch(e){next(e);}});
export default router;
