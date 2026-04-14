// P0: Ideiglenes "Hello World" kártya — P1 után törölhető
function DemoCard() {
  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="bg-panel rounded-panel p-8 border border-border-subtle">
        <h1 className="font-heading text-2xl text-text-primary mb-2">
          Szálanyag számító
        </h1>
        <p className="font-body text-text-secondary">
          Design rendszer kész — P0 teljesítve.
        </p>
        <span className="inline-block mt-3 px-3 py-1 bg-accent text-white font-body text-sm rounded">
          accent szín
        </span>
      </div>
    </div>
  );
}

export default DemoCard;
