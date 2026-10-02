import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import {AdminUser,Category,NGO,PasswordResetToken,User} from '../models.js';
import {getJwtSecret,requireAuth,signToken} from '../middleware/auth.js';

const router=express.Router();
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean=value=>typeof value==='string'?value.trim().slice(0,1000):value;
const cleanArray=value=>Array.isArray(value)?value.map(clean).filter(Boolean).slice(0,30):typeof value==='string'?value.split(',').map(clean).filter(Boolean).slice(0,30):[];
const passwordOk=value=>typeof value==='string'&&value.length>=8&&value.length<=128;
const phoneOk=value=>!value||/^[+0-9 ()-]{7,20}$/.test(value);
const urlOk=value=>{if(!value)return true;try{new URL(value);return true;}catch{return false;}};
const uniqueError=error=>error?.code===11000;
const slugify=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const invalid=(res,message)=>res.status(400).json({error:message});

async function issuePasswordReset(user){
  const rawToken=crypto.randomBytes(32).toString('hex');
  await PasswordResetToken.create({user:user._id,tokenHash:crypto.createHash('sha256').update(rawToken).digest('hex'),expiresAt:new Date(Date.now()+60*60*1000)});
  return rawToken;
}

router.post('/register',async(req,res,next)=>{
  try{
    const name=clean(req.body.name),email=clean(req.body.email)?.toLowerCase(),password=req.body.password;
    if(!name||!emailPattern.test(email||'')||!passwordOk(password))return invalid(res,'Name, a valid email, and a password of at least 8 characters are required');
    const user=await User.create({name,email,passwordHash:await bcrypt.hash(password,12),phone:clean(req.body.phone),skills:req.body.skills,interests:req.body.interests,location:clean(req.body.location)});
    res.status(201).json({user:{id:user.id,name:user.name,email:user.email,role:user.role},token:signToken({id:user.id,role:user.role,email:user.email,tokenVersion:user.tokenVersion})});
  }catch(error){if(uniqueError(error))return res.status(409).json({error:'An account with that email already exists'});next(error);}
});

async function login(req,res,next){
  try{
    const email=clean(req.body.email)?.toLowerCase(),password=req.body.password;
    if(!emailPattern.test(email||'')||typeof password!=='string')return invalid(res,'Valid email and password are required');
    let account=await AdminUser.findOne({email});
    let role='ADMIN';
    if(!account){account=await User.findOne({email});role='USER';}
    if(!account){account=await NGO.findOne({email});role='NGO';}
    if(!account||!await bcrypt.compare(password,account.passwordHash))return res.status(401).json({error:'Invalid credentials'});
    if(account.status==='suspended'||account.status==='SUSPENDED')return res.status(403).json({error:'Account suspended'});
    res.json({token:signToken({id:account.id,role,email,tokenVersion:account.tokenVersion||0}),user:{id:account.id,name:account.name,email,role,status:account.status||'active'}});
  }catch(error){next(error);}
}

router.post('/login',login);
router.post('/admin/login',login);
router.post('/user/login',login);
router.post('/ngo/login',login);

router.post('/ngo/register',async(req,res,next)=>{
  try{
    const name=clean(req.body.name),email=clean(req.body.email)?.toLowerCase(),password=req.body.password;
    if(!name||!emailPattern.test(email||'')||!passwordOk(password))return invalid(res,'Organization name, valid email, and a password of at least 8 characters are required');
    if(!phoneOk(req.body.phone)||!urlOk(req.body.website)||!urlOk(req.body.logo)||(req.body.pinCode&&!/^[A-Za-z0-9 -]{4,10}$/.test(req.body.pinCode)))return invalid(res,'Phone, website, logo, or PIN code is invalid');
    const baseSlug=slugify(name);
    const slug=`${baseSlug||'ngo'}-${crypto.randomBytes(3).toString('hex')}`;
    const establishedYear=Number(req.body.establishedYear);
    if(req.body.establishedYear&&(!Number.isInteger(establishedYear)||establishedYear<1800||establishedYear>new Date().getFullYear()))return invalid(res,'Established year is invalid');
    const causes=cleanArray(req.body.causes);
    if(causes.some(cause=>!mongoose.isValidObjectId(cause))||await Category.countDocuments({_id:{$in:causes}})!==causes.length)return invalid(res,'One or more causes are invalid');
    const ngo=await NGO.create({name,slug,email,passwordHash:await bcrypt.hash(password,12),registrationNumber:clean(req.body.registrationNumber),phone:clean(req.body.phone),address:clean(req.body.address),city:clean(req.body.city),state:clean(req.body.state),pinCode:clean(req.body.pinCode),website:clean(req.body.website),logo:clean(req.body.logo),description:clean(req.body.description),mission:clean(req.body.mission),vision:clean(req.body.vision),areasServed:cleanArray(req.body.areasServed),causes,supportingDocumentInfo:clean(req.body.supportingDocumentInfo),establishedYear:establishedYear||undefined,contactPerson:clean(req.body.contactPerson),status:'PENDING'});
    res.status(201).json({ngo:{id:ngo.id,name:ngo.name,email:ngo.email,status:ngo.status},token:signToken({id:ngo.id,role:'NGO',email:ngo.email,tokenVersion:ngo.tokenVersion})});
  }catch(error){if(uniqueError(error))return res.status(409).json({error:'An NGO with that email already exists'});next(error);}
});

router.get('/me',requireAuth,(req,res)=>res.json({user:req.auth.account,role:req.auth.role}));
router.post('/logout',requireAuth,async(req,res,next)=>{try{const Model=req.auth.role==='ADMIN'?AdminUser:req.auth.role==='NGO'?NGO:User;await Model.findByIdAndUpdate(req.auth.id,{$inc:{tokenVersion:1}});res.json({success:true});}catch(error){next(error);}});

router.post('/forgot-password',async(req,res,next)=>{
  try{
    const email=clean(req.body.email)?.toLowerCase();
    if(!emailPattern.test(email||''))return invalid(res,'A valid email is required');
    const account=await User.findOne({email});
    if(account)await issuePasswordReset(account);
    res.json({message:'If an account exists, password reset instructions have been prepared'});
  }catch(error){next(error);}
});

router.post('/reset-password',async(req,res,next)=>{
  try{
    const rawToken=clean(req.body.token),password=req.body.password;
    if(!rawToken||!passwordOk(password))return invalid(res,'A reset token and password of at least 8 characters are required');
    const tokenHash=crypto.createHash('sha256').update(rawToken).digest('hex');
    const reset=await PasswordResetToken.findOne({tokenHash,usedAt:null,expiresAt:{$gt:new Date()}});
    if(!reset)return res.status(400).json({error:'Invalid or expired reset token'});
    const user=await User.findById(reset.user);
    if(!user)return res.status(400).json({error:'Invalid reset token'});
    user.passwordHash=await bcrypt.hash(password,12);await user.save();reset.usedAt=new Date();await reset.save();
    res.json({success:true});
  }catch(error){next(error);}
});

export default router;
export {getJwtSecret};
