interface Props {
  status: "draft" | "ready" | "sent" | "empty";
}

const config = {
  draft: { label: "Rascunho", color: "bg-yellow-600" },
  ready: { label: "Pronto", color: "bg-blue-600" },
  sent: { label: "Enviado", color: "bg-green-600" },
  empty: { label: "Sem report", color: "bg-gray-600" },
};

export default function StatusBadge({ status }: Props) {
  const { label, color } = config[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${color}`}
    >
      {label}
    </span>
  );
}
