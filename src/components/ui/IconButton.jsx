// Ikon gomb — törlés (x) vagy hozzáadás (+), disabled állapot, title tooltip
function IconButton({ onClick, icon, disabled = false, title, variant = 'default' }) {
  // Variáns alapján szín: danger = piros, accent = narancs, default = szürke
  const colorClass = disabled
    ? 'text-text-secondary opacity-30 cursor-not-allowed'
    : variant === 'danger'
    ? 'text-text-secondary hover:text-danger transition-colors cursor-pointer'
    : variant === 'accent'
    ? 'text-accent hover:text-accent-hover transition-colors cursor-pointer'
    : 'text-text-secondary hover:text-text-primary transition-colors cursor-pointer';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded transition-colors ${colorClass}`}
    >
      {icon === 'delete' && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      )}
      {icon === 'add' && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}

export default IconButton;
