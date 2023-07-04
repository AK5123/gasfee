const express = require('express');
const http = require("http");
const { ethers } = require("ethers");
const { createClient } = require("redis");
const { Server } = require("socket.io");
require('dotenv').config();

const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

//Redis Details
const REDIS_URL = process.env.REDIS_URL ;
const REDIS_PORT = process.env.REDIS_PORT;

// Backend Details
const BACKEND_HOSTNAME = "localhost";
const BACKEND_PORT = 3001;
const EXPIRATION = 24 * 60 * 60;


// Ethereum Provider
const provider = new ethers.providers.JsonRpcProvider("https://eth.llamarpc.com");

// Add the blocks which were added while server was down
const addMissedValues = (redis,oldNumber,newNumber) => {
  const blockPromises = []
  console.log(oldNumber,newNumber);
  for(let i=oldNumber+1; i <newNumber;i++){
      blockPromises.push(provider.getBlock(i));
  }

  Promise.all(blockPromises)
    .then(async (blocks)=>{
      for(let i in blocks){
        await  redis.hSet(`${blocks[i].number}`,{
          baseGas: `${ethers.utils.formatUnits(blocks[i].baseFeePerGas.toString(),"gwei")}`,
          timestamp: `${blocks[i].timestamp}`
        });  
        await redis.expire(`${blocks[i].number}`,EXPIRATION);  
      }      
    })
    .then(()=>{console.log("Missing Blocks Added")})
    .catch(err=>{
      console.log(`Error in  Block`,err);
    })
}

const app = express();  
const httpServer = http.createServer(app);

//Socket.io
const io = new Server(httpServer,{
  cors: {
    origin:"*",
  }
});
io.disconnectSockets();


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

//Connection to redis server
const redis = createClient({
  host: REDIS_URL,
  port: REDIS_PORT,
});
(async () => {
  redis.connect();
})();
redis.on('connect', () => {
  console.log('Connected to Redis server');
});   
redis.on('error', (err) => {      
  console.error('Error connecting to Redis:', err);
  process.exit(1);
});

// Fill redis cache with recent 500 blocks - bootstrap data
const fillCache = async () => {
  console.time("Key1");
  console.log("Cache Filling Started");  

  try{
    const latestBlock = await provider.getBlock();
    const latestBlockNumber = latestBlock.number;
    const blockPromises = [];

    await redis.set("latestBlock",latestBlock.number);

    for(let i = 0;i<500;i++){
      blockPromises.push(provider.getBlock(latestBlockNumber-i))
    }
    const blocks = await Promise.all(blockPromises)
  
    for(const block of blocks){
      await  redis.hSet(`${block.number}`,{
        baseGas: `${ethers.utils.formatUnits(block.baseFeePerGas.toString(),"gwei")}`,
        timestamp: `${block.timestamp}`
      }); 
      await redis.expire(`${block.number}`,EXPIRATION);
    }
    console.log("Filled cache with 500 Data");
  }
  catch(err){
    console.log("Error while filling Cache",err);
  }
   
  console.timeEnd("Key1");
}


//Get latest Block and store it in redis
try{
  redis.get("latestBlock")
    .then(async (oldLatestBlockNumber)=>{
      if(oldLatestBlockNumber === null){
          fillCache()
          return;
      }
      const latestBlock = await provider.getBlock()      
      const latestBlockNumber = latestBlock.number;
      await redis.set("latestBlock",latestBlockNumber);
      await  redis.hSet(`${latestBlock.number}`,{
        baseGas: `${ethers.utils.formatUnits(latestBlock.baseFeePerGas.toString(),"gwei")}`,
        timestamp: `${latestBlock.timestamp}`
      }); 
      await redis.expire(`${latestBlock.number}`,EXPIRATION);

      if(latestBlockNumber !== oldLatestBlockNumber){
        oldNumber = Number(oldLatestBlockNumber);
        newNumber = Number(latestBlockNumber);
        addMissedValues(redis,oldNumber,newNumber);
      }             
    });  
}
catch(err){
  console.log(err)
  process.exit(1);
}


