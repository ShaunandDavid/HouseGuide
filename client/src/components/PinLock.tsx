import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, getPinStatus, verifyPin } from "@/lib/api";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function PinLock() {
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!currentUser) {
      setPinEnabled(false);
      setLocked(false);
      return;
    }
    let active = true;

    const loadStatus = () => {
      getPinStatus()
        .then((data) => {
          if (active) setPinEnabled(!!data?.enabled);
        })
        .catch(() => {
          if (active) setPinEnabled(false);
        });
    };

    loadStatus();
    const interval = setInterval(loadStatus, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!pinEnabled) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (locked) {
        // keep lock until PIN entered
        return;
      }
    };

    const interval = setInterval(() => {
      if (!locked && Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        setLocked(true);
      }
    }, 30000);

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, handleActivity));

    return () => {
      clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [pinEnabled, locked]);

  const handleUnlock = async () => {
    if (!pinValue.trim()) return;
    setIsVerifying(true);
    try {
      const response = await verifyPin(pinValue.trim());
      if (!response?.valid) {
        toast({
          title: "Invalid PIN",
          description: "Try again.",
          variant: "destructive",
        });
        return;
      }
      setLocked(false);
      setPinValue("");
      lastActivityRef.current = Date.now();
    } catch (error) {
      toast({
        title: "Unlock failed",
        description: "Unable to verify PIN. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!pinEnabled || !locked) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center px-6">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Session Locked</h2>
        <p className="text-sm text-gray-600">
          Enter your PIN to continue.
        </p>
        <Input
          type="password"
          inputMode="numeric"
          value={pinValue}
          onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ''))}
          placeholder="Enter PIN"
        />
        <Button
          className="w-full"
          onClick={handleUnlock}
          disabled={isVerifying}
        >
          {isVerifying ? "Unlocking..." : "Unlock"}
        </Button>
      </div>
    </div>
  );
}
