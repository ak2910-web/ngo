import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {AdminUser,Category,Event,EventRegistration,GalleryImage,ImpactReport,NGO,Notification,Project,SavedItem,User,VolunteerApplication,VolunteerOpportunity} from './models.js';

const database=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/earthkind';
const images=['https://images.unsplash.com/photo-1538300342682-cf57afb97285?auto=format&fit=crop&w=700&q=80','https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=700&q=80','https://images.unsplash.com/photo-1528323273322-d81458248d40?auto=format&fit=crop&w=700&q=80'];
const password=await bcrypt.hash('DemoPass2026!',12);
const adminPassword=await bcrypt.hash('EarthKind2026!',12);

await mongoose.connect(database);
await Promise.all([Category.deleteMany({isDemo:true}),User.deleteMany({isDemo:true}),NGO.deleteMany({isDemo:true}),Project.deleteMany({isDemo:true}),Event.deleteMany({isDemo:true}),VolunteerOpportunity.deleteMany({isDemo:true}),GalleryImage.deleteMany({caption:/^\[DEMO\]/}),ImpactReport.deleteMany({description:/^\[DEMO\]/}),VolunteerApplication.deleteMany({isDemo:true}),EventRegistration.deleteMany({isDemo:true}),Notification.deleteMany({isDemo:true}),SavedItem.deleteMany({isDemo:true})]);

