import logoImage from "@/assets/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <img 
        src={logoImage} 
        alt="10to10 로고" 
        className={cn(sizeClasses[size], "rounded-md")}
      />
      {showText && (
        <div className={cn("font-bold text-primary", textSizeClasses[size])}>
          10to10
        </div>
      )}
    </div>
  );
};

// Helper function for className merging
const cn = (...classes: (string | undefined | false)[]) => 
  classes.filter(Boolean).join(" ");

export default Logo;
