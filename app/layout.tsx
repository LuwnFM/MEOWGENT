import './globals.css';

export const metadata = {
  title: 'SecOps MEOWGENT',
  description: 'AI-powered cybersecurity operations platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
