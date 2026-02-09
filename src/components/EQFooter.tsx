import { Mail, Phone, MapPin } from "lucide-react";

const EQFooter = () => {
  return (
    <footer className="bg-[hsl(0_0%_2%)] border-t border-primary/15 pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Col 1 - Logo */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="font-heading font-bold text-primary-foreground">E</span>
              </div>
              <span className="font-heading font-bold text-foreground text-lg">EQ Platform</span>
            </div>
            <p className="font-body text-muted-foreground text-sm leading-relaxed">
              منصة EQ للوساطة التجارية الذكية - نبني الثقة رقمياً
            </p>
          </div>

          {/* Col 2 - Quick Links */}
          <div>
            <h4 className="font-heading font-bold text-foreground mb-4">روابط سريعة</h4>
            <ul className="space-y-3 font-body text-muted-foreground text-sm">
              {["الرئيسية", "كيفية العمل", "الأسئلة الشائعة", "اتصل بنا"].map((l) => (
                <li key={l}>
                  <a href="#" className="hover:text-primary transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 - Legal */}
          <div>
            <h4 className="font-heading font-bold text-foreground mb-4">قانوني</h4>
            <ul className="space-y-3 font-body text-muted-foreground text-sm">
              {["شروط الاستخدام", "سياسة الخصوصية", "سياسة الأمان"].map((l) => (
                <li key={l}>
                  <a href="#" className="hover:text-primary transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 - Contact */}
          <div>
            <h4 className="font-heading font-bold text-foreground mb-4">تواصل معنا</h4>
            <ul className="space-y-3 font-body text-muted-foreground text-sm">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-primary shrink-0" />
                info@eq-platform.com
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-primary shrink-0" />
                +966 XX XXX XXXX
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={14} className="text-primary shrink-0" />
                الرياض، المملكة العربية السعودية
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-primary/10 pt-6 text-center">
          <p className="font-body text-muted-foreground text-sm">
            © 2024 EQ Platform. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default EQFooter;
