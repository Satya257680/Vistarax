const express = require('express');
const { one, query, run, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router(); router.use(requireAuth);
router.get('/', asyncHandler(async (_req,res)=>res.json({data:await query('SELECT * FROM visit_recipients WHERE active=1 ORDER BY name')})));
router.post('/', requireRole('admin'), asyncHandler(async(req,res)=>{const b=req.body||{};const name=String(b.name||'').trim();if(!name)return res.status(422).json({error:'Name is required.'});const r=await run('INSERT INTO visit_recipients(name,designation,department,email,phone) VALUES(?,?,?,?,?)',[name,b.designation||null,b.department||null,b.email||null,b.phone||null]);await logAudit({userId:req.user.id,username:req.user.username,action:'CREATE',module:'visit_recipients',recordId:r.insertId,ip:req.ip});res.status(201).json({recipient:await one('SELECT * FROM visit_recipients WHERE id=?',[r.insertId])});}));
router.delete('/:id', requireRole('admin'), asyncHandler(async(req,res)=>{await run('UPDATE visit_recipients SET active=0 WHERE id=?',[req.params.id]);res.json({ok:true});}));module.exports=router;