// Getting Live information of new block from the chain and storing it in redis
provider.on("block",async (id)=>{
  provider.getBlock(id)
    .then(async (latestBlock)=>{
      let latestBlockNumber = await redis.get("latestBlock");
      if(latestBlock.number.toString() !== latestBlockNumber){
        await redis.set("latestBlock",latestBlock.number.toString());
        await  redis.hSet(`${latestBlock.number}`,{
          baseGas: `${ethers.utils.formatUnits(latestBlock.baseFeePerGas.toString(),"gwei")}`,
          timestamp: `${latestBlock.timestamp}`
        });
        await redis.expire(`${latestBlock.number}`,EXPIRATION);

        // Emitting the new block to the connected clients
        io.emit('newBlock', JSON.stringify({
          id: latestBlock.number.toString(), 
          baseGas: `${ethers.utils.formatUnits(latestBlock.baseFeePerGas.toString(),"gwei")}`,
          timestamp: `${latestBlock.timestamp}`
        }));
        
      }
    })    
})

// Creating a socket connection and emitter
io.on("connection",(socket)=>{
  console.log("Client Connected");

  socket.on('end', function (){
    console.log("Client Disconnected");
    socket.disconnect(0);
  });
  
});

// Get all blocks within the given timestamp
const getBlocksOnTimestamp =  async (oldTimeStamp) => {
  let latestBlockNumber = await redis.get("latestBlock");
  let latestBlock = await redis.hGetAll(`${latestBlockNumber}`);

  const blocks = [];

  let i = latestBlockNumber;
  let block = latestBlock;
  let timestamp =latestBlock.timestamp;

  while(timestamp >= oldTimeStamp){  
   
    blocks.push(block); 
    i = i-1;
    block = await redis.hGetAll(`${i}`);  

    // If block is not present in redis then fetch it from chain and store it in redis
    if(block.timestamp === undefined || block.baseGas === undefined){
      let newBlock = await provider.getBlock(i);
      await  redis.hSet(`${newBlock.number}`,{
        baseGas: `${ethers.utils.formatUnits(newBlock.baseFeePerGas.toString(),"gwei")}`,
        timestamp: `${newBlock.timestamp}`
      });
      await redis.expire(`${newBlock.number}`,EXPIRATION);

      block = {
        id: i, 
        baseGas: `${ethers.utils.formatUnits(newBlock.baseFeePerGas.toString(),"gwei")}`,
        timestamp: `${newBlock.timestamp}`
      }  
    } else {
      block.id = i;
    }
    timestamp = block.timestamp;
  }

  const updatedBlocks = blocks.reverse()
  return updatedBlocks;
}

// API routes
app.get("/api/health",(req,res)=>{
  return res.status(200).send("OK");
})

// Get last 25 blocks
app.get("/api/blocks-default",async(req,res)=>{
  let latestBlockNumber = await redis.get("latestBlock");
  const arr = [];
  for(let i=latestBlockNumber-24; i<=latestBlockNumber;i++){
    const val = await redis.hGetAll(`${i}`);
    if(val.baseGas && val.timestamp){
      const obj = {
        id: i, 
        baseGas: val.baseGas,
        timestamp: val.timestamp
      }
      arr.push(obj);
    }
    else{
      const block = await provider.getBlock(i);
      await  redis.hSet(`${block.number}`,{
        baseGas: `${ethers.utils.formatUnits(block.baseFeePerGas.toString(),"gwei")}`,
        timestamp: `${block.timestamp}`
      });
      await redis.expire(`${block.number}`,EXPIRATION);
      const obj = {
        id: i, 
        baseGas: `${ethers.utils.formatUnits(block.baseFeePerGas.toString(),"gwei")}`,
        timestamp: `${block.timestamp}`
      }
      arr.push(obj);
    }   
  }

  return res.status(200).json({data: arr})

})

// Get blocks on timestamp - 15min, 1 hour, 1 day
app.get("/api/blocks-timestamp/:oldtimestamp",async(req,res)=>{
  let oldTimeStamp = req.params.oldtimestamp;
  const arr = await getBlocksOnTimestamp(oldTimeStamp);
  return res.status(200).json({data: arr});
})

httpServer.listen(BACKEND_PORT, (err) => {
  if (err) throw err;
    console.log(`> Ready on http://${BACKEND_HOSTNAME}:${BACKEND_PORT}`);
});
