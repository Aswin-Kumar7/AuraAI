"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { useToast } from "./use-toast";

export function useTwilioClient() {
  const [device, setDevice] = useState<Device | null>(null);
  const [activeConnection, setActiveConnection] = useState<Call | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { toast } = useToast();
  
  // Initialize device exactly once.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/twilio/token");
        if (!res.ok) {
           console.error("Twilio Token fetch failed");
           return;
        }
        const data = await res.json();
        
        if (data.token) {
           console.log("[Twilio] Initializing device with token...");
           const newDevice = new Device(data.token, {
             edge: ['ashburn', 'roaming'],
           });

           newDevice.on("registered", () => {
             console.log("[Twilio] Device registered and ready for calls.");
             if (mounted) setIsReady(true);
           });

           newDevice.on("error", (error) => {
             console.error("Twilio Device Error:", error.code, error.message);
             if (error.code === 31008) {
               toast({ title: "Microphone Access Denied", description: "Please allow microphone access in your browser settings.", variant: "destructive" });
             }
           });

           newDevice.register();
           // Outbound WebRTC calls don't strictly require registration to complete first.
           if (mounted) {
              setDevice(newDevice);
              setIsReady(true); 
           }
        }
      } catch (err) {
        console.error("Twilio SDK Init Error:", err);
      }
    })();
    
    return () => {
      mounted = false;
      if (device) device.destroy();
    };
  }, []);

  const [callStatus, setCallStatus] = useState<string>("idle");

  const makeCall = useCallback(async (params: { customerPhone: string; twilioCallerId: string; context?: string }) => {
    if (!device) {
       toast({ title: "Dialer not ready", variant: "destructive" });
       return;
    }
    try {
      setCallStatus("dialing");
      const connection = await device.connect({ 
         params: {
            customerPhone: params.customerPhone,
            twilioCallerId: params.twilioCallerId,
            agentId: device.identity || "", // Twilio identity matches our agentId
            context: params.context || ""
         }
      });
      
      connection.on("accept", () => {
         setActiveConnection(connection);
         setCallStatus("active");
      });
      
      connection.on("disconnect", () => {
         setActiveConnection(null);
         setCallStatus("idle");
      });
      
      connection.on("error", (err) => {
         toast({ title: "Call Failed", description: err.message, variant: "destructive" });
         setActiveConnection(null);
         setCallStatus("idle");
      });

    } catch (e: any) {
      toast({ title: "Call Error", description: e.message, variant: "destructive" });
    }
  }, [device, toast]);

  const endCall = useCallback(() => {
    if (device) device.disconnectAll();
    setActiveConnection(null);
    setCallStatus("idle");
  }, [device]);

  const toggleMute = useCallback((shouldMute: boolean) => {
    if (activeConnection) {
      activeConnection.mute(shouldMute);
    }
  }, [activeConnection]);

  return { 
    device, 
    isReady, 
    makeCall, 
    endCall, 
    activeConnection, 
    toggleMute,
    callStatus 
  };
}
