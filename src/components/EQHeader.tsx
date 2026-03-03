import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Menu, X } from "lucide-react";

const EQHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 h-20 flex items-center transition-all duration-500 ${
        scrolled
          ? "bg-card/80 backdrop-blur-xl shadow-sm border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => scrollTo("hero")}>
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <span className="font-heading font-bold text-primary-foreground text-lg">N</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-bold text-foreground text-xl tracking-tight">EI</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "من نحن", id: "about" },
            { label: "كيف نعمل", id: "process" },
            { label: "لماذا نحن", id: "values" },
          ].map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="font-body text-muted-foreground hover:text-foreground transition-colors duration-300 text-sm relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-brand-gradient transition-all duration-300 group-hover:w-full rounded-full" />
            </button>
          ))}
        </nav>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="font-body text-muted-foreground text-sm">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 border border-border text-foreground font-heading font-bold px-4 py-2 rounded-xl hover:bg-secondary transition-all duration-300 text-sm"
              >
                <LogOut size={16} />
                خروج
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate("/demo")}
                className="font-body text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                🧪 تجربة
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="font-body text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="bg-brand-gradient text-primary-foreground font-heading font-bold px-6 py-2.5 rounded-xl hover:shadow-brand hover:-translate-y-0.5 transition-all duration-300 text-sm"
              >
                إنشاء حساب
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-20 inset-x-0 bg-card/95 backdrop-blur-xl border-b border-border p-6 md:hidden"
        >
          <div className="flex flex-col gap-4">
            {["about", "process", "values"].map((id) => (
              <button key={id} onClick={() => scrollTo(id)} className="font-body text-foreground text-right py-2">
                {id === "about" ? "من نحن" : id === "process" ? "كيف نعمل" : "لماذا نحن"}
              </button>
            ))}
            {!user && (
              <button
                onClick={() => navigate("/auth")}
                className="bg-brand-gradient text-primary-foreground font-heading font-bold px-6 py-3 rounded-xl mt-2"
              >
                إنشاء حساب
              </button>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
};

export default EQHeader;