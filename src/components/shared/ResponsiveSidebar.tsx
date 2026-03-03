import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";

interface ResponsiveSidebarProps {
  children: React.ReactNode;
  className?: string;
}

const ResponsiveSidebar = ({ children, className }: ResponsiveSidebarProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Mobile toggle button - fixed */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-50 w-10 h-10 rounded-xl bg-card/90 backdrop-blur-lg border border-border/50 flex items-center justify-center shadow-lg"
        aria-label="فتح القائمة"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Overlay + Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-card border-l border-border/50 shadow-2xl flex flex-col",
                className
              )}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
              <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ResponsiveSidebar;
