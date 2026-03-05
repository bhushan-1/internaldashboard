import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GoogleSignInButtonProps { className?: string; }

export const GoogleSignInButton = ({ className }: GoogleSignInButtonProps) => {
  const handleGoogleSignIn = () => {
    toast.info("Google sign-in is not available in local mode");
  };

  return (
    <Button variant="outline" onClick={handleGoogleSignIn} className={className}>
      Sign in with Google (disabled)
    </Button>
  );
};
