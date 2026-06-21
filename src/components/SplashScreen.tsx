import { useEffect, useState } from "react";
import logoImage from "@/assets/logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1500);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="animate-scale-in flex flex-col items-center gap-4">
        <img 
          src={logoImage} 
          alt="10to10 로고" 
          className="w-24 h-24 rounded-2xl animate-float shadow-lg"
        />
        <div className="text-3xl font-bold text-primary-foreground">
          10to10
        </div>
        <p className="text-primary-foreground/70 text-sm mt-2">
          우리 동네 학원 탐색 플랫폼
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
