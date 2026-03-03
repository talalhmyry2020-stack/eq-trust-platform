import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import EQHeader from "@/components/EQHeader";
import EQHero from "@/components/EQHero";
import EQAbout from "@/components/EQAbout";
import EQProcess from "@/components/EQProcess";
import EQValues from "@/components/EQValues";
import EQCTA from "@/components/EQCTA";
import EQFooter from "@/components/EQFooter";

const Index = () => {
  const { checking } = useRedirectIfAuthenticated();

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <EQHeader />
      <EQHero />
      <EQAbout />
      <EQProcess />
      <EQValues />
      <EQCTA />
      <EQFooter />
    </div>
  );
};

export default Index;
