import './globals.css';

export const metadata = {
  title: 'SecOps Penetration Intelligence Terminal',
  description: 'Uncensored Audit Node',
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
