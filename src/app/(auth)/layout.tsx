export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-950" suppressHydrationWarning>
      {children}
    </div>
  );
}