const categories=await Category.insertMany([
  {name:'Education',slug:'education',description:'Learning and skills support.',isDemo:true},
  {name:'Environment',slug:'environment',description:'Climate, water, gardens, and reuse.',isDemo:true},
  {name:'Community Health',slug:'community-health',description:'Local health and wellbeing initiatives.',isDemo:true},
  {name:'Women Empowerment',slug:'women-empowerment',description:'Community-led economic and leadership support.',isDemo:true}
]);
const categoryByName=Object.fromEntries(categories.map(category=>[category.name,category._id]));
const passwordHash=password;
const ngos=await NGO.insertMany([
  {name:'[DEMO] EarthKind Water Collective',slug:'demo-earthkind-water-collective',email:'water-demo@earthkind.test',passwordHash,registrationNumber:'DEMO-NGO-001',phone:'+91 90000 00001',city:'Pune',state:'Maharashtra',description:'[DEMO DATA] Community water resilience projects.',mission:'[DEMO DATA] Help neighborhoods maintain reliable shared water systems.',vision:'[DEMO DATA] Communities maintaining safe shared water together.',areasServed:['Pune','Satara'],causes:[categoryByName.Environment],contactPerson:'Demo Coordinator',status:'VERIFIED',isDemo:true},
  {name:'[DEMO] Green Corner Network',slug:'demo-green-corner-network',email:'gardens-demo@earthkind.test',passwordHash,registrationNumber:'DEMO-NGO-002',phone:'+91 90000 00002',city:'Bengaluru',state:'Karnataka',description:'[DEMO DATA] Resident-led urban gardens and food-growing education.',mission:'[DEMO DATA] Make small urban spaces healthier and more useful.',vision:'[DEMO DATA] Every neighborhood has a cared-for green corner.',areasServed:['Bengaluru','Mysuru'],causes:[categoryByName.Environment,categoryByName.Education],contactPerson:'Demo Coordinator',status:'VERIFIED',isDemo:true},
  {name:'[DEMO] Skills for Tomorrow',slug:'demo-skills-for-tomorrow',email:'skills-demo@earthkind.test',passwordHash,registrationNumber:'DEMO-NGO-003',phone:'+91 90000 00003',city:'Mumbai',state:'Maharashtra',description:'[DEMO DATA] Repair, reuse, and practical skills workshops.',mission:'[DEMO DATA] Keep useful materials in circulation and skills accessible.',vision:'[DEMO DATA] Practical knowledge is available to every maker.',areasServed:['Mumbai','Thane'],causes:[categoryByName.Education,categoryByName['Women Empowerment']],contactPerson:'Demo Coordinator',status:'PENDING',isDemo:true},
  {name:'[DEMO] Neighbourhood Health Circle',slug:'demo-neighbourhood-health-circle',email:'health-demo@earthkind.test',passwordHash,registrationNumber:'DEMO-NGO-004',phone:'+91 90000 00004',city:'Hyderabad',state:'Telangana',description:'[DEMO DATA] Community health education and local support circles.',mission:'[DEMO DATA] Make reliable health information easier to reach.',vision:'[DEMO DATA] Neighbors have practical tools for everyday wellbeing.',areasServed:['Hyderabad','Warangal'],causes:[categoryByName['Community Health']],contactPerson:'Demo Coordinator',status:'VERIFIED',isDemo:true},
  {name:'[DEMO] Learning Bridge Initiative',slug:'demo-learning-bridge-initiative',email:'learning-demo@earthkind.test',passwordHash,registrationNumber:'DEMO-NGO-005',phone:'+91 90000 00005',city:'Jaipur',state:'Rajasthan',description:'[DEMO DATA] Learning support and mentoring for young people.',mission:'[DEMO DATA] Help learners find consistent support and useful skills.',vision:'[DEMO DATA] Every learner can find a route forward.',areasServed:['Jaipur','Ajmer'],causes:[categoryByName.Education,categoryByName['Women Empowerment']],contactPerson:'Demo Coordinator',status:'CHANGES_REQUESTED',adminNotes:'[DEMO DATA] Sample review note.',isDemo:true}
]);
const water=ngos[0],garden=ngos[1],skills=ngos[2],health=ngos[3],learning=ngos[4];
const projects=await Project.insertMany([
  {name:'Rain to Roots',category:'Water',categoryRef:categoryByName.Environment,ngo:water._id,location:'Pune',description:'[DEMO DATA] Rainwater harvesting with neighborhood schools.',image:images[0],goal:500000,raised:370000,featured:true,status:'active',requiredVolunteers:12,isDemo:true},
  {name:'The Green Corner',category:'Urban Gardens',categoryRef:categoryByName.Environment,ngo:garden._id,location:'Bengaluru',description:'[DEMO DATA] Tiny gardens, big belonging.',image:images[1],goal:250000,raised:180000,featured:true,status:'active',requiredVolunteers:8,isDemo:true},
  {name:'Second Life Studio',category:'Circularity',categoryRef:categoryByName.Education,ngo:skills._id,location:'Mumbai',description:'[DEMO DATA] Making useful things from what we throw away.',image:images[2],goal:300000,raised:225000,featured:true,status:'active',requiredVolunteers:5,isDemo:true},
  {name:'Care Close to Home',category:'Community Health',categoryRef:categoryByName['Community Health'],ngo:health._id,location:'Hyderabad',description:'[DEMO DATA] Health information sessions hosted by neighborhood groups.',image:images[0],goal:180000,raised:96000,featured:false,status:'active',requiredVolunteers:7,isDemo:true},
  {name:'Learning Bridge Bus',category:'Education',categoryRef:categoryByName.Education,ngo:learning._id,location:'Jaipur',description:'[DEMO DATA] Mobile learning support for underserved neighborhoods.',image:images[1],goal:420000,raised:210000,featured:false,status:'active',requiredVolunteers:10,isDemo:true}
]);
const events=await Event.insertMany([
  {name:'River clean-up morning',category:'Environment',categoryRef:categoryByName.Environment,ngo:water._id,date:new Date('2026-10-21'),location:'Mula River, Pune',description:'[DEMO DATA] A hands-on morning restoring our riverbank.',capacity:40,status:'published',isDemo:true},
  {name:'Make & mend workshop',category:'Education',categoryRef:categoryByName.Education,ngo:skills._id,date:new Date('2026-11-05'),location:'Mumbai',description:'[DEMO DATA] Learn repair skills from local makers.',capacity:24,status:'published',isDemo:true},
  {name:'Seeds and stories',category:'Environment',categoryRef:categoryByName.Environment,ngo:garden._id,date:new Date('2026-11-12'),location:'Cubbon Park, Bengaluru',description:'[DEMO DATA] A gathering for gardeners and listeners.',capacity:30,status:'published',isDemo:true},
  {name:'Health questions, answered',category:'Community Health',categoryRef:categoryByName['Community Health'],ngo:health._id,date:new Date('2026-11-19'),location:'Hyderabad',description:'[DEMO DATA] A practical community health information session.',capacity:35,status:'published',isDemo:true}
]);
const opportunities=await VolunteerOpportunity.insertMany([
  {title:'[DEMO] Community garden guide',ngo:garden._id,project:projects[1]._id,category:categoryByName.Environment,description:'[DEMO DATA] Help new gardeners feel at home.',location:'Bengaluru',type:'offline',skills:['Gardening'],date:new Date('2026-10-24'),duration:'3 hours',slots:8,isDemo:true},
  {title:'[DEMO] Youth workshop mentor',ngo:skills._id,project:projects[2]._id,category:categoryByName.Education,description:'[DEMO DATA] Share a practical skill with young makers.',location:'Mumbai',type:'offline',skills:['Mentoring'],date:new Date('2026-11-05'),duration:'Half day',slots:6,isDemo:true},
  {title:'[DEMO] Learning session helper',ngo:learning._id,project:projects[4]._id,category:categoryByName.Education,description:'[DEMO DATA] Support a mobile learning session.',location:'Jaipur',type:'offline',skills:['Teaching'],date:new Date('2026-11-18'),duration:'3 hours',slots:5,isDemo:true}
]);
await GalleryImage.insertMany(images.map((url,index)=>({url,caption:`[DEMO] ${['Growing together','Hands in the soil','Waste, reimagined'][index]}`,tags:['Demo','Community'],location:ngos[index].city,ngo:ngos[index]._id,project:projects[index]._id})));
await ImpactReport.create({ngo:garden._id,project:projects[1]._id,title:'[DEMO] Green Corner progress',description:'[DEMO DATA] Sample impact report for development and academic demonstration.',metrics:{gardens:4,participants:32},reportedAt:new Date()});
const users=await User.insertMany([{name:'[DEMO] Volunteer User',email:'volunteer-demo@earthkind.test',passwordHash:password,phone:'+91 90000 00010',skills:['Gardening'],interests:['Environment'],location:'Bengaluru',isDemo:true},{name:'[DEMO] Student User',email:'student-demo@earthkind.test',passwordHash:password,skills:['Teaching'],interests:['Education'],location:'Mumbai',isDemo:true}]);
await VolunteerApplication.create({user:users[0]._id,opportunity:opportunities[0]._id,fullName:users[0].name,email:users[0].email,skills:'Gardening',availability:'Weekends',motivation:'[DEMO DATA] Sample application.',consent:true,isDemo:true});
await EventRegistration.create({user:users[1]._id,event:events[1]._id,isDemo:true});
await Notification.create({user:users[0]._id,type:'application_submitted',title:'[DEMO] Application submitted',message:'[DEMO DATA] Your sample application is pending review.',isDemo:true});
await SavedItem.create({user:users[0]._id,itemType:'OPPORTUNITY',item:opportunities[0]._id,isDemo:true});
await AdminUser.findOneAndUpdate({email:'admin@earthkind.org'},{name:'EarthKind Admin',email:'admin@earthkind.org',passwordHash:adminPassword,role:'ADMIN'},{upsert:true,new:true,setDefaultsOnInsert:true});
console.log('Seeded clearly marked EarthKind demo data.');
console.log('Admin: admin@earthkind.org / EarthKind2026!');
console.log('User: volunteer-demo@earthkind.test / DemoPass2026!');
console.log('NGO: water-demo@earthkind.test / DemoPass2026!');
await mongoose.disconnect();
