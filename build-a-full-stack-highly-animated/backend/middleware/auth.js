import jwt from 'jsonwebtoken';
import {AdminUser,NGO,User} from '../models.js';

function jwtSecret(){
  if(!process.env.JWT_SECRET)throw new Error('JWT_SECRET is required');
  return process.env.JWT_SECRET;
}

export function signToken(payload){return jwt.sign(payload,jwtSecret(),{expiresIn:'8h'});}

export async function requireAuth(req,res,next){
  try{
    const header=req.headers.authorization||'';
    if(!header.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});
    const payload=jwt.verify(header.slice(7),jwtSecret());
    let account=null;
    if(payload.role==='ADMIN')account=await AdminUser.findById(payload.id).select('_id name email role');
    if(payload.role==='NGO')account=await NGO.findById(payload.id).select('-passwordHash');
    if(payload.role==='USER')account=await User.findById(payload.id).select('-passwordHash');
    if(!account||payload.tokenVersion!==(account.tokenVersion||0))return res.status(401).json({error:'Account session is no longer valid'});
    if(account.status==='suspended'||account.status==='SUSPENDED')return res.status(403).json({error:'Account suspended'});
    req.auth={id:account.id,role:payload.role,account};
    next();
  }catch(error){return res.status(401).json({error:'Invalid or expired authentication token'});}
}

export function requireRole(...roles){return(req,res,next)=>roles.includes(req.auth?.role)?next():res.status(403).json({error:'Insufficient permissions'});}

export function getJwtSecret(){return jwtSecret();}