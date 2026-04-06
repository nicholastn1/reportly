export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg ${
        message.startsWith("Erro")
          ? "bg-red-900/90 text-red-200"
          : "bg-green-900/90 text-green-200"
      }`}
    >
      {message}
    </div>
  );
}
