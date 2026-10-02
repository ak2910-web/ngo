import express from 'express';
import mongoose from 'mongoose';
import {Category,Event,EventRegistration,GalleryImage,ImpactReport,NGO,Project,VolunteerApplication,VolunteerOpportunity} from '../models.js';
import {requireAuth,requireRole} from '../middleware/auth.js';

const router=express.Router();
const clean=value=>typeof value==='string'?value.trim().slice(0,2000):value;
const validId=value=>mongoose.isValidObjectId(value);
const regex=value=>new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
const publicStatuses=['VERIFIED'];
const publicFields='-passwordHash -tokenVersion -reviewedBy -adminNotes -supportingDocumentInfo';
const editableNgoFields=['name','registrationNumber','phone','contactPerson','address','city','state','pinCode','website','logo','description','mission','vision','areasServed','causes','establishedYear'];
const projectFields=['name','description','location','image','category','categoryRef','goal','raised','featured','status','objectives','startDate','endDate','requiredVolunteers'];
const opportunityFields=['title','project','category','description','location','type','skills','date','duration','slots','status'];
const eventFields=['name','description','location','image','category','categoryRef','date','endDate','time','endTime','capacity','online','meetingUrl','status'];
const galleryFields=['url','caption','tags','location','project','event'];
const pick=(source,fields)=>Object.fromEntries(fields.filter(field=>source[field]!==undefined).map(field=>[field,source[field]]));
const badId=(res,message='Invalid NGO id')=>res.status(400).json({error:message});
const notFound=(res,message='Resource not found')=>res.status(404).json({error:message});

function publicNgo(ngo,counts={}){
  const data=ngo.toObject?ngo.toObject():ngo;
  delete data.passwordHash;delete data.tokenVersion;delete data.reviewedBy;delete data.adminNotes;delete data.supportingDocumentInfo;
  return {...data,verified:data.status==='VERIFIED',projectsCount:counts.projectsCount||0,opportunitiesCount:counts.opportunitiesCount||0};
}

async function countsFor(ngoId){
  const [projectsCount,opportunitiesCount]=await Promise.all([Project.countDocuments({ngo:ngoId,status:{$nin:['archived','draft']}}),VolunteerOpportunity.countDocuments({ngo:ngoId,status:'published'})]);
  return {projectsCount,opportunitiesCount};
}

router.get('/',async(req,res,next)=>{
  try{
    const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(50,Math.max(1,Number(req.query.limit)||12)),filter={status:'VERIFIED'};
    const search=clean(req.query.q);
    if(search)filter.$or=[{name:regex(search)},{description:regex(search)},{mission:regex(search)},{city:regex(search)},{state:regex(search)}];
    if(req.query.city)filter.city=regex(clean(req.query.city));
    if(req.query.state)filter.state=regex(clean(req.query.state));
    if(req.query.category){const category=await Category.findOne({name:regex(`^${clean(req.query.category)}$`)});if(!category)return res.json({data:[],page,limit,total:0,pages:0});filter.causes=category._id;}
    const [ngos,total]=await Promise.all([NGO.find(filter,publicFields).populate('causes','name slug').sort({name:1}).skip((page-1)*limit).limit(limit),NGO.countDocuments(filter)]);
    const data=await Promise.all(ngos.map(async ngo=>publicNgo(ngo,await countsFor(ngo._id))));
    res.json({data,page,limit,total,pages:Math.ceil(total/limit)});
  }catch(error){next(error);}
});

router.get('/categories',async(req,res,next)=>{try{res.json(await Category.find().sort({name:1}).select('name slug'));}catch(error){next(error);}});

router.get('/:id',async(req,res,next)=>{
  try{
    if(req.params.id==='ngo'||req.params.id==='admin')return next();
    if(!validId(req.params.id))return badId(res);
    const ngo=await NGO.findOne({_id:req.params.id,status:{$in:publicStatuses}},publicFields).populate('causes','name slug');
    if(!ngo)return notFound(res,'Verified NGO not found');
    res.json(publicNgo(ngo,await countsFor(ngo._id)));
  }catch(error){next(error);}
});

