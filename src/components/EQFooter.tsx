const EQFooter = () => {
  return (
    <footer className="bg-card border-t border-border py-10">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-gradient flex items-center justify-center">
              <span className="font-heading font-bold text-primary-foreground text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-foreground text-lg">EI</span>
          </div>

          {/* Copyright */}
          <p className="font-body text-muted-foreground text-sm">
            © {new Date().getFullYear()} EI Platform. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default EQFooter;