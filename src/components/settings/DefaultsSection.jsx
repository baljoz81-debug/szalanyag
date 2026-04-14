// Alapértelmezett értékek szekció — vágási veszteség (mm) + szetek száma
// Állandóan látható input mezők (nem inline edit — kevés mező, nem tábla)
import NumericInput from '../ui/NumericInput';

function DefaultsSection({ cutLoss, setCount, onCutLossChange, onSetCountChange }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
      {/* Vágási veszteség */}
      <div className="flex flex-col gap-1">
        <NumericInput
          value={cutLoss}
          onChange={onCutLossChange}
          min={0}
          max={100}
          step={0.5}
          allowDecimal={true}
          label="Alapértelmezett vágási veszteség"
          unit="mm"
        />
        <p className="font-body text-xs text-text-secondary">
          Tizedes értéket is elfogad (pl. 2.5), tartomány: 0–100 mm
        </p>
      </div>

      {/* Szetek száma */}
      <div className="flex flex-col gap-1">
        <NumericInput
          value={setCount}
          onChange={onSetCountChange}
          min={1}
          max={9999}
          step={1}
          allowDecimal={false}
          label="Alapértelmezett szetek száma"
          unit="db"
        />
        <p className="font-body text-xs text-text-secondary">
          Pozitív egész szám, minimum: 1
        </p>
      </div>
    </div>
  );
}

export default DefaultsSection;