async function ensurePublicNgo(req,res){
  if(!validId(req.params.id)){badId(res);return null;}
  const ngo=await NGO.findOne({_id:req.params.id,status:'VERIFIED'},publicFields).populate('causes','name slug');
  if(!ngo){notFound(res,'Verified NGO not found');return null;}
  return ngo;
}
router.get('/:id/projects',async(req,res,next)=>{try{if(['ngo','admin'].includes(req.params.id))return next();if(!await ensurePublicNgo(req,res))return;res.json(await Project.find({ngo:req.params.id,status:{$nin:['draft','archived']}}).sort({createdAt:-1}));}catch(error){next(error);}});
router.get('/:id/events',async(req,res,next)=>{try{if(['ngo','admin'].includes(req.params.id))return next();if(!await ensurePublicNgo(req,res))return;res.json(await Event.find({ngo:req.params.id,status:'published'}).sort({date:1}));}catch(error){next(error);}});
router.get('/:id/opportunities',async(req,res,next)=>{try{if(['ngo','admin'].includes(req.params.id))return next();if(!await ensurePublicNgo(req,res))return;res.json(await VolunteerOpportunity.find({ngo:req.params.id,status:'published'}).sort({date:1}));}catch(error){next(error);}});
router.get('/:id/gallery',async(req,res,next)=>{try{if(['ngo','admin'].includes(req.params.id))return next();if(!await ensurePublicNgo(req,res))return;res.json(await GalleryImage.find({ngo:req.params.id}).sort({createdAt:-1}));}catch(error){next(error);}});
router.get('/:id/impact',async(req,res,next)=>{try{if(['ngo','admin'].includes(req.params.id))return next();if(!await ensurePublicNgo(req,res))return;res.json(await ImpactReport.find({ngo:req.params.id}).sort({reportedAt:-1,createdAt:-1}));}catch(error){next(error);}});

router.use('/ngo',requireAuth,requireRole('NGO'));
router.get('/ngo/me',async(req,res,next)=>{try{const ngo=await NGO.findById(req.auth.id,publicFields).populate('causes','name slug');if(!ngo)return notFound(res,'NGO account not found');res.json(ngo);}catch(error){next(error);}});
router.put('/ngo/me',async(req,res,next)=>{try{const updates=pick(req.body,editableNgoFields);delete updates.status;delete updates.passwordHash;if(updates.causes&&!Array.isArray(updates.causes))return res.status(400).json({error:'Causes must be an array'});const ngo=await NGO.findByIdAndUpdate(req.auth.id,updates,{new:true,runValidators:true}).select(publicFields).populate('causes','name slug');if(!ngo)return notFound(res,'NGO account not found');res.json(ngo);}catch(error){next(error);}});
router.get('/ngo/projects',async(req,res,next)=>{try{res.json(await Project.find({ngo:req.auth.id}).sort({createdAt:-1}));}catch(error){next(error);}});
router.get('/ngo/opportunities',async(req,res,next)=>{try{res.json(await VolunteerOpportunity.find({ngo:req.auth.id}).sort({createdAt:-1}));}catch(error){next(error);}});
router.get('/ngo/events',async(req,res,next)=>{try{res.json(await Event.find({ngo:req.auth.id}).sort({date:1}));}catch(error){next(error);}});
router.get('/ngo/overview',async(req,res,next)=>{try{const [projects,activeProjects,opportunities,events,applications,eventRegistrations]=await Promise.all([Project.countDocuments({ngo:req.auth.id}),Project.countDocuments({ngo:req.auth.id,status:'active'}),VolunteerOpportunity.countDocuments({ngo:req.auth.id}),Event.countDocuments({ngo:req.auth.id}),VolunteerApplication.countDocuments({opportunity:{$in:await VolunteerOpportunity.find({ngo:req.auth.id}).distinct('_id')}}),EventRegistration.countDocuments({event:{$in:await Event.find({ngo:req.auth.id}).distinct('_id')}})]);res.json({projects,activeProjects,opportunities,events,applications,eventRegistrations});}catch(error){next(error);}});

async function owned(Model,id,ngoId,res){
  if(!validId(id)){badId(res,'Invalid resource id');return null;}
  const item=await Model.findOne({_id:id,ngo:ngoId});
  if(!item){notFound(res,'Resource not found or not owned by this NGO');return null;}
  return item;
}
router.post('/ngo/projects',async(req,res,next)=>{try{const data=pick(req.body,projectFields);if(!data.name)return res.status(400).json({error:'Project name is required'});data.ngo=req.auth.id;res.status(201).json(await Project.create(data));}catch(error){next(error);}});
router.put('/ngo/projects/:id',async(req,res,next)=>{try{const project=await owned(Project,req.params.id,req.auth.id,res);if(!project)return;const data=pick(req.body,projectFields);delete data.ngo;Object.assign(project,data);await project.save();res.json(project);}catch(error){next(error);}});
router.delete('/ngo/projects/:id',async(req,res,next)=>{try{if(!await owned(Project,req.params.id,req.auth.id,res))return;await Project.deleteOne({_id:req.params.id,ngo:req.auth.id});res.sendStatus(204);}catch(error){next(error);}});

