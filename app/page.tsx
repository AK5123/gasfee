'use client'
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

import "./page.css";
import LineChart from "./components/lineChart";
import Loader from "./components/loader";

export interface BlockBaseGasProps{
  id: number,
  baseGas: string,
  timestamp: string
}

export default function Home() {
  
  // Storing latest 25 blocks
  const [idBaseGas,setIdBaseGas] = useState<BlockBaseGasProps[]>([]);
  const [latestBaseGas,setLatestBaseGas] = useState<string>();
  const [option,setOption] = useState<string>("Default");
  const [loading,setLoading] = useState<boolean>(true);
  const [isError,setIsError] = useState<boolean>(false);

  const getDefaultGases = async () => {
    setIsError(false)
    setLoading(true);
    setIdBaseGas([]);
    try{
      const response = await axios.get(`http://localhost:3001/api/blocks-default`)
      const data: BlockBaseGasProps[] = response.data.data;
      setLatestBaseGas(data[data.length-1].baseGas.substring(0,data[data.length-1].baseGas.indexOf('.')))
      setIdBaseGas(data);
      setLoading(false);
    }
    catch(err){
      console.error(err);
      setLoading(false);
      setIsError(true);
    }
  }

  const getBlocksOnTimeStamp = async (oldTimeStamp: number) => {
    setIsError(false)
    setLoading(true);
    setIdBaseGas([]);
    try{
      const response = await axios.get(`http://localhost:3001/api/blocks-timestamp/${oldTimeStamp}`)
      const data: BlockBaseGasProps[] = response.data.data;
      setLatestBaseGas(data[data.length-1].baseGas.substring(0,data[data.length-1].baseGas.indexOf('.')))
      setIdBaseGas(data);
     
      setLoading(false);
    }
    catch(err){
      console.error(err);
      setLoading(false);
      setIsError(true)
    }
    
  }

  const handleOptionChange = (newValue:string) => {
    if(option !== newValue){
      setOption(newValue);
      if(newValue === "Default"){
        getDefaultGases();
      }
      else{
        let time:Date;
        let unixTime:number;
        let currentTime = new Date();
        switch(newValue){
          case "15Min":
            time = new Date(currentTime.getTime() - 15 * 60 * 1000);
            unixTime = Math.floor(time.getTime() /1000);
            getBlocksOnTimeStamp(unixTime);
            break;
          case "1Hr":
            time = new Date(currentTime.getTime() -  60 * 60 * 1000);
            unixTime = Math.floor(time.getTime() /1000);
            getBlocksOnTimeStamp(unixTime);
            break;
          case "1Day":
            time = new Date(currentTime.getTime() - 24*60 * 60 * 1000);
            unixTime = Math.floor(time.getTime() /1000);
            getBlocksOnTimeStamp(unixTime);
            break;
        }
      }
    }
  }


  const getLatestBaseGas = () => {
    setIsError(false);
    const socket = io('ws://localhost:3001');
    window.onbeforeunload = function(e) {
      socket.emit("end");
      socket.disconnect();
    };
    
    socket.on("connect",()=>{
      setIsError(false);
      console.log("Socket Connected");
    })

    socket.on("disconnect",(err)=>{
      setIsError(true);
      console.error("Socket disconnected",err);
      socket.disconnect();
    })

    socket.on("newBlock",(latestBlock)=>{
      setIsError(false);
      const data = JSON.parse(latestBlock)
      setLatestBaseGas(data.baseGas.substring(0,data.baseGas.indexOf('.')))

      // add new block to the end of the array and remove the first block
      setIdBaseGas((arr)=>[...arr.slice(1),{
        id:Number(data.id),
        baseGas:data.baseGas,
        timestamp: data.timestamp
      }]);
      
    })
  }


  useEffect(()=>{
    getDefaultGases();
    // Set up live listener to get latest block and update
    getLatestBaseGas();
  },[])

  return (
   <>
    <div className="component">
      <header>
        <span>Network Fee</span>
        <div className="slider">
          <span onClick={()=>handleOptionChange("Default")} className={option === "Default"? "active" : ""}>25 blocks</span>  
          <span onClick={()=>handleOptionChange("15Min")} className={option === "15Min"? "active" : ""}>15Min</span>
          <span onClick={()=>handleOptionChange("1Hr")} className={option === "1Hr"? "active" : ""}>1Hr</span>
          <span onClick={()=>handleOptionChange("1Day")} className={option === "1Day"? "active" : ""}>1D</span>
        </div>            
      </header>
      {loading ? <Loader /> : isError? 
        (
          <div className="error-ctn">
            <img src="/danger.png" alt="Danger" width={"70px"} />
            <span>Server Error</span>
          </div>
        ):
        (
        <>
          <div>
            <p><span className="gasFee">{latestBaseGas}</span> <span>gwei</span></p>
            <p className="baseFeeText">Current Base Fee</p>
          </div>
            <LineChart 
              points = {idBaseGas}
            />
        </>
        )        
      }
     </div>       
   </>
  )
}
