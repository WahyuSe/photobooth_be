const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const slotsJson = '[{"id":"slot-0","photoIndex":0,"x":58.95728043009791,"y":120.64324042054395,"width":533.7772716724055,"height":382.0738486029743,"imageScale":1,"imageX":0,"imageY":0},{"id":"slot-1","photoIndex":0,"x":625.3427525090311,"y":121.55753012847762,"width":516.867686471298,"height":381.1615354877253,"imageScale":1,"imageX":0,"imageY":0},{"id":"slot-2","photoIndex":1,"x":51.73091349760519,"y":531.1443961559647,"width":542.9897859080156,"height":417.3563689783929,"imageScale":1,"imageX":0,"imageY":0},{"id":"slot-3","photoIndex":1,"x":626.6334066137568,"y":535.9406539349354,"width":516.5718964498997,"height":407.7638534204511,"imageScale":1,"imageX":0,"imageY":0},{"id":"slot-4","photoIndex":2,"x":58.95382707019166,"y":979.6793780987954,"width":533.3826684402609,"height":388.5444696088634,"imageScale":1,"imageX":0,"imageY":0},{"id":"slot-5","photoIndex":2,"x":626.6336067327927,"y":977.2698649759237,"width":516.5714962118308,"height":393.3634958546027,"imageScale":1,"imageX":0,"imageY":0}]';
  
  await prisma.template.update({
    where: { id: 'cmpf8crgt0000uqx42lrq6q87' },
    data: { slotsJson }
  });
  console.log('Done');
}
run();
