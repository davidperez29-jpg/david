/** Fixed, non-diagnostic referral notice (§10 del encargo, §14.5). */
export function ReferralBanner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-danger bg-bg p-3 text-sm"
    >
      <span
        aria-hidden
        className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-danger"
      />
      <div>
        <p className="font-semibold text-danger">{text}</p>
        <p className="text-muted">
          El sistema no realiza diagnósticos. Registra la valoración del profesional cuando esté
          disponible.
        </p>
      </div>
    </div>
  );
}