router.post('/ngo/opportunities',async(req,res,next)=>{try{const data=pick(req.body,opportunityFields);if(!data.title)return res.status(400).json({error:'Opportunity title is required'});data.ngo=req.auth.id;res.status(201).json(await VolunteerOpportunity.create(data));}catch(error){next(error);}});
router.put('/ngo/opportunities/:id',async(req,res,next)=>{try{const opportunity=await owned(VolunteerOpportunity,req.params.id,req.auth.id,res);if(!opportunity)return;Object.assign(opportunity,pick(req.body,opportunityFields));await opportunity.save();res.json(opportunity);}catch(error){next(error);}});
router.delete('/ngo/opportunities/:id',async(req,res,next)=>{try{if(!await owned(VolunteerOpportunity,req.params.id,req.auth.id,res))return;await VolunteerOpportunity.deleteOne({_id:req.params.id,ngo:req.auth.id});res.sendStatus(204);}catch(error){next(error);}});

router.post('/ngo/events',async(req,res,next)=>{try{const data=pick(req.body,eventFields);if(!data.name||!data.date)return res.status(400).json({error:'Event name and date are required'});data.ngo=req.auth.id;res.status(201).json(await Event.create(data));}catch(error){next(error);}});
router.put('/ngo/events/:id',async(req,res,next)=>{try{const event=await owned(Event,req.params.id,req.auth.id,res);if(!event)return;Object.assign(event,pick(req.body,eventFields));await event.save();res.json(event);}catch(error){next(error);}});
router.delete('/ngo/events/:id',async(req,res,next)=>{try{if(!await owned(Event,req.params.id,req.auth.id,res))return;await Event.deleteOne({_id:req.params.id,ngo:req.auth.id});res.sendStatus(204);}catch(error){next(error);}});

router.get('/ngo/gallery',async(req,res,next)=>{try{res.json(await GalleryImage.find({ngo:req.auth.id}).sort({createdAt:-1}));}catch(error){next(error);}});
router.post('/ngo/gallery',async(req,res,next)=>{try{const data=pick(req.body,galleryFields);if(!data.url)return res.status(400).json({error:'Gallery URL is required'});data.ngo=req.auth.id;for(const field of ['project','event'])if(data[field]&&!await owned(field==='project'?Project:Event,data[field],req.auth.id,res))return;res.status(201).json(await GalleryImage.create(data));}catch(error){next(error);}});
router.delete('/ngo/gallery/:id',async(req,res,next)=>{try{const item=await owned(GalleryImage,req.params.id,req.auth.id,res);if(!item)return;await item.deleteOne();res.sendStatus(204);}catch(error){next(error);}});

router.get('/admin/ngos',requireAuth,requireRole('ADMIN'),async(req,res,next)=>{try{const filter={};if(req.query.status)filter.status=String(req.query.status).toUpperCase();if(req.query.q)filter.$or=[{name:regex(clean(req.query.q))},{email:regex(clean(req.query.q))},{city:regex(clean(req.query.q))}];res.json(await NGO.find(filter,'-passwordHash -tokenVersion').sort({createdAt:-1}).populate('causes','name slug'));}catch(error){next(error);}});
router.get('/admin/ngos/:id',requireAuth,requireRole('ADMIN'),async(req,res,next)=>{try{if(!validId(req.params.id))return badId(res);const ngo=await NGO.findById(req.params.id,'-passwordHash -tokenVersion').populate('causes','name slug');if(!ngo)return notFound(res,'NGO not found');res.json(ngo);}catch(error){next(error);}});
async function review(req,res,next,status){try{if(!validId(req.params.id))return badId(res);const ngo=await NGO.findByIdAndUpdate(req.params.id,{status,adminNotes:clean(req.body.reason||req.body.note),reviewedBy:req.auth.id,reviewedAt:new Date()},{new:true,runValidators:true}).select('-passwordHash -tokenVersion');if(!ngo)return notFound(res,'NGO not found');res.json(ngo);}catch(error){next(error);}}
router.put('/admin/ngos/:id/verify',requireAuth,requireRole('ADMIN'),(req,res,next)=>review(req,res,next,'VERIFIED'));
router.put('/admin/ngos/:id/reject',requireAuth,requireRole('ADMIN'),(req,res,next)=>review(req,res,next,'REJECTED'));
router.put('/admin/ngos/:id/request-changes',requireAuth,requireRole('ADMIN'),(req,res,next)=>review(req,res,next,'CHANGES_REQUESTED'));
router.put('/admin/ngos/:id/suspend',requireAuth,requireRole('ADMIN'),(req,res,next)=>review(req,res,next,'SUSPENDED'));

export default router;
