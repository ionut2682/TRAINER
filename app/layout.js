export const metadata = {
  title: "Agent Nutriție & Sport",
  description: "Agent personal de nutriție și sport",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
