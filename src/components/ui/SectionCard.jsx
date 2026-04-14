// Panel kártya — #2a2a2a háttér, padding, rounded, cím fejléccel
function SectionCard({ title, children }) {
  return (
    <div className="bg-panel rounded-panel p-6 border border-border-subtle">
      {title && (
        <h2 className="font-heading text-lg text-text-primary mb-4 pb-3 border-b border-border-subtle">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

export default SectionCard;
