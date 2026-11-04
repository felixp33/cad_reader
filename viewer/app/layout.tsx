import '@fontsource-variable/inter';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { ReferenceProvider } from '@/components/References';

export const metadata = { title: 'CAD Viewer' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body><ReferenceProvider>{children}</ReferenceProvider></body>
    </html>
  );
}
