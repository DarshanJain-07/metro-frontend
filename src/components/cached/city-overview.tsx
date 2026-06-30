import { getCachedCities } from "@/lib/cached-api";
import { SectionTitle, Surface } from "@/components/ui/surface";

interface City {
  id: number | string;
  name: string;
  state_name?: string;
}

export default async function CachedCityOverview({ companyId }: { companyId?: string }) {
  'use cache';
  // UI-level caching: this whole component's RSC payload is cached
  
  const cities: City[] = await getCachedCities(companyId);

  return (
    <Surface padding="lg">
      <SectionTitle className="mb-4">Network Cities</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {cities.slice(0, 12).map((city) => (
          <div key={city.id} className="p-3 bg-muted rounded border border-border/50">
            <p className="text-xs font-medium truncate">{city.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">{city.state_name}</p>
          </div>
        ))}
        {cities.length > 12 && (
          <div className="p-3 bg-primary/5 rounded border border-primary/10 flex items-center justify-center">
            <p className="text-[10px] font-medium text-primary">+{cities.length - 12} MORE</p>
          </div>
        )}
      </div>
    </Surface>
  );
}
