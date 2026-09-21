import { HeroSection } from '@/components/sections/Hero';
import { SelectedWorkSection } from '@/components/sections/SelectedWork';
import { LabsSection } from '@/components/sections/Labs';
import { StackSection } from '@/components/sections/Stack';
import { AboutSection } from '@/components/sections/About';
import { ContactSection } from '@/components/sections/Contact';

export default function HomePage() {
  return (
    <main id="main-content">
      <HeroSection />
      <SelectedWorkSection />
      <LabsSection />
      <StackSection />
      <AboutSection />
      <ContactSection />
    </main>
  );
}
