// Beállítások oldal — smart container, P2–P4 teljes implementáció
// 1. szekció: Szálhossz beállítások (BarLengthTable)
// 2. szekció: Egyéb beállítások (DefaultsSection — vágási veszteség + szetek száma)
import useSettingsStore from '../store/settingsStore';
import SectionCard from '../components/ui/SectionCard';
import BarLengthTable from '../components/settings/BarLengthTable';
import MaterialQualityTable from '../components/settings/MaterialQualityTable';
import DefaultsSection from '../components/settings/DefaultsSection';

function SettingsPage() {
  // Store adatok és akciók kiolvasása — egyetlen hely a Zustand híváshoz
  const barLengths = useSettingsStore((state) => state.barLengths);
  const updateBarLength = useSettingsStore((state) => state.updateBarLength);
  const updateBarType = useSettingsStore((state) => state.updateBarType);
  const addBarLength = useSettingsStore((state) => state.addBarLength);
  const removeBarLength = useSettingsStore((state) => state.removeBarLength);
  const reorderBarLengths = useSettingsStore((state) => state.reorderBarLengths);

  const materialQualities = useSettingsStore((state) => state.materialQualities);
  const updateMaterialQuality = useSettingsStore((state) => state.updateMaterialQuality);
  const addMaterialQuality = useSettingsStore((state) => state.addMaterialQuality);
  const removeMaterialQuality = useSettingsStore((state) => state.removeMaterialQuality);
  const reorderMaterialQualities = useSettingsStore((state) => state.reorderMaterialQualities);

  const defaultCutLoss = useSettingsStore((state) => state.defaultCutLoss);
  const defaultSetCount = useSettingsStore((state) => state.defaultSetCount);
  const setDefaultCutLoss = useSettingsStore((state) => state.setDefaultCutLoss);
  const setDefaultSetCount = useSettingsStore((state) => state.setDefaultSetCount);

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="font-heading text-2xl text-text-primary mb-1">
        Beállítások
      </h1>
      <p className="font-body text-text-secondary mb-6">
        Szálhossz, vágási veszteség, szetek száma
      </p>

      {/* 1. szekció: Szálhossz beállítások */}
      <SectionCard title="Szálhossz beállítások">
        <BarLengthTable
          barLengths={barLengths}
          onUpdateLength={updateBarLength}
          onUpdateType={updateBarType}
          onAdd={addBarLength}
          onRemove={removeBarLength}
          onReorder={reorderBarLengths}
        />
      </SectionCard>

      {/* 2. szekció: Anyagminőség beállítások */}
      <div className="mt-6">
        <SectionCard title="Anyagminőség beállítások">
          <MaterialQualityTable
            qualities={materialQualities}
            onUpdate={updateMaterialQuality}
            onAdd={addMaterialQuality}
            onRemove={removeMaterialQuality}
            onReorder={reorderMaterialQualities}
          />
        </SectionCard>
      </div>

      {/* 3. szekció: Egyéb beállítások */}
      <div className="mt-6">
        <SectionCard title="Egyéb beállítások">
          <DefaultsSection
            cutLoss={defaultCutLoss}
            setCount={defaultSetCount}
            onCutLossChange={setDefaultCutLoss}
            onSetCountChange={setDefaultSetCount}
          />
        </SectionCard>
      </div>
    </main>
  );
}

export default SettingsPage;
