import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const EQHeader = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 h-20 flex items-center transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-primary/10"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollTo("hero")}>
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="font-heading font-bold text-primary-foreground text-lg">E</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-heading font-bold text-foreground text-xl">EQ</span>
            <span className="font-body text-muted-foreground text-sm">Platform</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "رؤية المنصة", id: "about" },
            { label: "كيفية العمل", id: "process" },
            { label: "لماذا EQ", id: "values" },
          ].map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="font-body text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </button>
          ))}
        </nav>

        {/* CTA */}
        <button
          onClick={() => scrollTo("cta")}
          className="bg-primary text-primary-foreground font-heading font-bold px-6 py-2.5 rounded-lg hover:shadow-gold transition-all duration-300 hover:-translate-y-0.5 text-sm"
        >
          ابدأ طلباً
        </button>
      </div>
    </motion.header>
  );
};

export default EQHeader;
