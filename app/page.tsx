'use client'
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import "./page.css";
import LineChart from "./components/lineChart";
import Loader from "./components/loader";
import ErrorCard from "./components/errorCard";

export interface BlockBaseGasProps {
  id: number,
  baseGas: string,
  timestamp: string
}

export enum TimeOptions {
  DEFAULT = "Default",
  FIFTEEN_MIN = "15Min",
  ONE_HOUR = "1Hr",
  ONE_DAY = "1Day"
}

export default function Home() {

  // Storing latest 25 blocks
  const [idBaseGas, setIdBaseGas] = useState<BlockBaseGasProps[]>([]);
  const [latestBaseGas, setLatestBaseGas] = useState<string>();
  const [option, setOption] = useState<TimeOptions>(TimeOptions.DEFAULT);
  const [loading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const getDefaultGases = async () => {
    setIsError(false)
    setLoading(true);
    setIdBaseGas([]);
    try {
      const response = await fetch("http://localhost:3001/api/blocks-default", { next: { revalidate: 30 } });
      const { data } = await response.json()

      setLatestBaseGas(data[data.length - 1].baseGas.substring(0, data[data.length - 1].baseGas.indexOf('.')))
      setIdBaseGas(data);
      setLoading(false);
    }
    catch (err) {
      console.error(err);
      setLoading(false);
      setIsError(true);
    }
  }

  const getBlocksOnTimeStamp = async (oldTimeStamp: number) => {
    setIsError(false)
    setLoading(true);
    setIdBaseGas([]);
    try {
      const response = await fetch(`http://localhost:3001/api/blocks-timestamp/${oldTimeStamp}`, { next: { revalidate: 30 } });
      const { data }: { data: BlockBaseGasProps[] } = await response.json();
      setLatestBaseGas(data[data.length - 1].baseGas.substring(0, data[data.length - 1].baseGas.indexOf('.')))
      setIdBaseGas(data);
      setLoading(false);
    }
    catch (err) {
      console.error(err);
      setLoading(false);
      setIsError(true)
    }
  }

  const handleOptionChange = (newValue: TimeOptions) => {
    if (option !== newValue) {
      setOption(newValue);
      if (newValue === "Default") {
        getDefaultGases();
      }
      else {
        let time: Date;
        let unixTime: number;
        let currentTime = new Date();
        switch (newValue) {
          case TimeOptions.FIFTEEN_MIN:
            time = new Date(currentTime.getTime() - 15 * 60 * 1000);
            unixTime = Math.floor(time.getTime() / 1000);
            getBlocksOnTimeStamp(unixTime);
            break;
          case TimeOptions.ONE_HOUR:
            time = new Date(currentTime.getTime() - 60 * 60 * 1000);
            unixTime = Math.floor(time.getTime() / 1000);
            getBlocksOnTimeStamp(unixTime);
            break;
          case TimeOptions.ONE_DAY:
            time = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
            unixTime = Math.floor(time.getTime() / 1000);
            getBlocksOnTimeStamp(unixTime);
            break;
        }
      }
    }
  }


  const getLatestBaseGas = () => {
    setIsError(false);
    const socket = io('ws://localhost:3001');
    window.onbeforeunload = function (e) {
      socket.emit("end");
      socket.disconnect();
    };

    socket.on("connect", () => {
      setIsError(false);
      console.log("Socket Connected");
    })

    socket.on("disconnect", (err) => {
      setIsError(true);
      console.error("Socket disconnected", err);
      socket.disconnect();
    })

    socket.on("newBlock", (latestBlock) => {
      setIsError(false);
      const data = JSON.parse(latestBlock)
      setLatestBaseGas(data.baseGas.substring(0, data.baseGas.indexOf('.')))

      // add new block to the end of the array and remove the first block
      setIdBaseGas((arr) => [...arr.slice(1), {
        id: Number(data.id),
        baseGas: data.baseGas,
        timestamp: data.timestamp
      }]);

    })
  }

  const renderChart = () => {
    return (isError ?
      <ErrorCard />
      :
      <LineChart points={idBaseGas} latestBaseGas={latestBaseGas} />
    )
  }

  useEffect(() => {
    getDefaultGases();
    // Set up live listener to get latest block and update
    getLatestBaseGas();
  }, [])

  return (
    <>
      <div className="component">
        <header>
          <span>Network Fee</span>
          <div className="slider">
            <span onClick={() => handleOptionChange(TimeOptions.DEFAULT)} className={option === TimeOptions.DEFAULT ? "active" : ""}>25 blocks</span>
            <span onClick={() => handleOptionChange(TimeOptions.FIFTEEN_MIN)} className={option === TimeOptions.FIFTEEN_MIN ? "active" : ""}>15Min</span>
            <span onClick={() => handleOptionChange(TimeOptions.ONE_HOUR)} className={option === TimeOptions.ONE_HOUR ? "active" : ""}>1Hr</span>
            <span onClick={() => handleOptionChange(TimeOptions.ONE_HOUR)} className={option === TimeOptions.ONE_DAY ? "active" : ""}>1D</span>
          </div>
        </header>
        {loading ? <Loader /> : renderChart()}
      </div>
    </>
  )
}
